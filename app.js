// ... (השאר את כל הקוד הקודם שלך אותו דבר, רק תוסיף את זה בסוף) ...

// --- 9. לוגיקה לכפתור הפלוס (Modal Logic) ---

const modal = document.getElementById('order-modal');
const addBtn = document.getElementById('add-order-btn');
const closeBtn = document.getElementById('close-modal-btn');
const submitOrderBtn = document.getElementById('submit-order-btn');

// פתיחת המודל
if(addBtn) {
    addBtn.addEventListener('click', () => {
        if(modal) modal.style.display = 'flex';
    });
}

// סגירת המודל
if(closeBtn) {
    closeBtn.addEventListener('click', () => {
        if(modal) modal.style.display = 'none';
    });
}

// סגירה בלחיצה בחוץ
if(modal) {
    modal.addEventListener('click', (e) => {
        if(e.target === modal) modal.style.display = 'none';
    });
}

// שליחת ההזמנה
if(submitOrderBtn) {
    submitOrderBtn.addEventListener('click', () => {
        const item = document.getElementById('order-item').value;
        const notes = document.getElementById('order-notes').value;
        const time = document.getElementById('order-time').value;

        if(!item) {
            alert("נא למלא מה להזמין");
            return;
        }

        // עיצוב ההודעה שתשלח לצ'אט
        const orderText = `📦 *הזמנה חדשה*\n▫️ פריט: ${item}\n▫️ זמן: ${time}\n▫️ הערות: ${notes}`;
        
        // שימוש בפונקציה הקיימת לשליחת הודעה
        sendCustomMessage(orderText);

        // איפוס וסגירה
        document.getElementById('order-item').value = '';
        document.getElementById('order-notes').value = '';
        if(modal) modal.style.display = 'none';
    });
}

// פונקציית עזר לשליחת הודעה מוכנה (לא מהאינפוט הרגיל)
function sendCustomMessage(text) {
    if (!text || !customerId) return;
    
    const senderType = staffId ? 'staff' : 'customer';

    db.collection('orders').doc(customerId).collection('messages').add({
        text: text,
        sender: senderType,
        staffId: staffId || null,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        read: false,
        isOrder: true // סימון שזו הזמנה (אפשר להשתמש בזה לעיצוב שונה בעתיד)
    });
    
    // סאונד
    if(notificationSound) {
        notificationSound.play().then(() => {
            notificationSound.pause(); 
            notificationSound.currentTime = 0;
        }).catch(()=>{});
    }
}
