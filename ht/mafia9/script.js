var APP_UA_TOKEN = 'MafiaApp';
var PAGES = { game: 'Safe Asli Bazi.html', ban: 'Ban.html', off: 'off.html' };
var CREATOR_PHONE = '09904844031';
var tempPhone = null;
var generatedOtp = null;
var selectedAvatarSrc = "InShot_20260225_191621541.png";
// ✅ آواتارهای جدید اضافه شدند
var avatarList = [
  "Mafia1.png", 
  "Mafia2.png", 
  "Mafia18.png", 
  "Mafia17.png",
  "3000.webp",
  "3001.webp",
  "3002.webp",
  "3003.webp"
];
var isRedirecting = false;
var appVerified = true;

// ===== سیستم ۴ لایه Fallback =====
var UPSTASH_OLD_URL = "https://smooth-werewolf-200782.upstash.io";
var UPSTASH_OLD_TOKEN = "gQAAAAAAAxBOAAIgcDFjN2NiMjYxOWNlNjE0NzgyOTExM2JjMjA5ZTc0MjVjMA";
var UPSTASH_NEW_URL = "https://holy-hamster-122717.upstash.io";
var UPSTASH_NEW_TOKEN = "gQAAAAAAAd9dAAIgcDFlNmYwM2VkZDJiM2Y0YWI2ODBmNmIyMTZjMmRkMTZmNg";
var JSONBIN_KEY = "$2a$10$G8pgSWnFz4w/.voj3lfBPuJL7luRXAXiR/fIufC3YIB4.qRkZSjSS";
var JSONBIN_ID1 = "6a310a04da38895dfec86661";
var JSONBIN_ID2 = "6a53f4c8f5f4af5e298541fe";

// ===== توابع Upstash =====
async function upstashGet(url, token, k) {
  try {
    var controller = new AbortController();
    var timeout = setTimeout(function() { controller.abort(); }, 5000);
    var response = await fetch(url + '/get/' + encodeURIComponent(k), {
      headers: { 'Authorization': 'Bearer ' + token },
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (!response.ok) return null;
    var data = await response.json();
    if (data && data.result) {
      try { return JSON.parse(data.result); } catch (e) { return data.result; }
    }
    return null;
  } catch (e) { return null; }
}

async function upstashSet(url, token, k, v) {
  try {
    var jsonValue = JSON.stringify(v);
    var controller = new AbortController();
    var timeout = setTimeout(function() { controller.abort(); }, 5000);
    var response = await fetch(url + '/set/' + encodeURIComponent(k) + '/' + encodeURIComponent(jsonValue), {
      headers: { 'Authorization': 'Bearer ' + token },
      signal: controller.signal
    });
    clearTimeout(timeout);
    return response.ok;
  } catch (e) { return false; }
}

async function upstashDel(url, token, k) {
  try {
    var controller = new AbortController();
    var timeout = setTimeout(function() { controller.abort(); }, 5000);
    var response = await fetch(url + '/del/' + encodeURIComponent(k), {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token },
      signal: controller.signal
    });
    clearTimeout(timeout);
    return response.ok;
  } catch (e) { return false; }
}

// ===== توابع JSONBin =====
async function jsonbinRead(binId) {
  try {
    var controller = new AbortController();
    var timeout = setTimeout(function() { controller.abort(); }, 5000);
    var response = await fetch('https://api.jsonbin.io/v3/b/' + binId + '/latest', {
      headers: { 'X-Master-Key': JSONBIN_KEY },
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (!response.ok) return null;
    var data = await response.json();
    return data.record || {};
  } catch (e) { return null; }
}

async function jsonbinWrite(binId, data) {
  try {
    var controller = new AbortController();
    var timeout = setTimeout(function() { controller.abort(); }, 5000);
    var response = await fetch('https://api.jsonbin.io/v3/b/' + binId, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Master-Key': JSONBIN_KEY
      },
      body: JSON.stringify(data),
      signal: controller.signal
    });
    clearTimeout(timeout);
    return response.ok;
  } catch (e) { return false; }
}

// ===== تابع اصلی GET (۴ لایه) =====
async function redisGet(key) {
  if (!appVerified) return null;

  // . اول Upstash قدیمی
  var v1 = await upstashGet(UPSTASH_OLD_URL, UPSTASH_OLD_TOKEN, key);
  if (v1 !== null) return v1;

  // ۲. اگه قدیمی خالی/خطا → Upstash جدید
  var v2 = await upstashGet(UPSTASH_NEW_URL, UPSTASH_NEW_TOKEN, key);
  if (v2 !== null) return v2;

  // ۳. اگه اون هم نبود → JSONBin1
  var b1 = await jsonbinRead(JSONBIN_ID1);
  if (b1 && b1[key] !== undefined) return b1[key];

  // ۴. اگه اون هم نبود → JSONBin2
  var b2 = await jsonbinRead(JSONBIN_ID2);
  if (b2 && b2[key] !== undefined) return b2[key];

  return null;
}

// ===== تابع اصلی SET (۴ لایه) =====
async function redisSet(key, value) {
  if (!appVerified) return false;

  // همزمان به هر ۴ تا می‌نویسیم
  var p1 = upstashSet(UPSTASH_OLD_URL, UPSTASH_OLD_TOKEN, key, value);
  var p2 = upstashSet(UPSTASH_NEW_URL, UPSTASH_NEW_TOKEN, key, value);

  // برای JSONBin: باید کل JSON رو بخونیم، آپدیت کنیم، بنویسیم
  var p3 = (async function() {
    var b = await jsonbinRead(JSONBIN_ID1) || {};
    b[key] = value;
    return jsonbinWrite(JSONBIN_ID1, b);
  })();

  var p4 = (async function() {
    var b = await jsonbinRead(JSONBIN_ID2) || {};
    b[key] = value;
    return jsonbinWrite(JSONBIN_ID2, b);
  })();

  var results = await Promise.allSettled([p1, p2, p3, p4]);
  return results.some(function(r) { return r.status === 'fulfilled' && r.value === true; });
}

// ===== تابع اصلی DEL (۴ لایه) =====
async function redisDel(key) {
  if (!appVerified) return false;

  var p1 = upstashDel(UPSTASH_OLD_URL, UPSTASH_OLD_TOKEN, key);
  var p2 = upstashDel(UPSTASH_NEW_URL, UPSTASH_NEW_TOKEN, key);

  var p3 = (async function() {
    var b = await jsonbinRead(JSONBIN_ID1) || {};
    delete b[key];
    return jsonbinWrite(JSONBIN_ID1, b);
  })();

  var p4 = (async function() {
    var b = await jsonbinRead(JSONBIN_ID2) || {};
    delete b[key];
    return jsonbinWrite(JSONBIN_ID2, b);
  })();

  await Promise.allSettled([p1, p2, p3, p4]);
  return true;
}

// ===== بقیه کد بدون تغییر =====
async function getUser(phone) { return await redisGet('user:' + phone); }
async function saveUser(phone, userData) { return await redisSet('user:' + phone, userData); }
async function getAllUsers() { return await redisGet('all_users') || {}; }
async function saveAllUsers(users) { return await redisSet('all_users', users); }
async function getMaintenance() { return await redisGet('server_maintenance'); }

async function getBanStatus(phone) {
  var ban = await redisGet('ban:' + phone);
  if (ban && ban.isBanned) {
    if (ban.expiresAt && ban.duration !== 'permanent' && ban.duration !== 'دائمی') {
      if (new Date(ban.expiresAt).getTime() < Date.now()) return null;
    }
    return ban;
  }
  return null;
}

var SPECIAL_ACCOUNTS = {
  '09904844031': { password: 'Par1617230', name: 'سازنده بازی', age: 30, avatar: 'Mafia10.png', rank: 'سازنده', fullProfile: true, canAccessAdult: true, canAccessTeen: true, coins: 999, gems: 999 },
  '09904845012': { password: 'Mahdi1617230@', name: 'پشتیبانی ۱', age: 25, avatar: 'InShot_20260224_194133998.png', rank: 'پشتیبانی', fullProfile: true, canAccessAdult: true, canAccessTeen: true, coins: 500, gems: 50 },
  '09190882182': { password: 'Support@16172', name: 'پشتیبانی ۲', age: 28, avatar: 'InShot_20260224_194133998.png', rank: 'پشتیبانی', fullProfile: true, canAccessAdult: true, canAccessTeen: true, coins: 500, gems: 50 },
  '09123456788': { password: 'Admin16172-matin-1000', name: 'گرداننده', age: 30, avatar: 'InShot_20260225_191621541.png', rank: 'گرداننده', fullProfile: true, canAccessAdult: true, canAccessTeen: true, coins: 800, gems: 80 },
  '09123456789': { password: 'Admin16172-matin-1000', name: 'ادمین ارشد بزرگسالان', age: 30, avatar: 'InShot_20260225_191621541.png', rank: 'ادمین ارشد', fullProfile: true, canAccessAdult: true, canAccessTeen: false, coins: 700, gems: 70 },
  '09305075756': { password: 'Farzam1380', name: 'Farzam', age: 17, avatar: 'InShot_20260225_191621541.png', rank: 'ادمین ارشد', fullProfile: true, canAccessAdult: false, canAccessTeen: true, coins: 700, gems: 800 },
  '09123456781': { password: 'Admin16172-matin-1000', name: 'ناظر ارشد بزرگسالان', age: 30, avatar: 'InShot_20260225_191621541.png', rank: 'ناظر ارشد', fullProfile: true, canAccessAdult: true, canAccessTeen: false, coins: 600, gems: 60 },
  '09123456782': { password: 'Admin16172-matin-1000', name: 'ناظر ارشد نوجوانان', age: 16, avatar: 'InShot_20260225_191621541.png', rank: 'ناظر ارشد', fullProfile: true, canAccessAdult: false, canAccessTeen: true, coins: 600, gems: 60 },
  '09123456783': { password: 'Admin16172-matin-1000', name: 'ادمین بزرگسالان', age: 30, avatar: 'InShot_20260225_191621541.png', rank: 'ادمین', fullProfile: true, canAccessAdult: true, canAccessTeen: false, coins: 400, gems: 40 },
  '09936161483': { password: 'Abdollahi17', name: 'Abozar', age: 16, avatar: 'InShot_20260225_191621541.png', rank: 'ادمین', fullProfile: true, canAccessAdult: false, canAccessTeen: true, coins: 400, gems: 300 },
  '09942785343': { password: 'mmmmmm', name: 'یــزدگَــردِ ســوّم', age: 30, avatar: '100.jpg', rank: 'ناظر', fullProfile: true, canAccessAdult: true, canAccessTeen: false, coins: 3000, gems: 2000 },
  '09937119945': { password: 'ALI MASIH', name: 'MASIH', age: 16, avatar: 'InShot_20260225_191621541.png', rank: 'ناظر', fullProfile: true, canAccessAdult: false, canAccessTeen: true, coins: 300, gems: 400 }
};

function isInsideApp() {
  try {
    if (localStorage.getItem('__MAFIA_OK__') === '1') return true;
    if (window.__MAFIA_APP__ === true) return true;
    var ua = navigator.userAgent || '';
    if (APP_UA_TOKEN && ua.indexOf(APP_UA_TOKEN) !== -1) return true;
    var search = window.location.search || '';
    var hash = window.location.hash || '';
    if (search.indexOf('_mfa=1') !== -1 || search.indexOf('_mfa=true') !== -1) return true;
    if (hash.indexOf('mfa') !== -1) return true;
    if (window.matchMedia) {
      if (window.matchMedia('(display-mode: standalone)').matches) return true;
      if (window.matchMedia('(display-mode: fullscreen)').matches) return true;
    }
    if (navigator.standalone === true) return true;
    if (/; wv\)/.test(ua)) return true;
    if (ua.indexOf('WebView') !== -1) return true;
    if (window.Android !== undefined) return true;
    if (window.flutter_inappwebview !== undefined) return true;
    if (window.ReactNativeWebView !== undefined) return true;
    if (window.webkit && window.webkit.messageHandlers) return true;
    if (window.Capacitor !== undefined) return true;
    if (window.cordova !== undefined) return true;
    if (document.referrer && document.referrer.indexOf('android-app://') !== -1) return true;
    if (document.referrer && document.referrer.indexOf('ios-app://') !== -1) return true;
    return false;
  } catch (e) { return false; }
}

function killApp() {
  appVerified = false;
  document.title = 'Access Denied';
  try { window.stop(); } catch (e) {}
  document.open();
  document.write('<!DOCTYPE html><html dir="rtl" lang="fa"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no"><title>خطا</title><style>@import url("https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;700;900&display=swap");*{margin:0;padding:0;box-sizing:border-box}html,body{width:100%;height:100%;overflow:hidden;background:#0a0f1e;font-family:"Vazirmatn",Tahoma,sans-serif;color:white;display:flex;align-items:center;justify-content:center;padding:20px}.box{max-width:420px;width:100%;background:rgba(244,67,54,0.1);border:2px solid #f44336;border-radius:28px;padding:30px 20px;text-align:center;box-shadow:0 0 30px rgba(244,67,54,0.35)}.ico{font-size:56px;margin-bottom:14px}.title{color:#ff6b6b;font-size:22px;font-weight:900;margin-bottom:12px}.text{color:rgba(255,255,255,0.85);font-size:13px;line-height:2.1}.code{margin-top:14px;color:rgba(255,255,255,0.4);font-size:10px;direction:ltr}</style></head><body><div class="box"><div class="ico">⛔</div><div class="title">خطا! دسترسی غیرمجاز</div><div class="text">اجرای بازی فقط از طریق <b>اپلیکیشن رسمی</b> امکان‌پذیر است.<br>باز کردن لینک در مرورگر مجاز نیست و بازی اجرا نمی‌شود.<br>لطفاً بازی را داخل اپلیکیشن باز کنید.</div><div class="code">ERR_UNAUTHORIZED_CLIENT #403</div></div><script>setInterval(function(){try{debugger;}catch(e){}},100);<\/script></body></html>');
  document.close();
}

function showServerDown() {
  document.open();
  document.write('<!DOCTYPE html><html dir="rtl" lang="fa"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no"><title>سرور قطع</title><style>@import url("https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;700;900&display=swap");*{margin:0;padding:0;box-sizing:border-box}html,body{width:100%;height:100%;overflow:hidden;background:#0a0f1e;font-family:"Vazirmatn",Tahoma,sans-serif;color:white;display:flex;align-items:center;justify-content:center;padding:20px}.box{max-width:420px;width:100%;background:rgba(231,76,60,0.1);border:2px solid #e74c3c;border-radius:28px;padding:30px 20px;text-align:center;box-shadow:0 0 30px rgba(231,76,60,0.35)}.ico{font-size:72px;margin-bottom:18px}.title{color:#ff6b6b;font-size:24px;font-weight:900;margin-bottom:14px}.text{color:rgba(255,255,255,0.85);font-size:14px;line-height:2.2}</style></head><body><div class="box"><div class="ico">🔌</div><div class="title">سرور قطع است</div><div class="text">بازی موقتاً در دسترس نیست.<br>لطفاً بعداً مراجعه کنید.<br><br><span style="font-size:11px;color:rgba(255,255,255,0.4);">تیم توسعه در حال کار روی سرور است.</span></div></div></body></html>');
  document.close();
}

function lockInspect() {
  document.addEventListener('contextmenu', function(e) { e.preventDefault(); return false; });
  document.addEventListener('keydown', function(e) {
    if (e.key === 'F12' || e.keyCode === 123) { e.preventDefault(); killApp(); return false; }
    if (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j' || e.key === 'C' || e.key === 'c')) { e.preventDefault(); killApp(); return false; }
    if (e.ctrlKey && (e.key === 'U' || e.key === 'u' || e.key === 'S' || e.key === 's' || e.key === 'P' || e.key === 'p')) { e.preventDefault(); killApp(); return false; }
    if (e.metaKey && e.altKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j' || e.key === 'U' || e.key === 'u' || e.key === 'C' || e.key === 'c')) { e.preventDefault(); killApp(); return false; }
    if (e.ctrlKey && (e.key === '+' || e.key === '-' || e.key === '0')) { e.preventDefault(); }
  });
  document.addEventListener('dragstart', function(e) { e.preventDefault(); });
  document.addEventListener('selectstart', function(e) { if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') e.preventDefault(); });
  document.addEventListener('copy', function(e) { if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') e.preventDefault(); });
  document.addEventListener('cut', function(e) { if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') e.preventDefault(); });
  document.addEventListener('paste', function(e) { if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') e.preventDefault(); });
  document.addEventListener('gesturestart', function(e) { e.preventDefault(); });
  document.addEventListener('gesturechange', function(e) { e.preventDefault(); });
  document.addEventListener('gestureend', function(e) { e.preventDefault(); });
  document.addEventListener('touchmove', function(e) { if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') e.preventDefault(); }, { passive: false });
  var lastTouchEnd = 0;
  document.addEventListener('touchend', function(e) {
    var now = Date.now();
    if (now - lastTouchEnd <= 300 && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') e.preventDefault();
    lastTouchEnd = now;
  }, false);
  setInterval(function() {
    if (!isInsideApp()) { killApp(); return; }
    try {
      var start = performance.now();
      debugger;
      var end = performance.now();
      if (end - start > 100) killApp();
    } catch (e) {}
  }, 800);
  var devtools = { isOpen: false };
  var threshold = 160;
  setInterval(function() {
    if (window.outerWidth - window.innerWidth > threshold || window.outerHeight - window.innerHeight > threshold) {
      if (!devtools.isOpen) { devtools.isOpen = true; killApp(); }
    } else { devtools.isOpen = false; }
  }, 400);
}

function showToast(message, type) {
  if (!appVerified) return;
  var t = document.getElementById('toast');
  if (!t) return;
  t.textContent = message;
  t.className = 'toast show' + (type === 'error' ? ' error' : '');
  setTimeout(function() { t.classList.remove('show'); }, 3000);
}

function redirectToOffline() {
  if (isRedirecting) return;
  isRedirecting = true;
  window.location.href = PAGES.off;
}

function redirectToBan(banData, phone) {
  if (isRedirecting) return;
  isRedirecting = true;
  var params = new URLSearchParams({
    phone: phone,
    by: banData.bannedBy || 'مدیریت',
    reason: banData.reason || 'بدون دلیل',
    duration: banData.duration || 'permanent',
    expires: banData.expiresAt || '',
    createdAt: banData.createdAt || banData.bannedAt || ''
  });
  window.location.href = PAGES.ban + '?' + params.toString();
}

async function initSpecialAccounts() {
  var keys = Object.keys(SPECIAL_ACCOUNTS);
  var allUsers = await getAllUsers();
  for (var k = 0; k < keys.length; k++) {
    var phone = keys[k];
    var data = SPECIAL_ACCOUNTS[phone];
    try {
      var existing = await getUser(phone);
      if (!existing) {
        await saveUser(phone, data);
        allUsers[phone] = data;
      } else if (phone === '09904844031') {
        existing.coins = 999;
        existing.gems = 999;
        await saveUser(phone, existing);
        allUsers[phone] = existing;
      } else {
        if (!allUsers[phone]) {
          allUsers[phone] = existing;
        }
      }
    } catch (e) {}
  }
  await saveAllUsers(allUsers);
}

function getLegacyUser(phone) {
  try {
    var legacyUsers = JSON.parse(localStorage.getItem('mafia_users') || '{}');
    return legacyUsers[phone] || null;
  } catch (e) { return null; }
}

async function findUser(phone) {
  if (SPECIAL_ACCOUNTS[phone]) {
    var special = JSON.parse(JSON.stringify(SPECIAL_ACCOUNTS[phone]));
    special.fullProfile = true;
    var allUsers = await getAllUsers();
    if (!allUsers[phone]) {
      allUsers[phone] = special;
      await saveAllUsers(allUsers);
    }
    return special;
  }
  var user = await getUser(phone);
  if (user && user.fullProfile) {
    var allUsers = await getAllUsers();
    if (!allUsers[phone]) {
      allUsers[phone] = user;
      await saveAllUsers(allUsers);
    }
    return user;
  }
  var legacyUser = getLegacyUser(phone);
  if (legacyUser && legacyUser.fullProfile) {
    await saveUser(phone, legacyUser);
    var allUsers = await getAllUsers();
    allUsers[phone] = legacyUser;
    await saveAllUsers(allUsers);
    return legacyUser;
  }
  return null;
}

function showPage(pageId) {
  var pages = document.querySelectorAll('.page');
  for (var i = 0; i < pages.length; i++) pages[i].classList.add('hidden');
  var target = document.getElementById(pageId);
  if (target) target.classList.remove('hidden');
}

async function redirectToMainPage(userPhone) {
  if (!appVerified) { killApp(); return; }
  if (isRedirecting) return;

  if (userPhone !== CREATOR_PHONE) {
    try {
      var m = await getMaintenance();
      if (m && m.on) {
        showServerDown();
        return;
      }
    } catch (e) {}
  }

  isRedirecting = true;
  try {
    var ban = await getBanStatus(userPhone);
    if (ban) { redirectToBan(ban, userPhone); return; }
  } catch (e) {}
  if (!navigator.onLine) { redirectToOffline(); return; }
  try {
    var user = await findUser(userPhone);
    if (user) {
      try {
        sessionStorage.setItem('currentUserPhone', userPhone);
        sessionStorage.setItem('currentUserRank', user.rank || 'کاربر');
        sessionStorage.setItem('currentUserName', user.name);
        sessionStorage.setItem('currentUserAvatar', user.avatar);
        sessionStorage.setItem('currentUserAge', user.age || 0);
        sessionStorage.setItem('canAccessAdult', user.canAccessAdult ? 'true' : 'false');
        sessionStorage.setItem('canAccessTeen', user.canAccessTeen ? 'true' : 'false');
        localStorage.setItem('currentLoggedInUser', JSON.stringify({ phone: userPhone, timestamp: Date.now(), name: user.name }));
      } catch (e) {}
    }
  } catch (e) {}
  window.location.href = PAGES.game;
  setTimeout(function(){ try { window.location.replace(PAGES.game); } catch (e) {} }, 500);
}

// ✅ سیستم پخش صدا
function playClickSound() {
  try {
    var clickSound = document.getElementById('clickSound');
    if (clickSound) {
      clickSound.currentTime = 0;
      clickSound.play().catch(function(e) { /* Ignore autoplay errors */ });
    }
  } catch (e) {}
}

function playBackgroundMusic() {
  try {
    var bgMusic = document.getElementById('bgMusic');
    if (bgMusic) {
      bgMusic.volume = 0.3; // Volume at 30%
      bgMusic.play().catch(function(e) { /* Ignore autoplay errors */ });
    }
  } catch (e) {}
}

function stopBackgroundMusic() {
  try {
    var bgMusic = document.getElementById('bgMusic');
    if (bgMusic) {
      bgMusic.pause();
      bgMusic.currentTime = 0;
    }
  } catch (e) {}
}

function bindEvents() {
  var checkPhoneBtn = document.getElementById('checkPhoneBtn');
  var verifyOtpBtn = document.getElementById('verifyOtpBtn');
  var resendOtpBtn = document.getElementById('resendOtpBtn');
  var loginBtn = document.getElementById('loginBtn');
  var forgotPassBtn = document.getElementById('forgotPassBtn');
  var submitProfileBtn = document.getElementById('submitProfileBtn');

  if (checkPhoneBtn) checkPhoneBtn.addEventListener('click', async function() {
    playClickSound();
    if (!appVerified) { killApp(); return; }
    if (!navigator.onLine) { redirectToOffline(); return; }

    var phone = document.getElementById('phoneInput').value.trim();
    if (phone !== CREATOR_PHONE) {
      try {
        var m = await getMaintenance();
        if (m && m.on) {
          showServerDown();
          return;
        }
      } catch (e) {}
    }

    var phoneError = document.getElementById('phoneError');
    if (!phone || phone.length < 10) { phoneError.innerText = 'شماره موبایل معتبر وارد کنید'; return; }
    phoneError.innerText = '';
    tempPhone = phone;
    checkPhoneBtn.disabled = true;
    checkPhoneBtn.innerText = '...';
    var user = await findUser(phone);
    checkPhoneBtn.disabled = false;
    checkPhoneBtn.innerText = 'ادامه';
    if (user && user.fullProfile === true) {
      document.getElementById('stepPhone').style.display = 'none';
      document.getElementById('stepOtp').style.display = 'none';
      document.getElementById('stepPassword').style.display = 'block';
      document.getElementById('passError').innerText = '';
    } else {
      generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
      showToast('کد تایید: ' + generatedOtp);
      document.getElementById('stepPhone').style.display = 'none';
      document.getElementById('stepPassword').style.display = 'none';
      document.getElementById('stepOtp').style.display = 'block';
      document.getElementById('otpError').innerText = '';
    }
  });

  if (verifyOtpBtn) verifyOtpBtn.addEventListener('click', function() {
    playClickSound();
    var enteredOtp = document.getElementById('otpInput').value.trim();
    if (enteredOtp === generatedOtp) {
      showPage('profilePage');
      document.getElementById('stepPhone').style.display = 'block';
      document.getElementById('stepOtp').style.display = 'none';
      document.getElementById('phoneInput').value = '';
      document.getElementById('otpInput').value = '';
    } else {
      document.getElementById('otpError').innerText = 'کد وارد شده اشتباه است';
    }
  });

  if (resendOtpBtn) resendOtpBtn.addEventListener('click', function() {
    playClickSound();
    generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
    showToast('کد جدید: ' + generatedOtp);
  });

  if (loginBtn) loginBtn.addEventListener('click', async function() {
    playClickSound();
    var pass = document.getElementById('passwordInput').value;
    loginBtn.disabled = true;
    loginBtn.innerText = '...';
    var user = await findUser(tempPhone);
    loginBtn.disabled = false;
    loginBtn.innerText = 'ورود';
    if (user && user.password === pass) {
      await redirectToMainPage(tempPhone);
    } else {
      document.getElementById('passError').innerText = 'رمز عبور نادرست است';
    }
  });

  if (forgotPassBtn) forgotPassBtn.addEventListener('click', function() {
    playClickSound();
    showToast('از طریق پشتیبانی پیگیری کنید');
  });

  var avatarCircle = document.getElementById('avatarCircle');
  var avatarMenu = document.createElement('div');
  avatarMenu.className = 'avatar-menu';
  avatarMenu.id = 'avatarMenu';
  document.body.appendChild(avatarMenu);
  var backdrop = document.getElementById('backdrop');

  for (var i = 0; i < avatarList.length; i++) {
    (function(src) {
      var option = document.createElement('div');
      option.className = 'avatar-option';
      var img = document.createElement('img');
      img.src = src;
      img.onerror = function() { img.style.backgroundColor = '#555'; };
      option.appendChild(img);
      option.addEventListener('click', function() {
        playClickSound();
        var opts = document.querySelectorAll('.avatar-option');
        for (var j = 0; j < opts.length; j++) opts[j].classList.remove('selected');
        option.classList.add('selected');
        selectedAvatarSrc = src;
        document.getElementById('selectedAvatarImg').src = src;
        avatarCircle.style.borderColor = '#2ecc71';
        closeAvatarMenu();
      });
      avatarMenu.appendChild(option);
    })(avatarList[i]);
  }

  function openAvatarMenu() { 
    playClickSound();
    avatarMenu.classList.add('open'); 
    backdrop.classList.add('show'); 
  }
  function closeAvatarMenu() { 
    avatarMenu.classList.remove('open'); 
    backdrop.classList.remove('show'); 
  }
  if (avatarCircle) avatarCircle.addEventListener('click', openAvatarMenu);
  if (backdrop) backdrop.addEventListener('click', closeAvatarMenu);

  if (submitProfileBtn) submitProfileBtn.addEventListener('click', async function() {
    playClickSound();
    var gameName = document.getElementById('gameName').value.trim();
    var age = document.getElementById('age').value.trim();
    var newPass = document.getElementById('newPassword').value.trim();
    if (!gameName || !age || !newPass) { showToast('لطفاً نام، سن و رمز عبور را وارد کنید', 'error'); return; }
    if (isNaN(age) || age < 5 || age > 99) { showToast('سن بین ۵ تا ۹۹ وارد کنید', 'error'); return; }
    var phone = tempPhone;
    if (!phone) { showToast('خطا در شماره تلفن', 'error'); return; }
    var ageNum = parseInt(age);
    var userData = {
      password: newPass,
      name: gameName,
      age: ageNum,
      avatar: selectedAvatarSrc,
      rank: 'کاربر',
      fullProfile: true,
      canAccessAdult: ageNum >= 18,
      canAccessTeen: ageNum < 18,
      coins: 200,
      gems: 10
    };
    submitProfileBtn.disabled = true;
    submitProfileBtn.innerText = '...';
    var saved = await saveUser(phone, userData);
    if (saved) {
      var allUsers = await getAllUsers();
      allUsers[phone] = userData;
      await saveAllUsers(allUsers);
      try {
        var legacyUsers = JSON.parse(localStorage.getItem('mafia_users') || '{}');
        legacyUsers[phone] = userData;
        localStorage.setItem('mafia_users', JSON.stringify(legacyUsers));
      } catch (e) {}
      await redirectToMainPage(phone);
    } else {
      showToast('خطا در ذخیره اطلاعات. دوباره تلاش کنید', 'error');
      submitProfileBtn.disabled = false;
      submitProfileBtn.innerText = 'تایید و ادامه';
    }
  });
}

async function startBoot() {
  if (window.__BOOT_OK__) return;
  window.__BOOT_OK__ = true;
  if (!isInsideApp()) { killApp(); return; }

  try {
    var m = await getMaintenance();
    if (m && m.on) {
      var loggedIn = null;
      try { loggedIn = JSON.parse(localStorage.getItem('currentLoggedInUser') || 'null'); } catch (e) {}
      var phone = loggedIn ? loggedIn.phone : null;
      if (phone !== CREATOR_PHONE) {
        showServerDown();
        return;
      }
    }
  } catch (e) {}

  await initSpecialAccounts();
  bindEvents();
  var selectedImg = document.getElementById('selectedAvatarImg');
  if (selectedImg) selectedImg.src = selectedAvatarSrc;
  var imgs = document.querySelectorAll('img');
  for (var i = 0; i < imgs.length; i++) {
    imgs[i].addEventListener('error', function() { this.style.display = 'none'; });
  }
  window.addEventListener('offline', function() { if (!isRedirecting) redirectToOffline(); });

  // ✅ لودینگ دقیقاً ۳ ثانیه و سپس رفتن به صفحه بعد بدون تاخیر
  setTimeout(async function() {
    var goMain = false;
    try { goMain = !!localStorage.getItem('currentLoggedInUser'); } catch (e) {}
    var loopGuard = 0;
    try { loopGuard = parseInt(sessionStorage.getItem('__lastMainJump') || '0', 10); } catch (e) {}
    var now = Date.now();
    if (goMain && (now - loopGuard) > 15000) {
      try { sessionStorage.setItem('__lastMainJump', String(now)); } catch (e) {}

      try {
        var loggedIn = JSON.parse(localStorage.getItem('currentLoggedInUser') || 'null');
        var phone = loggedIn ? loggedIn.phone : null;
        if (phone !== CREATOR_PHONE) {
          var m = await getMaintenance();
          if (m && m.on) {
            showServerDown();
            return;
          }
        }
      } catch (e) {}

      window.location.replace('Safe Asli Bazi.html');
    } else {
      var lp = document.getElementById('loadingPage');
      if (lp) lp.classList.add('hidden');
      var ap = document.getElementById('authPage');
      if (ap) {
        ap.classList.remove('hidden');
        // ✅ پخش موزیک پس‌زمینه بعد از لودینگ
        playBackgroundMusic();
      }
      try {
        document.getElementById('stepPhone').style.display = 'block';
        document.getElementById('stepPassword').style.display = 'none';
        document.getElementById('stepOtp').style.display = 'none';
      } catch (e) {}
    }
  }, 3000); // ✅ دقیقاً  ثانیه
}

lockInspect();
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startBoot);
} else {
  startBoot();
}