/* ============================================================ */
/*  Safe Asli.js - نسخه نهایی کامل نهایی                        */
/*  ✅ merge دو دیتابیس - بدون نوسان کاربران                      */
/*  ✅ ثبت کامل تاریخ ورود با IP و زمان دقیق (چند منبع IP)         */
/*  ✅ چک دوگانه سرور هر ۲ ثانیه                                  */
/*  ✅ ادمین هر تغییری بده فوری اعمال میشه                        */
/*  ✅ آواتار اختصاصی با DataURL (روی همه دستگاه‌ها کار می‌کنه)     */
/*  ✅ ریکاوری خودکار بعد از قطع سرور - کاربر logout نمیشه        */
/*  ✅ جلوگیری از پریدن حساب هنگام قطع/وصل سرور                   */
/* ============================================================ */

var UPSTASH_OLD_URL = "https://smooth-werewolf-200782.upstash.io";
var UPSTASH_OLD_TOKEN = "gQAAAAAAAxBOAAIgcDFjN2NiMjYxOWNlNjE0NzgyOTExM2JjMjA5ZTc0MjVjMA";
var UPSTASH_NEW_URL = "https://holy-hamster-122717.upstash.io";
var UPSTASH_NEW_TOKEN = "gQAAAAAAAd9dAAIgcDFlNmYwM2VkZDJiM2Y0YWI2ODBmNmIyMTZjMmRkMTZmNg";
var CREATOR_PHONE = '09904844031';

var AWAY_TIMEOUT_MS = 10000;
var currentUserData = null;
var currentPhone = null;
var editingUserId = null;
var editingUserExclusiveAvatar = null;
var shopGold = 0, shopGems = 0, shopDollars = 0;
var selectedAvatar = null, purchasePrice = 0;
var currentAvatarSection = 'my';
var currentTemplateSection = 'my';
var selectedTemplate = null, templatePurchasePrice = 0, purchaseMode = 'avatar';
var userGroupCache = null;
var pauseSync = false;
var videoObserver = null;
var myIP = null;
var currentDeviceId = null;
var awayTimer = null;
var isUserAway = false;
var gameServerLocked = false;
var isRedirecting = false;
var currentAdminTab = 'all';
var currentUserList = [];
var viewingUserHistory = null;
var ADMIN_LOCK_MS = 8000;
var fbServerListener = null;
var __serverRecoveryInterval = null;
var __lastLoginLogged = 0;

var FB_CFG = {
  apiKey: "AIzaSyCP75sEM4FFCZ2fB5N36Xu-b2Th9nnrLd8",
  authDomain: "mafiasu-681c7.firebaseapp.com",
  databaseURL: "https://mafiasu-681c7-default-rtdb.firebaseio.com",
  projectId: "mafiasu-681c7",
  storageBucket: "mafiasu-681c7.firebasestorage.app",
  messagingSenderId: "180192927804",
  appId: "1:180192927804:web:e0c501a0d20af3b6892339"
};
var fbDb = null, fbReady = false, fbPhone = 'unknown';

function initFB(phone) {
  fbPhone = phone || 'unknown';
  try {
    if (typeof firebase === 'undefined') return false;
    if (!firebase.apps.length) firebase.initializeApp(FB_CFG);
    fbDb = firebase.database();
    fbReady = true;
    return true;
  } catch(e) { return false; }
}
function setFBValue(path, value) {
  if (!fbReady || !fbDb) return;
  try { fbDb.ref(path).set(value); } catch(e) {}
}
function setFBOnline(phone, isOnline, extra) {
  if (!fbReady || !fbDb) return;
  try {
    var d = { online: isOnline, lastSeen: Date.now() };
    if (extra) for (var k in extra) d[k] = extra[k];
    fbDb.ref('online/' + phone).set(d);
  } catch(e) {}
}
function sendLive(channel, type, data) {
  if (!fbReady || !fbDb) return;
  try {
    fbDb.ref('signals/' + channel).push({
      type: type || 'update',
      data: data || {},
      from: fbPhone,
      time: Date.now()
    });
  } catch(e) {}
}
function notifyUserUpdate(phone, type) {
  if (!fbReady || !fbDb) return;
  try {
    fbDb.ref('user_updates/' + phone).set({
      at: Date.now(),
      by: fbPhone,
      type: type || 'admin_edit'
    });
  } catch(e) {}
}

/* ═══════════════════════════════════════════════════════════ */
/*  Redis - با Merge بین دو دیتابیس                              */
/* ═══════════════════════════════════════════════════════════ */
async function upstashGet(url, token, k) {
  try {
    var c = new AbortController();
    var t = setTimeout(function(){ c.abort(); }, 5000);
    var r = await fetch(url + '/get/' + encodeURIComponent(k), {
      headers: { 'Authorization': 'Bearer ' + token },
      signal: c.signal,
      cache: 'no-store'
    });
    clearTimeout(t);
    if (!r.ok) return null;
    var d = await r.json();
    if (d && d.result) {
      try { return JSON.parse(d.result); } catch (e) { return d.result; }
    }
    return null;
  } catch (e) { return null; }
}
async function upstashSet(url, token, k, v) {
  try {
    var jsonValue = JSON.stringify(v);
    var c = new AbortController();
    var t = setTimeout(function(){ c.abort(); }, 8000);
    var r = await fetch(url + '/set/' + encodeURIComponent(k) + '/' + encodeURIComponent(jsonValue), {
      headers: { 'Authorization': 'Bearer ' + token },
      signal: c.signal
    });
    clearTimeout(t);
    return r.ok;
  } catch (e) { return false; }
}
async function upstashDel(url, token, k) {
  try {
    var c = new AbortController();
    var t = setTimeout(function(){ c.abort(); }, 5000);
    var r = await fetch(url + '/del/' + encodeURIComponent(k), {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token },
      signal: c.signal
    });
    clearTimeout(t);
    return r.ok;
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
async function redisDel(key) {
  await Promise.allSettled([
    upstashDel(UPSTASH_OLD_URL, UPSTASH_OLD_TOKEN, key),
    upstashDel(UPSTASH_NEW_URL, UPSTASH_NEW_TOKEN, key)
  ]);
  return true;
}

/* ═══════════════════════════════════════════════════════════ */
/*  ⚡ getUser - merge دو دیتابیس                                */
/* ═══════════════════════════════════════════════════════════ */
async function getUser(p) {
  var u1 = null, u2 = null;
  try { u1 = await upstashGet(UPSTASH_OLD_URL, UPSTASH_OLD_TOKEN, 'user:' + p); } catch(e) {}
  try { u2 = await upstashGet(UPSTASH_NEW_URL, UPSTASH_NEW_TOKEN, 'user:' + p); } catch(e) {}
  if (!u1 && !u2) return null;
  if (!u1) return u2;
  if (!u2) return u1;
  var t1 = u1.lastUpdatedAt || 0;
  var t2 = u2.lastUpdatedAt || 0;
  if (t2 > t1) return u2;
  if (!u1.fullProfile && u2.fullProfile) return u2;
  return u1;
}
async function saveUser(p, u) { return await redisSet('user:' + p, u); }

/* ═══════════════════════════════════════════════════════════ */
/*  ⚡ getAllUsers - merge دو دیتابیس                             */
/* ═══════════════════════════════════════════════════════════ */
async function getAllUsers() {
  var merged = {};
  try {
    var v1 = await upstashGet(UPSTASH_OLD_URL, UPSTASH_OLD_TOKEN, 'all_users');
    if (v1 && typeof v1 === 'object') {
      for (var k1 in v1) { if (v1[k1]) merged[k1] = v1[k1]; }
    }
  } catch(e) {}
  try {
    var v2 = await upstashGet(UPSTASH_NEW_URL, UPSTASH_NEW_TOKEN, 'all_users');
    if (v2 && typeof v2 === 'object') {
      for (var k2 in v2) {
        if (!merged[k2]) { merged[k2] = v2[k2]; continue; }
        var t1 = merged[k2].lastUpdatedAt || 0;
        var t2 = v2[k2].lastUpdatedAt || 0;
        if (t2 > t1) merged[k2] = v2[k2];
        if (!merged[k2].fullProfile && v2[k2].fullProfile) merged[k2] = v2[k2];
      }
    }
  } catch(e) {}
  return merged;
}
async function saveAllUsers(u) { return await redisSet('all_users', u); }
async function getGroups() { return await redisGet('police_groups') || []; }
async function getNews() { return await redisGet('game_news') || []; }
async function saveNews(n) { return await redisSet('game_news', n); }
async function getMaintenance() { return await redisGet('server_maintenance'); }
async function setMaintenance(on) { return await redisSet('server_maintenance', { on: on, at: Date.now() }); }
async function getTournamentConfig() { return await redisGet('tournament_config') || {}; }
async function saveTournamentConfigData(cfg) { return await redisSet('tournament_config', cfg); }

async function getBanStatus(p) {
  var b = await redisGet('ban:' + p);
  if (b && b.isBanned) {
    if (b.expiresAt && b.duration !== 'permanent' && b.duration !== 'دائمی') {
      if (new Date(b.expiresAt).getTime() < Date.now()) return null;
    }
    return b;
  }
  return null;
}
async function getDeviceBan(id) { return await redisGet('device_ban:' + id); }
async function setDeviceBan(id, data) { return await redisSet('device_ban:' + id, data); }
async function setIPBan(ip, data) { return await redisSet('ip_ban:' + ip, data); }
async function addBanLog(phone, banData) {
  var user = await getUser(phone);
  if (!user) return;
  if (!user.banHistory) user.banHistory = [];
  user.banHistory.push(banData);
  if (user.banHistory.length > 50) user.banHistory.shift();
  await saveUser(phone, user);
}
async function getUniqueUserCode() {
  try {
    var allUsers = await getAllUsers();
    var usedCodes = {};
    var vals = Object.values(allUsers);
    for (var i = 0; i < vals.length; i++) {
      var u = vals[i];
      if (u && u.userCode && !isNaN(parseInt(u.userCode))) usedCodes[parseInt(u.userCode)] = true;
    }
    var code = 1;
    while (usedCodes[code]) code++;
    return code;
  } catch(e) { return Date.now(); }
}
async function resetAllUserCodes() {
  if (currentPhone !== CREATOR_PHONE) { showShopNotification('فقط سازنده', 'error'); return; }
  if (!confirm('همه کدها بازنشانی شود؟')) return;
  showShopNotification('در حال بازنشانی...');
  try {
    var allUsers = await getAllUsers();
    var entries = Object.entries(allUsers);
    entries.sort(function(a, b) {
      var tA = a[1].createdAt || a[1].registeredAt || 0;
      var tB = b[1].createdAt || b[1].registeredAt || 0;
      return tA - tB;
    });
    var counter = 1;
    var now = Date.now();
    for (var i = 0; i < entries.length; i++) {
      entries[i][1].userCode = counter;
      entries[i][1].lastUpdatedAt = now;
      allUsers[entries[i][0]] = entries[i][1];
      await saveUser(entries[i][0], entries[i][1]);
      counter++;
    }
    await saveAllUsers(allUsers);
    showShopNotification('✅ ' + (counter - 1) + ' کاربر بازنشانی شد');
    await loadUsers();
    sendLive('global', 'codes_reset', {});
  } catch(e) { showShopNotification('خطا', 'error'); }
}
async function assignCodeIfMissing(phone, user) {
  if (!user) return user;
  if (user.userCode && parseInt(user.userCode) > 0) return user;
  try {
    var code = await getUniqueUserCode();
    user.userCode = code;
    user.lastUpdatedAt = Date.now();
    await saveUser(phone, user);
    var allUsers = await getAllUsers();
    allUsers[phone] = user;
    await saveAllUsers(allUsers);
  } catch(e) {}
  return user;
}
async function getAllWhitelistIPs() { return await redisGet('whitelist_ips') || {}; }
async function isIPWhitelisted(ip, deviceId) {
  if (!ip && !deviceId) return false;
  try {
    var list = await getAllWhitelistIPs();
    var cIP = ip ? String(ip).trim() : '';
    var cDev = deviceId ? String(deviceId).trim() : '';
    if (cIP && list[cIP]) return true;
    if (cDev && list[cDev]) return true;
    return false;
  } catch(e) { return false; }
}
async function addToWhitelist(ip, note, byPhone) {
  var list = await getAllWhitelistIPs();
  list[ip] = { ip: ip, note: note || '', addedBy: byPhone || 'سازنده', addedAt: Date.now() };
  return await redisSet('whitelist_ips', list);
}
async function removeFromWhitelist(ip) {
  var list = await getAllWhitelistIPs();
  delete list[ip];
  return await redisSet('whitelist_ips', list);
}

/* ═══════════════════════════════════════════════════════════ */
/*  IP + Device  (چند منبع IP واقعی)                             */
/* ═══════════════════════════════════════════════════════════ */
async function fetchUserIP() {
  var sources = [
    'https://api.ipify.org?format=json',
    'https://api64.ipify.org?format=json',
    'https://ipapi.co/json/',
    'https://api.my-ip.io/ip.json'
  ];
  for (var i = 0; i < sources.length; i++) {
    try {
      var c = new AbortController();
      var t = setTimeout(function(){ c.abort(); }, 3500);
      var r = await fetch(sources[i], { signal: c.signal, cache: 'no-store' });
      clearTimeout(t);
      if (r.ok) {
        var d = await r.json();
        var ip = d.ip || d.query || d.IP || null;
        if (ip && String(ip).trim() && String(ip).trim() !== 'undefined') {
          return String(ip).trim();
        }
      }
    } catch(e) {}
  }
  return null;
}
function getDeviceId() {
  var id = localStorage.getItem('__device_id__');
  if (!id) {
    var parts = [
      navigator.userAgent,
      navigator.platform,
      screen.width + 'x' + screen.height,
      screen.colorDepth,
      navigator.language,
      navigator.hardwareConcurrency,
      new Date().getTimezoneOffset()
    ];
    var raw = parts.join('|');
    var h = 0;
    for (var i = 0; i < raw.length; i++) {
      h = ((h << 5) - h) + raw.charCodeAt(i);
      h = h & h;
    }
    id = 'dev_' + Math.abs(h) + '_' + Date.now().toString(36);
    localStorage.setItem('__device_id__', id);
  }
  return id;
}
function getDeviceInfo() {
  try {
    return {
      ua: navigator.userAgent || '',
      platform: navigator.platform || '',
      screen: screen.width + 'x' + screen.height,
      colorDepth: screen.colorDepth || 24,
      language: navigator.language || 'fa',
      cores: navigator.hardwareConcurrency || 0,
      timezone: new Date().getTimezoneOffset(),
      deviceId: getDeviceId()
    };
  } catch(e) { return { deviceId: getDeviceId() }; }
}

/* ═══════════════════════════════════════════════════════════ */
/*  ⚡ logLoginSession - ثبت کامل ورود (زمان + IP دقیق)          */
/* ═══════════════════════════════════════════════════════════ */
async function logLoginSession(phone, ip, deviceId) {
  try {
    var user = await getUser(phone);
    if (!user) return;
    if (!user.loginHistory) user.loginHistory = [];

    var devInfo = getDeviceInfo();
    var now = Date.now();

    // جلوگیری از ثبت تکراری در کمتر از ۵ ثانیه
    var last = user.loginHistory[user.loginHistory.length - 1];
    if (last && (now - (last.timestamp || last.time || 0)) < 5000) return;

    var realIP = ip || 'نامشخص';

    // زمان دقیق با منطقه زمانی محلی
    var nowDate = new Date(now);
    var faDate = nowDate.toLocaleString('fa-IR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });

    var entry = {
      time: now,
      timestamp: now,
      date: faDate,
      ip: realIP,
      device: deviceId || currentDeviceId || 'نامشخص',
      ua: navigator.userAgent || 'unknown',
      platform: devInfo.platform || 'unknown',
      screen: devInfo.screen || 'unknown',
      language: devInfo.language || 'unknown',
      action: 'ورود به بازی'
    };

    user.loginHistory.push(entry);
    if (user.loginHistory.length > 100) user.loginHistory = user.loginHistory.slice(-100);

    user.lastIP = realIP;
    user.lastDevice = entry.device;
    user.lastLogin = now;
    user.lastLoginDate = faDate;
    user.lastUpdatedAt = now;

    await saveUser(phone, user);
    var allUsers = await getAllUsers();
    allUsers[phone] = user;
    await saveAllUsers(allUsers);

    __lastLoginLogged = now;
  } catch(e) {}
}

/* ═══════════════════════════════════════════════════════════ */
/*  Helpers                                                    */
/* ═══════════════════════════════════════════════════════════ */
function redirectToBan(b, p) {
  if (isRedirecting) return;
  isRedirecting = true;
  var params = new URLSearchParams({
    phone: p,
    by: b.bannedBy || 'مدیریت',
    reason: b.reason || 'بدون دلیل',
    duration: b.duration || '1d',
    expires: b.expiresAt || ''
  });
  window.location.href = 'Ban.html?' + params.toString();
}
function toPersianNum(n) {
  var p = ['۰','۱','۲','۳','۴','۵','۶','۷','۸','۹'];
  return String(n).replace(/[0-9]/g, function(w) { return p[+w]; });
}
function formatDate(ts) {
  if (!ts) return '----';
  try { return new Date(ts).toLocaleString('fa-IR'); } catch(e) { return '----'; }
}
function getRoleTick(role) {
  if (!role) return null;
  var r = role.trim();
  if (r === 'سازنده' || r === 'پشتیبانی') return ['Tik1.png'];
  if (r === 'ادمین ارشد') return ['Tik1000.png'];
  if (r === 'ادمین') return ['Tik2.png'];
  if (r === 'گرداننده') return ['Tik3.png'];
  if (r === 'ناظر' || r === 'ناظر ارشد') return ['TIK4.png', 'Tik4.png'];
  return null;
}
function applyTick(img, cands) {
  if (!img || !cands || !cands.length) return;
  var i = 0;
  (function nx() {
    if (i >= cands.length) { img.style.display = 'none'; return; }
    var s = cands[i++];
    var t = new Image();
    t.onload = function() { img.src = s; img.style.display = 'inline-block'; };
    t.onerror = nx;
    t.src = s;
  })();
}

var RANK_LEVEL = {
  'کاربر':0, 'ناظر':1, 'ناظر ارشد':2, 'ادمین':3, 'ادمین ارشد':4,
  'گرداننده':5, 'پشتیبانی':6, 'سازنده':7
};
var RANK_PERM = {
  'سازنده': {
    panel:true, coins:true, gems:true, dollars:true, rank:true, exclusive:true,
    del:true, server:true, wipe:true, banMax:'permanent', stats:true,
    ipControl:true, userControl:true, whitelist:true
  },
  'پشتیبانی': {
    panel:true, coins:false, gems:false, dollars:false, rank:false, exclusive:false,
    del:false, server:false, wipe:false, banMax:'3m', stats:false,
    ipControl:false, userControl:false, whitelist:false
  },
  'ادمین ارشد': {
    panel:true, coins:true, gems:true, dollars:true, rank:true, exclusive:false,
    del:false, server:false, wipe:false, banMax:'1m', stats:true,
    ipControl:true, userControl:true, whitelist:false
  },
  'گرداننده': {
    panel:true, coins:true, gems:true, dollars:true, rank:true, exclusive:false,
    del:false, server:false, wipe:false, banMax:'3m', stats:true,
    ipControl:false, userControl:false, whitelist:false
  }
};
var BAN_OPTIONS = [
  ['1h','۱ ساعت'], ['1d','۱ روز'], ['7d','۷ روز'], ['2w','۲ هفته'],
  ['1m','۱ ماه'], ['3m','۳ ماه'], ['8m','۸ ماه'], ['permanent','دائمی']
];
var DUR_MS = {
  '1h':3600000, '1d':86400000, '7d':604800000, '2w':1209600000,
  '1m':2592000000, '3m':7776000000, '8m':20736000000, 'permanent':0
};

function getPerm() {
  var rank = (currentUserData && currentUserData.rank) || 'کاربر';
  if (currentPhone === CREATOR_PHONE || rank === 'سازنده') return RANK_PERM['سازنده'];
  return RANK_PERM[rank] || { panel:false };
}
function fillBanOptions(max) {
  var order = BAN_OPTIONS.map(function(o) { return o[0]; });
  var idx = order.indexOf(max);
  var sel = document.getElementById('editBanDuration');
  if (!sel) return;
  sel.innerHTML = '';
  for (var i = 0; i < BAN_OPTIONS.length; i++) {
    if (idx < 0 || i <= idx) {
      var op = document.createElement('option');
      op.value = BAN_OPTIONS[i][0];
      op.textContent = BAN_OPTIONS[i][1];
      sel.appendChild(op);
    }
  }
  if (sel.options.length) sel.selectedIndex = sel.options.length - 1;
}

var GROUP_ICONS = {
  shield: '<svg viewBox="0 0 24 24"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/></svg>',
  crown: '<svg viewBox="0 0 24 24"><path d="M12 1L9 9l-7 3 2 9h16l2-9-7-3-3-8z"/></svg>',
  star: '<svg viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>'
};
function getGroupIcon(key) { return GROUP_ICONS[key] || GROUP_ICONS.shield; }

var avatars = [
  {id:1, src:'3000.webp', price:0, owned:false, free:true},
  {id:2, src:'3001.webp', price:0, owned:false, free:true},
  {id:3, src:'3002.webp', price:0, owned:false, free:true},
  {id:4, src:'3003.webp', price:0, owned:false, free:true},
  {id:5, src:'601.webp', price:300, owned:false},
  {id:6, src:'602.webp', price:200, owned:false},
  {id:7, src:'603.webp', price:60, owned:false},
  {id:8, src:'604.webp', price:50, owned:false},
  {id:9, src:'605.webp', price:50, owned:false},
  {id:10, src:'606.webp', price:300, owned:false},
  {id:11, src:'607.webp', price:250, owned:false},
  {id:12, src:'608.webp', price:70, owned:false},
  {id:13, src:'609.webp', price:200, owned:false},
  {id:14, src:'610.webp', price:200, owned:false},
  {id:15, src:'611.webp', price:150, owned:false},
  {id:16, src:'612.webp', price:300, owned:false},
  {id:17, src:'613.webp', price:300, owned:false},
  {id:18, src:'614.webp', price:50, owned:false},
  {id:19, src:'615.webp', price:50, owned:false},
  {id:20, src:'616.webp', price:300, owned:false},
  {id:21, src:'617.webp', price:75, owned:false},
  {id:22, src:'618.webp', price:300, owned:false},
  {id:23, src:'619.webp', price:100, owned:false},
  {id:24, src:'620.webp', price:200, owned:false},
  {id:901, src:'655.webm', price:0, owned:false, exclusive:true},
  {id:902, src:'2000.webm', price:0, owned:false, exclusive:true},
  {id:903, src:'2003.webm', price:0, owned:false, exclusive:true},
  {id:904, src:'2001.webm', price:0, owned:false, exclusive:true},
  {id:905, src:'2002.webm', price:0, owned:false, exclusive:true}
];
var templates = [
  {id:'t1', src:'Ga1.webp', price:1500, name:'قالب طلایی'},
  {id:'t2', src:'Ga2.webp', price:2000, name:'قالب الماسی'},
  {id:'t3', src:'Ga3.webp', price:1000, name:'قالب نقره‌ای'}
];

window.avatarLoadError = function(img, src) {
  img.style.display = 'none';
  var box = img.parentElement;
  if (box && !box.querySelector('.avatar-missing')) {
    var d = document.createElement('div');
    d.className = 'avatar-missing';
    d.innerHTML = '❌';
    box.appendChild(d);
  }
};
function setupVideoObserver() {
  if (videoObserver) return;
  videoObserver = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      var v = entry.target;
      if (entry.isIntersecting) {
        if (v.paused) v.play().catch(function(){});
      } else {
        if (!v.paused) v.pause();
      }
    });
  }, { threshold: 0.1 });
}
function observeVideos(container) {
  if (!container) return;
  setupVideoObserver();
  var vs = container.querySelectorAll('video');
  for (var i = 0; i < vs.length; i++) videoObserver.observe(vs[i]);
}
function sanitizeUserData(user, phone) {
  if (!user) return user;
  var isCreator = (phone === CREATOR_PHONE);

  // ⚠️ رفع: فقط برای غیرسازنده آواتار اجباری رو پاک کن
  if (user.avatar === '655.webm' && !isCreator) {
    user.avatar = user.previousAvatar || 'Mafia2.png';
  }

  // ⚠️ رفع: useExclusive تعریف‌نشده = false
  if (user.useExclusive === undefined) user.useExclusive = false;

  // ⚠️ رفع: اگر exclusiveAvatar نیست ولی useExclusive=true، خاموش کن
  if (!user.exclusiveAvatar && user.useExclusive === true) {
    user.useExclusive = false;
  }

  if (user.coins < 0) user.coins = 0;
  if (user.gems < 0) user.gems = 0;
  if (user.dollars < 0) user.dollars = 0;
  if (user.cups === undefined) user.cups = 0;
  if (user.hours === undefined) user.hours = 0;
  if (!user.ownedTemplates) user.ownedTemplates = [];
  if (!user.ownedAvatars) user.ownedAvatars = [];

  var xp = Math.floor((user.cups / 10) * 20 + (user.hours || 0) * 100);
  user.xp = xp;
  var level = 1;
  if (xp >= 1000) {
    level = 2 + Math.floor((xp - 3000) / 1000);
    if (level < 2) level = 2;
    if (level > 100) level = 100;
  }
  user.level = level;
  return user;
}
function getValidAvatar(src, phone) {
  if (src === '655.webm' && phone !== CREATOR_PHONE) return 'Mafia2.png';
  return src;
}
function createMediaElement(src) {
  if (!src) src = 'Mafia2.png';
  var isVideo = src.endsWith('.webm') || src.endsWith('.mp4') ||
                src.endsWith('.mov') || src.indexOf('data:video') === 0;
  if (isVideo) {
    var v = document.createElement('video');
    v.src = src;
    v.autoplay = true;
    v.loop = true;
    v.muted = true;
    v.playsInline = true;
    v.setAttribute('muted', 'muted');
    v.setAttribute('playsinline', 'playsinline');
    v.style.objectFit = 'cover';
    return v;
  }
  var i = document.createElement('img');
  i.src = src;
  i.onerror = function() { this.style.display = 'none'; };
  return i;
}

/* ═══════════════════════════════════════════════════════════ */
/*  ⚡ updateGlobalAvatar - رفع کامل سینک آواتار اختصاصی          */
/* ═══════════════════════════════════════════════════════════ */
function updateGlobalAvatar(src) {
  if (!currentUserData) return;
  var validSrc = src || 'Mafia2.png';

  // ⚠️ رفع: اگر آواتار اختصاصی فعال داره، اولویت اول
  if (currentUserData.exclusiveAvatar && currentUserData.useExclusive === true) {
    validSrc = currentUserData.exclusiveAvatar;
  }

  validSrc = getValidAvatar(validSrc, currentPhone);
  var templateSrc = currentUserData.currentTemplate || null;

  var containers = [
    document.getElementById('mainAvatarContainer'),
    document.getElementById('openAvatarShop'),
    document.getElementById('showcaseAvatarContainer'),
    document.getElementById('templateShowcaseContainer')
  ];

  function buildContent() {
    var frag = document.createDocumentFragment();
    if (templateSrc) {
      var wrapper = document.createElement('div');
      wrapper.className = 'avatar-with-template';
      var inner = document.createElement('div');
      inner.className = 'avatar-inner';
      inner.appendChild(createMediaElement(validSrc));
      wrapper.appendChild(inner);
      var overlay = document.createElement('img');
      overlay.className = 'template-overlay';
      overlay.src = templateSrc;
      wrapper.appendChild(overlay);
      frag.appendChild(wrapper);
    } else {
      frag.appendChild(createMediaElement(validSrc));
    }
    return frag;
  }

  for (var i = 0; i < containers.length; i++) {
    var c = containers[i];
    if (!c) continue;
    c.innerHTML = '';
    c.appendChild(buildContent());
    observeVideos(c);
  }

  // ⚠️ رفع: اگر شاپ بازه، دوباره رندر کن تا حالت انتخاب درست شه
  var shopPage = document.getElementById('avatarShopPage');
  if (shopPage && shopPage.classList.contains('active')) {
    try { renderAvatars(); } catch(e) {}
  }
}

function updateUIWithData(user) {
  if (!user) return;
  var setText = function(id, val) {
    var e = document.getElementById(id);
    if (e) e.textContent = val;
  };
  setText('displayCoins', toPersianNum(user.coins || 0));
  setText('displayGems', toPersianNum(user.gems || 0));
  setText('displayDollars', toPersianNum(user.dollars || 0));
  setText('mainUserName', user.name || 'کاربر');
  setText('profileUserName', user.name || 'کاربر');
  setText('userCode', toPersianNum(user.userCode || '----'));
  setText('statLevel', toPersianNum(user.level || 1));
  setText('statScore', toPersianNum(user.xp || 0));
  setText('statHours', toPersianNum(user.hours || 0));
  setText('statCompWins', toPersianNum(user.compWins || 0));
  setText('statFriendWins', toPersianNum(user.friendWins || 0));
  setText('statMonitor', toPersianNum(user.monitorCount || 0));
  setText('statBestScore', toPersianNum(user.bestScore || 0));
  setText('statMafiaWins', toPersianNum(user.mafiaWins || 0));
  setText('statCitizenWins', toPersianNum(user.citizenWins || 0));

  updateGlobalAvatar(user.avatar || 'Mafia2.png');

  var tk = getRoleTick(user.rank);
  if (tk) {
    applyTick(document.getElementById('mainUserTick'), tk);
    applyTick(document.getElementById('profileUserTick'), tk);
  }

  var perm = getPerm();
  var btnAdmin = document.getElementById('btnAdmin');
  if (btnAdmin) btnAdmin.style.display = perm.panel ? 'flex' : 'none';
  var adminTools = document.getElementById('adminTools');
  if (adminTools) adminTools.style.display = perm.server ? 'block' : 'none';
  var btnUC = document.getElementById('btnUserControl');
  if (btnUC) btnUC.style.display = perm.userControl ? 'block' : 'none';
  var btnWL = document.getElementById('btnWhitelistIP');
  if (btnWL) btnWL.style.display = perm.whitelist ? 'block' : 'none';

  shopGold = user.coins || 0;
  shopGems = user.gems || 0;
  shopDollars = user.dollars || 0;

  var s1 = document.getElementById('shopGemAmount'); if (s1) s1.textContent = toPersianNum(shopGems);
  var s2 = document.getElementById('shopGemAmount2'); if (s2) s2.textContent = toPersianNum(shopGems);
  var c1 = document.getElementById('shopGoldAmount'); if (c1) c1.textContent = toPersianNum(shopGold);
  var c2 = document.getElementById('shopGoldAmount2'); if (c2) c2.textContent = toPersianNum(shopGold);
  var d1 = document.getElementById('shopDollarAmount'); if (d1) d1.textContent = toPersianNum(shopDollars);
  var d2 = document.getElementById('shopDollarAmount2'); if (d2) d2.textContent = toPersianNum(shopDollars);
}

/* ═══════════════════════════════════════════════════════════ */
/*  isServerLocked - چک دوگانه                                    */
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

function isAdminLocked() {
  try {
    var lock = parseInt(localStorage.getItem('__admin_lock_' + currentPhone) || '0');
    if (!lock) return false;
    if (Date.now() - lock < ADMIN_LOCK_MS) return true;
    localStorage.removeItem('__admin_lock_' + currentPhone);
    return false;
  } catch(e) { return false; }
}
function setAdminLock() {
  try { localStorage.setItem('__admin_lock_' + currentPhone, String(Date.now())); } catch(e) {}
}

async function saveUserData() {
  if (!currentUserData || !currentPhone) return;
  if (pauseSync) return;
  var am = document.getElementById('adminModal');
  if (am && am.classList.contains('active')) return;
  var eu = document.getElementById('editUserModal');
  if (eu && eu.classList.contains('active')) return;
  if (isAdminLocked()) {
    try {
      var fresh = await getUser(currentPhone);
      if (fresh) {
        currentUserData = sanitizeUserData(fresh, currentPhone);
        localStorage.setItem('user_cache_' + currentPhone, JSON.stringify(currentUserData));
        updateUIWithData(currentUserData);
      }
    } catch(e) {}
    return;
  }
  currentUserData.lastUpdatedAt = Date.now();
  currentUserData = sanitizeUserData(currentUserData, currentPhone);
  localStorage.setItem('user_cache_' + currentPhone, JSON.stringify(currentUserData));
  await saveUser(currentPhone, currentUserData);
  var allUsers = await getAllUsers();
  allUsers[currentPhone] = currentUserData;
  await saveAllUsers(allUsers);
  sendLive('user_' + currentPhone, 'updated', { phone: currentPhone });
}
async function saveAvatarToStorage(src) {
  if (!currentUserData || !currentPhone) return;
  if (src === '655.webm' && currentPhone !== CREATOR_PHONE) return;
  if (isAdminLocked()) return;
  if (currentUserData.avatar && currentUserData.avatar !== src) {
    currentUserData.previousAvatar = currentUserData.avatar;
  }
  currentUserData.avatar = src;
  currentUserData.useExclusive = false;
  await saveUserData();
}
async function saveTemplateToStorage(src) {
  if (!currentUserData || !currentPhone) return;
  if (isAdminLocked()) return;
  currentUserData.currentTemplate = src;
  await saveUserData();
}
async function changeUsername() {
  var nn = prompt("نام جدید (حداکثر ۲۰ کاراکتر):");
  if (nn && nn.trim() !== "") {
    var trimmed = nn.trim();
    if (trimmed.length > 20) { showShopNotification('حداکثر ۲۰ کاراکتر!', 'error'); return; }
    if (currentUserData.coins >= 100) {
      currentUserData.coins -= 100;
      currentUserData.name = trimmed;
      await saveUserData();
      updateUIWithData(currentUserData);
    } else showShopNotification('۱۰۰ سکه نیاز است', 'error');
  }
}
function copyToClipboard(t, m) {
  try {
    navigator.clipboard.writeText(t).then(function() {
      showShopNotification(m || 'کپی شد!');
    });
  } catch(e) {}
}
function closeModal(id) {
  var e = document.getElementById(id);
  if (e) e.classList.remove('active');
}
function closeEditUser() {
  var e = document.getElementById('editUserModal');
  if (e) e.classList.remove('active');
  editingUserId = null;
  editingUserExclusiveAvatar = null;
  pauseSync = false;
}
function closeAdminModal() {
  var e = document.getElementById('adminModal');
  if (e) e.classList.remove('active');
  pauseSync = false;
}
function showShopNotification(m, t) {
  var n = document.getElementById('shopNotification');
  if (!n) return;
  n.textContent = m;
  n.className = 'shop-notification show' + (t === 'error' ? ' error' : '');
  setTimeout(function() { n.classList.remove('show'); }, 3000);
}
function playClickSound() {
  try {
    var s = document.getElementById('clickSound');
    if (s) { s.currentTime = 0; s.play().catch(function(){}); }
  } catch (e) {}
}

/* ═══════════════════════════════════════════════════════════ */
/*  Group + Rank                                               */
/* ═══════════════════════════════════════════════════════════ */
async function findUserGroup(phone) {
  try {
    var groups = await getGroups();
    for (var i = 0; i < groups.length; i++) {
      var g = groups[i];
      if (!g) continue;
      if (g.owner === phone) return g;
      if (g.members && g.members.indexOf(phone) > -1) return g;
      if (g.deputies && g.deputies.indexOf(phone) > -1) return g;
    }
    return null;
  } catch(e) { return null; }
}
async function updateGroupDisplay() {
  var nameEl = document.getElementById('profileGroupName');
  var badgeEl = document.getElementById('profileGroupBadge');
  if (!nameEl || !badgeEl) return;
  try {
    nameEl.textContent = 'در حال بارگذاری...';
    badgeEl.className = 'clan-badge no-group';
    badgeEl.innerHTML = '❌';
    if (!currentPhone) return;
    var group = await findUserGroup(currentPhone);
    if (group) {
      nameEl.textContent = group.name || 'گروه';
      badgeEl.className = 'clan-badge has-group';
      badgeEl.innerHTML = '';
      if (group.logo && typeof group.logo === 'string' &&
          (group.logo.indexOf('.webp') > -1 || group.logo.indexOf('.png') > -1 ||
           group.logo.indexOf('.jpg') > -1 || group.logo.indexOf('data:image') > -1)) {
        var img = document.createElement('img');
        img.src = group.logo;
        img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:6px;';
        img.onerror = function() { badgeEl.innerHTML = getGroupIcon('shield'); };
        badgeEl.appendChild(img);
      } else {
        badgeEl.innerHTML = getGroupIcon(group.logo || 'shield');
      }
      userGroupCache = group;
    } else {
      nameEl.textContent = 'بدون گروه';
      badgeEl.className = 'clan-badge no-group';
      badgeEl.innerHTML = '❌';
    }
  } catch(e) {}
}
async function getClanRanking() {
  try {
    var groups = await getGroups();
    if (!groups || !groups.length) return [];
    var allUsers = await getAllUsers();
    var ranking = groups.map(function(g) {
      var totalPoints = parseInt(g.extraPoints) || 0;
      if (g.members) {
        for (var i = 0; i < g.members.length; i++) {
          var u = allUsers[g.members[i]];
          if (u) totalPoints += ((parseInt(u.cups) || 0) * 2) + ((parseInt(u.hours) || 0) * 20);
        }
      }
      return {
        id: g.id,
        name: g.name || 'گروه',
        logo: g.logo || 'shield',
        points: totalPoints,
        memberCount: g.members ? g.members.length : 0
      };
    });
    ranking.sort(function(a, b) { return b.points - a.points; });
    for (var j = 0; j < ranking.length; j++) ranking[j].rank = j + 1;
    return ranking;
  } catch(e) { return []; }
}
async function updateClanRank() {
  var el = document.getElementById('statClanRank');
  if (!el) return;
  try {
    if (!currentPhone) { el.textContent = '-'; return; }
    var ranking = await getClanRanking();
    if (!ranking.length) { el.textContent = '-'; return; }
    var group = await findUserGroup(currentPhone);
    if (!group) { el.textContent = '-'; return; }
    var myRank = ranking.find(function(r) { return r.id === group.id; });
    el.textContent = myRank ? toPersianNum(myRank.rank) : '-';
  } catch(e) { el.textContent = '-'; }
}
async function showClanRankingModal() {
  var modal = document.getElementById('clanRankingModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'clanRankingModal';
    modal.className = 'modal-overlay';
    modal.innerHTML = '<div class="modal-box" style="max-width:420px;"><div class="modal-header"><div class="modal-title">🏆 رتبه‌بندی کلن‌ها</div><div class="modal-close" onclick="window.closeModal(\'clanRankingModal\')">✕</div></div><div class="modal-body" id="clanRankingBody"><div style="text-align:center;padding:20px;color:#aaa;">در حال بارگذاری...</div></div></div>';
    document.body.appendChild(modal);
  }
  modal.classList.add('active');
  var body = document.getElementById('clanRankingBody');
  if (!body) return;
  body.innerHTML = '<div style="text-align:center;padding:20px;color:#aaa;">در حال بارگذاری...</div>';
  var ranking = await getClanRanking();
  var cfg = await getTournamentConfig();
  if (!ranking.length) {
    body.innerHTML = '<div style="text-align:center;padding:20px;color:#888;">هیچ کلنی وجود ندارد</div>';
    return;
  }
  var html = '';
  for (var i = 0; i < ranking.length; i++) {
    var r = ranking[i];
    var medal = r.rank === 1 ? '🥇' : r.rank === 2 ? '🥈' : r.rank === 3 ? '🥉' : '#' + toPersianNum(r.rank);
    var logoHtml = '';
    if (r.logo && typeof r.logo === 'string' &&
        (r.logo.indexOf('.webp') > -1 || r.logo.indexOf('.png') > -1 || r.logo.indexOf('data:image') > -1)) {
      logoHtml = '<img src="' + r.logo + '" style="width:100%;height:100%;object-fit:cover;border-radius:8px;">';
    } else {
      logoHtml = getGroupIcon(r.logo || 'shield');
    }
    var prizeText = '';
    var pc = null;
    if (r.rank === 1 && cfg.rank1) pc = cfg.rank1;
    else if (r.rank === 2 && cfg.rank2) pc = cfg.rank2;
    else if (r.rank === 3 && cfg.rank3) pc = cfg.rank3;
    else if (r.rank >= 4 && r.rank <= 10 && cfg.rank4_10) pc = cfg.rank4_10;
    if (pc) {
      var parts = [];
      if (pc.gems > 0) parts.push('💎 ' + toPersianNum(pc.gems));
      if (pc.coins > 0) parts.push('🪙 ' + toPersianNum(pc.coins));
      if (pc.dollars > 0) parts.push('💵 ' + toPersianNum(pc.dollars));
      if (pc.note) parts.push(pc.note);
      if (parts.length) prizeText = '🎁 ' + parts.join(' • ');
    }
    html += '<div style="display:flex;align-items:center;gap:12px;background:rgba(255,255,255,.05);padding:10px;border-radius:12px;margin-bottom:8px;border-right:4px solid ' + (r.rank === 1 ? '#ffd700' : r.rank === 2 ? '#c0c0c0' : r.rank === 3 ? '#cd7f32' : '#2a6ac0') + ';">';
    html += '<div style="font-size:22px;font-weight:900;min-width:40px;text-align:center;">' + medal + '</div>';
    html += '<div style="width:48px;height:48px;background:rgba(0,0,0,.3);border-radius:10px;overflow:hidden;display:flex;align-items:center;justify-content:center;padding:4px;">' + logoHtml + '</div>';
    html += '<div style="flex:1;">';
    html += '<div style="color:#fff;font-weight:700;font-size:14px;">' + r.name + '</div>';
    html += '<div style="color:#4fc3f7;font-size:11px;">' + toPersianNum(r.points) + ' امتیاز • ' + toPersianNum(r.memberCount) + ' عضو</div>';
    if (prizeText) html += '<div style="color:#ffb74d;font-size:11px;margin-top:4px;">' + prizeText + '</div>';
    html += '</div></div>';
  }
  body.innerHTML = html;
}

/* ═══════════════════════════════════════════════════════════ */
/*  Away Timer                                                 */
/* ═══════════════════════════════════════════════════════════ */
function startAwayTimer() {
  if (currentPhone === CREATOR_PHONE) return;
  clearTimeout(awayTimer);
  awayTimer = setTimeout(async function() {
    isUserAway = true;
    if (window.ogShowAway) { try { window.ogShowAway(); } catch(e) {} }
    try {
      var loggedIn = JSON.parse(localStorage.getItem('currentLoggedInUser') || 'null');
      if (!loggedIn || !loggedIn.phone) return;
      var user = await getUser(loggedIn.phone);
      if (user) {
        user.online = false;
        user.lastSeen = Date.now();
        await saveUser(loggedIn.phone, user);
      }
      setFBOnline(loggedIn.phone, false, {});
    } catch(e) {}
  }, AWAY_TIMEOUT_MS);
}
function cancelAwayTimer() {
  clearTimeout(awayTimer);
  awayTimer = null;
}
async function reconnectUser() {
  if (!isUserAway) return;
  isUserAway = false;
  try {
    var loggedIn = JSON.parse(localStorage.getItem('currentLoggedInUser') || 'null');
    if (!loggedIn || !loggedIn.phone) return;
    var user = await getUser(loggedIn.phone);
    if (user) {
      user.online = true;
      user.lastSeen = Date.now();
      await saveUser(loggedIn.phone, user);
    }
    setFBOnline(loggedIn.phone, true, {});
  } catch(e) {}
}
document.addEventListener('visibilitychange', function() {
  if (document.hidden) startAwayTimer();
  else { cancelAwayTimer(); reconnectUser(); }
});
window.addEventListener('blur', startAwayTimer);
window.addEventListener('focus', function() {
  cancelAwayTimer();
  reconnectUser();
});

/* ═══════════════════════════════════════════════════════════ */
/*  ⚡ Server Lock - با ریکاوری خودکار                            */
/* ═══════════════════════════════════════════════════════════ */
function lockServerForeverInGame() {
  if (gameServerLocked) return;
  gameServerLocked = true;

  var hideIds = [
    'profilePage', 'avatarShopPage', 'templateShopPage', 'newsModal',
    'adminModal', 'editUserModal', 'settingsModal', 'changePasswordModal',
    'competitiveOverlay', 'gameStartedOverlay', 'purchaseModal', 'menuDropdown'
  ];
  for (var i = 0; i < hideIds.length; i++) {
    var el = document.getElementById(hideIds[i]);
    if (el) el.style.display = 'none';
  }

  var overlay = document.getElementById('serverDownOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'serverDownOverlay';
    document.body.appendChild(overlay);
  }

  overlay.innerHTML =
    '<div style="font-size:80px;">🔌</div>' +
    '<div style="color:#ff6b6b;font-size:26px;font-weight:900;margin-top:24px;text-shadow:0 3px 8px rgba(0,0,0,.5);">سرور قطع است</div>' +
    '<div style="color:rgba(255,255,255,0.9);font-size:15px;margin-top:16px;line-height:2.2;">بازی موقتاً در دسترس نیست<br>در حال تلاش برای اتصال مجدد...</div>' +
    '<div id="serverRetryInfo" style="color:#4fc3f7;font-size:12px;margin-top:20px;">⏳ بررسی خودکار هر ۳ ثانیه</div>';

  overlay.style.cssText =
    'position:fixed !important;inset:0 !important;width:100vw !important;height:100vh !important;' +
    'z-index:2147483647 !important;' +
    'background:linear-gradient(180deg,rgba(10,15,30,0.99),rgba(0,0,0,0.99)) !important;' +
    'display:flex !important;align-items:center !important;justify-content:center !important;' +
    'flex-direction:column !important;text-align:center !important;padding:30px !important;' +
    'font-family:Tahoma,Vazirmatn,sans-serif !important;';

  document.body.style.overflow = 'hidden';
  document.documentElement.style.overflow = 'hidden';

  // ⚠️ رفع: چک خودکار برای ریکاوری - کاربر logout نمیشه
  if (__serverRecoveryInterval) clearInterval(__serverRecoveryInterval);
  __serverRecoveryInterval = setInterval(async function() {
    try {
      var stillLocked = await isServerLocked();
      if (!stillLocked) {
        clearInterval(__serverRecoveryInterval);
        __serverRecoveryInterval = null;
        gameServerLocked = false;
        var ov = document.getElementById('serverDownOverlay');
        if (ov) ov.remove();
        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';
        // رفرش سبک برای بازگردانی state
        try {
          var fresh = await getUser(currentPhone);
          if (fresh) {
            currentUserData = sanitizeUserData(fresh, currentPhone);
            localStorage.setItem('user_cache_' + currentPhone, JSON.stringify(currentUserData));
            updateUIWithData(currentUserData);
          }
        } catch(e) {}
        showShopNotification('✅ اتصال برقرار شد');
      } else {
        var info = document.getElementById('serverRetryInfo');
        if (info) {
          info.textContent = '⏳ در حال تلاش... (' + new Date().toLocaleTimeString('fa-IR') + ')';
        }
      }
    } catch(e) {}
  }, 3000);
}

/* ═══════════════════════════════════════════════════════════ */
/*  Admin Panel                                                */
/* ═══════════════════════════════════════════════════════════ */
function openAdminPanel() {
  var modal = document.getElementById('adminModal');
  if (!modal) return;
  if (modal.classList.contains('active')) {
    modal.classList.remove('active');
    pauseSync = false;
    return;
  }
  pauseSync = true;
  var ids = ['usersSection','userHistorySection','userControlSection','whitelistSection','tournamentConfig','userLogsSection'];
  for (var i = 0; i < ids.length; i++) {
    var el = document.getElementById(ids[i]);
    if (el) el.style.display = 'none';
  }
  modal.classList.add('active');
  setTimeout(function() {
    getMaintenance().then(function(m) {
      var btn = document.getElementById('btnServerToggle');
      if (btn) {
        if (m && m.on) {
          btn.textContent = 'وصل کردن سرور';
          btn.className = 'edit-btn unban';
        } else {
          btn.textContent = 'قطع سرور';
          btn.className = 'edit-btn ban';
        }
      }
    }).catch(function() {});
  }, 100);
  setTimeout(function() { loadUsers(); }, 100);
  if (currentPhone === CREATOR_PHONE) {
    setTimeout(function() {
      loadTournamentConfig();
      renderBlacklist();
    }, 200);
  }
}

async function loadUsers() {
  var container = document.getElementById('adminUserListContainer');
  if (container) container.innerHTML = '<div style="color:#aaa;padding:20px;text-align:center;">در حال بارگذاری...</div>';
  try {
    var promise = getAllUsers();
    var timeout = new Promise(function(resolve) {
      setTimeout(function() { resolve(null); }, 8000);
    });
    var allUsers = await Promise.race([promise, timeout]);
    if (!allUsers) {
      if (container) container.innerHTML = '<div style="color:#f44336;padding:20px;text-align:center;">خطای شبکه - دوباره تلاش کنید</div>';
      return;
    }
    currentUserList = Object.entries(allUsers).map(function(e) {
      var u = e[1];
      u.phone = e[0];
      return u;
    });
    renderAdminUsers(currentUserList);
  } catch(e) {
    if (container) container.innerHTML = '<div style="color:#f44336;padding:20px;text-align:center;">خطا در بارگذاری</div>';
  }
}

function renderAdminUsers(list) {
  var container = document.getElementById('adminUserListContainer');
  if (!container) return;
  var searchInput = document.getElementById('userSearchInput');
  var searchVal = searchInput ? searchInput.value.trim() : '';
  var filtered = list;
  if (searchVal) {
    filtered = filtered.filter(function(u) {
      return String(u.userCode) === searchVal || String(u.phone).indexOf(searchVal) > -1;
    });
  }
  if (currentAdminTab === 'online') filtered = filtered.filter(function(u) { return u.online === true; });
  else if (currentAdminTab === 'offline') filtered = filtered.filter(function(u) { return u.online === false || u.online === undefined; });
  else if (currentAdminTab === 'banned') filtered = filtered.filter(function(u) { return u.banned === true; });

  filtered.sort(function(a, b) { return (b.lastUpdatedAt || 0) - (a.lastUpdatedAt || 0); });

  if (!filtered.length) {
    container.innerHTML = '<div style="color:#aaa;padding:20px;text-align:center;">کاربری یافت نشد</div>';
    return;
  }
  var html = '';
  for (var i = 0; i < filtered.length; i++) {
    var u = filtered[i];
    var statusClass = u.banned ? 'status-banned' : (u.online ? 'status-online' : 'status-offline');
    var statusText = u.banned ? 'بن شده' : (u.online ? 'آنلاین' : 'آفلاین');
    var lastLoginStr = '';
    if (u.lastLogin) {
      try { lastLoginStr = new Date(u.lastLogin).toLocaleString('fa-IR'); } catch(e) {}
    }
    html += '<div class="admin-user-item" onclick="window.openUserHistory && window.openUserHistory(\'' + u.phone + '\')">';
    html += '<div class="info">';
    html += '<span class="name">' + (u.name || 'کاربر') + ' (کد: ' + (toPersianNum(u.userCode) || '----') + ')</span>';
    html += '<span class="detail">' + u.phone + ' | ' + (u.rank || 'کاربر') + '</span>';
    html += '<span class="detail" style="color:#4fc3f7;">IP: ' + (u.lastIP || 'نامشخص') + '</span>';
    if (lastLoginStr) html += '<span class="detail" style="color:#ffb74d;font-size:10px;">🕐 ' + lastLoginStr + '</span>';
    html += '</div>';
    html += '<span class="status ' + statusClass + '">' + statusText + '</span>';
    html += '</div>';
  }
  container.innerHTML = html;
}

async function openUserHistory(phone) {
  viewingUserHistory = phone;
  try {
    var user = await getUser(phone);
    if (!user) return;
    document.getElementById('usersSection').style.display = 'none';
    document.getElementById('userHistorySection').style.display = 'block';
    document.getElementById('historyUserName').textContent = user.name || 'کاربر';
    var content = document.getElementById('historyContent');
    var html = '';

    html += '<div style="color:#ccc;font-size:12px;background:rgba(255,255,255,.05);padding:12px;border-radius:8px;margin-bottom:8px;line-height:2;">';
    html += '<div><b style="color:#fff;">کد:</b> ' + (toPersianNum(user.userCode) || '----') + '</div>';
    html += '<div><b style="color:#fff;">شماره:</b> <span style="direction:ltr;display:inline-block;">' + phone + '</span></div>';
    html += '<div><b style="color:#fff;">مقام:</b> ' + (user.rank || 'کاربر') + '</div>';
    html += '<div><b style="color:#fff;">سکه:</b> ' + toPersianNum(user.coins || 0) + ' | <b style="color:#fff;">الماس:</b> ' + toPersianNum(user.gems || 0) + ' | <b style="color:#fff;">دولار:</b> ' + toPersianNum(user.dollars || 0) + '</div>';
    html += '<div><b style="color:#fff;">ساعت:</b> ' + toPersianNum(user.hours || 0) + ' | <b style="color:#fff;">کاپ:</b> ' + toPersianNum(user.cups || 0) + '</div>';
    html += '<div><b style="color:#fff;">وضعیت:</b> ' + (user.banned ? '⛔ بن شده' : (user.online ? '🟢 آنلاین' : '⚫ آفلاین')) + '</div>';
    html += '</div>';

    html += '<div style="color:#ccc;font-size:12px;background:rgba(76,175,80,.15);padding:12px;border-radius:8px;margin-bottom:8px;line-height:2;border:1px solid #4caf50;">';
    html += '<div style="color:#4caf50;font-weight:900;font-size:13px;margin-bottom:6px;">📍 آخرین ورود</div>';
    html += '<div><b style="color:#fff;">🕐 زمان:</b> ' + formatDate(user.lastLogin) + '</div>';
    html += '<div><b style="color:#fff;">🌐 IP:</b> <span style="direction:ltr;display:inline-block;color:#4fc3f7;">' + (user.lastIP || 'نامشخص') + '</span></div>';
    html += '<div><b style="color:#fff;">📱 دستگاه:</b> <span style="direction:ltr;display:inline-block;font-size:10px;word-break:break-all;">' + (user.lastDevice || 'نامشخص') + '</span></div>';
    html += '</div>';

    html += '<div style="color:#ccc;font-size:12px;background:rgba(33,150,243,.15);padding:12px;border-radius:8px;margin-bottom:8px;line-height:2;border:1px solid #2196f3;">';
    html += '<div style="color:#2196f3;font-weight:900;font-size:13px;margin-bottom:6px;">📝 ثبت‌نام</div>';
    html += '<div><b style="color:#fff;">🕐 زمان:</b> ' + formatDate(user.registeredAt || user.createdAt) + '</div>';
    html += '<div><b style="color:#fff;">🌐 IP:</b> <span style="direction:ltr;display:inline-block;color:#4fc3f7;">' + (user.registeredIP || 'نامشخص') + '</span></div>';
    html += '<div><b style="color:#fff;">📱 دستگاه:</b> <span style="direction:ltr;display:inline-block;font-size:10px;word-break:break-all;">' + (user.registeredDevice || 'نامشخص') + '</span></div>';
    html += '</div>';

    if (user.deviceInfo) {
      html += '<div style="color:#ccc;font-size:11px;background:rgba(156,39,176,.15);padding:10px;border-radius:8px;margin-bottom:8px;line-height:1.9;border:1px solid #9c27b0;">';
      html += '<div style="color:#ce93d8;font-weight:700;margin-bottom:6px;">📱 اطلاعات دستگاه</div>';
      html += '<div><b style="color:#fff;">صفحه:</b> ' + (user.deviceInfo.screen || '-') + '</div>';
      html += '<div><b style="color:#fff;">پلتفرم:</b> <span style="direction:ltr;">' + (user.deviceInfo.platform || '-') + '</span></div>';
      html += '<div><b style="color:#fff;">زبان:</b> ' + (user.deviceInfo.language || '-') + '</div>';
      html += '<div><b style="color:#fff;">هسته:</b> ' + (user.deviceInfo.cores || '-') + '</div>';
      html += '</div>';
    }

    if (user.loginHistory && user.loginHistory.length) {
      html += '<div style="color:#fff;font-size:13px;font-weight:900;margin:12px 0 8px;">📜 تاریخچه کامل ورودها (' + toPersianNum(user.loginHistory.length) + ')</div>';
      var hist = user.loginHistory.slice().reverse();
      for (var i = 0; i < hist.length; i++) {
        var s = hist[i];
        var t = s.time ? new Date(s.time).toLocaleString('fa-IR') : (s.date || '----');
        html += '<div style="background:rgba(0,0,0,.3);padding:8px 10px;border-radius:8px;margin-bottom:5px;font-size:11px;line-height:1.9;border-right:3px solid ' + (i === 0 ? '#4caf50' : '#555') + ';">';
        html += '<div><b style="color:#4fc3f7;">🕐 ' + t + '</b>' + (i === 0 ? ' <span style="color:#4caf50;font-size:10px;">(آخرین)</span>' : '') + '</div>';
        html += '<div><b style="color:#fff;">🌐 IP:</b> <span style="direction:ltr;display:inline-block;">' + (s.ip || 'نامشخص') + '</span></div>';
        html += '<div style="color:#888;font-size:10px;direction:ltr;word-break:break-all;"><b style="color:#aaa;">📱</b> ' + (s.device || 'نامشخص') + '</div>';
        html += '</div>';
      }
      html += '<button class="edit-btn danger" onclick="window.clearUserSessions && window.clearUserSessions(\'' + phone + '\')" style="width:100%;margin-top:8px;">🗑 پاک کردن تاریخچه ورود</button>';
    } else {
      html += '<div style="color:#888;text-align:center;padding:15px;font-size:12px;">هیچ تاریخچه‌ای ثبت نشده</div>';
    }

    if (user.banHistory && user.banHistory.length) {
      html += '<div style="color:#fff;font-size:13px;font-weight:900;margin:12px 0 8px;">⛔ تاریخچه بن</div>';
      for (var j = 0; j < user.banHistory.length; j++) {
        var b = user.banHistory[j];
        html += '<div style="background:rgba(244,67,54,.1);padding:8px 10px;border-radius:8px;margin-bottom:5px;font-size:11px;line-height:1.9;border-right:3px solid #f44336;">';
        html += '<div><b style="color:#ff6b6b;">🕐 ' + formatDate(b.time) + '</b></div>';
        html += '<div><b style="color:#fff;">توسط:</b> ' + (b.by || 'سیستم') + '</div>';
        html += '<div><b style="color:#fff;">مدت:</b> ' + (b.duration || '----') + '</div>';
        html += '</div>';
      }
    }

    html += '<button class="edit-btn cancel" onclick="window.closeUserHistory && window.closeUserHistory()" style="width:100%;margin-top:10px;">بازگشت</button>';
    html += '<button class="edit-btn info" onclick="window.openEditUser && window.openEditUser(\'' + phone + '\')" style="width:100%;margin-top:8px;">✏️ ویرایش کاربر</button>';

    content.innerHTML = html;
  } catch(e) {}
}
function closeUserHistory() {
  document.getElementById('userHistorySection').style.display = 'none';
  document.getElementById('usersSection').style.display = 'block';
  loadUsers();
}

async function openEditUser(id) {
  var allUsers = await getAllUsers();
  var u = allUsers[id];
  if (!u) return;
  editingUserId = id;
  pauseSync = true;
  editingUserExclusiveAvatar = u.exclusiveAvatar || null;

  var setVal = function(eid, val) {
    var e = document.getElementById(eid);
    if (e) e.value = val;
  };
  setVal('editUserName', u.name || '');
  setVal('editUserCode', u.userCode || '');
  setVal('editUserCoins', u.coins || 0);
  setVal('editUserGems', u.gems || 0);
  setVal('editUserDollars', u.dollars || 0);
  setVal('editUserRole', u.rank || 'کاربر');
  setVal('editUserCups', u.cups || 0);
  setVal('editUserHours', u.hours || 0);
  setVal('editUserLevel', u.level || 1);
  setVal('editUserCompWins', u.compWins || 0);
  setVal('editUserFriendWins', u.friendWins || 0);
  setVal('editUserMonitor', u.monitorCount || 0);
  setVal('editUserMafiaWins', u.mafiaWins || 0);
  setVal('editUserCitizenWins', u.citizenWins || 0);
  setVal('editUserBestScore', u.bestScore || 0);

  var preview = document.getElementById('exclusiveAvatarPreview');
  if (preview) {
    if (u.exclusiveAvatar) {
      if (u.exclusiveAvatar.indexOf('.webm') > -1 || u.exclusiveAvatar.indexOf('.mp4') > -1 || u.exclusiveAvatar.indexOf('data:video') === 0) {
        preview.innerHTML = '<video src="' + u.exclusiveAvatar + '" autoplay loop muted playsinline style="width:100%;height:100%;object-fit:cover;"></video>';
      } else {
        preview.innerHTML = '<img src="' + u.exclusiveAvatar + '" style="width:100%;height:100%;object-fit:cover;">';
      }
    } else {
      preview.innerHTML = '<span class="exclusive-avatar-placeholder">👤</span>';
    }
  }

  var perm = getPerm();
  var setDisp = function(eid, show) {
    var e = document.getElementById(eid);
    if (e) e.style.display = show ? 'block' : 'none';
  };
  setDisp('fieldCoins', perm.coins);
  setDisp('fieldGems', perm.gems);
  setDisp('fieldDollars', perm.dollars);
  setDisp('fieldRank', perm.rank);
  setDisp('fieldStats', perm.stats);
  setDisp('fieldExclusive', perm.exclusive);
  var rd = document.getElementById('rowDelete');
  if (rd) rd.style.display = perm.del ? 'flex' : 'none';
  fillBanOptions(perm.banMax || '1d');

  var bb = document.getElementById('btnBanUser');
  var ub = document.getElementById('btnUnbanUser');
  var bs = await getBanStatus(id);
  if (bs || u.banned) {
    if (bb) bb.style.display = 'none';
    if (ub) ub.style.display = 'block';
  } else {
    if (bb) bb.style.display = 'block';
    if (ub) ub.style.display = 'none';
  }
  document.getElementById('editUserModal').classList.add('active');
}

/* ═══════════════════════════════════════════════════════════ */
/*  ⚡ saveUserEdit - رفع کامل آواتار اختصاصی                      */
/* ═══════════════════════════════════════════════════════════ */
async function saveUserEdit() {
  if (!editingUserId) return;
  var perm = getPerm();
  var allUsers = await getAllUsers();
  var u = allUsers[editingUserId];
  if (!u) { pauseSync = false; return; }

  var getVal = function(eid) {
    var e = document.getElementById(eid);
    return e ? e.value : '';
  };
  u.name = getVal('editUserName').trim() || u.name;
  var newCode = parseInt(getVal('editUserCode'));
  if (newCode > 0) u.userCode = newCode;
  if (perm.coins) { var c = parseInt(getVal('editUserCoins')); u.coins = c < 0 ? 0 : (c || 0); }
  if (perm.gems) { var g = parseInt(getVal('editUserGems')); u.gems = g < 0 ? 0 : (g || 0); }
  if (perm.dollars) { var d = parseInt(getVal('editUserDollars')); u.dollars = d < 0 ? 0 : (d || 0); }
  if (perm.rank) u.rank = getVal('editUserRole');
  if (perm.stats) {
    u.cups = parseInt(getVal('editUserCups')) || 0;
    u.hours = parseFloat(getVal('editUserHours')) || 0;
    u.level = parseInt(getVal('editUserLevel')) || 1;
    u.compWins = parseInt(getVal('editUserCompWins')) || 0;
    u.friendWins = parseInt(getVal('editUserFriendWins')) || 0;
    u.monitorCount = parseInt(getVal('editUserMonitor')) || 0;
    u.mafiaWins = parseInt(getVal('editUserMafiaWins')) || 0;
    u.citizenWins = parseInt(getVal('editUserCitizenWins')) || 0;
    u.bestScore = parseInt(getVal('editUserBestScore')) || 0;
  }

  // ⚠️ رفع: منطق کامل آواتار اختصاصی
  if (perm.exclusive) {
    if (editingUserExclusiveAvatar && editingUserExclusiveAvatar !== 'removed') {
      // اگر قبلاً exclusive داشت، previousAvatar رو دست نزن
      if (!u.previousAvatar || u.previousAvatar === u.exclusiveAvatar) {
        u.previousAvatar = u.avatar || 'Mafia2.png';
      }
      u.exclusiveAvatar = editingUserExclusiveAvatar;
      u.useExclusive = true;
      // ⚠️ avatar اصلی کاربر رو دست نمی‌زنیم (جدا نگه می‌داریم)
    } else if (editingUserExclusiveAvatar === 'removed' || editingUserExclusiveAvatar === null) {
      if (u.exclusiveAvatar) {
        var oldExcl = u.exclusiveAvatar; // ⚠️ قبل از حذف ذخیره کن
        delete u.exclusiveAvatar;
        u.useExclusive = false;
        if (u.ownedAvatars) {
          u.ownedAvatars = u.ownedAvatars.filter(function(a) {
            return a.indexOf('exclusive_') !== 0 && a !== oldExcl;
          });
        }
        // برگرداندن آواتار اصلی قبلی
        if (u.previousAvatar && u.previousAvatar !== oldExcl) {
          u.avatar = u.previousAvatar;
        } else if (!u.avatar || u.avatar === oldExcl) {
          u.avatar = 'Mafia2.png';
        }
      }
    }
  }

  u.lastUpdatedAt = Date.now();
  allUsers[editingUserId] = u;
  await saveUser(editingUserId, u);
  await saveAllUsers(allUsers);

  notifyUserUpdate(editingUserId, 'admin_edit');
  sendLive('user_' + editingUserId, 'admin_edit', {
    phone: editingUserId,
    force: true,
    resetAvatar: true,
    exclusive: u.exclusiveAvatar || null,
    useExclusive: u.useExclusive
  });

  if (editingUserId === currentPhone) {
    setAdminLock();
    currentUserData = u;
    localStorage.setItem('user_cache_' + currentPhone, JSON.stringify(currentUserData));
    updateUIWithData(currentUserData);
  }
  closeEditUser();
  await loadUsers();
  showShopNotification('✅ ذخیره شد و فوری اعمال شد');
}

async function banUser(type) {
  type = type || 'account';
  if (!editingUserId) return;
  var perm = getPerm();
  var allUsers = await getAllUsers();
  var u = allUsers[editingUserId];
  if (!u) return;
  if (editingUserId === CREATOR_PHONE) {
    showShopNotification('سازنده بن نمیشه', 'error');
    return;
  }
  var dur = document.getElementById('editBanDuration').value;
  var banData = {
    isBanned: true,
    phone: editingUserId,
    bannedBy: currentUserData.name,
    reason: 'تخلف',
    duration: dur,
    bannedAt: new Date().toISOString(),
    expiresAt: DUR_MS[dur] ? new Date(Date.now() + DUR_MS[dur]).toISOString() : null
  };
  if (type === 'device') {
    var devId = u.lastDevice || u.registeredDevice;
    if (!devId) { showShopNotification('دستگاه یافت نشد', 'error'); return; }
    await setDeviceBan(devId, banData);
    showShopNotification('دستگاه بن شد');
  } else if (type === 'ip') {
    var ip = u.lastIP || u.registeredIP;
    if (!ip) { showShopNotification('IP یافت نشد', 'error'); return; }
    await setIPBan(ip, banData);
    showShopNotification('IP بن شد');
  } else {
    await redisSet('ban:' + editingUserId, banData);
    u.banned = true;
    u.lastUpdatedAt = Date.now();
    allUsers[editingUserId] = u;
    await saveAllUsers(allUsers);
    await saveUser(editingUserId, u);
    showShopNotification('اکانت بن شد');
  }
  notifyUserUpdate(editingUserId, 'banned');
  sendLive('user_' + editingUserId, 'banned', { phone: editingUserId });
  closeEditUser();
  await loadUsers();
}

async function unbanUser() {
  if (!editingUserId) return;
  var allUsers = await getAllUsers();
  var u = allUsers[editingUserId];
  if (!u) return;
  await redisDel('ban:' + editingUserId);
  u.banned = false;
  u.lastUpdatedAt = Date.now();
  allUsers[editingUserId] = u;
  await saveAllUsers(allUsers);
  await saveUser(editingUserId, u);

  var devId = u.lastDevice || u.registeredDevice;
  if (devId) await redisDel('device_ban:' + devId);
  var ip = u.lastIP || u.registeredIP;
  if (ip) await redisDel('ip_ban:' + ip);

  notifyUserUpdate(editingUserId, 'unbanned');
  sendLive('user_' + editingUserId, 'unbanned', { phone: editingUserId });
  closeEditUser();
  await loadUsers();
  showShopNotification('رفع بن شد');
}

async function deleteAccount() {
  if (!editingUserId) return;
  var perm = getPerm();
  if (!perm.del) { showShopNotification('دسترسی ندارید', 'error'); return; }
  if (!confirm('حذف کامل اکانت؟')) return;
  var allUsers = await getAllUsers();
  delete allUsers[editingUserId];
  await saveAllUsers(allUsers);
  await redisDel('user:' + editingUserId);
  notifyUserUpdate(editingUserId, 'deleted');
  sendLive('user_' + editingUserId, 'deleted', { phone: editingUserId });
  closeEditUser();
  await loadUsers();
  showShopNotification('حذف شد');
}

async function wipeDatabase() {
  if (currentPhone !== CREATOR_PHONE) { showShopNotification('فقط سازنده', 'error'); return; }
  if (!confirm('پاک کردن همه اکانت‌های عادی؟')) return;
  var allUsers = await getAllUsers();
  var keep = {};
  for (var k in allUsers) {
    if (allUsers[k].rank && allUsers[k].rank !== 'کاربر') keep[k] = allUsers[k];
    else {
      await redisDel('user:' + k);
      await redisDel('ban:' + k);
    }
  }
  await saveAllUsers(keep);
  await loadUsers();
  showShopNotification('پاک شد');
}

async function toggleServer() {
  if (currentPhone !== CREATOR_PHONE) { showShopNotification('فقط سازنده', 'error'); return; }
  var m = await getMaintenance();
  var isOn = m && m.on;
  var newState = !isOn;
  await setMaintenance(newState);
  setFBValue('server_state/on', newState);
  sendLive('global', 'server_toggle', { on: newState });
  showShopNotification(newState ? 'سرور قطع شد' : 'سرور وصل شد');
  var btn = document.getElementById('btnServerToggle');
  if (btn) {
    if (newState) {
      btn.textContent = 'وصل کردن سرور';
      btn.className = 'edit-btn unban';
    } else {
      btn.textContent = 'قطع سرور';
      btn.className = 'edit-btn ban';
    }
  }
}

async function forceUserLogin() {
  var phone = document.getElementById('controlUserPhone').value.trim();
  if (!phone) { showShopNotification('شماره را وارد کنید', 'error'); return; }
  var user = await getUser(phone);
  if (!user) { showShopNotification('کاربر یافت نشد', 'error'); return; }
  user.online = true;
  user.lastUpdatedAt = Date.now();
  await saveUser(phone, user);
  notifyUserUpdate(phone, 'force_login');
  sendLive('user_' + phone, 'force_login', { phone: phone });
  showShopNotification('کاربر وارد شد');
}

async function forceUserLogout() {
  var phone = document.getElementById('controlUserPhone').value.trim();
  if (!phone) { showShopNotification('شماره را وارد کنید', 'error'); return; }
  var user = await getUser(phone);
  if (!user) { showShopNotification('کاربر یافت نشد', 'error'); return; }
  user.online = false;
  user.lastUpdatedAt = Date.now();
  await saveUser(phone, user);
  notifyUserUpdate(phone, 'force_logout');
  sendLive('user_' + phone, 'force_logout', { phone: phone });
  showShopNotification('کاربر خارج شد');
}

async function clearUserData() {
  var phone = document.getElementById('controlUserPhone').value.trim();
  if (!phone) { showShopNotification('شماره را وارد کنید', 'error'); return; }
  if (!confirm('پاک‌سازی داده‌ها؟')) return;
  var user = await getUser(phone);
  if (!user) return;
  user.coins = 0;
  user.gems = 0;
  user.dollars = 0;
  user.cups = 0;
  user.hours = 0;
  user.xp = 0;
  user.level = 1;
  await saveUser(phone, user);
  notifyUserUpdate(phone, 'admin_edit');
  showShopNotification('پاک شد');
}

async function clearUserSessionsFromPanel() {
  var phone = document.getElementById('controlUserPhone').value.trim();
  if (!phone) { showShopNotification('شماره را وارد کنید', 'error'); return; }
  var user = await getUser(phone);
  if (!user) return;
  user.loginHistory = [];
  await saveUser(phone, user);
  showShopNotification('تاریخچه پاک شد');
}

async function addWhitelistIP() {
  var ip = document.getElementById('whitelistIPInput').value.trim();
  var note = document.getElementById('whitelistNoteInput').value.trim();
  if (!ip) { showShopNotification('IP را وارد کنید', 'error'); return; }
  await addToWhitelist(ip, note, currentPhone);
  document.getElementById('whitelistIPInput').value = '';
  document.getElementById('whitelistNoteInput').value = '';
  showShopNotification('اضافه شد');
  refreshWhitelistUI();
}

async function removeWhitelistIP(ip) {
  if (!confirm('حذف این IP؟')) return;
  await removeFromWhitelist(ip);
  showShopNotification('حذف شد');
  refreshWhitelistUI();
}

async function refreshWhitelistUI() {
  var list = await getAllWhitelistIPs();
  var container = document.getElementById('whitelistItemsList');
  if (!container) return;
  var ips = Object.keys(list);
  if (!ips.length) {
    container.innerHTML = '<div style="color:#888;font-size:11px;text-align:center;padding:8px;">خالی</div>';
    return;
  }
  var html = '';
  for (var i = 0; i < ips.length; i++) {
    html += '<div class="whitelist-item"><span style="direction:ltr;">' + ips[i] + '</span><button onclick="window.removeWhitelistIP && window.removeWhitelistIP(\'' + ips[i] + '\')">حذف</button></div>';
  }
  container.innerHTML = html;
}

async function quickWhitelistUser(ip, deviceId, userName) {
  if (!ip && !deviceId) return;
  if (!confirm('افزودن به وایت‌لیست؟ ' + userName)) return;
  if (ip && ip !== 'نامشخص' && ip !== '-') await addToWhitelist(ip, 'auto: ' + userName, currentPhone);
  if (deviceId && deviceId !== 'نامشخص' && deviceId !== '-') await addToWhitelist(deviceId, 'auto-dev: ' + userName, currentPhone);
  showShopNotification('اضافه شد');
}

async function clearUserSessions(phone) {
  if (!confirm('پاک کردن تاریخچه ورود؟')) return;
  var user = await getUser(phone);
  if (!user) return;
  user.loginHistory = [];
  await saveUser(phone, user);
  showShopNotification('پاک شد');
  openUserHistory(phone);
}

async function openUserLogsPanel() {
  if (currentPhone !== CREATOR_PHONE && getPerm().panel !== true) {
    showShopNotification('دسترسی ندارید', 'error');
    return;
  }
  var section = document.getElementById('userLogsSection');
  if (!section) return;
  var ids = ['usersSection','userHistorySection','userControlSection','whitelistSection','tournamentConfig'];
  for (var i = 0; i < ids.length; i++) {
    var el = document.getElementById(ids[i]);
    if (el) el.style.display = 'none';
  }
  section.style.display = 'block';
  await renderUserLogs();
}

async function renderUserLogs() {
  var container = document.getElementById('userLogsList');
  if (!container) return;
  container.innerHTML = '<div style="text-align:center;padding:15px;color:#aaa;">در حال بارگذاری...</div>';
  try {
    var allUsers = await getAllUsers();
    var arr = Object.entries(allUsers).map(function(e) {
      var u = e[1];
      u.phone = e[0];
      return u;
    });
    arr.sort(function(a, b) { return (b.lastLogin || 0) - (a.lastLogin || 0); });
    if (!arr.length) {
      container.innerHTML = '<div style="text-align:center;padding:20px;color:#888;">کاربری نیست</div>';
      return;
    }
    var html = '';
    for (var i = 0; i < arr.length; i++) {
      var u = arr[i];
      var online = u.online ? '🟢' : '⚫';
      var lastLoginStr = u.lastLogin ? formatDate(u.lastLogin) : '----';
      html += '<div style="background:rgba(255,255,255,.05);padding:10px;border-radius:8px;margin-bottom:6px;font-size:11px;line-height:1.9;border-right:3px solid ' + (u.online ? '#4caf50' : '#555') + ';">';
      html += '<div style="color:#fff;font-weight:700;">' + online + ' ' + (u.name || 'کاربر') + ' - ' + (toPersianNum(u.userCode) || '----') + '</div>';
      html += '<div style="color:#aaa;direction:ltr;">📱 ' + u.phone + '</div>';
      html += '<div style="color:#4fc3f7;direction:ltr;word-break:break-all;">🌐 IP: ' + (u.lastIP || 'نامشخص') + '</div>';
      html += '<div style="color:#ffb74d;">⏰ آخرین ورود: ' + lastLoginStr + '</div>';
      html += '<div style="color:#888;font-size:10px;">📅 ثبت‌نام: ' + formatDate(u.registeredAt || u.createdAt) + '</div>';
      html += '</div>';
    }
    container.innerHTML = html;
  } catch(e) {
    container.innerHTML = '<div style="color:#f44336;text-align:center;padding:20px;">خطا</div>';
  }
}

/* ═══════════════════════════════════════════════════════════ */
/*  مسابقات                                                    */
/* ═══════════════════════════════════════════════════════════ */
async function loadTournamentConfig() {
  try {
    var cfg = await getTournamentConfig();
    if (!cfg) return;
    function setVal(id, v) {
      var e = document.getElementById(id);
      if (e) e.value = (v === undefined || v === null) ? '' : v;
    }
    setVal('tournamentDuration', cfg.duration);
    if (cfg.rank1) {
      setVal('prize1Gems', cfg.rank1.gems);
      setVal('prize1Coins', cfg.rank1.coins);
      setVal('prize1Dollars', cfg.rank1.dollars);
      setVal('prize1Note', cfg.rank1.note);
    }
    if (cfg.rank2) {
      setVal('prize2Gems', cfg.rank2.gems);
      setVal('prize2Coins', cfg.rank2.coins);
      setVal('prize2Dollars', cfg.rank2.dollars);
      setVal('prize2Note', cfg.rank2.note);
    }
    if (cfg.rank3) {
      setVal('prize3Gems', cfg.rank3.gems);
      setVal('prize3Coins', cfg.rank3.coins);
      setVal('prize3Dollars', cfg.rank3.dollars);
      setVal('prize3Note', cfg.rank3.note);
    }
    if (cfg.rank4_10) {
      setVal('prize4Gems', cfg.rank4_10.gems);
      setVal('prize4Coins', cfg.rank4_10.coins);
      setVal('prize4Dollars', cfg.rank4_10.dollars);
      setVal('prize4Note', cfg.rank4_10.note);
    }
    if (cfg.blacklist) {
      window.clanBlacklist = cfg.blacklist;
      renderBlacklist();
    }
    var info = document.getElementById('tournamentEndTimeInfo');
    if (info && cfg.endTime) {
      var remaining = cfg.endTime - Date.now();
      if (remaining > 0) {
        var days = Math.floor(remaining / 86400000);
        var hours = Math.floor((remaining % 86400000) / 3600000);
        info.textContent = '⏰ پایان: ' + days + ' روز و ' + hours + ' ساعت مانده';
      } else {
        info.textContent = '⏰ زمان مسابقه تمام شده!';
      }
    }
  } catch(e) {}
}

async function saveAllTournamentConfig() {
  if (currentPhone !== CREATOR_PHONE) { showShopNotification('فقط سازنده', 'error'); return; }
  var durEl = document.getElementById('tournamentDuration');
  var duration = durEl ? durEl.value : 'weekly';
  var endTime = Date.now();
  var durationMap = { 'weekly':7, 'monthly':30, 'seasonal':90, 'yearly':365 };
  var days = durationMap[duration] || 7;
  endTime += days * 24 * 60 * 60 * 1000;
  function getVal(id) {
    var e = document.getElementById(id);
    return e ? (parseInt(e.value) || 0) : 0;
  }
  function getStr(id) {
    var e = document.getElementById(id);
    return e ? e.value.trim() : '';
  }
  var cfg = {
    duration: duration,
    endTime: endTime,
    distributed: false,
    rank1: { gems: getVal('prize1Gems'), coins: getVal('prize1Coins'), dollars: getVal('prize1Dollars'), note: getStr('prize1Note') },
    rank2: { gems: getVal('prize2Gems'), coins: getVal('prize2Coins'), dollars: getVal('prize2Dollars'), note: getStr('prize2Note') },
    rank3: { gems: getVal('prize3Gems'), coins: getVal('prize3Coins'), dollars: getVal('prize3Dollars'), note: getStr('prize3Note') },
    rank4_10: { gems: getVal('prize4Gems'), coins: getVal('prize4Coins'), dollars: getVal('prize4Dollars'), note: getStr('prize4Note') },
    blacklist: window.clanBlacklist || []
  };
  await saveTournamentConfigData(cfg);
  if (fbReady && fbDb) {
    try { fbDb.ref('server_state/tournament_end').set(endTime); } catch(e) {}
  }
  sendLive('global', 'tournament_updated', {});
  showShopNotification('✅ ذخیره شد - پایان: ' + new Date(endTime).toLocaleDateString('fa-IR'));
}

function renderBlacklist() {
  var container = document.getElementById('blacklistItems');
  if (!container) return;
  if (!window.clanBlacklist || window.clanBlacklist.length === 0) {
    container.innerHTML = '<div style="color:rgba(255,255,255,.5);font-size:11px;text-align:center;">خالی</div>';
    return;
  }
  var html = '';
  for (var i = 0; i < window.clanBlacklist.length; i++) {
    html += '<div class="clan-blacklist-item"><span>' + window.clanBlacklist[i] + '</span><button onclick="window.removeClanFromBlacklist && window.removeClanFromBlacklist(' + i + ')">حذف</button></div>';
  }
  container.innerHTML = html;
}
function addClanToBlacklist() {
  var name = prompt('نام یا تگ کلن:');
  if (!name || !name.trim()) return;
  if (!window.clanBlacklist) window.clanBlacklist = [];
  if (window.clanBlacklist.indexOf(name.trim()) > -1) return;
  window.clanBlacklist.push(name.trim());
  renderBlacklist();
}
function removeClanFromBlacklist(idx) {
  if (!window.clanBlacklist) return;
  window.clanBlacklist.splice(idx, 1);
  renderBlacklist();
}
window.clanBlacklist = window.clanBlacklist || [];

async function distributeClanPrizesNow() {
  if (currentPhone !== CREATOR_PHONE) { showShopNotification('فقط سازنده', 'error'); return; }
  if (!confirm('جوایز همین الان توزیع شود؟')) return;
  await distributeClanPrizes(true);
  showShopNotification('✅ جوایز توزیع شد');
}

async function distributeClanPrizes(force) {
  try {
    var cfg = await getTournamentConfig();
    if (!cfg) return;
    if (cfg.distributed && !force) return;
    if (!force && Date.now() < cfg.endTime) return;
    var ranking = await getClanRanking();
    if (!ranking.length) return;
    var allUsers = await getAllUsers();
    var groups = await getGroups();
    var top = ranking.slice(0, 10);
    var now = Date.now();
    var awarded = [];
    for (var i = 0; i < top.length; i++) {
      var r = top[i];
      var pc = null;
      if (r.rank === 1) pc = cfg.rank1;
      else if (r.rank === 2) pc = cfg.rank2;
      else if (r.rank === 3) pc = cfg.rank3;
      else if (r.rank >= 4 && r.rank <= 10) pc = cfg.rank4_10;
      if (!pc) continue;
      var g = null;
      for (var k = 0; k < groups.length; k++) {
        if (groups[k].id === r.id) { g = groups[k]; break; }
      }
      if (!g || !g.members) continue;
      var gems = parseInt(pc.gems) || 0;
      var coins = parseInt(pc.coins) || 0;
      var dollars = parseInt(pc.dollars) || 0;
      for (var j = 0; j < g.members.length; j++) {
        var mPhone = g.members[j];
        var u = allUsers[mPhone];
        if (!u) continue;
        if (gems > 0) u.gems = (u.gems || 0) + gems;
        if (coins > 0) u.coins = (u.coins || 0) + coins;
        if (dollars > 0) u.dollars = (u.dollars || 0) + dollars;
        u.lastUpdatedAt = now;
        allUsers[mPhone] = u;
        awarded.push(mPhone);
      }
    }
    await saveAllUsers(allUsers);
    for (var p = 0; p < awarded.length; p++) {
      try { await saveUser(awarded[p], allUsers[awarded[p]]); } catch(e) {}
      notifyUserUpdate(awarded[p], 'prize_received');
      sendLive('user_' + awarded[p], 'prize_received', {});
    }
    if (!force) {
      cfg.distributed = true;
      await saveTournamentConfigData(cfg);
    }
    sendLive('global', 'tournament_prizes_distributed', {});
  } catch(e) {}
}

/* ═══════════════════════════════════════════════════════════ */
/*  News                                                        */
/* ═══════════════════════════════════════════════════════════ */
async function loadNews() {
  var news = await getNews();
  var list = document.getElementById('newsList');
  var area = document.getElementById('newsCreatorArea');
  var badge = document.getElementById('newsBadge');
  if (currentUserData && (currentUserData.rank === 'سازنده' || currentPhone === CREATOR_PHONE)) {
    if (area) area.style.display = 'block';
  }
  var key = 'user_read_news_' + currentPhone;
  var read = JSON.parse(localStorage.getItem(key) || '[]');
  var unread = news.filter(function(n) { return !read.includes(n.id); }).length;
  if (badge) {
    if (unread > 0) {
      badge.textContent = toPersianNum(unread);
      badge.style.display = 'flex';
    } else badge.style.display = 'none';
  }
  if (!list) return;
  if (!news.length) {
    list.innerHTML = '<div style="text-align:center;color:rgba(255,255,255,.6);padding:20px;">خالی</div>';
    return;
  }
  list.innerHTML = news.slice().reverse().map(function(it) {
    return '<div class="news-item" onclick="window.markNewsAsRead && window.markNewsAsRead(' + it.id + ')"><div class="news-title">' + it.title + '</div><div class="news-content">' + it.content + '</div><div class="news-date">' + it.date + '</div></div>';
  }).join('');
}
function markNewsAsRead(id) {
  var key = 'user_read_news_' + currentPhone;
  var read = JSON.parse(localStorage.getItem(key) || '[]');
  if (!read.includes(id)) {
    read.push(id);
    localStorage.setItem(key, JSON.stringify(read));
    loadNews();
  }
}
async function sendNews() {
  var t = document.getElementById('newsTitleInput').value.trim();
  var c = document.getElementById('newsContentInput').value.trim();
  if (!t || !c) { showShopNotification('عنوان و متن را وارد کنید', 'error'); return; }
  var news = await getNews();
  news.push({
    id: Date.now(),
    title: t,
    content: c,
    date: new Date().toLocaleDateString('fa-IR'),
    sender: currentUserData.name
  });
  await saveNews(news);
  document.getElementById('newsTitleInput').value = '';
  document.getElementById('newsContentInput').value = '';
  await loadNews();
  sendLive('global', 'news_updated', {});
  showShopNotification('ارسال شد');
}

/* ═══════════════════════════════════════════════════════════ */
/*  Avatar Shop                                                */
/* ═══════════════════════════════════════════════════════════ */
function initAvatarShop() {
  if (!currentUserData) return;
  shopGold = currentUserData.coins || 0;
  shopGems = currentUserData.gems || 0;
  if (!currentUserData.ownedAvatars) currentUserData.ownedAvatars = [];
  if (!currentUserData.ownedTemplates) currentUserData.ownedTemplates = [];

  var rank = currentUserData.rank || 'کاربر';
  var exclusiveList = [
    { src: '655.webm', allowedRanks: ['سازنده'] },
    { src: '2000.webm', allowedRanks: ['پشتیبانی','گرداننده','ادمین ارشد','ناظر ارشد'] },
    { src: '2003.webm', allowedRanks: ['پشتیبانی','گرداننده','ادمین ارشد','ناظر ارشد'] },
    { src: '2001.webm', allowedRanks: ['ادمین','ناظر'] },
    { src: '2002.webm', allowedRanks: ['ادمین','ناظر'] }
  ];
  exclusiveList.forEach(function(ex) {
    var isAllowed = ex.allowedRanks.indexOf(rank) > -1;
    var key = 'ex_' + ex.src;
    var avObj = avatars.find(function(a) { return a.src === ex.src; });
    if (isAllowed) {
      if (currentUserData.ownedAvatars.indexOf(key) === -1) currentUserData.ownedAvatars.push(key);
      if (avObj) avObj.owned = true;
    } else {
      currentUserData.ownedAvatars = currentUserData.ownedAvatars.filter(function(k) { return k !== key; });
      if (avObj) avObj.owned = false;
    }
  });

  var owned = currentUserData.ownedAvatars || [];
  avatars.forEach(function(a) {
    if (a.free) a.owned = true;
    else if (owned.indexOf('ex_' + a.src) > -1 || owned.indexOf(a.src) > -1) a.owned = true;
    else a.owned = false;
  });
  templates.forEach(function(t) {
    t.owned = (currentUserData.ownedTemplates || []).indexOf(t.src) > -1;
  });
}

function renderAvatars() {
  var grid = document.getElementById('avatarGrid');
  if (!grid) return;
  var disp;
  if (currentAvatarSection === 'my') {
    disp = avatars.filter(function(a) { return a.owned; });
    if (currentPhone !== CREATOR_PHONE) {
      disp = disp.filter(function(a) { return a.src !== '655.webm'; });
    }
  } else {
    disp = avatars.filter(function(a) { return !a.owned && !a.exclusive; });
  }
  if (!disp.length) {
    grid.innerHTML = '<div style="text-align:center;padding:40px;color:#888;">آواتاری نیست</div>';
    return;
  }
  var currentAvatarSrc = currentUserData ? currentUserData.avatar : '';
  grid.innerHTML = disp.map(function(a) {
    var isVid = a.src.indexOf('.webm') > -1 || a.src.indexOf('.mp4') > -1;
    var isCurrent = (currentAvatarSrc === a.src);
    var cardClass = 'avatar-card ' + (a.owned ? 'owned ' : '') + (isCurrent ? 'is-selected' : '');
    var mediaHtml = isVid ?
      '<video src="' + a.src + '" autoplay loop muted playsinline style="width:100%;height:100%;object-fit:cover;"></video>' :
      '<img src="' + a.src + '" style="width:100%;height:100%;object-fit:cover;">';
    var confirmBtn = (currentAvatarSection === 'my' && a.owned) ?
      '<button class="cbtn cbtn-mini avatar-confirm-btn" data-src="' + a.src + '">تایید</button>' : '';
    var priceHtml = !a.owned ?
      '<div class="avatar-price"><img src="Jam99.webp"><span class="price-value">' + toPersianNum(a.price) + '</span></div>' :
      '<div style="color:#4CAF50;font-size:11px;">دارید</div>';
    return '<div class="' + cardClass + '" data-id="' + a.id + '"><div class="avatar-image">' + mediaHtml + '</div>' + priceHtml + confirmBtn + '</div>';
  }).join('');

  grid.querySelectorAll('.avatar-card').forEach(function(c) {
    c.addEventListener('click', function(e) {
      if (e.target.closest('.avatar-confirm-btn')) return;
      var id = parseInt(c.dataset.id);
      var av = avatars.find(function(x) { return x.id === id; });
      if (av && currentAvatarSection === 'buy' && !av.owned) handleAvatarClick(id);
    });
  });
  grid.querySelectorAll('.avatar-confirm-btn').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      playClickSound();
      var src = btn.dataset.src;
      if (!src) return;
      currentUserData.avatar = src;
      currentUserData.useExclusive = false;
      updateGlobalAvatar(src);
      renderAvatars();
      saveAvatarToStorage(src);
    });
  });
}

function renderTemplates() {
  var grid = document.getElementById('templateGrid');
  if (!grid) return;
  var disp = currentTemplateSection === 'my' ?
    templates.filter(function(t) { return t.owned; }) :
    templates.filter(function(t) { return !t.owned; });
  if (!disp.length) {
    grid.innerHTML = '<div style="text-align:center;padding:40px;color:#888;">قالبی نیست</div>';
    return;
  }
  var currentT = currentUserData ? currentUserData.currentTemplate : null;
  grid.innerHTML = disp.map(function(t) {
    var isCurrent = (currentT === t.src);
    var confirmBtn = (currentTemplateSection === 'my' && t.owned) ?
      '<button class="cbtn cbtn-mini template-confirm-btn" data-src="' + t.src + '">تایید</button>' : '';
    var priceHtml = !t.owned ?
      '<div class="template-price"><img src="Jam99.webp"><span class="price-value">' + toPersianNum(t.price) + '</span></div>' :
      '<div style="color:#4CAF50;font-size:11px;">دارید</div>';
    return '<div class="template-card' + (isCurrent ? ' is-selected' : '') + '" data-src="' + t.src + '"><div class="template-preview-box"><img src="' + t.src + '" style="width:100%;height:100%;object-fit:contain;"></div><div class="template-name">' + t.name + '</div>' + priceHtml + confirmBtn + '</div>';
  }).join('');

  grid.querySelectorAll('.template-confirm-btn').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      playClickSound();
      var src = btn.dataset.src;
      if (!src) return;
      currentUserData.currentTemplate = src;
      updateGlobalAvatar(currentUserData.avatar || 'Mafia2.png');
      renderTemplates();
      saveTemplateToStorage(src);
    });
  });
}

function handleTemplateClick(t) {
  selectedTemplate = t;
  templatePurchasePrice = t.price;
  purchaseMode = 'template';
  document.getElementById('modalTitle').textContent = 'خرید قالب';
  document.getElementById('modalText').textContent = 'خرید ' + t.name + ' به قیمت ' + toPersianNum(t.price) + ' الماس؟';
  document.getElementById('purchaseModal').classList.add('show');
}
function handleAvatarClick(id) {
  var a = avatars.find(function(x) { return x.id === id; });
  if (!a) return;
  if (currentAvatarSection === 'buy' && !a.owned) {
    selectedAvatar = a;
    purchasePrice = a.price;
    purchaseMode = 'avatar';
    document.getElementById('modalTitle').textContent = 'خرید آواتار';
    document.getElementById('modalText').textContent = 'خرید به قیمت ' + toPersianNum(purchasePrice) + ' الماس؟';
    document.getElementById('purchaseModal').classList.add('show');
  } else if (a.owned) {
    updateGlobalAvatar(a.src);
    saveAvatarToStorage(a.src);
  }
}
async function confirmPurchase() {
  playClickSound();
  if (purchaseMode === 'template' && selectedTemplate) {
    if (shopGems < templatePurchasePrice) {
      document.getElementById('purchaseModal').classList.remove('show');
      showShopNotification('الماس کافی نیست', 'error');
      return;
    }
    shopGems -= templatePurchasePrice;
    if (!currentUserData.ownedTemplates) currentUserData.ownedTemplates = [];
    currentUserData.ownedTemplates.push(selectedTemplate.src);
    currentUserData.gems = shopGems;
    currentUserData.currentTemplate = selectedTemplate.src;
    updateUIWithData(currentUserData);
    renderTemplates();
    document.getElementById('purchaseModal').classList.remove('show');
    await saveUser(currentPhone, currentUserData);
    return;
  }
  if (purchaseMode === 'avatar' && selectedAvatar) {
    if (shopGems >= purchasePrice) {
      shopGems -= purchasePrice;
      if (!currentUserData.ownedAvatars) currentUserData.ownedAvatars = [];
      currentUserData.ownedAvatars.push(selectedAvatar.src);
      currentUserData.gems = shopGems;
      currentUserData.avatar = selectedAvatar.src;
      currentUserData.useExclusive = false;
      updateUIWithData(currentUserData);
      renderAvatars();
      document.getElementById('purchaseModal').classList.remove('show');
      await saveUser(currentPhone, currentUserData);
    } else {
      document.getElementById('purchaseModal').classList.remove('show');
      showShopNotification('الماس کافی نیست', 'error');
    }
  }
}

/* ═══════════════════════════════════════════════════════════ */
/*  ⚡ Online + Sync - بدون پریدن حساب                            */
/* ═══════════════════════════════════════════════════════════ */
async function setUserOnlineStatus(online) {
  if (!currentPhone) return;
  try {
    var user = await getUser(currentPhone);
    if (!user) return;
    user.online = online;
    user.lastSeen = Date.now();
    if (myIP) user.lastIP = myIP;
    if (currentDeviceId) user.lastDevice = currentDeviceId;
    user.lastUpdatedAt = Date.now();
    await saveUser(currentPhone, user);
    setFBOnline(currentPhone, online, { name: user.name, rank: user.rank });
  } catch(e) {}
}

async function checkWhitelistNow() {
  try {
    myIP = await fetchUserIP();
    if (!myIP) return false;
    currentDeviceId = getDeviceId();
    return await isIPWhitelisted(myIP, currentDeviceId);
  } catch(e) { return false; }
}

async function checkBanPeriodically() {
  if (!currentPhone || isRedirecting) return;
  if (currentPhone === CREATOR_PHONE) return;
  if (pauseSync) return;
  var am = document.getElementById('adminModal');
  if (am && am.classList.contains('active')) return;
  var eu = document.getElementById('editUserModal');
  if (eu && eu.classList.contains('active')) return;

  var locked = await isServerLocked();
  if (locked) { lockServerForeverInGame(); return; }

  var isWhite = await checkWhitelistNow();
  if (isWhite) return;

  var b = await getBanStatus(currentPhone);
  if (b) { redirectToBan(b, currentPhone); return; }
}

async function syncWithServerInBackground() {
  try {
    if (pauseSync) return;
    var am = document.getElementById('adminModal');
    if (am && am.classList.contains('active')) return;
    var eu = document.getElementById('editUserModal');
    if (eu && eu.classList.contains('active')) return;

    myIP = await fetchUserIP();
    currentDeviceId = getDeviceId();

    if (currentPhone === CREATOR_PHONE) {
      var so = document.getElementById('serverDownOverlay');
      if (so) so.remove();
      gameServerLocked = false;
      if (__serverRecoveryInterval) {
        clearInterval(__serverRecoveryInterval);
        __serverRecoveryInterval = null;
      }
      var serverUser = await getUser(currentPhone);
      if (!serverUser) return;
      if (!serverUser.userCode || isNaN(parseInt(serverUser.userCode))) {
        serverUser = await assignCodeIfMissing(currentPhone, serverUser);
      }
      currentUserData = sanitizeUserData(Object.assign({}, currentUserData, serverUser), currentPhone);
      currentUserData.lastIP = myIP;
      currentUserData.lastDevice = currentDeviceId;
      localStorage.setItem('user_cache_' + currentPhone, JSON.stringify(currentUserData));
      updateUIWithData(currentUserData);
      return;
    }

    var isWhitelisted = await isIPWhitelisted(myIP, currentDeviceId);
    var hasPanelAccess = getPerm().panel;

    if (!isWhitelisted) {
      var isLocked = await isServerLocked();
      if (isLocked && !hasPanelAccess) { lockServerForeverInGame(); return; }
      var so3 = document.getElementById('serverDownOverlay');
      if (so3) so3.remove();
      gameServerLocked = false;
      if (__serverRecoveryInterval) {
        clearInterval(__serverRecoveryInterval);
        __serverRecoveryInterval = null;
      }
      var ban = await getBanStatus(currentPhone);
      if (ban) { redirectToBan(ban, currentPhone); return; }
    }

    if (isAdminLocked()) {
      var sUser = await getUser(currentPhone);
      if (sUser) {
        currentUserData = sanitizeUserData(sUser, currentPhone);
        localStorage.setItem('user_cache_' + currentPhone, JSON.stringify(currentUserData));
        updateUIWithData(currentUserData);
      }
      return;
    }

    var sUser2 = await getUser(currentPhone);
    if (!sUser2) return;
    if (!sUser2.userCode || isNaN(parseInt(sUser2.userCode))) {
      sUser2 = await assignCodeIfMissing(currentPhone, sUser2);
    }

    var st = sUser2.lastUpdatedAt || 0;
    var lt = currentUserData.lastUpdatedAt || 0;

    if (st > lt) {
      currentUserData = sanitizeUserData(sUser2, currentPhone);
      localStorage.setItem('user_cache_' + currentPhone, JSON.stringify(currentUserData));
      updateUIWithData(currentUserData);
    }

    currentUserData.lastIP = myIP;
    currentUserData.lastDevice = currentDeviceId;

    try { await distributeClanPrizes(false); } catch(e) {}
  } catch(error) {}
}

function setupLiveSubscriptions() {
  if (!window.FBLive || !window.FBLive.isReady || !window.FBLive.isReady()) return;
  if (window.__liveSubsReady) return;
  window.__liveSubsReady = true;

  if (fbReady && fbDb) {
    try {
      if (fbServerListener) {
        try { fbDb.ref('server_state/on').off('value', fbServerListener); } catch(e) {}
      }
      fbServerListener = fbDb.ref('server_state/on').on('value', function(snap) {
        if (snap.val() === true && currentPhone !== CREATOR_PHONE) {
          lockServerForeverInGame();
        } else if (snap.val() === false) {
          // ⚠️ رفع: اگر سرور وصل شد، ریکاوری
          if (gameServerLocked) {
            gameServerLocked = false;
            var ov = document.getElementById('serverDownOverlay');
            if (ov) ov.remove();
            document.body.style.overflow = '';
            document.documentElement.style.overflow = '';
            if (__serverRecoveryInterval) {
              clearInterval(__serverRecoveryInterval);
              __serverRecoveryInterval = null;
            }
            syncWithServerInBackground();
          }
        }
      });
    } catch(e) {}
  }

  window.FBLive.subscribe('global', async function(sig) {
    if (sig.type === 'news_updated') {
      await loadNews();
      showShopNotification('📢 اطلاعیه جدید');
    } else if (sig.type === 'server_toggle') {
      var locked = await isServerLocked();
      if (locked && currentPhone !== CREATOR_PHONE) { lockServerForeverInGame(); return; }
      if (!locked && gameServerLocked) {
        gameServerLocked = false;
        var ov2 = document.getElementById('serverDownOverlay');
        if (ov2) ov2.remove();
        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';
        if (__serverRecoveryInterval) {
          clearInterval(__serverRecoveryInterval);
          __serverRecoveryInterval = null;
        }
        showShopNotification('✅ سرور وصل شد');
      }
      await syncWithServerInBackground();
    } else if (sig.type === 'codes_reset') {
      var fresh = await getUser(currentPhone);
      if (fresh) {
        currentUserData.userCode = fresh.userCode;
        updateUIWithData(currentUserData);
      }
    } else if (sig.type === 'tournament_updated') {
      loadTournamentConfig();
    }
  });

  window.FBLive.subscribe('user_' + currentPhone, async function(sig) {
    if (sig.type === 'banned' && currentPhone !== CREATOR_PHONE) {
      var ban = await getBanStatus(currentPhone);
      if (ban) redirectToBan(ban, currentPhone);
      return;
    }
    if (sig.type === 'force_logout' && currentPhone !== CREATOR_PHONE) {
      localStorage.removeItem('currentLoggedInUser');
      window.location.href = 'index.html';
      return;
    }
    if (sig.type === 'deleted' && currentPhone !== CREATOR_PHONE) {
      localStorage.removeItem('currentLoggedInUser');
      window.location.href = 'index.html';
      return;
    }
    if (sig.type === 'admin_edit' || sig.type === 'prize_received' || sig.type === 'force_refresh') {
      setAdminLock();
      var fresh2 = await getUser(currentPhone);
      if (fresh2) {
        currentUserData = sanitizeUserData(fresh2, currentPhone);
        localStorage.setItem('user_cache_' + currentPhone, JSON.stringify(currentUserData));
        // ⚠️ رفع: اطمینان از پاک شدن کش آواتار قدیمی
        if (sig.data && sig.data.resetAvatar) {
          try { delete currentUserData._avatarCache; } catch(e) {}
        }
        updateUIWithData(currentUserData);
        updateGlobalAvatar(currentUserData.avatar || 'Mafia2.png');
      }
      if (sig.type === 'prize_received') showShopNotification('🎁 جایزه دریافت کردید!');
      else showShopNotification('🔄 اطلاعات شما به‌روزرسانی شد');
    }
  });

  if (window.FBLive.subscribeValue) {
    window.FBLive.subscribeValue('user_updates/' + currentPhone, async function(val) {
      if (!val || !val.at) return;
      setAdminLock();
      var fresh = await getUser(currentPhone);
      if (!fresh) return;
      currentUserData = sanitizeUserData(fresh, currentPhone);
      localStorage.setItem('user_cache_' + currentPhone, JSON.stringify(currentUserData));
      updateUIWithData(currentUserData);
      updateGlobalAvatar(currentUserData.avatar || 'Mafia2.png');

      if (val.type === 'banned') {
        var ban = await getBanStatus(currentPhone);
        if (ban) redirectToBan(ban, currentPhone);
      } else if (val.type === 'unbanned') {
        showShopNotification('✅ رفع بن شد');
      } else if (val.type === 'deleted') {
        localStorage.removeItem('currentLoggedInUser');
        window.location.href = 'index.html';
      } else if (val.type === 'force_logout') {
        localStorage.removeItem('currentLoggedInUser');
        window.location.href = 'index.html';
      } else if (val.type === 'prize_received') {
        showShopNotification('🎁 جایزه دریافت کردید!');
      } else if (val.type === 'admin_edit') {
        showShopNotification('🔄 اطلاعات شما به‌روزرسانی شد');
      }
    });
  }
}

/* ═══════════════════════════════════════════════════════════ */
/*  Boot                                                       */
/* ═══════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', async function() {
  var loggedIn = localStorage.getItem('currentLoggedInUser');
  if (!loggedIn) { window.location.href = 'index.html'; return; }
  var phone = null;
  try { phone = JSON.parse(loggedIn).phone; } catch(e) {
    window.location.href = 'index.html';
    return;
  }
  currentPhone = phone;

  initFB(currentPhone);
  if (window.FBLive && window.FBLive.init) window.FBLive.init(currentPhone);

  // ⚠️ رفع: ثبت ورود با IP و زمان واقعی
  setTimeout(async function() {
    try {
      myIP = await fetchUserIP();
      currentDeviceId = getDeviceId();
      if (myIP) {
        await logLoginSession(currentPhone, myIP, currentDeviceId);
      }
    } catch(e) {}
  }, 500);

  var cacheFirst = localStorage.getItem('user_cache_' + currentPhone);
  if (cacheFirst) {
    try { currentUserData = JSON.parse(cacheFirst); } catch(e) {}
  }

  if (!currentUserData) {
    try {
      var u = await getUser(currentPhone);
      if (u) {
        if (!u.userCode || isNaN(parseInt(u.userCode))) u = await assignCodeIfMissing(currentPhone, u);
        if (!u.deviceInfo) u.deviceInfo = getDeviceInfo();
        currentUserData = u;
      }
    } catch(e) {}
  }
  if (!currentUserData) {
    currentUserData = { name: 'کاربر', coins: 0, gems: 0, dollars: 0, avatar: 'Mafia2.png', rank: 'کاربر', level: 1 };
  }

  updateUIWithData(currentUserData);
  initAvatarShop();

  setTimeout(function() {
    checkWhitelistNow().catch(function() {});
    syncWithServerInBackground();
    setUserOnlineStatus(true);
    setupLiveSubscriptions();
    updateGroupDisplay();
    updateClanRank();
  }, 100);

  setInterval(checkBanPeriodically, 2000);
  setInterval(syncWithServerInBackground, 5000);
  setInterval(function() { setUserOnlineStatus(!document.hidden); }, 30000);
  setInterval(updateClanRank, 15000);
  setInterval(updateGroupDisplay, 30000);

  var bind = function(id, fn) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('click', fn);
  };

  bind('menuBtn', function(e) {
    e.stopPropagation();
    playClickSound();
    var d = document.getElementById('menuDropdown');
    if (d.classList.contains('active')) closeModal('menuDropdown');
    else {
      document.getElementById('menuOverlay').classList.add('active');
      d.classList.add('active');
    }
  });
  bind('menuOverlay', function() {
    document.getElementById('menuOverlay').classList.remove('active');
    document.getElementById('menuDropdown').classList.remove('active');
  });
  bind('menuContact', function() {
    playClickSound();
    closeModal('menuDropdown');
    window.location.href = 'https://Mfasun.ir';
  });
  bind('menuSettings', function() {
    playClickSound();
    closeModal('menuDropdown');
    document.getElementById('settingsModal').classList.add('active');
  });
  bind('menuLogout', function() {
    playClickSound();
    closeModal('menuDropdown');
    if (confirm('خروج؟')) {
      setUserOnlineStatus(false);
      try { setFBOnline(currentPhone, false, {}); } catch(e) {}
      localStorage.removeItem('currentLoggedInUser');
      window.location.href = 'index.html';
    }
  });
  bind('openProfile', function() {
    playClickSound();
    document.getElementById('profilePage').classList.add('active');
    updateGroupDisplay();
    updateClanRank();
  });
  bind('backBtn', function() {
    playClickSound();
    document.getElementById('profilePage').classList.remove('active');
  });
  bind('copyUserCode', function() {
    playClickSound();
    copyToClipboard(document.getElementById('userCode').textContent, 'کپی شد');
  });
  bind('openAvatarShop', function() {
    playClickSound();
    document.getElementById('profilePage').classList.remove('active');
    document.getElementById('avatarShopPage').classList.add('active');
    renderAvatars();
  });
  bind('shopBackBtn', function() {
    playClickSound();
    document.getElementById('avatarShopPage').classList.remove('active');
    document.getElementById('profilePage').classList.add('active');
  });
  bind('templateBackBtn', function() {
    playClickSound();
    document.getElementById('templateShopPage').classList.remove('active');
    document.getElementById('profilePage').classList.add('active');
  });
  bind('editNameBtn', changeUsername);
  bind('navShop', function() { playClickSound(); window.location.href = 'Safe Foroshgahe.html'; });
  bind('navGroup', function() { playClickSound(); window.location.href = 'Safe Goroh.html'; });
  bind('btnAnnouncements', async function() {
    playClickSound();
    await loadNews();
    document.getElementById('newsModal').classList.add('active');
  });
  bind('btnHelp', function() { playClickSound(); window.location.href = 'Amozesh.html'; });
  bind('btnTopPlayers', function() { playClickSound(); showClanRankingModal(); });
  bind('btnManagement', function() { playClickSound(); window.location.href = 'Modir.html'; });
  bind('btnLive', function() { playClickSound(); showShopNotification('به زودی'); });
  bind('btnFriendly', function() { playClickSound(); window.location.href = 'TalarDs.html'; });
  bind('btnCompetitive', function() {
    playClickSound();
    document.getElementById('competitiveOverlay').classList.add('active');
  });
  bind('cancelSearchBtn', function() {
    document.getElementById('competitiveOverlay').classList.remove('active');
  });
  bind('enterGameBtn', function() { window.location.href = 'Safe Game.html'; });
  bind('sendNewsBtn', sendNews);
  bind('btnBanUser', function() { banUser('account'); });
  bind('btnBanDevice', function() { banUser('device'); });
  bind('btnBanIP', function() { banUser('ip'); });
  bind('btnUnbanUser', unbanUser);
  bind('btnDeleteAccount', deleteAccount);
  bind('btnWipeDB', wipeDatabase);
  bind('btnServerToggle', toggleServer);
  bind('btnResetCodes', resetAllUserCodes);
  bind('btnAddWhitelistIP', addWhitelistIP);
  bind('btnForceLogin', forceUserLogin);
  bind('btnForceLogout', forceUserLogout);
  bind('btnClearUserData', clearUserData);
  bind('btnClearSessions', clearUserSessionsFromPanel);
  bind('btnSaveUserEdit', saveUserEdit);
  bind('btnTournamentConfig', function() {
    var ids = ['usersSection', 'userHistorySection', 'userControlSection', 'whitelistSection', 'userLogsSection'];
    for (var i = 0; i < ids.length; i++) {
      var el = document.getElementById(ids[i]);
      if (el) el.style.display = 'none';
    }
    var tc = document.getElementById('tournamentConfig');
    if (tc) tc.style.display = 'block';
    loadTournamentConfig();
    renderBlacklist();
  });
  bind('btnUserLogs', openUserLogsPanel);
  bind('modalCancelBtn', function() {
    playClickSound();
    document.getElementById('purchaseModal').classList.remove('show');
  });
  bind('modalConfirmBtn', confirmPurchase);
  bind('openChangePasswordBtn', function() {
    playClickSound();
    closeModal('settingsModal');
    document.getElementById('cpPhone').value = currentPhone || '';
    document.getElementById('changePasswordModal').classList.add('active');
  });
  bind('btnWhitelistIP', function() {
    var ids = ['usersSection', 'userHistorySection', 'userControlSection', 'tournamentConfig', 'userLogsSection'];
    for (var i = 0; i < ids.length; i++) {
      var el = document.getElementById(ids[i]);
      if (el) el.style.display = 'none';
    }
    document.getElementById('whitelistSection').style.display = 'block';
    refreshWhitelistUI();
  });
  bind('btnShowUsersList', function() {
    var ids = ['userHistorySection', 'userControlSection', 'whitelistSection', 'tournamentConfig', 'userLogsSection'];
    for (var i = 0; i < ids.length; i++) {
      var el = document.getElementById(ids[i]);
      if (el) el.style.display = 'none';
    }
    document.getElementById('usersSection').style.display = 'block';
    loadUsers();
  });
  bind('btnUserControl', function() {
    var ids = ['usersSection', 'userHistorySection', 'whitelistSection', 'tournamentConfig', 'userLogsSection'];
    for (var i = 0; i < ids.length; i++) {
      var el = document.getElementById(ids[i]);
      if (el) el.style.display = 'none';
    }
    document.getElementById('userControlSection').style.display = 'block';
  });

  var btnAdmin = document.getElementById('btnAdmin');
  if (btnAdmin) {
    btnAdmin.onclick = function(e) {
      if (e) { e.preventDefault(); e.stopPropagation(); }
      playClickSound();
      openAdminPanel();
      return false;
    };
  }

  bind('submitPasswordChange', async function() {
    playClickSound();
    var p = document.getElementById('cpPhone').value.trim();
    var cp = document.getElementById('cpCurrentPass').value;
    var np = document.getElementById('cpNewPass').value;
    if (!p || !cp || !np) { showShopNotification('فیلدها را پر کنید', 'error'); return; }
    if (p !== currentPhone) { showShopNotification('شماره مطابقت ندارد', 'error'); return; }
    if (currentUserData.password && currentUserData.password !== cp) {
      showShopNotification('رمز فعلی اشتباه', 'error');
      return;
    }
    currentUserData.password = np;
    await saveUserData();
    closeModal('changePasswordModal');
    showShopNotification('رمز تغییر کرد');
  });

  document.querySelectorAll('.admin-tab').forEach(function(tab) {
    tab.addEventListener('click', function() {
      document.querySelectorAll('.admin-tab').forEach(function(t) { t.classList.remove('active'); });
      this.classList.add('active');
      currentAdminTab = this.dataset.tab;
      loadUsers();
    });
  });
  var usi = document.getElementById('userSearchInput');
  if (usi) usi.addEventListener('input', function() { loadUsers(); });

  document.querySelectorAll('.shop-tab').forEach(function(t) {
    t.addEventListener('click', function() {
      playClickSound();
      var tab = this.dataset.shoptab;
      document.querySelectorAll('.shop-tab').forEach(function(x) { x.classList.remove('active'); });
      document.querySelectorAll('.shop-tab[data-shoptab="' + tab + '"]').forEach(function(x) {
        x.classList.add('active');
      });
      if (tab === 'templates') {
        document.getElementById('avatarShopPage').classList.remove('active');
        document.getElementById('templateShopPage').classList.add('active');
        renderTemplates();
      } else if (tab === 'avatars') {
        document.getElementById('templateShopPage').classList.remove('active');
        document.getElementById('avatarShopPage').classList.add('active');
        renderAvatars();
      }
    });
  });

  document.querySelectorAll('.avatar-section-tab').forEach(function(t) {
    t.addEventListener('click', function() {
      playClickSound();
      currentAvatarSection = this.dataset.section;
      document.querySelectorAll('.avatar-section-tab').forEach(function(x) { x.classList.remove('active'); });
      this.classList.add('active');
      renderAvatars();
    });
  });

  document.querySelectorAll('.template-tab').forEach(function(t) {
    t.addEventListener('click', function() {
      playClickSound();
      currentTemplateSection = this.dataset.tsection;
      document.querySelectorAll('.template-tab').forEach(function(x) { x.classList.remove('active'); });
      this.classList.add('active');
      renderTemplates();
    });
  });

  var vs = document.getElementById('gameVolumeSlider');
  if (vs) vs.addEventListener('input', function() {
    var bg = document.getElementById('bgMusic');
    if (bg) bg.volume = this.value / 100;
  });

  // ⚠️ رفع: آپلود آواتار با DataURL (نه blob:)
  var exclFile = document.getElementById('exclusiveAvatarFile');
  if (exclFile) exclFile.addEventListener('change', function(e) {
    var file = e.target.files[0];
    if (!file) return;

    var isVideo = file.type.indexOf('video/') === 0;
    var maxSize = isVideo ? 3 * 1024 * 1024 : 1.5 * 1024 * 1024;
    if (file.size > maxSize) {
      showShopNotification('حداکثر ' + (isVideo ? '۳MB' : '۱.۵MB') + '!', 'error');
      this.value = '';
      return;
    }

    var reader = new FileReader();
    reader.onload = function(evt) {
      var dataUrl = evt.target.result;
      editingUserExclusiveAvatar = dataUrl;
      var prev = document.getElementById('exclusiveAvatarPreview');
      if (prev) {
        if (isVideo) {
          prev.innerHTML = '<video src="' + dataUrl + '" autoplay loop muted playsinline style="width:100%;height:100%;object-fit:cover;"></video>';
        } else {
          prev.innerHTML = '<img src="' + dataUrl + '" style="width:100%;height:100%;object-fit:cover;">';
        }
      }
      showShopNotification('✅ آماده ذخیره (حجم: ' + Math.round(file.size/1024) + 'KB)');
    };
    reader.onerror = function() { showShopNotification('خطا در خواندن فایل', 'error'); };
    reader.readAsDataURL(file);
  });

  var remExcl = document.getElementById('removeExclusiveAvatar');
  if (remExcl) remExcl.addEventListener('click', function() {
    editingUserExclusiveAvatar = 'removed';
    var prev = document.getElementById('exclusiveAvatarPreview');
    if (prev) prev.innerHTML = '<span class="exclusive-avatar-placeholder">👤</span>';
    if (exclFile) exclFile.value = '';
  });

  console.log('✅ Safe Asli.js loaded');
});

document.addEventListener('visibilitychange', async function() {
  if (document.hidden) {
    setUserOnlineStatus(false);
  } else {
    setUserOnlineStatus(true);
    await checkWhitelistNow();
    // ⚠️ رفع: بعد از برگشت، تاریخچه ورود ثبت کن اگر بیش از ۵ دقیقه گذشته
    try {
      if (myIP && (Date.now() - __lastLoginLogged > 300000)) {
        await logLoginSession(currentPhone, myIP, currentDeviceId);
      }
    } catch(e) {}
  }
});

// ⚠️ رفع: beforeunload آفلاین نکن - فقط FBOnline رو آنلاین نگه دار
window.addEventListener('beforeunload', function() {
  if (currentPhone) {
    try { setFBOnline(currentPhone, true, {}); } catch(e) {}
  }
});

window.closeModal = closeModal;
window.closeAdminModal = closeAdminModal;
window.closeEditUser = closeEditUser;
window.closeUserHistory = closeUserHistory;
window.openUserHistory = openUserHistory;
window.openEditUser = openEditUser;
window.openAdminPanel = openAdminPanel;
window.loadUsers = loadUsers;
window.saveUserEdit = saveUserEdit;
window.banUser = banUser;
window.unbanUser = unbanUser;
window.deleteAccount = deleteAccount;
window.wipeDatabase = wipeDatabase;
window.toggleServer = toggleServer;
window.forceUserLogin = forceUserLogin;
window.forceUserLogout = forceUserLogout;
window.clearUserData = clearUserData;
window.clearUserSessionsFromPanel = clearUserSessionsFromPanel;
window.addWhitelistIP = addWhitelistIP;
window.removeWhitelistIP = removeWhitelistIP;
window.quickWhitelistUser = quickWhitelistUser;
window.clearUserSessions = clearUserSessions;
window.resetAllUserCodes = resetAllUserCodes;
window.markNewsAsRead = markNewsAsRead;
window.sendNews = sendNews;
window.loadNews = loadNews;
window.updateGroupDisplay = updateGroupDisplay;
window.updateClanRank = updateClanRank;
window.showClanRankingModal = showClanRankingModal;
window.loadTournamentConfig = loadTournamentConfig;
window.saveAllTournamentConfig = saveAllTournamentConfig;
window.renderBlacklist = renderBlacklist;
window.addClanToBlacklist = addClanToBlacklist;
window.removeClanFromBlacklist = removeClanFromBlacklist;
window.distributeClanPrizesNow = distributeClanPrizesNow;
window.distributeClanPrizes = distributeClanPrizes;
window.openUserLogsPanel = openUserLogsPanel;
window.renderUserLogs = renderUserLogs;
window.updateUIWithData = updateUIWithData;
window.playClickSound = playClickSound;
window.isServerLocked = isServerLocked;
window.updateGlobalAvatar = updateGlobalAvatar;
window.logLoginSession = logLoginSession;