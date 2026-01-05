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
const muteBtn = document.getElementById('mute-btn');
if(muteBtn) {
    muteBtn.addEventListener('click', function() {
        isMuted = !isMuted;
        this.innerText = isMuted ? 'volume_off' : 'volume_up';
        if(!isMuted) notificationSound.play().then(() => notificationSound.pause()).catch(()=>{});
    });
}

// --- 2. זיהוי משתמש ---
const urlParams = new URLSearchParams(window.location.search);
let customerId = urlParams.get('cid'); 
let staffId = urlParams.get('sid');

// --- 3. OneSignal (התראות - התיקון הגדול!) ---
window.OneSignalDeferred = window.OneSignalDeferred || [];
OneSignalDeferred.push(async function(OneSignal) {
    await OneSignal.init({
        appId: "546472ac-f9ab-4c6c-beb2-e41c72af9849",
        safari_web_id: "web.onesignal.auto.195e7e66-9dea-4e11-b56c-b4a654da5ab7",
        
        // הגדרות עיצוב הפעמון
        notifyButton: { 
            enable: true,
            position: 'bottom-left', // נשאר בצד שמאל
            
            // --- כאן הקסם: הרמה לגובה ---
            offset: {
                bottom: '90px', // מרים אותו מעל כפתור הפלוס ומעל המקלדת!
                left: '15px'
            },
            
            // --- כאן הקסם: שקיפות ---
            colors: { 
                'circle.background': 'rgba(0, 128, 105, 0.4)', // ירוק חצי שקוף (40%)
                'circle.foreground': 'white',
                'badge.background': '#fbc02d',
                'badge.foreground': 'black',
                'badge.bordercolor': 'transparent',
                'pulse.color': 'rgba(0, 128, 105, 0.2)',
                'dialog.button.background.hovering': '#008069',
                'dialog.button.background.active': '#008069',
                'dialog.button.background': '#008069',
                'dialog.button.foreground': 'white'
            },
            // גודל - בינוני כדי לא להשתלט
            size: 'medium', 
            // הסתרת הטקסט הצף (Tooltip) כדי למנוע הפרעה נוספת
            displayPredicate: function() {
                return OneSignal.isPushNotificationsEnabled()
                    .then(function(isPushEnabled) {
                        return !isPushEnabled;
                    });
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

let isInternalMode = false;

if (staffId) {
    // === מצב צוות ===
    if(appTitle) appTitle.innerText = "ניהול סידור (מנהל)";
    if(subTitle) subTitle.innerText = "מחובר כ: " + staffId;
    
    if(storiesContainer) storiesContainer.style.display = 'none';
    if(chatContainer) chatContainer.style.display = 'none';
    if(document.querySelector('.input-area')) document.querySelector('.input-area').style.display = 'none';
    if(staffDashboard) staffDashboard.style.display = 'block';
    
    if(internalMsgBtn) internalMsgBtn.style.display = 'block';
    
    loadAllClients();

} else if (customerId) {
    // === מצב לקוח ===
    localStorage.setItem('saban_cid', customerId);
    if(appTitle) appTitle.innerText = "ח.סבן חומרי בנין";
    if(subTitle) subTitle.innerText = "הזמנה: " + customerId;
    
    loadFormCache();
    renderProgressStories(1); 
    loadChat(customerId);
} else {
    // === אורח ===
    const savedCid = localStorage.getItem('saban_cid');
    if (savedCid && !window.location.search.includes('cid')) {
         window.location.href = `?cid=${savedCid}`;
    } else {
        if(chatContainer) chatContainer.innerHTML = '<div style="text-align:center; padding:20px;">נא להיכנס דרך הקישור שהתקבל.</div>';
    }
}

// --- 5. סטורי ---
function renderProgressStories(statusIndex) {
    const steps = [
        { icon: 'receipt_long', text: 'התקבלה' },
        { icon: 'inventory_2', text: 'בטיפול' },
        { icon: 'local_shipping', text: 'בדרך' },
        { icon: 'check_circle', text: 'סופקה' }
    ];

    if(!storiesContainer) return;
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
    if (!staffId && msg.type === 'internal') return;

    const div = document.createElement('div');
    const me = isMe(msg.sender);
    const isInternal = msg.type === 'internal';

    let className = 'message';
    if (isInternal) className += ' internal';
    else if (me) className += ' sent';
    else className += ' received';

    div.className = className;
    
    let time = msg.timestamp ? new Date(msg.timestamp.toDate()).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '..';
    let content = msg.text;
    
    if (isInternal) {
        content = `<div style="display:flex; align-items:center; gap:5px; font-weight:bold; color:#f57f17;"><i class="material-icons" style="font-size:1rem">lock</i> הערה פנימית לצוות</div>` + content;
    } else if (msg.isOrder) {
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
if (internalMsgBtn) {
    internalMsgBtn.addEventListener('click', () => {
        isInternalMode = !isInternalMode;
        internalMsgBtn.style.color = isInternalMode ? 'red' : '#fbc02d';
        document.getElementById('msg-input').placeholder = isInternalMode ? "הקלד הערה חסויה לצוות..." : "הקלד הודעה...";
    });
}

const sendBtn = document.querySelector('.send-btn');
if(sendBtn) sendBtn.addEventListener('click', sendMessage);
const msgInput = document.getElementById('msg-input');
if(msgInput) msgInput.addEventListener('keypress', (e) => { if(e.key==='Enter') sendMessage() });

function sendMessage() {
    const input = document.getElementById('msg-input');
    if(!input) return;
    const text = input.value.trim();
    if (!text || !customerId) return;

    const senderType = staffId ? 'staff' : 'customer';
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
    if (isInternalMode) {
        isInternalMode = false;
        internalMsgBtn.style.color = '#fbc02d';
        input.placeholder = "הקלד הודעה...";
    }
}

// --- 8. טופס הזמנה וקאש ---
const modal = document.getElementById('order-modal');
const addOrderBtn = document.getElementById('add-order-btn');
const closeModalBtn = document.getElementById('close-modal-btn');
const submitOrderBtn = document.getElementById('submit-order-btn');

if(addOrderBtn) addOrderBtn.addEventListener('click', () => modal.style.display = 'flex');
if(closeModalBtn) closeModalBtn.addEventListener('click', () => modal.style.display = 'none');
if(modal) modal.addEventListener('click', (e) => { if(e.target === modal) modal.style.display = 'none'; });

if(submitOrderBtn) {
    submitOrderBtn.addEventListener('click', () => {
        const contact = document.getElementById('order-contact').value;
        const address = document.getElementById('order-address').value;
        const item = document.getElementById('order-item').value;
        const time = document.getElementById('order-time').value;

        if(!item) { alert("יש למלא פירוט הזמנה"); return; }

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
        
        document.getElementById('order-item').value = '';
        modal.style.display = 'none';
    });
}

function saveFormCache(contact, address) {
    if(contact) localStorage.setItem('last_contact', contact);
    if(address) localStorage.setItem('last_address', address);
}

function loadFormCache() {
    const lastContact = localStorage.getItem('last_contact');
    const lastAddress = localStorage.getItem('last_address');
    
    const contactInput = document.getElementById('order-contact');
    const addressInput = document.getElementById('order-address');

    if(lastContact && contactInput) contactInput.value = lastContact;
    if(lastAddress && addressInput) addressInput.value = lastAddress;
}

// --- 9. דשבורד מנהל ---
function loadAllClients() {
    const listDiv = document.getElementById('clients-list');
    if(!listDiv) return;
    listDiv.innerHTML = '<div style="text-align:center; padding:20px;">טוען נתונים...</div>';

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
                if(document.querySelector('.input-area')) document.querySelector('.input-area').style.display = 'flex';
                document.getElementById('back-btn').style.display = 'block';
                if(subTitle) subTitle.innerText = "משוחח עם: " + (client.name || doc.id);
                
                // איפוס סטורי למצב מוסתר כשאני בשיחה כמנהל
                if(storiesContainer) storiesContainer.style.display = 'none';
                
                loadChat(doc.id);
            };
            listDiv.appendChild(div);
        });
    });
    
    const backBtn = document.getElementById('back-btn');
    if(backBtn) backBtn.onclick = () => window.location.reload();
}
