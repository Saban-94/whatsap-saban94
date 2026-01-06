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

// אתחול בטוח של Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();

// --- 2. משתנים גלובליים ---
const urlParams = new URLSearchParams(window.location.search);
let customerId = urlParams.get('cid'); 
let staffId = urlParams.get('sid');
let allClientsData = [];
let currentChatId = null;
let isInternalMode = false;
let isMenuOpen = false;
let isInitialLoad = true;
let isMuted = false;

// סאונד
const notificationSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3');

// --- 3. OneSignal (התראות) ---
window.OneSignalDeferred = window.OneSignalDeferred || [];
OneSignalDeferred.push(async function(OneSignal) {
    await OneSignal.init({
        appId: "546472ac-f9ab-4c6c-beb2-e41c72af9849",
        safari_web_id: "web.onesignal.auto.195e7e66-9dea-4e11-b56c-b4a654da5ab7",
        notifyButton: { 
            enable: true, 
            position: 'bottom-left', 
            offset: { bottom: '90px', left: '15px' },
            colors: { 'circle.background': 'rgba(0,128,105,0.4)', 'circle.foreground': 'white' }
        }
    });
    if (customerId) OneSignal.User.addTag("role", "client");
    if (staffId) OneSignal.User.addTag("role", "staff");
});

// --- 4. אתחול ממשק (מחכה שהדף ייטען) ---
document.addEventListener("DOMContentLoaded", function() {
    
    // אלמנטים
    const elements = {
        chatContainer: document.getElementById('chat-container'),
        staffDashboard: document.getElementById('staff-dashboard'),
        storiesContainer: document.getElementById('stories-container'),
        adminControls: document.getElementById('admin-controls'),
        inputArea: document.getElementById('input-area'),
        fabMenu: document.getElementById('fab-menu'),
        muteBtn: document.getElementById('mute-btn'),
        refreshBtn: document.getElementById('refresh-btn'),
        backBtn: document.getElementById('back-btn'),
        headerTitle: document.getElementById('app-title'),
        headerSubtitle: document.getElementById('status-text'), // שים לב לשינוי ה-ID ב-HTML
        headerParticipants: document.getElementById('participants-bar'),
        headerAvatar: document.getElementById('header-avatar'),
        internalMsgBtn: document.getElementById('internal-msg-btn'),
        sendBtn: document.getElementById('send-btn'),
        msgInput: document.getElementById('msg-input'),
        mainFab: document.getElementById('main-fab')
    };

    // הגדרת כפתורים (עם בדיקה שהם קיימים)
    if(elements.muteBtn) {
        elements.muteBtn.onclick = function() {
            isMuted = !isMuted;
            this.innerText = isMuted ? 'volume_off' : 'volume_up';
        };
    }
    
    if(elements.refreshBtn) {
        elements.refreshBtn.onclick = () => window.location.reload();
    }

    // אינטראקציה ראשונית לשחרור סאונד
    document.addEventListener('click', () => { if(isInitialLoad) isInitialLoad = false; }, { once: true });

    // --- ניהול תצוגה לפי סוג משתמש ---
    if (staffId) {
        // === מנהל ===
        if(elements.headerAvatar) elements.headerAvatar.src = `https://ui-avatars.com/api/?name=${staffId}&background=random`;
        if(elements.headerTitle) elements.headerTitle.innerText = "ניהול סידור";
        if(elements.headerSubtitle) elements.headerSubtitle.innerText = staffId;
        
        elements.storiesContainer.style.display = 'none';
        elements.chatContainer.style.display = 'none';
        elements.adminControls.style.display = 'none';
        elements.inputArea.style.display = 'none';
        elements.staffDashboard.style.display = 'block';
        
        loadDashboardData(); // טעינת דשבורד
    } else if (customerId) {
        // === לקוח ===
        localStorage.setItem('saban_cid', customerId);
        if(elements.headerAvatar) elements.headerAvatar.src = `https://ui-avatars.com/api/?name=${customerId}&background=random`;
        if(elements.headerTitle) elements.headerTitle.innerText = "ח.סבן חומרי בנין";
        if(elements.headerSubtitle) elements.headerSubtitle.innerText = "הזמנה פעילה";
        
        elements.staffDashboard.style.display = 'none';
        
        loadFormCache();
        listenToStatus(customerId, elements);
        loadChat(customerId, elements);
    } else {
        // === אורח ===
        const saved = localStorage.getItem('saban_cid');
        if (saved && !window.location.search.includes('cid')) {
            window.location.href = `?cid=${saved}`;
        } else if(elements.chatContainer) {
            elements.chatContainer.innerHTML = '<div style="text-align:center; padding:20px;">נא להיכנס דרך לינק תקין</div>';
        }
    }

    // --- הגדרת כפתורי שליחה ---
    if(elements.sendBtn) elements.sendBtn.onclick = () => sendMessage(elements);
    if(elements.msgInput) elements.msgInput.onkeypress = (e) => { if(e.key==='Enter') sendMessage(elements); };
    
    if(elements.internalMsgBtn) {
        elements.internalMsgBtn.onclick = () => {
            isInternalMode = !isInternalMode;
            elements.internalMsgBtn.style.color = isInternalMode ? 'red' : '#fbc02d';
            elements.msgInput.placeholder = isInternalMode ? "הערה חסויה לצוות..." : "הקלד הודעה...";
        };
    }

    if(elements.mainFab) {
        elements.mainFab.onclick = () => {
            if(staffId && !currentChatId) {
                toggleMenu();
            } else {
                const modal = document.getElementById('order-modal');
                if(modal) modal.style.display = 'flex';
            }
        };
    }

    if(elements.backBtn) {
        elements.backBtn.onclick = () => {
            elements.chatContainer.style.display = 'none';
            elements.inputArea.style.display = 'none';
            elements.adminControls.style.display = 'none';
            elements.backBtn.style.display = 'none';
            elements.staffDashboard.style.display = 'block';
            
            if(elements.headerTitle) elements.headerTitle.innerText = "ניהול סידור";
            if(elements.headerSubtitle) elements.headerSubtitle.innerText = staffId;
            if(elements.headerParticipants) elements.headerParticipants.innerHTML = '';
            
            if (window.unsubscribeChat) window.unsubscribeChat();
            currentChatId = null;
        };
    }
});

// --- פונקציות לוגיקה (מחוץ ל-DOMContentLoaded) ---

function loadDashboardData() {
    db.collection('users').orderBy('lastUpdate', 'desc').onSnapshot(snapshot => {
        allClientsData = [];
        let active = 0, history = 0;
        const listDiv = document.getElementById('clients-list');
        if(!listDiv) return;
        listDiv.innerHTML = '';

        snapshot.forEach(doc => {
            const d = doc.data(); d.id = doc.id;
            if(d.type === 'client' || !d.type) { // תמיכה לאחור
                if (d.status === 4) history++; else active++;
                allClientsData.push(d);
            }
        });

        const statActive = document.getElementById('stat-active');
        const statHistory = document.getElementById('stat-history');
        if(statActive) statActive.innerText = active;
        if(statHistory) statHistory.innerText = history;
        
        renderClientList('active');
    });
}

window.filterDashboard = function(type) {
    const cards = document.querySelectorAll('.gate-card');
    cards.forEach(c => c.classList.remove('active-filter'));
    // בוחר את הכרטיס הנכון להדגשה
    const activeCard = type === 'active' ? cards[0] : cards[1];
    if(activeCard) activeCard.classList.add('active-filter');
    
    renderClientList(type);
};

function renderClientList(type) {
    const listDiv = document.getElementById('clients-list');
    if(!listDiv) return;
    listDiv.innerHTML = '';
    
    const filtered = allClientsData.filter(c => type === 'active' ? (!c.status || c.status < 4) : c.status === 4);

    if (filtered.length === 0) { 
        listDiv.innerHTML = '<div style="text-align:center; padding:20px; color:#999">אין נתונים להצגה</div>'; 
        return; 
    }

    filtered.forEach(client => {
        let tagsHtml = '';
        if(client.tags) {
            client.tags.forEach(tag => {
                let cls = 'tag-badge';
                if(tag==='urgent') { cls+=' tag-urgent'; tag='דחוף'; }
                if(tag==='crane') { cls+=' tag-crane'; tag='מנוף'; }
                tagsHtml += `<span class="${cls}">${tag}</span>`;
            });
        }

        const div = document.createElement('div');
        div.className = 'chat-list-item';
        div.innerHTML = `
            <img src="https://ui-avatars.com/api/?name=${client.name || client.id}&background=random&color=fff" class="chat-avatar">
            <div class="chat-info">
                <div class="chat-top-row">
                    <span class="chat-name">${client.name || client.id}</span>
                    <span class="chat-time">${client.lastUpdate ? new Date(client.lastUpdate.toDate()).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) : ''}</span>
                </div>
                <div class="chat-bottom-row">
                    <span class="chat-preview">${getStatusText(client.status)} • ${client.address || ''}</span>
                    <div class="tags-container">${tagsHtml}</div>
                </div>
            </div>
        `;
        div.onclick = () => openStaffChat(client);
        listDiv.appendChild(div);
    });
}

function openStaffChat(client) {
    currentChatId = client.id;
    
    // מעבר מסכים ידני
    document.getElementById('staff-dashboard').style.display = 'none';
    const chatContainer = document.getElementById('chat-container');
    chatContainer.style.display = 'block';
    document.getElementById('input-area').style.display = 'flex';
    document.getElementById('admin-controls').style.display = 'flex';
    document.getElementById('back-btn').style.display = 'block';
    
    // עדכון כותרת
    document.getElementById('app-title').innerText = client.name || client.id;
    const sub = document.getElementById('status-text');
    if(sub) sub.innerText = "בשיחה...";
    document.getElementById('header-avatar').src = `https://ui-avatars.com/api/?name=${client.name || client.id}&background=random`;
    
    // משתתפים
    const parts = document.getElementById('participants-bar');
    if(parts) parts.innerHTML = `<span class="participant-pill">מנהל</span><span class="participant-pill">לקוח</span>`;

    document.getElementById('internal-msg-btn').style.display = 'block';
    
    // טעינת צ'אט (שימוש ב-elements היה עדיף אבל כאן אנחנו בפונקציה חיצונית)
    loadChat(client.id, { chatContainer: chatContainer });
}

function getStatusText(s) {
    if(s==1) return '📥 התקבל';
    if(s==2) return '📦 בטיפול';
    if(s==3) return '🚚 בדרך';
    if(s==4) return '✅ סופקה';
    return 'חדש';
}

// --- 5. צ'אט וסטטוס ---
function listenToStatus(cid, els) {
    db.collection('users').doc(cid).onSnapshot(doc => {
        if(doc.exists) {
            const d = doc.data();
            renderProgress(d.status || 1, els);
            if(d.name && els.headerSubtitle) els.headerSubtitle.innerText = "שלום, " + d.name;
        }
    });
}

function renderProgress(step, els) {
    // אם לא העברנו els, ננסה למצוא לבד
    const container = els ? els.storiesContainer : document.getElementById('stories-container');
    if(!container) return;

    const fill = document.getElementById('progress-fill');
    const width = ((step - 1) / 3) * 100;
    if(fill) fill.style.width = width + "%";
    
    // נקה הכל חוץ מהפסים
    const track = container.querySelector('.progress-track');
    const fillBar = container.querySelector('.progress-fill');
    container.innerHTML = '';
    if(track) container.appendChild(track);
    if(fillBar) container.appendChild(fillBar);
    
    const steps = ['התקבלה', 'בטיפול', 'בדרך', 'סופקה'];
    steps.forEach((s, i) => {
        let cls = 'status-step';
        if(i+1 <= step) cls += ' active';
        if(i+1 < step) cls += ' completed';
        
        const div = document.createElement('div');
        div.className = cls;
        div.innerHTML = `
            <div class="status-circle">${i+1 < step ? '<i class="material-icons" style="font-size:16px">check</i>' : i+1}</div>
            <span class="status-label">${s}</span>
        `;
        container.appendChild(div);
    });
}

function loadChat(cid, els) {
    const container = els ? els.chatContainer : document.getElementById('chat-container');
    if(!container) return;

    if (window.unsubscribeChat) window.unsubscribeChat();
    window.unsubscribeChat = db.collection('orders').doc(cid).collection('messages')
    .orderBy('timestamp', 'asc').onSnapshot(snapshot => {
        snapshot.docChanges().forEach(change => {
            if (change.type === "added") {
                const msg = change.doc.data();
                renderMessage(msg, container);
                if (!isInitialLoad && !isMe(msg.sender) && !isMuted) notificationSound.play().catch(()=>{});
            }
        });
        isInitialLoad = false;
        container.scrollTop = container.scrollHeight;
    });
}

function renderMessage(msg, container) {
    if (!staffId && msg.type === 'internal') return;
    const div = document.createElement('div');
    const me = isMe(msg.sender);
    let cls = 'message';
    if (msg.type === 'internal') cls += ' internal';
    else if (msg.sender === 'system') cls += ' received'; 
    else if (me) cls += ' sent'; else cls += ' received';

    div.className = cls;
    
    // בדיקה שדות
    const title = msg.title ? `<b>${msg.title}</b><br>` : '';
    let content = msg.text || '';
    
    if (msg.type === 'internal') content = `🔒 <b>הערה פנימית:</b><br>${content}`;
    else content = title + content.replace(/\n/g, '<br>');

    let time = msg.timestamp ? new Date(msg.timestamp.toDate()).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '';
    div.innerHTML = `${content}<div class="msg-meta">${time}</div>`;
    container.appendChild(div);
}

// --- 6. שליחה ---
function sendMessage(els) {
    const input = els.msgInput;
    const text = input.value.trim();
    if (!text || (!customerId && !currentChatId)) return;
    
    const target = currentChatId || customerId;
    const type = (staffId && isInternalMode) ? 'internal' : 'regular';
    
    db.collection('orders').doc(target).collection('messages').add({
        text, sender: staffId?'staff':'customer', type, staffId: staffId||null, timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    input.value = '';
    
    if(isInternalMode && els.internalMsgBtn) els.internalMsgBtn.click(); // כיבוי
}

// סטטוס ותגים
window.updateStatus = function(val) {
    if(!currentChatId) return;
    db.collection('users').doc(currentChatId).set({ status: val, lastUpdate: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
    
    let txt = "";
    if(val==2) txt="ההזמנה בטיפול במחסן 📦";
    if(val==3) txt="ההזמנה יצאה אליך! 🚚";
    if(val==4) txt="ההזמנה נמסרה בהצלחה ✅";
    
    if(txt) {
        db.collection('orders').doc(currentChatId).collection('messages').add({
            text: txt, sender: 'system', type: 'regular', timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
    }
};

window.toggleTag = function(tag) {
    if(!currentChatId) return;
    // מערך פשוט (שמירה מלאה במקום union לפשטות)
    db.collection('users').doc(currentChatId).get().then(doc => {
        let tags = doc.data().tags || [];
        if(tags.includes(tag)) tags = tags.filter(t => t!==tag);
        else tags.push(tag);
        db.collection('users').doc(currentChatId).update({ tags: tags });
        alert('תגיות עודכנו');
    });
};

// --- 7. מודלים ותפריטים ---
function toggleMenu() {
    isMenuOpen = !isMenuOpen;
    const fabs = document.querySelectorAll('.mini-fab');
    const main = document.getElementById('main-fab');
    if(main) main.classList.toggle('rotate');
    fabs.forEach((fab, idx) => {
        if(isMenuOpen) setTimeout(() => fab.classList.add('show'), idx * 50);
        else fab.classList.remove('show');
    });
}

// טיפול בכפתורי המודל (יש לבדוק שהם קיימים)
const submitOrderBtn = document.getElementById('submit-order-btn');
if(submitOrderBtn) {
    submitOrderBtn.onclick = () => {
        const contact = document.getElementById('order-contact').value;
        const address = document.getElementById('order-address').value;
        const item = document.getElementById('order-item').value;
        const time = document.getElementById('order-time').value;
        if(!item) { alert("חסר פירוט"); return; }
        
        saveFormCache(contact, address);
        const txt = `👤 ${contact}\n📍 ${address}\n📦 ${item}\n⏰ ${time}`;
        
        db.collection('orders').doc(customerId).collection('messages').add({ 
            text: txt, title: "📦 הזמנה חדשה", sender: 'customer', isOrder: true, timestamp: firebase.firestore.FieldValue.serverTimestamp() 
        });
        
        db.collection('users').doc(customerId).set({ 
            status: 1, type: 'client', name: contact || "לקוח", address: address, lastUpdate: firebase.firestore.FieldValue.serverTimestamp() 
        }, { merge: true });

        document.getElementById('order-item').value = '';
        window.closeModal('order-modal');
    };
}

// ניהול משתמשים
window.openUserModal = function(role) {
    const modal = document.getElementById('user-modal');
    if(modal) modal.style.display = 'flex';
    document.getElementById('new-user-role').value = role;
    document.getElementById('user-modal-title').innerText = role==='client'?'לקוח חדש':'איש צוות חדש';
    if(isMenuOpen) toggleMenu();
};

const saveUserBtn = document.getElementById('save-user-btn');
if(saveUserBtn) {
    saveUserBtn.onclick = () => {
        const id = document.getElementById('new-user-id').value;
        const name = document.getElementById('new-user-name').value;
        const role = document.getElementById('new-user-role').value;
        
        if(!id) { alert('חובה להזין מזהה'); return; }
        
        db.collection('users').doc(id).set({
            name: name, type: role, created: firebase.firestore.FieldValue.serverTimestamp(), lastUpdate: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true }).then(() => {
            alert('נשמר בהצלחה!');
            window.closeModal('user-modal');
        });
    };
}

// כלים כלליים
window.closeModal = (id) => document.getElementById(id).style.display = 'none';
function isMe(role) { return (staffId && role === 'staff') || (!staffId && role === 'customer'); }
function saveFormCache(c, a) { if(c) localStorage.setItem('lc', c); if(a) localStorage.setItem('la', a); }
function loadFormCache() { 
    if(document.getElementById('order-contact')) document.getElementById('order-contact').value = localStorage.getItem('lc') || '';
    if(document.getElementById('order-address')) document.getElementById('order-address').value = localStorage.getItem('la') || '';
}
