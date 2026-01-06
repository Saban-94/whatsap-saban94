// --- 1. Init ---
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

const urlParams = new URLSearchParams(window.location.search);
let customerId = urlParams.get('cid'); 
let staffId = urlParams.get('sid');
let allUsersData = [];
let currentChatId = null;
let messageToForward = null;
let isMenuOpen = false;
let isInternalMode = false;
let isInitialLoad = true;
let isMuted = false;
const notificationSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3');

document.addEventListener('click', () => { if(isInitialLoad) isInitialLoad = false; }, { once: true });

// --- 2. Start ---
document.addEventListener("DOMContentLoaded", function() {
    initViews();
});

function initViews() {
    safeOnClick('refresh-btn', () => window.location.reload());
    safeOnClick('back-btn', goBack);
    safeOnClick('main-fab', handleFabClick);
    safeOnClick('send-btn', sendMessage);
    const inp = document.getElementById('msg-input');
    if(inp) inp.onkeypress = (e) => { if(e.key==='Enter') sendMessage(); };
    
    document.getElementById('header-clickable').onclick = () => {
        if(staffId && currentChatId) openProfileModal(currentChatId);
    };

    if (staffId) setupManager();
    else if (customerId) setupClient();
    else {
        const s = localStorage.getItem('saban_cid');
        if(s && !window.location.search.includes('cid')) window.location.href=`?cid=${s}`;
    }
}

function setupManager() {
    safeSetText('app-title', "ניהול ח.סבן");
    safeSetText('header-subtitle', staffId);
    safeDisplay('staff-dashboard', 'flex');
    loadAllUsers();
}

function setupClient() {
    localStorage.setItem('saban_cid', customerId);
    safeSetText('app-title', "ח.סבן חומרי בנין");
    safeSetText('header-subtitle', "הזמנה פעילה");
    safeDisplay('client-view', 'block');
    safeDisplay('input-area', 'flex');
    
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

// --- 3. Dashboard ---
function loadAllUsers() {
    db.collection('users').orderBy('lastUpdate', 'desc').onSnapshot(snapshot => {
        allUsersData = [];
        let active=0, history=0;
        snapshot.forEach(doc => {
            const d = doc.data(); d.id = doc.id;
            allUsersData.push(d);
            if(d.type==='client' || !d.type) { if(d.status===4) history++; else active++; }
        });
        safeSetText('stat-active', active);
        safeSetText('stat-history', history);
        
        // טעינה ראשונית - צ'אטים
        switchManagerTab('chats');
    });
}

window.switchManagerTab = function(tab) {
    document.querySelectorAll('.tab-item').forEach(e => e.classList.remove('active'));
    document.getElementById('tab-'+tab).classList.add('active');
    
    const list = document.getElementById('clients-list');
    list.innerHTML = '';
    
    let filtered = [];
    if(tab === 'chats') filtered = allUsersData.filter(u => u.type === 'client' || !u.type);
    if(tab === 'groups') filtered = allUsersData.filter(u => u.type === 'group');
    if(tab === 'staff') filtered = allUsersData.filter(u => u.type === 'staff');
    
    document.getElementById('dashboard-gates').style.display = tab==='chats'?'grid':'none';
    
    if(tab === 'chats') filterList('active'); 
    else renderListItems(filtered, list);
};

window.filterList = function(statusType) {
    const list = document.getElementById('clients-list');
    list.innerHTML = '';
    
    const cards = document.querySelectorAll('.gate-card');
    cards.forEach(c => c.classList.remove('active-filter'));
    if(statusType === 'active' && cards[0]) cards[0].classList.add('active-filter');
    if(statusType === 'history' && cards[1]) cards[1].classList.add('active-filter');

    let filtered = allUsersData.filter(u => u.type === 'client' || !u.type);
    if(statusType==='active') filtered = filtered.filter(u => !u.status || u.status < 4);
    if(statusType==='history') filtered = filtered.filter(u => u.status === 4);
    
    renderListItems(filtered, list);
};

function renderListItems(data, container) {
    if(data.length === 0) { container.innerHTML = '<div style="text-align:center; padding:20px; color:#999;">אין נתונים</div>'; return; }
    
    data.forEach(u => {
        const div = document.createElement('div');
        div.className = 'chat-list-item';
        let sub = u.address || (u.type==='staff'?'איש צוות':'קבוצה');
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
    safeSetText('app-title', user.name || user.id);
    safeSetText('header-subtitle', user.type==='group'?'קבוצה':'בשיחה');
    
    if(staffId) document.getElementById('internal-msg-btn').style.display = 'block';
    
    loadChat(user.id, 'main-chat-feed');
}

// --- 4. Client Logic ---
window.switchClientTab = function(tab) {
    document.querySelectorAll('.c-tab').forEach(e => e.classList.remove('active'));
    event.currentTarget.classList.add('active');
    
    safeDisplay('tab-my-order', tab==='my-order'?'block':'none');
    safeDisplay('tab-departments', tab==='departments'?'block':'none');
};

function loadDepartments() {
    db.collection('users').where('type', '==', 'group').get().then(snap => {
        const container = document.getElementById('dept-list');
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
                openChat({id: doc.id, name: d.name, type: 'group'});
                safeDisplay('client-view', 'none'); 
            };
            container.appendChild(div);
        });
    });
}

// --- 5. Chat ---
function loadChat(cid, containerId) {
    const container = document.getElementById(containerId);
    if(!container) return;
    container.innerHTML = '<div class="date-divider">טוען...</div>';
    
    if (window.unsubChat) window.unsubChat();
    window.unsubChat = db.collection('orders').doc(cid).collection('messages')
    .orderBy('timestamp', 'asc').onSnapshot(snap => {
        container.innerHTML = '<div class="date-divider">היום</div>';
        snap.forEach(doc => {
            renderMessage(doc.data(), container);
        });
        container.scrollTop = container.scrollHeight;
    });
}

function renderMessage(msg, container) {
    if (!staffId && msg.type === 'internal') return;
    const div = document.createElement('div');
    const me = (staffId && msg.sender==='staff') || (!staffId && msg.sender==='customer');
    let cls = 'message';
    if(msg.type==='internal') cls += ' internal';
    else cls += me ? ' sent' : ' received';
    
    div.className = cls;
    
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
    if(!isInitialLoad && !me && !isMuted) notificationSound.play().catch(()=>{});
}

function sendMessage() {
    const inp = document.getElementById('msg-input');
    const text = inp.value.trim();
    const target = currentChatId || customerId;
    if (!text || !target) return;
    
    const type = (staffId && isInternalMode) ? 'internal' : 'regular';
    db.collection('orders').doc(target).collection('messages').add({
        text, sender: staffId?'staff':'customer', type: type, timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    inp.value = '';
    if(isInternalMode) document.getElementById('internal-msg-btn').click();
}

// --- 6. Forwarding ---
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

// --- 7. FAB & User Management ---
function handleFabClick() {
    if(staffId && !currentChatId) toggleFabMenu();
    else safeDisplay('order-modal', 'flex');
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

window.openUserModal = function(role) {
    if(isMenuOpen) toggleFabMenu();
    safeDisplay('user-modal', 'flex');
    document.getElementById('new-user-role').value = role;
    document.getElementById('user-modal-title').innerText = role==='group'?'קבוצה חדשה':'משתמש חדש';
};

safeOnClick('save-user-btn', () => {
    const id = document.getElementById('new-user-id').value;
    const name = document.getElementById('new-user-name').value;
    const role = document.getElementById('new-user-role').value;
    if(id && name) {
        db.collection('users').doc(id).set({
            name: name, type: role, lastUpdate: firebase.firestore.FieldValue.serverTimestamp()
        }, {merge: true});
        closeModal('user-modal');
    }
});

// Profile Editing
window.openProfileModal = function(uid) {
    safeDisplay('profile-modal', 'flex');
    db.collection('users').doc(uid).get().then(doc => {
        if(doc.exists) {
            const d = doc.data();
            document.getElementById('edit-name').value = d.name || '';
            document.getElementById('edit-phone').value = d.phone || '';
            document.getElementById('edit-email').value = d.email || '';
            document.getElementById('edit-img').value = d.imgUrl || '';
            
            document.getElementById('save-profile-btn').onclick = () => {
                db.collection('users').doc(uid).update({
                    name: document.getElementById('edit-name').value,
                    phone: document.getElementById('edit-phone').value,
                    email: document.getElementById('edit-email').value,
                    imgUrl: document.getElementById('edit-img').value
                }).then(() => closeModal('profile-modal'));
            };
        }
    });
};

window.performAction = function(action) {
    const p = document.getElementById('edit-phone').value;
    const e = document.getElementById('edit-email').value;
    if(action==='call') window.open('tel:'+p);
    if(action==='sms') window.open('sms:'+p);
    if(action==='email') window.open('mailto:'+e);
};

// Utils
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
        safeDisplay('staff-dashboard', 'flex');
        currentChatId = null;
    } else {
        safeDisplay('client-view', 'block');
        safeDisplay('main-chat-feed', 'none');
    }
}
function renderProgress(s) { 
    const fill = document.getElementById('progress-fill');
    if(fill) fill.style.width = ((s-1)*33)+'%';
}
