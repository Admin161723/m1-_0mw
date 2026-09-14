/* ============================================================ */
/*  Firebase فقط برای سیگنال‌های زنده                            */
/* ============================================================ */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { 
  getDatabase, 
  ref, 
  set, 
  push,
  onChildAdded,
  onValue,
  remove,
  serverTimestamp,
  query,
  limitToLast
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyCP75sEM4FFCZ2fB5N36Xu-b2Th9nnrLd8",
  authDomain: "mafiasu-681c7.firebaseapp.com",
  databaseURL: "https://mafiasu-681c7-default-rtdb.firebaseio.com",
  projectId: "mafiasu-681c7",
  storageBucket: "mafiasu-681c7.firebasestorage.app",
  messagingSenderId: "180192927804",
  appId: "1:180192927804:web:e0c501a0d20af3b6892339"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

/* ============================================================ */
/*  ارسال سیگنال (وقتی کسی چیزی تغییر می‌ده)                   */
/* ============================================================ */
async function sendSignal(channel, type, data = {}) {
  try {
    const signalsRef = ref(db, 'signals/' + channel);
    await push(signalsRef, {
      type: type,           // مثلاً: 'user_changed', 'group_changed', 'chat_message'
      data: data,
      from: window.currentPhone || 'unknown',
      time: Date.now()
    });
    console.log('📡 سیگنال ارسال شد:', channel, type);
    return true;
  } catch (e) {
    console.error('sendSignal error:', e);
    return false;
  }
}

/* ============================================================ */
/*  گوش دادن به سیگنال‌ها (آنلاین موندن)                        */
/* ============================================================ */
let signalCallbacks = {};

function subscribeToSignals(channel, callback) {
  try {
    const signalsRef = ref(db, 'signals/' + channel);
    // فقط آخرین ۱ سیگنال رو گوش بده
    const q = query(signalsRef, limitToLast(1));
    
    const unsubscribe = onChildAdded(q, (snapshot) => {
      const signal = snapshot.val();
      // از خودم نیومده باشه (تا infinite loop نشه)
      if (signal && signal.from !== window.currentPhone) {
        console.log('📻 سیگنال دریافت شد:', channel, signal.type);
        callback(signal);
      }
    });
    
    return unsubscribe;
  } catch (e) {
    console.error('subscribeToSignals error:', e);
    return () => {};
  }
}

/* ============================================================ */
/*  تمیز کردن سیگنال‌های قدیمی                                   */
/* ============================================================ */
async function clearOldSignals(channel) {
  try {
    const signalsRef = ref(db, 'signals/' + channel);
    await remove(signalsRef);
    return true;
  } catch (e) {
    return false;
  }
}

/* ============================================================ */
/*  اتصال به window                                              */
/* ============================================================ */
window.sendSignal = sendSignal;
window.subscribeToSignals = subscribeToSignals;
window.clearOldSignals = clearOldSignals;

console.log('✅ Firebase Realtime initialized');