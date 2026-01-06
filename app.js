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
let allUsersData = []; // כאן נשמור את כולם (לקוחות, צוות, קבוצות)
let currentTab = 'chats'; // ברירת מחדל: צ'אטים
let currentFilter = 'active'; // ברירת מחדל: פעילים
let currentChatId = null;
let isMenuOpen = false;
let isInternalMode = false;
let isMuted = false;
let isInitialLoad = true;
const notificationSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3');

// שחרור סאונד
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

// --- 3. אתחול (DOMContentLoaded) ---
document.addEventListener("DOMContentLoaded", function() {
    initViews();
});

function initViews() {
    // כפתורים גלובליים
    safeOnClick('mute-btn', () => { isMuted = !isMuted; document.getElementById('mute-btn').innerText = isMuted ? 'volume_off' : 'volume_up'; });
    safeOnClick('refresh-btn', () => window.location.reload());
    safeOnClick('back-btn', goBackToDashboard);
    
    // ניתוב משתמשים
    if (staffId) {
        setupManagerView();
    } else if (customerId) {
        setupClientView();
    } else {
        const saved = localStorage.getItem('saban_cid');
        if (saved && !window.location.search.includes('cid')) window.location.href = `?cid=${saved}`;
        else document.body.innerHTML = '<h3 style="text-align:center; margin-top:50px;">נא להיכנס דרך קישור תקין</h3>';
    }

    // הגדרת שליחה
    safeOnClick('send-btn', sendMessage);
    const msgInput = document.getElementById('msg-input');
    if(msgInput) msgInput.onkeypress = (e) => { if(e.key==='Enter') sendMessage(); };
    
    // כפתור FAB ראשי
    safeOnClick('main-fab', handleFabClick);
    
    // כפתור הודעה חסויה
    safeOnClick('internal-msg-btn', () => {
        isInternalMode = !isInternalMode;
        const btn = document.getElementById('internal-msg-btn');
        btn.style.color = isInternalMode ? 'red' : '#fbc02d';
        msgInput.placeholder = isInternalMode ? "הערה חסויה לצוות..." : "הקלד הודעה...";
    });
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

// --- 4. מנוע הדשבורד והטאבים (הלב של התיקון) ---

function loadDashboardData() {
    // טוען את *כל* המשתמשים (לא מסנן כאן כדי שיהיה לנו הכל בזיכרון)
    db.collection('users').orderBy('lastUpdate', 'desc').onSnapshot(snapshot => {
        allUsersData = [];
        let activeCount = 0;
        let historyCount = 0;

        snapshot.forEach(doc => {
            const d = doc.data(); d.id = doc.id;
            allUsersData.push(d);
            
            // חישוב סטטיסטיקה (רק ללקוחות)
            if (d.type === 'client' || !d.type) {
                if (d.status === 4) historyCount++; else activeCount++;
            }
        });

        safeSetText('stat-active', activeCount);
        safeSetText('stat-history', historyCount);
        
        // רינדור הרשימה לפי הטאב הנוכחי
        renderList();
    });
}

// פונקציית החלפת לשוניות (טאבים)
window.switchTab = function(tabName) {
    currentTab = tabName;
    
    // עדכון ויזואלי של הטאבים
    document.querySelectorAll('.tab-item').forEach(el => el.classList.remove('active'));
    document.getElementById('tab-' + tabName).classList.add('active');
    
    // אם עברנו ללשונית שהיא לא צ'אטים, נסתיר את הפילטרים של פעיל/היסטוריה
    const gates = document.querySelector('.dashboard-gates');
    if (tabName === 'chats') {
        gates.style.display = 'grid';
    } else {
        gates.style.display = 'none';
    }

    renderList();
};

// פונקציית סינון (פעיל/היסטוריה) - רלוונטית רק לצ'אטים
window.filterList = function(filterType) {
    currentFilter = filterType;
    
    // ויזואליזציה של הכרטיס שנבחר
    const cards = document.querySelectorAll('.gate-card');
    cards.forEach(c => c.classList.remove('active-filter'));
    if(filterType === 'active' && cards[0]) cards[0].classList.add('active-filter');
    if(filterType === 'history' && cards[1]) cards[1].classList.add('active-filter');
    
    // אם לחצו על הפילטר והיינו בטאב אחר, נחזור לטאב צ'אטים
    if(currentTab !== 'chats') switchTab('chats');
    else renderList();
};

// הפונקציה הראשית שמציירת את הרשימה
function renderList() {
    const listDiv = document.getElementById('clients-list');
    if(!listDiv) return;
    listDiv.innerHTML = '';
    
    let filtered = [];

    // סינון לפי הטאב הנוכחי
    if (currentTab === 'chats') {
        // מציג רק לקוחות (type='client' או ריק לתמיכה לאחור)
        filtered = allUsersData.filter(u => u.type === 'client' || !u.type);
        
        // בתוך לקוחות - מסנן לפי סטטוס (פעיל/היסטוריה)
        if (currentFilter === 'active') {
            filtered = filtered.filter(u => !u.status || u.status < 4);
        } else {
            filtered = filtered.filter(u => u.status === 4);
        }
        
    } else if (currentTab === 'groups') {
        // מציג רק קבוצות
        filtered = allUsersData.filter(u => u.type === 'group');
        
    } else if (currentTab === 'staff') {
        // מציג רק אנשי צוות
        filtered = allUsersData.filter(u => u.type === 'staff');
    }

    if (filtered.length === 0) { 
        listDiv.innerHTML = '<div style="text-align:center; padding:30px; color:#999">אין תוצאות להצגה</div>'; 
        return; 
    }

    filtered.forEach(user => {
        let statusTxt = "";
        let subText = user.address || "";
        
        // התאמת טקסט לפי סוג
        if (currentTab === 'chats') {
            if(user.status==1) statusTxt = "📥 התקבל";
            else if(user.status==2) statusTxt = "📦 בטיפול";
            else if(user.status==3) statusTxt = "🚚 בדרך";
            else if(user.status==4) statusTxt = "✅ סופקה";
            else statusTxt = "🆕 חדש";
        } else if (currentTab === 'staff') {
            statusTxt = "👷‍♂️ איש צוות";
            subText = user.phone || "";
        } else {
            statusTxt = "👥 קבוצה";
        }

        // יצירת אלמנט הרשימה
        const div = document.createElement('div');
        div.className = 'chat-list-item';
        div.innerHTML = `
            <img src="https://ui-avatars.com/api/?name=${user.name||user.id}&background=random&color=fff" class="chat-avatar">
            <div class="chat-info">
                <div class="chat-top">
                    <span class="chat-name">${user.name || user.id}</span>
                    <span class="chat-time">${user.lastUpdate ? new Date(user.lastUpdate.toDate()).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) : ''}</span>
                </div>
                <div class="chat-bottom">
                    <span class="chat-preview">
                        <span style="color:var(--primary-color); font-weight:bold;">${statusTxt}</span> 
                        ${subText ? ' • ' + subText : ''}
                    </span>
                </div>
            </div>
        `;
        div.onclick = () => openStaffChat(user);
        listDiv.appendChild(div);
    });
}

function openStaffChat(user) {
    currentChatId = user.id;
    safeDisplay('staff-dashboard', 'none');
    safeDisplay('chat-container', 'block');
    safeDisplay('input-area', 'flex');
    safeDisplay('admin-controls', 'flex');
    safeDisplay('back-btn', 'block');
    safeDisplay('internal-msg-btn', 'block');

    safeSetText('app-title', user.name || user.id);
    safeSetText('status-text', user.type === 'staff' ? 'איש צוות' : 'לקוח בטיפול');
    safeSetSrc('header-avatar', `https://ui-avatars.com/api/?name=${user.name||user.id}&background=random`);
    
    // הצגת משתתפים בכותרת (דמה)
    const parts = document.getElementById('participants-bar');
    if(parts) parts.innerHTML = `<span class="participant-pill">מנהל</span><span class="participant-pill">${user.name}</span>`;

    loadChat(user.id);
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
    safeSetSrc('header-avatar', `https://ui-avatars.com/api/?name=${staffId}&background=random`);
    const parts = document.getElementById('participants-bar');
    if(parts) parts.innerHTML = '';

    if(window.unsubscribeChat) window.unsubscribeChat();
}

// --- 5. צ'אט (Chat Engine) ---
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
    else if(msg.sender==='system') cls += ' received'; 
    else cls += me ? ' sent' : ' received';
    
    div.className = cls;
    let content = msg.text || '';
    
    if(msg.type==='internal') content = `🔒 <b>הערה פנימית:</b><br>${content}`;
    else if(msg.title) content = `<b>${msg.title}</b><br>${content.replace(/\n/g, '<br>')}`;
    else if(msg.sender==='system') { 
        div.style.textAlign='center'; div.style.width='100%'; div.style.background='none'; div.style.boxShadow='none'; 
        content = `<div class="date-divider">${content}</div>`; 
    }

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
        text, sender: staffId?'staff':'customer', type, staffId: staffId||null, timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    input.value = '';
    if(isInternalMode) document.getElementById('internal-msg-btn').click();
}

// סטטוס
window.updateStatus = function(val) {
    if(!currentChatId) return;
    db.collection('users').doc(currentChatId).set({ status: val, lastUpdate: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
    let txt = "";
    if(val==2) txt="ההזמנה בטיפול 📦";
    if(val==3) txt="ההזמנה יצאה 🚚";
    if(val==4) txt="ההזמנה נמסרה ✅";
    if(txt) db.collection('orders').doc(currentChatId).collection('messages').add({ text: txt, sender: 'system', timestamp: firebase.firestore.FieldValue.serverTimestamp() });
};

// --- 6. תפריטים ומודלים ---
function handleFabClick() {
    if(staffId && !currentChatId) toggleFabMenu();
    else document.getElementById('order-modal').style.display = 'flex';
}

function toggleFabMenu() {
    isMenuOpen = !isMenuOpen;
    const main = document.getElementById('main-fab');
    if(main) main.classList.toggle('rotate');
    
    const clientFab = document.getElementById('fab-client');
    const staffFab = document.getElementById('fab-staff');
    
    if(isMenuOpen) {
        if(clientFab) { clientFab.classList.add('show'); }
        if(staffFab) { setTimeout(() => staffFab.classList.add('show'), 50); }
    } else {
        if(clientFab) clientFab.classList.remove('show');
        if(staffFab) staffFab.classList.remove('show');
    }
}

// ניהול משתמשים (לקוח/צוות/קבוצה)
window.openUserModal = function(role) {
    if(isMenuOpen) toggleFabMenu();
    const modal = document.getElementById('user-modal');
    if(modal) modal.style.display = 'flex';
    document.getElementById('new-user-role').value = role;
    
    const titles = { 'client': 'לקוח חדש', 'staff': 'איש צוות חדש', 'group': 'קבוצה חדשה' };
    document.getElementById('user-modal-title').innerText = titles[role] || 'משתמש חדש';
};

safeOnClick('save-user-btn', () => {
    const id = document.getElementById('new-user-id').value;
    const name = document.getElementById('new-user-name').value;
    const role = document.getElementById('new-user-role').value; // client/staff/group
    
    if(!id) { alert('חובה להזין מזהה'); return; }
    
    // יצירת המשתמש עם הסוג הנכון
    db.collection('users').doc(id).set({
        name: name, 
        type: role, 
        created: firebase.firestore.FieldValue.serverTimestamp(), 
        lastUpdate: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true }).then(() => {
        alert('נוצר בהצלחה!');
        window.closeModal('user-modal');
    });
});

safeOnClick('submit-order-btn', () => {
    const contact = document.getElementById('order-contact').value;
    const address = document.getElementById('order-address').value;
    const item = document.getElementById('order-item').value;
    const time = document.getElementById('order-time').value;
    
    if(!item) { alert('חסר פירוט'); return; }
    const txt = `👤 ${contact}\n📍 ${address}\n📦 ${item}\n⏰ ${time}`;
    
    db.collection('orders').doc(customerId).collection('messages').add({
        text: txt, title: "הזמנה חדשה", sender: 'customer', timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    db.collection('users').doc(customerId).set({
        name: contact||"לקוח", address: address, status: 1, type: 'client', lastUpdate: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    window.closeModal('order-modal');
});

// --- 7. עזרים ---
function isMe(role) { return (staffId && role === 'staff') || (!staffId && role === 'customer'); }
window.closeModal = (id) => document.getElementById(id).style.display = 'none';
function safeOnClick(id, fn) { const el = document.getElementById(id); if(el) el.onclick = fn; }
function safeSetText(id, txt) { const el = document.getElementById(id); if(el) el.innerText = txt; }
function safeSetSrc(id, src) { const el = document.getElementById(id); if(el) el.src = src; }
function safeDisplay(id, val) { const el = document.getElementById(id); if(el) el.style.display = val; }
function renderProgress(s, els) {
    const bar = document.getElementById('stories-container');
    if(!bar) return;
    const fill = document.getElementById('progress-fill');
    if(fill) fill.style.width = ((s-1)*33)+'%';
}
