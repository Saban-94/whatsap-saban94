// --- 1. הגדרות Firebase ---
const firebaseConfig = {
  apiKey: "AIzaSyBGYsZylsIyeWudp8_SlnLBelkgoNXjU60",
  authDomain: "app-saban94-57361.firebaseapp.com",
  projectId: "app-saban94-57361",
  storageBucket: "app-saban94-57361.firebasestorage.app",
  messagingSenderId: "275366913167",
  appId: "1:275366913167:web:f0c6f808e12f2aeb58fcfa",
  measurementId: "G-E297QYKZKQ"
};
if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// משתנים גלובליים
const urlParams = new URLSearchParams(window.location.search);
let customerId = urlParams.get('cid'); 
let staffId = urlParams.get('sid');
let allClientsData = [];
let currentChatId = null;
let isMenuOpen = false;
let isInternalMode = false;
let isMuted = false;
let isInitialLoad = true;
const notificationSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3');

// שחרור סאונד בלחיצה ראשונה
document.addEventListener('click', () => { if(isInitialLoad) isInitialLoad = false; }, { once: true });

// --- 2. OneSignal ---
window.OneSignalDeferred = window.OneSignalDeferred || [];
OneSignalDeferred.push(async function(OneSignal) {
    await OneSignal.init({
        appId: "546472ac-f9ab-4c6c-beb2-e41c72af9849",
        safari_web_id: "web.onesignal.auto.195e7e66-9dea-4e11-b56c-b4a654da5ab7",
        notifyButton: { enable: true, position: 'bottom-left', offset: { bottom: '90px', left: '15px' }, colors: { 'circle.background': 'rgba(0,128,105,0.4)', 'circle.foreground': 'white' } }
    });
    if (customerId) OneSignal.User.addTag("role", "client");
    if (staffId) OneSignal.User.addTag("role", "staff");
});

// --- 3. טעינת הדף (DOMContentLoaded) - התיקון הקריטי! ---
document.addEventListener("DOMContentLoaded", function() {
    initViews();
});

function initViews() {
    // מאזיני כפתורים גלובליים (רק אם קיימים)
    const muteBtn = document.getElementById('mute-btn');
    if(muteBtn) muteBtn.onclick = () => { isMuted = !isMuted; muteBtn.innerText = isMuted ? 'volume_off' : 'volume_up'; };

    const refreshBtn = document.getElementById('refresh-btn');
    if(refreshBtn) refreshBtn.onclick = () => window.location.reload();

    const backBtn = document.getElementById('back-btn');
    if(backBtn) backBtn.onclick = goBackToDashboard;

    // ניתוב לפי סוג משתמש
    if (staffId) {
        setupManagerView();
    } else if (customerId) {
        setupClientView();
    } else {
        const saved = localStorage.getItem('saban_cid');
        if (saved && !window.location.search.includes('cid')) window.location.href = `?cid=${saved}`;
        else document.body.innerHTML = '<h3 style="text-align:center; margin-top:50px;">נא להיכנס דרך קישור תקין</h3>';
    }

    // הגדרת כפתורי שליחה ו-FAB
    const sendBtn = document.getElementById('send-btn');
    if(sendBtn) sendBtn.onclick = sendMessage;
    
    const msgInput = document.getElementById('msg-input');
    if(msgInput) msgInput.onkeypress = (e) => { if(e.key==='Enter') sendMessage(); };
    
    const mainFab = document.getElementById('main-fab');
    if(mainFab) mainFab.onclick = handleFabClick;
    
    const internalBtn = document.getElementById('internal-msg-btn');
    if(internalBtn) internalBtn.onclick = () => {
        isInternalMode = !isInternalMode;
        internalBtn.style.color = isInternalMode ? 'red' : '#fbc02d';
        msgInput.placeholder = isInternalMode ? "הערה חסויה..." : "הקלד הודעה...";
    };
}

function setupManagerView() {
    safeSetText('app-title', "ניהול סידור");
    safeSetText('status-text', staffId);
    safeSetSrc('header-avatar', `https://ui-avatars.com/api/?name=${staffId}&background=random`);
    
    safeDisplay('stories-container', 'none');
    safeDisplay('chat-container', 'none');
    safeDisplay('input-area', 'none');
    safeDisplay('staff-dashboard', 'block');
    
    loadDashboardData();
}

function setupClientView() {
    localStorage.setItem('saban_cid', customerId);
    safeSetText('app-title', "ח.סבן חומרי בנין");
    safeSetText('status-text', "הזמנה פעילה");
    safeSetSrc('header-avatar', `https://ui-avatars.com/api/?name=${customerId}&background=random`);
    
    safeDisplay('staff-dashboard', 'none');
    safeDisplay('stories-container', 'flex');
    safeDisplay('input-area', 'flex');
    
    db.collection('users').doc(customerId).onSnapshot(doc => {
        if(doc.exists) {
            const d = doc.data();
            safeSetText('status-text', d.name || "הזמנה פעילה");
            renderProgress(d.status || 1);
        } else {
            renderProgress(1);
        }
    });
    loadChat(customerId);
}

// --- 4. לוגיקה ---
function loadDashboardData() {
    db.collection('users').orderBy('lastUpdate', 'desc').onSnapshot(snapshot => {
        allClientsData = [];
        let active = 0, history = 0;
        snapshot.forEach(doc => {
            const d = doc.data(); d.id = doc.id;
            if(d.type === 'client' || !d.type) {
                if (d.status === 4) history++; else active++;
                allClientsData.push(d);
            }
        });
        safeSetText('stat-active', active);
        safeSetText('stat-history', history);
        filterList('active');
    });
}

window.filterList = function(type) {
    const listDiv = document.getElementById('clients-list');
    if(!listDiv) return;
    listDiv.innerHTML = '';
    
    // סימון טאב
    document.querySelectorAll('.gate-card').forEach(c => c.classList.remove('active-filter'));
    const cards = document.querySelectorAll('.gate-card');
    if(type==='active' && cards[0]) cards[0].classList.add('active-filter');
    if(type==='history' && cards[1]) cards[1].classList.add('active-filter');

    const filtered = allClientsData.filter(c => type === 'active' ? (!c.status || c.status < 4) : c.status === 4);

    if (filtered.length === 0) { listDiv.innerHTML = '<div style="text-align:center; padding:20px; color:#999">אין נתונים</div>'; return; }

    filtered.forEach(c => {
        let statusTxt = "חדש";
        if(c.status==2) statusTxt="בטיפול";
        if(c.status==3) statusTxt="בדרך";
        if(c.status==4) statusTxt="סופקה";
        
        const div = document.createElement('div');
        div.className = 'chat-list-item';
        div.innerHTML = `
            <img src="https://ui-avatars.com/api/?name=${c.name||c.id}&background=random" class="chat-avatar">
            <div class="chat-info">
                <div class="chat-top"><span class="chat-name">${c.name||c.id}</span><span class="chat-time">${c.lastUpdate?new Date(c.lastUpdate.toDate()).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}):''}</span></div>
                <div class="chat-bottom"><span class="chat-preview">${statusTxt} • ${c.address||''}</span></div>
            </div>
        `;
        div.onclick = () => openStaffChat(c);
        listDiv.appendChild(div);
    });
};

function openStaffChat(client) {
    currentChatId = client.id;
    safeDisplay('staff-dashboard', 'none');
    safeDisplay('chat-container', 'block');
    safeDisplay('input-area', 'flex');
    safeDisplay('admin-controls', 'flex');
    safeDisplay('back-btn', 'block');
    safeDisplay('internal-msg-btn', 'block');

    safeSetText('app-title', client.name || client.id);
    safeSetText('status-text', "בשיחה");
    loadChat(client.id);
}

function goBackToDashboard() {
    currentChatId = null;
    safeDisplay('chat-container', 'none');
    safeDisplay('input-area', 'none');
    safeDisplay('admin-controls', 'none');
    safeDisplay('back-btn', 'none');
    safeDisplay('staff-dashboard', 'block');
    safeSetText('app-title', "ניהול סידור");
    safeSetText('status-text', staffId);
    if(window.unsubscribeChat) window.unsubscribeChat();
}

function loadChat(cid) {
    const container = document.getElementById('chat-container');
    if(!container) return;
    container.innerHTML = '<div class="date-divider">היום</div>';
    
    if (window.unsubscribeChat) window.unsubscribeChat();
    window.unsubscribeChat = db.collection('orders').doc(cid).collection('messages')
    .orderBy('timestamp', 'asc').onSnapshot(snapshot => {
        snapshot.docChanges().forEach(change => {
            if (change.type === "added") {
                const msg = change.doc.data();
                renderMessage(msg, container);
                if (!isInitialLoad && !isMe(msg.sender) && !isMuted) notificationSound.play().catch(()=>{});
            }
        });
        isInitialLoad = false;
        container.scrollTop = container.scrollHeight;
    });
}

function renderMessage(msg, container) {
    if (!staffId && msg.type === 'internal') return;
    const div = document.createElement('div');
    const me = isMe(msg.sender);
    let cls = 'message';
    if(msg.type==='internal') cls += ' internal';
    else if(msg.sender==='system') cls += ' received'; // הודעת מערכת בצד
    else cls += me ? ' sent' : ' received';
    
    div.className = cls;
    let content = msg.text || '';
    if(msg.type==='internal') content = `🔒 <b>הערה:</b><br>${content}`;
    else if(msg.title) content = `<b>${msg.title}</b><br>${content.replace(/\n/g, '<br>')}`;
    else if(msg.sender==='system') { div.style.textAlign='center'; div.style.width='100%'; div.style.background='none'; div.style.boxShadow='none'; content = `<div class="date-divider">${content}</div>`; }

    div.innerHTML = `${content}<div class="msg-meta">${msg.timestamp?new Date(msg.timestamp.toDate()).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}):''}</div>`;
    container.appendChild(div);
}

function sendMessage() {
    const input = document.getElementById('msg-input');
    const text = input.value.trim();
    const target = currentChatId || customerId;
    if (!text || !target) return;
    const type = (staffId && isInternalMode) ? 'internal' : 'regular';
    db.collection('orders').doc(target).collection('messages').add({
        text, sender: staffId?'staff':'customer', type, timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    input.value = '';
    if(isInternalMode) document.getElementById('internal-msg-btn').click();
}

// סטטוס ופרוגרס
window.updateStatus = function(val) {
    if(!currentChatId) return;
    db.collection('users').doc(currentChatId).set({ status: val, lastUpdate: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
    let txt = "";
    if(val==2) txt="ההזמנה בטיפול 📦";
    if(val==3) txt="ההזמנה יצאה 🚚";
    if(val==4) txt="ההזמנה נמסרה ✅";
    if(txt) db.collection('orders').doc(currentChatId).collection('messages').add({ text: txt, sender: 'system', timestamp: firebase.firestore.FieldValue.serverTimestamp() });
};

function renderProgress(step) {
    const container = document.getElementById('stories-container');
    if(!container) return;
    const fill = document.getElementById('progress-fill');
    if(fill) fill.style.width = ((step-1)/3)*100 + "%";
    
    // ניקוי והוספה מחדש
    const track = container.querySelector('.progress-track');
    const fillBar = container.querySelector('.progress-fill');
    container.innerHTML = '';
    if(track) container.appendChild(track);
    if(fillBar) container.appendChild(fillBar);

    ['התקבלה', 'בטיפול', 'בדרך', 'סופקה'].forEach((s, i) => {
        let cls = 'status-step';
        if(i+1 <= step) cls += ' active';
        if(i+1 < step) cls += ' completed';
        const div = document.createElement('div');
        div.className = cls;
        div.innerHTML = `<div class="status-circle">${i+1<step ? '<i class="material-icons" style="font-size:16px">check</i>' : i+1}</div><span class="status-label">${s}</span>`;
        container.appendChild(div);
    });
}

// כפתורי FAB ומודלים
function handleFabClick() {
    if(staffId && !currentChatId) toggleFabMenu();
    else document.getElementById('order-modal').style.display = 'flex';
}

function toggleFabMenu() {
    isMenuOpen = !isMenuOpen;
    const main = document.getElementById('main-fab');
    if(main) main.classList.toggle('rotate');
    const minis = document.querySelectorAll('.mini-fab');
    minis.forEach((m,i) => {
        if(isMenuOpen) setTimeout(()=>m.classList.add('show'), i*50);
        else m.classList.remove('show');
    });
}

// מודל משתמש חדש
window.openUserModal = function(role) {
    if(isMenuOpen) toggleFabMenu();
    document.getElementById('user-modal').style.display = 'flex';
    document.getElementById('new-user-role').value = role;
    document.getElementById('user-modal-title').innerText = role==='client'?'לקוח חדש':'איש צוות';
};

const saveUserBtn = document.getElementById('save-user-btn');
if(saveUserBtn) {
    saveUserBtn.onclick = () => {
        const id = document.getElementById('new-user-id').value;
        const name = document.getElementById('new-user-name').value;
        const role = document.getElementById('new-user-role').value;
        if(!id) { alert('חסר מזהה'); return; }
        db.collection('users').doc(id).set({
            name: name, type: role, lastUpdate: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        window.closeModal('user-modal');
    };
}

const submitOrderBtn = document.getElementById('submit-order-btn');
if(submitOrderBtn) {
    submitOrderBtn.onclick = () => {
        const contact = document.getElementById('order-contact').value;
        const address = document.getElementById('order-address').value;
        const item = document.getElementById('order-item').value;
        if(!item) { alert('חסר פירוט'); return; }
        const txt = `👤 ${contact}\n📍 ${address}\n📦 ${item}`;
        db.collection('orders').doc(customerId).collection('messages').add({
            text: txt, title: "הזמנה חדשה", sender: 'customer', timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        db.collection('users').doc(customerId).set({
            name: contact||"לקוח", address: address, status: 1, type: 'client', lastUpdate: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        window.closeModal('order-modal');
    };
}

// עזרים למניעת קריסות (Safe Setters)
function safeSetText(id, txt) { const el = document.getElementById(id); if(el) el.innerText = txt; }
function safeSetSrc(id, src) { const el = document.getElementById(id); if(el) el.src = src; }
function safeDisplay(id, val) { const el = document.getElementById(id); if(el) el.style.display = val; }
window.closeModal = (id) => document.getElementById(id).style.display = 'none';
function isMe(role) { return (staffId && role === 'staff') || (!staffId && role === 'customer'); }
window.switchTab = (t) => {
    document.querySelectorAll('.tab-item').forEach(e=>e.classList.remove('active'));
    document.getElementById('tab-'+t).classList.add('active');
    // כאן אפשר להוסיף לוגיקה לסינון לפי טאב
};
