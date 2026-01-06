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
let isInitialLoad = true;
let isMuted = false;
const notificationSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3');

// פרטי המשתמש הנוכחי (לשליחת הודעות עם תמונה)
let myProfile = { name: 'משתמש', img: '' };

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
    
    // טעינת פרטי המנהל לשליחת הודעות
    db.collection('users').doc(staffId).get().then(doc => {
        if(doc.exists) {
            myProfile.name = doc.data().name || staffId;
            myProfile.img = doc.data().imgUrl || `https://ui-avatars.com/api/?name=${staffId}&background=random`;
        } else {
            // יצירת פרופיל פיקטיבי אם לא קיים
            myProfile.name = staffId;
            myProfile.img = `https://ui-avatars.com/api/?name=${staffId}&background=random`;
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
            // שמירת פרטי הלקוח
            myProfile.name = d.name || "לקוח";
            myProfile.img = d.imgUrl || `https://ui-avatars.com/api/?name=${d.name||'Client'}&background=random`;
            renderProgress(d.status || 1);
        }
    });
    
    loadChat(customerId, 'client-chat-container');
    loadDepartments();
}

// --- 3. Dashboard & Tabs ---
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
    } else {
        safeDisplay('input-area', 'none');
    }
}

// --- 4. Chat Engine & Blue Ticks ---
function loadChat(cid, containerId) {
    const container = document.getElementById(containerId);
    if(!container) return;
    container.innerHTML = '<div class="date-divider">טוען...</div>';
    
    if (window.unsubChat) window.unsubChat();
    
    window.unsubChat = db.collection('orders').doc(cid).collection('messages')
    .orderBy('timestamp', 'asc').onSnapshot(snap => {
        container.innerHTML = '<div class="date-divider">היום</div>';
        
        const batch = db.batch();
        let needsUpdate = false;

        snap.forEach(doc => {
            const msg = doc.data();
            renderMessage(msg, container);
            
            // לוגיקת "קראתי" (Blue Tick)
            // אם ההודעה לא ממני, ועדיין לא נקראה -> סמן כנקראה
            if (!isMe(msg.sender) && !msg.read) {
                const ref = db.collection('orders').doc(cid).collection('messages').doc(doc.id);
                batch.update(ref, { read: true });
                needsUpdate = true;
            }
        });
        
        if (needsUpdate) {
            batch.commit().catch(err => console.log("Error marking read:", err));
        }

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
    
    // קביעת תמונה ושם
    // אם זו הודעה שלי - משתמש בפרופיל שלי. אם של אחר - מההודעה עצמה או ברירת מחדל
    let pic = msg.senderImg || `https://ui-avatars.com/api/?name=${msg.senderName||'U'}&background=random`;
    let name = msg.senderName || (me ? 'אני' : 'משתמש');
    
    // טיפול בהודעות מערכת/פנימיות
    if(msg.type === 'internal' || msg.sender === 'system') {
        let content = msg.text;
        div.style.display = 'block'; // לא row
        div.className = 'message ' + (msg.type==='internal'?'internal':'received');
        if(msg.sender==='system') {
            div.style.textAlign='center'; div.style.width='100%'; div.style.background='none'; div.style.boxShadow='none';
            div.innerHTML = `<div class="date-divider">${content}</div>`;
        } else {
            div.innerHTML = `🔒 <b>פנימי:</b> ${content}<div class="msg-meta">${getTime(msg.timestamp)}</div>`;
        }
        container.appendChild(div);
        return;
    }

    // הוי הכחול (רק להודעות שלי)
    let tickHtml = '';
    if (me) {
        let tickColor = msg.read ? 'tick-blue' : 'tick-gray';
        tickHtml = `<i class="material-icons tick-icon ${tickColor}">done_all</i>`;
    }

    div.innerHTML = `
        <img src="${pic}" class="msg-profile-pic">
        <div class="message ${me?'sent':'received'}">
            <div class="msg-sender-name">${name}</div>
            ${msg.text.replace(/\n/g, '<br>')}
            <div class="msg-meta">
                ${getTime(msg.timestamp)}
                ${tickHtml}
            </div>
        </div>
    `;
    
    container.appendChild(div);
    if(!isInitialLoad && !me && !isMuted) notificationSound.play().catch(()=>{});
}

function sendMessage() {
    const inp = document.getElementById('msg-input');
    const text = inp.value.trim();
    const target = currentChatId || customerId;
    if (!text || !target) return;
    
    const type = (staffId && isInternalMode) ? 'internal' : 'regular';
    const senderRole = staffId ? 'staff' : 'customer';
    
    db.collection('orders').doc(target).collection('messages').add({
        text: text, 
        sender: senderRole, 
        type: type, 
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        // נתונים חדשים לתצוגה יפה
        senderName: myProfile.name,
        senderImg: myProfile.img,
        read: false // מתחיל כלא נקרא
    });
    
    inp.value = '';
    if(isInternalMode) document.getElementById('internal-msg-btn').click();
}

// --- 5. Forwarding & Modals ---
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
        text: refText, sender: 'staff', type: 'regular', timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        senderName: myProfile.name, senderImg: myProfile.img, read: false
    });
    alert('הועבר ל' + targetName);
    closeModal('forward-target-modal');
}

// --- Utils & FAB ---
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
};
safeOnClick('save-user-btn', () => {
    const id = document.getElementById('new-user-id').value;
    const name = document.getElementById('new-user-name').value;
    const role = document.getElementById('new-user-role').value;
    if(id && name) {
        db.collection('users').doc(id).set({
            name: name, type: role, lastUpdate: firebase.firestore.FieldValue.serverTimestamp(),
            imgUrl: `https://ui-avatars.com/api/?name=${name}&background=random`
        }, {merge: true});
        closeModal('user-modal');
    }
});
safeOnClick('submit-order-btn', () => {
    const contact = document.getElementById('order-contact').value;
    const address = document.getElementById('order-address').value;
    const item = document.getElementById('order-item').value;
    const time = document.getElementById('order-time').value;
    if(!item) { alert('חסר פירוט'); return; }
    const txt = `👤 ${contact}\n📍 ${address}\n📦 ${item}\n⏰ ${time}`;
    db.collection('orders').doc(customerId).collection('messages').add({
        text: txt, title: "הזמנה חדשה", sender: 'customer', timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        senderName: contact || 'לקוח', read: false
    });
    db.collection('users').doc(customerId).set({
        name: contact||"לקוח", address: address, status: 1, type: 'client', lastUpdate: firebase.firestore.FieldValue.serverTimestamp()
    }, {merge: true});
    closeModal('order-modal');
});

function safeOnClick(id, fn) { const el=document.getElementById(id); if(el) el.onclick=fn; }
function safeSetText(id, txt) { const el=document.getElementById(id); if(el) el.innerText=txt; }
function safeDisplay(id, val) { const el=document.getElementById(id); if(el) el.style.display=val; }
window.closeModal = (id) => safeDisplay(id, 'none');
function goBack() {
    if(staffId) {
        safeDisplay('main-chat-feed', 'none'); safeDisplay('input-area', 'none'); safeDisplay('back-btn', 'none'); safeDisplay('admin-controls', 'none'); safeDisplay('staff-dashboard', 'flex'); safeSetText('app-title', "ניהול ח.סבן"); currentChatId = null;
    } else { safeDisplay('client-view', 'block'); safeDisplay('main-chat-feed', 'none'); }
}
function getTime(ts) { return ts ? new Date(ts.toDate()).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) : ''; }
function isMe(sender) { return (staffId && sender === 'staff') || (!staffId && sender === 'customer'); }
function renderProgress(s) { document.getElementById('progress-fill').style.width = ((s-1)*33)+'%'; }
window.switchClientTab = (t) => {
    document.querySelectorAll('.c-tab').forEach(e => e.classList.remove('active')); event.currentTarget.classList.add('active');
    safeDisplay('tab-my-order', t==='my-order'?'block':'none'); safeDisplay('tab-departments', t==='departments'?'block':'none');
};
window.updateStatus = (val) => {
    if(!currentChatId) return; db.collection('users').doc(currentChatId).update({ status: val, lastUpdate: firebase.firestore.FieldValue.serverTimestamp() });
};
// מחלקות ללקוח
function loadDepartments() {
    db.collection('users').where('type', '==', 'group').get().then(snap => {
        const c = document.getElementById('dept-list'); c.innerHTML='';
        snap.forEach(d => {
            const div = document.createElement('div'); div.className='chat-list-item';
            div.innerHTML=`<div class="chat-avatar" style="background:#e0f2f1;display:flex;justify-content:center;align-items:center;"><i class="material-icons" style="color:var(--primary-color)">groups</i></div><div class="chat-info"><div class="chat-name">${d.data().name}</div></div>`;
            div.onclick=()=>{ openChat({id:d.id, name:d.data().name, type:'group'}); safeDisplay('client-view','none'); }; c.appendChild(div);
        });
    });
}
