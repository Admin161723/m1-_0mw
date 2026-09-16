/* ============================================================ */
/*  script.js - با چک دوگانه سرور (Firebase + Redis)             */
/*  ✅ رفع کامل باگ پریدن به صفحه لاگین با وجود حساب کاربری      */
/* ============================================================ */

var PAGES = { game: 'Safe Asli Bazi.html', ban: 'Ban.html' };
var CREATOR_PHONE = '09904844031';
var tempPhone = null;
var generatedOtp = null;
var selectedAvatarSrc = "3000.webp";
var avatarList = ["3000.webp", "3001.webp", "3002.webp", "3003.webp"];
var isRedirecting = false;
var appVerified = true;
var audioUnlocked = false;
var currentDeviceId = null;
var currentIP = null;
var awayTimer = null;
var AWAY_TIMEOUT_MS = 10000;
var creatorPhoneCache = null;
var appCheckTimer = null;
var isUserAway = false;
var serverLocked = false;
var serverCheckInterval = null;

var UPSTASH_OLD_URL = "https://smooth-werewolf-200782.upstash.io";
var UPSTASH_OLD_TOKEN = "gQAAAAAAAxBOAAIgcDFjN2NiMjYxOWNlNjE0NzgyOTExM2JjMjA5ZTc0MjVjMA";
var UPSTASH_NEW_URL = "https://holy-hamster-122717.upstash.io";
var UPSTASH_NEW_TOKEN = "gQAAAAAAAd9dAAIgcDFlNmYwM2VkZDJiM2Y0YWI2ODBmNmIyMTZjMmRkMTZmNg";

var FB_CFG = {
  apiKey: "AIzaSyCP75sEM4FFCZ2fB5N36Xu-b2Th9nnrLd8",
  authDomain: "mafiasu-681c7.firebaseapp.com",
  databaseURL: "https://mafiasu-681c7-default-rtdb.firebaseio.com",
  projectId: "mafiasu-681c7",
  storageBucket: "mafiasu-681c7.firebasestorage.app",
  messagingSenderId: "180192927804",
  appId: "1:180192927804:web:e0c501a0d20af3b6892339"
};
var fbDb = null, fbReady = false;

function initFB() {
  try {
    if (typeof firebase === 'undefined') return false;
    if (!firebase.apps.length) firebase.initializeApp(FB_CFG);
    fbDb = firebase.database();
    fbReady = true;
    return true;
  } catch(e) { return false; }
}

/* ---------- Session Management (چند لایه برای جلوگیری از باگ) ---------- */
function getSession() {
  var candidates = ['currentLoggedInUser', '__session_backup__', '__session_backup2__'];
  for (var i = 0; i < candidates.length; i++) {
    try {
      var raw = localStorage.getItem(candidates[i]);
      if (raw) {
        var parsed = null;
        try { parsed = JSON.parse(raw); } catch(e) {}
        if (parsed && parsed.phone) {
          if (i !== 0) {
            try { localStorage.setItem('currentLoggedInUser', raw); } catch(e) {}
          }
          try {
            localStorage.setItem('__session_backup__', raw);
            localStorage.setItem('__session_backup2__', raw);
          } catch(e) {}
          return parsed;
        }
      }
    } catch(e) {}
  }
  try {
    var sRaw = sessionStorage.getItem('currentLoggedInUser');
    if (sRaw) {
      var sP = JSON.parse(sRaw);
      if (sP && sP.phone) {
        try { localStorage.setItem('currentLoggedInUser', sRaw); } catch(e) {}
        return sP;
      }
    }
  } catch(e) {}
  return null;
}

/* ---------- Redis ---------- */
async function upstashGet(url, token, k) {
  try {
    var c = new AbortController(); var t = setTimeout(function(){c.abort();}, 4000);
    var r = await fetch(url + '/get/' + encodeURIComponent(k), { headers: { 'Authorization': 'Bearer ' + token }, signal: c.signal, cache: 'no-store' });
    clearTimeout(t); if (!r.ok) return null;
    var d = await r.json();
    if (d && d.result) { try { return JSON.parse(d.result); } catch (e) { return d.result; } }
    return null;
  } catch (e) { return null; }
}
async function upstashSet(url, token, k, v) {
  try {
    var jv = JSON.stringify(v);
    var c = new AbortController(); var t = setTimeout(function(){c.abort();}, 4000);
    var r = await fetch(url + '/set/' + encodeURIComponent(k) + '/' + encodeURIComponent(jv), { headers: { 'Authorization': 'Bearer ' + token }, signal: c.signal });
    clearTimeout(t); return r.ok;
  } catch (e) { return false; }
}
async function upstashDel(url, token, k) {
  try {
    var c = new AbortController(); var t = setTimeout(function(){c.abort();}, 4000);
    var r = await fetch(url + '/del/' + encodeURIComponent(k), { method: 'POST', headers: { 'Authorization': 'Bearer ' + token }, signal: c.signal });
    clearTimeout(t); return r.ok;
  } catch (e) { return false; }
}
async function redisGet(key) {
  var v = await upstashGet(UPSTASH_OLD_URL, UPSTASH_OLD_TOKEN, key);
  if (v !== null) return v;
  return await upstashGet(UPSTASH_NEW_URL, UPSTASH_NEW_TOKEN, key);
}
async function redisSet(key, value) {
  var p1 = upstashSet(UPSTASH_OLD_URL, UPSTASH_OLD_TOKEN, key, value);
  var p2 = upstashSet(UPSTASH_NEW_URL, UPSTASH_NEW_TOKEN, key, value);
  var results = await Promise.allSettled([p1, p2]);
  return results.some(function(r){ return r.status === 'fulfilled' && r.value === true; });
}

async function getUser(p) { return await redisGet('user:' + p); }
async function saveUser(p, u) { return await redisSet('user:' + p, u); }
async function getAllUsers() { return await redisGet('all_users') || {}; }
async function saveAllUsers(u) { return await redisSet('all_users', u); }
async function getMaintenance() { return await redisGet('server_maintenance'); }

function isCreatorPhone(phone) { return String(phone || '') === CREATOR_PHONE; }

/* ═══════════════════════════════════════════════════════════ */
/*  ⚡ چک دوگانه سرور - خیلی مهم                                  */
/* ═══════════════════════════════════════════════════════════ */
async function isServerLocked() {
  if (fbReady && fbDb) {
    try {
      var result = await new Promise(function(resolve) {
        var done = false;
        var t = setTimeout(function() { if (!done) { done = true; resolve(null); } }, 2000);
        fbDb.ref('server_state/on').once('value').then(function(snap) {
          if (!done) { done = true; clearTimeout(t); resolve(snap.val() === true); }
        }).catch(function() {
          if (!done) { done = true; clearTimeout(t); resolve(null); }
        });
      });
      if (result === true) return true;
    } catch(e) {}
  }
  try {
    var m = await getMaintenance();
    if (m && m.on === true) return true;
  } catch(e) {}
  return false;
}

function lockServerForever() {
  if (serverLocked) return;
  serverLocked = true;

  var blockFn = function(e) {
    if (e && e.target && e.target.closest && e.target.closest('#serverDownOverlay')) return;
    if (e) { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); }
    return false;
  };
  document.addEventListener('click', blockFn, true);
  document.addEventListener('touchstart', blockFn, true);
  document.addEventListener('touchmove', blockFn, true);
  document.addEventListener('touchend', blockFn, true);
  document.addEventListener('mousedown', blockFn, true);
  document.addEventListener('mouseup', blockFn, true);
  document.addEventListener('contextmenu', blockFn, true);
  document.addEventListener('keydown', function(e) {
    var kc = e.keyCode || 0;
    if (kc === 4 || kc === 27 || kc === 82 || kc === 3 || kc === 187) {
      e.preventDefault();
      try { if (window.Android && window.Android.exitApp) window.Android.exitApp(); } catch(err) {}
      try { navigator.app && navigator.app.exitApp && navigator.app.exitApp(); } catch(err) {}
      return false;
    }
  }, true);

  var hideIds = ['loadingPage','authPage','profilePage','newsModal','adminModal','editUserModal','avatarShopPage','templateShopPage','settingsModal','changePasswordModal','purchaseModal','competitiveOverlay','gameStartedOverlay'];
  for (var i = 0; i < hideIds.length; i++) {
    var el = document.getElementById(hideIds[i]);
    if (el) { el.classList.add('hidden'); el.style.display = 'none'; }
  }

  var overlay = document.getElementById('serverDownOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'serverDownOverlay';
    overlay.innerHTML = '<div style="font-size:80px;">🔌</div><div style="color:#ff6b6b;font-size:26px;font-weight:900;margin-top:24px;text-shadow:0 3px 8px rgba(0,0,0,.5);">سرور قطع است</div><div style="color:rgba(255,255,255,0.9);font-size:15px;margin-top:16px;line-height:2.2;">بازی موقتاً در دسترس نیست<br>لطفاً بعداً مراجعه کنید</div>';
    document.body.appendChild(overlay);
  }
  overlay.classList.remove('hidden');
  overlay.style.cssText = 'position:fixed !important;inset:0 !important;width:100vw !important;height:100vh !important;z-index:2147483647 !important;background:linear-gradient(180deg,rgba(10,15,30,0.99),rgba(0,0,0,0.99)) !important;display:flex !important;align-items:center !important;justify-content:center !important;flex-direction:column !important;text-align:center !important;padding:30px !important;touch-action:none !important;user-select:none !important;font-family:Tahoma,Vazirmatn,sans-serif !important;';

  try { history.pushState(null, null, location.href); } catch(e) {}
  window.addEventListener('popstate', function() {
    try { history.pushState(null, null, location.href); } catch(e) {}
    try { if (window.Android && window.Android.exitApp) window.Android.exitApp(); } catch(err) {}
    try { navigator.app && navigator.app.exitApp && navigator.app.exitApp(); } catch(err) {}
  });
  setInterval(function() { try { history.pushState(null, null, location.href); } catch(e) {} }, 500);

  document.body.style.overflow = 'hidden';
  document.documentElement.style.overflow = 'hidden';
  
  // ✅ حذف دستور مخرب پاک کردن سشن (کاربر نباید به خاطر قطع سرور از حساب خارج شود)
  // try { localStorage.removeItem('currentLoggedInUser'); } catch(e) {}
}

/* ═══════════════════════════════════════════════════════════ */
/*  ⚡ چک مداوم سرور - هر ۲ ثانیه                                */
/* ═══════════════════════════════════════════════════════════ */
function startServerCheckLoop() {
  if (serverCheckInterval) clearInterval(serverCheckInterval);
  serverCheckInterval = setInterval(async function() {
    var session = getSession();
    if (session && session.phone) {
      if (!isCreatorPhone(session.phone)) {
        var down = await isServerLocked();
        if (down) {
          clearInterval(serverCheckInterval);
          lockServerForever();
        }
      }
      return;
    }
    var down2 = await isServerLocked();
    if (down2) {
      clearInterval(serverCheckInterval);
      lockServerForever();
    }
  }, 2000);
}

function getDeviceId() {
  var id = localStorage.getItem('__device_id__');
  if (!id) {
    var parts = [navigator.userAgent, navigator.platform, screen.width + 'x' + screen.height, screen.colorDepth, navigator.language, navigator.hardwareConcurrency, new Date().getTimezoneOffset()];
    var raw = parts.join('|'); var h = 0;
    for (var i = 0; i < raw.length; i++) { h = ((h << 5) - h) + raw.charCodeAt(i); h = h & h; }
    id = 'dev_' + Math.abs(h) + '_' + Date.now().toString(36);
    localStorage.setItem('__device_id__', id);
  }
  return id;
}
function getDeviceInfo() {
  try {
    return { ua: navigator.userAgent || '', platform: navigator.platform || '', screen: screen.width + 'x' + screen.height, colorDepth: screen.colorDepth || 24, language: navigator.language || 'fa', cores: navigator.hardwareConcurrency || 0, timezone: new Date().getTimezoneOffset(), deviceId: getDeviceId() };
  } catch(e) { return { deviceId: getDeviceId() }; }
}
async function fetchUserIP() {
  try {
    var c = new AbortController(); var t = setTimeout(function(){c.abort();}, 4000);
    var r = await fetch('https://api.ipify.org?format=json', { signal: c.signal, cache: 'no-store' });
    clearTimeout(t); var d = await r.json();
    return d.ip || null;
  } catch(e) { return null; }
}
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
async function getPhoneForDevice(deviceId) { if (!deviceId) return null; return await redisGet('device_phone:' + deviceId); }
async function lockDeviceToPhone(deviceId, phone) { if (!deviceId || !phone) return false; return await redisSet('device_phone:' + deviceId, { phone: phone, lockedAt: Date.now() }); }
async function logLoginSession(phone, ip, deviceId) {
  try {
    var user = await getUser(phone); if (!user) return;
    if (!user.loginHistory) user.loginHistory = [];
    user.loginHistory.push({ time: Date.now(), ip: ip || 'unknown', device: deviceId || 'unknown', userAgent: navigator.userAgent || 'unknown' });
    if (user.loginHistory.length > 50) user.loginHistory = user.loginHistory.slice(-50);
    user.lastIP = ip; user.lastDevice = deviceId; user.lastLogin = Date.now();
    await saveUser(phone, user);
    var allUsers = await getAllUsers(); allUsers[phone] = user; await saveAllUsers(allUsers);
  } catch(e) {}
}
function detectMaliciousApps() {
  try {
    var ua = (navigator.userAgent || '').toLowerCase();
    var platform = (navigator.platform || '').toLowerCase();
    var list = ['termux','kali','parrot','nethunter','kex','andronix','userland','linuxdeploy','debian','ubuntu','magisk','supersu','xposed','frida','gameguardian','lucky-patcher','httpcanary'];
    for (var i = 0; i < list.length; i++) { if (ua.indexOf(list[i]) !== -1 || platform.indexOf(list[i]) !== -1) return { detected: true, name: list[i] }; }
    if (window.TermuxAPI || window.KaliNethunter || window._KALI || window.AndroidTermux) return { detected: true, name: 'root/injection tool' };
    return { detected: false };
  } catch(e) { return { detected: false }; }
}
function showEl(id) { var e = document.getElementById(id); if (e) e.classList.remove('hidden'); }
function showMaliciousAlert(name) {
  var el = document.getElementById('malAppName'); if (el) el.textContent = name ? ('> ' + name + ' <') : '';
  showEl('maliciousOverlay'); appVerified = false;
}
function showIPBanOverlay(ban) {
  var r = document.getElementById('ipBanReason'); if (r) r.textContent = 'دلیل: ' + ((ban && ban.reason) || 'تخلف از قوانین');
  showEl('ipBanOverlay');
}
function showDeviceLockOverlay(phone) {
  var p = document.getElementById('deviceLockPhone'); if (p) p.textContent = phone || '****';
  showEl('deviceLockOverlay');
}
function isInsideApp() {
  try {
    if (localStorage.getItem('currentLoggedInUser')) return true;
    if (localStorage.getItem('__MAFIA_OK__') === '1') return true;
    if (window.__MAFIA_APP__ === true) return true;
    if (window.Android !== undefined) return true;
    if (window.flutter_inappwebview !== undefined) return true;
    if (window.ReactNativeWebView !== undefined) return true;
    if (window.Capacitor !== undefined) return true;
    if (window.cordova !== undefined) return true;
    var ua = navigator.userAgent || '';
    if (/; wv\)/.test(ua)) return true;
    if (ua.indexOf('MafiaApp') !== -1) return true;
    if (ua.indexOf('WebView') !== -1) return true;
    if (window.location.protocol === 'file:') return true;
    if (window.location.protocol === 'app:') return true;
    if (navigator.standalone === true) return true;
    return false;
  } catch(e) { return false; }
}
function startAppCheckLoop() {
  if (appCheckTimer) clearInterval(appCheckTimer);
  appCheckTimer = setInterval(function() {
    if (localStorage.getItem('currentLoggedInUser')) return;
    if (!isInsideApp()) { clearInterval(appCheckTimer); appCheckTimer = null; killApp(); }
  }, 3000);
}
function killApp() {
  appVerified = false;
  if (appCheckTimer) { clearInterval(appCheckTimer); appCheckTimer = null; }
  document.title = 'Access Denied';
  try { window.stop(); } catch(e) {}
  try { document.open(); document.write('<!DOCTYPE html><html dir="rtl" lang="fa"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no"><title>خطا</title><style>*{margin:0;padding:0;box-sizing:border-box}html,body{width:100%;height:100%;overflow:hidden;background:#0a0f1e;font-family:"Vazirmatn",Tahoma,sans-serif;color:white;display:flex;align-items:center;justify-content:center;padding:20px}.box{max-width:420px;width:100%;background:rgba(244,67,54,0.1);border:2px solid #f44336;border-radius:28px;padding:30px 20px;text-align:center}.ico{font-size:56px;margin-bottom:14px}.title{color:#ff6b6b;font-size:22px;font-weight:900;margin-bottom:12px}.text{color:rgba(255,255,255,0.85);font-size:13px;line-height:2.1}</style></head><body><div class="box"><div class="ico">⛔</div><div class="title">دسترسی غیرمجاز</div><div class="text">اجرای بازی فقط از طریق اپلیکیشن رسمی امکان‌پذیر است.</div></div></body></html>'); document.close(); } catch(e) {}
}
function lockInspect() {
  document.addEventListener('contextmenu', function(e){ e.preventDefault(); return false; });
  document.addEventListener('keydown', function(e) {
    if (e.key === 'F12' || e.keyCode === 123) { e.preventDefault(); killApp(); return false; }
    if (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j' || e.key === 'C' || e.key === 'c')) { e.preventDefault(); killApp(); return false; }
    if (e.ctrlKey && (e.key === 'U' || e.key === 'u' || e.key === 'S' || e.key === 's' || e.key === 'P' || e.key === 'p')) { e.preventDefault(); killApp(); return false; }
  });
  document.addEventListener('dragstart', function(e){ e.preventDefault(); });
}
function showToast(message, type) {
  if (!appVerified) return;
  if (serverLocked) return;
  var t = document.getElementById('toast');
  if (!t) return;
  t.textContent = message;
  t.className = 'toast show' + (type === 'error' ? ' error' : '');
  setTimeout(function(){ t.classList.remove('show'); }, 3000);
}
async function performSecurityChecks(phone) {
  if (isCreatorPhone(phone)) return { blocked: false };
  currentIP = await fetchUserIP();
  currentDeviceId = getDeviceId();
  if (currentIP) {
    var ipBan = await checkIPBan(currentIP);
    if (ipBan) { showIPBanOverlay(ipBan); return { blocked: true }; }
  }
  var deviceBan = await checkDeviceBan(currentDeviceId);
  if (deviceBan) { showIPBanOverlay(deviceBan); return { blocked: true }; }
  if (phone) {
    var accBan = await getBanStatus(phone);
    if (accBan) {
      var params = new URLSearchParams({ phone: phone, by: accBan.bannedBy || 'مدیریت', reason: accBan.reason || 'بدون دلیل', duration: accBan.duration || 'permanent', expires: accBan.expiresAt || '' });
      window.location.href = PAGES.ban + '?' + params.toString();
      return { blocked: true };
    }
  }
  return { blocked: false };
}
async function getUniqueUserCode() {
  try {
    var allUsers = await getAllUsers();
    var usedCodes = {};
    for (var phone in allUsers) {
      var u = allUsers[phone];
      if (u && u.userCode) { var n = parseInt(u.userCode); if (!isNaN(n) && n > 0) usedCodes[n] = true; }
    }
    var counter = parseInt(await redisGet('user_code_counter')) || 0;
    var code = counter + 1;
    var guard = 0;
    while (usedCodes[code] && guard < 10000000) { code++; guard++; }
    await redisSet('user_code_counter', code);
    return code;
  } catch(e) { return Date.now(); }
}
async function findUser(phone) {
  try { var cached = localStorage.getItem('user_cache_' + phone); if (cached) { var cu = JSON.parse(cached); if (cu && cu.fullProfile) return cu; } } catch(e) {}
  try { var mafiaUsers = JSON.parse(localStorage.getItem('mafia_users') || '{}'); if (mafiaUsers[phone] && mafiaUsers[phone].fullProfile) return mafiaUsers[phone]; } catch(e) {}
  var user = await getUser(phone);
  if (user && user.fullProfile) { try { localStorage.setItem('user_cache_' + phone, JSON.stringify(user)); } catch(e) {} return user; }
  return null;
}
function showPage(pageId) {
  if (serverLocked) return;
  var pages = document.querySelectorAll('.page');
  for (var i = 0; i < pages.length; i++) pages[i].classList.add('hidden');
  var t = document.getElementById(pageId);
  if (t) t.classList.remove('hidden');
}
async function redirectToMainPage(userPhone) {
  if (!appVerified) { killApp(); return; }
  if (isRedirecting) return;
  isRedirecting = true;
  if (!isCreatorPhone(userPhone)) {
    var down = await isServerLocked();
    if (down) { isRedirecting = false; lockServerForever(); return; }
  }
  try {
    var user = await findUser(userPhone);
    if (user) {
      try {
        sessionStorage.setItem('currentUserPhone', userPhone);
        sessionStorage.setItem('currentUserRank', user.rank || 'کاربر');
        sessionStorage.setItem('currentUserName', user.name);
        sessionStorage.setItem('currentUserAvatar', user.avatar);
        localStorage.setItem('user_cache_' + userPhone, JSON.stringify(user));
        localStorage.setItem('currentLoggedInUser', JSON.stringify({ phone: userPhone, timestamp: Date.now(), name: user.name }));
      } catch(e) {}
    } else {
      try { localStorage.setItem('currentLoggedInUser', JSON.stringify({ phone: userPhone, timestamp: Date.now(), name: 'کاربر' })); } catch(e) {}
    }
  } catch(e) {
    try { localStorage.setItem('currentLoggedInUser', JSON.stringify({ phone: userPhone, timestamp: Date.now(), name: 'کاربر' })); } catch(e2) {}
  }
  try { logLoginSession(userPhone, currentIP, currentDeviceId); } catch(e) {}
  window.location.href = PAGES.game;
}
function unlockAudio() {
  if (!audioUnlocked) { var m = document.getElementById('bgMusic'); if (m) { m.volume = 0.3; m.play().catch(function(){}); } audioUnlocked = true; }
}
function playClickSound() {
  if (serverLocked) return;
  try { var s = document.getElementById('clickSound'); if (s) { s.currentTime = 0; s.play().catch(function(){}); } unlockAudio(); } catch(e) {}
}
function bindEvents() {
  var checkPhoneBtn = document.getElementById('checkPhoneBtn');
  var verifyOtpBtn = document.getElementById('verifyOtpBtn');
  var resendOtpBtn = document.getElementById('resendOtpBtn');
  var loginBtn = document.getElementById('loginBtn');
  var forgotPassBtn = document.getElementById('forgotPassBtn');
  var submitProfileBtn = document.getElementById('submitProfileBtn');

  if (checkPhoneBtn) checkPhoneBtn.addEventListener('click', async function() {
    if (serverLocked) return;
    playClickSound();
    if (!appVerified) return;
    var phone = document.getElementById('phoneInput').value.trim();
    var phoneError = document.getElementById('phoneError');
    if (!phone || phone.length < 10) { phoneError.innerText = 'شماره موبایل معتبر وارد کنید'; return; }
    phoneError.innerText = '';
    checkPhoneBtn.disabled = true; checkPhoneBtn.innerText = '...';
    var isCrt = isCreatorPhone(phone);
    if (!isCrt) {
      var down = await isServerLocked();
      if (down) { lockServerForever(); return; }
    }
    if (!isCrt) {
      var checks = await performSecurityChecks(phone);
      if (checks.blocked) { checkPhoneBtn.disabled = false; checkPhoneBtn.innerText = 'ادامه'; return; }
    }
    tempPhone = phone;
    var user = await findUser(phone);
    checkPhoneBtn.disabled = false; checkPhoneBtn.innerText = 'ادامه';
    if (user && user.fullProfile === true) {
      document.getElementById('stepPhone').style.display = 'none';
      document.getElementById('stepOtp').style.display = 'none';
      document.getElementById('stepPassword').style.display = 'block';
      document.getElementById('passError').innerText = '';
    } else {
      if (!isCrt) {
        try { var locked = await getPhoneForDevice(currentDeviceId); if (locked && locked.phone && locked.phone !== phone) { showDeviceLockOverlay(locked.phone); return; } } catch(e) {}
      }
      generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
      showToast('کد تایید: ' + generatedOtp);
      document.getElementById('stepPhone').style.display = 'none';
      document.getElementById('stepPassword').style.display = 'none';
      document.getElementById('stepOtp').style.display = 'block';
      document.getElementById('otpError').innerText = '';
    }
  });

  if (verifyOtpBtn) verifyOtpBtn.addEventListener('click', function() {
    if (serverLocked) return;
    playClickSound();
    var enteredOtp = document.getElementById('otpInput').value.trim();
    if (enteredOtp === generatedOtp) {
      showPage('profilePage');
      document.getElementById('stepPhone').style.display = 'block';
      document.getElementById('stepOtp').style.display = 'none';
      document.getElementById('phoneInput').value = '';
      document.getElementById('otpInput').value = '';
    } else { document.getElementById('otpError').innerText = 'کد وارد شده اشتباه است'; }
  });

  if (resendOtpBtn) resendOtpBtn.addEventListener('click', function() {
    if (serverLocked) return;
    playClickSound();
    generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
    showToast('کد جدید: ' + generatedOtp);
  });

  if (loginBtn) loginBtn.addEventListener('click', async function() {
    if (serverLocked) return;
    playClickSound();
    var pass = (document.getElementById('passwordInput').value || '').trim();
    loginBtn.disabled = true; loginBtn.innerText = '...';
    var isCrt = isCreatorPhone(tempPhone);
    if (!isCrt) {
      var down = await isServerLocked();
      if (down) { lockServerForever(); return; }
    }
    if (!isCrt) {
      var checks = await performSecurityChecks(tempPhone);
      if (checks.blocked) { loginBtn.disabled = false; loginBtn.innerText = 'ورود'; return; }
    }
    var user = await findUser(tempPhone);
    loginBtn.disabled = false; loginBtn.innerText = 'ورود';
    if (user && user.password === pass) {
      if (!isCrt) {
        try {
          var locked = await getPhoneForDevice(currentDeviceId);
          if (!locked) await lockDeviceToPhone(currentDeviceId, tempPhone);
          else if (locked.phone !== tempPhone) { showDeviceLockOverlay(locked.phone); return; }
        } catch(e) {}
      }
      await redirectToMainPage(tempPhone);
    } else { document.getElementById('passError').innerText = 'رمز عبور نادرست است'; }
  });

  if (forgotPassBtn) forgotPassBtn.addEventListener('click', function() { if (serverLocked) return; playClickSound(); showToast('از طریق پشتیبانی پیگیری کنید'); });

  var avatarCircle = document.getElementById('avatarCircle');
  var avatarMenu = document.getElementById('avatarMenu');
  var backdrop = document.getElementById('backdrop');
  if (avatarMenu) {
    avatarMenu.innerHTML = '';
    for (var i = 0; i < avatarList.length; i++) {
      (function(src) {
        var option = document.createElement('div');
        option.className = 'avatar-option';
        var img = document.createElement('img');
        img.src = src;
        img.onerror = function() { img.style.backgroundColor = '#555'; };
        option.appendChild(img);
        option.addEventListener('click', function() {
          if (serverLocked) return;
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
  }
  function openAvatarMenu() { if (serverLocked) return; playClickSound(); if (avatarMenu) avatarMenu.classList.add('open'); if (backdrop) backdrop.classList.add('show'); }
  function closeAvatarMenu() { if (avatarMenu) avatarMenu.classList.remove('open'); if (backdrop) backdrop.classList.remove('show'); }
  if (avatarCircle) avatarCircle.addEventListener('click', openAvatarMenu);
  if (backdrop) backdrop.addEventListener('click', closeAvatarMenu);

  if (submitProfileBtn) submitProfileBtn.addEventListener('click', async function() {
    if (serverLocked) return;
    playClickSound();
    var gameName = document.getElementById('gameName').value.trim();
    var age = document.getElementById('age').value.trim();
    var newPass = document.getElementById('newPassword').value.trim();
    if (!gameName || !age || !newPass) { showToast('لطفاً نام، سن و رمز عبور را وارد کنید', 'error'); return; }
    if (isNaN(age) || age < 5 || age > 99) { showToast('سن بین ۵ تا ۹۹ وارد کنید', 'error'); return; }
    var phone = tempPhone;
    if (!phone) { showToast('خطا در شماره تلفن', 'error'); return; }
    var isCrt = isCreatorPhone(phone);
    if (!isCrt) {
      var down = await isServerLocked();
      if (down) { lockServerForever(); return; }
    }
    var existingUser = null;
    try { var cp = getUser(phone); var tp = new Promise(function(r){ setTimeout(function(){r(null);}, 6000); }); existingUser = await Promise.race([cp, tp]); } catch(e) {}
    if (!existingUser) { try { var c = localStorage.getItem('user_cache_' + phone); if (c) existingUser = JSON.parse(c); } catch(e) {} }
    if (existingUser && existingUser.fullProfile === true) {
      existingUser.name = gameName; existingUser.age = parseInt(age); existingUser.password = newPass;
      existingUser.avatar = existingUser.avatar || selectedAvatarSrc;
      if (isCrt && existingUser.rank !== 'سازنده') existingUser.rank = 'سازنده';
      if (!existingUser.rank) existingUser.rank = 'کاربر';
      existingUser.lastUpdatedAt = Date.now(); existingUser.online = true;
      existingUser.deviceInfo = existingUser.deviceInfo || getDeviceInfo();
      submitProfileBtn.disabled = true; submitProfileBtn.innerText = '...';
      try { localStorage.setItem('user_cache_' + phone, JSON.stringify(existingUser)); var mu = JSON.parse(localStorage.getItem('mafia_users') || '{}'); mu[phone] = existingUser; localStorage.setItem('mafia_users', JSON.stringify(mu)); } catch(e) {}
      var s2 = await saveUser(phone, existingUser);
      if (s2) { var au2 = await getAllUsers(); au2[phone] = existingUser; await saveAllUsers(au2); await redirectToMainPage(phone); }
      else { showToast('خطا در ذخیره اطلاعات', 'error'); submitProfileBtn.disabled = false; submitProfileBtn.innerText = 'تایید و ادامه'; }
      return;
    }
    if (!isCrt) {
      var checks = await performSecurityChecks(phone);
      if (checks.blocked) return;
      var locked = await getPhoneForDevice(currentDeviceId);
      if (locked && locked.phone && locked.phone !== phone) { showDeviceLockOverlay(locked.phone); return; }
    }
    var ageNum = parseInt(age);
    var userCode = await getUniqueUserCode();
    var userData = {
      password: newPass, name: gameName, age: ageNum, avatar: selectedAvatarSrc,
      rank: isCrt ? 'سازنده' : 'کاربر', userCode: userCode, fullProfile: true,
      canAccessAdult: ageNum >= 18, canAccessTeen: ageNum < 18,
      coins: isCrt ? 999999 : 200, gems: isCrt ? 999999 : 10, dollars: isCrt ? 999999 : 0,
      cups: 0, hours: 0, level: 1, xp: 0, compWins: 0, friendWins: 0, monitorCount: 0,
      bestScore: 0, mafiaWins: 0, citizenWins: 0, ownedAvatars: [], ownedTemplates: [],
      currentTemplate: null, online: true, banned: false, lastUpdatedAt: Date.now(),
      createdAt: Date.now(), registeredAt: Date.now(),
      registeredIP: currentIP, registeredDevice: currentDeviceId,
      lastIP: currentIP, lastDevice: currentDeviceId, lastLogin: Date.now(),
      deviceInfo: getDeviceInfo(),
      loginHistory: [{ time: Date.now(), ip: currentIP, device: currentDeviceId, userAgent: navigator.userAgent || 'unknown' }]
    };
    submitProfileBtn.disabled = true; submitProfileBtn.innerText = '...';
    try { localStorage.setItem('user_cache_' + phone, JSON.stringify(userData)); var mu2 = JSON.parse(localStorage.getItem('mafia_users') || '{}'); mu2[phone] = userData; localStorage.setItem('mafia_users', JSON.stringify(mu2)); } catch(e) {}
    var saved = await saveUser(phone, userData);
    if (saved) {
      if (!isCrt) await lockDeviceToPhone(currentDeviceId, phone);
      var allUsers = await getAllUsers(); allUsers[phone] = userData; await saveAllUsers(allUsers);
      await redirectToMainPage(phone);
    } else {
      showToast('خطا در ذخیره اطلاعات', 'error');
      submitProfileBtn.disabled = false; submitProfileBtn.innerText = 'تایید و ادامه';
    }
  });
}

/* ═══════════════════════════════════════════════════════════ */
/*  Boot                                                       */
/* ═══════════════════════════════════════════════════════════ */
async function startBoot() {
  if (window.__BOOT_OK__) return;
  window.__BOOT_OK__ = true;

  initFB();

  var serverDown = await isServerLocked();

  var appCheckAttempts = 0;
  var appConfirmed = false;
  while (appCheckAttempts < 3) {
    if (isInsideApp()) { appConfirmed = true; break; }
    appCheckAttempts++;
    await new Promise(function(r) { setTimeout(r, 100); });
  }
  if (!appConfirmed) { killApp(); return; }
  startAppCheckLoop();

  // ✅ استفاده از سیستم چک سشن چندلایه برای جلوگیری از باگ پریدن به لاگین
  var session = getSession();
  var hasLogin = session && session.phone;
  var loggedPhone = hasLogin ? session.phone : null;

  if (hasLogin) {
    if (!isCreatorPhone(loggedPhone)) {
      var down2 = await isServerLocked();
      if (down2) { lockServerForever(); return; }
    }
    setTimeout(function() {
      try { window.location.replace(PAGES.game); } catch(e) { window.location.href = PAGES.game; }
    }, 200);
    return;
  }

  if (serverDown) { lockServerForever(); return; }

  try {
    currentIP = await fetchUserIP();
    currentDeviceId = getDeviceId();
    if (currentIP) {
      var ipBan = await checkIPBan(currentIP);
      if (ipBan) { showIPBanOverlay(ipBan); return; }
    }
    var deviceBan = await checkDeviceBan(currentDeviceId);
    if (deviceBan) { showIPBanOverlay(deviceBan); return; }
  } catch(e) {}

  var mal = detectMaliciousApps();
  if (mal.detected) { showMaliciousAlert(mal.name); return; }

  bindEvents();

  var selectedImg = document.getElementById('selectedAvatarImg');
  if (selectedImg) selectedImg.src = selectedAvatarSrc;
  var imgs = document.querySelectorAll('img');
  for (var i = 0; i < imgs.length; i++) imgs[i].addEventListener('error', function(){ this.style.display = 'none'; });

  startServerCheckLoop();

  setTimeout(function() {
    if (serverLocked) return;
    var lp = document.getElementById('loadingPage'); if (lp) lp.classList.add('hidden');
    var ap = document.getElementById('authPage'); if (ap) ap.classList.remove('hidden');
    try {
      document.getElementById('stepPhone').style.display = 'block';
      document.getElementById('stepPassword').style.display = 'none';
      document.getElementById('stepOtp').style.display = 'none';
    } catch(e) {}
  }, 800);

  if (fbReady && fbDb) {
    try {
      fbDb.ref('server_state/on').on('value', function(snap) {
        var v = snap.val();
        if (v === true) {
          var sess = getSession();
          var p2 = sess ? sess.phone : null;
          if (!isCreatorPhone(p2)) lockServerForever();
        }
      });
    } catch(e) {}
  }
}

lockInspect();
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startBoot);
else startBoot();