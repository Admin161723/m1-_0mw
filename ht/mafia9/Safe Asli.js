/* ============================================================ */
/*  Safe Asli.js - نسخه نهایی بدون باگ                          */
/* ============================================================ */

const UPSTASH_OLD_URL = "https://smooth-werewolf-200782.upstash.io";
const UPSTASH_OLD_TOKEN = "gQAAAAAAAxBOAAIgcDFjN2NiMjYxOWNlNjE0NzgyOTExM2JjMjA5ZTc0MjVjMA";
const UPSTASH_NEW_URL = "https://holy-hamster-122717.upstash.io";
const UPSTASH_NEW_TOKEN = "gQAAAAAAAd9dAAIgcDFlNmYwM2VkZDJiM2Y0YWI2ODBmNmIyMTZjMmRkMTZmNg";
const CREATOR_PHONE = '09904844031';

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
var localAvatarLock = 0;
var localTemplateLock = 0;
var _liveSubscriptions = [];
var awayTimer = null;
var isUserAway = false;
var _liveSubsReady = false;
var gameServerLocked = false;
var isRedirecting = false;
var currentAdminTab = 'all';
var currentUserList = [];
var viewingUserHistory = null;

/* ---------- Firebase wrapper ---------- */
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
    console.log('✅ Firebase ready');
    return true;
  } catch(e) { console.log('❌ FB:', e); return false; }
}
function sendSignal(channel, type, data) {
  if (!fbReady || !fbDb) return false;
  try {
    fbDb.ref('signals/' + channel).push({ type: type||'update', data: data||{}, from: fbPhone, time: Date.now() });
    return true;
  } catch(e) { return false; }
}
function subscribeSignal(channel, callback) {
  if (!fbReady || !fbDb) return function(){};
  try {
    var ref = fbDb.ref('signals/' + channel);
    var seen = {};
    var h = ref.limitToLast(1).on('child_added', function(snap) {
      var sig = snap.val();
      if (!sig || sig.from === fbPhone) return;
      var k = snap.key;
      if (seen[k]) return;
      seen[k] = true;
      try { callback(sig); } catch(e) {}
    });
    return function() { try { ref.off('child_added', h); } catch(e) {} };
  } catch(e) { return function(){}; }
}
function setFBValue(path, value) {
  if (!fbReady || !fbDb) return false;
  try { fbDb.ref(path).set(value); return true; } catch(e) { return false; }
}
function setFBOnline(phone, isOnline, extra) {
  if (!fbReady || !fbDb) return;
  try {
    var d = { online: isOnline, lastSeen: Date.now() };
    if (extra) for (var k in extra) d[k] = extra[k];
    fbDb.ref('online/' + phone).set(d);
  } catch(e) {}
}

/* ---------- Redis ---------- */
async function upstashGet(url, token, k) {
  try {
    var c = new AbortController(); var t = setTimeout(function(){c.abort();}, 5000);
    var r = await fetch(url + '/get/' + encodeURIComponent(k), { headers: { 'Authorization': 'Bearer ' + token }, signal: c.signal, cache: 'no-store' });
    clearTimeout(t); if (!r.ok) return null;
    var d = await r.json();
    if (d && d.result) { try { return JSON.parse(d.result); } catch(e) { return d.result; } }
    return null;
  } catch(e) { return null; }
}
async function upstashSet(url, token, k, v) {
  try {
    var jv = JSON.stringify(v);
    var c = new AbortController(); var t = setTimeout(function(){c.abort();}, 5000);
    var r = await fetch(url + '/set/' + encodeURIComponent(k) + '/' + encodeURIComponent(jv), { headers: { 'Authorization': 'Bearer ' + token }, signal: c.signal });
    clearTimeout(t); return r.ok;
  } catch(e) { return false; }
}
async function upstashDel(url, token, k) {
  try {
    var c = new AbortController(); var t = setTimeout(function(){c.abort();}, 5000);
    var r = await fetch(url + '/del/' + encodeURIComponent(k), { method: 'POST', headers: { 'Authorization': 'Bearer ' + token }, signal: c.signal });
    clearTimeout(t); return r.ok;
  } catch(e) { return false; }
}
async function redisGet(key) {
  var v1 = await upstashGet(UPSTASH_OLD_URL, UPSTASH_OLD_TOKEN, key);
  if (v1 !== null) return v1;
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
async function redisIncr(key) {
  var val = await redisGet(key); var num = parseInt(val) || 0; num++;
  await redisSet(key, num); return num;
}

async function getUser(p){return await redisGet('user:'+p);}
async function saveUser(p,u){return await redisSet('user:'+p,u);}
async function getAllUsers(){return await redisGet('all_users')||{};}
async function saveAllUsers(u){return await redisSet('all_users',u);}
async function getGroups(){return await redisGet('police_groups')||[];}
async function getBanStatus(p){
  var b = await redisGet('ban:'+p);
  if(b && b.isBanned){
    if(b.expiresAt && b.duration!=='permanent' && b.duration!=='دائمی'){
      if(new Date(b.expiresAt).getTime()<Date.now()) return null;
    }
    return b;
  }
  return null;
}
async function getDeviceBan(deviceId){return await redisGet('device_ban:'+deviceId);}
async function setDeviceBan(deviceId,data){return await redisSet('device_ban:'+deviceId,data);}
async function getIPBan(ip){return await redisGet('ip_ban:'+ip);}
async function setIPBan(ip,data){return await redisSet('ip_ban:'+ip,data);}
async function getNews(){return await redisGet('game_news')||[];}
async function saveNews(n){return await redisSet('game_news',n);}
async function getMaintenance(){return await redisGet('server_maintenance');}
async function setMaintenance(on){return await redisSet('server_maintenance',{on:on,at:Date.now()});}
async function getTournamentConfig(){return await redisGet('tournament_config')||{};}
async function saveTournamentConfigData(cfg){return await redisSet('tournament_config',cfg);}

async function addBanLog(phone, banData) {
  var user = await getUser(phone); if (!user) return;
  if (!user.banHistory) user.banHistory = [];
  user.banHistory.push(banData);
  if (user.banHistory.length > 50) user.banHistory.shift();
  await saveUser(phone, user);
}

async function getUniqueUserCode() {
  try {
    var allUsers = await getAllUsers();
    var usedCodes = new Set();
    var vals = Object.values(allUsers);
    for (var i = 0; i < vals.length; i++) {
      var u = vals[i];
      if (u && u.userCode && !isNaN(parseInt(u.userCode))) usedCodes.add(parseInt(u.userCode));
    }
    var code = 1;
    while (usedCodes.has(code)) code++;
    return code;
  } catch(e) { return Date.now(); }
}
window.getUniqueUserCode = getUniqueUserCode;

async function resetAllUserCodes() {
  if (currentPhone !== CREATOR_PHONE) { showShopNotification('فقط سازنده', 'error'); return; }
  if (!confirm('همه کدهای کاربری حذف و از ۱ داده می‌شوند؟')) return;
  showShopNotification('در حال بازنشانی...');
  try {
    var allUsers = await getAllUsers();
    var entries = Object.entries(allUsers);
    entries.sort(function(a, b) {
      var tA = a[1].createdAt || a[1].registeredAt || a[1].lastSeen || parseInt(a[1].userCode) || 0;
      var tB = b[1].createdAt || b[1].registeredAt || b[1].lastSeen || parseInt(b[1].userCode) || 0;
      return tA - tB;
    });
    var counter = 1;
    var now = Date.now();
    for (var i = 0; i < entries.length; i++) {
      var p = entries[i][0];
      var u = entries[i][1];
      u.userCode = counter;
      u.lastUpdatedAt = now;
      allUsers[p] = u;
      await saveUser(p, u);
      counter++;
    }
    await saveAllUsers(allUsers);
    await redisSet('user_code_counter', counter - 1);
    showShopNotification('✅ ' + (counter-1) + ' کاربر بازنشانی شد');
    if (currentUserData && allUsers[currentPhone]) {
      currentUserData.userCode = allUsers[currentPhone].userCode;
      localStorage.setItem('user_cache_' + currentPhone, JSON.stringify(currentUserData));
      updateUIWithData(currentUserData);
    }
    await loadUsers();
    sendSignal('global', 'codes_reset', {});
  } catch(e) { showShopNotification('خطا', 'error'); }
}
window.resetAllUserCodes = resetAllUserCodes;

async function assignCodeIfMissing(phone, user) {
  if (!user) return user;
  if (user.userCode && !isNaN(parseInt(user.userCode)) && parseInt(user.userCode) > 0) return user;
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
window.assignCodeIfMissing = assignCodeIfMissing;

async function getAllWhitelistIPs() { return await redisGet('whitelist_ips') || {}; }
async function isIPWhitelisted(ip, deviceId) {
  if (!ip && !deviceId) return false;
  try {
    var list = await getAllWhitelistIPs();
    var cIP = ip ? String(ip).trim() : '';
    var cDev = deviceId ? String(deviceId).trim() : '';
    if (cIP && list[cIP]) return true;
    if (cDev && list[cDev]) return true;
    if (cDev && list['dev_' + cDev]) return true;
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

async function fetchUserIP() {
  try {
    var c = new AbortController(); var t = setTimeout(function(){c.abort();}, 3000);
    var r = await fetch('https://api.ipify.org?format=json', { signal: c.signal, cache: 'no-store' });
    clearTimeout(t);
    if (r.ok) { var d = await r.json(); if (d && d.ip) return String(d.ip).trim(); }
  } catch(e) {}
  try {
    var c2 = new AbortController(); var t2 = setTimeout(function(){c2.abort();}, 3000);
    var r2 = await fetch('https://api64.ipify.org?format=json', { signal: c2.signal, cache: 'no-store' });
    clearTimeout(t2);
    if (r2.ok) { var d2 = await r2.json(); if (d2 && d2.ip) return String(d2.ip).trim(); }
  } catch(e) {}
  return null;
}

function getDeviceId() {
  var id = localStorage.getItem('__device_id__');
  if (!id) {
    var parts = [navigator.userAgent||'ua', navigator.platform||'plat', screen.width+'x'+screen.height, screen.colorDepth||24, navigator.language||'fa', navigator.hardwareConcurrency||4, new Date().getTimezoneOffset()];
    var raw = parts.join('|'); var hash = 0;
    for (var i = 0; i < raw.length; i++) { hash = ((hash << 5) - hash) + raw.charCodeAt(i); hash = hash & hash; }
    id = 'dev_' + Math.abs(hash) + '_' + Date.now().toString(36);
    localStorage.setItem('__device_id__', id);
  }
  return id;
}

function redirectToBan(b,p){
  if(isRedirecting) return;
  isRedirecting = true;
  var params = new URLSearchParams({ phone:p, by:b.bannedBy||'مدیریت', reason:b.reason||'بدون دلیل', duration:b.duration||'1d', expires:b.expiresAt||'', createdAt:b.createdAt||b.bannedAt||'' });
  window.location.href = 'Ban.html?' + params.toString();
}

function toPersianNum(n){var p=['۰','۱','۲','۳','۴','۵','۶','۷','۸','۹'];return String(n).replace(/[0-9]/g,function(w){return p[+w];});}

function getRoleTick(role){
  if(!role)return null;
  var r=role.trim();
  if(r==='سازنده'||r==='پشتیبانی')return['Tik1.png'];
  if(r==='ادمین ارشد')return['Tik1000.png'];
  if(r==='ادمین')return['Tik2.png'];
  if(r==='گرداننده')return['Tik3.png'];
  if(r==='ناظر'||r==='ناظر ارشد')return['TIK4.png','Tik4.png'];
  return null;
}
function applyTick(img,cands){
  if(!img||!cands||!cands.length)return;
  var i=0;
  (function nx(){
    if(i>=cands.length){img.style.display='none';return;}
    var s=cands[i++];
    var t=new Image();
    t.onload=function(){img.src=s;img.style.display='inline-block';};
    t.onerror=nx;
    t.src=s;
  })();
}

var RANK_LEVEL = {'کاربر':0,'ناظر':1,'ناظر ارشد':2,'ادمین':3,'ادمین ارشد':4,'گرداننده':5,'پشتیبانی':6,'سازنده':7};
var RANK_PERM = {
  'سازنده':{panel:true,coins:true,gems:true,dollars:true,rank:true,exclusive:true,del:true,server:true,wipe:true,banMax:'permanent',stats:true,ipControl:true,userControl:true,whitelist:true},
  'پشتیبانی':{panel:true,coins:false,gems:false,dollars:false,rank:false,exclusive:false,del:false,server:false,wipe:false,banMax:'3m',stats:false,ipControl:false,userControl:false,whitelist:false},
  'ادمین ارشد':{panel:true,coins:true,gems:true,dollars:true,rank:true,exclusive:false,del:false,server:false,wipe:false,banMax:'1m',stats:true,ipControl:true,userControl:true,whitelist:false},
  'گرداننده':{panel:true,coins:true,gems:true,dollars:true,rank:true,exclusive:false,del:false,server:false,wipe:false,banMax:'3m',stats:true,ipControl:false,userControl:false,whitelist:false}
};
var BAN_OPTIONS = [['1h','۱ ساعت'],['1d','۱ روز'],['7d','۷ روز'],['2w','۲ هفته'],['1m','۱ ماه'],['3m','۳ ماه'],['8m','۸ ماه'],['permanent','دائمی']];
var DUR_MS = {'1h':3600000,'1d':86400000,'7d':604800000,'2w':1209600000,'1m':2592000000,'3m':7776000000,'8m':20736000000,'permanent':0};

function getPerm(){
  var rank = (currentUserData && currentUserData.rank) || 'کاربر';
  var isCreator = (currentPhone === CREATOR_PHONE) || rank === 'سازنده';
  if (isCreator) return RANK_PERM['سازنده'];
  return RANK_PERM[rank] || {panel:false};
}
function fillBanOptions(max){
  var order = BAN_OPTIONS.map(function(o){return o[0];});
  var idx = order.indexOf(max);
  var sel = document.getElementById('editBanDuration');
  if (!sel) return;
  sel.innerHTML = '';
  BAN_OPTIONS.forEach(function(o,i){
    if (idx < 0 || i <= idx) {
      var op = document.createElement('option');
      op.value = o[0]; op.textContent = o[1];
      sel.appendChild(op);
    }
  });
  sel.selectedIndex = sel.options.length - 1;
}

var GROUP_ICONS = {
  shield: '<svg viewBox="0 0 24 24"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/></svg>',
  lion: '<svg viewBox="0 0 24 24"><path d="M7 4c-1.1 0-2 .9-2 2v1c-1.1 0-2 .9-2 2v7c0 2.76 2.24 5 5 5h8c2.76 0 5-2.24 5-5V9c0-1.1-.9-2-2-2V6c0-1.1-.9-2-2-2H7z"/></svg>',
  eagle: '<svg viewBox="0 0 24 24"><path d="M18 4l-2 2H8L6 4H2v2l2.5 1c-.83 1.2-1.5 2.68-1.5 4.5C3 15 5 18 8 19l2 2v1h4v-1l2-2c3-1 5-4 5-7.5 0-1.82-.67-3.3-1.5-4.5L22 6V4h-4z"/></svg>',
  dragon: '<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/></svg>',
  skull: '<svg viewBox="0 0 24 24"><path d="M12 2C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7z"/></svg>',
  fire: '<svg viewBox="0 0 24 24"><path d="M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67z"/></svg>',
  crown: '<svg viewBox="0 0 24 24"><path d="M12 1L9 9l-7 3 2 9h16l2-9-7-3-3-8z"/></svg>',
  star: '<svg viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>'
};
function getGroupIcon(key){return GROUP_ICONS[key] || GROUP_ICONS.shield;}

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
  {id:901, src:'655.webm', price:0, owned:false, exclusive:true, name:'اختصاصی سازنده'},
  {id:902, src:'2000.webm', price:0, owned:false, exclusive:true, name:'اختصاصی مدیریت ارشد'},
  {id:903, src:'2003.webm', price:0, owned:false, exclusive:true, name:'اختصاصی مدیریت ارشد'},
  {id:904, src:'2001.webm', price:0, owned:false, exclusive:true, name:'اختصاصی ادمین'},
  {id:905, src:'2002.webm', price:0, owned:false, exclusive:true, name:'اختصاصی ادمین'}
];

var templates = [
  {id:'t1', src:'Ga1.webp', price:1500, name:'قالب طلایی'},
  {id:'t2', src:'Ga2.webp', price:2000, name:'قالب الماسی'},
  {id:'t3', src:'Ga3.webp', price:1000, name:'قالب نقره‌ای'}
];

window.avatarLoadError = function(img, src){
  img.style.display = 'none';
  var box = img.parentElement;
  if (box && !box.querySelector('.avatar-missing')) {
    var d = document.createElement('div');
    d.className = 'avatar-missing';
    d.innerHTML = '❌<br>' + src;
    box.appendChild(d);
  }
};

function setupVideoObserver(){
  if (videoObserver) return;
  videoObserver = new IntersectionObserver(function(entries){
    entries.forEach(function(entry){
      var v = entry.target;
      if (entry.isIntersecting) { if (v.paused) v.play().catch(function(){}); }
      else { if (!v.paused) v.pause(); }
    });
  }, {threshold:0.1});
}
function observeVideos(container){
  if (!container) return;
  setupVideoObserver();
  var vs = container.querySelectorAll('video');
  for (var i = 0; i < vs.length; i++) videoObserver.observe(vs[i]);
}

function sanitizeUserData(user, phone){
  if (!user) return user;
  var isCreator = (phone === CREATOR_PHONE);
  if (user.avatar === '655.webm' && !isCreator) user.avatar = user.previousAvatar || 'Mafia2.png';
  if (user.exclusiveAvatar === '655.webm' && !isCreator) {
    delete user.exclusiveAvatar;
    if (user.ownedAvatars) user.ownedAvatars = user.ownedAvatars.filter(function(a){return a !== 'ex_655.webm';});
  }
  if (user.coins < 0) user.coins = 0;
  if (user.gems < 0) user.gems = 0;
  if (user.dollars < 0) user.dollars = 0;
  if (user.cups === undefined) user.cups = 0;
  if (user.hours === undefined) user.hours = 0;
  if (!user.ownedTemplates) user.ownedTemplates = [];
  if (!user.currentTemplate) user.currentTemplate = null;
  var xp = Math.floor((user.cups / 10) * 20 + (user.hours || 0) * 100);
  user.xp = xp;
  var level = 1;
  if (xp >= 1000) { level = 2 + Math.floor((xp - 3000) / 1000); if (level < 2) level = 2; if (level > 100) level = 100; }
  user.level = level;
  return user;
}

function getValidAvatar(src, phone){
  var isCreator = (phone === CREATOR_PHONE);
  if (src === '655.webm' && !isCreator) return 'Mafia2.png';
  return src;
}

function createMediaElement(src){
  var isVideo = src.endsWith('.webm') || src.endsWith('.mp4') || src.endsWith('.mov');
  if (isVideo) {
    var v = document.createElement('video');
    v.src = src; v.autoplay = true; v.loop = true; v.muted = true; v.playsInline = true;
    v.preload = 'metadata';
    v.setAttribute('muted','muted');
    v.setAttribute('playsinline','playsinline');
    v.setAttribute('webkit-playsinline','webkit-playsinline');
    v.style.objectFit = 'cover';
    return v;
  } else {
    var i = document.createElement('img');
    i.src = src;
    i.onerror = function(){ this.style.display = 'none'; };
    return i;
  }
}

function buildAvatarWithTemplate(avatarSrc, templateSrc){
  var wrapper = document.createElement('div');
  wrapper.className = 'avatar-with-template';
  var inner = document.createElement('div');
  inner.className = 'avatar-inner';
  inner.appendChild(createMediaElement(avatarSrc));
  wrapper.appendChild(inner);
  if (templateSrc) {
    var overlay = document.createElement('img');
    overlay.className = 'template-overlay';
    overlay.src = templateSrc;
    overlay.onerror = function(){ this.style.display = 'none'; };
    wrapper.appendChild(overlay);
  }
  return wrapper;
}

function getCurrentTemplate(){
  if (!currentUserData || !currentUserData.currentTemplate) return null;
  return currentUserData.currentTemplate;
}

function updateGlobalAvatar(src){
  var validSrc = getValidAvatar(src, currentPhone);
  var templateSrc = getCurrentTemplate();
  var mainContainer = document.getElementById('mainAvatarContainer');
  var profileContainer = document.getElementById('openAvatarShop');
  var showcaseContainer = document.getElementById('showcaseAvatarContainer');
  var templateShowcase = document.getElementById('templateShowcaseContainer');
  function buildContent(){
    var frag = document.createDocumentFragment();
    if (templateSrc) frag.appendChild(buildAvatarWithTemplate(validSrc, templateSrc));
    else frag.appendChild(createMediaElement(validSrc));
    return frag;
  }
  if (mainContainer) { mainContainer.innerHTML = ''; mainContainer.appendChild(buildContent()); observeVideos(mainContainer); }
  if (profileContainer) { profileContainer.innerHTML = ''; profileContainer.appendChild(buildContent()); observeVideos(profileContainer); }
  if (showcaseContainer) { showcaseContainer.innerHTML = ''; showcaseContainer.appendChild(buildContent()); observeVideos(showcaseContainer); }
  if (templateShowcase) { templateShowcase.innerHTML = ''; templateShowcase.appendChild(buildContent()); observeVideos(templateShowcase); }
}

function updateUIWithData(user){
  function setText(id, val) { var el = document.getElementById(id); if (el) el.textContent = val; }
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

  updateClanRank();
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
  var tcfg = document.getElementById('tournamentConfig');
  if (tcfg) tcfg.style.display = (currentPhone === CREATOR_PHONE) ? 'block' : 'none';
  var btnUserControl = document.getElementById('btnUserControl');
  if (btnUserControl) btnUserControl.style.display = perm.userControl ? 'block' : 'none';
  var btnWhitelistIP = document.getElementById('btnWhitelistIP');
  if (btnWhitelistIP) btnWhitelistIP.style.display = perm.whitelist ? 'block' : 'none';

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

async function updateClanRank(){
  var el = document.getElementById('statClanRank');
  if (!el) return;
  try {
    if (!currentPhone) { el.textContent = '-'; return; }
    var groups = await getGroups();
    if (!groups.length) { el.textContent = '-'; return; }
    var allUsers = await getAllUsers();
    var groupsWithStats = groups.map(function(g){
      var totalPoints = parseInt(g.extraPoints) || 0;
      if (g.members) g.members.forEach(function(m){
        var u = allUsers[m];
        if (u) totalPoints += ((parseInt(u.cups) || 0) * 2) + ((parseInt(u.hours) || 0) * 20);
      });
      return {id: g.id, points: totalPoints};
    });
    groupsWithStats.sort(function(a,b){return b.points - a.points;});
    var myGroupId = null;
    for (var i = 0; i < groups.length; i++) {
      var g = groups[i];
      if (g.owner === currentPhone || (g.members && g.members.includes(currentPhone)) || (g.deputies && g.deputies.includes(currentPhone))) { myGroupId = g.id; break; }
    }
    if (!myGroupId) { el.textContent = '-'; return; }
    var rank = groupsWithStats.findIndex(function(g){return g.id === myGroupId;}) + 1;
    el.textContent = rank > 0 ? toPersianNum(rank) : '-';
  } catch(e) { el.textContent = '-'; }
}

async function saveUserData(){
  if (!currentUserData || !currentPhone) return;
  if (pauseSync) return;
  var am = document.getElementById('adminModal');
  if (am && am.classList.contains('active')) return;
  var eu = document.getElementById('editUserModal');
  if (eu && eu.classList.contains('active')) return;

  currentUserData.lastUpdatedAt = Date.now();
  currentUserData = sanitizeUserData(currentUserData, currentPhone);
  localStorage.setItem('user_cache_' + currentPhone, JSON.stringify(currentUserData));
  await saveUser(currentPhone, currentUserData);

  var allUsers = await getAllUsers();
  allUsers[currentPhone] = currentUserData;
  await saveAllUsers(allUsers);

  sendSignal('user_' + currentPhone, 'updated', {phone: currentPhone});
}

async function saveAvatarToStorage(src){
  if (!currentUserData || !currentPhone) return;
  var isCreator = (currentPhone === CREATOR_PHONE);
  if (src === '655.webm' && !isCreator) { showShopNotification('این آواتار فقط مخصوص سازنده است!', 'error'); return; }
  if (currentUserData.avatar && currentUserData.avatar !== src) currentUserData.previousAvatar = currentUserData.avatar;
  currentUserData.avatar = src;
  localAvatarLock = Date.now();
  await saveUserData();
}

async function saveTemplateToStorage(src){
  if (!currentUserData || !currentPhone) return;
  currentUserData.currentTemplate = src;
  localTemplateLock = Date.now();
  await saveUserData();
}

async function changeUsername(){
  var nn = prompt("نام کاربری جدید را وارد کنید (حداکثر ۲۰ کاراکتر):");
  if (nn && nn.trim() !== "") {
    var trimmedName = nn.trim();
    if (trimmedName.length > 20) { showShopNotification('نام کاربری حداکثر ۲۰ کاراکتر!', 'error'); return; }
    if (currentUserData.coins >= 100) {
      currentUserData.coins -= 100; currentUserData.name = trimmedName;
      await saveUserData(); updateUIWithData(currentUserData);
    } else showShopNotification('سکه کافی ندارید! (۱۰۰ سکه)', 'error');
  }
}

function copyToClipboard(t, m){
  navigator.clipboard.writeText(t).then(function(){ showShopNotification(m||'کپی شد!'); }).catch(function(){
    var ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); document.body.removeChild(ta);
    showShopNotification(m||'کپی شد!');
  });
}
function closeModal(id){ var e = document.getElementById(id); if (e) e.classList.remove('active'); }
function closeEditUser(){ var e = document.getElementById('editUserModal'); if (e) e.classList.remove('active'); editingUserId = null; editingUserExclusiveAvatar = null; pauseSync = false; }
function closeAdminModal(){ var e = document.getElementById('adminModal'); if (e) e.classList.remove('active'); pauseSync = false; }
function showShopNotification(m, t){
  var n = document.getElementById('shopNotification');
  if (!n) return;
  n.textContent = m;
  n.className = 'shop-notification show' + (t === 'error' ? ' error' : '');
  setTimeout(function(){ n.classList.remove('show'); }, 3000);
}

function lockServerForeverInGame(){
  if (gameServerLocked) return;
  gameServerLocked = true;
  document.addEventListener('click', function(e){ e.preventDefault(); e.stopPropagation(); return false; }, true);
  document.addEventListener('touchstart', function(e){ e.preventDefault(); e.stopPropagation(); return false; }, true);
  document.addEventListener('touchmove', function(e){ e.preventDefault(); e.stopPropagation(); return false; }, true);
  document.addEventListener('touchend', function(e){ e.preventDefault(); e.stopPropagation(); return false; }, true);
  var overlay = document.getElementById('serverDownOverlay');
  if (overlay) {
    overlay.classList.add('show');
    overlay.style.cssText = 'position:fixed !important;inset:0 !important;width:100vw !important;height:100vh !important;z-index:2147483647 !important;background:rgba(0,0,0,0.95) !important;display:flex !important;align-items:center !important;justify-content:center !important;flex-direction:column !important;text-align:center !important;padding:30px !important;touch-action:none !important;';
  }
  try { history.pushState(null, null, location.href); } catch(e) {}
  window.addEventListener('popstate', function(){
    if (gameServerLocked) {
      try { history.pushState(null, null, location.href); } catch(e) {}
      try { if (window.Android && window.Android.exitApp) window.Android.exitApp(); } catch(err) {}
      try { navigator.app && navigator.app.exitApp && navigator.app.exitApp(); } catch(err) {}
    }
  });
  setInterval(function(){ if (gameServerLocked) { try { history.pushState(null, null, location.href); } catch(e) {} } }, 1000);
}

function startAwayTimer(){
  if (currentPhone === CREATOR_PHONE) return;
  clearTimeout(awayTimer);
  awayTimer = setTimeout(async function(){
    isUserAway = true;
    if (window.ogShowAway) { try { window.ogShowAway(); } catch(e) {} }
    try {
      var loggedIn = JSON.parse(localStorage.getItem('currentLoggedInUser') || 'null');
      if (!loggedIn || !loggedIn.phone) return;
      var user = await getUser(loggedIn.phone);
      if (user) {
        user.online = false; user.lastSeen = Date.now();
        await saveUser(loggedIn.phone, user);
        var allUsers = await getAllUsers();
        allUsers[loggedIn.phone] = user;
        await saveAllUsers(allUsers);
      }
      setFBOnline(loggedIn.phone, false, {});
    } catch(e) {}
  }, AWAY_TIMEOUT_MS);
}
function cancelAwayTimer(){ clearTimeout(awayTimer); awayTimer = null; }
async function reconnectUser(){
  if (!isUserAway) return;
  isUserAway = false;
  try {
    var loggedIn = JSON.parse(localStorage.getItem('currentLoggedInUser') || 'null');
    if (!loggedIn || !loggedIn.phone) return;
    var user = await getUser(loggedIn.phone);
    if (user) {
      user.online = true; user.lastSeen = Date.now();
      await saveUser(loggedIn.phone, user);
      var allUsers = await getAllUsers();
      allUsers[loggedIn.phone] = user;
      await saveAllUsers(allUsers);
    }
    setFBOnline(loggedIn.phone, true, {});
  } catch(e) {}
}

document.addEventListener('visibilitychange', function(){
  if (document.hidden) startAwayTimer();
  else { cancelAwayTimer(); reconnectUser(); }
});
window.addEventListener('blur', startAwayTimer);
window.addEventListener('focus', function(){ cancelAwayTimer(); reconnectUser(); });

async function findUserGroup(phone){
  try {
    var groups = await getGroups();
    for (var i = 0; i < groups.length; i++) {
      var g = groups[i];
      if (!g) continue;
      if (g.owner === phone) return g;
      if (g.members && g.members.includes(phone)) return g;
      if (g.deputies && g.deputies.includes(phone)) return g;
    }
    return null;
  } catch(e) { return null; }
}

async function updateGroupDisplay(){
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
      if (group.logo && (group.logo.endsWith('.webp') || group.logo.endsWith('.png') || group.logo.endsWith('.jpg') || group.logo.endsWith('.jpeg'))) {
        badgeEl.innerHTML = '<img src="' + group.logo + '" style="width:100%;height:100%;object-fit:contain;padding:4px;" onerror="this.style.display=\'none\';this.parentElement.innerHTML=\'' + getGroupIcon('shield').replace(/"/g,'&quot;') + '\'">';
      } else {
        badgeEl.innerHTML = getGroupIcon(group.logo || 'shield');
      }
      userGroupCache = group;
    } else {
      nameEl.textContent = 'بدون گروه';
      badgeEl.className = 'clan-badge no-group';
      badgeEl.innerHTML = '❌';
      userGroupCache = null;
    }
    await updateClanRank();
  } catch(e) {
    nameEl.textContent = 'بدون گروه';
    badgeEl.className = 'clan-badge no-group';
    badgeEl.innerHTML = '❌';
  }
}

function compressImage(file, maxSize, cb){
  var reader = new FileReader();
  reader.onload = function(evt){
    var img = new Image();
    img.onload = function(){
      var w = img.width, h = img.height;
      if (w > maxSize || h > maxSize) { var ratio = Math.min(maxSize/w, maxSize/h); w = Math.round(w*ratio); h = Math.round(h*ratio); }
      var canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
      var ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, w, h);
      cb(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.src = evt.target.result;
  };
  reader.readAsDataURL(file);
}

async function loadNews(){
  var news = await getNews();
  var list = document.getElementById('newsList');
  var area = document.getElementById('newsCreatorArea');
  var badge = document.getElementById('newsBadge');
  if (currentUserData && (currentUserData.rank === 'سازنده' || currentPhone === CREATOR_PHONE)) { if (area) area.style.display = 'block'; }
  var key = 'user_read_news_' + currentPhone;
  var read = JSON.parse(localStorage.getItem(key) || '[]');
  var unread = news.filter(function(n){ return !read.includes(n.id); }).length;
  if (badge) {
    if (unread > 0) { badge.textContent = toPersianNum(unread); badge.style.display = 'flex'; }
    else badge.style.display = 'none';
  }
  if (!list) return;
  if (!news.length) { list.innerHTML = '<div style="text-align:center;color:rgba(255,255,255,.6);padding:20px;">هیچ اطلاعیه‌ای وجود ندارد</div>'; return; }
  list.innerHTML = news.slice().reverse().map(function(it){
    return '<div class="news-item" onclick="markNewsAsRead(' + it.id + ')"><div class="news-title">' + it.title + '</div><div class="news-content">' + it.content + '</div><div class="news-date">' + it.date + ' - ' + (it.sender || 'مدیریت') + '</div></div>';
  }).join('');
}
function markNewsAsRead(id){
  var key = 'user_read_news_' + currentPhone;
  var read = JSON.parse(localStorage.getItem(key) || '[]');
  if (!read.includes(id)) { read.push(id); localStorage.setItem(key, JSON.stringify(read)); loadNews(); }
}
async function sendNews(){
  var t = document.getElementById('newsTitleInput').value.trim();
  var c = document.getElementById('newsContentInput').value.trim();
  if (!t || !c) { showShopNotification('عنوان و متن را وارد کنید', 'error'); return; }
  var news = await getNews();
  news.push({id: Date.now(), title: t, content: c, date: new Date().toLocaleDateString('fa-IR'), sender: currentUserData.name});
  await saveNews(news);
  document.getElementById('newsTitleInput').value = '';
  document.getElementById('newsContentInput').value = '';
  await loadNews();
  sendSignal('global', 'news_updated', {});
}

async function loadAdminUsers(){
  var container = document.getElementById('adminUserListContainer');
  if (container) container.innerHTML = '<div style="color:#aaa;padding:20px;text-align:center;">در حال بارگذاری...</div>';
  var allUsers = await getAllUsers();
  currentUserList = Object.entries(allUsers).map(function(e){ return Object.assign({phone: e[0]}, e[1]); });
  renderAdminUsers(currentUserList);
}

function renderAdminUsers(list){
  var container = document.getElementById('adminUserListContainer');
  if (!container) return;
  var searchInput = document.getElementById('userSearchInput');
  var searchVal = searchInput ? searchInput.value.trim() : '';
  var filtered = list;
  if (searchVal) filtered = filtered.filter(function(u){ return String(u.userCode) === searchVal; });
  if (currentAdminTab === 'online') filtered = filtered.filter(function(u){ return u.online === true; });
  else if (currentAdminTab === 'offline') filtered = filtered.filter(function(u){ return u.online === false || u.online === undefined; });
  else if (currentAdminTab === 'banned') filtered = filtered.filter(function(u){ return u.banned === true; });
  else if (currentAdminTab === 'reports') filtered = filtered.filter(function(u){ return u.reportHistory && u.reportHistory.length > 0; });
  else if (currentAdminTab === 'lobby') filtered = filtered.filter(function(u){ return u.lobbyRequests && u.lobbyRequests.length > 0; });
  if (!filtered.length) { container.innerHTML = '<div style="color:#aaa;padding:20px;text-align:center;">کاربری یافت نشد</div>'; return; }
  container.innerHTML = filtered.map(function(u){
    var statusClass = u.banned ? 'status-banned' : (u.online ? 'status-online' : 'status-offline');
    var statusText = u.banned ? 'بن شده' : (u.online ? 'آنلاین' : 'آفلاین');
    return '<div class="admin-user-item" onclick="openUserHistory(\'' + u.phone + '\')"><div class="info"><span class="name">' + (u.name || 'کاربر') + ' (کد: ' + (toPersianNum(u.userCode) || '----') + ')</span><span class="detail">' + u.phone + ' | ' + (u.rank || 'کاربر') + '</span><span class="detail">IP: ' + (u.lastIP || '-') + ' | سطح: ' + toPersianNum(u.level || 1) + '</span></div><span class="status ' + statusClass + '">' + statusText + '</span></div>';
  }).join('');
}

async function openUserHistory(phone){
  viewingUserHistory = phone;
  var user = await getUser(phone);
  if (!user) return;
  document.getElementById('usersSection').style.display = 'none';
  document.getElementById('userHistorySection').style.display = 'block';
  document.getElementById('historyUserName').textContent = user.name || 'کاربر';
  var content = document.getElementById('historyContent');
  var html = '<div style="color:#fff;font-size:13px;margin-bottom:8px;">اطلاعات کاربر:</div><div style="color:#ccc;font-size:12px;background:rgba(255,255,255,.05);padding:10px;border-radius:8px;margin-bottom:8px;"><div>کد کاربری: ' + (toPersianNum(user.userCode) || '----') + '</div><div>شماره: ' + phone + '</div><div>مقام: ' + (user.rank || 'کاربر') + '</div><div>سکه: ' + toPersianNum(user.coins || 0) + ' | الماس: ' + toPersianNum(user.gems || 0) + ' | دولار: ' + toPersianNum(user.dollars || 0) + '</div><div>ساعت: ' + toPersianNum(user.hours || 0) + ' | کاپ: ' + toPersianNum(user.cups || 0) + ' | XP: ' + toPersianNum(user.xp || 0) + '</div><div>سطح: ' + toPersianNum(user.level || 1) + ' | برد امتیازی: ' + toPersianNum(user.compWins || 0) + '</div><div>وضعیت: ' + (user.banned ? 'بن شده' : (user.online ? 'آنلاین' : 'آفلاین')) + '</div><div style="color:#4fc3f7;font-weight:900;direction:ltr;">آخرین IP: ' + (user.lastIP || 'نامشخص') + '</div><div style="color:#4fc3f7;font-weight:900;font-size:11px;direction:ltr;word-break:break-all;">دستگاه: ' + (user.lastDevice || 'نامشخص') + '</div></div><button class="edit-btn save" onclick="quickWhitelistUser(\'' + (user.lastIP || '') + '\',\'' + (user.lastDevice || '') + '\',\'' + (user.name || '') + '\')" style="width:100%;margin-bottom:8px;background:linear-gradient(180deg,#4caf50,#2e7d32);">افزودن IP این کاربر به وایت‌لیست</button>';
  if (user.loginHistory && user.loginHistory.length) {
    html += '<div style="color:#fff;font-size:13px;margin:8px 0;">تاریخچه ورودها (' + toPersianNum(user.loginHistory.length) + '):</div>';
    html += user.loginHistory.slice().reverse().slice(0, 30).map(function(s){ return '<div class="admin-session-item"><span>' + new Date(s.time).toLocaleString('fa-IR') + '</span><span style="color:#4fc3f7;">IP: ' + (s.ip || '-') + '</span></div>'; }).join('');
    html += '<button class="edit-btn danger" onclick="clearUserSessions(\'' + phone + '\')" style="width:100%;margin-top:8px;">پاک کردن تاریخچه ورود</button>';
  }
  if (user.banHistory && user.banHistory.length) {
    html += '<div style="color:#fff;font-size:13px;margin:8px 0;">تاریخچه بن:</div>';
    html += user.banHistory.slice().reverse().map(function(b){ return '<div class="admin-session-item"><span>' + new Date(b.time).toLocaleString('fa-IR') + '</span><span>توسط: ' + (b.by || 'سیستم') + '</span><span>نوع: ' + (b.type || 'اکانت') + '</span></div>'; }).join('');
  }
  html += '<button class="edit-btn save" onclick="openEditUser(\'' + phone + '\')" style="width:100%;margin-top:12px;">ویرایش کامل کاربر</button>';
  content.innerHTML = html;
}

async function quickWhitelistUser(ip, deviceId, userName){
  if (!ip && !deviceId) { showShopNotification('اطلاعات این کاربر موجود نیست', 'error'); return; }
  if (!confirm('افزودن به وایت‌لیست؟\nکاربر: ' + userName)) return;
  var added = [];
  if (ip && ip !== 'نامشخص' && ip !== '-') { await addToWhitelist(ip, 'auto: ' + userName, currentPhone); added.push(ip); }
  if (deviceId && deviceId !== 'نامشخص' && deviceId !== '-') { await addToWhitelist(deviceId, 'auto-dev: ' + userName, currentPhone); added.push('دستگاه'); }
  if (added.length > 0) showShopNotification(added.join(' + ') + ' اضافه شد');
  else showShopNotification('اطلاعات معتبر نبود', 'error');
}
async function clearUserSessions(phone){
  if (!confirm('پاک کردن کامل تاریخچه ورودهای این کاربر؟')) return;
  var user = await getUser(phone); if (!user) return;
  user.loginHistory = [];
  await saveUser(phone, user);
  var allUsers = await getAllUsers(); allUsers[phone] = user; await saveAllUsers(allUsers);
  showShopNotification('تاریخچه ورود پاک شد');
  openUserHistory(phone);
  sendSignal('user_' + phone, 'updated', {phone: phone});
}
function closeUserHistory(){
  document.getElementById('userHistorySection').style.display = 'none';
  document.getElementById('usersSection').style.display = 'block';
  loadAdminUsers();
}

async function setUserOnlineStatus(online){
  if (!currentPhone) return;
  var user = await getUser(currentPhone); if (!user) return;
  user.online = online; user.lastSeen = Date.now();
  if (myIP) user.lastIP = myIP;
  if (currentDeviceId) user.lastDevice = currentDeviceId;
  await saveUser(currentPhone, user);
  setFBOnline(currentPhone, online, {name: user.name, rank: user.rank});
}

async function forceUserLogin(){
  var phone = document.getElementById('controlUserPhone').value.trim();
  if (!phone) { showShopNotification('شماره موبایل را وارد کنید', 'error'); return; }
  var user = await getUser(phone); if (!user) { showShopNotification('کاربر یافت نشد', 'error'); return; }
  user.forceOnline = true; user.online = true; user.forceLoginAt = Date.now(); user.lastUpdatedAt = Date.now();
  await saveUser(phone, user);
  var all = await getAllUsers(); all[phone] = user; await saveAllUsers(all);
  showShopNotification('کاربر وارد بازی شد');
  sendSignal('user_' + phone, 'force_login', {phone: phone});
}
async function forceUserLogout(){
  var phone = document.getElementById('controlUserPhone').value.trim();
  if (!phone) { showShopNotification('شماره موبایل را وارد کنید', 'error'); return; }
  var user = await getUser(phone); if (!user) { showShopNotification('کاربر یافت نشد', 'error'); return; }
  user.forceOnline = false; user.online = false; user.forceLogoutAt = Date.now(); user.lastUpdatedAt = Date.now();
  await saveUser(phone, user);
  var all = await getAllUsers(); all[phone] = user; await saveAllUsers(all);
  showShopNotification('کاربر از بازی خارج شد');
  sendSignal('user_' + phone, 'force_logout', {phone: phone});
}
async function clearUserData(){
  var phone = document.getElementById('controlUserPhone').value.trim();
  if (!phone) { showShopNotification('شماره موبایل را وارد کنید', 'error'); return; }
  if (!confirm('پاک‌سازی کامل داده‌های این کاربر؟')) return;
  var user = await getUser(phone); if (!user) { showShopNotification('کاربر یافت نشد', 'error'); return; }
  user.coins = 0; user.gems = 0; user.dollars = 0; user.cups = 0; user.hours = 0; user.xp = 0; user.level = 1;
  user.compWins = 0; user.friendWins = 0; user.monitorCount = 0; user.bestScore = 0; user.mafiaWins = 0; user.citizenWins = 0; user.score = 0;
  user.lastUpdatedAt = Date.now();
  await saveUser(phone, user);
  var all = await getAllUsers(); all[phone] = user; await saveAllUsers(all);
  showShopNotification('داده‌های کاربر پاک شد');
  sendSignal('user_' + phone, 'updated', {phone: phone});
}
async function clearUserSessionsFromPanel(){
  var phone = document.getElementById('controlUserPhone').value.trim();
  if (!phone) { showShopNotification('شماره موبایل را وارد کنید', 'error'); return; }
  if (!confirm('پاک کردن تاریخچه ورودهای این کاربر؟')) return;
  var user = await getUser(phone); if (!user) { showShopNotification('کاربر یافت نشد', 'error'); return; }
  user.loginHistory = [];
  await saveUser(phone, user);
  var all = await getAllUsers(); all[phone] = user; await saveAllUsers(all);
  showShopNotification('تاریخچه ورود پاک شد');
}

async function refreshWhitelistUI(){
  var list = await getAllWhitelistIPs();
  var container = document.getElementById('whitelistItemsList');
  if (!container) return;
  var ips = Object.keys(list);
  if (!ips.length) { container.innerHTML = '<div style="color:rgba(255,255,255,.5);font-size:11px;text-align:center;padding:8px;">لیست خالی است</div>'; return; }
  container.innerHTML = ips.map(function(ip){
    var info = list[ip] || {};
    var note = info.note ? ' - ' + info.note : '';
    return '<div class="whitelist-item"><span style="direction:ltr;">' + ip + note + '</span><button onclick="removeWhitelistIP(\'' + ip + '\')">حذف</button></div>';
  }).join('');
}
async function addWhitelistIP(){
  var ip = document.getElementById('whitelistIPInput').value.trim();
  var note = document.getElementById('whitelistNoteInput').value.trim();
  if (!ip) { showShopNotification('IP را وارد کنید', 'error'); return; }
  await addToWhitelist(ip, note, currentPhone);
  document.getElementById('whitelistIPInput').value = '';
  document.getElementById('whitelistNoteInput').value = '';
  showShopNotification('IP به لیست سفید اضافه شد');
  refreshWhitelistUI();
}
async function removeWhitelistIP(ip){
  if (!confirm('حذف این IP از لیست سفید؟')) return;
  await removeFromWhitelist(ip);
  showShopNotification('IP حذف شد');
  refreshWhitelistUI();
}

async function openEditUser(id){
  var perm = getPerm();
  if (!perm.panel) { showShopNotification('دسترسی ندارید', 'error'); return; }
  var allUsers = await getAllUsers();
  var u = allUsers[id]; if (!u) return;
  var myLevel = RANK_LEVEL[(currentUserData.rank || 'کاربر')] || 0;
  var targetLevel = RANK_LEVEL[(u.rank || 'کاربر')] || 0;
  var isCreator = (currentPhone === CREATOR_PHONE) || (currentUserData.rank === 'سازنده');
  if (!isCreator && targetLevel >= myLevel) { showShopNotification('نمی‌توانید هم‌مقام یا بالاتر را ویرایش کنید', 'error'); return; }
  editingUserId = id; pauseSync = true;
  if (u.exclusiveAvatar === '655.webm' && id !== CREATOR_PHONE) { editingUserExclusiveAvatar = null; u.exclusiveAvatar = null; }
  else { editingUserExclusiveAvatar = u.exclusiveAvatar || null; }
  document.getElementById('editUserName').value = u.name || '';
  document.getElementById('editUserCode').value = u.userCode || '';
  document.getElementById('editUserCoins').value = u.coins || 0;
  document.getElementById('editUserGems').value = u.gems || 0;
  document.getElementById('editUserDollars').value = u.dollars || 0;
  document.getElementById('editUserRole').value = u.rank || 'کاربر';
  document.getElementById('editUserCups').value = u.cups || 0;
  document.getElementById('editUserHours').value = u.hours || 0;
  document.getElementById('editUserLevel').value = u.level || 1;
  document.getElementById('editUserCompWins').value = u.compWins || 0;
  document.getElementById('editUserFriendWins').value = u.friendWins || 0;
  document.getElementById('editUserMonitor').value = u.monitorCount || 0;
  document.getElementById('editUserMafiaWins').value = u.mafiaWins || 0;
  document.getElementById('editUserCitizenWins').value = u.citizenWins || 0;
  document.getElementById('editUserBestScore').value = u.bestScore || 0;
  var preview = document.getElementById('exclusiveAvatarPreview');
  if (u.exclusiveAvatar) {
    if (u.exclusiveAvatar.endsWith('.webm') || u.exclusiveAvatar.endsWith('.mp4')) { preview.innerHTML = '<video src="' + u.exclusiveAvatar + '" autoplay loop muted playsinline webkit-playsinline style="width:100%;height:100%;object-fit:cover;"></video>'; }
    else { preview.innerHTML = '<img src="' + u.exclusiveAvatar + '" alt="exclusive">'; }
  } else { preview.innerHTML = '<span class="exclusive-avatar-placeholder">👤</span>'; }
  document.getElementById('fieldCoins').style.display = perm.coins ? 'block' : 'none';
  document.getElementById('fieldGems').style.display = perm.gems ? 'block' : 'none';
  document.getElementById('fieldDollars').style.display = perm.dollars ? 'block' : 'none';
  document.getElementById('fieldRank').style.display = perm.rank ? 'block' : 'none';
  document.getElementById('fieldStats').style.display = perm.stats ? 'block' : 'none';
  document.getElementById('fieldExclusive').style.display = perm.exclusive ? 'block' : 'none';
  document.getElementById('rowDelete').style.display = perm.del ? 'flex' : 'none';
  document.getElementById('fieldBanType').style.display = 'block';
  fillBanOptions(perm.banMax || '1d');
  var bb = document.getElementById('btnBanUser');
  var ub = document.getElementById('btnUnbanUser');
  var bs = await getBanStatus(id);
  if (bs || u.banned) { bb.style.display = 'none'; ub.style.display = 'block'; } else { bb.style.display = 'block'; ub.style.display = 'none'; }
  document.getElementById('editUserModal').classList.add('active');
}

async function saveUserEdit(){
  if (!editingUserId) return;
  var perm = getPerm();
  var allUsers = await getAllUsers();
  var u = allUsers[editingUserId];
  if (!u) { pauseSync = false; return; }

  u.name = document.getElementById('editUserName').value.trim() || u.name;
  var newCodeRaw = document.getElementById('editUserCode').value.trim();
  if (newCodeRaw) { var newCode = parseInt(newCodeRaw); if (newCode > 0) u.userCode = newCode; }
  if (perm.coins) { var coins = parseInt(document.getElementById('editUserCoins').value) || 0; u.coins = coins < 0 ? 0 : coins; }
  if (perm.gems) { var gems = parseInt(document.getElementById('editUserGems').value) || 0; u.gems = gems < 0 ? 0 : gems; }
  if (perm.dollars) { var dollars = parseInt(document.getElementById('editUserDollars').value) || 0; u.dollars = dollars < 0 ? 0 : dollars; }
  if (perm.rank) u.rank = document.getElementById('editUserRole').value;
  if (perm.stats) {
    u.cups = parseInt(document.getElementById('editUserCups').value) || 0;
    u.hours = parseFloat(document.getElementById('editUserHours').value) || 0;
    u.level = parseInt(document.getElementById('editUserLevel').value) || 1;
    u.compWins = parseInt(document.getElementById('editUserCompWins').value) || 0;
    u.friendWins = parseInt(document.getElementById('editUserFriendWins').value) || 0;
    u.monitorCount = parseInt(document.getElementById('editUserMonitor').value) || 0;
    u.mafiaWins = parseInt(document.getElementById('editUserMafiaWins').value) || 0;
    u.citizenWins = parseInt(document.getElementById('editUserCitizenWins').value) || 0;
    u.bestScore = parseInt(document.getElementById('editUserBestScore').value) || 0;
  }
  if (perm.exclusive) {
    if (editingUserExclusiveAvatar) {
      if (editingUserExclusiveAvatar === '655.webm' && editingUserId !== CREATOR_PHONE) { showShopNotification('این آواتار فقط مخصوص سازنده است!', 'error'); return; }
      u.exclusiveAvatar = editingUserExclusiveAvatar;
      if (!u.ownedAvatars) u.ownedAvatars = [];
      var exKey = 'exclusive_' + editingUserId;
      if (!u.ownedAvatars.includes(exKey)) u.ownedAvatars.push(exKey);
    } else {
      delete u.exclusiveAvatar;
      if (u.ownedAvatars) u.ownedAvatars = u.ownedAvatars.filter(function(a){ return !a.startsWith('exclusive_'); });
      if (u.previousAvatar && u.previousAvatar !== u.avatar) u.avatar = u.previousAvatar;
      else if (!u.avatar || u.avatar === u.exclusiveAvatar) u.avatar = 'Mafia2.png';
    }
  }
  u.lastUpdatedAt = Date.now();
  allUsers[editingUserId] = u;
  await saveUser(editingUserId, u);
  await saveAllUsers(allUsers);
  sendSignal('user_' + editingUserId, 'admin_edit', {phone: editingUserId});
  if (editingUserId === currentPhone) {
    currentUserData = u;
    localStorage.setItem('user_cache_' + currentPhone, JSON.stringify(currentUserData));
    updateUIWithData(currentUserData);
  }
  closeEditUser();
  await loadUsers();
  showShopNotification('✅ تغییرات اعمال شد');
}

async function banUser(type){
  type = type || 'account';
  if (!editingUserId) return;
  var perm = getPerm();
  var allUsers = await getAllUsers();
  var u = allUsers[editingUserId];
  if (!u) return;
  if (editingUserId === CREATOR_PHONE) { showShopNotification('نمی‌توانید سازنده را بن کنید', 'error'); return; }
  var myLevel = RANK_LEVEL[(currentUserData.rank || 'کاربر')] || 0;
  var targetLevel = RANK_LEVEL[(u.rank || 'کاربر')] || 0;
  var isCreator = (currentPhone === CREATOR_PHONE) || (currentUserData.rank === 'سازنده');
  if (!isCreator && targetLevel >= myLevel) { showShopNotification('نمی‌توانید هم‌مقام یا بالاتر را بن کنید', 'error'); return; }
  var dur = document.getElementById('editBanDuration').value;
  var order = BAN_OPTIONS.map(function(o){return o[0];});
  var maxIdx = order.indexOf(perm.banMax);
  if (maxIdx >= 0 && order.indexOf(dur) > maxIdx) dur = perm.banMax;
  var banData = {isBanned: true, phone: editingUserId, bannedBy: currentUserData.name, reason: 'تخلف از قوانین', duration: dur, bannedAt: new Date().toISOString(), expiresAt: DUR_MS[dur] ? new Date(Date.now() + DUR_MS[dur]).toISOString() : null};
  if (type === 'device') {
    var deviceId = u.lastDevice || u.registeredDevice;
    if (!deviceId) { showShopNotification('دستگاه کاربر یافت نشد', 'error'); return; }
    await setDeviceBan(deviceId, banData);
    await addBanLog(editingUserId, {time: Date.now(), by: currentUserData.name, reason: 'بن دستگاه', duration: dur, type: 'device'});
    showShopNotification('دستگاه کاربر بن شد');
  } else if (type === 'ip') {
    var ip = u.lastIP || u.registeredIP;
    if (!ip) { showShopNotification('IP کاربر یافت نشد', 'error'); return; }
    await setIPBan(ip, banData);
    await addBanLog(editingUserId, {time: Date.now(), by: currentUserData.name, reason: 'بن IP', duration: dur, type: 'ip'});
    showShopNotification('IP کاربر بن شد');
  } else {
    await redisSet('ban:' + editingUserId, banData);
    u.banned = true;
    u.lastUpdatedAt = Date.now();
    allUsers[editingUserId] = u;
    await saveAllUsers(allUsers);
    await saveUser(editingUserId, u);
    await addBanLog(editingUserId, {time: Date.now(), by: currentUserData.name, reason: 'تخلف از قوانین', duration: dur, type: 'account'});
    showShopNotification('اکانت کاربر بن شد');
  }
  sendSignal('user_' + editingUserId, 'banned', {phone: editingUserId});
  closeEditUser();
  await loadUsers();
}

async function unbanUser(){
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
  var deviceId = u.lastDevice || u.registeredDevice;
  if (deviceId) await redisDel('device_ban:' + deviceId);
  var ip = u.lastIP || u.registeredIP;
  if (ip) await redisDel('ip_ban:' + ip);
  await addBanLog(editingUserId, {time: Date.now(), by: currentUserData.name, reason: 'رفع بن کامل', duration: 'unbanned', type: 'account'});
  sendSignal('user_' + editingUserId, 'unbanned', {phone: editingUserId});
  closeEditUser();
  await loadUsers();
  showShopNotification('همه بن‌ها برداشته شد');
}

async function deleteAccount(){
  if (!editingUserId) return;
  var perm = getPerm();
  if (!perm.del) { showShopNotification('دسترسی ندارید', 'error'); return; }
  var allUsers = await getAllUsers();
  var u = allUsers[editingUserId];
  if (!u) return;
  if (u.rank && u.rank !== 'کاربر') { showShopNotification('نمی‌توان مقام‌دار را حذف کرد', 'error'); return; }
  if (!confirm('حذف کامل اکانت "' + (u.name || 'کاربر') + '"؟')) return;
  delete allUsers[editingUserId];
  await saveAllUsers(allUsers);
  await redisDel('user:' + editingUserId);
  await redisDel('ban:' + editingUserId);
  sendSignal('user_' + editingUserId, 'deleted', {phone: editingUserId});
  closeEditUser();
  await loadUsers();
  showShopNotification('اکانت کامل حذف شد');
}

async function wipeDatabase(){
  if (currentPhone !== CREATOR_PHONE) { showShopNotification('فقط سازنده', 'error'); return; }
  if (!confirm('هشدار: همه اکانت‌ها به جز مقام‌دارها حذف می‌شوند؟')) return;
  var allUsers = await getAllUsers();
  var keep = {};
  var entries = Object.entries(allUsers);
  for (var i = 0; i < entries.length; i++) {
    var p = entries[i][0]; var u = entries[i][1];
    if (u.rank && u.rank !== 'کاربر') keep[p] = u;
    else { await redisDel('user:' + p); await redisDel('ban:' + p); }
  }
  await saveAllUsers(keep);
  await loadUsers();
  showShopNotification('دیتابیس پاک شد');
  sendSignal('global', 'db_wiped', {});
}

async function toggleServer(){
  if (currentPhone !== CREATOR_PHONE) { showShopNotification('فقط سازنده', 'error'); return; }
  var m = await getMaintenance();
  var isOn = m && m.on;
  var newState = !isOn;
  await setMaintenance(newState);
  setFBValue('server_state/on', newState);
  sendSignal('global', 'server_toggle', {on: newState});
  showShopNotification(newState ? 'سرور قطع شد' : 'سرور وصل شد');
  await updateServerToggleBtn();
}
async function updateServerToggleBtn(){
  var m = await getMaintenance();
  var btn = document.getElementById('btnServerToggle');
  if (!btn) return;
  if (m && m.on) { btn.textContent = 'وصل کردن سرور'; btn.className = 'edit-btn unban'; }
  else { btn.textContent = 'قطع سرور'; btn.className = 'edit-btn ban'; }
}

function confirmTournamentTime(){}
function confirmPrize(rank){}

async function saveAllTournamentConfig(){
  if (currentPhone !== CREATOR_PHONE) { showShopNotification('فقط سازنده', 'error'); return; }
  var duration = document.getElementById('tournamentDuration').value;
  var endTime = Date.now();
  if (duration === 'weekly') endTime += 7 * 24 * 60 * 60 * 1000;
  else if (duration === 'monthly') endTime += 30 * 24 * 60 * 60 * 1000;
  else if (duration === 'seasonal') endTime += 90 * 24 * 60 * 60 * 1000;
  var cfg = {
    duration: duration, endTime: endTime, distributed: false,
    rank1: {type: document.getElementById('prize1Type').value, value: parseInt(document.getElementById('prize1Value').value) || 0, customFile: document.getElementById('prize1File').dataset.file || null},
    rank2: {type: document.getElementById('prize2Type').value, value: parseInt(document.getElementById('prize2Value').value) || 0, customFile: document.getElementById('prize2File').dataset.file || null},
    rank3: {type: document.getElementById('prize3Type').value, value: parseInt(document.getElementById('prize3Value').value) || 0, customFile: document.getElementById('prize3File').dataset.file || null},
    rank4_10: {type: document.getElementById('prize4Type').value, value: parseInt(document.getElementById('prize4Value').value) || 0},
    blacklist: window.clanBlacklist || []
  };
  await saveTournamentConfigData(cfg);
  showShopNotification('تنظیمات مسابقات ذخیره شد');
  sendSignal('global', 'tournament_updated', {});
}
window.clanBlacklist = [];

async function loadTournamentConfig(){
  var cfg = await getTournamentConfig();
  if (cfg.duration) document.getElementById('tournamentDuration').value = cfg.duration;
  if (cfg.rank1) { document.getElementById('prize1Type').value = cfg.rank1.type; document.getElementById('prize1Value').value = cfg.rank1.value || ''; if (cfg.rank1.customFile) document.getElementById('prize1File').dataset.file = cfg.rank1.customFile; }
  if (cfg.rank2) { document.getElementById('prize2Type').value = cfg.rank2.type; document.getElementById('prize2Value').value = cfg.rank2.value || ''; if (cfg.rank2.customFile) document.getElementById('prize2File').dataset.file = cfg.rank2.customFile; }
  if (cfg.rank3) { document.getElementById('prize3Type').value = cfg.rank3.type; document.getElementById('prize3Value').value = cfg.rank3.value || ''; if (cfg.rank3.customFile) document.getElementById('prize3File').dataset.file = cfg.rank3.customFile; }
  if (cfg.rank4_10) { document.getElementById('prize4Type').value = cfg.rank4_10.type; document.getElementById('prize4Value').value = cfg.rank4_10.value || ''; }
  if (cfg.blacklist) { window.clanBlacklist = cfg.blacklist; renderBlacklist(); }
}
function renderBlacklist(){
  var container = document.getElementById('blacklistItems');
  if (!container) return;
  if (!window.clanBlacklist || window.clanBlacklist.length === 0) { container.innerHTML = '<div style="color:rgba(255,255,255,.5);font-size:11px;text-align:center;">لیست سیاه خالی است</div>'; return; }
  container.innerHTML = window.clanBlacklist.map(function(clan, idx){
    return '<div class="clan-blacklist-item"><span>' + clan + '</span><button onclick="removeClanFromBlacklist(' + idx + ')">حذف</button></div>';
  }).join('');
}
function addClanToBlacklist(){
  var clanName = prompt('نام یا تگ کلن را وارد کنید:');
  if (!clanName || !clanName.trim()) return;
  if (!window.clanBlacklist) window.clanBlacklist = [];
  if (window.clanBlacklist.includes(clanName.trim())) return;
  window.clanBlacklist.push(clanName.trim());
  renderBlacklist();
}
function removeClanFromBlacklist(idx){ window.clanBlacklist.splice(idx, 1); renderBlacklist(); }

async function loadUsers(){
  var allUsers = await getAllUsers();
  var list = document.getElementById('userList');
  if (!list) return;
  var users = Object.entries(allUsers);
  if (!users.length) { list.innerHTML = '<div style="text-align:center;color:rgba(255,255,255,.6);padding:20px;">کاربری یافت نشد</div>'; return; }
  list.innerHTML = users.map(function(e){
    var p = e[0]; var u = e[1];
    var rc = u.rank === 'سازنده' ? 'badge-creator' : ((u.rank === 'ادمین' || u.rank === 'ادمین ارشد') ? 'badge-admin' : '');
    var exBadge = u.exclusiveAvatar ? '<span class="user-badge" style="background:linear-gradient(180deg,#ffd700,#ff8c00);color:#000;">⭐</span>' : '';
    var validAv = getValidAvatar(u.avatar || 'Mafia2.png', p);
    var isBanned = u.banned ? 'badge-banned' : '';
    return '<div class="user-item" onclick="openEditUser(\'' + p + '\')"><div class="user-avatar"><img src="' + validAv + '" onerror="this.style.display=\'none\';" style="width:100%;height:100%;object-fit:cover;border-radius:50%;"></div><div class="user-info"><div class="user-name">' + (u.name || 'کاربر') + ' <small style="color:#aaa;">(' + p + ')</small></div><div class="user-details"><span>سکه: ' + toPersianNum(u.coins || 0) + '</span><span>الماس: ' + toPersianNum(u.gems || 0) + '</span><span>دولار: ' + toPersianNum(u.dollars || 0) + '</span><span class="user-badge ' + rc + '">' + (u.rank || 'کاربر') + '</span>' + exBadge + (isBanned ? '<span class="user-badge badge-banned">بن شده</span>' : '') + '</div></div></div>';
  }).join('');
}

function initAvatarShop(){
  if (!currentUserData) return;
  shopGold = currentUserData.coins || 0;
  shopGems = currentUserData.gems || 0;
  shopDollars = currentUserData.dollars || 0;
  if (!currentUserData.ownedAvatars) currentUserData.ownedAvatars = [];
  if (!currentUserData.ownedTemplates) currentUserData.ownedTemplates = [];
  var rank = currentUserData.rank || 'کاربر';
  var exclusiveList = [
    {src: '655.webm', allowedRanks: ['سازنده']},
    {src: '2000.webm', allowedRanks: ['پشتیبانی','گرداننده','ادمین ارشد','ناظر ارشد']},
    {src: '2003.webm', allowedRanks: ['پشتیبانی','گرداننده','ادمین ارشد','ناظر ارشد']},
    {src: '2001.webm', allowedRanks: ['ادمین','ناظر']},
    {src: '2002.webm', allowedRanks: ['ادمین','ناظر']}
  ];
  exclusiveList.forEach(function(ex){
    var isAllowed = ex.allowedRanks.includes(rank);
    var key = 'ex_' + ex.src;
    var avObj = avatars.find(function(a){ return a.src === ex.src; });
    if (isAllowed) {
      if (!currentUserData.ownedAvatars.includes(key)) currentUserData.ownedAvatars.push(key);
      if (avObj) avObj.owned = true;
    } else {
      currentUserData.ownedAvatars = currentUserData.ownedAvatars.filter(function(k){ return k !== key; });
      if (avObj) avObj.owned = false;
      if (currentUserData.avatar === ex.src) currentUserData.avatar = 'Mafia2.png';
    }
  });
  var owned = currentUserData.ownedAvatars || [];
  avatars.forEach(function(a){
    if (a.free) a.owned = true;
    else if (owned.includes('ex_' + a.src) || owned.includes(a.src)) a.owned = true;
    else a.owned = false;
  });
  currentUserData.avatar = getValidAvatar(currentUserData.avatar || 'Mafia2.png', currentPhone);
  templates.forEach(function(t){ t.owned = (currentUserData.ownedTemplates || []).includes(t.src); });
}

function renderAvatars(){
  var grid = document.getElementById('avatarGrid');
  if (!grid) return;
  var disp;
  if (currentAvatarSection === 'my') {
    disp = avatars.filter(function(a){ return a.owned; });
    if (currentPhone !== CREATOR_PHONE) disp = disp.filter(function(a){ return a.src !== '655.webm'; });
  } else {
    disp = avatars.filter(function(a){ return !a.owned && !a.exclusive && !a.isMyExclusive; });
  }
  if (!disp.length) { grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:rgba(255,255,255,.6);">آواتاری موجود نیست</div>'; return; }
  var currentAvatarSrc = currentUserData ? currentUserData.avatar : '';
  var currentTemplateSrc = currentUserData ? currentUserData.currentTemplate : null;
  grid.innerHTML = disp.map(function(a){
    var isVid = a.src.endsWith('.webm') || a.src.endsWith('.mp4') || a.src.endsWith('.mov');
    var isCurrent = (currentAvatarSrc === a.src);
    var cardClass = 'avatar-card ' + (a.owned ? 'owned ' : '') + (a.isMyExclusive ? 'exclusive ' : '') + (isCurrent ? 'is-selected' : '');
    var mediaHtml;
    if (currentAvatarSection === 'my' && currentTemplateSrc && a.owned) {
      var innerMedia = isVid ? ('<video src="' + a.src + '" autoplay loop muted playsinline webkit-playsinline preload="metadata"></video>') : ('<img src="' + a.src + '" loading="lazy" onerror="avatarLoadError(this,\'' + a.src + '\')">');
      mediaHtml = '<div class="template-preview"><div class="preview-avatar">' + innerMedia + '</div><img class="preview-frame" src="' + currentTemplateSrc + '" onerror="this.style.display=\'none\'"></div>';
    } else {
      mediaHtml = isVid ? ('<video src="' + a.src + '" autoplay loop muted playsinline webkit-playsinline preload="metadata" onerror="avatarLoadError(this,\'' + a.src + '\')"></video>') : ('<img src="' + a.src + '" loading="lazy" onerror="avatarLoadError(this,\'' + a.src + '\')">');
    }
    var confirmBtn = '';
    if (currentAvatarSection === 'my' && a.owned) { confirmBtn = '<button class="cbtn cbtn-mini avatar-confirm-btn" data-src="' + a.src + '" data-id="' + a.id + '">تایید</button>'; }
    var priceHtml = '';
    if (!a.owned) { priceHtml = '<div class="avatar-price"><img src="Jam99.webp" alt="جم"><span class="price-value">' + toPersianNum(a.price) + '</span></div>'; }
    else { priceHtml = '<div style="color:' + (isCurrent ? '#f1c40f' : '#4CAF50') + ';font-weight:900;font-size:11px;margin-top:5px;">' + (isCurrent ? 'آواتار فعلی' : 'دارید') + '</div>'; }
    return '<div class="' + cardClass + '" data-id="' + a.id + '"><div class="avatar-image">' + mediaHtml + '</div>' + priceHtml + confirmBtn + '</div>';
  }).join('');
  grid.querySelectorAll('.avatar-card').forEach(function(c){
    c.addEventListener('click', function(e){
      if (e.target.closest('.avatar-confirm-btn')) return;
      var id = parseInt(c.dataset.id);
      var av = avatars.find(function(x){ return x.id === id; });
      if (!av) return;
      if (currentAvatarSection === 'buy' && !av.owned) handleAvatarClick(id);
    });
  });
  grid.querySelectorAll('.avatar-confirm-btn').forEach(function(btn){
    btn.addEventListener('click', function(e){
      e.stopPropagation();
      playClickSound();
      var src = btn.dataset.src;
      if (!src) return;
      currentUserData.avatar = src;
      localAvatarLock = Date.now();
      updateGlobalAvatar(src);
      renderAvatars();
      saveAvatarToStorage(src);
    });
  });
  observeVideos(grid);
}

function renderTemplates(){
  var grid = document.getElementById('templateGrid');
  if (!grid) return;
  var disp;
  if (currentTemplateSection === 'my') { disp = templates.filter(function(t){ return t.owned; }); }
  else { disp = templates.filter(function(t){ return !t.owned; }); }
  if (!disp.length) { grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:rgba(255,255,255,.6);">قالبی موجود نیست</div>'; return; }
  var currentT = currentUserData ? currentUserData.currentTemplate : null;
  var avatarSrc = getValidAvatar((currentUserData && currentUserData.avatar) || 'Mafia2.png', currentPhone);
  var isVid = avatarSrc.endsWith('.webm') || avatarSrc.endsWith('.mp4');
  var avatarPreviewHtml = isVid ? ('<video src="' + avatarSrc + '" autoplay loop muted playsinline webkit-playsinline style="width:100%;height:100%;object-fit:cover;"></video>') : ('<img src="' + avatarSrc + '" onerror="this.src=\'Mafia2.png\'">');
  grid.innerHTML = disp.map(function(t){
    var isCurrent = (currentT === t.src);
    var cardClass = 'template-card ' + (t.owned ? 'owned ' : '') + (isCurrent ? 'is-selected' : '');
    var confirmBtn = '';
    if (currentTemplateSection === 'my' && t.owned) { confirmBtn = '<button class="cbtn cbtn-mini template-confirm-btn" data-src="' + t.src + '">تایید</button>'; }
    var priceHtml = '';
    if (!t.owned) { priceHtml = '<div class="template-price"><img src="Jam99.webp" alt="جم"><span class="price-value">' + toPersianNum(t.price) + '</span></div>'; }
    else { priceHtml = '<div class="' + (isCurrent ? 'template-current-label' : 'template-owned-label') + '">' + (isCurrent ? 'قالب فعلی' : 'دارید') + '</div>'; }
    return '<div class="' + cardClass + '" data-src="' + t.src + '"><div class="template-preview-box"><div class="tp-avatar">' + avatarPreviewHtml + '</div><img class="tp-frame" src="' + t.src + '" onerror="this.style.display=\'none\'"></div><div class="template-name">' + t.name + '</div>' + priceHtml + confirmBtn + '</div>';
  }).join('');
  grid.querySelectorAll('.template-card').forEach(function(c){
    c.addEventListener('click', function(e){
      if (e.target.closest('.template-confirm-btn')) return;
      if (currentTemplateSection !== 'buy') return;
      var src = c.dataset.src;
      var t = templates.find(function(x){ return x.src === src; });
      if (!t || t.owned) return;
      handleTemplateClick(t);
    });
  });
  grid.querySelectorAll('.template-confirm-btn').forEach(function(btn){
    btn.addEventListener('click', function(e){
      e.stopPropagation();
      playClickSound();
      var src = btn.dataset.src;
      if (!src) return;
      currentUserData.currentTemplate = src;
      localTemplateLock = Date.now();
      updateGlobalAvatar(currentUserData.avatar || 'Mafia2.png');
      renderTemplates();
      saveTemplateToStorage(src);
    });
  });
}

function handleTemplateClick(t){
  selectedTemplate = t;
  templatePurchasePrice = t.price;
  purchaseMode = 'template';
  document.getElementById('modalTitle').textContent = 'خرید قالب';
  document.getElementById('modalText').textContent = 'آیا از خرید قالب «' + t.name + '» به قیمت ' + toPersianNum(t.price) + ' الماس اطمینان دارید؟';
  document.getElementById('purchaseModal').classList.add('show');
}

function handleAvatarClick(id){
  var a = avatars.find(function(x){ return x.id === id; });
  if (!a) return;
  if (currentAvatarSection === 'buy' && !a.owned) {
    selectedAvatar = a; purchasePrice = a.price; purchaseMode = 'avatar';
    document.getElementById('modalTitle').textContent = 'خرید آواتار';
    document.getElementById('modalText').textContent = 'آیا از خرید این آواتار به قیمت ' + toPersianNum(purchasePrice) + ' الماس اطمینان دارید؟';
    document.getElementById('purchaseModal').classList.add('show');
  } else if (a.owned) {
    updateGlobalAvatar(a.src);
    saveAvatarToStorage(a.src);
  }
}

async function confirmPurchase(){
  playClickSound();
  try {
    var freshUser = await getUser(currentPhone);
    if (freshUser && freshUser.coins !== undefined) {
      currentUserData.coins = freshUser.coins;
      currentUserData.gems = freshUser.gems;
      currentUserData.dollars = freshUser.dollars;
      shopGems = freshUser.gems; shopGold = freshUser.coins; shopDollars = freshUser.dollars;
    }
  } catch(e) {}
  if (purchaseMode === 'template' && selectedTemplate) {
    if (shopGems < templatePurchasePrice) { document.getElementById('purchaseModal').classList.remove('show'); showShopNotification('الماس کافی ندارید!', 'error'); return; }
    shopGems -= templatePurchasePrice;
    if (!currentUserData.ownedTemplates) currentUserData.ownedTemplates = [];
    if (!currentUserData.ownedTemplates.includes(selectedTemplate.src)) { currentUserData.ownedTemplates.push(selectedTemplate.src); }
    currentUserData.gems = shopGems < 0 ? 0 : shopGems;
    selectedTemplate.owned = true;
    currentUserData.currentTemplate = selectedTemplate.src;
    localTemplateLock = Date.now();
    currentUserData.lastUpdatedAt = Date.now();
    updateUIWithData(currentUserData);
    updateGlobalAvatar(currentUserData.avatar || 'Mafia2.png');
    renderTemplates();
    document.getElementById('purchaseModal').classList.remove('show');
    selectedTemplate = null; templatePurchasePrice = 0;
    await saveUser(currentPhone, currentUserData);
    var allU = await getAllUsers(); allU[currentPhone] = currentUserData; await saveAllUsers(allU);
    sendSignal('user_' + currentPhone, 'purchased', {phone: currentPhone});
    return;
  }
  if (purchaseMode === 'avatar' && selectedAvatar) {
    if (shopGems >= purchasePrice) {
      shopGems -= purchasePrice;
      selectedAvatar.owned = true;
      if (!currentUserData.ownedAvatars) currentUserData.ownedAvatars = [];
      if (!currentUserData.ownedAvatars.includes(selectedAvatar.src)) { currentUserData.ownedAvatars.push(selectedAvatar.src); }
      currentUserData.gems = shopGems < 0 ? 0 : shopGems;
      currentUserData.avatar = selectedAvatar.src;
      localAvatarLock = Date.now();
      currentUserData.lastUpdatedAt = Date.now();
      updateUIWithData(currentUserData);
      updateGlobalAvatar(selectedAvatar.src);
      renderAvatars();
      document.getElementById('purchaseModal').classList.remove('show');
      selectedAvatar = null; purchasePrice = 0;
      await saveUser(currentPhone, currentUserData);
      var allU2 = await getAllUsers(); allU2[currentPhone] = currentUserData; await saveAllUsers(allU2);
      sendSignal('user_' + currentPhone, 'purchased', {phone: currentPhone});
    } else {
      document.getElementById('purchaseModal').classList.remove('show');
      showShopNotification('الماس کافی ندارید!', 'error');
    }
  }
}

function startCompetitiveSearch(){ document.getElementById('competitiveOverlay').classList.add('active'); }
function enterCompetitiveGame(){ window.location.href = 'Safe Game.html'; }
function cancelCompetitiveSearch(){ if (confirm('از جستجو خارج می‌شوید؟')) { document.getElementById('competitiveOverlay').classList.remove('active'); document.getElementById('gameStartedOverlay').classList.remove('show'); } }

async function checkWhitelistNow(){
  try {
    myIP = await fetchUserIP(); if (!myIP) return false;
    currentDeviceId = getDeviceId();
    var isWhite = await isIPWhitelisted(myIP, currentDeviceId);
    if (isWhite) {
      document.getElementById('serverDownOverlay').classList.remove('show');
      document.getElementById('deviceBanOverlay').classList.remove('show');
      return true;
    }
    return false;
  } catch(e) { return false; }
}

async function checkBanPeriodically(){
  if (!currentPhone || isRedirecting) return;
  if (currentPhone === CREATOR_PHONE) return;
  if (pauseSync) return;
  var am = document.getElementById('adminModal'); if (am && am.classList.contains('active')) return;
  var eu = document.getElementById('editUserModal'); if (eu && eu.classList.contains('active')) return;
  if (fbReady && fbDb) {
    try {
      var snap = await fbDb.ref('server_state/on').once('value');
      if (snap.val() === true) { lockServerForeverInGame(); return; }
    } catch(e) {}
  }
  var isWhite = await checkWhitelistNow(); if (isWhite) return;
  var b = await getBanStatus(currentPhone); if (b) { redirectToBan(b, currentPhone); return; }
  var deviceId = getDeviceId();
  var db2 = await getDeviceBan(deviceId);
  if (db2 && db2.isBanned) {
    if (!db2.expiresAt || new Date(db2.expiresAt).getTime() > Date.now()) { document.getElementById('deviceBanOverlay').classList.add('show'); }
  }
}

function playClickSound(){
  try {
    var clickSound = document.getElementById('clickSound');
    if (clickSound) { clickSound.currentTime = 0; clickSound.play().catch(function(e){}); }
  } catch(e) {}
}

async function checkAndDistributeTournamentPrizes(){
  try {
    var cfg = await getTournamentConfig();
    if (!cfg || !cfg.endTime || cfg.distributed) return;
    if (Date.now() < cfg.endTime) return;
    var freshCfg = await getTournamentConfig();
    if (freshCfg.distributed) return;
    var allUsers = await getAllUsers();
    var groups = await getGroups();
    var clansWithStats = groups.map(function(group){
      var totalPoints = parseInt(group.extraPoints) || 0;
      (group.members || []).forEach(function(mid){
        var u = allUsers[mid];
        if (u) totalPoints += ((parseInt(u.cups) || 0) * 2) + ((parseInt(u.hours) || 0) * 20);
      });
      return {group: group, points: totalPoints};
    });
    clansWithStats.sort(function(a, b){ return b.points - a.points; });
    var topClans = clansWithStats.slice(0, 10);
    var now = Date.now();
    for (var i = 0; i < topClans.length; i++) {
      var rank = i + 1; var clan = topClans[i].group;
      var prizeConfig = null;
      if (rank === 1) prizeConfig = cfg.rank1;
      else if (rank === 2) prizeConfig = cfg.rank2;
      else if (rank === 3) prizeConfig = cfg.rank3;
      else if (rank >= 4 && rank <= 10) prizeConfig = cfg.rank4_10;
      if (prizeConfig && prizeConfig.value > 0 && clan.members) {
        for (var j = 0; j < clan.members.length; j++) {
          var memberPhone = clan.members[j];
          var user = allUsers[memberPhone]; if (!user) continue;
          if (prizeConfig.type === 'coin') user.coins = (user.coins || 0) + parseInt(prizeConfig.value);
          else if (prizeConfig.type === 'gem') user.gems = (user.gems || 0) + parseInt(prizeConfig.value);
          user.lastUpdatedAt = now;
          allUsers[memberPhone] = user;
        }
      }
    }
    await saveAllUsers(allUsers);
    var finalCfg = await getTournamentConfig();
    if (!finalCfg.distributed) { finalCfg.distributed = true; await saveTournamentConfigData(finalCfg); }
  } catch(e) {}
}

async function syncWithServerInBackground(){
  try {
    if (pauseSync) return;
    var am = document.getElementById('adminModal'); if (am && am.classList.contains('active')) return;
    var eu = document.getElementById('editUserModal'); if (eu && eu.classList.contains('active')) return;
    var pm = document.getElementById('purchaseModal'); if (pm && pm.classList.contains('show')) return;
    myIP = await fetchUserIP(); if (!myIP) return;
    currentDeviceId = getDeviceId();
    if (currentPhone === CREATOR_PHONE) {
      document.getElementById('serverDownOverlay').classList.remove('show');
      document.getElementById('deviceBanOverlay').classList.remove('show');
      var serverUser = await getUser(currentPhone); if (!serverUser) return;
      if (!serverUser.userCode || isNaN(parseInt(serverUser.userCode)) || parseInt(serverUser.userCode) <= 0) { serverUser = await assignCodeIfMissing(currentPhone, serverUser); }
      var serverTime = serverUser.lastUpdatedAt || 0;
      var localTime = currentUserData.lastUpdatedAt || 0;
      if (serverTime > localTime) { currentUserData = sanitizeUserData(Object.assign({}, currentUserData, serverUser), currentPhone); }
      else { currentUserData = sanitizeUserData(Object.assign({}, serverUser, {coins: currentUserData.coins, gems: currentUserData.gems, dollars: currentUserData.dollars, avatar: currentUserData.avatar, previousAvatar: currentUserData.previousAvatar, ownedAvatars: currentUserData.ownedAvatars, currentTemplate: currentUserData.currentTemplate, ownedTemplates: currentUserData.ownedTemplates, lastUpdatedAt: currentUserData.lastUpdatedAt}), currentPhone); }
      currentUserData.lastIP = myIP; currentUserData.lastDevice = currentDeviceId;
      localStorage.setItem('user_cache_' + currentPhone, JSON.stringify(currentUserData));
      updateUIWithData(currentUserData);
      updateServerToggleBtn();
      return;
    }
    var isWhitelisted = await isIPWhitelisted(myIP, currentDeviceId);
    var hasPanelAccess = getPerm().panel;
    if (isWhitelisted) {
      document.getElementById('serverDownOverlay').classList.remove('show');
      document.getElementById('deviceBanOverlay').classList.remove('show');
    } else {
      var m = await getMaintenance();
      if (m && m.on && !hasPanelAccess) { document.getElementById('serverDownOverlay').classList.add('show'); return; }
      document.getElementById('serverDownOverlay').classList.remove('show');
      var ban = await getBanStatus(currentPhone); if (ban) { redirectToBan(ban, currentPhone); return; }
      var db = await getDeviceBan(currentDeviceId);
      if (db && db.isBanned) { if (!db.expiresAt || new Date(db.expiresAt).getTime() > Date.now()) { document.getElementById('deviceBanOverlay').classList.add('show'); return; } }
    }
    await checkAndDistributeTournamentPrizes();
    var serverUser = await getUser(currentPhone);
    if (!serverUser) {
      var localCache = localStorage.getItem('user_cache_' + currentPhone);
      if (localCache) { try { serverUser = JSON.parse(localCache); await saveUser(currentPhone, serverUser); } catch(e) { window.location.href = 'index.html'; return; } }
      else { window.location.href = 'index.html'; return; }
    }
    if (!serverUser.userCode || isNaN(parseInt(serverUser.userCode)) || parseInt(serverUser.userCode) <= 0) { serverUser = await assignCodeIfMissing(currentPhone, serverUser); }
    var serverTime2 = serverUser.lastUpdatedAt || 0;
    var localTime2 = currentUserData.lastUpdatedAt || 0;
    if (serverTime2 > localTime2) { currentUserData = sanitizeUserData(Object.assign({}, currentUserData, serverUser), currentPhone); }
    else { currentUserData = sanitizeUserData(Object.assign({}, serverUser, {coins: currentUserData.coins, gems: currentUserData.gems, dollars: currentUserData.dollars, avatar: currentUserData.avatar, previousAvatar: currentUserData.previousAvatar, ownedAvatars: currentUserData.ownedAvatars, currentTemplate: currentUserData.currentTemplate, ownedTemplates: currentUserData.ownedTemplates, lastUpdatedAt: currentUserData.lastUpdatedAt}), currentPhone); }
    currentUserData.lastIP = myIP; currentUserData.lastDevice = currentDeviceId;
    localStorage.setItem('user_cache_' + currentPhone, JSON.stringify(currentUserData));
    updateUIWithData(currentUserData);
    updateServerToggleBtn();
  } catch(error) {}
}

function setupLiveSubscriptions(){
  if (!fbReady || !fbDb) return;
  if (_liveSubsReady) return;
  _liveSubsReady = true;
  _liveSubscriptions.push(subscribeSignal('global', async function(sig){
    if (sig.type === 'news_updated') { await loadNews(); showShopNotification('📢 اطلاعیه جدید'); }
    else if (sig.type === 'server_toggle') { await syncWithServerInBackground(); }
    else if (sig.type === 'codes_reset') {
      var fresh = await getUser(currentPhone);
      if (fresh) { currentUserData.userCode = fresh.userCode; localStorage.setItem('user_cache_' + currentPhone, JSON.stringify(currentUserData)); updateUIWithData(currentUserData); }
    }
    else if (sig.type === 'db_wiped') {
      var still = await getUser(currentPhone);
      if (!still) { localStorage.removeItem('currentLoggedInUser'); window.location.href = 'index.html'; }
    }
    else if (sig.type === 'tournament_updated') { loadTournamentConfig(); }
  }));
  _liveSubscriptions.push(subscribeSignal('user_' + currentPhone, async function(sig){
    var fresh = await getUser(currentPhone);
    if (!fresh) { localStorage.removeItem('currentLoggedInUser'); window.location.href = 'index.html'; return; }
    if (sig.type === 'banned') {
      if (currentPhone === CREATOR_PHONE) return;
      var ban = await getBanStatus(currentPhone);
      if (ban) redirectToBan(ban, currentPhone);
      return;
    }
    if (sig.type === 'force_logout') {
      if (currentPhone === CREATOR_PHONE) return;
      localStorage.removeItem('currentLoggedInUser');
      window.location.href = 'index.html';
      return;
    }
    if (sig.type === 'force_login') return;
    if (sig.type === 'deleted') {
      if (currentPhone === CREATOR_PHONE) return;
      localStorage.removeItem('currentLoggedInUser');
      window.location.href = 'index.html';
      return;
    }
    if (fresh.lastUpdatedAt > (currentUserData.lastUpdatedAt || 0)) {
      currentUserData = sanitizeUserData(Object.assign({}, currentUserData, fresh), currentPhone);
      localStorage.setItem('user_cache_' + currentPhone, JSON.stringify(currentUserData));
      updateUIWithData(currentUserData);
    }
  }));
  console.log('✅ Live subscriptions active');
}

document.addEventListener('DOMContentLoaded', async function(){
  var loggedIn = localStorage.getItem('currentLoggedInUser');
  if (!loggedIn) { window.location.href = 'index.html'; return; }
  var phone = null;
  try { phone = JSON.parse(loggedIn).phone; } catch(e) { window.location.href = 'index.html'; return; }
  currentPhone = phone;

  initFB(currentPhone);

  await checkWhitelistNow();

  try {
    var u = await getUser(currentPhone);
    if (u && (!u.userCode || isNaN(parseInt(u.userCode)) || parseInt(u.userCode) <= 0)) { await assignCodeIfMissing(currentPhone, u); }
  } catch(e) {}

  var localCache = localStorage.getItem('user_cache_' + currentPhone);
  var localUser = null;
  try { localUser = localCache ? JSON.parse(localCache) : null; } catch(e) { localUser = null; }
  if (!localUser) {
    localUser = {name: 'کاربر', coins: 0, gems: 0, dollars: 0, avatar: 'Mafia2.png', rank: 'کاربر', userCode: '----', level: 1, score: 0, cups: 0, hours: 0, xp: 0, compWins: 0, friendWins: 0, monitorCount: 0, bestScore: 0, mafiaWins: 0, citizenWins: 0, ownedTemplates: [], currentTemplate: null, lastUpdatedAt: 0};
  }
  if (!localUser.ownedTemplates) localUser.ownedTemplates = [];
  if (!localUser.currentTemplate) localUser.currentTemplate = null;
  if (!localUser.lastUpdatedAt) localUser.lastUpdatedAt = 0;
  currentUserData = localUser;
  updateUIWithData(currentUserData);
  initAvatarShop();

  setTimeout(function(){
    syncWithServerInBackground();
    setUserOnlineStatus(true);
    setupLiveSubscriptions();
  }, 0);

  setInterval(syncWithServerInBackground, 3000);
  setInterval(function(){ setUserOnlineStatus(!document.hidden); }, 30000);
  setInterval(checkBanPeriodically, 5000);
  setInterval(async function(){ if (isRedirecting) return; await checkWhitelistNow(); }, 2000);
  setInterval(updateGroupDisplay, 30000);

  var menuBtn = document.getElementById('menuBtn');
  if (menuBtn) menuBtn.addEventListener('click', function(e){
    e.stopPropagation();
    playClickSound();
    var d = document.getElementById('menuDropdown');
    if (d.classList.contains('active')) { closeModal('menuDropdown'); }
    else { document.getElementById('menuOverlay').classList.add('active'); d.classList.add('active'); }
  });
  var menuOverlay = document.getElementById('menuOverlay');
  if (menuOverlay) menuOverlay.addEventListener('click', function(){
    menuOverlay.classList.remove('active');
    document.getElementById('menuDropdown').classList.remove('active');
  });
  var menuContact = document.getElementById('menuContact');
  if (menuContact) menuContact.addEventListener('click', function(){ playClickSound(); closeModal('menuDropdown'); window.location.href = 'https://Mfasun.ir'; });
  var menuSettings = document.getElementById('menuSettings');
  if (menuSettings) menuSettings.addEventListener('click', function(){ playClickSound(); closeModal('menuDropdown'); document.getElementById('settingsModal').classList.add('active'); });
  var menuLogout = document.getElementById('menuLogout');
  if (menuLogout) menuLogout.addEventListener('click', function(){
    playClickSound(); closeModal('menuDropdown');
    if (confirm('از اکانت خارج می‌شوید؟')) { setUserOnlineStatus(false); localStorage.removeItem('currentLoggedInUser'); window.location.href = 'index.html'; }
  });
  var openProfile = document.getElementById('openProfile');
  if (openProfile) openProfile.addEventListener('click', function(){ playClickSound(); document.getElementById('profilePage').classList.add('active'); updateGroupDisplay(); });
  var backBtn = document.getElementById('backBtn');
  if (backBtn) backBtn.addEventListener('click', function(){ playClickSound(); document.getElementById('profilePage').classList.remove('active'); });
  var copyUserCode = document.getElementById('copyUserCode');
  if (copyUserCode) copyUserCode.addEventListener('click', function(){ playClickSound(); copyToClipboard(document.getElementById('userCode').textContent, 'کد کاربری کپی شد!'); });
  var openAvatarShop = document.getElementById('openAvatarShop');
  if (openAvatarShop) openAvatarShop.addEventListener('click', function(){ playClickSound(); document.getElementById('profilePage').classList.remove('active'); document.getElementById('avatarShopPage').classList.add('active'); renderAvatars(); });
  var shopBackBtn = document.getElementById('shopBackBtn');
  if (shopBackBtn) shopBackBtn.addEventListener('click', function(){ playClickSound(); document.getElementById('avatarShopPage').classList.remove('active'); document.getElementById('profilePage').classList.add('active'); });
  var templateBackBtn = document.getElementById('templateBackBtn');
  if (templateBackBtn) templateBackBtn.addEventListener('click', function(){ playClickSound(); document.getElementById('templateShopPage').classList.remove('active'); document.getElementById('profilePage').classList.add('active'); });
  var editNameBtn = document.getElementById('editNameBtn');
  if (editNameBtn) editNameBtn.addEventListener('click', changeUsername);

  document.querySelectorAll('.shop-tab').forEach(function(t){
    t.addEventListener('click', function(){
      playClickSound();
      var tab = this.dataset.shoptab;
      document.querySelectorAll('.shop-tab').forEach(function(x){ x.classList.remove('active'); });
      document.querySelectorAll('.shop-tab[data-shoptab="' + tab + '"]').forEach(function(x){ x.classList.add('active'); });
      if (tab === 'templates') { document.getElementById('avatarShopPage').classList.remove('active'); document.getElementById('templateShopPage').classList.add('active'); renderTemplates(); }
      else if (tab === 'avatars') { document.getElementById('templateShopPage').classList.remove('active'); document.getElementById('avatarShopPage').classList.add('active'); renderAvatars(); }
      else if (tab === '3d') { showShopNotification('آواتار 3D به زودی اضافه می‌شود'); }
    });
  });

  var navShop = document.getElementById('navShop');
  if (navShop) navShop.addEventListener('click', function(){ playClickSound(); window.location.href = 'Safe Foroshgahe.html'; });
  var navGroup = document.getElementById('navGroup');
  if (navGroup) navGroup.addEventListener('click', function(){ playClickSound(); window.location.href = 'Safe Goroh.html'; });
  var btnAnnouncements = document.getElementById('btnAnnouncements');
  if (btnAnnouncements) btnAnnouncements.addEventListener('click', async function(){ playClickSound(); await loadNews(); document.getElementById('newsModal').classList.add('active'); });
  var btnHelp = document.getElementById('btnHelp');
  if (btnHelp) btnHelp.addEventListener('click', function(){ playClickSound(); window.location.href = 'Amozesh.html'; });
  var btnTopPlayers = document.getElementById('btnTopPlayers');
  if (btnTopPlayers) btnTopPlayers.addEventListener('click', function(){ playClickSound(); window.location.href = 'Bandi.html'; });
  var btnManagement = document.getElementById('btnManagement');
  if (btnManagement) btnManagement.addEventListener('click', function(){ playClickSound(); window.location.href = 'Modir.html'; });
  var btnLive = document.getElementById('btnLive');
  if (btnLive) btnLive.addEventListener('click', function(){ playClickSound(); showShopNotification('پخش زنده به زودی'); });

  var resetCodesBtn = document.getElementById('btnResetCodes');
  if (resetCodesBtn) resetCodesBtn.addEventListener('click', resetAllUserCodes);

  var btnAdmin = document.getElementById('btnAdmin');
  if (btnAdmin) btnAdmin.addEventListener('click', async function(){
    playClickSound();
    var p = getPerm();
    if (!p.panel) { showShopNotification('دسترسی ندارید', 'error'); return; }
    pauseSync = true;
    try {
      await loadUsers();
      await updateServerToggleBtn();
      if (currentPhone === CREATOR_PHONE) { await loadTournamentConfig(); renderBlacklist(); }
      document.getElementById('usersSection').style.display = 'none';
      document.getElementById('userHistorySection').style.display = 'none';
      document.getElementById('userControlSection').style.display = 'none';
      document.getElementById('whitelistSection').style.display = 'none';
      document.getElementById('adminModal').classList.add('active');
    } catch(e) { pauseSync = false; }
  });

  var sendNewsBtn = document.getElementById('sendNewsBtn');
  if (sendNewsBtn) sendNewsBtn.addEventListener('click', sendNews);
  var btnBanUser = document.getElementById('btnBanUser');
  if (btnBanUser) btnBanUser.addEventListener('click', function(){ banUser('account'); });
  var btnBanDevice = document.getElementById('btnBanDevice');
  if (btnBanDevice) btnBanDevice.addEventListener('click', function(){ banUser('device'); });
  var btnBanIP = document.getElementById('btnBanIP');
  if (btnBanIP) btnBanIP.addEventListener('click', function(){ banUser('ip'); });
  var btnUnbanUser = document.getElementById('btnUnbanUser');
  if (btnUnbanUser) btnUnbanUser.addEventListener('click', unbanUser);
  var btnDeleteAccount = document.getElementById('btnDeleteAccount');
  if (btnDeleteAccount) btnDeleteAccount.addEventListener('click', deleteAccount);
  var btnWipeDB = document.getElementById('btnWipeDB');
  if (btnWipeDB) btnWipeDB.addEventListener('click', wipeDatabase);
  var btnServerToggle = document.getElementById('btnServerToggle');
  if (btnServerToggle) btnServerToggle.addEventListener('click', toggleServer);
  var btnFriendly = document.getElementById('btnFriendly');
  if (btnFriendly) btnFriendly.addEventListener('click', function(){ playClickSound(); window.location.href = 'TalarDs.html'; });
  var btnCompetitive = document.getElementById('btnCompetitive');
  if (btnCompetitive) btnCompetitive.addEventListener('click', function(){ playClickSound(); startCompetitiveSearch(); });
  var cancelSearchBtn = document.getElementById('cancelSearchBtn');
  if (cancelSearchBtn) cancelSearchBtn.addEventListener('click', cancelCompetitiveSearch);
  var enterGameBtn = document.getElementById('enterGameBtn');
  if (enterGameBtn) enterGameBtn.addEventListener('click', enterCompetitiveGame);

  document.querySelectorAll('.avatar-section-tab').forEach(function(t){
    t.addEventListener('click', function(){
      playClickSound();
      currentAvatarSection = this.dataset.section;
      document.querySelectorAll('.avatar-section-tab').forEach(function(x){ x.classList.remove('active'); });
      this.classList.add('active');
      renderAvatars();
    });
  });
  document.querySelectorAll('.template-tab').forEach(function(t){
    t.addEventListener('click', function(){
      playClickSound();
      currentTemplateSection = this.dataset.tsection;
      document.querySelectorAll('.template-tab').forEach(function(x){ x.classList.remove('active'); });
      this.classList.add('active');
      renderTemplates();
    });
  });

  var modalCancelBtn = document.getElementById('modalCancelBtn');
  if (modalCancelBtn) modalCancelBtn.addEventListener('click', function(){
    playClickSound();
    document.getElementById('purchaseModal').classList.remove('show');
    selectedAvatar = null; purchasePrice = 0; selectedTemplate = null; templatePurchasePrice = 0; purchaseMode = 'avatar';
  });
  var modalConfirmBtn = document.getElementById('modalConfirmBtn');
  if (modalConfirmBtn) modalConfirmBtn.addEventListener('click', confirmPurchase);

  var openChangePasswordBtn = document.getElementById('openChangePasswordBtn');
  if (openChangePasswordBtn) openChangePasswordBtn.addEventListener('click', function(){
    playClickSound(); closeModal('settingsModal');
    document.getElementById('cpPhone').value = currentPhone || '';
    document.getElementById('changePasswordModal').classList.add('active');
  });
  var submitPasswordChange = document.getElementById('submitPasswordChange');
  if (submitPasswordChange) submitPasswordChange.addEventListener('click', async function(){
    playClickSound();
    var phone = document.getElementById('cpPhone').value.trim();
    var currentPass = document.getElementById('cpCurrentPass').value;
    var newPass = document.getElementById('cpNewPass').value;
    if (!phone || !currentPass || !newPass) { showShopNotification('لطفاً تمام فیلدها را پر کنید', 'error'); return; }
    if (phone !== currentPhone) { showShopNotification('شماره موبایل با اکانت فعلی مطابقت ندارد', 'error'); return; }
    if (currentUserData.password && currentUserData.password !== currentPass) { showShopNotification('رمز عبور فعلی اشتباه است', 'error'); return; }
    if (newPass.length < 4) { showShopNotification('رمز عبور جدید حداقل ۴ کاراکتر', 'error'); return; }
    currentUserData.password = newPass;
    await saveUserData();
    closeModal('changePasswordModal');
    document.getElementById('cpCurrentPass').value = '';
    document.getElementById('cpNewPass').value = '';
  });

  var btnWhitelistIP = document.getElementById('btnWhitelistIP');
  if (btnWhitelistIP) btnWhitelistIP.addEventListener('click', function(){
    document.getElementById('whitelistSection').style.display = 'block';
    document.getElementById('usersSection').style.display = 'none';
    document.getElementById('userHistorySection').style.display = 'none';
    document.getElementById('userControlSection').style.display = 'none';
    refreshWhitelistUI();
  });
  var btnAddWhitelistIP = document.getElementById('btnAddWhitelistIP');
  if (btnAddWhitelistIP) btnAddWhitelistIP.addEventListener('click', addWhitelistIP);
  var btnShowUsersList = document.getElementById('btnShowUsersList');
  if (btnShowUsersList) btnShowUsersList.addEventListener('click', async function(){
    document.getElementById('usersSection').style.display = 'block';
    document.getElementById('userList').style.display = 'none';
    document.getElementById('userHistorySection').style.display = 'none';
    document.getElementById('userControlSection').style.display = 'none';
    document.getElementById('whitelistSection').style.display = 'none';
    await loadAdminUsers();
  });
  var btnUserControl = document.getElementById('btnUserControl');
  if (btnUserControl) btnUserControl.addEventListener('click', function(){
    document.getElementById('userControlSection').style.display = 'block';
    document.getElementById('usersSection').style.display = 'none';
    document.getElementById('userHistorySection').style.display = 'none';
    document.getElementById('whitelistSection').style.display = 'none';
  });
  var btnForceLogin = document.getElementById('btnForceLogin');
  if (btnForceLogin) btnForceLogin.addEventListener('click', forceUserLogin);
  var btnForceLogout = document.getElementById('btnForceLogout');
  if (btnForceLogout) btnForceLogout.addEventListener('click', forceUserLogout);
  var btnClearUserData = document.getElementById('btnClearUserData');
  if (btnClearUserData) btnClearUserData.addEventListener('click', clearUserData);
  var btnClearSessions = document.getElementById('btnClearSessions');
  if (btnClearSessions) btnClearSessions.addEventListener('click', clearUserSessionsFromPanel);

  document.querySelectorAll('.admin-tab').forEach(function(tab){
    tab.addEventListener('click', function(){
      document.querySelectorAll('.admin-tab').forEach(function(t){ t.classList.remove('active'); });
      this.classList.add('active');
      currentAdminTab = this.dataset.tab;
      loadAdminUsers();
    });
  });
  var userSearchInput = document.getElementById('userSearchInput');
  if (userSearchInput) userSearchInput.addEventListener('input', function(){ loadAdminUsers(); });

  ['prize1Type','prize2Type','prize3Type'].forEach(function(id){
    var el = document.getElementById(id);
    if (el) el.addEventListener('change', function(){
      var rowId = id.replace('Type', 'FileRow');
      var row = document.getElementById(rowId);
      if (row) row.style.display = this.value === 'custom' ? 'flex' : 'none';
    });
  });
  ['prize1File','prize2File','prize3File'].forEach(function(id){
    var el = document.getElementById(id);
    if (el) el.addEventListener('change', function(e){
      var file = e.target.files[0]; if (!file) return;
      if (file.size > 2 * 1024 * 1024) { this.value = ''; return; }
      var reader = new FileReader();
      reader.onload = function(evt){ e.target.dataset.file = evt.target.result; };
      reader.readAsDataURL(file);
    });
  });

  var exclusiveAvatarFile = document.getElementById('exclusiveAvatarFile');
  if (exclusiveAvatarFile) exclusiveAvatarFile.addEventListener('change', function(e){
    var file = e.target.files[0]; if (!file) return;
    if (file.size > 5 * 1024 * 1024) { showShopNotification('حجم فایل کمتر از 5MB', 'error'); this.value = ''; return; }
    if (file.type.startsWith('video/')) {
      var url = URL.createObjectURL(file);
      editingUserExclusiveAvatar = url;
      document.getElementById('exclusiveAvatarPreview').innerHTML = '<video src="' + url + '" autoplay loop muted playsinline webkit-playsinline style="width:100%;height:100%;object-fit:cover;"></video>';
    } else {
      compressImage(file, 256, function(dataUrl){
        editingUserExclusiveAvatar = dataUrl;
        document.getElementById('exclusiveAvatarPreview').innerHTML = '<img src="' + dataUrl + '" alt="exclusive">';
      });
    }
  });
  var removeExclusiveAvatar = document.getElementById('removeExclusiveAvatar');
  if (removeExclusiveAvatar) removeExclusiveAvatar.addEventListener('click', function(){
    editingUserExclusiveAvatar = null;
    document.getElementById('exclusiveAvatarPreview').innerHTML = '<span class="exclusive-avatar-placeholder">👤</span>';
    document.getElementById('exclusiveAvatarFile').value = '';
  });

  var gameVolumeSlider = document.getElementById('gameVolumeSlider');
  if (gameVolumeSlider) gameVolumeSlider.addEventListener('input', function(){
    var bgMusic = document.getElementById('bgMusic');
    if (bgMusic) bgMusic.volume = this.value / 100;
  });
});

document.addEventListener('visibilitychange', async function(){
  if (document.hidden) { setUserOnlineStatus(false); }
  else { setUserOnlineStatus(true); await checkWhitelistNow(); await syncWithServerInBackground(); }
});

window.addEventListener('beforeunload', function(){
  if (currentPhone) {
    try { setFBOnline(currentPhone, false, {}); } catch(e) {}
  }
});

window.closeModal = closeModal;
window.closeEditUser = closeEditUser;
window.closeAdminModal = closeAdminModal;
window.closeUserHistory = closeUserHistory;
window.openUserHistory = openUserHistory;
window.openEditUser = openEditUser;
window.saveUserEdit = saveUserEdit;
window.quickWhitelistUser = quickWhitelistUser;
window.clearUserSessions = clearUserSessions;
window.removeWhitelistIP = removeWhitelistIP;
window.markNewsAsRead = markNewsAsRead;
window.confirmTournamentTime = confirmTournamentTime;
window.confirmPrize = confirmPrize;
window.saveAllTournamentConfig = saveAllTournamentConfig;
window.addClanToBlacklist = addClanToBlacklist;
window.removeClanFromBlacklist = removeClanFromBlacklist;

console.log('✅ Safe Asli.js loaded');