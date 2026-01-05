// --- 1. הגדרות Firebase ושמירת מפתחות ---
const firebaseConfig = {
  apiKey: "AIzaSyBGYsZylsIyeWudp8_SlnLBelkgoNXjU60",
  authDomain: "app-saban94-57361.firebaseapp.com",
  projectId: "app-saban94-57361",
  storageBucket: "app-saban94-57361.firebasestorage.app",
  messagingSenderId: "275366913167",
  appId: "1:275366913167:web:f0c6f808e12f2aeb58fcfa",
  measurementId: "G-E297QYKZKQ"
};

// אתחול
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();

// סאונד
const notificationSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3');
let isInitialLoad = true;
let isMuted = false;

// כפתור השתקה
document.getElementById('mute-btn').addEventListener('click', function() {
    isMuted = !isMuted;
    this.innerText = isMuted ? 'volume_off' : 'volume_up';
    if(!isMuted) notificationSound.play().then(() => notificationSound.pause()).catch(()=>{});
});

// --- 2. זיהוי משתמש ---
const urlParams = new URLSearchParams(window.location.search);
let customerId = urlParams.get('cid'); 
let staffId = urlParams.get('sid');

// --- 3. OneSignal (התראות) ---
// --- 4. OneSignal (התראות - התיקון) ---
window.OneSignalDeferred = window.OneSignalDeferred || [];
OneSignalDeferred.push(async function(OneSignal) {
    await OneSignal.init({
        appId: "546472ac-f9ab-4c6c-beb2-e41c72af9849",
        safari_web_id: "web.onesignal.auto.195e7e66-9dea-4e11-b56c-b4a654da5ab7",
        
        // כאן התיקון: הזזת הפעמון שמאלה
        notifyButton: { 
            enable: true,
            position: 'bottom-left', // מזיז את הפעמון לצד שמאל
            offset: {
                bottom: '20px',
                left: '20px'
            },
            colors: { // בונוס: התאמת צבעים לאפליקציה שלך
                'circle.background': '#008069', // ירוק כמו הוואטסאפ
                'circle.foreground': 'white',
                'badge.background': '#fbc02d',
                'badge.foreground': 'black',
                'badge.bordercolor': 'white',
                'pulse.color': '#008069',
                'dialog.button.background.hovering': '#008069',
                'dialog.button.background.active': '#008069',
                'dialog.button.background': '#008069',
                'dialog.button.foreground': 'white'
            }
        },
    });
    
    if (customerId) OneSignal.User.addTag("role", "client");
    if (staffId) OneSignal.User.addTag("role", "staff");
});

// --- 4. ניהול מצבים (לקוח / מנהל) ---
const chatContainer = document.getElementById('chat-container');
const staffDashboard = document.getElementById('staff-dashboard');
const storiesContainer = document.getElementById('stories-container');
const appTitle = document.getElementById('app-title');
const subTitle = document.getElementById('sub-title');
const internalMsgBtn = document.getElementById('internal-msg-btn');

let isInternalMode = false; // מצב שליחת הודעה נסתרת

if (staffId) {
    // === מצב צוות ===
    appTitle.innerText = "ניהול סידור (מנהל)";
    subTitle.innerText = "מחובר כ: " + staffId;
    
    storiesContainer.style.display = 'none'; // מנהל רואה רשימה, לא סטורי
    chatContainer.style.display = 'none';
    document.querySelector('.input-area').style.display = 'none';
    staffDashboard.style.display = 'block';
    
    // הצגת כפתור הודעות פנימיות
    internalMsgBtn.style.display = 'block';
    
    loadAllClients();

} else if (customerId) {
    // === מצב לקוח ===
    localStorage.setItem('saban_cid', customerId);
    appTitle.innerText = "ח.סבן חומרי בנין";
    subTitle.innerText = "הזמנה: " + customerId;
    
    // טעינת מטמון (Cache) של כתובת ואיש קשר
    loadFormCache();
    
    // הצגת סרגל התקדמות
    renderProgressStories(1); // ברירת מחדל: התקבל
    
    loadChat(customerId);
} else {
    // === אורח ===
    const savedCid = localStorage.getItem('saban_cid');
    if (savedCid && !window.location.search.includes('cid')) {
         window.location.href = `?cid=${savedCid}`;
    } else {
        chatContainer.innerHTML = '<div style="text-align:center; padding:20px;">נא להיכנס דרך הקישור שהתקבל.</div>';
    }
}

// --- 5. סטורי / סרגל התקדמות ---
function renderProgressStories(statusIndex) {
    // סטטוסים: 1=התקבל, 2=בליקוט/בטיפול, 3=בדרך, 4=סופקה
    const steps = [
        { icon: 'receipt_long', text: 'התקבלה' },
        { icon: 'inventory_2', text: 'בטיפול' },
        { icon: 'local_shipping', text: 'בדרך' },
        { icon: 'check_circle', text: 'סופקה' }
    ];

    storiesContainer.innerHTML = '';
    
    steps.forEach((step, index) => {
        const isActive = index + 1 <= statusIndex ? 'active' : '';
        const div = document.createElement('div');
        div.className = `status-step ${isActive}`;
        div.innerHTML = `
            <div class="status-icon"><i class="material-icons">${step.icon}</i></div>
            <span style="font-size:0.75rem; font-weight:bold;">${step.text}</span>
        `;
        storiesContainer.appendChild(div);
    });
}

// --- 6. צ'אט והודעות ---
function loadChat(cid) {
    if(!chatContainer) return;
    if (window.unsubscribeChat) window.unsubscribeChat();

    window.unsubscribeChat = db.collection('orders').doc(cid).collection('messages')
    .orderBy('timestamp', 'asc')
    .onSnapshot(snapshot => {
        snapshot.docChanges().forEach(change => {
            if (change.type === "added") {
                const msg = change.doc.data();
                renderMessage(msg);
                if (!isInitialLoad && !isMe(msg.sender)) {
                    playIncomingSound();
                }
            }
        });
        isInitialLoad = false;
        chatContainer.scrollTop = chatContainer.scrollHeight;
    });
}

function renderMessage(msg) {
    if(!chatContainer) return;
    
    // סינון: אם אני לקוח, וההודעה היא פנימית (type='internal') -> אל תציג!
    if (!staffId && msg.type === 'internal') return;

    const div = document.createElement('div');
    const me = isMe(msg.sender);
    const isInternal = msg.type === 'internal';

    // קביעת המחלקה (CSS Class)
    let className = 'message';
    if (isInternal) className += ' internal';
    else if (me) className += ' sent';
    else className += ' received';

    div.className = className;
    
    let time = msg.timestamp ? new Date(msg.timestamp.toDate()).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '..';
    
    // תוכן ההודעה
    let content = msg.text;
    
    // אם זו הודעה פנימית - הוסף אייקון מנעול
    if (isInternal) {
        content = `<div style="display:flex; align-items:center; gap:5px; font-weight:bold; color:#f57f17;"><i class="material-icons" style="font-size:1rem">lock</i> הערה פנימית לצוות</div>` + content;
    }
    // אם זו הזמנה - הדגש
    else if (msg.isOrder) {
        content = `<div style="font-weight:bold; border-bottom:1px solid #ddd; margin-bottom:5px; padding-bottom:5px;">${msg.title || 'הזמנה חדשה'}</div>` + msg.text.replace(/\n/g, '<br>');
    }

    div.innerHTML = `${content}<div class="msg-meta"><span>${time}</span></div>`;
    chatContainer.appendChild(div);
}

function isMe(senderRole) {
    if (staffId && senderRole === 'staff') return true;
    if (!staffId && senderRole === 'customer') return true;
    return false;
}

function playIncomingSound() {
    if (isMuted) return;
    notificationSound.currentTime = 0;
    notificationSound.play().catch(()=>{});
}

// --- 7. שליחת הודעות ---
// החלפת מצב פנימי (מנעול)
if (internalMsgBtn) {
    internalMsgBtn.addEventListener('click', () => {
        isInternalMode = !isInternalMode;
        internalMsgBtn.style.color = isInternalMode ? 'red' : '#fbc02d'; // אדום כשפעיל
        document.getElementById('msg-input').placeholder = isInternalMode ? "הקלד הערה חסויה לצוות..." : "הקלד הודעה...";
    });
}

document.querySelector('.send-btn').addEventListener('click', sendMessage);
document.getElementById('msg-input').addEventListener('keypress', (e) => { if(e.key==='Enter') sendMessage() });

function sendMessage() {
    const input = document.getElementById('msg-input');
    const text = input.value.trim();
    if (!text || !customerId) return;

    const senderType = staffId ? 'staff' : 'customer';
    
    // האם זו הודעה פנימית?
    const msgType = (staffId && isInternalMode) ? 'internal' : 'regular';

    db.collection('orders').doc(customerId).collection('messages').add({
        text: text,
        sender: senderType,
        type: msgType, 
        staffId: staffId || null,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        read: false
    });
    
    input.value = '';
    // איפוס מצב פנימי אחרי שליחה
    if (isInternalMode) {
        isInternalMode = false;
        internalMsgBtn.style.color = '#fbc02d';
        input.placeholder = "הקלד הודעה...";
    }
}

// --- 8. טופס הזמנה וקאש (Cache) ---
const modal = document.getElementById('order-modal');
document.getElementById('add-order-btn').addEventListener('click', () => modal.style.display = 'flex');
document.getElementById('close-modal-btn').addEventListener('click', () => modal.style.display = 'none');
modal.addEventListener('click', (e) => { if(e.target === modal) modal.style.display = 'none'; });

document.getElementById('submit-order-btn').addEventListener('click', () => {
    const contact = document.getElementById('order-contact').value;
    const address = document.getElementById('order-address').value;
    const item = document.getElementById('order-item').value;
    const time = document.getElementById('order-time').value;

    if(!item) { alert("יש למלא פירוט הזמנה"); return; }

    // שמירה במטמון לשימוש הבא
    saveFormCache(contact, address);

    const orderText = `👤 איש קשר: ${contact}\n📍 כתובת: ${address}\n📦 פריטים:\n${item}\n⏰ זמן: ${time}`;
    
    db.collection('orders').doc(customerId).collection('messages').add({
        text: orderText,
        title: "📦 הזמנה חדשה התקבלה",
        sender: staffId ? 'staff' : 'customer',
        type: 'regular',
        isOrder: true,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    document.getElementById('order-item').value = ''; // ניקוי רק של הפריטים
    modal.style.display = 'none';
});

// ניהול מטמון (localStorage)
function saveFormCache(contact, address) {
    if(contact) localStorage.setItem('last_contact', contact);
    if(address) localStorage.setItem('last_address', address);
}

function loadFormCache() {
    const lastContact = localStorage.getItem('last_contact');
    const lastAddress = localStorage.getItem('last_address');
    
    if(lastContact) document.getElementById('order-contact').value = lastContact;
    if(lastAddress) document.getElementById('order-address').value = lastAddress;
}

// --- 9. דשבורד מנהל (טעינת לקוחות) ---
function loadAllClients() {
    const listDiv = document.getElementById('clients-list');
    listDiv.innerHTML = '<div style="text-align:center; padding:20px;">טוען נתונים...</div>';

    // כאן אנחנו מניחים שיש לך קולקציית users, אחרת נשלוף רק הזמנות פעילות
    // לצורך הדוגמה, נציג פשוט
    db.collection('users').where('type', '==', 'client').get().then(snapshot => {
        listDiv.innerHTML = '';
        if (snapshot.empty) {
            listDiv.innerHTML = '<div style="text-align:center">אין הזמנות פעילות</div>';
            return;
        }
        snapshot.forEach(doc => {
            const client = doc.data();
            const div = document.createElement('div');
            div.style.cssText = "background:white; padding:15px; margin-bottom:10px; border-radius:10px; cursor:pointer; display:flex; justify-content:space-between; border-bottom:1px solid #eee;";
            div.innerHTML = `
                <div><strong>${client.name || doc.id}</strong><br><small>${client.address || 'ללא כתובת'}</small></div>
                <i class="material-icons" style="color:var(--primary-color)">chat</i>
            `;
            div.onclick = () => {
                customerId = doc.id;
                document.getElementById('staff-dashboard').style.display = 'none';
                document.getElementById('chat-container').style.display = 'block';
                document.querySelector('.input-area').style.display = 'flex';
                document.getElementById('back-btn').style.display = 'block';
                subTitle.innerText = "משוחח עם: " + (client.name || doc.id);
                loadChat(doc.id);
            };
            listDiv.appendChild(div);
        });
    });
    
    document.getElementById('back-btn').onclick = () => window.location.reload();
}
