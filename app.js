<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>ח.סבן חומרי בנין</title>
    
    <link rel="icon" type="image/png" href="https://cdn-icons-png.flaticon.com/512/1041/1041883.png">
    
    <link rel="stylesheet" href="style.css">
    <link rel="manifest" href="manifest.json">
    <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">
    
    <script src="https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js" defer></script>
</head>
<body>

    <header class="app-header">
        <div class="user-info">
            <div class="avatar-container">
                <img src="https://cdn-icons-png.flaticon.com/512/1041/1041883.png" id="main-avatar" alt="avatar">
                <div class="online-badge"></div>
            </div>
            <div class="header-text">
                <span id="app-title">ח.סבן חומרי בנין</span>
                <span id="sub-title" class="status-text">מחובר כעת</span>
            </div>
        </div>
        <div class="actions">
            <i class="material-icons ripple" id="mute-btn">volume_up</i>
            <i class="material-icons ripple" id="back-btn" style="display:none;">arrow_forward</i>
        </div>
    </header>

    <div id="stories-container" class="stories-bar">
        </div>

    <div id="staff-dashboard" style="display:none; padding:10px;">
        <h3>ניהול הזמנות פעיל</h3>
        <div id="clients-list" class="chat-feed" style="background:none; padding:0;"></div>
    </div>

    <main id="chat-container" class="chat-feed">
        <div class="date-divider">היום</div>
    </main>

    <footer class="input-area" id="input-area">
        <button id="add-order-btn" class="fab-btn ripple">
            <i class="material-icons">add</i>
        </button>
        <div class="input-wrapper">
            <input type="text" placeholder="הקלד הודעה..." id="msg-input">
            <i class="material-icons" id="internal-msg-btn" style="display:none; color:#fbc02d; cursor:pointer; margin-left:5px;">lock</i>
            <button class="send-btn ripple"><i class="material-icons">send</i></button>
        </div>
    </footer>

    <div id="order-modal" class="modal-overlay" style="display:none;">
        <div class="modal-content">
            <div class="modal-header">
                <h3>הזמנה חדשה 📦</h3>
                <i class="material-icons ripple" id="close-modal-btn">close</i>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label>שם איש קשר</label>
                    <input type="text" id="order-contact" placeholder="שם המזמין בשטח">
                </div>
                
                <div class="form-group">
                    <label>כתובת / פרויקט</label>
                    <input type="text" id="order-address" placeholder="כתובת לאספקה">
                </div>

                <div class="form-group">
                    <label>פירוט הזמנה (מוצרים)</label>
                    <textarea id="order-item" rows="3" placeholder="למשל: 5 משטחי בלוקים 20, מלט..."></textarea>
                </div>
                
                <div class="form-group">
                    <label>דחיפות</label>
                    <select id="order-time">
                        <option value="דחוף להיום">דחוף להיום 🔥</option>
                        <option value="מחר בבוקר">מחר בבוקר ☀️</option>
                        <option value="שוטף">אספקה רגילה 🚛</option>
                    </select>
                </div>
                
                <button id="submit-order-btn" class="full-width-btn ripple">שלח הזמנה</button>
            </div>
        </div>
    </div>

    <script src="https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js"></script>
    <script src="https://www.gstatic.com/firebasejs/9.0.0/firebase-firestore-compat.js"></script>
    <script src="https://www.gstatic.com/firebasejs/9.0.0/firebase-analytics-compat.js"></script>
    
    <script src="app.js"></script>
</body>
</html>
