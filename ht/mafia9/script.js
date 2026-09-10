// ============================================================
//  🎮 سیستم ورود به بازی - نسخه کامل با قابلیت‌های امنیتی
// ============================================================

var APP_UA_TOKEN = 'MafiaApp';
var PAGES = { game: 'Safe Asli Bazi.html', ban: 'Ban.html', off: 'off.html' };
var CREATOR_PHONE = '09904844031';
var tempPhone = null;
var generatedOtp = null;

var selectedAvatarSrc = "3000.webp";
var avatarList = ["3000.webp", "3001.webp", "3002.webp", "3003.webp"];

var isRedirecting = false;
var appVerified = true;
var audioUnlocked = false;

// اطلاعات دستگاه کاربر
var currentDeviceId = null;
var currentIP = null;

// ============================================================
//  🌐 اتصال به Redis
// ============================================================
var UPSTASH_OLD_URL = "https://smooth-werewolf-200782.upstash.io";
var UPSTASH_OLD_TOKEN = "gQAAAAAAAxBOAAIgcDFjN2NiMjYxOWNlNjE0NzgyOTExM2JjMjA5ZTc0MjVjMA";
var UPSTASH_NEW_URL = "https://holy-hamster-122717.upstash.io";
var UPSTASH_NEW_TOKEN = "gQAAAAAAAd9dAAIgcDFlNmYwM2VkZDJiM2Y0YWI2ODBmNmIyMTZjMmRkMTZmNg";

async function upstashGet(url, token, k) {
  try {
    var controller = new AbortController();
    var timeout = setTimeout(function() { controller.abort(); }, 5000);
    var response = await fetch(url + '/get/' + encodeURIComponent(k), { headers: { 'Authorization': 'Bearer ' + token }, signal: controller.signal });
    clearTimeout(timeout);
    if (!response.ok) return null;
    var data = await response.json();
    if (data && data.result) { try { return JSON.parse(data.result); } catch (e) { return data.result; } }
    return null;
  } catch (e) { return null; }
}

async function upstashSet(url, token, k, v) {
  try {
    var jsonValue = JSON.stringify(v);
    var controller = new AbortController();
    var timeout = setTimeout(function() { controller.abort(); }, 5000);
    var response = await fetch(url + '/set/' + encodeURIComponent(k) + '/' + encodeURIComponent(jsonValue), { headers: { 'Authorization': 'Bearer ' + token }, signal: controller.signal });
    clearTimeout(timeout);
    return response.ok;
  } catch (e) { return false; }
}

async function upstashDel(url, token, k) {
  try {
    var controller = new AbortController();
    var timeout = setTimeout(function() { controller.abort(); }, 5000);
    var response = await fetch(url + '/del/' + encodeURIComponent(k), { method: 'POST', headers: { 'Authorization': 'Bearer ' + token }, signal: controller.signal });
    clearTimeout(timeout);
    return response.ok;
  } catch (e) { return false; }
}

async function redisGet(key) {
  if (!appVerified) return null;
  var v1 = await upstashGet(UPSTASH_OLD_URL, UPSTASH_OLD_TOKEN, key);
  if (v1 !== null) return v1;
  return await upstashGet(UPSTASH_NEW_URL, UPSTASH_NEW_TOKEN, key);
}

async function redisSet(key, value) {
  if (!appVerified) return false;
  var p1 = upstashSet(UPSTASH_OLD_URL, UPSTASH_OLD_TOKEN, key, value);
  var p2 = upstashSet(UPSTASH_NEW_URL, UPSTASH_NEW_TOKEN, key, value);
  var results = await Promise.allSettled([p1, p2]);
  return results.some(function(r) { return r.status === 'fulfilled' && r.value === true; });
}

async function redisDel(key) {
  if (!appVerified) return false;
  await Promise.allSettled([
    upstashDel(UPSTASH_OLD_URL, UPSTASH_OLD_TOKEN, key),
    upstashDel(UPSTASH_NEW_URL, UPSTASH_NEW_TOKEN, key)
  ]);
  return true;
}

// ============================================================
//  🔧 توابع پایه
// ============================================================
async function getUser(phone) { return await redisGet('user:' + phone); }
async function saveUser(phone, userData) { return await redisSet('user:' + phone, userData); }
async function getAllUsers() { return await redisGet('all_users') || {}; }
async function saveAllUsers(users) { return await redisSet('all_users', users); }
async function getMaintenance() { return await redisGet('server_maintenance'); }

// ============================================================
//  📱 سیستم شناسه دستگاه (Device ID)
// ============================================================
function getDeviceId() {
  var id = localStorage.getItem('__device_id__');
  if (!id) {
    // ساخت device_id منحصربفرد و پایدار
    var parts = [
      navigator.userAgent || 'ua',
      navigator.platform || 'plat',
      screen.width + 'x' + screen.height,
      screen.colorDepth || 24,
      navigator.language || 'fa',
      navigator.hardwareConcurrency || 4,
      new Date().getTimezoneOffset()
    ];
    var raw = parts.join('|');
    var hash = 0;
    for (var i = 0; i < raw.length; i++) {
      hash = ((hash << 5) - hash) + raw.charCodeAt(i);
      hash = hash & hash;
    }
    id = 'dev_' + Math.abs(hash) + '_' + Date.now().toString(36);
    localStorage.setItem('__device_id__', id);
  }
  return id;
}

// ============================================================
//  🌐 دریافت IP کاربر
// ============================================================
async function fetchUserIP() {
  try {
    var controller = new AbortController();
    var t = setTimeout(function() { controller.abort(); }, 4000);
    var res = await fetch('https://api.ipify.org?format=json', { signal: controller.signal });
    clearTimeout(t);
    var data = await res.json();
    return data.ip || null;
  } catch (e) {
    return null;
  }
}

// ============================================================
//  🚫 سیستم بن IP
// ============================================================
async function checkIPBan(ip) {
  if (!ip) return null;
  var ban = await redisGet('ip_ban:' + ip);
  if (ban && ban.isBanned) {
    if (ban.expiresAt && ban.duration !== 'permanent' && ban.duration !== 'دائمی') {
      if (new Date(ban.expiresAt).getTime() < Date.now()) return null;
    }
    return ban;
  }
  return null;
}

async function setIPBan(ip, banData) {
  return await redisSet('ip_ban:' + ip, banData);
}

async function removeIPBan(ip) {
  return await redisDel('ip_ban:' + ip);
}

// ============================================================
//  🚫 سیستم بن دستگاه
// ============================================================
async function checkDeviceBan(deviceId) {
  if (!deviceId) return null;
  var ban = await redisGet('device_ban:' + deviceId);
  if (ban && ban.isBanned) {
    if (ban.expiresAt && ban.duration !== 'permanent' && ban.duration !== 'دائمی') {
      if (new Date(ban.expiresAt).getTime() < Date.now()) return null;
    }
    return ban;
  }
  return null;
}

// ============================================================
//  📱 سیستم "یک اکانت در هر گوشی"
//  (هر دستگاه فقط به یک شماره موبایل قفل می‌شود)
// ============================================================
async function getPhoneForDevice(deviceId) {
  if (!deviceId) return null;
  return await redisGet('device_phone:' + deviceId);
}

async function lockDeviceToPhone(deviceId, phone) {
  if (!deviceId || !phone) return false;
  return await redisSet('device_phone:' + deviceId, { phone: phone, lockedAt: Date.now() });
}

async function unlockDevice(deviceId) {
  if (!deviceId) return false;
  return await redisDel('device_phone:' + deviceId);
}

// ============================================================
//  🚫 چک بن اکانت (شماره موبایل)
// ============================================================
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

// ============================================================
//  📜 ثبت تاریخچه ورودها
// ============================================================
async function logLoginSession(phone, ip, deviceId) {
  try {
    var user = await getUser(phone);
    if (!user) return;
    if (!user.loginHistory) user.loginHistory = [];
    user.loginHistory.push({
      time: Date.now(),
      ip: ip || 'unknown',
      device: deviceId || 'unknown',
      userAgent: navigator.userAgent || 'unknown'
    });
    // فقط 50 رکورد آخر
    if (user.loginHistory.length > 50) {
      user.loginHistory = user.loginHistory.slice(-50);
    }
    user.lastIP = ip;
    user.lastDevice = deviceId;
    user.lastLogin = Date.now();
    await saveUser(phone, user);

    var allUsers = await getAllUsers();
    allUsers[phone] = user;
    await saveAllUsers(allUsers);
  } catch (e) {}
}

// ============================================================
//  👤 اکانت‌های ویژه
// ============================================================
var SPECIAL_ACCOUNTS = {
  '09904844031': { password: 'Par1617230', name: 'سازنده بازی', age: 30, avatar: 'Mafia10.png', rank: 'سازنده', fullProfile: true, canAccessAdult: true, canAccessTeen: true, coins: 999, gems: 999 },
  '09942785343': { password: 'mmmmmm', name: 'یــزدگَــردِ ســوّم', age: 30, avatar: '100.jpg', rank: 'ناظر', fullProfile: true, canAccessAdult: true, canAccessTeen: false, coins: 3000, gems: 2000 }
};

// ============================================================
//  🔒 قفل ضد دیباگ
// ============================================================
function isInsideApp() {
  try {
    if (localStorage.getItem('__MAFIA_OK__') === '1') return true;
    if (window.__MAFIA_APP__ === true) return true;
    var ua = navigator.userAgent || '';
    if (APP_UA_TOKEN && ua.indexOf(APP_UA_TOKEN) !== -1) return true;
    if (navigator.standalone === true) return true;
    if (/; wv\)/.test(ua)) return true;
    if (ua.indexOf('WebView') !== -1) return true;
    if (window.Android !== undefined) return true;
    if (window.flutter_inappwebview !== undefined) return true;
    if (window.ReactNativeWebView !== undefined) return true;
    if (window.Capacitor !== undefined) return true;
    if (window.cordova !== undefined) return true;
    return false;
  } catch (e) { return false; }
}

function killApp() {
  appVerified = false;
  document.title = 'Access Denied';
  try { window.stop(); } catch (e) {}
  document.open();
  document.write('<!DOCTYPE html><html dir="rtl" lang="fa"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no"><title>خطا</title><style>*{margin:0;padding:0;box-sizing:border-box}html,body{width:100%;height:100%;overflow:hidden;background:#0a0f1e;font-family:"Vazirmatn",sans-serif;color:white;display:flex;align-items:center;justify-content:center;padding:20px}.box{max-width:420px;width:100%;background:rgba(244,67,54,0.1);border:2px solid #f44336;border-radius:28px;padding:30px 20px;text-align:center}.ico{font-size:56px;margin-bottom:14px}.title{color:#ff6b6b;font-size:22px;font-weight:900;margin-bottom:12px}.text{color:rgba(255,255,255,0.85);font-size:13px;line-height:2.1}</style></head><body><div class="box"><div class="ico">⛔</div><div class="title">دسترسی غیرمجاز</div><div class="text">اجرای بازی فقط از طریق اپلیکیشن رسمی امکان‌پذیر است.</div></div></body></html>');
  document.close();
}

function showServerDown() {
  document.open();
  document.write('<!DOCTYPE html><html dir="rtl" lang="fa"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no"><title>سرور قطع</title><style>*{margin:0;padding:0;box-sizing:border-box}html,body{width:100%;height:100%;overflow:hidden;background:#0a0f1e;font-family:"Vazirmatn",sans-serif;color:white;display:flex;align-items:center;justify-content:center;padding:20px}.box{max-width:420px;width:100%;background:rgba(231,76,60,0.1);border:2px solid #e74c3c;border-radius:28px;padding:30px 20px;text-align:center}.ico{font-size:72px;margin-bottom:18px}.title{color:#ff6b6b;font-size:24px;font-weight:900;margin-bottom:14px}.text{color:rgba(255,255,255,0.85);font-size:14px;line-height:2.2}</style></head><body><div class="box"><div class="ico">🔌</div><div class="title">سرور قطع است</div><div class="text">بازی موقتاً در دسترس نیست.<br>لطفاً بعداً مراجعه کنید.</div></div></body></html>');
  document.close();
}

// 🆕 صفحه خطای بن IP
function showIPBan(ban) {
  document.open();
  var reason = (ban && ban.reason) ? ban.reason : 'تخلف از قوانین بازی';
  document.write('<!DOCTYPE html><html dir="rtl" lang="fa"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no"><title>مسدود</title><style>*{margin:0;padding:0;box-sizing:border-box}html,body{width:100%;height:100%;overflow:hidden;background:#0a0f1e;font-family:"Vazirmatn",sans-serif;color:white;display:flex;align-items:center;justify-content:center;padding:20px}.box{max-width:420px;width:100%;background:rgba(244,67,54,0.15);border:2px solid #f44336;border-radius:28px;padding:30px 20px;text-align:center;box-shadow:0 0 30px rgba(244,67,54,0.4)}.ico{font-size:60px;margin-bottom:14px}.title{color:#ff5252;font-size:22px;font-weight:900;margin-bottom:12px}.text{color:rgba(255,255,255,0.9);font-size:13px;line-height:2.1;margin-bottom:10px}.reason{color:#ffb74d;font-size:13px;font-weight:700;margin-top:10px}</style></head><body><div class="box"><div class="ico">🚫</div><div class="title">دسترسی IP شما مسدود است</div><div class="text">این IP به دلیل تخلف از قوانین بازی مسدود شده است.<br>با هر شماره موبایلی هم وارد شوید، بازی باز نمی‌شود.</div><div class="reason">دلیل: ' + reason + '</div></div></body></html>');
  document.close();
}

// 🆕 صفحه خطای یک اکانت در گوشی
function showDeviceLock(lockedPhone) {
  document.open();
  document.write('<!DOCTYPE html><html dir="rtl" lang="fa"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no"><title>قفل</title><style>*{margin:0;padding:0;box-sizing:border-box}html,body{width:100%;height:100%;overflow:hidden;background:#0a0f1e;font-family:"Vazirmatn",sans-serif;color:white;display:flex;align-items:center;justify-content:center;padding:20px}.box{max-width:420px;width:100%;background:rgba(255,152,0,0.12);border:2px solid #ff9800;border-radius:28px;padding:30px 20px;text-align:center;box-shadow:0 0 30px rgba(255,152,0,0.35)}.ico{font-size:60px;margin-bottom:14px}.title{color:#ffb74d;font-size:22px;font-weight:900;margin-bottom:12px}.text{color:rgba(255,255,255,0.9);font-size:13px;line-height:2.1}.hint{color:#4fc3f7;font-size:12px;margin-top:12px;direction:ltr}</style></head><body><div class="box"><div class="ico">📱</div><div class="title">این گوشی قبلاً ثبت‌نام کرده است</div><div class="text">شما قبلاً با شماره دیگری در این گوشی ثبت‌نام کرده‌اید.<br>هر گوشی فقط یک اکانت می‌تواند داشته باشد.</div><div class="hint">Registered: ' + (lockedPhone || '****') + '</div></div></body></html>');
  document.close();
}

function lockInspect() {
  document.addEventListener('contextmenu', function(e) { e.preventDefault(); return false; });
  document.addEventListener('keydown', function(e) {
    if (e.key === 'F12' || e.keyCode === 123) { e.preventDefault(); killApp(); return false; }
    if (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j' || e.key === 'C' || e.key === 'c')) { e.preventDefault(); killApp(); return false; }
    if (e.ctrlKey && (e.key === 'U' || e.key === 'u' || e.key === 'S' || e.key === 's' || e.key === 'P' || e.key === 'p')) { e.preventDefault(); killApp(); return false; }
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
}

// ============================================================
//  🔔 اعلان
// ============================================================
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
  var params = new URLSearchParams({ phone: phone, by: banData.bannedBy || 'مدیریت', reason: banData.reason || 'بدون دلیل', duration: banData.duration || 'permanent', expires: banData.expiresAt || '', createdAt: banData.createdAt || banData.bannedAt || '' });
  window.location.href = PAGES.ban + '?' + params.toString();
}

// ============================================================
//  🚦 چک کامل قبل از ثبت‌نام/ورود
//  تمام بن‌های سیستمی رو یکجا چک می‌کند
// ============================================================
async function performSecurityChecks(phone) {
  // 1) دریافت IP و deviceId
  currentIP = await fetchUserIP();
  currentDeviceId = getDeviceId();

  // 2) چک بن IP
  if (currentIP) {
    var ipBan = await checkIPBan(currentIP);
    if (ipBan) {
      showIPBan(ipBan);
      return { blocked: true, reason: 'ip_ban' };
    }
  }

  // 3) چک بن دستگاه
  var deviceBan = await checkDeviceBan(currentDeviceId);
  if (deviceBan) {
    showIPBan(deviceBan); // استفاده از همون صفحه
    return { blocked: true, reason: 'device_ban' };
  }

  // 4) چک بن اکانت
  if (phone) {
    var accountBan = await getBanStatus(phone);
    if (accountBan) {
      redirectToBan(accountBan, phone);
      return { blocked: true, reason: 'account_ban' };
    }
  }

  return { blocked: false };
}

// ============================================================
//  👤 پیدا کردن کاربر
// ============================================================
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
    if (!allUsers[phone]) { allUsers[phone] = special; await saveAllUsers(allUsers); }
    return special;
  }
  var user = await getUser(phone);
  if (user && user.fullProfile) {
    var allUsers = await getAllUsers();
    if (!allUsers[phone]) { allUsers[phone] = user; await saveAllUsers(allUsers); }
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
      }
    } catch (e) {}
  }
  await saveAllUsers(allUsers);
}

function showPage(pageId) {
  var pages = document.querySelectorAll('.page');
  for (var i = 0; i < pages.length; i++) pages[i].classList.add('hidden');
  var target = document.getElementById(pageId);
  if (target) target.classList.remove('hidden');
}

// ============================================================
//  🎯 هدایت به صفحه اصلی
// ============================================================
async function redirectToMainPage(userPhone) {
  if (!appVerified) { killApp(); return; }
  if (isRedirecting) return;

  // سازنده معاف از چک سرور
  if (userPhone !== CREATOR_PHONE) {
    try {
      var m = await getMaintenance();
      if (m && m.on) { showServerDown(); return; }
    } catch (e) {}
  }

  isRedirecting = true;
  try {
    var ban = await getBanStatus(userPhone);
    if (ban) { redirectToBan(ban, userPhone); return; }
  } catch (e) {}
  if (!navigator.onLine) { redirectToOffline(); return; }

  // ثبت سشن ورود
  try {
    await logLoginSession(userPhone, currentIP, currentDeviceId);
  } catch (e) {}

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

// ============================================================
//  🔊 صدا
// ============================================================
function unlockAudio() {
  if (!audioUnlocked) {
    var bgMusic = document.getElementById('bgMusic');
    if (bgMusic) {
      bgMusic.volume = 0.3;
      bgMusic.play().catch(function(e) {});
    }
    audioUnlocked = true;
  }
}

function playClickSound() {
  try {
    var clickSound = document.getElementById('clickSound');
    if (clickSound) {
      clickSound.currentTime = 0;
      clickSound.play().catch(function(e) {});
    }
    unlockAudio();
  } catch (e) {}
}

// ============================================================
//  🎛️ بایند کردن رویدادها
// ============================================================
function bindEvents() {
  var checkPhoneBtn = document.getElementById('checkPhoneBtn');
  var verifyOtpBtn = document.getElementById('verifyOtpBtn');
  var resendOtpBtn = document.getElementById('resendOtpBtn');
  var loginBtn = document.getElementById('loginBtn');
  var forgotPassBtn = document.getElementById('forgotPassBtn');
  var submitProfileBtn = document.getElementById('submitProfileBtn');

  // 🚦 دکمه ادامه (شماره رو چک کن)
  if (checkPhoneBtn) checkPhoneBtn.addEventListener('click', async function() {
    playClickSound();
    if (!appVerified) { killApp(); return; }
    if (!navigator.onLine) { redirectToOffline(); return; }

    var phone = document.getElementById('phoneInput').value.trim();
    var phoneError = document.getElementById('phoneError');
    if (!phone || phone.length < 10) { phoneError.innerText = 'شماره موبایل معتبر وارد کنید'; return; }
    phoneError.innerText = '';

    checkPhoneBtn.disabled = true;
    checkPhoneBtn.innerText = '...';

    // 🚦 چک‌های امنیتی قبل از هر چیز
    var checks = await performSecurityChecks(phone);
    if (checks.blocked) {
      checkPhoneBtn.disabled = false;
      checkPhoneBtn.innerText = 'ادامه';
      return;
    }

    // چک سرور (سازنده معاف)
    if (phone !== CREATOR_PHONE) {
      try {
        var m = await getMaintenance();
        if (m && m.on) { showServerDown(); return; }
      } catch (e) {}
    }

    tempPhone = phone;
    var user = await findUser(phone);

    checkPhoneBtn.disabled = false;
    checkPhoneBtn.innerText = 'ادامه';

    if (user && user.fullProfile === true) {
      // کاربر موجود -> رمز می‌خوایم
      document.getElementById('stepPhone').style.display = 'none';
      document.getElementById('stepOtp').style.display = 'none';
      document.getElementById('stepPassword').style.display = 'block';
      document.getElementById('passError').innerText = '';
    } else {
      // 🆕 کاربر جدید -> اول باید device_lock رو چک کنیم
      // یعنی این گوشی آیا قبلاً به یه شماره دیگه قفل شده؟
      var locked = await getPhoneForDevice(currentDeviceId);
      if (locked && locked.phone && locked.phone !== phone) {
        // این گوشی قبلاً با شماره دیگه ثبت‌نام کرده!
        showDeviceLock(locked.phone);
        return;
      }

      // کاربر جدید -> OTP
      generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
      showToast('کد تایید: ' + generatedOtp);
      document.getElementById('stepPhone').style.display = 'none';
      document.getElementById('stepPassword').style.display = 'none';
      document.getElementById('stepOtp').style.display = 'block';
      document.getElementById('otpError').innerText = '';
    }
  });

  // 🎫 تایید OTP
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

  // 🔑 ورود
  if (loginBtn) loginBtn.addEventListener('click', async function() {
    playClickSound();
    var pass = document.getElementById('passwordInput').value;
    loginBtn.disabled = true;
    loginBtn.innerText = '...';

    // 🚦 چک‌های امنیتی مجدد
    var checks = await performSecurityChecks(tempPhone);
    if (checks.blocked) {
      loginBtn.disabled = false;
      loginBtn.innerText = 'ورود';
      return;
    }

    var user = await findUser(tempPhone);
    loginBtn.disabled = false;
    loginBtn.innerText = 'ورود';

    if (user && user.password === pass) {
      // 🆕 مطمئن شو گوشی به این شماره قفله (یا قفلش کن)
      var locked = await getPhoneForDevice(currentDeviceId);
      if (!locked) {
        await lockDeviceToPhone(currentDeviceId, tempPhone);
      } else if (locked.phone !== tempPhone) {
        showDeviceLock(locked.phone);
        return;
      }
      await redirectToMainPage(tempPhone);
    } else {
      document.getElementById('passError').innerText = 'رمز عبور نادرست است';
    }
  });

  if (forgotPassBtn) forgotPassBtn.addEventListener('click', function() {
    playClickSound();
    showToast('از طریق پشتیبانی پیگیری کنید');
  });

  // آواتار
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

  // 📝 ثبت‌نام نهایی
  if (submitProfileBtn) submitProfileBtn.addEventListener('click', async function() {
    playClickSound();
    var gameName = document.getElementById('gameName').value.trim();
    var age = document.getElementById('age').value.trim();
    var newPass = document.getElementById('newPassword').value.trim();

    if (!gameName || !age || !newPass) { showToast('لطفاً نام، سن و رمز عبور را وارد کنید', 'error'); return; }
    if (isNaN(age) || age < 5 || age > 99) { showToast('سن بین ۵ تا ۹۹ وارد کنید', 'error'); return; }

    var phone = tempPhone;
    if (!phone) { showToast('خطا در شماره تلفن', 'error'); return; }

    // 🚦 چک نهایی امنیتی
    var checks = await performSecurityChecks(phone);
    if (checks.blocked) return;

    // 🚦 چک قفل گوشی مجدد
    var locked = await getPhoneForDevice(currentDeviceId);
    if (locked && locked.phone && locked.phone !== phone) {
      showDeviceLock(locked.phone);
      return;
    }

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
      gems: 10,
      registeredAt: Date.now(),
      registeredIP: currentIP,
      registeredDevice: currentDeviceId
    };

    submitProfileBtn.disabled = true;
    submitProfileBtn.innerText = '...';

    var saved = await saveUser(phone, userData);
    if (saved) {
      // 🆕 قفل دائمی گوشی به این شماره
      await lockDeviceToPhone(currentDeviceId, phone);

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

// ============================================================
//  🚀 شروع
// ============================================================
async function startBoot() {
  if (window.__BOOT_OK__) return;
  window.__BOOT_OK__ = true;
  if (!isInsideApp()) { killApp(); return; }

  // چک امنیتی اولیه
  try {
    currentIP = await fetchUserIP();
    currentDeviceId = getDeviceId();

    // چک بن IP
    if (currentIP) {
      var ipBan = await checkIPBan(currentIP);
      if (ipBan) { showIPBan(ipBan); return; }
    }
    // چک بن دستگاه
    var deviceBan = await checkDeviceBan(currentDeviceId);
    if (deviceBan) { showIPBan(deviceBan); return; }
  } catch (e) {}

  // چک تعمیرات سرور
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

        // 🚦 چک امنیتی برای ورود خودکار
        if (phone) {
          // چک بن IP
          if (currentIP) {
            var ipBan = await checkIPBan(currentIP);
            if (ipBan) { showIPBan(ipBan); return; }
          }
          // چک بن دستگاه
          var deviceBan2 = await checkDeviceBan(currentDeviceId);
          if (deviceBan2) { showIPBan(deviceBan2); return; }

          // چک بن اکانت
          if (phone !== CREATOR_PHONE) {
            var accBan = await getBanStatus(phone);
            if (accBan) { redirectToBan(accBan, phone); return; }

            var m2 = await getMaintenance();
            if (m2 && m2.on) { showServerDown(); return; }
          }
        }
      } catch (e) {}

      window.location.replace(PAGES.game);
    } else {
      var lp = document.getElementById('loadingPage');
      if (lp) lp.classList.add('hidden');
      var ap = document.getElementById('authPage');
      if (ap) ap.classList.remove('hidden');
      try {
        document.getElementById('stepPhone').style.display = 'block';
        document.getElementById('stepPassword').style.display = 'none';
        document.getElementById('stepOtp').style.display = 'none';
      } catch (e) {}
    }
  }, 3000);
}

lockInspect();
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startBoot);
} else {
  startBoot();
}