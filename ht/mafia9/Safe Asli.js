/* ============================================================ */
/*  فایل: Safe Asli.js                                          */
/*  منطق کامل صفحه اصلی بازی - با سیستم وایت‌لیست IP            */
/* ============================================================ */

// ============================================================
//  اتصال به Redis
// ============================================================
const UPSTASH_OLD_URL = "https://smooth-werewolf-200782.upstash.io";
const UPSTASH_OLD_TOKEN = "gQAAAAAAAxBOAAIgcDFjN2NiMjYxOWNlNjE0NzgyOTExM2JjMjA5ZTc0MjVjMA";
const UPSTASH_NEW_URL = "https://holy-hamster-122717.upstash.io";
const UPSTASH_NEW_TOKEN = "gQAAAAAAAd9dAAIgcDFlNmYwM2VkZDJiM2Y0YWI2ODBmNmIyMTZjMmRkMTZmNg";

async function upstashGet(url, token, k) {
  try {
    const c = new AbortController(); const t = setTimeout(() => c.abort(), 5000);
    const r = await fetch(url + '/get/' + encodeURIComponent(k), { headers: { 'Authorization': 'Bearer ' + token }, signal: c.signal, cache: 'no-store' });
    clearTimeout(t); if (!r.ok) return null;
    const d = await r.json();
    if (d && d.result) { try { return JSON.parse(d.result); } catch (e) { return d.result; } }
    return null;
  } catch (e) { return null; }
}
async function upstashSet(url, token, k, v) {
  try {
    const jsonValue = JSON.stringify(v);
    const c = new AbortController(); const t = setTimeout(() => c.abort(), 5000);
    const r = await fetch(url + '/set/' + encodeURIComponent(k) + '/' + encodeURIComponent(jsonValue), { headers: { 'Authorization': 'Bearer ' + token }, signal: c.signal });
    clearTimeout(t); return r.ok;
  } catch (e) { return false; }
}
async function upstashDel(url, token, k) {
  try {
    const c = new AbortController(); const t = setTimeout(() => c.abort(), 5000);
    const r = await fetch(url + '/del/' + encodeURIComponent(k), { method: 'POST', headers: { 'Authorization': 'Bearer ' + token }, signal: c.signal });
    clearTimeout(t); return r.ok;
  } catch (e) { return false; }
}
async function redisGet(key) {
  let v = await upstashGet(UPSTASH_OLD_URL, UPSTASH_OLD_TOKEN, key);
  if (v !== null) return v;
  return await upstashGet(UPSTASH_NEW_URL, UPSTASH_NEW_TOKEN, key);
}
async function redisSet(key, value) {
  const p1 = upstashSet(UPSTASH_OLD_URL, UPSTASH_OLD_TOKEN, key, value);
  const p2 = upstashSet(UPSTASH_NEW_URL, UPSTASH_NEW_TOKEN, key, value);
  const results = await Promise.allSettled([p1, p2]);
  return results.some(r => r.status === 'fulfilled' && r.value === true);
}
async function redisDel(key) {
  await Promise.allSettled([
    upstashDel(UPSTASH_OLD_URL, UPSTASH_OLD_TOKEN, key),
    upstashDel(UPSTASH_NEW_URL, UPSTASH_NEW_TOKEN, key)
  ]);
  return true;
}
async function redisIncr(key) {
  let val = await redisGet(key); let num = parseInt(val) || 0; num++;
  await redisSet(key, num); return num;
}

// ============================================================
//  توابع پایه
// ============================================================
const CREATOR_PHONE='09904844031';
async function getUser(p){return await redisGet('user:'+p);}
async function saveUser(p,u){return await redisSet('user:'+p,u);}
async function getAllUsers(){return await redisGet('all_users')||{};}
async function saveAllUsers(u){return await redisSet('all_users',u);}
async function getGroups(){return await redisGet('police_groups')||[];}
async function getBanStatus(p){const b=await redisGet('ban:'+p);if(b&&b.isBanned){if(b.expiresAt&&b.duration!=='permanent'&&b.duration!=='دائمی'){if(new Date(b.expiresAt).getTime()<Date.now())return null;}return b;}return null;}
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
async function incrementUserCodeCounter(){return await redisIncr('user_code_counter');}
async function addBanLog(phone, banData) {
  let user = await getUser(phone); if (!user) return;
  if (!user.banHistory) user.banHistory = [];
  user.banHistory.push(banData);
  if (user.banHistory.length > 50) user.banHistory.shift();
  await saveUser(phone, user);
}

// ============================================================
//  وایت‌لیست IP - بدون کش، مستقیم از سرور
// ============================================================
async function getAllWhitelistIPs() {
  var list = await redisGet('whitelist_ips') || {};
  return list;
}

async function isIPWhitelisted(ip, deviceId) {
  if (!ip && !deviceId) return false;
  try {
    var list = await getAllWhitelistIPs();
    var cleanIP = ip ? String(ip).trim() : '';
    var cleanDev = deviceId ? String(deviceId).trim() : '';
    
    if (cleanIP && list[cleanIP]) return true;
    if (cleanDev && list[cleanDev]) return true;
    if (cleanDev && list['dev_' + cleanDev]) return true;
    
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

function showWhitelistBadge(show) {
  // بج حذف شده
  return;
}

// ============================================================
//  دریافت IP - بدون کش، با چند API
// ============================================================
async function fetchUserIP(forceRefresh) {
  try {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), 3000);
    const res = await fetch('https://api.ipify.org?format=json', { signal: c.signal, cache: 'no-store' });
    clearTimeout(t);
    if (res.ok) {
      const data = await res.json();
      if (data && data.ip) return String(data.ip).trim();
    }
  } catch(e) {}
  
  try {
    const c2 = new AbortController();
    const t2 = setTimeout(() => c2.abort(), 3000);
    const res2 = await fetch('https://api64.ipify.org?format=json', { signal: c2.signal, cache: 'no-store' });
    clearTimeout(t2);
    if (res2.ok) {
      const data2 = await res2.json();
      if (data2 && data2.ip) return String(data2.ip).trim();
    }
  } catch(e) {}
  
  return null;
}

// ============================================================
//  شناسه دستگاه
// ============================================================
function getDeviceId() {
  let id = localStorage.getItem('__device_id__');
  if (!id) {
    var parts = [
      navigator.userAgent || 'ua', navigator.platform || 'plat',
      screen.width + 'x' + screen.height, screen.colorDepth || 24,
      navigator.language || 'fa', navigator.hardwareConcurrency || 4,
      new Date().getTimezoneOffset()
    ];
    var raw = parts.join('|'); var hash = 0;
    for (var i = 0; i < raw.length; i++) { hash = ((hash << 5) - hash) + raw.charCodeAt(i); hash = hash & hash; }
    id = 'dev_' + Math.abs(hash) + '_' + Date.now().toString(36);
    localStorage.setItem('__device_id__', id);
  }
  return id;
}

// ============================================================
//  متغیرهای عمومی
// ============================================================
let isRedirecting=false;
function redirectToOffline(){if(isRedirecting)return;isRedirecting=true;window.location.href='off.html';}
function redirectToBan(b,p){if(isRedirecting)return;isRedirecting=true;const params=new URLSearchParams({phone:p,by:b.bannedBy||'مدیریت',reason:b.reason||'بدون دلیل',duration:b.duration||'1d',expires:b.expiresAt||'',createdAt:b.createdAt||b.bannedAt||''});window.location.href='Ban.html?'+params.toString();}
window.addEventListener('offline',()=>{if(!isRedirecting)redirectToOffline();});

function toPersianNum(n){const p=['۰','۱','۲','۳','۴','۵','۶','۷','۸','۹'];return String(n).replace(/[0-9]/g,w=>p[+w]);}

function getRoleTick(role){if(!role)return null;const r=role.trim();if(r==='سازنده'||r==='پشتیبانی')return['Tik1.png'];if(r==='ادمین ارشد')return['Tik1000.png'];if(r==='ادمین')return['Tik2.png'];if(r==='گرداننده')return['Tik3.png'];if(r==='ناظر'||r==='ناظر ارشد')return['TIK4.png','Tik4.png'];return null;}
function applyTick(img,cands){if(!img||!cands||!cands.length)return;let i=0;(function nx(){if(i>=cands.length){img.style.display='none';return;}const s=cands[i++];const t=new Image();t.onload=function(){img.src=s;img.style.display='inline-block';};t.onerror=nx;t.src=s;})();}

const RANK_LEVEL={'کاربر':0,'ناظر':1,'ناظر ارشد':2,'ادمین':3,'ادمین ارشد':4,'گرداننده':5,'پشتیبانی':6,'سازنده':7};
const RANK_PERM={
  'سازنده':   {panel:true, coins:true, gems:true, dollars:true, rank:true, exclusive:true, del:true, server:true, wipe:true, banMax:'permanent', stats:true, ipControl:true, userControl:true, whitelist:true},
  'پشتیبانی': {panel:true, coins:false,gems:false,dollars:false,rank:false,exclusive:false,del:false,server:false,wipe:false,banMax:'3m', stats:false, ipControl:false, userControl:false, whitelist:false},
  'ادمین ارشد':{panel:true, coins:true, gems:true, dollars:true, rank:true, exclusive:false,del:false,server:false,wipe:false,banMax:'1m', stats:true, ipControl:true, userControl:true, whitelist:false},
  'گرداننده': {panel:true, coins:true, gems:true, dollars:true, rank:true, exclusive:false,del:false,server:false,wipe:false,banMax:'3m', stats:true, ipControl:false, userControl:false, whitelist:false}
};
const BAN_OPTIONS=[['1h','۱ ساعت'],['1d','۱ روز'],['7d','۷ روز'],['2w','۲ هفته'],['1m','۱ ماه'],['3m','۳ ماه'],['8m','۸ ماه'],['permanent','دائمی']];
const DUR_MS={'1h':3600000,'1d':86400000,'7d':604800000,'2w':1209600000,'1m':2592000000,'3m':7776000000,'8m':20736000000,'permanent':0};

function getPerm(){
  const rank=(currentUserData&&currentUserData.rank)||'کاربر';
  const isCreator=(currentPhone===CREATOR_PHONE)||rank==='سازنده';
  if(isCreator)return RANK_PERM['سازنده'];
  return RANK_PERM[rank]||{panel:false};
}
function fillBanOptions(max){
  const order=BAN_OPTIONS.map(o=>o[0]);
  const idx=order.indexOf(max);
  const sel=document.getElementById('editBanDuration');
  sel.innerHTML='';
  BAN_OPTIONS.forEach((o,i)=>{ if(idx<0||i<=idx){const op=document.createElement('option');op.value=o[0];op.textContent=o[1];sel.appendChild(op);} });
  sel.selectedIndex=sel.options.length-1;
}

const GROUP_ICONS = {
  shield: '<svg viewBox="0 0 24 24"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/></svg>',
  lion: '<svg viewBox="0 0 24 24"><path d="M7 4c-1.1 0-2 .9-2 2v1c-1.1 0-2 .9-2 2v7c0 2.76 2.24 5 5 5h8c2.76 0 5-2.24 5-5V9c0-1.1-.9-2-2-2V6c0-1.1-.9-2-2-2H7z"/></svg>',
  eagle: '<svg viewBox="0 0 24 24"><path d="M18 4l-2 2H8L6 4H2v2l2.5 1c-.83 1.2-1.5 2.68-1.5 4.5C3 15 5 18 8 19l2 2v1h4v-1l2-2c3-1 5-4 5-7.5 0-1.82-.67-3.3-1.5-4.5L22 6V4h-4z"/></svg>',
  dragon: '<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/></svg>',
  skull: '<svg viewBox="0 0 24 24"><path d="M12 2C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7z"/></svg>',
  fire: '<svg viewBox="0 0 24 24"><path d="M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67z"/></svg>',
  crown: '<svg viewBox="0 0 24 24"><path d="M12 1L9 9l-7 3 2 9h16l2-9-7-3-3-8z"/></svg>',
  star: '<svg viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>'
};
function getGroupIcon(key){return GROUP_ICONS[key]||GROUP_ICONS.shield;}

let currentUserData=null,currentPhone=null,editingUserId=null;
let editingUserExclusiveAvatar=null;
let shopGold=0,shopGems=0,shopDollars=0,selectedAvatar=null,purchasePrice=0,currentAvatarSection='my';
let userGroupCache=null;
let pauseSync = false;
let videoObserver = null;
let myIP = null;

const avatars=[
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

window.avatarLoadError=function(img,src){img.style.display='none';const box=img.parentElement;if(box&&!box.querySelector('.avatar-missing')){const d=document.createElement('div');d.className='avatar-missing';d.innerHTML='❌<br>'+src;box.appendChild(d);}};

function setupVideoObserver() {
  if (videoObserver) return;
  videoObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const v = entry.target;
      if (entry.isIntersecting) { if (v.paused) v.play().catch(()=>{}); }
      else { if (!v.paused) v.pause(); }
    });
  }, { threshold: 0.1 });
}
function observeVideos(container) {
  setupVideoObserver();
  container.querySelectorAll('video').forEach(v => videoObserver.observe(v));
}

function sanitizeUserData(user, phone) {
  if (!user) return user;
  const isCreator = (phone === CREATOR_PHONE);
  if (user.avatar === '655.webm' && !isCreator) user.avatar = user.previousAvatar || 'Mafia2.png';
  if (user.exclusiveAvatar === '655.webm' && !isCreator) {
    delete user.exclusiveAvatar;
    if (user.ownedAvatars) user.ownedAvatars = user.ownedAvatars.filter(a => a !== 'ex_655.webm');
  }
  if (user.coins < 0) user.coins = 0;
  if (user.gems < 0) user.gems = 0;
  if (user.dollars < 0) user.dollars = 0;
  if (user.cups === undefined) user.cups = 0;
  if (user.hours === undefined) user.hours = 0;
  const xp = Math.floor((user.cups / 10) * 20 + (user.hours || 0) * 100);
  user.xp = xp;
  let level = 1;
  if (xp >= 1000) { level = 2 + Math.floor((xp - 3000) / 1000); if (level < 2) level = 2; if (level > 100) level = 100; }
  user.level = level;
  return user;
}

function getValidAvatar(src, phone) {
  const isCreator = (phone === CREATOR_PHONE);
  if (src === '655.webm' && !isCreator) return 'Mafia2.png';
  return src;
}

function createMediaElement(src) {
  const isVideo = src.endsWith('.webm') || src.endsWith('.mp4') || src.endsWith('.mov');
  if (isVideo) {
    const v = document.createElement('video');
    v.src = src; v.autoplay = true; v.loop = true; v.muted = true; v.playsInline = true;
    v.preload = 'metadata';
    v.setAttribute('muted', 'muted');
    v.setAttribute('playsinline', 'playsinline');
    v.setAttribute('webkit-playsinline', 'webkit-playsinline');
    v.style.objectFit = 'cover';
    return v;
  } else {
    const i = document.createElement('img');
    i.src = src;
    i.onerror = function(){ this.style.display='none'; };
    return i;
  }
}

function updateGlobalAvatar(src) {
  const validSrc = getValidAvatar(src, currentPhone);
  const mainContainer = document.getElementById('mainAvatarContainer');
  const profileContainer = document.getElementById('openAvatarShop');
  const showcaseContainer = document.getElementById('showcaseAvatarContainer');
  if(mainContainer) { mainContainer.innerHTML = ''; mainContainer.appendChild(createMediaElement(validSrc)); observeVideos(mainContainer); }
  if(profileContainer) { profileContainer.innerHTML = ''; profileContainer.appendChild(createMediaElement(validSrc)); observeVideos(profileContainer); }
  if(showcaseContainer) { showcaseContainer.innerHTML = ''; showcaseContainer.appendChild(createMediaElement(validSrc)); observeVideos(showcaseContainer); }
}

function updateUIWithData(user) {
  document.getElementById('displayCoins').textContent = toPersianNum(user.coins || 0);
  document.getElementById('displayGems').textContent = toPersianNum(user.gems || 0);
  document.getElementById('displayDollars').textContent = toPersianNum(user.dollars || 0);
  document.getElementById('mainUserName').textContent = user.name || 'کاربر';
  document.getElementById('profileUserName').textContent = user.name || 'کاربر';
  document.getElementById('userCode').textContent = toPersianNum(user.userCode || '----');
  document.getElementById('statLevel').textContent = toPersianNum(user.level || 1);
  document.getElementById('statScore').textContent = toPersianNum(user.xp || 0);
  document.getElementById('statHours').textContent = toPersianNum(user.hours || 0);
  document.getElementById('statCompWins').textContent = toPersianNum(user.compWins || 0);
  document.getElementById('statFriendWins').textContent = toPersianNum(user.friendWins || 0);
  document.getElementById('statMonitor').textContent = toPersianNum(user.monitorCount || 0);
  document.getElementById('statBestScore').textContent = toPersianNum(user.bestScore || 0);
  document.getElementById('statMafiaWins').textContent = toPersianNum(user.mafiaWins || 0);
  document.getElementById('statCitizenWins').textContent = toPersianNum(user.citizenWins || 0);

  updateClanRank();
  updateGlobalAvatar(user.avatar || 'Mafia2.png');
  const tk = getRoleTick(user.rank);
  if(tk){applyTick(document.getElementById('mainUserTick'), tk); applyTick(document.getElementById('profileUserTick'), tk);}

  const perm = getPerm();
  document.getElementById('btnAdmin').style.display = perm.panel ? 'flex' : 'none';
  document.getElementById('adminTools').style.display = perm.server ? 'block' : 'none';
  document.getElementById('tournamentConfig').style.display = (currentPhone === CREATOR_PHONE) ? 'block' : 'none';
  document.getElementById('btnUserControl').style.display = perm.userControl ? 'block' : 'none';
  document.getElementById('btnWhitelistIP').style.display = perm.whitelist ? 'block' : 'none';
}

async function updateClanRank() {
  const el = document.getElementById('statClanRank');
  if (!el) return;
  try {
    if (!currentPhone) { el.textContent = '-'; return; }
    const groups = await getGroups();
    if (!groups.length) { el.textContent = '-'; return; }
    const allUsers = await getAllUsers();
    const groupsWithStats = groups.map(g => {
      let totalPoints = parseInt(g.extraPoints) || 0;
      if (g.members) g.members.forEach(m => { const u = allUsers[m]; if (u) totalPoints += ((parseInt(u.cups) || 0) * 2) + ((parseInt(u.hours) || 0) * 20); });
      return { id: g.id, points: totalPoints };
    });
    groupsWithStats.sort((a,b) => b.points - a.points);
    let myGroupId = null;
    for (const g of groups) {
      if (g.owner === currentPhone || (g.members && g.members.includes(currentPhone)) || (g.deputies && g.deputies.includes(currentPhone))) { myGroupId = g.id; break; }
    }
    if (!myGroupId) { el.textContent = '-'; return; }
    const rank = groupsWithStats.findIndex(g => g.id === myGroupId) + 1;
    el.textContent = rank > 0 ? toPersianNum(rank) : '-';
  } catch(e) { el.textContent = '-'; }
}

async function saveUserData(){
  if(!currentUserData||!currentPhone)return;
  if(pauseSync) return;
  if(document.getElementById('adminModal').classList.contains('active')) return;
  if(document.getElementById('editUserModal').classList.contains('active')) return;
  currentUserData = sanitizeUserData(currentUserData, currentPhone);
  localStorage.setItem('user_cache_' + currentPhone, JSON.stringify(currentUserData));
  await saveUser(currentPhone,currentUserData);
  const allUsers=await getAllUsers();
  allUsers[currentPhone]=currentUserData;
  await saveAllUsers(allUsers);
}

async function saveAvatarToStorage(src){
  if(!currentUserData||!currentPhone)return;
  const isCreator = (currentPhone === CREATOR_PHONE);
  if (src === '655.webm' && !isCreator) { showShopNotification('این آواتار فقط مخصوص سازنده است!', 'error'); return; }
  if (currentUserData.avatar && currentUserData.avatar !== src) currentUserData.previousAvatar = currentUserData.avatar;
  currentUserData.avatar = src;
  await saveUserData();
  updateGlobalAvatar(currentUserData.avatar);
}

async function changeUsername(){
  const nn=prompt("نام کاربری جدید را وارد کنید (حداکثر ۲۰ کاراکتر):");
  if(nn && nn.trim()!==""){
    const trimmedName = nn.trim();
    if(trimmedName.length > 20) { showShopNotification('نام کاربری نمی‌تواند بیشتر از ۲۰ کاراکتر باشد!', 'error'); return; }
    if(currentUserData.coins>=100){
      currentUserData.coins-=100; currentUserData.name=trimmedName;
      await saveUserData(); updateUIWithData(currentUserData);
      showShopNotification('نام کاربری تغییر کرد و ۱۰۰ سکه کسر شد');
    } else showShopNotification('سکه کافی ندارید! (۱۰۰ سکه)','error');
  }
}

function copyToClipboard(t,m){navigator.clipboard.writeText(t).then(()=>showShopNotification(m||'کپی شد!')).catch(()=>{const ta=document.createElement('textarea');ta.value=t;document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta);showShopNotification(m||'کپی شد!');});}
function closeModal(id){document.getElementById(id).classList.remove('active');}
function closeEditUser(){document.getElementById('editUserModal').classList.remove('active');editingUserId=null;editingUserExclusiveAvatar=null; pauseSync = false;}
function closeAdminModal(){document.getElementById('adminModal').classList.remove('active'); pauseSync = false;}
function showShopNotification(m,t){const n=document.getElementById('shopNotification');n.textContent=m;n.className='shop-notification show'+(t==='error'?' error':'');setTimeout(()=>n.classList.remove('show'),3000);}

async function findUserGroup(phone){
  try{
    const groups=await getGroups();
    for(const g of groups){
      if(!g)continue;
      if(g.owner===phone)return g;
      if(g.members&&g.members.includes(phone))return g;
      if(g.deputies&&g.deputies.includes(phone))return g;
    }
    return null;
  }catch(e){return null;}
}

async function updateGroupDisplay(){
  const nameEl=document.getElementById('profileGroupName');
  const badgeEl=document.getElementById('profileGroupBadge');
  if(!nameEl||!badgeEl)return;
  try{
    nameEl.textContent='در حال بارگذاری...';
    badgeEl.className='clan-badge no-group';
    badgeEl.innerHTML='❌';
    if(!currentPhone)return;
    const group=await findUserGroup(currentPhone);
    if(group){
      nameEl.textContent=group.name||'گروه';
      badgeEl.className='clan-badge has-group';
      if(group.logo && (group.logo.endsWith('.webp') || group.logo.endsWith('.png') || group.logo.endsWith('.jpg') || group.logo.endsWith('.jpeg'))) {
          badgeEl.innerHTML = `<img src="${group.logo}" style="width:100%;height:100%;object-fit:contain;padding:4px;" onerror="this.style.display='none';this.parentElement.innerHTML='${getGroupIcon('shield').replace(/"/g, "&quot;")}'">`;
      } else { badgeEl.innerHTML = getGroupIcon(group.logo||'shield'); }
      userGroupCache=group;
    }else{
      nameEl.textContent='بدون گروه'; badgeEl.className='clan-badge no-group'; badgeEl.innerHTML='❌'; userGroupCache=null;
    }
    await updateClanRank();
  }catch(e){ nameEl.textContent='بدون گروه'; badgeEl.className='clan-badge no-group'; badgeEl.innerHTML='❌'; }
}

function compressImage(file,maxSize,cb){
  const reader=new FileReader();
  reader.onload=function(evt){
    const img=new Image();
    img.onload=function(){
      let w=img.width,h=img.height;
      if(w>maxSize||h>maxSize){ const ratio=Math.min(maxSize/w,maxSize/h); w=Math.round(w*ratio);h=Math.round(h*ratio); }
      const canvas=document.createElement('canvas'); canvas.width=w;canvas.height=h;
      const ctx=canvas.getContext('2d'); ctx.drawImage(img,0,0,w,h);
      cb(canvas.toDataURL('image/jpeg',0.85));
    };
    img.src=evt.target.result;
  };
  reader.readAsDataURL(file);
}

async function loadNews(){
  const news=await getNews();
  const list=document.getElementById('newsList');
  const area=document.getElementById('newsCreatorArea');
  const badge=document.getElementById('newsBadge');
  if(currentUserData&&(currentUserData.rank==='سازنده'||currentPhone===CREATOR_PHONE))area.style.display='block';
  const key='user_read_news_'+currentPhone;
  const read=JSON.parse(localStorage.getItem(key)||'[]');
  const unread=news.filter(n=>!read.includes(n.id)).length;
  if(unread>0){badge.textContent=toPersianNum(unread);badge.style.display='flex';}else badge.style.display='none';
  if(!news.length){list.innerHTML='<div style="text-align:center;color:rgba(255,255,255,.6);padding:20px;">هیچ اطلاعیه‌ای وجود ندارد</div>';return;}
  list.innerHTML=news.slice().reverse().map(it=>'<div class="news-item" onclick="markNewsAsRead('+it.id+')"><div class="news-title">'+it.title+'</div><div class="news-content">'+it.content+'</div><div class="news-date">'+it.date+' - '+(it.sender||'مدیریت')+'</div></div>').join('');
}
function markNewsAsRead(id){const key='user_read_news_'+currentPhone;const read=JSON.parse(localStorage.getItem(key)||'[]');if(!read.includes(id)){read.push(id);localStorage.setItem(key,JSON.stringify(read));loadNews();}}
async function sendNews(){
  const t=document.getElementById('newsTitleInput').value.trim();
  const c=document.getElementById('newsContentInput').value.trim();
  if(!t||!c){showShopNotification('عنوان و متن را وارد کنید','error');return;}
  const news=await getNews();
  news.push({id:Date.now(),title:t,content:c,date:new Date().toLocaleDateString('fa-IR'),sender:currentUserData.name});
  await saveNews(news);
  document.getElementById('newsTitleInput').value=''; document.getElementById('newsContentInput').value='';
  await loadNews(); showShopNotification('اطلاعیه ارسال شد');
}

// ============================================================
//  مدیریت کاربران
// ============================================================
let currentAdminTab = 'all';
let currentUserList = [];
let viewingUserHistory = null;

async function loadAdminUsers() {
  const allUsers = await getAllUsers();
  const list = Object.entries(allUsers).map(([phone, u]) => ({ phone, ...u }));
  currentUserList = list;
  renderAdminUsers(list);
}

function renderAdminUsers(list) {
  const container = document.getElementById('adminUserListContainer');
  const searchVal = document.getElementById('userSearchInput').value.trim();
  let filtered = list;
  if (searchVal) filtered = filtered.filter(u => String(u.userCode) === searchVal);
  if (currentAdminTab === 'online') filtered = filtered.filter(u => u.online === true);
  else if (currentAdminTab === 'offline') filtered = filtered.filter(u => u.online === false || u.online === undefined);
  else if (currentAdminTab === 'banned') filtered = filtered.filter(u => u.banned === true);
  else if (currentAdminTab === 'reports') filtered = filtered.filter(u => u.reportHistory && u.reportHistory.length > 0);
  else if (currentAdminTab === 'lobby') filtered = filtered.filter(u => u.lobbyRequests && u.lobbyRequests.length > 0);

  if (!filtered.length) { container.innerHTML = '<div style="color:#aaa;padding:20px;text-align:center;">کاربری یافت نشد</div>'; return; }
  container.innerHTML = filtered.map(u => {
    const statusClass = u.banned ? 'status-banned' : (u.online ? 'status-online' : 'status-offline');
    const statusText = u.banned ? 'بن شده' : (u.online ? 'آنلاین' : 'آفلاین');
    return `<div class="admin-user-item" onclick="openUserHistory('${u.phone}')">
      <div class="info">
        <span class="name">${u.name || 'کاربر'} (کد: ${toPersianNum(u.userCode) || '----'})</span>
        <span class="detail">${u.phone} | ${u.rank || 'کاربر'}</span>
        <span class="detail">IP: ${u.lastIP || '-'} | سطح: ${toPersianNum(u.level||1)}</span>
      </div>
      <span class="status ${statusClass}">${statusText}</span>
    </div>`;
  }).join('');
}

async function openUserHistory(phone) {
  viewingUserHistory = phone;
  const user = await getUser(phone);
  if (!user) return;
  document.getElementById('usersSection').style.display = 'none';
  document.getElementById('userHistorySection').style.display = 'block';
  document.getElementById('historyUserName').textContent = user.name || 'کاربر';
  const content = document.getElementById('historyContent');
  let html = `<div style="color:#fff;font-size:13px;margin-bottom:8px;">اطلاعات کاربر:</div>
    <div style="color:#ccc;font-size:12px;background:rgba(255,255,255,.05);padding:10px;border-radius:8px;margin-bottom:8px;">
      <div>کد کاربری: ${toPersianNum(user.userCode) || '----'}</div>
      <div>شماره: ${phone}</div>
      <div>مقام: ${user.rank || 'کاربر'}</div>
      <div>سکه: ${toPersianNum(user.coins||0)} | الماس: ${toPersianNum(user.gems||0)} | دولار: ${toPersianNum(user.dollars||0)}</div>
      <div>ساعت: ${toPersianNum(user.hours||0)} | کاپ: ${toPersianNum(user.cups||0)} | XP: ${toPersianNum(user.xp||0)}</div>
      <div>سطح: ${toPersianNum(user.level||1)} | برد امتیازی: ${toPersianNum(user.compWins||0)}</div>
      <div>وضعیت: ${user.banned ? 'بن شده' : (user.online ? 'آنلاین' : 'آفلاین')}</div>
      <div style="color:#4fc3f7;font-weight:900;direction:ltr;">آخرین IP: ${user.lastIP || 'نامشخص'}</div>
      <div style="color:#4fc3f7;font-weight:900;font-size:11px;direction:ltr;word-break:break-all;">دستگاه: ${user.lastDevice || 'نامشخص'}</div>
    </div>
    <button class="edit-btn save" onclick="quickWhitelistUser('${user.lastIP || ''}', '${user.lastDevice || ''}', '${user.name || ''}')" style="width:100%;margin-bottom:8px;background:linear-gradient(180deg,#4caf50,#2e7d32);">🌟 افزودن IP این کاربر به وایت‌لیست</button>`;

  if (user.loginHistory && user.loginHistory.length) {
    html += `<div style="color:#fff;font-size:13px;margin:8px 0;">تاریخچه ورودها (${toPersianNum(user.loginHistory.length)}):</div>`;
    html += user.loginHistory.slice().reverse().slice(0, 30).map(s => `
      <div class="admin-session-item">
        <span>${new Date(s.time).toLocaleString('fa-IR')}</span>
        <span style="color:#4fc3f7;">IP: ${s.ip || '-'}</span>
      </div>
    `).join('');
    html += `<button class="edit-btn danger" onclick="clearUserSessions('${phone}')" style="width:100%;margin-top:8px;">🗑️ پاک کردن تاریخچه ورود</button>`;
  }

  if (user.banHistory && user.banHistory.length) {
    html += `<div style="color:#fff;font-size:13px;margin:8px 0;">تاریخچه بن:</div>`;
    html += user.banHistory.slice().reverse().map(b => `
      <div class="admin-session-item">
        <span>${new Date(b.time).toLocaleString('fa-IR')}</span>
        <span>توسط: ${b.by || 'سیستم'}</span>
        <span>نوع: ${b.type || 'اکانت'}</span>
      </div>
    `).join('');
  }

  html += `<button class="edit-btn save" onclick="openEditUser('${phone}')" style="width:100%;margin-top:12px;">✏️ ویرایش کامل کاربر</button>`;
  content.innerHTML = html;
}

async function quickWhitelistUser(ip, deviceId, userName) {
  if (!ip && !deviceId) { showShopNotification('اطلاعات این کاربر موجود نیست', 'error'); return; }
  var confirmMsg = `افزودن به وایت‌لیست:\n`;
  if (ip) confirmMsg += `IP: ${ip}\n`;
  if (deviceId) confirmMsg += `Device: ${deviceId}\n`;
  confirmMsg += `\nکاربر: ${userName}`;
  if (!confirm(confirmMsg)) return;
  
  var added = [];
  if (ip && ip !== 'نامشخص' && ip !== '-') {
    await addToWhitelist(ip, 'auto: ' + userName, currentPhone);
    added.push(ip);
  }
  if (deviceId && deviceId !== 'نامشخص' && deviceId !== '-') {
    await addToWhitelist(deviceId, 'auto-dev: ' + userName, currentPhone);
    added.push('دستگاه');
  }
  
  if (added.length > 0) {
    showShopNotification('✅ ' + added.join(' + ') + ' به وایت‌لیست اضافه شد');
  } else {
    showShopNotification('اطلاعات معتبر نبود', 'error');
  }
}

async function clearUserSessions(phone) {
  if (!confirm('آیا از پاک کردن کامل تاریخچه ورودهای این کاربر اطمینان دارید؟')) return;
  const user = await getUser(phone);
  if (!user) return;
  user.loginHistory = [];
  await saveUser(phone, user);
  const allUsers = await getAllUsers(); allUsers[phone] = user; await saveAllUsers(allUsers);
  showShopNotification('✅ تاریخچه ورود پاک شد');
  openUserHistory(phone);
}

function closeUserHistory() {
  document.getElementById('userHistorySection').style.display = 'none';
  document.getElementById('usersSection').style.display = 'block';
  loadAdminUsers();
}

async function setUserOnlineStatus(online) {
  if (!currentPhone) return;
  let user = await getUser(currentPhone);
  if (!user) return;
  user.online = online;
  user.lastSeen = Date.now();
  if (myIP) user.lastIP = myIP;
  if (currentDeviceId) user.lastDevice = currentDeviceId;
  await saveUser(currentPhone, user);
}

// ============================================================
//  کنترل کاربر
// ============================================================
async function forceUserLogin() {
  const phone = document.getElementById('controlUserPhone').value.trim();
  if (!phone) { showShopNotification('شماره موبایل را وارد کنید', 'error'); return; }
  const user = await getUser(phone);
  if (!user) { showShopNotification('کاربر یافت نشد', 'error'); return; }
  user.forceOnline = true; user.online = true;
  await saveUser(phone, user);
  const all = await getAllUsers(); all[phone] = user; await saveAllUsers(all);
  showShopNotification('✅ کاربر وارد بازی شد');
}
async function forceUserLogout() {
  const phone = document.getElementById('controlUserPhone').value.trim();
  if (!phone) { showShopNotification('شماره موبایل را وارد کنید', 'error'); return; }
  const user = await getUser(phone);
  if (!user) { showShopNotification('کاربر یافت نشد', 'error'); return; }
  user.forceOnline = false; user.online = false;
  await saveUser(phone, user);
  const all = await getAllUsers(); all[phone] = user; await saveAllUsers(all);
  showShopNotification('🚫 کاربر از بازی خارج شد');
}
async function clearUserData() {
  const phone = document.getElementById('controlUserPhone').value.trim();
  if (!phone) { showShopNotification('شماره موبایل را وارد کنید', 'error'); return; }
  if (!confirm('آیا از پاک‌سازی کامل داده‌های این کاربر اطمینان دارید؟')) return;
  const user = await getUser(phone);
  if (!user) { showShopNotification('کاربر یافت نشد', 'error'); return; }
  user.coins = 0; user.gems = 0; user.dollars = 0;
  user.cups = 0; user.hours = 0; user.xp = 0; user.level = 1;
  user.compWins = 0; user.friendWins = 0; user.monitorCount = 0;
  user.bestScore = 0; user.mafiaWins = 0; user.citizenWins = 0; user.score = 0;
  await saveUser(phone, user);
  const all = await getAllUsers(); all[phone] = user; await saveAllUsers(all);
  showShopNotification('🧹 داده‌های کاربر پاک شد');
}
async function clearUserSessionsFromPanel() {
  const phone = document.getElementById('controlUserPhone').value.trim();
  if (!phone) { showShopNotification('شماره موبایل را وارد کنید', 'error'); return; }
  if (!confirm('آیا از پاک کردن تاریخچه ورودهای این کاربر اطمینان دارید؟')) return;
  const user = await getUser(phone);
  if (!user) { showShopNotification('کاربر یافت نشد', 'error'); return; }
  user.loginHistory = [];
  await saveUser(phone, user);
  const all = await getAllUsers(); all[phone] = user; await saveAllUsers(all);
  showShopNotification('📜 تاریخچه ورود پاک شد');
}

// ============================================================
//  مدیریت وایت‌لیست
// ============================================================
async function refreshWhitelistUI() {
  const list = await getAllWhitelistIPs();
  const container = document.getElementById('whitelistItemsList');
  const ips = Object.keys(list);
  if (!ips.length) {
    container.innerHTML = '<div style="color:rgba(255,255,255,.5);font-size:11px;text-align:center;padding:8px;">لیست خالی است</div>';
    return;
  }
  container.innerHTML = ips.map(ip => {
    const info = list[ip] || {};
    const note = info.note ? ` - ${info.note}` : '';
    return `<div class="whitelist-item">
      <span style="direction:ltr;">${ip}${note}</span>
      <button onclick="removeWhitelistIP('${ip}')">حذف</button>
    </div>`;
  }).join('');
}

async function addWhitelistIP() {
  const ip = document.getElementById('whitelistIPInput').value.trim();
  const note = document.getElementById('whitelistNoteInput').value.trim();
  if (!ip) { showShopNotification('IP را وارد کنید', 'error'); return; }
  if (!/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip) && !/^dev_/.test(ip)) {
    if (!confirm('IP معتبر به نظر نمی‌رسد. ادامه می‌دهید؟')) return;
  }
  await addToWhitelist(ip, note, currentPhone);
  document.getElementById('whitelistIPInput').value = '';
  document.getElementById('whitelistNoteInput').value = '';
  showShopNotification('✅ IP به لیست سفید اضافه شد');
  refreshWhitelistUI();
}

async function removeWhitelistIP(ip) {
  if (!confirm('آیا از حذف این IP از لیست سفید اطمینان دارید؟')) return;
  await removeFromWhitelist(ip);
  showShopNotification('🗑️ IP از لیست سفید حذف شد');
  refreshWhitelistUI();
}

// ============================================================
//  رویدادهای پنل
// ============================================================
document.getElementById('btnWhitelistIP').addEventListener('click', function() {
  document.getElementById('whitelistSection').style.display = 'block';
  document.getElementById('usersSection').style.display = 'none';
  document.getElementById('userHistorySection').style.display = 'none';
  document.getElementById('userControlSection').style.display = 'none';
  refreshWhitelistUI();
});
document.getElementById('btnAddWhitelistIP').addEventListener('click', addWhitelistIP);

document.getElementById('btnShowUsersList').addEventListener('click', async function() {
  document.getElementById('usersSection').style.display = 'block';
  document.getElementById('userList').style.display = 'none';
  document.getElementById('userHistorySection').style.display = 'none';
  document.getElementById('userControlSection').style.display = 'none';
  document.getElementById('whitelistSection').style.display = 'none';
  await loadAdminUsers();
});
document.getElementById('btnUserControl').addEventListener('click', function() {
  document.getElementById('userControlSection').style.display = 'block';
  document.getElementById('usersSection').style.display = 'none';
  document.getElementById('userHistorySection').style.display = 'none';
  document.getElementById('whitelistSection').style.display = 'none';
});
document.getElementById('btnForceLogin').addEventListener('click', forceUserLogin);
document.getElementById('btnForceLogout').addEventListener('click', forceUserLogout);
document.getElementById('btnClearUserData').addEventListener('click', clearUserData);
document.getElementById('btnClearSessions').addEventListener('click', clearUserSessionsFromPanel);

document.querySelectorAll('.admin-tab').forEach(tab => {
  tab.addEventListener('click', function() {
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
    this.classList.add('active');
    currentAdminTab = this.dataset.tab;
    loadAdminUsers();
  });
});
document.getElementById('userSearchInput').addEventListener('input', function() { loadAdminUsers(); });

// ============================================================
//  ویرایش کاربر
// ============================================================
async function openEditUser(id){
  const perm=getPerm();
  if(!perm.panel){showShopNotification('دسترسی ندارید','error');return;}
  const allUsers=await getAllUsers();
  const u=allUsers[id];
  if(!u)return;
  const myLevel=RANK_LEVEL[(currentUserData.rank||'کاربر')]||0;
  const targetLevel=RANK_LEVEL[(u.rank||'کاربر')]||0;
  const isCreator=(currentPhone===CREATOR_PHONE)||(currentUserData.rank==='سازنده');
  if(!isCreator && targetLevel>=myLevel){showShopNotification('نمی‌توانید هم‌مقام یا بالاتر را ویرایش کنید','error');return;}

  editingUserId=id;
  pauseSync = true;
  if(u.exclusiveAvatar === '655.webm' && id !== CREATOR_PHONE) { editingUserExclusiveAvatar = null; u.exclusiveAvatar = null; }
  else { editingUserExclusiveAvatar = u.exclusiveAvatar || null; }

  document.getElementById('editUserName').value=u.name||'';
  document.getElementById('editUserCode').value=u.userCode||'';
  document.getElementById('editUserCoins').value=u.coins||0;
  document.getElementById('editUserGems').value=u.gems||0;
  document.getElementById('editUserDollars').value=u.dollars||0;
  document.getElementById('editUserRole').value=u.rank||'کاربر';
  document.getElementById('editUserCups').value=u.cups||0;
  document.getElementById('editUserHours').value=u.hours||0;
  document.getElementById('editUserLevel').value=u.level||1;
  document.getElementById('editUserCompWins').value=u.compWins||0;
  document.getElementById('editUserFriendWins').value=u.friendWins||0;
  document.getElementById('editUserMonitor').value=u.monitorCount||0;
  document.getElementById('editUserMafiaWins').value=u.mafiaWins||0;
  document.getElementById('editUserCitizenWins').value=u.citizenWins||0;
  document.getElementById('editUserBestScore').value=u.bestScore||0;

  const preview=document.getElementById('exclusiveAvatarPreview');
  if(u.exclusiveAvatar){
    if(u.exclusiveAvatar.endsWith('.webm') || u.exclusiveAvatar.endsWith('.mp4')) {
      preview.innerHTML='<video src="'+u.exclusiveAvatar+'" autoplay loop muted playsinline webkit-playsinline style="width:100%;height:100%;object-fit:cover;"></video>';
    } else {
      preview.innerHTML='<img src="'+u.exclusiveAvatar+'" alt="exclusive">';
    }
  } else { preview.innerHTML='<span class="exclusive-avatar-placeholder">👤</span>'; }

  document.getElementById('fieldCoins').style.display=perm.coins?'block':'none';
  document.getElementById('fieldGems').style.display=perm.gems?'block':'none';
  document.getElementById('fieldDollars').style.display=perm.dollars?'block':'none';
  document.getElementById('fieldRank').style.display=perm.rank?'block':'none';
  document.getElementById('fieldStats').style.display=perm.stats?'block':'none';
  document.getElementById('fieldExclusive').style.display=perm.exclusive?'block':'none';
  document.getElementById('rowDelete').style.display=perm.del?'flex':'none';
  document.getElementById('fieldBanType').style.display='block';
  fillBanOptions(perm.banMax||'1d');

  const bb=document.getElementById('btnBanUser');
  const ub=document.getElementById('btnUnbanUser');
  const bs=await getBanStatus(id);
  if(bs||u.banned){bb.style.display='none';ub.style.display='block';}else{bb.style.display='block';ub.style.display='none';}
  document.getElementById('editUserModal').classList.add('active');
}

document.addEventListener('DOMContentLoaded',()=>{
  const fileInput=document.getElementById('exclusiveAvatarFile');
  if(fileInput){
    fileInput.addEventListener('change',function(e){
      const file=e.target.files[0];
      if(!file)return;
      if(file.size>5*1024*1024){showShopNotification('حجم فایل باید کمتر از 5MB باشد','error');this.value='';return;}
      if(file.type.startsWith('video/')) {
          const url = URL.createObjectURL(file);
          editingUserExclusiveAvatar = url;
          document.getElementById('exclusiveAvatarPreview').innerHTML='<video src="'+url+'" autoplay loop muted playsinline webkit-playsinline style="width:100%;height:100%;object-fit:cover;"></video>';
          showShopNotification('ویدیو انتخاب شد - دکمه ذخیره را بزنید');
      } else {
          compressImage(file,256,function(dataUrl){
            editingUserExclusiveAvatar=dataUrl;
            document.getElementById('exclusiveAvatarPreview').innerHTML='<img src="'+dataUrl+'" alt="exclusive">';
            showShopNotification('آواتار انتخاب شد - دکمه ذخیره را بزنید');
          });
      }
    });
  }
  const removeBtn=document.getElementById('removeExclusiveAvatar');
  if(removeBtn){
    removeBtn.addEventListener('click',function(){
      editingUserExclusiveAvatar=null;
      document.getElementById('exclusiveAvatarPreview').innerHTML='<span class="exclusive-avatar-placeholder">👤</span>';
      document.getElementById('exclusiveAvatarFile').value='';
      showShopNotification('آواتار اختصاصی حذف خواهد شد');
    });
  }
});

async function saveUserEdit(){
  if(!editingUserId)return;
  const perm=getPerm();
  const allUsers=await getAllUsers();
  const u=allUsers[editingUserId];
  if(!u){pauseSync=false;return;}
  u.name=document.getElementById('editUserName').value.trim()||u.name;
  const newCodeRaw = document.getElementById('editUserCode').value.trim();
  if(newCodeRaw) { const newCode = parseInt(newCodeRaw); if(newCode > 0) u.userCode = newCode; }
  if(perm.coins){ const coins=parseInt(document.getElementById('editUserCoins').value)||0; u.coins=coins<0?0:coins; }
  if(perm.gems){ const gems=parseInt(document.getElementById('editUserGems').value)||0; u.gems=gems<0?0:gems; }
  if(perm.dollars){ const dollars=parseInt(document.getElementById('editUserDollars').value)||0; u.dollars=dollars<0?0:dollars; }
  if(perm.rank)u.rank=document.getElementById('editUserRole').value;
  if(perm.stats){
    u.cups=parseInt(document.getElementById('editUserCups').value)||0;
    u.hours=parseFloat(document.getElementById('editUserHours').value)||0;
    u.level=parseInt(document.getElementById('editUserLevel').value)||1;
    u.compWins=parseInt(document.getElementById('editUserCompWins').value)||0;
    u.friendWins=parseInt(document.getElementById('editUserFriendWins').value)||0;
    u.monitorCount=parseInt(document.getElementById('editUserMonitor').value)||0;
    u.mafiaWins=parseInt(document.getElementById('editUserMafiaWins').value)||0;
    u.citizenWins=parseInt(document.getElementById('editUserCitizenWins').value)||0;
    u.bestScore=parseInt(document.getElementById('editUserBestScore').value)||0;
  }
  if(perm.exclusive){
    if(editingUserExclusiveAvatar){
      if(editingUserExclusiveAvatar === '655.webm' && editingUserId !== CREATOR_PHONE) {
        showShopNotification('این آواتار فقط مخصوص سازنده است!', 'error'); return;
      }
      u.exclusiveAvatar=editingUserExclusiveAvatar;
      if(!u.ownedAvatars)u.ownedAvatars=[];
      const exKey='exclusive_'+editingUserId;
      if(!u.ownedAvatars.includes(exKey))u.ownedAvatars.push(exKey);
    } else {
      delete u.exclusiveAvatar;
      if(u.ownedAvatars) u.ownedAvatars = u.ownedAvatars.filter(a => !a.startsWith('exclusive_'));
      if(u.previousAvatar && u.previousAvatar !== u.avatar) u.avatar = u.previousAvatar;
      else if (!u.avatar || u.avatar === u.exclusiveAvatar) u.avatar = 'Mafia2.png';
    }
  }
  allUsers[editingUserId]=u;
  await saveAllUsers(allUsers);
  await saveUser(editingUserId,u);
  if(editingUserId === currentPhone) {
    currentUserData = u;
    localStorage.setItem('user_cache_' + currentPhone, JSON.stringify(currentUserData));
  }
  closeEditUser();
  await loadUsers();
  showShopNotification('ذخیره شد');
}

async function banUser(type = 'account'){
  if(!editingUserId)return;
  const perm=getPerm();
  const allUsers=await getAllUsers();
  const u=allUsers[editingUserId];
  if(!u)return;
  if(editingUserId===CREATOR_PHONE){showShopNotification('نمی‌توانید سازنده را بن کنید','error');return;}
  const myLevel=RANK_LEVEL[(currentUserData.rank||'کاربر')]||0;
  const targetLevel=RANK_LEVEL[(u.rank||'کاربر')]||0;
  const isCreator=(currentPhone===CREATOR_PHONE)||(currentUserData.rank==='سازنده');
  if(!isCreator&&targetLevel>=myLevel){showShopNotification('نمی‌توانید هم‌مقام یا بالاتر را بن کنید','error');return;}

  let dur=document.getElementById('editBanDuration').value;
  const order=BAN_OPTIONS.map(o=>o[0]);
  const maxIdx=order.indexOf(perm.banMax);
  if(maxIdx>=0&&order.indexOf(dur)>maxIdx)dur=perm.banMax;

  const banData={isBanned:true,phone:editingUserId,bannedBy:currentUserData.name,reason:'تخلف از قوانین',duration:dur,bannedAt:new Date().toISOString(),expiresAt:DUR_MS[dur]?new Date(Date.now()+DUR_MS[dur]).toISOString():null};

  if(type === 'device') {
    const deviceId = u.lastDevice || u.registeredDevice;
    if (!deviceId) { showShopNotification('دستگاه کاربر یافت نشد', 'error'); return; }
    await setDeviceBan(deviceId, banData);
    await addBanLog(editingUserId, { time: Date.now(), by: currentUserData.name, reason: 'بن دستگاه', duration: dur, type: 'device' });
    showShopNotification('دستگاه کاربر بن شد');
  } else if (type === 'ip') {
    const ip = u.lastIP || u.registeredIP;
    if (!ip) { showShopNotification('IP کاربر یافت نشد', 'error'); return; }
    await setIPBan(ip, banData);
    await addBanLog(editingUserId, { time: Date.now(), by: currentUserData.name, reason: 'بن IP', duration: dur, type: 'ip' });
    showShopNotification('IP کاربر بن شد');
  } else {
    await redisSet('ban:'+editingUserId,banData);
    u.banned=true;
    allUsers[editingUserId]=u;
    await saveAllUsers(allUsers);
    await saveUser(editingUserId,u);
    await addBanLog(editingUserId, { time: Date.now(), by: currentUserData.name, reason: 'تخلف از قوانین', duration: dur, type: 'account' });
    showShopNotification('اکانت کاربر بن شد');
  }
  closeEditUser();
  await loadUsers();
}

async function unbanUser(){
  if(!editingUserId)return;
  const allUsers=await getAllUsers();
  const u=allUsers[editingUserId];
  if(!u)return;
  await redisDel('ban:'+editingUserId);
  u.banned=false;
  allUsers[editingUserId]=u;
  await saveAllUsers(allUsers);
  await saveUser(editingUserId,u);
  const deviceId = u.lastDevice || u.registeredDevice;
  if(deviceId) await redisDel('device_ban:'+deviceId);
  const ip = u.lastIP || u.registeredIP;
  if(ip) await redisDel('ip_ban:'+ip);
  await addBanLog(editingUserId, { time: Date.now(), by: currentUserData.name, reason: 'رفع بن کامل', duration: 'unbanned', type: 'account' });
  closeEditUser();
  await loadUsers();
  showShopNotification('همه بن‌ها برداشته شد');
}

async function deleteAccount(){
  if(!editingUserId)return;
  const perm=getPerm();
  if(!perm.del){showShopNotification('دسترسی ندارید','error');return;}
  const allUsers=await getAllUsers();
  const u=allUsers[editingUserId];
  if(!u)return;
  if(u.rank&&u.rank!=='کاربر'){showShopNotification('نمی‌توان مقام‌دار را حذف کرد','error');return;}
  if(!confirm('آیا از حذف کامل اکانت "'+(u.name||'کاربر')+'" اطمینان دارید؟'))return;
  delete allUsers[editingUserId];
  await saveAllUsers(allUsers);
  await redisDel('user:'+editingUserId);
  await redisDel('ban:'+editingUserId);
  closeEditUser();
  await loadUsers();
  showShopNotification('اکانت کامل حذف شد');
}

async function wipeDatabase(){
  if(currentPhone!==CREATOR_PHONE){showShopNotification('فقط سازنده دسترسی دارد','error');return;}
  if(!confirm('هشدار: همه اکانت‌ها به جز مقام‌دارها حذف می‌شوند. ادامه می‌دهید؟'))return;
  const allUsers=await getAllUsers();
  const keep={};
  for(const[p,u]of Object.entries(allUsers)){
    if(u.rank&&u.rank!=='کاربر')keep[p]=u;
    else{await redisDel('user:'+p);await redisDel('ban:'+p);}
  }
  await saveAllUsers(keep);
  await loadUsers();
  showShopNotification('دیتابیس پاک شد');
}

async function toggleServer(){
  if(currentPhone!==CREATOR_PHONE){showShopNotification('فقط سازنده دسترسی دارد','error');return;}
  const m=await getMaintenance();
  const isOn=m&&m.on;
  await setMaintenance(!isOn);
  showShopNotification(!isOn?'سرور قطع شد 🔌':'سرور وصل شد ✅');
  updateServerToggleBtn();
}
async function updateServerToggleBtn(){
  const m=await getMaintenance();
  const btn=document.getElementById('btnServerToggle');
  if(m&&m.on){btn.textContent=' وصل کردن سرور';btn.className='edit-btn unban';}
  else{btn.textContent='🔌 قطع سرور';btn.className='edit-btn ban';}
}

function confirmTournamentTime(){ showShopNotification('✅ زمان مسابقه تایید شد'); }
function confirmPrize(rank){ showShopNotification(`✅ جایزه رتبه ${rank} تایید شد`); }

async function saveAllTournamentConfig() {
  if (currentPhone !== CREATOR_PHONE) { showShopNotification('فقط سازنده', 'error'); return; }
  const duration = document.getElementById('tournamentDuration').value;
  let endTime = Date.now();
  if (duration === 'weekly') endTime += 7 * 24 * 60 * 60 * 1000;
  else if (duration === 'monthly') endTime += 30 * 24 * 60 * 60 * 1000;
  else if (duration === 'seasonal') endTime += 90 * 24 * 60 * 60 * 1000;
  const prize1Value = parseInt(document.getElementById('prize1Value').value) || 0;
  const prize2Value = parseInt(document.getElementById('prize2Value').value) || 0;
  const prize3Value = parseInt(document.getElementById('prize3Value').value) || 0;
  const prize4Value = parseInt(document.getElementById('prize4Value').value) || 0;
  if (prize1Value < 0 || prize2Value < 0 || prize3Value < 0 || prize4Value < 0) { showShopNotification('مقادیر نمی‌توانند منفی باشند', 'error'); return; }
  const cfg = {
    duration: duration, endTime: endTime, distributed: false,
    rank1: { type: document.getElementById('prize1Type').value, value: prize1Value, customFile: document.getElementById('prize1File').dataset.file || null },
    rank2: { type: document.getElementById('prize2Type').value, value: prize2Value, customFile: document.getElementById('prize2File').dataset.file || null },
    rank3: { type: document.getElementById('prize3Type').value, value: prize3Value, customFile: document.getElementById('prize3File').dataset.file || null },
    rank4_10: { type: document.getElementById('prize4Type').value, value: prize4Value },
    blacklist: window.clanBlacklist || []
  };
  await saveTournamentConfigData(cfg);
  showShopNotification('✅ تنظیمات مسابقات ذخیره و زمان شروع شد');
}
window.clanBlacklist = [];

async function loadTournamentConfig() {
  const cfg = await getTournamentConfig();
  if (cfg.duration) document.getElementById('tournamentDuration').value = cfg.duration;
  if (cfg.rank1) { document.getElementById('prize1Type').value = cfg.rank1.type; document.getElementById('prize1Value').value = cfg.rank1.value || ''; if (cfg.rank1.customFile) document.getElementById('prize1File').dataset.file = cfg.rank1.customFile; }
  if (cfg.rank2) { document.getElementById('prize2Type').value = cfg.rank2.type; document.getElementById('prize2Value').value = cfg.rank2.value || ''; if (cfg.rank2.customFile) document.getElementById('prize2File').dataset.file = cfg.rank2.customFile; }
  if (cfg.rank3) { document.getElementById('prize3Type').value = cfg.rank3.type; document.getElementById('prize3Value').value = cfg.rank3.value || ''; if (cfg.rank3.customFile) document.getElementById('prize3File').dataset.file = cfg.rank3.customFile; }
  if (cfg.rank4_10) { document.getElementById('prize4Type').value = cfg.rank4_10.type; document.getElementById('prize4Value').value = cfg.rank4_10.value || ''; }
  if (cfg.blacklist) { window.clanBlacklist = cfg.blacklist; renderBlacklist(); }
}
function renderBlacklist() {
  const container = document.getElementById('blacklistItems');
  if (!window.clanBlacklist || window.clanBlacklist.length === 0) { container.innerHTML = '<div style="color:rgba(255,255,255,.5);font-size:11px;text-align:center;">لیست سیاه خالی است</div>'; return; }
  container.innerHTML = window.clanBlacklist.map((clan, idx) => `<div class="clan-blacklist-item"><span>${clan}</span><button onclick="removeClanFromBlacklist(${idx})">حذف</button></div>`).join('');
}
function addClanToBlacklist() {
  const clanName = prompt('نام یا تگ کلن را وارد کنید:');
  if (!clanName || !clanName.trim()) return;
  if (!window.clanBlacklist) window.clanBlacklist = [];
  if (window.clanBlacklist.includes(clanName.trim())) { showShopNotification('این کلن قبلاً در لیست سیاه است', 'error'); return; }
  window.clanBlacklist.push(clanName.trim()); renderBlacklist(); showShopNotification('کلن به لیست سیاه اضافه شد');
}
function removeClanFromBlacklist(idx) { window.clanBlacklist.splice(idx, 1); renderBlacklist(); showShopNotification('کلن از لیست سیاه حذف شد'); }
['prize1Type', 'prize2Type', 'prize3Type'].forEach(id => {
  document.getElementById(id).addEventListener('change', function() {
    const rowId = id.replace('Type', 'FileRow');
    document.getElementById(rowId).style.display = this.value === 'custom' ? 'flex' : 'none';
  });
});
['prize1File', 'prize2File', 'prize3File'].forEach(id => {
  document.getElementById(id).addEventListener('change', function(e) {
    const file = e.target.files[0]; if (!file) return;
    if (file.size > 2 * 1024 * 1024) { showShopNotification('حجم فایل باید کمتر از 2MB باشد', 'error'); this.value = ''; return; }
    const reader = new FileReader();
    reader.onload = function(evt) { e.target.dataset.file = evt.target.result; showShopNotification('فایل آپلود شد - دکمه ذخیره را بزنید'); };
    reader.readAsDataURL(file);
  });
});

async function loadUsers(){
  const allUsers=await getAllUsers();
  const list=document.getElementById('userList');
  const users=Object.entries(allUsers);
  if(!users.length){list.innerHTML='<div style="text-align:center;color:rgba(255,255,255,.6);padding:20px;">کاربری یافت نشد</div>';return;}
  list.innerHTML=users.map(([p,u])=>{
    const rc=u.rank==='سازنده'?'badge-creator':((u.rank==='ادمین'||u.rank==='ادمین ارشد')?'badge-admin':'');
    const exBadge=u.exclusiveAvatar?'<span class="user-badge" style="background:linear-gradient(180deg,#ffd700,#ff8c00);color:#000;">⭐</span>':'';
    const validAv = getValidAvatar(u.avatar||'Mafia2.png', p);
    const isBanned = u.banned ? 'badge-banned' : '';
    return '<div class="user-item" onclick="openEditUser(\''+p+'\')"><div class="user-avatar"><img src="'+validAv+'" onerror="this.style.display=\'none\';" style="width:100%;height:100%;object-fit:cover;border-radius:50%;"></div><div class="user-info"><div class="user-name">'+(u.name||'کاربر')+' <small style="color:#aaa;">('+p+')</small></div><div class="user-details"><span>سکه: '+toPersianNum(u.coins||0)+'</span><span>الماس: '+toPersianNum(u.gems||0)+'</span><span>دولار: '+toPersianNum(u.dollars||0)+'</span><span class="user-badge '+rc+'">'+(u.rank||'کاربر')+'</span>'+exBadge+(isBanned?'<span class="user-badge badge-banned">بن شده</span>':'')+'</div></div></div>';
  }).join('');
}

function initAvatarShop(){
  if(!currentUserData)return;
  shopGold=currentUserData.coins||200;
  shopGems=currentUserData.gems||500;
  shopDollars=currentUserData.dollars||0;
  document.getElementById('shopGoldAmount').textContent=toPersianNum(shopGold);
  document.getElementById('shopGemAmount').textContent=toPersianNum(shopGems);
  document.getElementById('shopDollarAmount').textContent=toPersianNum(shopDollars);

  if (!currentUserData.ownedAvatars) currentUserData.ownedAvatars = [];
  const rank = currentUserData.rank || 'کاربر';
  const exclusiveList = [
    { src: '655.webm', allowedRanks: ['سازنده'] },
    { src: '2000.webm', allowedRanks: ['پشتیبانی', 'گرداننده', 'ادمین ارشد', 'ناظر ارشد'] },
    { src: '2003.webm', allowedRanks: ['پشتیبانی', 'گرداننده', 'ادمین ارشد', 'ناظر ارشد'] },
    { src: '2001.webm', allowedRanks: ['ادمین', 'ناظر'] },
    { src: '2002.webm', allowedRanks: ['ادمین', 'ناظر'] }
  ];
  exclusiveList.forEach(ex => {
    const isAllowed = ex.allowedRanks.includes(rank);
    const key = 'ex_' + ex.src;
    const avObj = avatars.find(a => a.src === ex.src);
    if (isAllowed) {
      if (!currentUserData.ownedAvatars.includes(key)) currentUserData.ownedAvatars.push(key);
      if (avObj) avObj.owned = true;
    } else {
      currentUserData.ownedAvatars = currentUserData.ownedAvatars.filter(k => k !== key);
      if (avObj) avObj.owned = false;
      if (currentUserData.avatar === ex.src) currentUserData.avatar = 'Mafia2.png';
    }
  });
  const owned = currentUserData.ownedAvatars || [];
  avatars.forEach(a => {
    if (a.free) a.owned = true;
    else if (owned.includes('ex_' + a.src) || owned.includes(a.src)) a.owned = true;
    else a.owned = false;
  });
  currentUserData.avatar = getValidAvatar(currentUserData.avatar || 'Mafia2.png', currentPhone);
}

function renderAvatars(){
  const grid=document.getElementById('avatarGrid');
  let disp;
  if(currentAvatarSection==='my'){
    disp=avatars.filter(a=>a.owned);
    if(currentPhone!==CREATOR_PHONE) disp=disp.filter(a=>a.src!=='655.webm');
  }else disp=avatars.filter(a=>!a.owned&&!a.exclusive&&!a.isMyExclusive);

  if(!disp.length){grid.innerHTML='<div style="grid-column:1/-1;text-align:center;padding:40px;color:rgba(255,255,255,.6);">آواتاری موجود نیست</div>';return;}

  grid.innerHTML=disp.map(a=>{
    const isVid = a.src.endsWith('.webm') || a.src.endsWith('.mp4') || a.src.endsWith('.mov');
    const mediaHtml = isVid ? `<video src="${a.src}" autoplay loop muted playsinline webkit-playsinline preload="metadata" onerror="avatarLoadError(this,'${a.src}')"></video>` : `<img src="${a.src}" loading="lazy" onerror="avatarLoadError(this,'${a.src}')">`;
    const cardClass='avatar-card '+(a.owned?'owned ':'')+(a.isMyExclusive?'exclusive':'');
    return `<div class="${cardClass}" data-id="${a.id}"><div class="avatar-image">${mediaHtml}</div>${(!a.owned?`<div class="avatar-price"><div class="gem-icon"></div><span class="price-value">${toPersianNum(a.price)}</span></div>`:`<div style="color:#4CAF50;font-weight:900;font-size:12px;margin-top:5px;">✓ ${(a.isMyExclusive?'⭐ اختصاصی':(a.exclusive?'اختصاصی':'دارید'))}</div>`)}</div>`;
  }).join('');

  grid.querySelectorAll('.avatar-card').forEach(c=>c.addEventListener('click',()=>handleAvatarClick(parseInt(c.dataset.id))));
  observeVideos(grid);
}

function handleAvatarClick(id){
  const a=avatars.find(x=>x.id===id);
  if(!a)return;
  if(currentAvatarSection==='buy'&&!a.owned){
    selectedAvatar=a;purchasePrice=a.price;
    document.getElementById('modalText').textContent='آیا از خرید این آواتار به قیمت '+toPersianNum(purchasePrice)+' الماس اطمینان دارید؟';
    document.getElementById('purchaseModal').classList.add('show');
  }else if(a.owned){
    updateGlobalAvatar(a.src);
    saveAvatarToStorage(a.src);
    showShopNotification('آواتار انتخاب شد');
  }
}

function startCompetitiveSearch(){document.getElementById('competitiveOverlay').classList.add('active');}
function enterCompetitiveGame(){window.location.href='Safe Game.html';}
function cancelCompetitiveSearch(){if(confirm('از جستجو خارج می‌شوید؟')){document.getElementById('competitiveOverlay').classList.remove('active');document.getElementById('gameStartedOverlay').classList.remove('show');}}

// ============================================================
//  چک بن دوره‌ای (با معافیت وایت‌لیست)
// ============================================================
async function checkBanPeriodically(){
  if(!currentPhone||isRedirecting)return;
  if(pauseSync) return;
  if(document.getElementById('adminModal').classList.contains('active')) return;
  if(document.getElementById('editUserModal').classList.contains('active')) return;

  myIP = await fetchUserIP();
  if (!myIP) return;
  
  var isWhite = await isIPWhitelisted(myIP, getDeviceId());

  if (isWhite) {
    document.getElementById('deviceBanOverlay').classList.remove('show');
    document.getElementById('serverDownOverlay').classList.remove('show');
    return;
  }

  const b = await getBanStatus(currentPhone);
  if(b){redirectToBan(b,currentPhone); return;}

  const deviceId = getDeviceId();
  const db = await getDeviceBan(deviceId);
  if(db && db.isBanned) {
    if (!db.expiresAt || new Date(db.expiresAt).getTime() > Date.now()) {
      document.getElementById('deviceBanOverlay').classList.add('show');
    }
  }
}
setInterval(checkBanPeriodically,7000);

function playClickSound() {
  try { const clickSound = document.getElementById('clickSound'); if (clickSound) { clickSound.currentTime = 0; clickSound.play().catch(function(e) {}); } } catch (e) {}
}

async function checkAndDistributeTournamentPrizes() {
  try {
    const cfg = await getTournamentConfig();
    if (!cfg || !cfg.endTime || cfg.distributed) return;
    if (Date.now() < cfg.endTime) return;
    const freshCfg = await getTournamentConfig();
    if (freshCfg.distributed) return;
    const allUsers = await getAllUsers();
    const groups = await getGroups();
    const clansWithStats = groups.map(group => {
      let totalPoints = parseInt(group.extraPoints) || 0;
      (group.members||[]).forEach(mid => { const u = allUsers[mid]; if (u) totalPoints += ((parseInt(u.cups)||0)*2) + ((parseInt(u.hours)||0)*20); });
      return { group, points: totalPoints };
    });
    clansWithStats.sort((a, b) => b.points - a.points);
    const topClans = clansWithStats.slice(0, 10);
    for (let i = 0; i < topClans.length; i++) {
      const rank = i + 1;
      const clan = topClans[i].group;
      let prizeConfig = null;
      if (rank === 1) prizeConfig = cfg.rank1;
      else if (rank === 2) prizeConfig = cfg.rank2;
      else if (rank === 3) prizeConfig = cfg.rank3;
      else if (rank >= 4 && rank <= 10) prizeConfig = cfg.rank4_10;
      if (prizeConfig && prizeConfig.value > 0 && clan.members) {
        for (const memberPhone of clan.members) {
          const user = allUsers[memberPhone]; if (!user) continue;
          if (prizeConfig.type === 'coin') user.coins = (user.coins || 0) + parseInt(prizeConfig.value);
          else if (prizeConfig.type === 'gem') user.gems = (user.gems || 0) + parseInt(prizeConfig.value);
          else if (prizeConfig.type === 'avatar') { if (!user.ownedAvatars) user.ownedAvatars = []; if (prizeConfig.value && !user.ownedAvatars.includes(prizeConfig.value)) user.ownedAvatars.push(prizeConfig.value); }
          else if (prizeConfig.type === 'frame') user.frame = prizeConfig.value || 'frame_prize';
          else if (prizeConfig.type === 'crown') user.crown = prizeConfig.value || 'crown_prize';
          allUsers[memberPhone] = user;
        }
      }
    }
    await saveAllUsers(allUsers);
    const finalCfg = await getTournamentConfig();
    if (!finalCfg.distributed) { finalCfg.distributed = true; await saveTournamentConfigData(finalCfg); }
  } catch (e) {}
}

// ============================================================
//  سینک با سرور (با معافیت وایت‌لیست)
// ============================================================
async function syncWithServerInBackground() {
  try {
    if(pauseSync) return;
    if(document.getElementById('adminModal').classList.contains('active')) return;
    if(document.getElementById('editUserModal').classList.contains('active')) return;

    myIP = await fetchUserIP();
    if (!myIP) return;

    var isWhitelisted = await isIPWhitelisted(myIP, getDeviceId());

    if (isWhitelisted) {
      document.getElementById('serverDownOverlay').classList.remove('show');
      document.getElementById('deviceBanOverlay').classList.remove('show');
    } else {
      var m = await getMaintenance();
      if(m && m.on && currentPhone !== CREATOR_PHONE){
        document.getElementById('serverDownOverlay').classList.add('show');
        return;
      }
      document.getElementById('serverDownOverlay').classList.remove('show');

      var ban = await getBanStatus(currentPhone);
      if(ban){redirectToBan(ban,currentPhone); return;}

      var deviceId = getDeviceId();
      var db = await getDeviceBan(deviceId);
      if(db && db.isBanned) {
        if (!db.expiresAt || new Date(db.expiresAt).getTime() > Date.now()) {
          document.getElementById('deviceBanOverlay').classList.add('show');
          return;
        }
      }

      var ipBan = await getIPBan(myIP);
      if (ipBan && ipBan.isBanned) {
        if (!ipBan.expiresAt || new Date(ipBan.expiresAt).getTime() > Date.now()) {
          document.getElementById('deviceBanOverlay').classList.add('show');
          return;
        }
      }
    }

    await checkAndDistributeTournamentPrizes();
    var serverUser = await getUser(currentPhone);
    if (!serverUser) {
      var localCache = localStorage.getItem('user_cache_' + currentPhone);
      if (localCache) {
        try { serverUser = JSON.parse(localCache); await saveUser(currentPhone, serverUser); var all = await getAllUsers(); all[currentPhone] = serverUser; await saveAllUsers(all); }
        catch(e) { window.location.href = 'index.html'; return; }
      } else { window.location.href = 'index.html'; return; }
    }
    currentUserData = sanitizeUserData({ ...currentUserData, ...serverUser }, currentPhone);
    currentUserData.lastIP = myIP;
    currentUserData.lastDevice = getDeviceId();
    localStorage.setItem('user_cache_' + currentPhone, JSON.stringify(currentUserData));
    if (!pauseSync) {
      await saveUser(currentPhone, currentUserData);
      var allUsers = await getAllUsers(); allUsers[currentPhone] = currentUserData; await saveAllUsers(allUsers);
    }
    updateUIWithData(currentUserData);
    updateServerToggleBtn();
    updateGroupDisplay();
  } catch (error) {}
}

// ============================================================
//  🚀 شروع
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
  const loggedIn = localStorage.getItem('currentLoggedInUser');
  if (!loggedIn) { window.location.href = 'index.html'; return; }
  let phone = null;
  try { phone = JSON.parse(loggedIn).phone; } catch(e) { window.location.href = 'index.html'; return; }
  currentPhone = phone;

  myIP = await fetchUserIP();
  var isWhiteInitial = await isIPWhitelisted(myIP, getDeviceId());
  if (isWhiteInitial) {
    document.getElementById('serverDownOverlay').classList.remove('show');
    document.getElementById('deviceBanOverlay').classList.remove('show');
  }

  const localCache = localStorage.getItem('user_cache_' + currentPhone);
  let localUser = null;
  try { localUser = localCache ? JSON.parse(localCache) : null; } catch(e) { localUser = null; }
  if (!localUser) {
    localUser = { name: 'کاربر', coins: 0, gems: 0, dollars: 0, avatar: 'Mafia2.png', rank: 'کاربر', userCode: '----', level: 1, score: 0, cups:0, hours:0, xp:0, compWins:0, friendWins:0, monitorCount:0, bestScore:0, mafiaWins:0, citizenWins:0 };
  }
  currentUserData = localUser;
  updateUIWithData(currentUserData);
  initAvatarShop();
  setTimeout(() => { syncWithServerInBackground(); setUserOnlineStatus(true); }, 0);
  setInterval(syncWithServerInBackground, 5000);
  setInterval(() => { setUserOnlineStatus(!document.hidden); }, 30000);

  // منو
  document.getElementById('menuBtn').addEventListener('click',e=>{e.stopPropagation();playClickSound();const d=document.getElementById('menuDropdown');d.classList.contains('active')?closeModal('menuDropdown'):(document.getElementById('menuOverlay').classList.add('active'),d.classList.add('active'));});
  document.getElementById('menuOverlay').addEventListener('click',()=>{document.getElementById('menuOverlay').classList.remove('active');document.getElementById('menuDropdown').classList.remove('active');});
  document.getElementById('menuContact').addEventListener('click',()=>{playClickSound();closeModal('menuDropdown');window.location.href='https://Mfasun.ir';});
  document.getElementById('menuSettings').addEventListener('click',()=>{playClickSound();closeModal('menuDropdown');document.getElementById('settingsModal').classList.add('active');});
  document.getElementById('menuLogout').addEventListener('click',()=>{playClickSound();closeModal('menuDropdown');if(confirm('از اکانت خارج می‌شوید؟')){setUserOnlineStatus(false);localStorage.removeItem('currentLoggedInUser');window.location.href='index.html';}});

  // پروفایل
  document.getElementById('openProfile').addEventListener('click',()=>{playClickSound();document.getElementById('profilePage').classList.add('active');updateGroupDisplay();});
  document.getElementById('backBtn').addEventListener('click',()=>{playClickSound();document.getElementById('profilePage').classList.remove('active');});
  document.getElementById('copyUserCode').addEventListener('click',()=>{playClickSound();copyToClipboard(document.getElementById('userCode').textContent,'کد کاربری کپی شد!');});
  document.getElementById('openAvatarShop').addEventListener('click',()=>{playClickSound();document.getElementById('profilePage').classList.remove('active');document.getElementById('avatarShopPage').classList.add('active');renderAvatars();});
  document.getElementById('shopBackBtn').addEventListener('click',()=>{playClickSound();document.getElementById('avatarShopPage').classList.remove('active');document.getElementById('profilePage').classList.add('active');});
  document.getElementById('editNameBtn').addEventListener('click',changeUsername);

  // ناوبری
  document.getElementById('navShop').addEventListener('click',()=>{playClickSound();window.location.href='Safe Foroshgahe.html';});
  document.getElementById('navGroup').addEventListener('click',()=>{playClickSound();window.location.href='Safe Goroh.html';});
  document.getElementById('btnAnnouncements').addEventListener('click',async()=>{playClickSound();await loadNews();document.getElementById('newsModal').classList.add('active');});
  document.getElementById('btnHelp').addEventListener('click',()=>{playClickSound();window.location.href='Amozesh.html';});
  document.getElementById('btnTopPlayers').addEventListener('click',()=>{playClickSound();window.location.href='Bandi.html';});
  document.getElementById('btnManagement').addEventListener('click',()=>{playClickSound();window.location.href='Modir.html';});
  document.getElementById('btnLive').addEventListener('click',()=>{playClickSound();showShopNotification('پخش زنده به زودی');});

  // پنل
  document.getElementById('btnAdmin').addEventListener('click', async ()=>{
    playClickSound();
    const p=getPerm();
    if(!p.panel){showShopNotification('دسترسی ندارید','error');return;}
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

  document.getElementById('sendNewsBtn').addEventListener('click',sendNews);
  document.getElementById('btnBanUser').addEventListener('click',()=>banUser('account'));
  document.getElementById('btnBanDevice').addEventListener('click',()=>banUser('device'));
  document.getElementById('btnBanIP').addEventListener('click',()=>banUser('ip'));
  document.getElementById('btnUnbanUser').addEventListener('click',unbanUser);
  document.getElementById('btnDeleteAccount').addEventListener('click',deleteAccount);
  document.getElementById('btnWipeDB').addEventListener('click',wipeDatabase);
  document.getElementById('btnServerToggle').addEventListener('click',toggleServer);
  document.getElementById('btnFriendly').addEventListener('click',()=>{playClickSound();window.location.href='TalarDs.html';});
  document.getElementById('btnCompetitive').addEventListener('click',()=>{playClickSound();startCompetitiveSearch();});
  document.getElementById('cancelSearchBtn').addEventListener('click',cancelCompetitiveSearch);
  document.getElementById('enterGameBtn').addEventListener('click',enterCompetitiveGame);
  document.querySelectorAll('.shop-tab').forEach(t=>t.addEventListener('click',function(){playClickSound();document.querySelectorAll('.shop-tab').forEach(x=>x.classList.remove('active'));this.classList.add('active');if(this.dataset.tab!=='avatars')showShopNotification('به زودی');}));
  document.querySelectorAll('.avatar-section-tab').forEach(t=>t.addEventListener('click',function(){playClickSound();currentAvatarSection=this.dataset.section;document.querySelectorAll('.avatar-section-tab').forEach(x=>x.classList.remove('active'));this.classList.add('active');renderAvatars();}));
  document.getElementById('modalCancelBtn').addEventListener('click',()=>{playClickSound();document.getElementById('purchaseModal').classList.remove('show');selectedAvatar=null;purchasePrice=0;});
  document.getElementById('modalConfirmBtn').addEventListener('click',async()=>{
    playClickSound();
    if(shopGems>=purchasePrice&&selectedAvatar){
      shopGems-=purchasePrice;selectedAvatar.owned=true;
      if(currentUserData){
        currentUserData.gems=shopGems<0?0:shopGems;
        if(!currentUserData.ownedAvatars)currentUserData.ownedAvatars=[];
        if(!currentUserData.ownedAvatars.includes(selectedAvatar.src))currentUserData.ownedAvatars.push(selectedAvatar.src);
        await saveUserData(); updateUIWithData(currentUserData);
      }
      updateGlobalAvatar(selectedAvatar.src);
      await saveAvatarToStorage(selectedAvatar.src);
      renderAvatars();
      document.getElementById('purchaseModal').classList.remove('show');
      showShopNotification('آواتار خریداری شد!');
      selectedAvatar=null;purchasePrice=0;
    }else{document.getElementById('purchaseModal').classList.remove('show');showShopNotification('الماس کافی ندارید!','error');}
  });
  document.getElementById('openChangePasswordBtn').addEventListener('click', () => {
      playClickSound(); closeModal('settingsModal');
      document.getElementById('cpPhone').value = currentPhone || '';
      document.getElementById('changePasswordModal').classList.add('active');
  });
  document.getElementById('submitPasswordChange').addEventListener('click', async () => {
      playClickSound();
      const phone = document.getElementById('cpPhone').value.trim();
      const currentPass = document.getElementById('cpCurrentPass').value;
      const newPass = document.getElementById('cpNewPass').value;
      if (!phone || !currentPass || !newPass) { showShopNotification('لطفاً تمام فیلدها را پر کنید', 'error'); return; }
      if (phone !== currentPhone) { showShopNotification('شماره موبایل وارد شده با اکانت فعلی مطابقت ندارد', 'error'); return; }
      if (currentUserData.password && currentUserData.password !== currentPass) { showShopNotification('رمز عبور فعلی اشتباه است', 'error'); return; }
      if (newPass.length < 4) { showShopNotification('رمز عبور جدید باید حداقل ۴ کاراکتر باشد', 'error'); return; }
      currentUserData.password = newPass;
      await saveUserData();
      showShopNotification('رمز عبور با موفقیت تغییر کرد ✅');
      closeModal('changePasswordModal');
      document.getElementById('cpCurrentPass').value = '';
      document.getElementById('cpNewPass').value = '';
  });
  setInterval(updateGroupDisplay,30000);
});

document.addEventListener('visibilitychange', async () => {
  if (document.hidden) {
    setUserOnlineStatus(false);
  } else {
    setUserOnlineStatus(true);
    myIP = await fetchUserIP();
    var isWhite = await isIPWhitelisted(myIP, getDeviceId());
    if (isWhite) {
      document.getElementById('serverDownOverlay').classList.remove('show');
      document.getElementById('deviceBanOverlay').classList.remove('show');
    }
  }
});

// ============================================================
//  چک سریع وایت‌لیست هر 2 ثانیه
// ============================================================
setInterval(async function () {
  if (isRedirecting) return;
  if (!myIP) {
    myIP = await fetchUserIP();
    if (!myIP) return;
  }
  var isWhite = await isIPWhitelisted(myIP, getDeviceId());
  if (isWhite) {
    document.getElementById('serverDownOverlay').classList.remove('show');
    document.getElementById('deviceBanOverlay').classList.remove('show');
  }
}, 2000);