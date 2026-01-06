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
let currentChatData = null;
let messageToForward = null;
let isMenuOpen = false;
let isInternalMode = false;
let isMuted = false;
let isInitialLoad = true;
let myProfile = { name: 'משתמש', img: '' };

const notificationSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3');
document.addEventListener('click', () => { if(isInitialLoad) isInitialLoad = false; }, { once: true });

// --- 2. Start ---
document.addEventListener("DOMContentLoaded", function() {
    initViews();
});

function initViews() {
    safeOnClick('mute-btn', () => { isMuted=!isMuted; document.getElementById('mute-btn').innerText=isMuted?'volume_off':'volume_up'; });
    safeOnClick('refresh-btn', () => window.location.reload());
    safeOnClick('back-btn', goBack);
    safeOnClick('main-fab', handleFabClick);
    safeOnClick('send-btn', sendMessage);
    const inp = document.getElementById('msg-input');
    if(inp) inp.onkeypress = (e) => { if(e.key==='Enter') sendMessage(); };
    
    // כותרת
    safeOnClick('header-clickable', () => {
        if(staffId && currentChatId) openProfileModal(currentChatId);
    });
    
    // מנעול
    safeOnClick('internal-msg-btn', () => {
        isInternalMode = !isInternalMode;
        document.getElementById('internal-msg-btn').style.color = isInternalMode?'red':'#fbc02d';
        inp.placeholder = isInternalMode ? "הערה חסויה..." : "הקלד הודעה...";
    });

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
    safeSetText('header-subtitle', user.type==='group'?'קבוצה':'בשיחה');
    if(staffId) { safeDisplay('admin-controls', 'flex'); safeDisplay('internal-msg-btn', 'block'); }
    loadChat(user.id, 'main-chat-feed');
}

// --- 4. Chat Engine ---
function loadChat(cid, containerId) {
    const container = document.getElementById(containerId);
    if(!container) return;
    container.innerHTML = '<div class="date-divider">טוען...</div>';
    
    if (window.unsubChat) window.unsubChat();
    window.unsubChat = db.collection('orders').doc(cid).collection('messages')
    .orderBy('timestamp', 'asc').onSnapshot(snap => {
        container.innerHTML = '<div class="date-divider">היום</div>';
        const batch = db.batch(); let needsUp = false;
        
        snap.forEach(doc => {
            const msg = doc.data();
            renderMessage(msg, container);
            if (!isMe(msg.sender) && !msg.read) {
                batch.update(doc.ref, { read: true }); needsUp = true;
            }
        });
        if(needsUp) batch.commit();
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
    
    let pic = msg.senderImg || `https://ui-avatars.com/api/?name=${msg.senderName||'U'}&background=random`;
    let name = msg.senderName || (me ? 'אני' : 'משתמש');
    
    if(msg.type === 'internal' || msg.sender === 'system') {
        div.style.display='block'; div.className='message '+(msg.type==='internal'?'internal':'received');
        let txt = msg.sender==='system' ? `<div class="date-divider">${msg.text}</div>` : `🔒 <b>פנימי:</b> ${msg.text}<div class="msg-meta">${getTime(msg.timestamp)}</div>`;
        if(msg.sender==='system') { div.style.background='none'; div.style.boxShadow='none'; div.style.width='100%'; }
        div.innerHTML = txt; container.appendChild(div); return;
    }

    // הוספת חץ למחשב
    let optBtn = '';
    if(staffId) {
        optBtn = `<div class="msg-opt-btn" onclick="openMsgOptions(event, '${msg.text.replace(/'/g, "\\'")}')"><i class="material-icons">expand_more</i></div>`;
    }

    let tick = '';
    if(me) tick = `<i class="material-icons tick-icon ${msg.read?'tick-blue':'tick-gray'}">done_all</i>`;

    div.innerHTML = `
        <img src="${pic}" class="msg-profile-pic">
        <div class="message ${me?'sent':'received'}">
            ${optBtn}
            <div class="msg-sender-name">${name}</div>
            ${msg.text.replace(/\n/g, '<br>')}
            <div class="msg-meta">${getTime(msg.timestamp)} ${tick}</div>
        </div>
    `;
    
    // קליק ימני למחשב
    if(staffId) {
        div.querySelector('.message').addEventListener('contextmenu', (e) => {
            e.preventDefault(); openMsgOptions(e, msg.text);
        });
    }

    container.appendChild(div);
    if(!isInitialLoad && !me && !isMuted) notificationSound.play().catch(()=>{});
}

function sendMessage() {
    const inp = document.getElementById('msg-input');
    const text = inp.value.trim();
    const target = currentChatId || customerId;
    if (!text || !target) return;
    
    const type = (staffId && isInternalMode) ? 'internal' : 'regular';
    const role = staffId ? 'staff' : 'customer';
    
    db.collection('orders').doc(target).collection('messages').add({
        text, sender: role, type, timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        senderName: myProfile.name, senderImg: myProfile.img, read: false
    });
    inp.value = '';
    if(isInternalMode) document.getElementById('internal-msg-btn').click();
}

// --- 5. Forwarding ---
window.openMsgOptions = function(e, text) {
    if(e) e.stopPropagation();
    messageToForward = text;
    safeDisplay('msg-action-modal', 'flex');
};

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

function doForward(tid, tname) {
    const txt = `🚩 **העברה מ${document.getElementById('app-title').innerText}:**\n"${messageToForward}"`;
    db.collection('orders').doc(tid).collection('messages').add({
        text: txt, sender: 'staff', type: 'regular', timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        senderName: myProfile.name, senderImg: myProfile.img, read: false
    });
    alert('הועבר ל'+tname); closeModal('forward-target-modal');
}

// --- 6. Profiles & FAB ---
function handleFabClick() {
    if(staffId && !currentChatId) toggleFabMenu();
    else safeDisplay('order-modal', 'flex');
}
function toggleFabMenu() {
    isMenuOpen = !isMenuOpen;
    const main = document.getElementById('main-fab');
    if(main) main.classList.toggle('rotate');
    document.querySelectorAll('.mini-fab').forEach((m,i)=>{
        if(isMenuOpen) setTimeout(()=>m.classList.add('show'), i*50);
        else m.classList.remove('show');
    });
}
window.openUserModal = (role) => {
    toggleFabMenu(); safeDisplay('user-modal', 'flex');
    document.getElementById('new-user-role').value = role;
};
safeOnClick('save-user-btn', () => {
    const id = document.getElementById('new-user-id').value;
    const name = document.getElementById('new-user-name').value;
    const role = document.getElementById('new-user-role').value;
    if(id && name) {
        db.collection('users').doc(id).set({
            name, type: role, lastUpdate: firebase.firestore.FieldValue.serverTimestamp(),
            imgUrl: `https://ui-avatars.com/api/?name=${name}&background=random`
        }, {merge: true});
        closeModal('user-modal');
    }
});
window.openProfileModal = (uid) => {
    safeDisplay('profile-modal', 'flex');
    const groupArea = document.getElementById('group-management-area');
    const contactActions = document.getElementById('contact-actions');
    
    db.collection('users').doc(uid).get().then(doc => {
        if(doc.exists) {
            const d = doc.data();
            document.getElementById('edit-name').value = d.name||'';
            document.getElementById('edit-img').value = d.imgUrl||'';
            document.getElementById('edit-img-preview').src = d.imgUrl || `https://ui-avatars.com/api/?name=${d.name}&background=random`;
            
            if(d.type === 'group') {
                groupArea.style.display = 'block'; contactActions.style.display = 'none';
                renderMembers(d.members||{}, uid);
            } else {
                groupArea.style.display = 'none'; contactActions.style.display = 'flex';
                document.getElementById('edit-phone').value = d.phone||'';
                document.getElementById('edit-email').value = d.email||'';
            }
            
            document.getElementById('save-profile-btn').onclick = () => {
                db.collection('users').doc(uid).update({
                    name: document.getElementById('edit-name').value,
                    imgUrl: document.getElementById('edit-img').value,
                    phone: document.getElementById('edit-phone').value,
                    email: document.getElementById('edit-email').value
                }).then(()=>closeModal('profile-modal'));
            };
        }
    });
};

function renderMembers(members, uid) {
    const list = document.getElementById('group-members-list'); list.innerHTML='';
    Object.keys(members).forEach(mid => {
        list.innerHTML += `<div class="member-item"><span>${mid}</span><span class="badge-role" style="background:${members[mid]==='viewer'?'#999':'#4caf50'}">${members[mid]}</span></div>`;
    });
    safeOnClick('add-member-btn', () => {
        const newId = document.getElementById('new-member-id').value;
        if(newId) {
            const role = document.getElementById('can-write-toggle').checked ? 'writer' : 'viewer';
            members[newId] = role;
            db.collection('users').doc(uid).update({members}).then(() => openProfileModal(uid));
        }
    });
}

// Utils
function safeOnClick(id, fn) { const el=document.getElementById(id); if(el) el.onclick=fn; }
function safeSetText(id, txt) { const el=document.getElementById(id); if(el) el.innerText=txt; }
function safeDisplay(id, val) { const el=document.getElementById(id); if(el) el.style.display=val; }
window.closeModal = (id) => safeDisplay(id, 'none');
function getTime(ts) { return ts ? new Date(ts.toDate()).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) : ''; }
function isMe(sender) { return (staffId && sender === 'staff') || (!staffId && sender === 'customer'); }
function renderProgress(s) { document.getElementById('progress-fill').style.width = ((s-1)*33)+'%'; }
window.switchClientTab = (t) => { safeDisplay('tab-my-order', t==='my-order'?'block':'none'); safeDisplay('tab-departments', t==='departments'?'block':'none'); };
window.loadDepartments = () => {
    db.collection('users').where('type', '==', 'group').get().then(snap => {
        const c = document.getElementById('dept-list'); c.innerHTML='';
        snap.forEach(d => {
            const div = document.createElement('div'); div.className='chat-list-item';
            div.innerHTML=`<div class="chat-avatar" style="background:#e0f2f1;display:flex;justify-content:center;align-items:center;"><i class="material-icons" style="color:var(--primary-color)">groups</i></div><div class="chat-info"><div class="chat-name">${d.data().name}</div></div>`;
            div.onclick=()=>{ openChat({id:d.id, name:d.data().name, type:'group'}); safeDisplay('client-view','none'); }; c.appendChild(div);
        });
    });
};
window.updateStatus = (val) => { if(currentChatId) db.collection('users').doc(currentChatId).update({ status: val, lastUpdate: firebase.firestore.FieldValue.serverTimestamp() }); };
window.performAction = (act) => {
    const p = document.getElementById('edit-phone').value; const e = document.getElementById('edit-email').value;
    if(act==='call') window.open('tel:'+p); if(act==='sms') window.open('sms:'+p); if(act==='email') window.open('mailto:'+e);
};
