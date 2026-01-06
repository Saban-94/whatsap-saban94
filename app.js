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
let allUsersData = [];
let currentChatId = null;
let messageToForward = null;
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

// --- 3. אתחול (DOMContentLoaded) ---
document.addEventListener("DOMContentLoaded", function() {
    initViews();
});

function initViews() {
    // כפתורים גלובליים
    safeOnClick('mute-btn', () => { 
        isMuted = !isMuted; 
        document.getElementById('mute-btn').innerText = isMuted ? 'volume_off' : 'volume_up'; 
    });
    safeOnClick('refresh-btn', () => window.location.reload());
    safeOnClick('back-btn', goBack);
    
    // כפתור הפלוס הראשי - כאן הייתה השגיאה, עכשיו הפונקציה מוגדרת למטה
    safeOnClick('main-fab', handleFabClick);
    
    // שליחה
    safeOnClick('send-btn', sendMessage);
    const inp = document.getElementById('msg-input');
    if(inp) inp.onkeypress = (e) => { if(e.key==='Enter') sendMessage(); };
    
    // כפתור מנעול (הודעה חסויה)
    safeOnClick('internal-msg-btn', () => {
        isInternalMode = !isInternalMode;
        const btn = document.getElementById('internal-msg-btn');
        btn.style.color = isInternalMode ? 'red' : '#fbc02d';
        document.getElementById('msg-input').placeholder = isInternalMode ? "הערה חסויה..." : "הקלד הודעה...";
    });

    // כותרת לחיצה (פרופיל)
    const header = document.getElementById('header-clickable'); // שים לב שזה ה-ID בקובץ HTML ששלחתי קודם
    if(header) {
        header.onclick = () => {
            if(staffId && currentChatId) openProfileModal(currentChatId);
        };
    } else {
        // גיבוי למקרה שה-HTML לא מעודכן
        safeOnClick('header-user-info', () => {
            if(staffId && currentChatId) openProfileModal(currentChatId);
        });
    }

    // ניתוב משתמשים
    if (staffId) {
        setupManager();
    } else if (customerId) {
        setupClient();
    } else {
        const saved = localStorage.getItem('saban_cid');
        if (saved && !window.location.search.includes('cid')) window.location.href=`?cid=${saved}`;
        else document.body.innerHTML = '<h3 style="text-align:center; margin-top:50px;">נא להיכנס דרך קישור תקין</h3>';
    }
}

// --- 4. הגדרות תצוגה ---
function setupManager() {
    safeSetText('app-title', "ניהול ח.סבן");
    safeSetText('header-subtitle', staffId);
    safeDisplay('staff-dashboard', 'flex');
    safeDisplay('client-view', 'none');
    safeDisplay('main-chat-feed', 'none');
    loadAllUsers();
}

function setupClient() {
    localStorage.setItem('saban_cid', customerId);
    safeSetText('app-title', "ח.סבן חומרי בנין");
    safeSetText('header-subtitle', "הזמנה פעילה");
    safeDisplay('staff-dashboard', 'none');
    safeDisplay('client-view', 'block');
    safeDisplay('input-area', 'flex');
    
    // האזנה לנתוני הלקוח
    db.collection('users').doc(customerId).onSnapshot(doc => {
        if(doc.exists) {
            const d = doc.data();
            safeSetText('header-subtitle', d.name || "הזמנה פעילה");
            renderProgress(d.status || 1);
        }
    });
    
    loadChat(customerId, 'client-chat-container');
    loadDepartments();
}

// --- 5. לוגיקה למנהל ---
function loadAllUsers() {
    db.collection('users').orderBy('lastUpdate', 'desc').onSnapshot(snapshot => {
        allUsersData = [];
        let active = 0, history = 0;
        
        snapshot.forEach(doc => {
            const d = doc.data(); d.id = doc.id;
            allUsersData.push(d);
            if(d.type === 'client' || !d.type) {
                if (d.status === 4) history++; else active++;
            }
        });
        
        safeSetText('stat-active', active);
        safeSetText('stat-history', history);
        
        // טעינה ראשונית (צ'אטים פעילים)
        switchManagerTab('chats');
    });
}

window.switchManagerTab = function(tab) {
    document.querySelectorAll('.tab-item').forEach(e => e.classList.remove('active'));
    const activeTab = document.getElementById('tab-'+tab);
    if(activeTab) activeTab.classList.add('active');
    
    const gates = document.getElementById('dashboard-gates');
    if(gates) gates.style.display = (tab === 'chats') ? 'grid' : 'none';
    
    // סינון הרשימה
    const list = document.getElementById('clients-list');
    list.innerHTML = '';
    
    let filtered = [];
    if(tab === 'chats') filtered = allUsersData.filter(u => u.type === 'client' || !u.type);
    if(tab === 'groups') filtered = allUsersData.filter(u => u.type === 'group');
    if(tab === 'staff') filtered = allUsersData.filter(u => u.type === 'staff');
    
    // אם אנחנו בצ'אטים, נפעיל גם את פילטר הסטטוס (פעיל כברירת מחדל)
    if(tab === 'chats') {
        filterList('active'); 
    } else {
        renderListItems(filtered, list);
    }
};

window.filterList = function(statusType) {
    const list = document.getElementById('clients-list');
    list.innerHTML = '';
    
    // ויזואליזציה לכרטיסים
    const cards = document.querySelectorAll('.gate-card');
    cards.forEach(c => c.classList.remove('active-filter'));
    if(statusType === 'active' && cards[0]) cards[0].classList.add('active-filter');
    if(statusType === 'history' && cards[1]) cards[1].classList.add('active-filter');

    let filtered = allUsersData.filter(u => u.type === 'client' || !u.type);
    if(statusType === 'active') filtered = filtered.filter(u => !u.status || u.status < 4);
    if(statusType === 'history') filtered = filtered.filter(u => u.status === 4);
    
    renderListItems(filtered, list);
};

function renderListItems(data, container) {
    if(data.length === 0) { 
        container.innerHTML = '<div style="text-align:center; padding:20px; color:#999;">אין נתונים</div>'; 
        return; 
    }
    
    data.forEach(u => {
        const div = document.createElement('div');
        div.className = 'chat-list-item';
        // קביעת תיאור משני (כתובת או סוג)
        let sub = u.address || (u.type === 'staff' ? 'איש צוות' : 'קבוצה');
        
        div.innerHTML = `
            <img src="${u.imgUrl || 'https://ui-avatars.com/api/?name='+u.name+'&background=random'}" class="chat-avatar">
            <div class="chat-info">
                <div class="chat-name">${u.name || u.id}</div>
                <div class="chat-preview">${sub}</div>
            </div>
        `;
        div.onclick = () => openChat(u);
        container.appendChild(div);
    });
}

function openChat(user) {
    currentChatId = user.id;
    safeDisplay('staff-dashboard', 'none');
    safeDisplay('main-chat-feed', 'flex');
    safeDisplay('input-area', 'flex');
    safeDisplay('back-btn', 'block');
    safeDisplay('admin-controls', 'flex');
    
    safeSetText('app-title', user.name || user.id);
    safeSetText('header-subtitle', user.type === 'group' ? 'קבוצה' : 'בשיחה');
    
    // מציג את כפתור ההודעה החסויה למנהל
    if(staffId) safeDisplay('internal-msg-btn', 'block');
    
    loadChat(user.id, 'main-chat-feed');
}

// --- 6. כפתור פלוס ותפריטים (FAB) ---
// הפונקציה שחסרה לך קודם!
function handleFabClick() {
    // אם מנהל נמצא בדשבורד (לא בשיחה) -> פתח תפריט
    if (staffId && !currentChatId) {
        toggleFabMenu();
    } else {
        // לקוח או מנהל בתוך שיחה -> פתח הזמנה
        safeDisplay('order-modal', 'flex');
    }
}

function toggleFabMenu() {
    isMenuOpen = !isMenuOpen;
    const main = document.getElementById('main-fab');
    if(main) main.classList.toggle('rotate');
    
    const items = document.querySelectorAll('.mini-fab');
    items.forEach((item, i) => {
        if(isMenuOpen) setTimeout(() => item.classList.add('show'), i * 50);
        else item.classList.remove('show');
    });
}

// ניהול משתמשים (מהתפריט)
window.openUserModal = function(role) {
    if(isMenuOpen) toggleFabMenu();
    safeDisplay('user-modal', 'flex');
    document.getElementById('new-user-role').value = role;
    const titles = { 'client': 'לקוח חדש', 'staff': 'איש צוות חדש', 'group': 'קבוצה חדשה' };
    safeSetText('user-modal-title', titles[role] || 'חדש');
};

safeOnClick('save-user-btn', () => {
    const id = document.getElementById('new-user-id').value;
    const name = document.getElementById('new-user-name').value;
    const role = document.getElementById('new-user-role').value;
    
    if(!id || !name) { alert('חסר מידע'); return; }
    
    db.collection('users').doc(id).set({
        name: name, type: role, lastUpdate: firebase.firestore.FieldValue.serverTimestamp()
    }, {merge: true}).then(() => {
        closeModal('user-modal');
        alert('נוצר בהצלחה');
    });
});

// --- 7. לקוח (טאבים) ---
window.switchClientTab = function(tab) {
    document.querySelectorAll('.c-tab').forEach(e => e.classList.remove('active'));
    event.currentTarget.classList.add('active');
    
    safeDisplay('tab-my-order', tab==='my-order'?'block':'none');
    safeDisplay('tab-departments', tab==='departments'?'block':'none');
    safeDisplay('input-area', tab==='my-order'?'flex':'none');
};

function loadDepartments() {
    db.collection('users').where('type', '==', 'group').get().then(snap => {
        const container = document.getElementById('dept-list');
        if(!container) return;
        container.innerHTML = '';
        
        snap.forEach(doc => {
            const d = doc.data();
            const div = document.createElement('div');
            div.className = 'chat-list-item';
            div.innerHTML = `
                <div class="chat-avatar" style="background:#e0f2f1; display:flex; justify-content:center; align-items:center;"><i class="material-icons" style="color:var(--primary-color)">groups</i></div>
                <div class="chat-info"><div class="chat-name">${d.name}</div><div class="chat-preview">לחץ לשליחת הודעה</div></div>
            `;
            div.onclick = () => {
                // הלקוח עובר לצ'אט קבוצתי
                openChat({id: doc.id, name: d.name, type: 'group'});
                safeDisplay('client-view', 'none'); 
            };
            container.appendChild(div);
        });
    });
}

// --- 8. צ'אט והודעות ---
function loadChat(cid, containerId) {
    const container = document.getElementById(containerId);
    if(!container) return;
    container.innerHTML = '<div class="date-divider">טוען...</div>';
    
    if (window.unsubChat) window.unsubChat();
    
    window.unsubChat = db.collection('orders').doc(cid).collection('messages')
    .orderBy('timestamp', 'asc').onSnapshot(snap => {
        container.innerHTML = '<div class="date-divider">היום</div>';
        snap.forEach(doc => {
            renderMessage(doc.data(), container, doc.id);
        });
        container.scrollTop = container.scrollHeight;
    });
}

function renderMessage(msg, container, msgId) {
    const div = document.createElement('div');
    const isMe = (staffId && msg.sender==='staff') || (!staffId && msg.sender==='customer');
    
    if (!staffId && msg.type === 'internal') return; // הסתרת פנימי מלקוח

    let cls = 'message';
    if(msg.type==='internal') cls += ' internal';
    else cls += isMe ? ' sent' : ' received';
    
    div.className = cls;
    
    // לחיצה ארוכה להעברה (רק מנהל)
    if(staffId) {
        div.oncontextmenu = (e) => {
            e.preventDefault();
            messageToForward = msg.text;
            safeDisplay('msg-action-modal', 'flex');
        };
    }

    let content = msg.text;
    if(msg.type==='internal') content = `🔒 <b>פנימי:</b> ${content}`;
    
    div.innerHTML = `${content}<div class="msg-meta">${msg.timestamp ? new Date(msg.timestamp.toDate()).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) : ''}</div>`;
    container.appendChild(div);
}

function sendMessage() {
    const input = document.getElementById('msg-input');
    const text = input.value.trim();
    const target = currentChatId || customerId;
    if (!text || !target) return;
    
    const type = (staffId && isInternalMode) ? 'internal' : 'regular';
    db.collection('orders').doc(target).collection('messages').add({
        text, sender: staffId?'staff':'customer', type: type, timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    input.value = '';
    
    if(isInternalMode) {
        isInternalMode = false;
        document.getElementById('internal-msg-btn').style.color = '#fbc02d';
        input.placeholder = "הקלד הודעה...";
    }
}

// לוגיקת העברה (Forward)
window.forwardMessageToGroup = function() {
    closeModal('msg-action-modal');
    safeDisplay('forward-target-modal', 'flex');
    const list = document.getElementById('groups-list-for-forward');
    list.innerHTML = 'טוען...';
    
    db.collection('users').where('type', 'in', ['group', 'staff']).get().then(snap => {
        list.innerHTML = '';
        snap.forEach(doc => {
            const d = doc.data();
            const div = document.createElement('div');
            div.className = 'chat-list-item';
            div.innerHTML = `<div class="chat-name">${d.name}</div>`;
            div.onclick = () => doForward(doc.id, d.name);
            list.appendChild(div);
        });
    });
};

function doForward(targetId, targetName) {
    const refText = `🚩 **העברה מ${document.getElementById('app-title').innerText}:**\n"${messageToForward}"`;
    db.collection('orders').doc(targetId).collection('messages').add({
        text: refText, sender: 'staff', type: 'regular', timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    alert('הועבר ל' + targetName);
    closeModal('forward-target-modal');
}

// עריכת פרופיל
window.openProfileModal = function(uid) {
    safeDisplay('profile-modal', 'flex');
    db.collection('users').doc(uid).get().then(doc => {
        if(doc.exists) {
            const d = doc.data();
            document.getElementById('edit-name').value = d.name || '';
            document.getElementById('edit-phone').value = d.phone || '';
            document.getElementById('edit-email').value = d.email || '';
            document.getElementById('edit-img').value = d.imgUrl || '';
            document.getElementById('edit-img-preview').src = d.imgUrl || `https://ui-avatars.com/api/?name=${d.name}&background=random`;
            
            document.getElementById('save-profile-btn').onclick = () => {
                db.collection('users').doc(uid).update({
                    name: document.getElementById('edit-name').value,
                    phone: document.getElementById('edit-phone').value,
                    email: document.getElementById('edit-email').value,
                    imgUrl: document.getElementById('edit-img').value
                }).then(() => {
                    closeModal('profile-modal');
                    // עדכון מקומי מהיר
                    document.getElementById('app-title').innerText = document.getElementById('edit-name').value;
                });
            };
        }
    });
};

window.performAction = function(action) {
    const phone = document.getElementById('edit-phone').value;
    const email = document.getElementById('edit-email').value;
    if(action === 'call' && phone) window.open(`tel:${phone}`);
    if(action === 'sms' && phone) window.open(`sms:${phone}`);
    if(action === 'email' && email) window.open(`mailto:${email}`);
};

// סטטוס
window.updateStatus = function(val) {
    if(!currentChatId) return;
    db.collection('users').doc(currentChatId).update({ status: val, lastUpdate: firebase.firestore.FieldValue.serverTimestamp() });
    const msgs = {1:'התקבל', 2:'בטיפול', 3:'בדרך', 4:'סופקה'};
    db.collection('orders').doc(currentChatId).collection('messages').add({
        text: 'סטטוס: ' + msgs[val], sender: 'system', timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
};

// שליחת הזמנה (לקוח)
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
    }, {merge: true});
    closeModal('order-modal');
});

// --- Utilities (Safe functions) ---
function safeOnClick(id, fn) { const el=document.getElementById(id); if(el) el.onclick=fn; }
function safeSetText(id, txt) { const el=document.getElementById(id); if(el) el.innerText=txt; }
function safeSetSrc(id, src) { const el=document.getElementById(id); if(el) el.src=src; }
function safeDisplay(id, val) { const el=document.getElementById(id); if(el) el.style.display=val; }
window.closeModal = (id) => safeDisplay(id, 'none');
function goBack() {
    if(staffId) {
        safeDisplay('main-chat-feed', 'none');
        safeDisplay('input-area', 'none');
        safeDisplay('back-btn', 'none');
        safeDisplay('staff-dashboard', 'block');
        safeSetText('app-title', "ניהול ח.סבן");
        currentChatId = null;
    } else {
        safeDisplay('client-view', 'block');
        safeDisplay('main-chat-feed', 'none');
        safeDisplay('back-btn', 'none');
    }
}
function renderProgress(s) { 
    const fill = document.getElementById('progress-fill');
    if(fill) fill.style.width = ((s-1)*33)+'%';
}
