// --- 1. אתחול והגדרות ---
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
const notificationSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3');

let isInitialLoad = true;
let isMuted = false;
document.addEventListener('click', () => { if(isInitialLoad) isInitialLoad = false; }, { once: true });

// משתנים גלובליים
const urlParams = new URLSearchParams(window.location.search);
let customerId = urlParams.get('cid'); 
let staffId = urlParams.get('sid');
let currentChatId = null;
let allUsersData = [];
let currentTab = 'chats'; // chats, groups, staff
let isFabMenuOpen = false;
let isInternalMode = false;

// --- 2. אתחול ממשק ---
document.addEventListener("DOMContentLoaded", function() {
    initViews();
});

function initViews() {
    if (staffId) {
        // === מנהל ===
        setupManagerView();
    } else if (customerId) {
        // === לקוח ===
        setupClientView();
    } else {
        // === אורח ===
        checkSavedLogin();
    }
    
    // אירועים גלובליים
    document.getElementById('mute-btn').onclick = toggleMute;
    document.getElementById('refresh-btn').onclick = () => window.location.reload();
    document.getElementById('back-btn').onclick = goBackToDashboard;
    document.getElementById('main-fab').onclick = handleFabClick;
    document.getElementById('send-btn').onclick = sendMessage;
    document.getElementById('msg-input').onkeypress = (e) => { if(e.key==='Enter') sendMessage(); };
    
    // לחיצה על תמונת פרופיל בכותרת -> עריכה (רק למנהל בתוך צ'אט)
    document.getElementById('header-user-info').onclick = () => {
        if(staffId && currentChatId) openProfileModal(currentChatId);
    };
}

function setupManagerView() {
    document.getElementById('app-title').innerText = "ח.סבן ניהול";
    document.getElementById('status-text').innerText = staffId;
    document.getElementById('header-avatar').src = `https://ui-avatars.com/api/?name=${staffId}&background=random`;
    
    showSection('dashboard');
    document.getElementById('internal-msg-btn').style.display = 'block';
    
    loadAllUsers();
}

function setupClientView() {
    localStorage.setItem('saban_cid', customerId);
    document.getElementById('app-title').innerText = "ח.סבן חומרי בנין";
    document.getElementById('header-avatar').src = `https://ui-avatars.com/api/?name=${customerId}&background=random`;
    
    showSection('chat');
    document.getElementById('stories-container').style.display = 'flex';
    document.getElementById('input-area').style.display = 'flex';
    
    // טעינת מידע
    db.collection('users').doc(customerId).onSnapshot(doc => {
        if(doc.exists) {
            const data = doc.data();
            document.getElementById('status-text').innerText = data.name || "הזמנה פעילה";
            renderStories(data.status || 1);
        } else {
            renderStories(1);
        }
    });
    
    loadChat(customerId);
}

function checkSavedLogin() {
    const saved = localStorage.getItem('saban_cid');
    if (saved && !window.location.search.includes('cid')) window.location.href = `?cid=${saved}`;
    else document.body.innerHTML = '<h3 style="text-align:center; margin-top:50px;">נא להיכנס דרך קישור תקין</h3>';
}

// --- 3. דשבורד וטאבים ---
function loadAllUsers() {
    db.collection('users').orderBy('lastUpdate', 'desc').onSnapshot(snapshot => {
        allUsersData = [];
        let active = 0, history = 0;
        
        snapshot.forEach(doc => {
            const d = doc.data(); d.id = doc.id;
            allUsersData.push(d);
            if(d.type === 'client') {
                if(d.status === 4) history++; else active++;
            }
        });
        
        document.getElementById('count-active').innerText = active;
        document.getElementById('count-history').innerText = history;
        renderList();
    });
}

window.switchTab = function(tabName) {
    currentTab = tabName;
    // עדכון UI של הטאבים
    document.querySelectorAll('.tab-item').forEach(el => el.classList.remove('active'));
    event.target.classList.add('active'); // מניח שהלחיצה היא על האלמנט
    renderList();
};

window.filterList = function(filter) {
    // סינון לפי סטטוס בתוך הטאב של הצ'אטים
    if(currentTab !== 'chats') switchTab('chats');
    renderList(filter);
};

function renderList(statusFilter = null) {
    const listDiv = document.getElementById('clients-list');
    listDiv.innerHTML = '';
    
    let filtered = allUsersData;
    
    if (currentTab === 'chats') {
        filtered = allUsersData.filter(u => u.type === 'client' || !u.type);
        if (statusFilter === 'active') filtered = filtered.filter(u => !u.status || u.status < 4);
        if (statusFilter === 'history') filtered = filtered.filter(u => u.status === 4);
    } else if (currentTab === 'groups') {
        filtered = allUsersData.filter(u => u.type === 'group');
    } else if (currentTab === 'staff') {
        filtered = allUsersData.filter(u => u.type === 'staff');
    }
    
    if(filtered.length === 0) {
        listDiv.innerHTML = '<div style="text-align:center; padding:20px; color:#999;">אין נתונים להצגה</div>';
        return;
    }

    filtered.forEach(user => {
        const div = document.createElement('div');
        div.className = 'chat-item';
        div.innerHTML = `
            <img src="${user.imgUrl || 'https://ui-avatars.com/api/?name='+(user.name||user.id)+'&background=random'}" class="chat-avatar">
            <div class="chat-body">
                <div class="chat-row">
                    <span class="chat-name">${user.name || user.id}</span>
                    <span class="chat-time">${formatTime(user.lastUpdate)}</span>
                </div>
                <div class="chat-preview">${user.address || 'לחץ לפתיחה'}</div>
            </div>
        `;
        div.onclick = () => openStaffChat(user);
        listDiv.appendChild(div);
    });
}

function openStaffChat(user) {
    currentChatId = user.id;
    
    document.getElementById('app-title').innerText = user.name || user.id;
    document.getElementById('status-text').innerText = user.address || "בשיחה";
    document.getElementById('header-avatar').src = user.imgUrl || `https://ui-avatars.com/api/?name=${user.name||user.id}&background=random`;
    
    showSection('chat');
    document.getElementById('input-area').style.display = 'flex';
    document.getElementById('admin-controls').style.display = 'flex';
    document.getElementById('back-btn').style.display = 'block';
    
    loadChat(user.id);
}

function goBackToDashboard() {
    currentChatId = null;
    showSection('dashboard');
    document.getElementById('app-title').innerText = "ח.סבן ניהול";
    document.getElementById('status-text').innerText = staffId;
    document.getElementById('back-btn').style.display = 'none';
    if(window.unsubscribeChat) window.unsubscribeChat();
}

// --- 4. כפתור פלוס ותפריטים ---
function handleFabClick() {
    if (staffId && !currentChatId) {
        // בדשבורד מנהל -> תפריט
        toggleFabMenu();
    } else {
        // בצ'אט (לקוח או מנהל) -> הזמנה
        document.getElementById('order-modal').style.display = 'flex';
    }
}

function toggleFabMenu() {
    isFabMenuOpen = !isFabMenuOpen;
    const fab = document.getElementById('main-fab');
    const menu = document.getElementById('fab-menu');
    const minis = document.querySelectorAll('.mini-fab');
    
    if(isFabMenuOpen) {
        fab.classList.add('rotate');
        minis.forEach((m, i) => setTimeout(() => m.classList.add('show'), i*50));
    } else {
        fab.classList.remove('rotate');
        minis.forEach(m => m.classList.remove('show'));
    }
}

// ניהול משתמשים/קבוצות
window.openUserModal = function(type) {
    toggleFabMenu(); // סגור תפריט
    const modal = document.getElementById('user-modal');
    modal.style.display = 'flex';
    document.getElementById('new-user-role').value = type;
    
    const titleMap = { 'client': 'לקוח חדש', 'staff': 'איש צוות חדש', 'group': 'קבוצה חדשה' };
    document.getElementById('user-modal-title').innerText = titleMap[type];
};

document.getElementById('save-user-btn').onclick = () => {
    const id = document.getElementById('new-user-id').value;
    const name = document.getElementById('new-user-name').value;
    const phone = document.getElementById('new-user-phone').value;
    const type = document.getElementById('new-user-role').value;
    
    if(!id || !name) { alert('חסרים פרטים'); return; }
    
    db.collection('users').doc(id).set({
        name: name,
        type: type, // client, staff, group
        phone: phone,
        created: firebase.firestore.FieldValue.serverTimestamp(),
        lastUpdate: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true }).then(() => {
        closeModal('user-modal');
    });
};

// עריכת פרופיל (מנהל לוחץ על כותרת)
window.openProfileModal = function(uid) {
    const modal = document.getElementById('profile-modal');
    modal.style.display = 'flex';
    
    // טעינת נתונים קיימים
    db.collection('users').doc(uid).get().then(doc => {
        if(doc.exists) {
            const d = doc.data();
            document.getElementById('edit-profile-name').value = d.name || '';
            document.getElementById('edit-profile-address').value = d.address || '';
            document.getElementById('edit-profile-phone').value = d.phone || '';
            document.getElementById('edit-profile-img-url').value = d.imgUrl || '';
            document.getElementById('edit-profile-img').src = d.imgUrl || `https://ui-avatars.com/api/?name=${d.name}&background=random`;
        }
    });
    
    // שמירה
    document.getElementById('save-profile-btn').onclick = () => {
        const name = document.getElementById('edit-profile-name').value;
        const address = document.getElementById('edit-profile-address').value;
        const phone = document.getElementById('edit-profile-phone').value;
        const imgUrl = document.getElementById('edit-profile-img-url').value;
        
        db.collection('users').doc(uid).update({
            name: name, address: address, phone: phone, imgUrl: imgUrl
        }).then(() => {
            alert('עודכן בהצלחה');
            closeModal('profile-modal');
            // עדכון הכותרת מיד
            document.getElementById('app-title').innerText = name;
            if(imgUrl) document.getElementById('header-avatar').src = imgUrl;
        });
    };
};

// --- 5. צ'אט ופונקציונליות ---
function loadChat(cid) {
    const container = document.getElementById('chat-container');
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
    else if(msg.sender==='system') cls += ' received system-msg';
    else cls += me ? ' sent' : ' received';
    
    div.className = cls;
    let content = msg.text;
    
    // עיצוב הודעות מיוחדות
    if(msg.type==='internal') content = `🔒 <b>הערה:</b> ${content}`;
    else if(msg.title) content = `<b>${msg.title}</b><br>${content.replace(/\n/g, '<br>')}`;
    else if(msg.sender==='system') { 
        div.style.textAlign='center'; div.style.width='100%'; div.style.background='none'; div.style.boxShadow='none';
        content = `<div class="date-divider">${content}</div>`; 
    }

    div.innerHTML = `${content}<div class="msg-meta">${formatTime(msg.timestamp)}</div>`;
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
    if(isInternalMode) { // כיבוי מצב חסוי
        isInternalMode = false;
        document.getElementById('internal-msg-btn').style.color = '#fbc02d';
        input.placeholder = "הקלד הודעה...";
    }
}

// כפתור מנעול (הודעה חסויה)
document.getElementById('internal-msg-btn').onclick = function() {
    isInternalMode = !isInternalMode;
    this.style.color = isInternalMode ? 'red' : '#fbc02d';
    document.getElementById('msg-input').placeholder = isInternalMode ? "הערה חסויה..." : "הקלד הודעה...";
};

// עדכון סטטוס (מנהל)
window.updateStatus = function(s) {
    if(!currentChatId) return;
    db.collection('users').doc(currentChatId).update({ status: s, lastUpdate: firebase.firestore.FieldValue.serverTimestamp() });
    
    const statusMap = {1:'הזמנה התקבלה', 2:'הזמנה בטיפול', 3:'הזמנה בדרך', 4:'הזמנה נמסרה'};
    db.collection('orders').doc(currentChatId).collection('messages').add({
        text: statusMap[s], sender: 'system', timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
};

// שליחת הזמנה (לקוח)
document.getElementById('submit-order-btn').onclick = () => {
    const contact = document.getElementById('order-contact').value;
    const address = document.getElementById('order-address').value;
    const item = document.getElementById('order-item').value;
    const time = document.getElementById('order-time').value;
    
    if(!item) { alert('חסר פירוט'); return; }
    
    const txt = `👤 ${contact}\n📍 ${address}\n📦 ${item}\n⏰ ${time}`;
    db.collection('orders').doc(customerId).collection('messages').add({
        text: txt, title: "הזמנה חדשה", sender: 'customer', timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    // עדכון פרטי משתמש
    db.collection('users').doc(customerId).set({
        name: contact || "לקוח", address: address, status: 1, type: 'client', lastUpdate: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    
    closeModal('order-modal');
};

// --- עזרים ---
function showSection(name) {
    document.getElementById('staff-dashboard').style.display = name==='dashboard'?'block':'none';
    document.getElementById('chat-container').style.display = name==='chat'?'block':'none';
    document.getElementById('stories-container').style.display = 'none';
    document.getElementById('input-area').style.display = 'none';
    document.getElementById('admin-controls').style.display = 'none';
    document.getElementById('back-btn').style.display = 'none';
}
window.closeModal = (id) => document.getElementById(id).style.display = 'none';
function toggleMute() { isMuted = !isMuted; document.getElementById('mute-btn').innerText = isMuted ? 'volume_off' : 'volume_up'; }
function formatTime(ts) { return ts ? new Date(ts.toDate()).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) : ''; }
function isMe(sender) { return (staffId && sender === 'staff') || (!staffId && sender === 'customer'); }
function renderStories(s) {
    const bar = document.getElementById('stories-container');
    bar.innerHTML = '<div class="progress-track"></div><div class="progress-fill" style="width:'+((s-1)*33)+'%"></div>';
    ['התקבלה','בטיפול','בדרך','סופקה'].forEach((t,i) => {
        bar.innerHTML += `<div class="status-step ${i+1<=s?'active':''}"><div class="status-circle">${i+1}</div><span class="status-label">${t}</span></div>`;
    });
}
