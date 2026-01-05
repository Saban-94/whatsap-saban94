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

// אתחול
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// --- 2. זיהוי משתמש (לקוח או צוות?) ---
const urlParams = new URLSearchParams(window.location.search);
let customerId = urlParams.get('cid'); 
let staffId = urlParams.get('sid');

const chatContainer = document.getElementById('chat-container');
const staffDashboard = document.getElementById('staff-dashboard');
const storiesContainer = document.getElementById('stories-container');
const appTitle = document.getElementById('app-title');
const backBtn = document.getElementById('back-btn');

// --- 3. OneSignal (התראות - מעודכן!) ---
window.OneSignalDeferred = window.OneSignalDeferred || [];
OneSignalDeferred.push(async function(OneSignal) {
    await OneSignal.init({
        appId: "546472ac-f9ab-4c6c-beb2-e41c72af9849", // <-- המזהה שלך
        safari_web_id: "web.onesignal.auto.195e7e66-9dea-4e11-b56c-b4a654da5ab7", // <-- המזהה שלך
        notifyButton: { enable: true },
    });
    
    // תיוג המשתמש כדי שנוכל לשלוח לו הודעות ספציפיות
    if (customerId) {
        console.log("Tagging user as Client");
        OneSignal.User.addTag("role", "client");
        OneSignal.User.addTag("cid", customerId);
    }
    if (staffId) {
        console.log("Tagging user as Staff");
        OneSignal.User.addTag("role", "staff");
    }
});

// --- 4. לוגיקה ראשית ---
if (staffId) {
    // === מצב צוות ===
    console.log("Staff Mode Active:", staffId);
    if(appTitle) appTitle.innerText = "שלום ראמי - ניהול סידור";
    
    if(storiesContainer) storiesContainer.style.display = 'none';
    if(chatContainer) chatContainer.style.display = 'none';
    const inputArea = document.querySelector('.input-area');
    if(inputArea) inputArea.style.display = 'none';
    
    if(staffDashboard) {
        staffDashboard.style.display = 'block';
        loadAllClients();
    }

} else if (customerId) {
    // === מצב לקוח ===
    console.log("Client Mode Active:", customerId);
    localStorage.setItem('saban_cid', customerId);
    loadChat(customerId);
} else {
    // === מצב אורח ===
    const savedCid = localStorage.getItem('saban_cid');
    if (savedCid) {
        // מונע לופ אינסופי של רענונים
        if (!window.location.search.includes('cid')) {
             window.location.href = `?cid=${savedCid}`;
        }
    } else {
        if(chatContainer) chatContainer.innerHTML = '<div style="text-align:center; padding:20px;">נא להיכנס דרך הקישור שהתקבל.</div>';
    }
}

// --- 5. פונקציות לצוות ---
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
            div.style.cssText = "background:white; padding:15px; margin-bottom:10px; border-radius:10px; cursor:pointer; display:flex; justify-content:space-between; align-items:center;";
            div.innerHTML = `
                <div>
                    <strong>${client.name || doc.id}</strong><br>
                    <small style="color:#666">${client.address || ''}</small>
                </div>
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
    const inputArea = document.querySelector('.input-area');
    if(inputArea) inputArea.style.display = 'flex';
    if(backBtn) backBtn.style.display = 'block';
    
    if(appTitle) appTitle.innerText = "שיחה עם: " + name;
    
    customerId = cid; 
    loadChat(cid);
    
    if(backBtn) {
        backBtn.onclick = () => {
             window.location.href = window.location.pathname + "?sid=" + staffId;
        };
    }
}

// --- 6. פונקציות צ'אט ---
function loadChat(cid) {
    if(!chatContainer) return;
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
    if(!chatContainer) return;
    const div = document.createElement('div');
    
    let isMe = false;
    if (staffId && msg.sender === 'staff') isMe = true;
    if (!staffId && msg.sender === 'customer') isMe = true;

    div.className = `message ${isMe ? 'sent' : 'received'}`;
    
    let time = msg.timestamp ? new Date(msg.timestamp.toDate()).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '..';
    
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
}
