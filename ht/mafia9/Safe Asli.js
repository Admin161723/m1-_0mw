/* ============================================================ */
/*  Safe Asli.js - نسخه نهایی کامل - پنل ادمین کار می‌کنه      */
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
var localAvatarLock = 0;
var localTemplateLock = 0;
var awayTimer = null;
var isUserAway = false;
var gameServerLocked = false;
var isRedirecting = false;
var currentAdminTab = 'all';
var currentUserList = [];
var viewingUserHistory = null;

/* Firebase config */
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

/* ---------- Redis ---------- */
async function upstashGet(url, token, k) {
  try {
    var c = new AbortController(); var t = setTimeout(function(){c.abort();}, 5000);
    var r = await fetch(url + '/get/' + encodeURIComponent(k), { headers: { 'Authorization': 'Bearer ' + token }, signal: c.signal, cache: 'no-store' });
    clearTimeout(t); if (!r.ok) return null;
    var d = await r.json();
    if (d && d.result) { try { return JSON.parse(d.result); } catch (e) { return d.result; } }
    return null;
  } catch (e) { return null; }
}
async function upstashSet(url, token, k, v) {
  try {
    var jsonValue = JSON.stringify(v);
    var c = new AbortController(); var t = setTimeout(function(){c.abort();}, 5000);
    var r = await fetch(url + '/set/' + encodeURIComponent(k) + '/' + encodeURIComponent(jsonValue), { headers: { 'Authorization': 'Bearer ' + token }, signal: c.signal });
    clearTimeout(t); return r.ok;
  } catch (e) { return false; }
}
async function upstashDel(url, token, k) {
  try {
    var c = new AbortController(); var t = setTimeout(function(){c.abort();}, 5000);
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
async function redisDel(key) {
  await Promise.allSettled([
    upstashDel(UPSTASH_OLD_URL, UPSTASH_OLD_TOKEN, key),
    upstashDel(UPSTASH_NEW_URL, UPSTASH_NEW_TOKEN, key)
  ]);
  return true;
}

async function getUser(p){return await redisGet('user:'+p);}
async function saveUser(p,u){return await redisSet('user:'+p,u);}
async function getAllUsers(){return await redisGet('all_users')||{};}
async function saveAllUsers(u){return await redisSet('all_users',u);}
async function getGroups(){return await redisGet('police_groups')||[];}
async function getNews(){return await redisGet('game_news')||[];}
async function saveNews(n){return await redisSet('game_news',n);}
async function getMaintenance(){return await redisGet('server_maintenance');}
async function setMaintenance(on){return await redisSet('server_maintenance',{on:on,at:Date.now()});}
async function getTournamentConfig(){return await redisGet('tournament_config')||{};}
async function saveTournamentConfigData(cfg){return await redisSet('tournament_config',cfg);}
async function getBanStatus(p){
  var b=await redisGet('ban:'+p);
  if(b&&b.isBanned){
    if(b.expiresAt&&b.duration!=='permanent'&&b.duration!=='دائمی'){
      if(new Date(b.expiresAt).getTime()<Date.now())return null;
    }
    return b;
  }
  return null;
}
async function getDeviceBan(id){return await redisGet('device_ban:'+id);}
async function setDeviceBan(id,data){return await redisSet('device_ban:'+id,data);}
async function getIPBan(ip){return await redisGet('ip_ban:'+ip);}
async function setIPBan(ip,data){return await redisSet('ip_ban:'+ip,data);}
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
    showShopNotification('✅ ' + (counter-1) + ' کاربر بازنشانی شد');
    if (currentUserData && allUsers[currentPhone]) {
      currentUserData.userCode = allUsers[currentPhone].userCode;
      updateUIWithData(currentUserData);
    }
    await loadUsers();
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

async function fetchUserIP() {
  try {
    var c = new AbortController(); var t = setTimeout(function(){c.abort();}, 3000);
    var r = await fetch('https://api.ipify.org?format=json', { signal: c.signal, cache: 'no-store' });
    clearTimeout(t);
    if (r.ok) { var d = await r.json(); if (d && d.ip) return String(d.ip).trim(); }
  } catch(e) {}
  return null;
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

function redirectToBan(b,p){
  if(isRedirecting)return;
  isRedirecting=true;
  var params=new URLSearchParams({phone:p,by:b.bannedBy||'مدیریت',reason:b.reason||'بدون دلیل',duration:b.duration||'1d',expires:b.expiresAt||''});
  window.location.href='Ban.html?'+params.toString();
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
  var rank=(currentUserData&&currentUserData.rank)||'کاربر';
  var isCreator=(currentPhone===CREATOR_PHONE)||rank==='سازنده';
  if(isCreator)return RANK_PERM['سازنده'];
  return RANK_PERM[rank]||{panel:false};
}
function fillBanOptions(max){
  var order=BAN_OPTIONS.map(function(o){return o[0];});
  var idx=order.indexOf(max);
  var sel=document.getElementById('editBanDuration');
  if(!sel)return;
  sel.innerHTML='';
  for(var i=0;i<BAN_OPTIONS.length;i++){
    if(idx<0||i<=idx){
      var op=document.createElement('option');
      op.value=BAN_OPTIONS[i][0];
      op.textContent=BAN_OPTIONS[i][1];
      sel.appendChild(op);
    }
  }
  if(sel.options.length) sel.selectedIndex=sel.options.length-1;
}

var GROUP_ICONS = {
  shield: '<svg viewBox="0 0 24 24"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/></svg>',
  lion: '<svg viewBox="0 0 24 24"><path d="M7 4c-1.1 0-2 .9-2 2v1c-1.1 0-2 .9-2 2v7c0 2.76 2.24 5 5 5h8c2.76 0 5-2.24 5-5V9c0-1.1-.9-2-2-2V6c0-1.1-.9-2-2-2H7z"/></svg>',
  crown: '<svg viewBox="0 0 24 24"><path d="M12 1L9 9l-7 3 2 9h16l2-9-7-3-3-8z"/></svg>',
  star: '<svg viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>'
};
function getGroupIcon(key){return GROUP_ICONS[key]||GROUP_ICONS.shield;}

var avatars=[
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

var templates=[
  {id:'t1', src:'Ga1.webp', price:1500, name:'قالب طلایی'},
  {id:'t2', src:'Ga2.webp', price:2000, name:'قالب الماسی'},
  {id:'t3', src:'Ga3.webp', price:1000, name:'قالب نقره‌ای'}
];

window.avatarLoadError=function(img,src){
  img.style.display='none';
  var box=img.parentElement;
  if(box&&!box.querySelector('.avatar-missing')){
    var d=document.createElement('div');
    d.className='avatar-missing';
    d.innerHTML='❌<br>'+src;
    box.appendChild(d);
  }
};

function setupVideoObserver() {
  if (videoObserver) return;
  videoObserver = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      var v = entry.target;
      if (entry.isIntersecting) { if (v.paused) v.play().catch(function(){}); }
      else { if (!v.paused) v.pause(); }
    });
  }, { threshold: 0.1 });
}
function observeVideos(container) {
  if (!container) return;
  setupVideoObserver();
  var vs = container.querySelectorAll('video');
  for(var i=0;i<vs.length;i++) videoObserver.observe(vs[i]);
}

function sanitizeUserData(user, phone) {
  if (!user) return user;
  var isCreator = (phone === CREATOR_PHONE);
  if (user.avatar === '655.webm' && !isCreator) user.avatar = user.previousAvatar || 'Mafia2.png';
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

function getValidAvatar(src, phone) {
  if (src === '655.webm' && phone !== CREATOR_PHONE) return 'Mafia2.png';
  return src;
}

function createMediaElement(src) {
  var isVideo = src.endsWith('.webm') || src.endsWith('.mp4') || src.endsWith('.mov');
  if (isVideo) {
    var v = document.createElement('video');
    v.src = src; v.autoplay = true; v.loop = true; v.muted = true; v.playsInline = true;
    v.preload = 'metadata';
    v.setAttribute('muted', 'muted');
    v.setAttribute('playsinline', 'playsinline');
    v.style.objectFit = 'cover';
    return v;
  } else {
    var i = document.createElement('img');
    i.src = src;
    i.onerror = function(){ this.style.display='none'; };
    return i;
  }
}

function buildAvatarWithTemplate(avatarSrc, templateSrc) {
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
    wrapper.appendChild(overlay);
  }
  return wrapper;
}

function getCurrentTemplate() {
  if (!currentUserData || !currentUserData.currentTemplate) return null;
  return currentUserData.currentTemplate;
}

function updateGlobalAvatar(src) {
  var validSrc = getValidAvatar(src, currentPhone);
  var templateSrc = getCurrentTemplate();
  var mainContainer = document.getElementById('mainAvatarContainer');
  var profileContainer = document.getElementById('openAvatarShop');
  var showcaseContainer = document.getElementById('showcaseAvatarContainer');
  var templateShowcase = document.getElementById('templateShowcaseContainer');
  function buildContent() {
    var frag = document.createDocumentFragment();
    if (templateSrc) frag.appendChild(buildAvatarWithTemplate(validSrc, templateSrc));
    else frag.appendChild(createMediaElement(validSrc));
    return frag;
  }
  if(mainContainer) { mainContainer.innerHTML = ''; mainContainer.appendChild(buildContent()); observeVideos(mainContainer); }
  if(profileContainer) { profileContainer.innerHTML = ''; profileContainer.appendChild(buildContent()); observeVideos(profileContainer); }
  if(showcaseContainer) { showcaseContainer.innerHTML = ''; showcaseContainer.appendChild(buildContent()); observeVideos(showcaseContainer); }
  if(templateShowcase) { templateShowcase.innerHTML = ''; templateShowcase.appendChild(buildContent()); observeVideos(templateShowcase); }
}

function updateUIWithData(user) {
  if (!user) return;
  var setText = function(id, val) { var e = document.getElementById(id); if (e) e.textContent = val; };
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
  if(tk){applyTick(document.getElementById('mainUserTick'), tk); applyTick(document.getElementById('profileUserTick'), tk);}

  var perm = getPerm();
  var btnAdmin = document.getElementById('btnAdmin');
  if(btnAdmin) btnAdmin.style.display = perm.panel ? 'flex' : 'none';
  var adminTools = document.getElementById('adminTools');
  if(adminTools) adminTools.style.display = perm.server ? 'block' : 'none';
  var tcfg = document.getElementById('tournamentConfig');
  if(tcfg) tcfg.style.display = (currentPhone === CREATOR_PHONE) ? 'block' : 'none';
  var btnUC = document.getElementById('btnUserControl');
  if(btnUC) btnUC.style.display = perm.userControl ? 'block' : 'none';
  var btnWL = document.getElementById('btnWhitelistIP');
  if(btnWL) btnWL.style.display = perm.whitelist ? 'block' : 'none';

  shopGold = user.coins || 0;
  shopGems = user.gems || 0;
  shopDollars = user.dollars || 0;

  var s1 = document.getElementById('shopGemAmount'); if(s1) s1.textContent = toPersianNum(shopGems);
  var s2 = document.getElementById('shopGemAmount2'); if(s2) s2.textContent = toPersianNum(shopGems);
  var c1 = document.getElementById('shopGoldAmount'); if(c1) c1.textContent = toPersianNum(shopGold);
  var c2 = document.getElementById('shopGoldAmount2'); if(c2) c2.textContent = toPersianNum(shopGold);
  var d1 = document.getElementById('shopDollarAmount'); if(d1) d1.textContent = toPersianNum(shopDollars);
  var d2 = document.getElementById('shopDollarAmount2'); if(d2) d2.textContent = toPersianNum(shopDollars);
}

async function saveUserData(){
  if(!currentUserData||!currentPhone)return;
  if(pauseSync) return;
  var am = document.getElementById('adminModal'); if(am && am.classList.contains('active')) return;
  var eu = document.getElementById('editUserModal'); if(eu && eu.classList.contains('active')) return;
  currentUserData.lastUpdatedAt = Date.now();
  currentUserData = sanitizeUserData(currentUserData, currentPhone);
  localStorage.setItem('user_cache_' + currentPhone, JSON.stringify(currentUserData));
  await saveUser(currentPhone,currentUserData);
  var allUsers=await getAllUsers();
  allUsers[currentPhone]=currentUserData;
  await saveAllUsers(allUsers);
}

async function saveAvatarToStorage(src){
  if(!currentUserData||!currentPhone)return;
  if (src === '655.webm' && currentPhone !== CREATOR_PHONE) { showShopNotification('اختصاصی سازنده', 'error'); return; }
  if (currentUserData.avatar && currentUserData.avatar !== src) currentUserData.previousAvatar = currentUserData.avatar;
  currentUserData.avatar = src;
  await saveUserData();
}

async function saveTemplateToStorage(src){
  if(!currentUserData||!currentPhone)return;
  currentUserData.currentTemplate = src;
  await saveUserData();
}

async function changeUsername(){
  var nn=prompt("نام جدید (حداکثر ۲۰ کاراکتر):");
  if(nn && nn.trim()!==""){
    var trimmed = nn.trim();
    if(trimmed.length > 20) { showShopNotification('حداکثر ۲۰ کاراکتر!', 'error'); return; }
    if(currentUserData.coins>=100){
      currentUserData.coins-=100; currentUserData.name=trimmed;
      await saveUserData(); updateUIWithData(currentUserData);
    } else showShopNotification('۱۰۰ سکه نیاز است','error');
  }
}

function copyToClipboard(t,m){
  navigator.clipboard.writeText(t).then(function(){showShopNotification(m||'کپی شد!');}).catch(function(){
    var ta=document.createElement('textarea');ta.value=t;document.body.appendChild(ta);ta.select();
    document.execCommand('copy');document.body.removeChild(ta);
    showShopNotification(m||'کپی شد!');
  });
}
function closeModal(id){var e=document.getElementById(id);if(e)e.classList.remove('active');}
function closeEditUser(){var e=document.getElementById('editUserModal');if(e)e.classList.remove('active');editingUserId=null;editingUserExclusiveAvatar=null; pauseSync = false;}
function closeAdminModal(){var e=document.getElementById('adminModal');if(e)e.classList.remove('active'); pauseSync = false;}
function showShopNotification(m,t){
  var n=document.getElementById('shopNotification');
  if(!n)return;
  n.textContent=m;
  n.className='shop-notification show'+(t==='error'?' error':'');
  setTimeout(function(){n.classList.remove('show');},3000);
}

function lockServerForeverInGame() {
  if (gameServerLocked) return;
  gameServerLocked = true;
  document.addEventListener('click', function(e){ e.preventDefault(); return false; }, true);
  document.addEventListener('touchstart', function(e){ e.preventDefault(); return false; }, true);
  var overlay = document.getElementById('serverDownOverlay');
  if (overlay) {
    overlay.classList.add('show');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,0.95);display:flex;align-items:center;justify-content:center;flex-direction:column;text-align:center;padding:30px;';
  }
}

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
        var allUsers = await getAllUsers();
        allUsers[loggedIn.phone] = user;
        await saveAllUsers(allUsers);
      }
      setFBOnline(loggedIn.phone, false, {});
    } catch(e) {}
  }, AWAY_TIMEOUT_MS);
}
function cancelAwayTimer() { clearTimeout(awayTimer); awayTimer = null; }
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
      var allUsers = await getAllUsers();
      allUsers[loggedIn.phone] = user;
      await saveAllUsers(allUsers);
    }
    setFBOnline(loggedIn.phone, true, {});
  } catch(e) {}
}
document.addEventListener('visibilitychange', function() {
  if (document.hidden) startAwayTimer();
  else { cancelAwayTimer(); reconnectUser(); }
});
window.addEventListener('blur', startAwayTimer);
window.addEventListener('focus', function(){ cancelAwayTimer(); reconnectUser(); });

/* ============================================================ */
/*  پنل مدیریت - نسخه قطعی                                      */
/* ============================================================ */
function openAdminPanel() {
  console.log('🎯 openAdminPanel');

  var modal = document.getElementById('adminModal');
  if (!modal) { alert('پنل ادمین پیدا نشد'); return; }

  // toggle
  if (modal.classList.contains('active')) {
    modal.classList.remove('active');
    pauseSync = false;
    return;
  }

  pauseSync = true;

  // مخفی بخش‌ها
  var ids = ['usersSection','userHistorySection','userControlSection','whitelistSection'];
  for (var i = 0; i < ids.length; i++) {
    var el = document.getElementById(ids[i]);
    if (el) el.style.display = 'none';
  }

  // نمایش
  modal.classList.add('active');
  console.log('✅ panel opened');

  // دکمه سرور
  setTimeout(function() {
    getMaintenance().then(function(m) {
      var btn = document.getElementById('btnServerToggle');
      if (btn) {
        if (m && m.on) { btn.textContent = 'وصل کردن سرور'; btn.className = 'edit-btn unban'; }
        else { btn.textContent = 'قطع سرور'; btn.className = 'edit-btn ban'; }
      }
    }).catch(function(){});
  }, 100);

  // لود کاربران
  setTimeout(function() {
    loadUsers().catch(function(e){ console.log('loadUsers err:', e); });
  }, 100);

  // تنظیمات مسابقات
  if (currentPhone === CREATOR_PHONE) {
    setTimeout(function() {
      try { loadTournamentConfig(); } catch(e) {}
      try { renderBlacklist(); } catch(e) {}
    }, 200);
  }
}
window.openAdminPanel = openAdminPanel;

async function loadUsers() {
  var container = document.getElementById('adminUserListContainer');
  if (container) container.innerHTML = '<div style="color:#aaa;padding:20px;text-align:center;">در حال بارگذاری...</div>';
  try {
    var allUsers = await getAllUsers();
    currentUserList = Object.entries(allUsers).map(function(e) {
      var u = e[1];
      u.phone = e[0];
      return u;
    });
    renderAdminUsers(currentUserList);
  } catch(e) {
    if (container) container.innerHTML = '<div style="color:#f44336;padding:20px;text-align:center;">خطا</div>';
  }
}
window.loadUsers = loadUsers;
window.loadAdminUsers = loadUsers;

function renderAdminUsers(list) {
  var container = document.getElementById('adminUserListContainer');
  if (!container) return;
  var searchInput = document.getElementById('userSearchInput');
  var searchVal = searchInput ? searchInput.value.trim() : '';
  var filtered = list;
  if (searchVal) filtered = filtered.filter(function(u) { return String(u.userCode) === searchVal; });
  if (currentAdminTab === 'online') filtered = filtered.filter(function(u) { return u.online === true; });
  else if (currentAdminTab === 'offline') filtered = filtered.filter(function(u) { return !u.online; });
  else if (currentAdminTab === 'banned') filtered = filtered.filter(function(u) { return u.banned === true; });

  if (!filtered.length) {
    container.innerHTML = '<div style="color:#aaa;padding:20px;text-align:center;">کاربری یافت نشد</div>';
    return;
  }

  var html = '';
  for (var i = 0; i < filtered.length; i++) {
    var u = filtered[i];
    var statusClass = u.banned ? 'status-banned' : (u.online ? 'status-online' : 'status-offline');
    var statusText = u.banned ? 'بن شده' : (u.online ? 'آنلاین' : 'آفلاین');
    html += '<div class="admin-user-item" onclick="window.openUserHistory && window.openUserHistory(\'' + u.phone + '\')">';
    html += '<div class="info">';
    html += '<span class="name">' + (u.name || 'کاربر') + ' (کد: ' + (toPersianNum(u.userCode) || '----') + ')</span>';
    html += '<span class="detail">' + u.phone + ' | ' + (u.rank || 'کاربر') + '</span>';
    html += '<span class="detail">IP: ' + (u.lastIP || '-') + '</span>';
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
    var html = '<div style="color:#ccc;font-size:12px;background:rgba(255,255,255,.05);padding:10px;border-radius:8px;margin-bottom:8px;">';
    html += '<div>کد: ' + (toPersianNum(user.userCode) || '----') + '</div>';
    html += '<div>شماره: ' + phone + '</div>';
    html += '<div>مقام: ' + (user.rank || 'کاربر') + '</div>';
    html += '<div>سکه: ' + toPersianNum(user.coins||0) + ' | الماس: ' + toPersianNum(user.gems||0) + '</div>';
    html += '<div>وضعیت: ' + (user.banned ? 'بن شده' : (user.online ? 'آنلاین' : 'آفلاین')) + '</div>';
    html += '</div>';
    html += '<button class="edit-btn cancel" onclick="window.closeUserHistory && window.closeUserHistory()" style="width:100%;margin-bottom:8px;">بازگشت</button>';
    html += '<button class="edit-btn info" onclick="window.openEditUser && window.openEditUser(\'' + phone + '\')" style="width:100%;">ویرایش کاربر</button>';
    content.innerHTML = html;
  } catch(e) {}
}
window.openUserHistory = openUserHistory;

function closeUserHistory() {
  document.getElementById('userHistorySection').style.display = 'none';
  document.getElementById('usersSection').style.display = 'block';
  loadUsers();
}
window.closeUserHistory = closeUserHistory;

async function openEditUser(id) {
  var allUsers = await getAllUsers();
  var u = allUsers[id]; if (!u) return;

  editingUserId = id; pauseSync = true;
  editingUserExclusiveAvatar = u.exclusiveAvatar || null;

  var setVal = function(eid, val) { var e = document.getElementById(eid); if (e) e.value = val; };
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
      if (u.exclusiveAvatar.indexOf('.webm') > -1 || u.exclusiveAvatar.indexOf('.mp4') > -1) {
        preview.innerHTML = '<video src="' + u.exclusiveAvatar + '" autoplay loop muted playsinline style="width:100%;height:100%;object-fit:cover;"></video>';
      } else {
        preview.innerHTML = '<img src="' + u.exclusiveAvatar + '">';
      }
    } else {
      preview.innerHTML = '<span class="exclusive-avatar-placeholder">👤</span>';
    }
  }

  var perm = getPerm();
  var setDisp = function(eid, show) { var e = document.getElementById(eid); if (e) e.style.display = show ? 'block' : 'none'; };
  setDisp('fieldCoins', perm.coins);
  setDisp('fieldGems', perm.gems);
  setDisp('fieldDollars', perm.dollars);
  setDisp('fieldRank', perm.rank);
  setDisp('fieldStats', perm.stats);
  setDisp('fieldExclusive', perm.exclusive);
  var rd = document.getElementById('rowDelete'); if (rd) rd.style.display = perm.del ? 'flex' : 'none';

  fillBanOptions(perm.banMax || '1d');

  var bb = document.getElementById('btnBanUser');
  var ub = document.getElementById('btnUnbanUser');
  var bs = await getBanStatus(id);
  if (bs || u.banned) { if (bb) bb.style.display = 'none'; if (ub) ub.style.display = 'block'; }
  else { if (bb) bb.style.display = 'block'; if (ub) ub.style.display = 'none'; }

  document.getElementById('editUserModal').classList.add('active');
}
window.openEditUser = openEditUser;

async function saveUserEdit() {
  if (!editingUserId) return;
  var perm = getPerm();
  var allUsers = await getAllUsers();
  var u = allUsers[editingUserId];
  if (!u) { pauseSync = false; return; }

  var getVal = function(eid) { var e = document.getElementById(eid); return e ? e.value : ''; };
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
  u.lastUpdatedAt = Date.now();
  allUsers[editingUserId] = u;
  await saveUser(editingUserId, u);
  await saveAllUsers(allUsers);

  if (editingUserId === currentPhone) {
    currentUserData = u;
    localStorage.setItem('user_cache_' + currentPhone, JSON.stringify(currentUserData));
    updateUIWithData(currentUserData);
  }
  closeEditUser();
  await loadUsers();
  showShopNotification('✅ ذخیره شد');
}
window.saveUserEdit = saveUserEdit;

async function banUser(type) {
  type = type || 'account';
  if (!editingUserId) return;
  var perm = getPerm();
  var allUsers = await getAllUsers();
  var u = allUsers[editingUserId];
  if (!u) return;
  if (editingUserId === CREATOR_PHONE) { showShopNotification('سازنده بن نمیشه', 'error'); return; }

  var dur = document.getElementById('editBanDuration').value;
  var banData = { isBanned: true, phone: editingUserId, bannedBy: currentUserData.name, reason: 'تخلف', duration: dur, bannedAt: new Date().toISOString(), expiresAt: DUR_MS[dur] ? new Date(Date.now() + DUR_MS[dur]).toISOString() : null };

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
    else { await redisDel('user:' + k); await redisDel('ban:' + k); }
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
  showShopNotification(newState ? 'سرور قطع شد' : 'سرور وصل شد');
  var btn = document.getElementById('btnServerToggle');
  if (btn) {
    if (newState) { btn.textContent = 'وصل کردن سرور'; btn.className = 'edit-btn unban'; }
    else { btn.textContent = 'قطع سرور'; btn.className = 'edit-btn ban'; }
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
  var all = await getAllUsers(); all[phone] = user; await saveAllUsers(all);
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
  var all = await getAllUsers(); all[phone] = user; await saveAllUsers(all);
  showShopNotification('کاربر خارج شد');
}
async function clearUserData() {
  var phone = document.getElementById('controlUserPhone').value.trim();
  if (!phone) { showShopNotification('شماره را وارد کنید', 'error'); return; }
  if (!confirm('پاک‌سازی داده‌ها؟')) return;
  var user = await getUser(phone);
  if (!user) return;
  user.coins = 0; user.gems = 0; user.dollars = 0;
  user.cups = 0; user.hours = 0; user.xp = 0; user.level = 1;
  user.lastUpdatedAt = Date.now();
  await saveUser(phone, user);
  var all = await getAllUsers(); all[phone] = user; await saveAllUsers(all);
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
  if (!ips.length) { container.innerHTML = '<div style="color:#888;font-size:11px;text-align:center;padding:8px;">خالی</div>'; return; }
  var html = '';
  for (var i = 0; i < ips.length; i++) {
    var ip = ips[i];
    var info = list[ip] || {};
    html += '<div class="whitelist-item"><span style="direction:ltr;">' + ip + '</span><button onclick="window.removeWhitelistIP && window.removeWhitelistIP(\'' + ip + '\')">حذف</button></div>';
  }
  container.innerHTML = html;
}

async function loadNews(){
  var news=await getNews();
  var list=document.getElementById('newsList');
  var area=document.getElementById('newsCreatorArea');
  var badge=document.getElementById('newsBadge');
  if(currentUserData&&(currentUserData.rank==='سازنده'||currentPhone===CREATOR_PHONE)){ if(area) area.style.display='block'; }
  var key='user_read_news_'+currentPhone;
  var read=JSON.parse(localStorage.getItem(key)||'[]');
  var unread=news.filter(function(n){return !read.includes(n.id);}).length;
  if(badge){ if(unread>0){badge.textContent=toPersianNum(unread);badge.style.display='flex';}else badge.style.display='none'; }
  if(!list)return;
  if(!news.length){list.innerHTML='<div style="text-align:center;color:rgba(255,255,255,.6);padding:20px;">خالی</div>';return;}
  list.innerHTML=news.slice().reverse().map(function(it){
    return '<div class="news-item" onclick="window.markNewsAsRead && window.markNewsAsRead('+it.id+')"><div class="news-title">'+it.title+'</div><div class="news-content">'+it.content+'</div><div class="news-date">'+it.date+' - '+(it.sender||'مدیریت')+'</div></div>';
  }).join('');
}
function markNewsAsRead(id){
  var key='user_read_news_'+currentPhone;
  var read=JSON.parse(localStorage.getItem(key)||'[]');
  if(!read.includes(id)){read.push(id);localStorage.setItem(key,JSON.stringify(read));loadNews();}
}
window.markNewsAsRead = markNewsAsRead;

async function sendNews(){
  var t=document.getElementById('newsTitleInput').value.trim();
  var c=document.getElementById('newsContentInput').value.trim();
  if(!t||!c){showShopNotification('عنوان و متن را وارد کنید','error');return;}
  var news=await getNews();
  news.push({id:Date.now(),title:t,content:c,date:new Date().toLocaleDateString('fa-IR'),sender:currentUserData.name});
  await saveNews(news);
  document.getElementById('newsTitleInput').value='';
  document.getElementById('newsContentInput').value='';
  await loadNews();
  showShopNotification('اطلاعیه ارسال شد');
}

function initAvatarShop(){
  if(!currentUserData)return;
  shopGold=currentUserData.coins||0;
  shopGems=currentUserData.gems||0;
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
    }
  });
  var owned = currentUserData.ownedAvatars || [];
  avatars.forEach(function(a){
    if (a.free) a.owned = true;
    else if (owned.includes('ex_' + a.src) || owned.includes(a.src)) a.owned = true;
    else a.owned = false;
  });
  templates.forEach(function(t){ t.owned = (currentUserData.ownedTemplates || []).includes(t.src); });
}

function renderAvatars(){
  var grid = document.getElementById('avatarGrid');
  if(!grid)return;
  var disp;
  if(currentAvatarSection === 'my'){
    disp = avatars.filter(function(a){ return a.owned; });
    if(currentPhone !== CREATOR_PHONE) disp = disp.filter(function(a){ return a.src !== '655.webm'; });
  } else {
    disp = avatars.filter(function(a){ return !a.owned && !a.exclusive; });
  }
  if(!disp.length){ grid.innerHTML = '<div style="text-align:center;padding:40px;color:#888;">آواتاری نیست</div>'; return; }
  var currentAvatarSrc = currentUserData ? currentUserData.avatar : '';
  grid.innerHTML = disp.map(function(a){
    var isVid = a.src.endsWith('.webm') || a.src.endsWith('.mp4');
    var isCurrent = (currentAvatarSrc === a.src);
    var cardClass = 'avatar-card ' + (a.owned ? 'owned ' : '') + (isCurrent ? 'is-selected' : '');
    var mediaHtml = isVid ? '<video src="'+a.src+'" autoplay loop muted playsinline style="width:100%;height:100%;object-fit:cover;"></video>' : '<img src="'+a.src+'" style="width:100%;height:100%;object-fit:cover;">';
    var confirmBtn = (currentAvatarSection === 'my' && a.owned) ? '<button class="cbtn cbtn-mini avatar-confirm-btn" data-src="'+a.src+'">تایید</button>' : '';
    var priceHtml = !a.owned ? '<div class="avatar-price"><img src="Jam99.webp"><span class="price-value">'+toPersianNum(a.price)+'</span></div>' : '<div style="color:#4CAF50;font-size:11px;">دارید</div>';
    return '<div class="'+cardClass+'" data-id="'+a.id+'"><div class="avatar-image">'+mediaHtml+'</div>'+priceHtml+confirmBtn+'</div>';
  }).join('');
  grid.querySelectorAll('.avatar-card').forEach(function(c){
    c.addEventListener('click', function(e){
      if (e.target.closest('.avatar-confirm-btn')) return;
      var id = parseInt(c.dataset.id);
      var av = avatars.find(function(x){ return x.id === id; });
      if (av && currentAvatarSection === 'buy' && !av.owned) handleAvatarClick(id);
    });
  });
  grid.querySelectorAll('.avatar-confirm-btn').forEach(function(btn){
    btn.addEventListener('click', function(e){
      e.stopPropagation();
      playClickSound();
      var src = btn.dataset.src;
      if (!src) return;
      currentUserData.avatar = src;
      updateGlobalAvatar(src);
      renderAvatars();
      saveAvatarToStorage(src);
    });
  });
}

function renderTemplates(){
  var grid = document.getElementById('templateGrid');
  if(!grid)return;
  var disp = currentTemplateSection === 'my' ? templates.filter(function(t){return t.owned;}) : templates.filter(function(t){return !t.owned;});
  if (!disp.length) { grid.innerHTML = '<div style="text-align:center;padding:40px;color:#888;">قالبی نیست</div>'; return; }
  var currentT = currentUserData ? currentUserData.currentTemplate : null;
  grid.innerHTML = disp.map(function(t){
    var isCurrent = (currentT === t.src);
    var confirmBtn = (currentTemplateSection === 'my' && t.owned) ? '<button class="cbtn cbtn-mini template-confirm-btn" data-src="'+t.src+'">تایید</button>' : '';
    var priceHtml = !t.owned ? '<div class="template-price"><img src="Jam99.webp"><span class="price-value">'+toPersianNum(t.price)+'</span></div>' : '<div style="color:#4CAF50;font-size:11px;">دارید</div>';
    return '<div class="template-card'+(isCurrent?' is-selected':'')+'" data-src="'+t.src+'"><div class="template-preview-box"><img src="'+t.src+'" style="width:100%;height:100%;object-fit:contain;"></div><div class="template-name">'+t.name+'</div>'+priceHtml+confirmBtn+'</div>';
  }).join('');
  grid.querySelectorAll('.template-confirm-btn').forEach(function(btn){
    btn.addEventListener('click', function(e){
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

function handleAvatarClick(id){
  var a=avatars.find(function(x){return x.id===id;});
  if(!a)return;
  if(currentAvatarSection==='buy'&&!a.owned){
    selectedAvatar=a;purchasePrice=a.price;purchaseMode='avatar';
    document.getElementById('modalTitle').textContent = 'خرید آواتار';
    document.getElementById('modalText').textContent='خرید به قیمت '+toPersianNum(purchasePrice)+' الماس؟';
    document.getElementById('purchaseModal').classList.add('show');
  }else if(a.owned){
    updateGlobalAvatar(a.src);
    saveAvatarToStorage(a.src);
  }
}

async function confirmPurchase(){
  playClickSound();
  if (purchaseMode === 'template' && selectedTemplate) {
    if (shopGems < templatePurchasePrice) { document.getElementById('purchaseModal').classList.remove('show'); showShopNotification('الماس کافی نیست','error'); return; }
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
      updateUIWithData(currentUserData);
      renderAvatars();
      document.getElementById('purchaseModal').classList.remove('show');
      await saveUser(currentPhone, currentUserData);
    } else {
      document.getElementById('purchaseModal').classList.remove('show');
      showShopNotification('الماس کافی نیست','error');
    }
  }
}

function playClickSound() {
  try { var clickSound = document.getElementById('clickSound'); if (clickSound) { clickSound.currentTime = 0; clickSound.play().catch(function(){}); } } catch (e) {}
}

async function setUserOnlineStatus(online) {
  if (!currentPhone) return;
  var user = await getUser(currentPhone); if (!user) return;
  user.online = online; user.lastSeen = Date.now();
  if (myIP) user.lastIP = myIP;
  if (currentDeviceId) user.lastDevice = currentDeviceId;
  await saveUser(currentPhone, user);
  setFBOnline(currentPhone, online, { name: user.name, rank: user.rank });
}

async function checkWhitelistNow() {
  try {
    myIP = await fetchUserIP(); if (!myIP) return false;
    currentDeviceId = getDeviceId();
    return await isIPWhitelisted(myIP, currentDeviceId);
  } catch(e) { return false; }
}

async function checkBanPeriodically(){
  if(!currentPhone||isRedirecting)return;
  if (currentPhone === CREATOR_PHONE) return;
  if(pauseSync) return;
  var am = document.getElementById('adminModal'); if(am && am.classList.contains('active')) return;
  var eu = document.getElementById('editUserModal'); if(eu && eu.classList.contains('active')) return;
  if (fbReady && fbDb) {
    try {
      var snap = await fbDb.ref('server_state/on').once('value');
      if (snap.val() === true) { lockServerForeverInGame(); return; }
    } catch(e) {}
  }
  var isWhite = await checkWhitelistNow(); if (isWhite) return;
  var b = await getBanStatus(currentPhone);
  if(b){redirectToBan(b,currentPhone); return;}
}

async function syncWithServerInBackground() {
  try {
    if(pauseSync) return;
    var am = document.getElementById('adminModal'); if(am && am.classList.contains('active')) return;
    var eu = document.getElementById('editUserModal'); if(eu && eu.classList.contains('active')) return;
    myIP = await fetchUserIP(); if (!myIP) return;
    currentDeviceId = getDeviceId();

    if (currentPhone === CREATOR_PHONE) {
      var so = document.getElementById('serverDownOverlay'); if(so) so.classList.remove('show');
      var serverUser = await getUser(currentPhone);
      if (!serverUser) return;
      if (!serverUser.userCode || isNaN(parseInt(serverUser.userCode))) serverUser = await assignCodeIfMissing(currentPhone, serverUser);
      var st = serverUser.lastUpdatedAt || 0;
      var lt = currentUserData.lastUpdatedAt || 0;
      if (st > lt) {
        currentUserData = sanitizeUserData(Object.assign({}, currentUserData, serverUser), currentPhone);
      } else {
        currentUserData = sanitizeUserData(Object.assign({}, serverUser, {
          coins: currentUserData.coins, gems: currentUserData.gems, dollars: currentUserData.dollars,
          avatar: currentUserData.avatar, previousAvatar: currentUserData.previousAvatar,
          ownedAvatars: currentUserData.ownedAvatars, currentTemplate: currentUserData.currentTemplate,
          ownedTemplates: currentUserData.ownedTemplates, lastUpdatedAt: currentUserData.lastUpdatedAt
        }), currentPhone);
      }
      currentUserData.lastIP = myIP; currentUserData.lastDevice = currentDeviceId;
      localStorage.setItem('user_cache_' + currentPhone, JSON.stringify(currentUserData));
      updateUIWithData(currentUserData);
      return;
    }

    var isWhitelisted = await isIPWhitelisted(myIP, currentDeviceId);
    var hasPanelAccess = getPerm().panel;

    if (!isWhitelisted) {
      if (fbReady && fbDb) {
        try {
          var snap = await fbDb.ref('server_state/on').once('value');
          if (snap.val() === true && !hasPanelAccess) { lockServerForeverInGame(); return; }
        } catch(e) {}
      }
      var m = await getMaintenance();
      if(m && m.on && !hasPanelAccess){ var so2 = document.getElementById('serverDownOverlay'); if(so2) so2.classList.add('show'); return; }
      var so3 = document.getElementById('serverDownOverlay'); if(so3) so3.classList.remove('show');
      var ban = await getBanStatus(currentPhone);
      if(ban){redirectToBan(ban,currentPhone); return;}
    }

    var sUser = await getUser(currentPhone);
    if (!sUser) {
      var cache = localStorage.getItem('user_cache_' + currentPhone);
      if (cache) { try { sUser = JSON.parse(cache); await saveUser(currentPhone, sUser); } catch(e) { window.location.href = 'index.html'; return; } }
      else { window.location.href = 'index.html'; return; }
    }
    if (!sUser.userCode || isNaN(parseInt(sUser.userCode))) sUser = await assignCodeIfMissing(currentPhone, sUser);

    var st2 = sUser.lastUpdatedAt || 0;
    var lt2 = currentUserData.lastUpdatedAt || 0;
    if (st2 > lt2) {
      currentUserData = sanitizeUserData(Object.assign({}, currentUserData, sUser), currentPhone);
    } else {
      currentUserData = sanitizeUserData(Object.assign({}, sUser, {
        coins: currentUserData.coins, gems: currentUserData.gems, dollars: currentUserData.dollars,
        avatar: currentUserData.avatar, previousAvatar: currentUserData.previousAvatar,
        ownedAvatars: currentUserData.ownedAvatars, currentTemplate: currentUserData.currentTemplate,
        ownedTemplates: currentUserData.ownedTemplates, lastUpdatedAt: currentUserData.lastUpdatedAt
      }), currentPhone);
    }
    currentUserData.lastIP = myIP; currentUserData.lastDevice = currentDeviceId;
    localStorage.setItem('user_cache_' + currentPhone, JSON.stringify(currentUserData));
    updateUIWithData(currentUserData);
  } catch(error) {}
}

function setupLiveSubscriptions() {
  if (!window.FBLive || !window.FBLive.isReady || !window.FBLive.isReady()) return;
  if (window.__liveSubsReady) return;
  window.__liveSubsReady = true;
  window.FBLive.subscribe('global', async function(sig) {
    if (sig.type === 'news_updated') { await loadNews(); showShopNotification('📢 اطلاعیه جدید'); }
    else if (sig.type === 'server_toggle') { await syncWithServerInBackground(); }
    else if (sig.type === 'db_wiped') {
      var still = await getUser(currentPhone);
      if (!still) { localStorage.removeItem('currentLoggedInUser'); window.location.href = 'index.html'; }
    }
  });
  window.FBLive.subscribe('user_' + currentPhone, async function(sig) {
    if (sig.type === 'banned' && currentPhone !== CREATOR_PHONE) {
      var ban = await getBanStatus(currentPhone);
      if (ban) redirectToBan(ban, currentPhone);
    } else if (sig.type === 'force_logout' && currentPhone !== CREATOR_PHONE) {
      localStorage.removeItem('currentLoggedInUser');
      window.location.href = 'index.html';
    } else if (sig.type === 'admin_edit') {
      var fresh = await getUser(currentPhone);
      if (fresh) { currentUserData = fresh; updateUIWithData(currentUserData); }
    }
  });
}

/* ═══════════════════════════════════════════════════════════ */
/*  راه‌اندازی                                                   */
/* ═══════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', async function() {
  var loggedIn = localStorage.getItem('currentLoggedInUser');
  if (!loggedIn) { window.location.href = 'index.html'; return; }
  var phone = null;
  try { phone = JSON.parse(loggedIn).phone; } catch(e) { window.location.href = 'index.html'; return; }
  currentPhone = phone;

  initFB(currentPhone);
  if (window.FBLive && window.FBLive.init) window.FBLive.init(currentPhone);

  await checkWhitelistNow();

  try {
    var u = await getUser(currentPhone);
    if (u && (!u.userCode || isNaN(parseInt(u.userCode)))) {
      await assignCodeIfMissing(currentPhone, u);
    }
    if (u) currentUserData = u;
  } catch(e) {}

  if (!currentUserData) {
    var cache = localStorage.getItem('user_cache_' + currentPhone);
    if (cache) { try { currentUserData = JSON.parse(cache); } catch(e) {} }
  }
  if (!currentUserData) {
    currentUserData = { name: 'کاربر', coins: 0, gems: 0, dollars: 0, avatar: 'Mafia2.png', rank: 'کاربر', level: 1 };
  }

  updateUIWithData(currentUserData);
  initAvatarShop();

  setTimeout(function() {
    syncWithServerInBackground();
    setUserOnlineStatus(true);
    setupLiveSubscriptions();
  }, 0);

  setInterval(syncWithServerInBackground, 3000);
  setInterval(function() { setUserOnlineStatus(!document.hidden); }, 30000);
  setInterval(checkBanPeriodically, 5000);
  setInterval(updateGroupDisplay, 30000);

  /* bind دکمه‌ها */
  var bind = function(id, fn) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('click', fn);
  };

  bind('menuBtn', function(e){ e.stopPropagation(); playClickSound(); var d=document.getElementById('menuDropdown'); if(d.classList.contains('active')) closeModal('menuDropdown'); else { document.getElementById('menuOverlay').classList.add('active'); d.classList.add('active'); } });
  bind('menuOverlay', function(){ document.getElementById('menuOverlay').classList.remove('active'); document.getElementById('menuDropdown').classList.remove('active'); });
  bind('menuContact', function(){ playClickSound(); closeModal('menuDropdown'); window.location.href='https://Mfasun.ir'; });
  bind('menuSettings', function(){ playClickSound(); closeModal('menuDropdown'); document.getElementById('settingsModal').classList.add('active'); });
  bind('menuLogout', function(){ playClickSound(); closeModal('menuDropdown'); if(confirm('خروج؟')){ setUserOnlineStatus(false); localStorage.removeItem('currentLoggedInUser'); window.location.href='index.html'; } });
  bind('openProfile', function(){ playClickSound(); document.getElementById('profilePage').classList.add('active'); updateGroupDisplay(); });
  bind('backBtn', function(){ playClickSound(); document.getElementById('profilePage').classList.remove('active'); });
  bind('copyUserCode', function(){ playClickSound(); copyToClipboard(document.getElementById('userCode').textContent, 'کپی شد'); });
  bind('openAvatarShop', function(){ playClickSound(); document.getElementById('profilePage').classList.remove('active'); document.getElementById('avatarShopPage').classList.add('active'); renderAvatars(); });
  bind('shopBackBtn', function(){ playClickSound(); document.getElementById('avatarShopPage').classList.remove('active'); document.getElementById('profilePage').classList.add('active'); });
  bind('templateBackBtn', function(){ playClickSound(); document.getElementById('templateShopPage').classList.remove('active'); document.getElementById('profilePage').classList.add('active'); });
  bind('editNameBtn', changeUsername);
  bind('navShop', function(){ playClickSound(); window.location.href='Safe Foroshgahe.html'; });
  bind('navGroup', function(){ playClickSound(); window.location.href='Safe Goroh.html'; });
  bind('btnAnnouncements', async function(){ playClickSound(); await loadNews(); document.getElementById('newsModal').classList.add('active'); });
  bind('btnHelp', function(){ playClickSound(); window.location.href='Amozesh.html'; });
  bind('btnTopPlayers', function(){ playClickSound(); window.location.href='Bandi.html'; });
  bind('btnManagement', function(){ playClickSound(); window.location.href='Modir.html'; });
  bind('btnLive', function(){ playClickSound(); showShopNotification('به زودی'); });
  bind('btnFriendly', function(){ playClickSound(); window.location.href='TalarDs.html'; });
  bind('btnCompetitive', function(){ playClickSound(); document.getElementById('competitiveOverlay').classList.add('active'); });
  bind('cancelSearchBtn', function(){ document.getElementById('competitiveOverlay').classList.remove('active'); });
  bind('enterGameBtn', function(){ window.location.href='Safe Game.html'; });
  bind('sendNewsBtn', sendNews);
  bind('btnBanUser', function(){ banUser('account'); });
  bind('btnBanDevice', function(){ banUser('device'); });
  bind('btnBanIP', function(){ banUser('ip'); });
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
  bind('modalCancelBtn', function(){ playClickSound(); document.getElementById('purchaseModal').classList.remove('show'); });
  bind('modalConfirmBtn', confirmPurchase);
  bind('openChangePasswordBtn', function(){ playClickSound(); closeModal('settingsModal'); document.getElementById('cpPhone').value = currentPhone || ''; document.getElementById('changePasswordModal').classList.add('active'); });
  bind('btnWhitelistIP', function(){ document.getElementById('whitelistSection').style.display='block'; document.getElementById('usersSection').style.display='none'; document.getElementById('userHistorySection').style.display='none'; document.getElementById('userControlSection').style.display='none'; refreshWhitelistUI(); });
  bind('btnShowUsersList', function(){ document.getElementById('usersSection').style.display='block'; document.getElementById('userHistorySection').style.display='none'; document.getElementById('userControlSection').style.display='none'; document.getElementById('whitelistSection').style.display='none'; loadUsers(); });
  bind('btnUserControl', function(){ document.getElementById('userControlSection').style.display='block'; document.getElementById('usersSection').style.display='none'; document.getElementById('userHistorySection').style.display='none'; document.getElementById('whitelistSection').style.display='none'; });

  /* دکمه ادمین */
  var btnAdmin = document.getElementById('btnAdmin');
  if (btnAdmin) {
    btnAdmin.onclick = function(e) {
      if (e) { e.preventDefault(); e.stopPropagation(); }
      playClickSound();
      openAdminPanel();
      return false;
    };
  }

  /* دکمه تغییر رمز */
  bind('submitPasswordChange', async function() {
    playClickSound();
    var p = document.getElementById('cpPhone').value.trim();
    var cp = document.getElementById('cpCurrentPass').value;
    var np = document.getElementById('cpNewPass').value;
    if (!p || !cp || !np) { showShopNotification('فیلدها را پر کنید', 'error'); return; }
    if (p !== currentPhone) { showShopNotification('شماره مطابقت ندارد', 'error'); return; }
    if (currentUserData.password && currentUserData.password !== cp) { showShopNotification('رمز فعلی اشتباه', 'error'); return; }
    currentUserData.password = np;
    await saveUserData();
    closeModal('changePasswordModal');
    showShopNotification('رمز تغییر کرد');
  });

  /* تب‌های ادمین */
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

  /* تب‌های shop */
  document.querySelectorAll('.shop-tab').forEach(function(t) {
    t.addEventListener('click', function() {
      playClickSound();
      var tab = this.dataset.shoptab;
      document.querySelectorAll('.shop-tab').forEach(function(x) { x.classList.remove('active'); });
      document.querySelectorAll('.shop-tab[data-shoptab="' + tab + '"]').forEach(function(x) { x.classList.add('active'); });
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

  /* slider صدا */
  var vs = document.getElementById('gameVolumeSlider');
  if (vs) vs.addEventListener('input', function() {
    var bg = document.getElementById('bgMusic');
    if (bg) bg.volume = this.value / 100;
  });

  console.log('✅ Safe Asli.js loaded - admin ready');
});

document.addEventListener('visibilitychange', async function() {
  if (document.hidden) setUserOnlineStatus(false);
  else { setUserOnlineStatus(true); await checkWhitelistNow(); await syncWithServerInBackground(); }
});

window.addEventListener('beforeunload', function() {
  if (currentPhone) { try { setFBOnline(currentPhone, false, {}); } catch(e) {} }
});

/* expose */
window.closeModal = closeModal;
window.closeAdminModal = closeAdminModal;
window.closeEditUser = closeEditUser;
window.closeUserHistory = closeUserHistory;
window.openUserHistory = openUserHistory;
window.openEditUser = openEditUser;
window.openAdminPanel = openAdminPanel;
window.loadUsers = loadUsers;
window.loadAdminUsers = loadUsers;
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
window.resetAllUserCodes = resetAllUserCodes;
window.markNewsAsRead = markNewsAsRead;
window.sendNews = sendNews;
window.loadNews = loadNews;
window.updateUIWithData = updateUIWithData;
window.playClickSound = playClickSound;