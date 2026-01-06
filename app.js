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
if (!firebase.apps.length) { firebase.initializeApp(firebaseConfig); }
const db = firebase.firestore();

// סאונד
const notificationSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3');
let isInitialLoad = true;
let isMuted = false;
document.addEventListener('click', () => { if(isInitialLoad) isInitialLoad = false; }, { once: true });
document.getElementById('mute-btn').onclick = function() { isMuted = !isMuted; this.innerText = isMuted ? 'volume_off' : 'volume_up'; };
document.getElementById('refresh-btn').onclick = () => window.location.reload();

// --- 2. זיהוי משתמש ---
const urlParams = new URLSearchParams(window.location.search);
let customerId = urlParams.get('cid'); 
let staffId = urlParams.get('sid');
let allClientsData = [];
let currentChatId = null;

// OneSignal
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

// --- 3. ניהול תצוגה (Router) ---
const views = {
    dashboard: document.getElementById('staff-dashboard'),
    chat: document.getElementById('chat-container'),
    stories: document.getElementById('stories-container'),
    adminControls: document.getElementById('admin-controls'),
    inputArea: document.getElementById('input-area'),
    fabMenu: document.getElementById('fab-menu')
};
const headerElems = {
    avatar: document.getElementById('header-avatar'),
    title: document.getElementById('app-title'),
    subtitle: document.getElementById('status-text'),
    participants: document.getElementById('participants-bar'),
    backBtn: document.getElementById('back-btn')
};
let isInternalMode = false;
let isMenuOpen = false;

// אתחול
if (staffId) {
    // === מנהל ===
    setAvatar(staffId);
    headerElems.title.innerText = "ניהול סידור";
    headerElems.subtitle.innerText = staffId;
    views.stories.style.display = 'none';
    views.chat.style.display = 'none';
    views.adminControls.style.display = 'none';
    views.inputArea.style.display = 'none';
    views.dashboard.style.display = 'block';
    loadDashboardData();
} else if (customerId) {
    // === לקוח ===
    localStorage.setItem('saban_cid', customerId);
    setAvatar(customerId);
    headerElems.title.innerText = "ח.סבן חומרי בנין";
    headerElems.subtitle.innerText = "הזמנה פעילה";
    views.dashboard.style.display = 'none';
    loadFormCache();
    listenToStatus(customerId);
    loadChat(customerId);
} else {
    // === אורח ===
    const saved = localStorage.getItem('saban_cid');
    if (saved && !window.location.search.includes('cid')) window.location.href = `?cid=${saved}`;
    else views.chat.innerHTML = '<div style="text-align:center; padding:20px;">נא להיכנס דרך לינק תקין</div>';
}

// --- 4. לוגיקה למנהל (דשבורד וניהול משתמשים) ---
function loadDashboardData() {
    db.collection('users').orderBy('lastUpdate', 'desc').onSnapshot(snapshot => {
        allClientsData = [];
        let active = 0, history = 0;
        const listDiv = document.getElementById('clients-list');
        listDiv.innerHTML = '';

        snapshot.forEach(doc => {
            const d = doc.data(); d.id = doc.id;
            if(d.type === 'client') {
                if (d.status === 4) history++; else active++;
                allClientsData.push(d);
            }
        });

        document.getElementById('stat-active').innerText = active;
        document.getElementById('stat-history').innerText = history;
        renderClientList('active'); // ברירת מחדל
    });
}

window.filterDashboard = function(type) {
    const cards = document.querySelectorAll('.gate-card');
    cards.forEach(c => c.classList.remove('active-filter'));
    if(type==='active') cards[0].classList.add('active-filter');
    else cards[1].classList.add('active-filter');
    renderClientList(type);
};

function renderClientList(type) {
    const listDiv = document.getElementById('clients-list');
    listDiv.innerHTML = '';
    const filtered = allClientsData.filter(c => type === 'active' ? (!c.status || c.status < 4) : c.status === 4);

    if (filtered.length === 0) { listDiv.innerHTML = '<div style="text-align:center; padding:20px; color:#999">אין נתונים</div>'; return; }

    filtered.forEach(client => {
        // יצירת תגיות
        let tagsHtml = '';
        if(client.tags) {
            client.tags.forEach(tag => {
                let cls = 'tag-badge';
                if(tag==='urgent') { cls+=' tag-urgent'; tag='דחוף'; }
                if(tag==='crane') { cls+=' tag-crane'; tag='מנוף'; }
                tagsHtml += `<span class="${cls}">${tag}</span>`;
            });
        }

        const div = document.createElement('div');
        div.className = 'chat-list-item';
        div.innerHTML = `
            <img src="https://ui-avatars.com/api/?name=${client.name || client.id}&background=random&color=fff" class="chat-avatar">
            <div class="chat-info">
                <div class="chat-top-row">
                    <span class="chat-name">${client.name || client.id}</span>
                    <span class="chat-time">${client.lastUpdate ? new Date(client.lastUpdate.toDate()).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) : ''}</span>
                </div>
                <div class="chat-bottom-row">
                    <span class="chat-preview">${getStatusText(client.status)} • ${client.address || ''}</span>
                    <div class="tags-container">${tagsHtml}</div>
                </div>
            </div>
        `;
        div.onclick = () => openStaffChat(client);
        listDiv.appendChild(div);
    });
}

function getStatusText(s) {
    if(s==1) return '📥 התקבל';
    if(s==2) return '📦 בטיפול';
    if(s==3) return '🚚 בדרך';
    if(s==4) return '✅ סופקה';
    return 'חדש';
}

function openStaffChat(client) {
    currentChatId = client.id;
    views.dashboard.style.display = 'none';
    views.chat.style.display = 'block';
    views.inputArea.style.display = 'flex';
    views.adminControls.style.display = 'flex';
    headerElems.backBtn.style.display = 'block';
    
    headerElems.title.innerText = client.name || client.id;
    headerElems.subtitle.innerText = "בשיחה...";
    setAvatar(client.name || client.id);
    
    // הצגת משתתפים (סימולציה)
    headerElems.participants.innerHTML = `
        <span class="participant-pill">מנהל</span>
        <span class="participant-pill">${client.name}</span>
    `;

    document.getElementById('internal-msg-btn').style.display = 'block';
    loadChat(client.id);
}

// חזרה לדשבורד
headerElems.backBtn.onclick = () => {
    views.chat.style.display = 'none';
    views.inputArea.style.display = 'none';
    views.adminControls.style.display = 'none';
    headerElems.backBtn.style.display = 'none';
    views.dashboard.style.display = 'block';
    
    headerElems.title.innerText = "ניהול סידור";
    headerElems.subtitle.innerText = staffId;
    setAvatar(staffId);
    
    if (window.unsubscribeChat) window.unsubscribeChat();
    currentChatId = null;
};

// --- 5. ניהול משתמשים (User CRUD) ---
window.openUserModal = function(role) {
    document.getElementById('user-modal').style.display = 'flex';
    document.getElementById('new-user-role').value = role;
    document.getElementById('user-modal-title').innerText = role==='client'?'לקוח חדש':'איש צוות חדש';
    closeMenu();
};

document.getElementById('save-user-btn').onclick = () => {
    const id = document.getElementById('new-user-id').value;
    const name = document.getElementById('new-user-name').value;
    const role = document.getElementById('new-user-role').value;
    
    if(!id) { alert('חובה להזין מזהה'); return; }
    
    db.collection('users').doc(id).set({
        name: name,
        type: role,
        created: firebase.firestore.FieldValue.serverTimestamp(),
        lastUpdate: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true }).then(() => {
        alert('נשמר בהצלחה!');
        closeModal('user-modal');
    });
};

// --- 6. כפתור פלוס ותפריט ---
const mainFab = document.getElementById('main-fab');
mainFab.onclick = () => {
    if(staffId && !currentChatId) {
        // בדשבורד מנהל -> פתח תפריט
        toggleMenu();
    } else if(currentChatId || customerId) {
        // בצ'אט -> פתח מודל הזמנה
        document.getElementById('order-modal').style.display = 'flex';
    }
};

function toggleMenu() {
    isMenuOpen = !isMenuOpen;
    const fabs = document.querySelectorAll('.mini-fab');
    mainFab.classList.toggle('rotate');
    fabs.forEach((fab, idx) => {
        if(isMenuOpen) {
            setTimeout(() => fab.classList.add('show'), idx * 50);
        } else {
            fab.classList.remove('show');
        }
    });
}
function closeMenu() { if(isMenuOpen) toggleMenu(); }

// --- 7. סטורי / סטטוס ---
function listenToStatus(cid) {
    db.collection('users').doc(cid).onSnapshot(doc => {
        if(doc.exists) {
            const d = doc.data();
            renderProgress(d.status || 1);
            if(d.name) headerElems.subtitle.innerText = "שלום, " + d.name;
        }
    });
}
function renderProgress(step) {
    const fill = document.getElementById('progress-fill');
    const width = ((step - 1) / 3) * 100;
    fill.style.width = width + "%";
    
    views.stories.innerHTML = '<div class="progress-track"></div><div class="progress-fill" style="width:'+width+'%"></div>';
    
    const steps = ['התקבלה', 'בטיפול', 'בדרך', 'סופקה'];
    steps.forEach((s, i) => {
        let cls = 'status-step';
        if(i+1 <= step) cls += ' active';
        if(i+1 < step) cls += ' completed';
        
        views.stories.innerHTML += `
            <div class="${cls}">
                <div class="status-circle">${i+1 < step ? '<i class="material-icons" style="font-size:16px">check</i>' : i+1}</div>
                <span class="status-label">${s}</span>
            </div>
        `;
    });
}

// --- 8. צ'אט ---
function loadChat(cid) {
    if(!views.chat) return;
    if (window.unsubscribeChat) window.unsubscribeChat();
    window.unsubscribeChat = db.collection('orders').doc(cid).collection('messages')
    .orderBy('timestamp', 'asc').onSnapshot(snapshot => {
        snapshot.docChanges().forEach(change => {
            if (change.type === "added") {
                const msg = change.doc.data();
                renderMessage(msg);
                if (!isInitialLoad && !isMe(msg.sender) && !isMuted) notificationSound.play().catch(()=>{});
            }
        });
        isInitialLoad = false;
        views.chat.scrollTop = views.chat.scrollHeight;
    });
}

function renderMessage(msg) {
    if (!staffId && msg.type === 'internal') return;
    const div = document.createElement('div');
    const me = isMe(msg.sender);
    let cls = 'message';
    if (msg.type === 'internal') cls += ' internal';
    else if (msg.sender === 'system') cls += ' received'; // System looks like received
    else if (me) cls += ' sent'; else cls += ' received';

    div.className = cls;
    // כותרת שם
    let senderName = (!me && msg.sender === 'staff') ? `<div class="msg-header">צוות</div>` : "";
    
    let content = msg.text;
    if (msg.type === 'internal') content = `🔒 <b>הערה פנימית:</b><br>${content}`;
    else if (msg.isOrder) content = `<b>${msg.title||'הזמנה'}</b><br>${msg.text.replace(/\n/g, '<br>')}`;

    let time = msg.timestamp ? new Date(msg.timestamp.toDate()).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '';
    div.innerHTML = `${senderName}${content}<div class="msg-meta">${time}</div>`;
    views.chat.appendChild(div);
}

// --- 9. שליחה, סטטוס ותגיות ---
document.getElementById('send-btn').onclick = sendMessage;
document.getElementById('msg-input').onkeypress = (e) => { if(e.key==='Enter') sendMessage(); };
if(internalMsgBtn) internalMsgBtn.onclick = () => { 
    isInternalMode = !isInternalMode; 
    internalMsgBtn.style.color = isInternalMode ? 'red' : '#fbc02d'; 
    document.getElementById('msg-input').placeholder = isInternalMode ? "הערה חסויה..." : "הקלד הודעה...";
};

function sendMessage() {
    const input = document.getElementById('msg-input');
    const text = input.value.trim();
    if (!text || (!customerId && !currentChatId)) return;
    const target = currentChatId || customerId;
    const type = (staffId && isInternalMode) ? 'internal' : 'regular';
    
    db.collection('orders').doc(target).collection('messages').add({
        text, sender: staffId?'staff':'customer', type, staffId: staffId||null, timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    input.value = '';
    if(isInternalMode) internalMsgBtn.click();
}

window.updateStatus = function(val) {
    if(!currentChatId) return;
    db.collection('users').doc(currentChatId).set({ status: val, lastUpdate: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
    
    let txt = "";
    if(val==2) txt="ההזמנה בטיפול במחסן 📦";
    if(val==3) txt="ההזמנה יצאה אליך! 🚚";
    if(val==4) txt="ההזמנה נמסרה בהצלחה ✅";
    
    if(txt) {
        db.collection('orders').doc(currentChatId).collection('messages').add({
            text: txt, sender: 'system', type: 'regular', timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
    }
};

window.toggleTag = function(tag) {
    if(!currentChatId) return;
    // כאן צריך לוגיקה להוסיף/להסיר ממערך ב-Firestore (דורש arrayUnion)
    // לפשטות, נדרוס כרגע מערך קיים
    db.collection('users').doc(currentChatId).get().then(doc => {
        let tags = doc.data().tags || [];
        if(tags.includes(tag)) tags = tags.filter(t => t!==tag);
        else tags.push(tag);
        db.collection('users').doc(currentChatId).update({ tags: tags });
        alert('תגיות עודכנו');
    });
};

// עזרים
function setAvatar(seed) {
    document.getElementById('header-avatar').src = `https://ui-avatars.com/api/?name=${seed}&background=random&color=fff&bold=true`;
}
function isMe(role) { return (staffId && role === 'staff') || (!staffId && role === 'customer'); }
window.closeModal = (id) => document.getElementById(id).style.display = 'none';

// לוגיקת הזמנה (מודל)
document.getElementById('submit-order-btn').onclick = () => {
    const contact = document.getElementById('order-contact').value;
    const address = document.getElementById('order-address').value;
    const item = document.getElementById('order-item').value;
    const time = document.getElementById('order-time').value;
    if(!item) { alert("חסר פירוט"); return; }
    
    saveFormCache(contact, address);
    const txt = `👤 ${contact}\n📍 ${address}\n📦 ${item}\n⏰ ${time}`;
    
    db.collection('orders').doc(customerId).collection('messages').add({ 
        text: txt, title: "📦 הזמנה חדשה", sender: 'customer', isOrder: true, timestamp: firebase.firestore.FieldValue.serverTimestamp() 
    });
    
    db.collection('users').doc(customerId).set({ 
        status: 1, type: 'client', name: contact || "לקוח", address: address, lastUpdate: firebase.firestore.FieldValue.serverTimestamp() 
    }, { merge: true });

    document.getElementById('order-item').value = '';
    closeModal('order-modal');
};

function saveFormCache(c, a) { if(c) localStorage.setItem('lc', c); if(a) localStorage.setItem('la', a); }
function loadFormCache() { 
    if(document.getElementById('order-contact')) document.getElementById('order-contact').value = localStorage.getItem('lc') || '';
    if(document.getElementById('order-address')) document.getElementById('order-address').value = localStorage.getItem('la') || '';
}
