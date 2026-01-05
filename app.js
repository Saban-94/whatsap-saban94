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

// --- 2. זיהוי משתמש (לקוח או צוות?) ---
const urlParams = new URLSearchParams(window.location.search);
let customerId = urlParams.get('cid'); // זיהוי לקוח (למשל 60123)
let staffId = urlParams.get('sid');    // זיהוי צוות (למשל driver_rami)

// אלמנטים במסך
const chatContainer = document.getElementById('chat-container');
const staffDashboard = document.getElementById('staff-dashboard');
const storiesContainer = document.getElementById('stories-container');
const appTitle = document.getElementById('app-title');
const backBtn = document.getElementById('back-btn');

// --- 3. OneSignal (התראות) ---
<script src="https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js" defer></script>
<script>
  window.OneSignalDeferred = window.OneSignalDeferred || [];
  OneSignalDeferred.push(async function(OneSignal) {
    await OneSignal.init({
      appId: "546472ac-f9ab-4c6c-beb2-e41c72af9849",
      safari_web_id: "web.onesignal.auto.195e7e66-9dea-4e11-b56c-b4a654da5ab7",
      notifyButton: {
        enable: true,
      },
    });
  });
</script>
    
    // רישום תגיות (Tags) לשליחת התראות ממוקדות
    if (customerId) OneSignal.User.addTag("role", "client");
    if (staffId) OneSignal.User.addTag("role", "staff");
});

// --- 4. לוגיקה ראשית ---

if (staffId) {
    // === מצב צוות (ראמי) ===
    console.log("Staff Mode Active:", staffId);
    appTitle.innerText = "שלום ראמי - ניהול סידור";
    
    // הסתרת אלמנטים של לקוח
    storiesContainer.style.display = 'none';
    chatContainer.style.display = 'none';
    document.querySelector('.input-area').style.display = 'none';
    
    // הצגת דשבורד
    staffDashboard.style.display = 'block';
    loadAllClients();

} else if (customerId) {
    // === מצב לקוח (בר אורן) ===
    console.log("Client Mode Active:", customerId);
    localStorage.setItem('saban_cid', customerId);
    loadChat(customerId); // טוען את הצ'אט הישיר
} else {
    // אורח - בדיקה בזיכרון
    const savedCid = localStorage.getItem('saban_cid');
    if (savedCid) {
        window.location.href = `?cid=${savedCid}`;
    } else {
        chatContainer.innerHTML = '<div style="text-align:center; padding:20px;">נא להיכנס דרך הקישור שהתקבל.</div>';
    }
}

// --- 5. פונקציות לצוות ---

function loadAllClients() {
    const listDiv = document.getElementById('clients-list');
    listDiv.innerHTML = '<div style="text-align:center">טוען לקוחות...</div>';

    // מביא את כל הלקוחות שיש להם הזמנות/הודעות
    db.collection('users').where('type', '==', 'client').get().then(snapshot => {
        listDiv.innerHTML = '';
        if (snapshot.empty) {
            listDiv.innerHTML = '<div>אין לקוחות רשומים</div>';
            return;
        }

        snapshot.forEach(doc => {
            const client = doc.data();
            const div = document.createElement('div');
            div.style.cssText = "background:white; padding:15px; margin-bottom:10px; border-radius:10px; cursor:pointer; display:flex; justify-content:space-between; align-items:center;";
            div.innerHTML = `
                <div>
                    <strong>${client.name || doc.id}</strong><br>
                    <small style="color:#666">${client.address || ''}</small>
                </div>
                <i class="material-icons" style="color:var(--primary-color)">chat</i>
            `;
            // בלחיצה - כנס לצ'אט עם הלקוח הזה
            div.onclick = () => enterStaffChat(doc.id, client.name);
            listDiv.appendChild(div);
        });
    });
}

function enterStaffChat(cid, name) {
    // מעבר למסך צ'אט בתוך מצב מנהל
    staffDashboard.style.display = 'none';
    chatContainer.style.display = 'block';
    document.querySelector('.input-area').style.display = 'flex';
    backBtn.style.display = 'block'; // כפתור חזרה לרשימה
    
    appTitle.innerText = "שיחה עם: " + name;
    
    // מגדיר את הלקוח הנוכחי שאליו אנחנו מגיבים
    customerId = cid; 
    
    // טוען הודעות
    loadChat(cid);
    
    // כפתור חזרה
    backBtn.onclick = () => {
        window.location.reload(); // הכי פשוט - רענן חזרה לרשימה
    };
}

// --- 6. פונקציות צ'אט (משותף לכולם) ---

function loadChat(cid) {
    // ניקוי מאזינים קודמים אם היו
    chatContainer.innerHTML = '<div class="date-divider">היום</div>';
    
    db.collection('orders').doc(cid).collection('messages')
    .orderBy('timestamp', 'asc')
    .onSnapshot(snapshot => {
        chatContainer.innerHTML = '<div class="date-divider">היום</div>';
        snapshot.forEach(doc => renderMessage(doc.data()));
        chatContainer.scrollTop = chatContainer.scrollHeight;
    });
}

function renderMessage(msg) {
    const div = document.createElement('div');
    // אם אני צוות: הודעות שלי (staff) בירוק, לקוח בלבן
    // אם אני לקוח: הודעות שלי (customer) בירוק, צוות בלבן
    
    let isMe = false;
    if (staffId && msg.sender === 'staff') isMe = true;
    if (!staffId && msg.sender === 'customer') isMe = true;

    div.className = `message ${isMe ? 'sent' : 'received'}`;
    
    let time = msg.timestamp ? new Date(msg.timestamp.toDate()).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '..';
    
    // הצגת שם השולח אם זה מהצוות
    let senderName = "";
    if (msg.sender === 'staff' && !isMe) senderName = `<div style="font-size:0.7em; color:var(--primary-color); font-weight:bold;">נציג שירות</div>`;

    div.innerHTML = `
        ${senderName}
        ${msg.text}
        <div class="msg-meta">${time}</div>
    `;
    chatContainer.appendChild(div);
}

// --- 7. שליחת הודעה ---
document.querySelector('.send-btn').addEventListener('click', sendMessage);
document.getElementById('msg-input').addEventListener('keypress', (e) => { if(e.key==='Enter') sendMessage() });

function sendMessage() {
    const input = document.getElementById('msg-input');
    const text = input.value.trim();
    
    if (!text || !customerId) return;

    // קביעת זהות השולח
    const senderType = staffId ? 'staff' : 'customer';

    db.collection('orders').doc(customerId).collection('messages').add({
        text: text,
        sender: senderType,
        staffId: staffId || null, // אם זה מנהל, נשמור מי זה
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        read: false
    });
    
    input.value = '';
}
