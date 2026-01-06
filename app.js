// --- 1. Init & Config ---
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

// Global Variables
const urlParams = new URLSearchParams(window.location.search);
let customerId = urlParams.get('cid'); 
let staffId = urlParams.get('sid');
let allUsersData = [];
let currentChatId = null;
let currentChatData = null;
let messageToForward = null;
let isMenuOpen = false;
let isInternalMode = false;
let isInitialLoad = true;
let isMuted = false;
let myProfile = { name: 'משתמש', img: '' };

const notificationSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3');

// --- 2. Helper Functions (Defined before usage) ---

function safeOnClick(id, fn) {
    const el = document.getElementById(id);
    if (el) el.onclick = fn;
}

function safeSetText(id, txt) {
    const el = document.getElementById(id);
    if (el) el.innerText = txt;
}

function safeDisplay(id, val) {
    const el = document.getElementById(id);
    if (el) el.style.display = val;
}

function closeModal(id) {
    safeDisplay(id, 'none');
}

function getTime(ts) {
    return ts ? new Date(ts.toDate()).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}) : '';
}

function isMe(sender) {
    return (staffId && sender === 'staff') || (!staffId && sender === 'customer');
}

function renderProgress(s) {
    const fill = document.getElementById('progress-fill');
    if (fill) fill.style.width = ((s - 1) * 33) + '%';
}

function goBack() {
    if (staffId) {
        safeDisplay('main-chat-feed', 'none');
        safeDisplay('input-area', 'none');
        safeDisplay('back-btn', 'none');
        safeDisplay('admin-controls', 'none');
        safeDisplay('internal-msg-btn', 'none');
        safeDisplay('staff-dashboard', 'flex');
        safeSetText('app-title', "ניהול ח.סבן");
        safeSetText('header-subtitle', staffId);
        currentChatId = null;
    } else {
        safeDisplay('client-view', 'block');
        safeDisplay('main-chat-feed', 'none');
        safeDisplay('back-btn', 'none');
    }
}

// --- 3. View Logic ---

function setupManager() {
    safeSetText('app-title', "ניהול ח.סבן");
    safeSetText('header-subtitle', staffId);
    safeDisplay('staff-dashboard', 'flex');
    safeDisplay('client-view', 'none');
    safeDisplay('main-chat-feed', 'none');
    
    db.collection('users').doc(staffId).get().then(doc => {
        if(doc.exists) {
            myProfile.name = doc.data().name || staffId;
            myProfile.img = doc.data().imgUrl || `https://ui-avatars.com/api/?name=${staffId}&background=random`;
        }
    });
    loadAllUsers();
}

function setupClient() {
    localStorage.setItem('saban_cid', customerId);
    safeSetText('app-title', "ח.סבן חומרי בנין");
    safeSetText('header-subtitle', "הזמנה פעילה");
    safeDisplay('staff-dashboard', 'none');
    safeDisplay('client-view', 'block');
    safeDisplay('input-area', 'flex');
    
    db.collection('users').doc(customerId).onSnapshot(doc => {
        if(doc.exists) {
            const d = doc.data();
            safeSetText('header-subtitle', d.name || "הזמנה פעילה");
            myProfile.name = d.name || "לקוח";
            myProfile.img = d.imgUrl || `https://ui-avatars.com/api/?name=${d.name}&background=random`;
            renderProgress(d.status || 1);
        }
    });
    
    loadChat(customerId, 'client-chat-container');
    loadDepartments();
}

function initViews() {
    safeOnClick('mute-btn', () => { 
        isMuted = !isMuted; 
        const btn = document.getElementById('mute-btn');
        if(btn) btn.innerText = isMuted ? 'volume_off' : 'volume_up'; 
    });
    safeOnClick('refresh-btn', () => window.location.reload());
    safeOnClick('back-btn', goBack);
    safeOnClick('main-fab', handleFabClick);
    safeOnClick('send-btn', sendMessage);
    
    const inp = document.getElementById('msg-input');
    if (inp) inp.onkeypress = (e) => { if (e.key === 'Enter') sendMessage(); };
    
    const header = document.getElementById('header-clickable');
    if (header) {
        header.onclick = () => {
            if (staffId && currentChatId) openProfileModal(currentChatId);
        };
    }
    
    safeOnClick('internal-msg-btn', () => {
        isInternalMode = !isInternalMode;
        const btn = document.getElementById('internal-msg-btn');
        if(btn) btn.style.color = isInternalMode ? 'red' : '#fbc02d';
        if(inp) inp.placeholder = isInternalMode ? "הערה חסויה..." : "הקלד הודעה...";
    });

    if (staffId) setupManager();
    else if (customerId) setupClient();
    else {
        const s = localStorage.getItem('saban_cid');
        if (s && !window.location.search.includes('cid')) window.location.href = `?cid=${s}`;
    }
}

// --- 4. Main Execution ---
document.addEventListener("DOMContentLoaded", function() {
    initViews();
});
document.addEventListener('click', () => { if (isInitialLoad) isInitialLoad = false; }, { once: true });

// --- 5. Dashboard & Tabs ---

function loadAllUsers() {
    db.collection('users').orderBy('lastUpdate', 'desc').onSnapshot(snapshot => {
        allUsersData = [];
        let active = 0, history = 0;
        snapshot.forEach(doc => {
            const d = doc.data(); d.id = doc.id;
            allUsersData.push(d);
            if (d.type === 'client' || !d.type) {
                if (d.status === 4) history++; else active++;
            }
        });
        safeSetText('stat-active', active);
        safeSetText('stat-history', history);
        switchManagerTab('chats');
    });
}

window.switchManagerTab = function(tab) {
    document.querySelectorAll('.tab-item').forEach(e => e.classList.remove('active'));
    const t = document.getElementById('tab-' + tab);
    if(t) t.classList.add('active');
    
    const list = document.getElementById('clients-list');
    if(list) list.innerHTML = '';
    
    let filtered = [];
    if (tab === 'chats') filtered = allUsersData.filter(u => u.type === 'client' || !u.type);
    if (tab === 'groups') filtered = allUsersData.filter(u => u.type === 'group');
    if (tab === 'staff') filtered = allUsersData.filter(u => u.type === 'staff');
    
    const gates = document.getElementById('dashboard-gates');
    if(gates) gates.style.display = tab === 'chats' ? 'grid' : 'none';
    
    if (tab === 'chats') filterList('active');
    else renderListItems(filtered, list);
};

window.filterList = function(statusType) {
    const list = document.getElementById('clients-list');
    if(list) list.innerHTML = '';
    const cards = document.querySelectorAll('.gate-card');
    cards.forEach(c => c.classList.remove('active-filter'));
    if (statusType === 'active' && cards[0]) cards[0].classList.add('active-filter');
    if (statusType === 'history' && cards[1]) cards[1].classList.add('active-filter');

    let filtered = allUsersData.filter(u => u.type === 'client' || !u.type);
    if (statusType === 'active') filtered = filtered.filter(u => !u.status || u.status < 4);
    if (statusType === 'history') filtered = filtered.filter(u => u.status === 4);
    renderListItems(filtered, list);
};

function renderListItems(data, container) {
    if (!container) return;
    if (data.length === 0) { container.innerHTML = '<div style="text-align:center; padding:20px; color:#999;">אין נתונים</div>'; return; }
    data.forEach(u => {
        const div = document.createElement('div');
        div.className = 'chat-list-item';
        let sub = u.address || (u.type === 'staff' ? 'איש צוות' : 'קבוצה');
        div.innerHTML = `
            <img src="${u.imgUrl || 'https://ui-avatars.com/api/?name=' + u.name + '&background=random'}" class="chat-avatar">
            <div class="chat-info"><div class="chat-name">${u.name || u.id}</div><div class="chat-preview">${sub}</div></div>
        `;
        div.onclick = () => openChat(u);
        container.appendChild(div);
    });
}

function openChat(user) {
    currentChatId = user.id;
    currentChatData = user;
    safeDisplay('staff-dashboard', 'none');
    safeDisplay('main-chat-feed', 'flex');
    safeDisplay('back-btn', 'block');
    safeSetText('app-title', user.name || user.id);
    safeSetText('header-subtitle', user.type === 'group' ? 'קבוצה' : 'בשיחה');
    
    if (staffId) {
        safeDisplay('admin-controls', 'flex');
        safeDisplay('internal-msg-btn', 'block');
    }
    
    checkPermissions();
    loadChat(user.id, 'main-chat-feed');
}

function checkPermissions() {
    let canWrite = true;
    if (currentChatData && currentChatData.members && !staffId) {
        const myRole = currentChatData.members[customerId];
        if (myRole === 'viewer') canWrite = false;
    }
    
    if (canWrite) {
        safeDisplay('input-area', 'flex');
        safeDisplay('read-only-msg', 'none');
    } else {
        safeDisplay('input-area', 'none');
        const ia = document.getElementById('input-area');
        if(ia) ia.style.display = 'flex';
        const iw = document.querySelector('.input-wrapper');
        if(iw) iw.style.display = 'none';
        const fab = document.getElementById('main-fab');
        if(fab) fab.style.display = 'none';
        safeDisplay('read-only-msg', 'block');
    }
}

// --- 6. Chat Logic ---

function loadChat(cid, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '<div class="date-divider">טוען...</div>';

    if (window.unsubChat) window.unsubChat();
    window.unsubChat = db.collection('orders').doc(cid).collection('messages')
        .orderBy('timestamp', 'asc').onSnapshot(snap => {
            container.innerHTML = '<div class="date-divider">היום</div>';
            const batch = db.batch();
            let needsUp = false;

            snap.forEach(doc => {
                const msg = doc.data();
                renderMessage(msg, container);
                if (!isMe(msg.sender) && !msg.read) {
                    batch.update(doc.ref, { read: true });
                    needsUp = true;
                }
            });
            if (needsUp) batch.commit();
            container.scrollTop = container.scrollHeight;
        });
}

function renderMessage(msg, container) {
    if (!staffId && msg.type === 'internal') return;
    const div = document.createElement('div');
    const me = isMe(msg.sender);

    let cls = 'msg-row';
    if (me) cls += ' sent';
    div.className = cls;

    let pic = msg.senderImg || `https://ui-avatars.com/api/?name=${msg.senderName || 'U'}&background=random`;
    let name = msg.senderName || (me ? 'אני' : 'משתמש');

    if (msg.type === 'internal' || msg.sender === 'system') {
        div.style.display = 'block';
        div.className = 'message ' + (msg.type === 'internal' ? 'internal' : 'received');
        let txt = msg.sender === 'system' ? `<div class="date-divider">${msg.text}</div>` : `🔒 <b>פנימי:</b> ${msg.text}<div class="msg-meta">${getTime(msg.timestamp)}</div>`;
        if (msg.sender === 'system') {
            div.style.background = 'none';
            div.style.boxShadow = 'none';
            div.style.width = '100%';
        }
        div.innerHTML = txt;
        container.appendChild(div);
        return;
    }

    let optBtn = '';
    if (staffId) {
        optBtn = `<div class="msg-opt-btn" onclick="openMsgOptions(event, '${msg.text.replace(/'/g, "\\'")}')"><i class="material-icons">expand_more</i></div>`;
    }

    let tick = '';
    if (me) tick = `<i class="material-icons tick-icon ${msg.read ? 'tick-blue' : 'tick-gray'}">done_all</i>`;

    div.innerHTML = `
        <img src="${pic}" class="msg-profile-pic">
        <div class="message ${me ? 'sent' : 'received'}">
            ${optBtn}
            <div class="msg-sender-name">${name}</div>
            ${msg.text.replace(/\n/g, '<br>')}
            <div class="msg-meta">${getTime(msg.timestamp)} ${tick}</div>
        </div>
    `;

    if (staffId) {
        const bubble = div.querySelector('.message');
        if(bubble) bubble.addEventListener('contextmenu', (e) => { e.preventDefault(); openMsgOptions(e, msg.text); });
    }

    container.appendChild(div);
    if (!isInitialLoad && !me && !isMuted) notificationSound.play().catch(() => {});
}

function sendMessage() {
    const inp = document.getElementById('msg-input');
    const text = inp.value.trim();
    const target = currentChatId || customerId;
    if (!text || !target) return;

    const type = (staffId && isInternalMode) ? 'internal' : 'regular';
    const role = staffId ? 'staff' : 'customer';

    db.collection('orders').doc(target).collection('messages').add({
        text,
        sender: role,
        type,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        senderName: myProfile.name,
        senderImg: myProfile.img,
        read: false
    });
    inp.value = '';
    if (isInternalMode) {
        const btn = document.getElementById('internal-msg-btn');
        if(btn) btn.click();
    }
}

// --- 7. Features (Forwarding, FAB, Profile) ---

function handleFabClick() {
    if (staffId && !currentChatId) toggleFabMenu();
    else safeDisplay('order-modal', 'flex');
}

function toggleFabMenu() {
    isMenuOpen = !isMenuOpen;
    const main = document.getElementById('main-fab');
    if(main) main.classList.toggle('rotate');
    document.querySelectorAll('.mini-fab').forEach((m, i) => {
        if (isMenuOpen) setTimeout(() => m.classList.add('show'), i * 50);
        else m.classList.remove('show');
    });
}

window.openUserModal = function(role) {
    toggleFabMenu();
    safeDisplay('user-modal', 'flex');
    const roleInput = document.getElementById('new-user-role');
    if(roleInput) roleInput.value = role;
    safeSetText('user-modal-title', role === 'group' ? 'קבוצה חדשה' : 'משתמש חדש');
};

window.openMsgOptions = function(e, text) {
    if (e) e.stopPropagation();
    messageToForward = text;
    safeDisplay('msg-action-modal', 'flex');
};

window.forwardMessageToGroup = function() {
    closeModal('msg-action-modal');
    safeDisplay('forward-target-modal', 'flex');
    const list = document.getElementById('groups-list-for-forward');
    if(!list) return;
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

function doForward(tid, tname) {
    const txt = `🚩 **העברה מ${document.getElementById('app-title').innerText}:**\n"${messageToForward}"`;
    db.collection('orders').doc(tid).collection('messages').add({
        text: txt, sender: 'staff', type: 'regular', timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        senderName: myProfile.name, senderImg: myProfile.img, read: false
    });
    alert('הועבר ל' + tname);
    closeModal('forward-target-modal');
}

window.openProfileModal = function(uid) {
    safeDisplay('profile-modal', 'flex');
    const groupArea = document.getElementById('group-management-area');
    const contactActions = document.getElementById('contact-actions');

    db.collection('users').doc(uid).get().then(doc => {
        if (doc.exists) {
            const d = doc.data();
            const editName = document.getElementById('edit-name');
            const editImg = document.getElementById('edit-img');
            const editImgPrev = document.getElementById('edit-img-preview');
            
            if(editName) editName.value = d.name || '';
            if(editImg) editImg.value = d.imgUrl || '';
            if(editImgPrev) editImgPrev.src = d.imgUrl || `https://ui-avatars.com/api/?name=${d.name}&background=random`;

            if (d.type === 'group') {
                if(groupArea) groupArea.style.display = 'block';
                if(contactActions) contactActions.style.display = 'none';
                renderMembers(d.members || {}, uid);
            } else {
                if(groupArea) groupArea.style.display = 'none';
                if(contactActions) contactActions.style.display = 'flex';
                const ePhone = document.getElementById('edit-phone');
                const eEmail = document.getElementById('edit-email');
                if(ePhone) ePhone.value = d.phone || '';
                if(eEmail) eEmail.value = d.email || '';
            }

            safeOnClick('save-profile-btn', () => {
                const updatedData = {
                    name: document.getElementById('edit-name').value,
                    imgUrl: document.getElementById('edit-img').value
                };
                if(d.type !== 'group') {
                    updatedData.phone = document.getElementById('edit-phone').value;
                    updatedData.email = document.getElementById('edit-email').value;
                }
                db.collection('users').doc(uid).update(updatedData).then(() => closeModal('profile-modal'));
            });
        }
    });
};

function renderMembers(members, uid) {
    const list = document.getElementById('group-members-list');
    if(list) {
        list.innerHTML = '';
        Object.keys(members).forEach(mid => {
            const role = members[mid];
            list.innerHTML += `<div class="member-item"><span>${mid}</span><span class="badge-role" style="background:${role==='viewer'?'#999':'#4caf50'};color:white;padding:2px 5px;border-radius:4px;">${role}</span></div>`;
        });
    }
    
    safeOnClick('add-member-btn', () => {
        const newIdInput = document.getElementById('new-member-id');
        const toggle = document.getElementById('can-write-toggle');
        const newId = newIdInput ? newIdInput.value : null;
        
        if (newId) {
            const role = toggle && toggle.checked ? 'writer' : 'viewer';
            members[newId] = role;
            db.collection('users').doc(uid).update({ members }).then(() => openProfileModal(uid));
        }
    });
}

safeOnClick('save-user-btn', () => {
    const id = document.getElementById('new-user-id').value;
    const name = document.getElementById('new-user-name').value;
    const role = document.getElementById('new-user-role').value;
    if (id && name) {
        db.collection('users').doc(id).set({
            name, type: role, lastUpdate: firebase.firestore.FieldValue.serverTimestamp(),
            imgUrl: `https://ui-avatars.com/api/?name=${name}&background=random`
        }, { merge: true });
        closeModal('user-modal');
    }
});

safeOnClick('submit-order-btn', () => {
    const contact = document.getElementById('order-contact').value;
    const address = document.getElementById('order-address').value;
    const item = document.getElementById('order-item').value;
    const time = document.getElementById('order-time').value;
    if (!item) { alert('חסר פירוט'); return; }
    
    const txt = `👤 ${contact}\n📍 ${address}\n📦 ${item}\n⏰ ${time}`;
    db.collection('orders').doc(customerId).collection('messages').add({
        text: txt, title: "הזמנה חדשה", sender: 'customer', timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        senderName: contact || 'לקוח', read: false
    });
    db.collection('users').doc(customerId).set({
        name: contact || "לקוח", address: address, status: 1, type: 'client', lastUpdate: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    closeModal('order-modal');
});

// Client Utils
window.switchClientTab = function(tab) {
    document.querySelectorAll('.c-tab').forEach(e => e.classList.remove('active'));
    const t = document.getElementById('c-tab-' + (tab==='my-order'?'order':'dept'));
    if(t) t.classList.add('active');
    
    safeDisplay('tab-my-order', tab === 'my-order' ? 'block' : 'none');
    safeDisplay('tab-departments', tab === 'departments' ? 'block' : 'none');
};

function loadDepartments() {
    db.collection('users').where('type', '==', 'group').get().then(snap => {
        const c = document.getElementById('dept-list');
        if(!c) return;
        c.innerHTML = '';
        snap.forEach(d => {
            const div = document.createElement('div');
            div.className = 'chat-list-item';
            div.innerHTML = `<div class="chat-avatar" style="background:#e0f2f1;display:flex;justify-content:center;align-items:center;"><i class="material-icons" style="color:var(--primary-color)">groups</i></div><div class="chat-info"><div class="chat-name">${d.data().name}</div></div>`;
            div.onclick = () => {
                openChat({ id: d.id, name: d.data().name, type: 'group' });
                safeDisplay('client-view', 'none');
            };
            c.appendChild(div);
        });
    });
}

window.updateStatus = function(val) {
    if (currentChatId) db.collection('users').doc(currentChatId).update({ status: val, lastUpdate: firebase.firestore.FieldValue.serverTimestamp() });
};

window.performAction = function(act) {
    const p = document.getElementById('edit-phone').value;
    const e = document.getElementById('edit-email').value;
    if (act === 'call') window.open('tel:' + p);
    if (act === 'sms') window.open('sms:' + p);
    if (act === 'email') window.open('mailto:' + e);
};
