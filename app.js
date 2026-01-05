// --- 1. הגדרות Firebase (תעתיק לכאן מהמסוף של Firebase) ---
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT.appspot.com",
    messagingSenderId: "...",
    appId: "..."
};

// אתחול
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// --- 2. זיהוי לקוח (Magic Link Logic) ---
const urlParams = new URLSearchParams(window.location.search);
let customerId = urlParams.get('cid'); // מחפש ?cid=12345 בלינק

if (customerId) {
    localStorage.setItem('saban_cid', customerId);
} else {
    customerId = localStorage.getItem('saban_cid');
}

if (!customerId) {
    // מצב אורח או הפניה לדף שגיאה
    console.log("לא נמצא מזהה לקוח");
    // אפשר לייצר מזהה זמני או לבקש התחברות
}

// --- 3. טעינת הודעות (Realtime) ---
const chatContainer = document.getElementById('chat-container');

if (customerId) {
    // מאזין להודעות ב-Firestore
    db.collection('orders').doc(customerId).collection('messages')
    .orderBy('timestamp', 'asc')
    .onSnapshot(snapshot => {
        chatContainer.innerHTML = '<div class="date-divider">ההזמנות שלך</div>';
        snapshot.forEach(doc => {
            renderMessage(doc.data());
        });
        // גלילה למטה
        chatContainer.scrollTop = chatContainer.scrollHeight;
    });
}

function renderMessage(msg) {
    const div = document.createElement('div');
    // אם ההודעה מהלקוח -> sent, אם מהמערכת -> received
    const typeClass = msg.sender === 'customer' ? 'sent' : 'received';
    
    div.className = `message ${typeClass}`;
    div.innerHTML = `
        ${msg.text}
        <div class="msg-meta">${new Date(msg.timestamp?.toDate()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
    `;
    chatContainer.appendChild(div);
}

// --- 4. שליחת הודעה ---
document.querySelector('.send-btn').addEventListener('click', sendMessage);

function sendMessage() {
    const input = document.getElementById('msg-input');
    const text = input.value;
    
    if (text.trim() && customerId) {
        db.collection('orders').doc(customerId).collection('messages').add({
            text: text,
            sender: 'customer',
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            read: false // סימן שלא נקרא ע"י המשרד
        });
        input.value = '';
    }
}
