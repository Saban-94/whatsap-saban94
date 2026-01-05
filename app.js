// --- 1. הגדרות Firebase (המפתחות שלך) ---
const firebaseConfig = {
  apiKey: "AIzaSyBGYsZylsIyeWudp8_SlnLBelkgoNXjU60",
  authDomain: "app-saban94-57361.firebaseapp.com",
  projectId: "app-saban94-57361",
  storageBucket: "app-saban94-57361.firebasestorage.app",
  messagingSenderId: "275366913167",
  appId: "1:275366913167:web:f0c6f808e12f2aeb58fcfa",
  measurementId: "G-E297QYKZKQ"
};

// אתחול Firebase (גרסת דפדפן)
firebase.initializeApp(firebaseConfig);

// הפעלת שירותים
const db = firebase.firestore();
const analytics = firebase.analytics();

console.log("Firebase Connected! ✅");

// --- 2. לוגיקת זיהוי לקוח (Magic Link) ---
// אנחנו מחפשים בכתובת ה-URL אם יש ?cid=12345
const urlParams = new URLSearchParams(window.location.search);
let customerId = urlParams.get('cid'); 

// אם מצאנו בלינק - נשמור בזיכרון של הטלפון
if (customerId) {
    localStorage.setItem('saban_cid', customerId);
    console.log("Customer ID identified:", customerId);
} else {
    // אם אין בלינק, נבדוק אם שמרנו פעם
    customerId = localStorage.getItem('saban_cid');
}

// --- 3. טעינת הודעות בזמן אמת (Realtime Chat) ---
const chatContainer = document.getElementById('chat-container');

if (customerId) {
    // האזנה להודעות בתוך: orders -> [מספר לקוח] -> messages
    db.collection('orders').doc(customerId).collection('messages')
    .orderBy('timestamp', 'asc') // מסדר לפי זמן (ישן לחדש)
    .onSnapshot((snapshot) => {
        // מנקים את המסך וטוענים מחדש כשמשהו משתנה
        chatContainer.innerHTML = '<div class="date-divider">ההזמנות והשיחות שלך</div>';
        
        if (snapshot.empty) {
            chatContainer.innerHTML += '<div style="text-align:center; color:#999; margin-top:20px;">אין עדיין הודעות. שלח הודעה כדי להתחיל!</div>';
        }

        snapshot.forEach(doc => {
            renderMessage(doc.data());
        });

        // גלילה אוטומטית למטה (להודעה הכי חדשה)
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }, (error) => {
        console.error("Error loading chat:", error);
        chatContainer.innerHTML = '<div style="color:red; text-align:center;">שגיאה בטעינת נתונים. וודא שהמסד קיים ב-Firebase.</div>';
    });
} else {
    // מצב אורח (אין מספר לקוח)
    chatContainer.innerHTML = '<div style="text-align:center; padding:20px;">ברוך הבא! <br> אנא היכנס דרך הקישור שקיבלת מהמשרד.</div>';
}

// פונקציה שמציירת בועת הודעה
function renderMessage(msg) {
    const div = document.createElement('div');
    // אם השולח הוא customer -> ירוק (שלי), אחרת -> לבן (משרד)
    const typeClass = msg.sender === 'customer' ? 'sent' : 'received';
    
    // המרת הזמן לשעה יפה
    let timeString = "";
    if (msg.timestamp) {
        timeString = new Date(msg.timestamp.toDate()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    }

    div.className = `message ${typeClass}`;
    div.innerHTML = `
        ${msg.text}
        <div class="msg-meta">${timeString}</div>
    `;
    chatContainer.appendChild(div);
}

// --- 4. שליחת הודעה ---
// מאזין ללחיצה על כפתור השליחה
const sendBtn = document.querySelector('.send-btn');
if(sendBtn) {
    sendBtn.addEventListener('click', sendMessage);
}

// מאזין ללחיצה על Enter במקלדת
const inputField = document.getElementById('msg-input');
if(inputField) {
    inputField.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
}

function sendMessage() {
    const text = inputField.value;
    
    // שולחים רק אם יש טקסט ויש לקוח מזוהה
    if (text.trim() && customerId) {
        db.collection('orders').doc(customerId).collection('messages').add({
            text: text,
            sender: 'customer', // מי שלח? הלקוח
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            read: false // סימן למשרד שההודעה חדשה
        })
        .then(() => {
            console.log("Message sent!");
            inputField.value = ''; // ניקוי השדה
        })
        .catch((error) => {
            console.error("Error sending message: ", error);
            alert("שגיאה בשליחה: " + error.message);
        });
    } else if (!customerId) {
        alert("חסר מזהה לקוח. לא ניתן לשלוח הודעה.");
    }
}
