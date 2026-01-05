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

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// --- 2. הגדרת סאונד (החלק החדש!) ---
// זה לינק לקובץ סאונד נעים. אם יש לך קובץ מקומי, שנה ל: new Audio('ding.mp3');
const notificationSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3');

// משתנה עזר כדי למנוע צלצולים בטעינה ראשונית של ההיסטוריה
let isInitialLoad = true;

// כפתור השתקה/הפעלה בראש המסך
const muteBtn = document.getElementById('mute-btn');
let isMuted = false;

if(muteBtn) {
    muteBtn.addEventListener('click', () => {
        isMuted = !isMuted;
        muteBtn.innerText = isMuted ? 'volume_off' : 'volume_up';
        // לחיצה ראשונה משחררת חסימות דפדפן על אודיו
        if(!isMuted) notificationSound.play().then(() => notificationSound.pause()).catch(() => {});
    });
}

// --- 3. זיהוי משתמש ---
const urlParams = new URLSearchParams(window.location.search);
let customerId = urlParams.get('cid'); 
let staffId = urlParams.get('sid');

const chatContainer = document.getElementById('chat-container');
const staffDashboard = document.getElementById('staff-dashboard');
const storiesContainer = document.getElementById('stories-container');
const appTitle = document.getElementById('app-title');
const backBtn = document.getElementById('back-btn');

// --- 4. OneSignal ---
window.OneSignalDeferred = window.OneSignalDeferred || [];
OneSignalDeferred.push(async function(OneSignal) {
    await OneSignal.init({
        appId: "546472ac-f9ab-4c6c-beb2-e41c72af9849",
        safari_web_id: "web.onesignal.auto.195e7e66-9dea-4e11-b56c-b4a654da5ab7",
        notifyButton: { enable: true },
    });
    
    if (customerId) OneSignal.User.addTag("role", "client");
    if (staffId) OneSignal.User.addTag("role", "staff");
});

// --- 5. לוגיקה ראשית ---
if (staffId) {
    // === מצב צוות ===
    if(appTitle) appTitle.innerText = "שלום ראמי - ניהול סידור";
    if(storiesContainer) storiesContainer.style.display = 'none';
    if(chatContainer) chatContainer.style.display = 'none';
    if(document.querySelector('.input-area')) document.querySelector('.input-area').style.display = 'none';
    
    if(staffDashboard) {
        staffDashboard.style.display = 'block';
        loadAllClients();
    }

} else if (customerId) {
    // === מצב לקוח ===
    localStorage.setItem('saban_cid', customerId);
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

// --- 6. פונקציות לצוות ---
function loadAllClients() {
    const listDiv = document.getElementById('clients-list');
    if(!listDiv) return;
    listDiv.innerHTML = '<div style="text-align:center">טוען לקוחות...</div>';

    db.collection('users').where('type', '==', 'client').get().then(snapshot => {
        listDiv.innerHTML = '';
        if (snapshot.empty) {
            listDiv.innerHTML = '<div>אין לקוחות רשומים</div>';
            return;
        }
        snapshot.forEach(doc => {
            const client = doc.data();
            const div = document.createElement('div');
            div.style.cssText = "background:white; padding:15px; margin-bottom:10px; border-radius:10px; cursor:pointer; display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #eee;";
            div.innerHTML = `
                <div><strong>${client.name || doc.id}</strong><br><small>${client.address || ''}</small></div>
                <i class="material-icons" style="color:var(--primary-color)">chat</i>
            `;
            div.onclick = () => enterStaffChat(doc.id, client.name);
            listDiv.appendChild(div);
        });
    });
}

function enterStaffChat(cid, name) {
    if(staffDashboard) staffDashboard.style.display = 'none';
    if(chatContainer) chatContainer.style.display = 'block';
    if(document.querySelector('.input-area')) document.querySelector('.input-area').style.display = 'flex';
    if(backBtn) backBtn.style.display = 'block';
    
    if(appTitle) appTitle.innerText = name;
    
    customerId = cid; // קריטי: מגדיר למי אנחנו שולחים עכשיו
    isInitialLoad = true; // איפוס כדי לא לצלצל על היסטוריה
    loadChat(cid);
    
    if(backBtn) backBtn.onclick = () => window.location.href = window.location.pathname + "?sid=" + staffId;
}

// --- 7. פונקציות צ'אט והשמעת צליל ---
function loadChat(cid) {
    if(!chatContainer) return;
    
    // ניקוי המאזין הקודם (אם היה) חשוב במעבר בין לקוחות
    if (window.unsubscribeChat) window.unsubscribeChat();

    window.unsubscribeChat = db.collection('orders').doc(cid).collection('messages')
    .orderBy('timestamp', 'asc')
    .onSnapshot(snapshot => {
        
        // מעבר על השינויים בלבד (הודעות חדשות)
        snapshot.docChanges().forEach(change => {
            if (change.type === "added") {
                const msg = change.doc.data();
                renderMessage(msg); // ציור ההודעה
                
                // בדיקת סאונד: אם זו לא טעינה ראשונית, וההודעה לא ממני -> צלצל!
                if (!isInitialLoad && !isMe(msg.sender)) {
                    playIncomingSound();
                }
            }
        });
        
        // אחרי שסיימנו לטעון את הנגלה הראשונה, מכבים את הדגל
        isInitialLoad = false;
        
        // גלילה למטה
        chatContainer.scrollTop = chatContainer.scrollHeight;
    });
}

// פונקציית עזר לבדוק "מי אני"
function isMe(senderRole) {
    if (staffId && senderRole === 'staff') return true;
    if (!staffId && senderRole === 'customer') return true;
    return false;
}

function playIncomingSound() {
    if (isMuted) return;
    
    // ניסיון לנגן. דפדפנים חוסמים אם המשתמש לא לחץ על כלום בדף קודם.
    notificationSound.currentTime = 0; // התחלה
    notificationSound.play().catch(error => {
        console.log("Sound blocked by browser policy (interact with page first):", error);
    });
}

function renderMessage(msg) {
    if(!chatContainer) return;
    const div = document.createElement('div');
    const me = isMe(msg.sender);

    div.className = `message ${me ? 'sent' : 'received'}`;
    
    let time = msg.timestamp ? new Date(msg.timestamp.toDate()).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '..';
    let senderName = (!me && msg.sender === 'staff') ? `<div style="font-size:0.7em; color:var(--primary-color); font-weight:bold;">נציג שירות</div>` : "";

    div.innerHTML = `${senderName}${msg.text}<div class="msg-meta">${time}</div>`;
    chatContainer.appendChild(div);
}

// --- 8. שליחה ---
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

    db.collection('orders').doc(customerId).collection('messages').add({
        text: text,
        sender: senderType,
        staffId: staffId || null,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        read: false
    });
    input.value = '';
    
    // טריק קטן לשחרור חסימת האודיו של הדפדפן (כי המשתמש ביצע פעולה)
    if(notificationSound) {
        notificationSound.play().then(() => {
            notificationSound.pause();
            notificationSound.currentTime = 0;
        }).catch(()=>{});
    }
}
