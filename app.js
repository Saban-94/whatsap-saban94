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

document.getElementById('mute-btn').addEventListener('click', function() {
    isMuted = !isMuted;
    this.innerText = isMuted ? 'volume_off' : 'volume_up';
    if(!isMuted) notificationSound.play().then(() => notificationSound.pause()).catch(()=>{});
});

// --- 2. זיהוי ---
const urlParams = new URLSearchParams(window.location.search);
let customerId = urlParams.get('cid'); 
let staffId = urlParams.get('sid');
let allClientsData = [];

// --- 3. OneSignal (מיקום מתוקן) ---
window.OneSignalDeferred = window.OneSignalDeferred || [];
OneSignalDeferred.push(async function(OneSignal) {
    await OneSignal.init({
        appId: "546472ac-f9ab-4c6c-beb2-e41c72af9849",
        safari_web_id: "web.onesignal.auto.195e7e66-9dea-4e11-b56c-b4a654da5ab7",
        notifyButton: { 
            enable: true, position: 'bottom-left', offset: { bottom: '90px', left: '15px' },
            colors: { 'circle.background': 'rgba(0, 128, 105, 0.4)', 'circle.foreground': 'white' }
        }
    });
    if (customerId) OneSignal.User.addTag("role", "client");
    if (staffId) OneSignal.User.addTag("role", "staff");
});

// --- 4. ניהול מסכים ---
const chatContainer = document.getElementById('chat-container');
const staffDashboard = document.getElementById('staff-dashboard');
const storiesContainer = document.getElementById('stories-container');
const appTitle = document.getElementById('app-title');
const subTitle = document.getElementById('sub-title');
const internalMsgBtn = document.getElementById('internal-msg-btn');
const adminControls = document.getElementById('admin-controls');

let isInternalMode = false;

if (staffId) { 
    // === מצב מנהל ===
    appTitle.innerText = "ניהול סידור";
    subTitle.innerText = "מחובר כ: " + staffId;
    
    storiesContainer.style.display = 'none';
    chatContainer.style.display = 'none';
    document.querySelector('.input-area').style.display = 'none';
    staffDashboard.style.display = 'block';
    internalMsgBtn.style.display = 'block';
    
    loadDashboardData();
} else if (customerId) { 
    // === מצב לקוח ===
    localStorage.setItem('saban_cid', customerId);
    appTitle.innerText = "ח.סבן חומרי בנין";
    subTitle.innerText = "מספר הזמנה: " + customerId;
    
    storiesContainer.style.display = 'flex';
    loadFormCache();
    listenToStatus(customerId);
    loadChat(customerId);
} else { 
    // === אורח ===
    const savedCid = localStorage.getItem('saban_cid');
    if (savedCid && !window.location.search.includes('cid')) { window.location.href = `?cid=${savedCid}`; }
    else if(chatContainer) { chatContainer.innerHTML = '<div style="text-align:center; padding:20px;">נא להיכנס דרך הקישור שהתקבל.</div>'; }
}

// --- 5. דשבורד מנהל (הלוגיקה) ---
function loadDashboardData() {
    const listDiv = document.getElementById('clients-list');
    listDiv.innerHTML = '<div style="text-align:center; padding:20px;">טוען נתונים...</div>';

    db.collection('users').orderBy('lastUpdate', 'desc').onSnapshot(snapshot => {
        allClientsData = [];
        let activeCount = 0;
        let historyCount = 0;

        snapshot.forEach(doc => {
            const data = doc.data();
            data.id = doc.id;
            // 4 זה "סופקה" - נחשב היסטוריה
            if (data.status === 4) historyCount++; else activeCount++;
            allClientsData.push(data);
        });

        document.getElementById('stat-active').innerText = activeCount;
        document.getElementById('stat-history').innerText = historyCount;
        
        // טעינה ראשונית של הפעילים
        filterDashboard('active');
    });
}

window.filterDashboard = function(type) {
    const listDiv = document.getElementById('clients-list');
    listDiv.innerHTML = '';
    const listTitle = document.getElementById('list-title');

    let filtered = [];
    if (type === 'active') {
        listTitle.innerText = "הזמנות חיות לטיפול";
        filtered = allClientsData.filter(c => !c.status || c.status < 4);
    } else {
        listTitle.innerText = "ארכיון / סופקו";
        filtered = allClientsData.filter(c => c.status === 4);
    }

    if (filtered.length === 0) {
        listDiv.innerHTML = '<div style="text-align:center; color:#999; margin-top:20px;">אין נתונים להצגה</div>';
        return;
    }

    filtered.forEach(client => {
        let statusText = "התקבל"; let statusClass = "status-1";
        if(client.status == 2) { statusText = "בטיפול"; statusClass = "status-2"; }
        if(client.status == 3) { statusText = "בדרך"; statusClass = "status-3"; }
        if(client.status == 4) { statusText = "סופקה"; statusClass = "status-4"; }

        const div = document.createElement('div');
        div.className = `client-card ${statusClass}`;
        div.innerHTML = `
            <div><strong>${client.name || client.id}</strong><br><small>${client.address || ''}</small></div>
            <div style="text-align:left"><small>${statusText}</small></div>
        `;
        div.onclick = () => openStaffChat(client);
        listDiv.appendChild(div);
    });
};

function openStaffChat(client) {
    customerId = client.id;
    staffDashboard.style.display = 'none';
    chatContainer.style.display = 'block';
    document.querySelector('.input-area').style.display = 'flex';
    document.getElementById('back-btn').style.display = 'block';
    adminControls.style.display = 'block';
    
    subTitle.innerText = client.name || client.id;
    loadChat(client.id);
}

document.getElementById('back-btn').onclick = () => {
    // חזרה לדשבורד
    chatContainer.style.display = 'none';
    document.querySelector('.input-area').style.display = 'none';
    adminControls.style.display = 'none';
    document.getElementById('back-btn').style.display = 'none';
    staffDashboard.style.display = 'block';
    subTitle.innerText = "שלום " + staffId;
    if (window.unsubscribeChat) window.unsubscribeChat();
};

// --- 6. סטורי ועדכוני סטטוס ---
function listenToStatus(cid) {
    db.collection('users').doc(cid).onSnapshot(doc => {
        if(doc.exists) {
            const data = doc.data();
            renderProgressStories(data.status || 1);
            if(data.name) subTitle.innerText = "שלום, " + data.name;
        } else { renderProgressStories(1); }
    });
}

function renderProgressStories(statusIndex) {
    if(!storiesContainer) return;
    storiesContainer.innerHTML = '';
    // השתמשנו באייקונים מגניבים
    const steps = [{icon:'receipt_long',text:'התקבלה'},{icon:'inventory_2',text:'בטיפול'},{icon:'local_shipping',text:'בדרך'},{icon:'check_circle',text:'סופקה'}];
    steps.forEach((step, index) => {
        const div = document.createElement('div');
        div.className = `status-step ${index + 1 <= statusIndex ? 'active' : ''}`;
        div.innerHTML = `<div class="status-icon"><i class="material-icons">${step.icon}</i></div><span class="status-text">${step.text}</span>`;
        storiesContainer.appendChild(div);
    });
}

window.updateStatus = function(newStatus) {
    if(!customerId) return;
    // עדכון ב-DB
    db.collection('users').doc(customerId).set({ status: newStatus, lastUpdate: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
    
    // הודעה אוטומטית
    let txt = "";
    if(newStatus==2) txt="ההזמנה בטיפול במחסן 📦";
    if(newStatus==3) txt="ההזמנה יצאה אליך! 🚚";
    if(newStatus==4) txt="ההזמנה נמסרה בהצלחה ✅";
    
    if(txt) {
        db.collection('orders').doc(customerId).collection('messages').add({
            text: txt, sender: 'system', type: 'regular', timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
    }
};

// --- 7. צ'אט ---
function loadChat(cid) {
    if(!chatContainer) return;
    if (window.unsubscribeChat) window.unsubscribeChat();
    window.unsubscribeChat = db.collection('orders').doc(cid).collection('messages')
    .orderBy('timestamp', 'asc').onSnapshot(snapshot => {
        snapshot.docChanges().forEach(change => {
            if (change.type === "added") {
                const msg = change.doc.data();
                renderMessage(msg);
                if (!isInitialLoad && !isMe(msg.sender) && !isMuted) playIncomingSound();
            }
        });
        isInitialLoad = false;
        chatContainer.scrollTop = chatContainer.scrollHeight;
    });
}

function renderMessage(msg) {
    if(!chatContainer) return;
    if (!staffId && msg.type === 'internal') return;

    const div = document.createElement('div');
    const me = isMe(msg.sender);
    let cls = 'message';
    if (msg.type === 'internal') cls += ' internal';
    else if (msg.sender === 'system') cls += ' received system-msg';
    else if (me) cls += ' sent'; else cls += ' received';

    div.className = cls;
    if(msg.sender==='system') { div.style.background="#fff8e1"; div.style.textAlign="center"; div.style.width="90%"; }

    let content = msg.text;
    if (msg.type === 'internal') content = `🔒 <b>הערה פנימית:</b> ${content}`;
    else if (msg.isOrder) content = `<b>${msg.title||'הזמנה'}</b><br>${msg.text.replace(/\n/g, '<br>')}`;

    let time = msg.timestamp ? new Date(msg.timestamp.toDate()).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '';
    div.innerHTML = `${content}<div class="msg-meta">${time}</div>`;
    chatContainer.appendChild(div);
}

function isMe(role) { return (staffId && role === 'staff') || (!staffId && role === 'customer'); }
function playIncomingSound() { if(!isMuted) notificationSound.play().catch(()=>{}); }

// --- 8. שליחה ומודל ---
if(internalMsgBtn) internalMsgBtn.onclick = () => { isInternalMode = !isInternalMode; internalMsgBtn.style.color = isInternalMode ? 'red' : '#fbc02d'; document.getElementById('msg-input').placeholder = isInternalMode ? "הערה חסויה..." : "הקלד הודעה..."; };
document.querySelector('.send-btn').onclick = sendMessage;
document.getElementById('msg-input').onkeypress = (e) => { if(e.key==='Enter') sendMessage(); };

function sendMessage() {
    const input = document.getElementById('msg-input');
    const text = input.value.trim();
    if (!text || !customerId) return;
    const type = (staffId && isInternalMode) ? 'internal' : 'regular';
    db.collection('orders').doc(customerId).collection('messages').add({ text, sender: staffId?'staff':'customer', type, staffId: staffId||null, timestamp: firebase.firestore.FieldValue.serverTimestamp() });
    input.value = '';
    if(isInternalMode) internalMsgBtn.click();
}

const modal = document.getElementById('order-modal');
document.getElementById('add-order-btn').onclick = () => modal.style.display = 'flex';
document.getElementById('close-modal-btn').onclick = () => modal.style.display = 'none';
document.getElementById('submit-order-btn').onclick = () => {
    const contact = document.getElementById('order-contact').value;
    const address = document.getElementById('order-address').value;
    const item = document.getElementById('order-item').value;
    const time = document.getElementById('order-time').value;
    
    if(!item) { alert("חסר פירוט"); return; }
    saveFormCache(contact, address);
    
    const txt = `👤 ${contact}\n📍 ${address}\n📦 ${item}\n⏰ ${time}`;
    db.collection('orders').doc(customerId).collection('messages').add({ text: txt, title: "📦 הזמנה חדשה", sender: staffId?'staff':'customer', isOrder: true, timestamp: firebase.firestore.FieldValue.serverTimestamp() });
    
    // שמירת הנתונים האמיתיים למנהל!
    db.collection('users').doc(customerId).set({ 
        status: 1, 
        name: contact || "לקוח " + customerId, 
        address: address, 
        lastUpdate: firebase.firestore.FieldValue.serverTimestamp() 
    }, { merge: true });

    document.getElementById('order-item').value = '';
    modal.style.display = 'none';
};

function saveFormCache(c, a) { if(c) localStorage.setItem('lc', c); if(a) localStorage.setItem('la', a); }
function loadFormCache() { 
    if(document.getElementById('order-contact')) document.getElementById('order-contact').value = localStorage.getItem('lc') || '';
    if(document.getElementById('order-address')) document.getElementById('order-address').value = localStorage.getItem('la') || '';
}
