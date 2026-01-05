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

// אתחול Firebase
firebase.initializeApp(firebaseConfig);

// הפעלת שירותים - עכשיו זה יעבוד כי הוספנו את הסקריפט ב-HTML
const db = firebase.firestore();
const analytics = firebase.analytics(); // השורה הזו כבר לא תעשה שגיאה

console.log("Firebase Connected Successfully! ✅");

// ... המשך הקוד שלך נשאר אותו דבר ...
