(function(){
'use strict';
var UPSTASH_URL = "https://holy-hamster-122717.upstash.io";
var UPSTASH_TOKEN = "gQAAAAAAAd9dAAIgcDFlNmYwM2VkZDJiM2Y0YWI2ODBmNmIyMTZjMmRkMTZmNg";
var ADMIN_PHONES = ["09908823688", "09904844031"];
var ADMIN_FIXED_CODES = { "09908823688": "1", "09904844031": "2" };
var ADMIN_ROLE_LABEL = { "09908823688": "سازنده", "09904844031": "برنامه‌نویس" };
var ROLE_LABELS = { creator: "سازنده", developer: "برنامه‌نویس", admin: "ادمین", moderator: "ناظر", vip: "کاربر ویژه", user: "کاربر عادی" };
var NAME_COST = 100;
var MAX_SLOTS = 4;
var REACTION_COOLDOWN = 3000;
var ACTION_LOCK = 1500;
var POLL_INTERVAL = 800;

var CROWN_SVG = '<svg class="crown-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 8L7 12L12 4L17 12L21 8V20H3V8Z" fill="#ffd94a" stroke="#b38600" stroke-width="1.5" stroke-linejoin="round"/><circle cx="3" cy="8" r="1.5" fill="#ffd94a" stroke="#b38600" stroke-width="1"/><circle cx="21" cy="8" r="1.5" fill="#ffd94a" stroke="#b38600" stroke-width="1"/><circle cx="12" cy="4" r="1.5" fill="#ffd94a" stroke="#b38600" stroke-width="1"/></svg>';

var lockImgPreload = new Image();
var lockImgReady = false;
lockImgPreload.onload = function(){ lockImgReady = true; try { renderLobbies(); } catch(e){} };
lockImgPreload.src = 'Go1.webp';

function $(id){ return document.getElementById(id); }
function safeGetUser(){ try { return JSON.parse(localStorage.getItem('currentUser') || 'null'); } catch(e){ return null; } }
function getCurrentPhone(){ var u = safeGetUser(); return u && u.phone ? u.phone : null; }
function isAdmin(){ var u = safeGetUser(); return u && ADMIN_PHONES.indexOf(u.phone) > -1; }
function getUserCoins(){ var u = safeGetUser(); return u && typeof u.coins === 'number' ? u.coins : 1500; }
function setUserCoins(a){ var u = safeGetUser(); if (!u) return; u.coins = a; try { localStorage.setItem('currentUser', JSON.stringify(u)); } catch(e){} }

var toastTimer = null;
function toast(msg){
  try {
    var old = document.querySelector('.toast-msg');
    if (old && old.parentNode) old.parentNode.removeChild(old);
    var el = document.createElement('div');
    el.className = 'toast-msg';
    el.textContent = msg;
    document.body.appendChild(el);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function(){ if (el.parentNode) el.parentNode.removeChild(el); }, 1800);
  } catch(e){}
}

function escapeHtml(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
function toFa(n){ return String(n).replace(/\d/g, function(d){ return '۰۱۲۳۴۵۶۷۸۹'[d]; }); }
function genId(){ return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6); }

/* ============ CLOUD ============ */
function upstashCmd(cmd){
  return fetch(UPSTASH_URL, { method: 'POST', headers: { 'Authorization': 'Bearer ' + UPSTASH_TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify(cmd) })
    .then(function(r){ return r.json(); }).catch(function(){ return { error: 1, result: null }; });
}
function setCloud(k, v){ return upstashCmd(['SET', k, v]); }
function getCloud(k){ return upstashCmd(['GET', k]).then(function(r){ return r && r.result ? r.result : null; }); }

/* ============ USER CODE ============ */
function ensureUserCode(phone){
  if (!phone) return '---';
  if (ADMIN_FIXED_CODES[phone]) { localStorage.setItem('sag_usercode_' + phone, ADMIN_FIXED_CODES[phone]); return ADMIN_FIXED_CODES[phone]; }
  var existing = localStorage.getItem('sag_usercode_' + phone);
  if (existing) return existing;
  try {
    var counter = parseInt(localStorage.getItem('sag_user_counter') || '9', 10) + 1;
    localStorage.setItem('sag_user_counter', counter.toString());
    localStorage.setItem('sag_usercode_' + phone, counter.toString());
    setCloud('usercode:' + phone, counter.toString());
    setCloud('sag_user_counter', counter.toString());
    return counter.toString();
  } catch(e){ return '---'; }
}
function getUserCode(phone){
  if (!phone) return '---';
  if (ADMIN_FIXED_CODES[phone]) return ADMIN_FIXED_CODES[phone];
  try { var c = localStorage.getItem('sag_usercode_' + phone); return c || '---'; } catch(e){ return '---'; }
}

/* ============ STATS ============ */
function getStatsForPhone(phone){
  try { var raw = localStorage.getItem('sag_stats_' + phone); if (raw) { var s = JSON.parse(raw); return { games: s.games || 0, wins: s.wins || 0, score: s.score || 0 }; } } catch(e){}
  return { games: 0, wins: 0, score: 0 };
}
function getMinutesForPhone(phone){
  try { return parseInt(localStorage.getItem('sag_minutes_' + phone) || '0', 10); } catch(e){ return 0; }
}
function getRoleForPhone(phone){
  if (!phone) return 'user';
  if (ADMIN_PHONES.indexOf(phone) > -1) { if (phone === "09908823688") return 'creator'; if (phone === "09904844031") return 'developer'; return 'admin'; }
  try { var raw = localStorage.getItem('sag_roles_' + phone); if (raw) return raw; } catch(e){}
  return 'user';
}
async function loadUserDataFromCloud(phone){
  if (!phone) return;
  try {
    var r1 = await getCloud('stats:' + phone); if (r1) localStorage.setItem('sag_stats_' + phone, r1);
    var r2 = await getCloud('mins:' + phone); if (r2) localStorage.setItem('sag_minutes_' + phone, r2);
    var r3 = await getCloud('role:' + phone); if (r3) localStorage.setItem('sag_roles_' + phone, r3);
    var r4 = await getCloud('usercode:' + phone); if (r4) localStorage.setItem('sag_usercode_' + phone, r4);
  } catch(e){}
}

/* ============ LIKES ============ */
function getLikeData(phone){
  try { var raw = localStorage.getItem('sag_likes_' + phone); if (raw) return JSON.parse(raw); } catch(e){}
  return { likes: 0, dislikes: 0, myVote: 0 };
}
function setLikeData(phone, data){ try { localStorage.setItem('sag_likes_' + phone, JSON.stringify(data)); } catch(e){} }

/* ============ FRIENDS ============ */
function getFriends(){
  try { var phone = getCurrentPhone(); if (!phone) return []; var raw = localStorage.getItem('sag_friends_' + phone); if (!raw) return []; var list = JSON.parse(raw); if (!Array.isArray(list)) return []; return list; } catch(e){ return []; }
}
function saveFriends(list){ try { var phone = getCurrentPhone(); if (!phone) return; localStorage.setItem('sag_friends_' + phone, JSON.stringify(list || {})); } catch(e){} }
function isFriend(phone){ var fr = getFriends(); for (var i = 0; i < fr.length; i++) if (fr[i] && fr[i].phone === phone) return true; return false; }

/* ============ REPORTS ============ */
function getReports(){
  try { var raw = localStorage.getItem('sag_reports'); if (!raw) return []; var o = JSON.parse(raw); if (!Array.isArray(o)) return []; return o; } catch(e){ return []; }
}
function saveReports(list){ try { localStorage.setItem('sag_reports', JSON.stringify(list || [])); } catch(e){} setTimeout(function(){ try { setCloud('sag_reports', JSON.stringify(list)); } catch(e){} }, 100); }

/* ============ LOBBY ============ */
function normalizeLobby(l){
  if (!l || typeof l !== 'object') return null;
  if (!Array.isArray(l.players)) l.players = [];
  if (!l.maxPlayers) l.maxPlayers = MAX_SLOTS;
  if (typeof l.isPrivate !== 'boolean') l.isPrivate = !!(l.password && String(l.password).length > 0);
  if (typeof l.password !== 'string') l.password = '';
  for (var i = 0; i < l.players.length; i++) { if (l.players[i] && typeof l.players[i].likeVote !== 'number') l.players[i].likeVote = 0; }
  return l;
}
function getLobbies(){
  try { var raw = localStorage.getItem('sag_lobbies'); if (!raw) return []; var list = JSON.parse(raw); if (!Array.isArray(list)) return []; var out = []; for (var i = 0; i < list.length; i++) { var n = normalizeLobby(list[i]); if (n && n.id) out.push(n); } return out; } catch(e){ return []; }
}
function saveLobbies(list){
  try { localStorage.setItem('sag_lobbies', JSON.stringify(list || [])); } catch(e){}
  setTimeout(function(){ try { setCloud('sag_lobbies', JSON.stringify(list)); } catch(e){} }, 30);
}
function getLobbyById(id){
  if (!id) return null;
  var all = getLobbies();
  for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i];
  return null;
}
function deleteLobby(id){ try { saveLobbies(getLobbies().filter(function(l){ return l.id !== id; })); } catch(e){} }
async function loadLobbiesFromCloud(){
  try {
    var r = await getCloud('sag_lobbies');
    if (r) { var list = JSON.parse(r); if (Array.isArray(list)) { localStorage.setItem('sag_lobbies', JSON.stringify(list)); return list; } }
  } catch(e){}
  return null;
}

/* ============ NAMES ============ */
function getAllNames(){ try { var raw = localStorage.getItem('sag_all_lobby_names'); if (!raw) return {}; var o = JSON.parse(raw); if (typeof o !== 'object' || o === null) return {}; return o; } catch(e){ return {}; } }
function saveAllNames(obj){ try { localStorage.setItem('sag_all_lobby_names', JSON.stringify(obj)); } catch(e){} setTimeout(function(){ try { setCloud('sag_all_lobby_names', JSON.stringify(obj)); } catch(e){} }, 100); }
function getMyNames(){ var phone = getCurrentPhone(); var all = getAllNames(); var mine = all[phone]; if (!Array.isArray(mine)) mine = []; while (mine.length < MAX_SLOTS) mine.push({ name: '', status: 'empty' }); return mine; }
function saveMyNames(arr){ var phone = getCurrentPhone(); if (!phone) return; var all = getAllNames(); all[phone] = arr; saveAllNames(all); }
function getPendingRequests(){ try { var raw = localStorage.getItem('sag_lobby_name_requests'); if (!raw) return []; var o = JSON.parse(raw); if (!Array.isArray(o)) return []; return o; } catch(e){ return []; } }
function savePendingRequests(list){ try { localStorage.setItem('sag_lobby_name_requests', JSON.stringify(list || [])); } catch(e){} setTimeout(function(){ try { setCloud('sag_lobby_name_requests', JSON.stringify(list)); } catch(e){} }, 100); }

/* ============ VIEW ============ */
var currentRoomId = null;
var currentView = 'list';
var lastRoomSnap = '';
var pollTimer = null;
var actionLockUntil = 0;

function showListView(){
  try { currentRoomId = null; currentView = 'list'; lastRoomSnap = ''; var rv = $('roomView'); if (rv) rv.classList.remove('active'); var lv = $('listView'); if (lv) lv.classList.add('active'); var bgL = $('bgList'); if (bgL) bgL.classList.remove('hidden'); var bgR = $('bgRoom'); if (bgR) bgR.classList.remove('active'); renderLobbies(); } catch(e){}
}
function showRoomView(lobbyId){
  try {
    var lobby = getLobbyById(lobbyId);
    if (!lobby) { toast('لابی پیدا نشد'); showListView(); return; }
    currentRoomId = lobbyId;
    currentView = 'room';
    lastRoomSnap = JSON.stringify(lobby);
    var lv = $('listView'); if (lv) lv.classList.remove('active');
    var rv = $('roomView'); if (rv) rv.classList.add('active');
    var bgL = $('bgList'); if (bgL) bgL.classList.add('hidden');
    var bgR = $('bgRoom'); if (bgR) bgR.classList.add('active');
    renderRoom(lobby);
  } catch(e) { showListView(); }
}

function renderRoom(lobby){
  try {
    var rn = $('roomLobbyName'); if (rn) rn.textContent = lobby.name || 'بی‌نام';
    var area = $('roomGridArea'); if (!area) return;
    var slots = area.querySelectorAll('.player-slot');
    var players = Array.isArray(lobby.players) ? lobby.players.slice() : [];
    while (players.length < MAX_SLOTS) players.push(null);
    var myPhone = getCurrentPhone();

    for (var i = 0; i < slots.length && i < MAX_SLOTS; i++) {
      var slotEl = slots[i];
      var p = players[i];
      slotEl.innerHTML = '';
      slotEl.classList.remove('has-player', 'ready-green', 'ready-red');
      slotEl.onclick = null;

      if (p && p.phone) {
        var isOwner = (p.phone === lobby.creatorPhone);
        var crownHtml = isOwner ? CROWN_SVG : '';
        var isMe = (p.phone === myPhone);

        slotEl.classList.add('has-player');
        if (isOwner || p.ready) slotEl.classList.add('ready-green');
        else slotEl.classList.add('ready-red');

        var micHtml = '';
        if (p.micOn) micHtml = '<img src="Po1.webp" class="mic-indicator" alt="صحبت" onerror="this.style.display=\'none\'">';

        var reactHtml = '';
        if (p.likeVote === 1) reactHtml = '<img src="Po2.webp" class="slot-reaction" alt="لایک" onerror="this.style.display=\'none\'">';
        else if (p.likeVote === -1) reactHtml = '<img src="Po3.webp" class="slot-reaction" alt="دیس" onerror="this.style.display=\'none\'">';

        slotEl.innerHTML = micHtml + reactHtml +
          '<div class="slot-content"><div class="frame-wrap">' +
            '<img class="avatar" src="' + escapeHtml(p.avatar || 'Av.jpg') + '" alt="" onerror="this.src=\'Av.jpg\'">' +
            '<img class="frame" src="Ga.webp" alt="" onerror="this.style.display=\'none\'">' +
          '</div></div>' +
          '<div class="player-name-row">' + crownHtml + '<span class="pname">' + escapeHtml(p.name || 'کاربر') + '</span></div>';

        (function(player, owner, isMeFlag){
          slotEl.onclick = function(){ if (isMeFlag) openOwnProfile(); else openMiniMenu(player, owner); };
        })(p, isOwner, isMe);
      }
    }
    renderBottomActions(lobby);
    updateMyButtonsState(lobby);
  } catch(e) { console.error('renderRoom:', e); }
}

function renderBottomActions(lobby){
  try {
    var left = $('leftActions'); if (!left) return;
    left.innerHTML = '';
    var u = safeGetUser(); if (!u || !u.phone) return;
    var isOwner = (u.phone === lobby.creatorPhone);
    if (isOwner) {
      var players = Array.isArray(lobby.players) ? lobby.players : [];
      var allReady = players.length === MAX_SLOTS && players.every(function(p){ return p && p.ready; });
      var btn = document.createElement('button');
      btn.className = 'action-btn start-btn' + (allReady ? '' : ' disabled');
      btn.innerHTML = '<span class="ab-label">شروع بازی</span>';
      btn.onclick = function(){ if (!allReady) { if (players.length < MAX_SLOTS) toast('باید ۴ نفر پر شود'); else toast('همه باید آماده باشند'); return; } toast('بازی شروع شد!'); };
      left.appendChild(btn);
    } else {
      var myPlayer = null;
      var players2 = Array.isArray(lobby.players) ? lobby.players : [];
      for (var i = 0; i < players2.length; i++) { if (players2[i] && players2[i].phone === u.phone) { myPlayer = players2[i]; break; } }
      var isReady = !!(myPlayer && myPlayer.ready);
      var btn2 = document.createElement('button');
      btn2.className = 'action-btn ready-btn' + (isReady ? '' : ' not-ready');
      btn2.innerHTML = '<span class="ab-label">' + (isReady ? 'آماده‌ام' : 'نیستم') + '</span>';
      btn2.onclick = toggleReady;
      left.appendChild(btn2);
    }
  } catch(e){}
}

function updateMyButtonsState(lobby){
  try {
    var u = safeGetUser(); if (!u || !u.phone) return;
    var myPlayer = null;
    var players = Array.isArray(lobby.players) ? lobby.players : [];
    for (var i = 0; i < players.length; i++) { if (players[i] && players[i].phone === u.phone) { myPlayer = players[i]; break; } }
    var micOn = !!(myPlayer && myPlayer.micOn);
    var micImg = $('micImg'); if (micImg) micImg.src = micOn ? 'Po5.webp' : 'Po4.webp';
    var micBtn = $('micBtn'); if (micBtn) { if (micOn) micBtn.classList.add('on'); else micBtn.classList.remove('on'); }
    var vote = (myPlayer && myPlayer.likeVote) || 0;
    var lb = $('likeBtn'), db = $('dislikeBtn');
    if (lb) { if (vote === 1) lb.classList.add('active'); else lb.classList.remove('active'); }
    if (db) { if (vote === -1) db.classList.add('active'); else db.classList.remove('active'); }
  } catch(e){}
}

function toggleReady(){
  try {
    if (!currentRoomId) return;
    if (Date.now() < actionLockUntil) return;
    actionLockUntil = Date.now() + ACTION_LOCK;
    var lobby = getLobbyById(currentRoomId); if (!lobby) return;
    var u = safeGetUser(); if (!u || !u.phone) return;
    var players = Array.isArray(lobby.players) ? lobby.players : [];
    var newState = false;
    for (var i = 0; i < players.length; i++) { if (players[i] && players[i].phone === u.phone) { players[i].ready = !players[i].ready; newState = players[i].ready; break; } }
    var all = getLobbies();
    for (var j = 0; j < all.length; j++) { if (all[j].id === currentRoomId) { all[j].players = players; break; } }
    saveLobbies(all);
    renderRoom(lobby);
    toast(newState ? 'آماده شدی' : 'آماده نیستی');
  } catch(e){}
}

function toggleMic(){
  try {
    if (!currentRoomId) return;
    if (Date.now() < actionLockUntil) return;
    actionLockUntil = Date.now() + ACTION_LOCK;
    var lobby = getLobbyById(currentRoomId); if (!lobby) return;
    var u = safeGetUser(); if (!u || !u.phone) return;
    var players = Array.isArray(lobby.players) ? lobby.players : [];
    var newState = false;
    for (var i = 0; i < players.length; i++) { if (players[i] && players[i].phone === u.phone) { players[i].micOn = !players[i].micOn; newState = players[i].micOn; break; } }
    var all = getLobbies();
    for (var j = 0; j < all.length; j++) { if (all[j].id === currentRoomId) { all[j].players = players; break; } }
    saveLobbies(all);
    renderRoom(lobby);
    toast(newState ? 'مایک روشن شد' : 'مایک بسته شد');
  } catch(e){}
}

function showFlyingReact(imgSrc, slotEl){
  try {
    if (!slotEl) return;
    var rect = slotEl.getBoundingClientRect();
    var cx = rect.left + rect.width / 2;
    var cy = rect.top + rect.height / 2;
    var img = document.createElement('img');
    img.src = imgSrc;
    img.className = 'flying-react';
    img.style.left = cx + 'px';
    img.style.top = cy + 'px';
    document.body.appendChild(img);
    setTimeout(function(){ if (img.parentNode) img.parentNode.removeChild(img); }, 1800);
  } catch(e){}
}

var reactionLockUntil = 0;
function toggleLike(type){
  try {
    if (!currentRoomId) return;
    var now = Date.now();
    if (now < reactionLockUntil) { var rem = Math.ceil((reactionLockUntil - now) / 1000); toast(rem + ' ثانیه صبر کن'); return; }
    reactionLockUntil = now + REACTION_COOLDOWN;
    if (Date.now() < actionLockUntil) return;
    actionLockUntil = Date.now() + ACTION_LOCK;
    var lobby = getLobbyById(currentRoomId); if (!lobby) return;
    var u = safeGetUser(); if (!u || !u.phone) return;
    var players = Array.isArray(lobby.players) ? lobby.players : [];
    var mySlot = null;
    for (var i = 0; i < players.length; i++) { if (players[i] && players[i].phone === u.phone) { mySlot = players[i]; break; } }
    if (!mySlot) return;
    if (typeof mySlot.likeVote !== 'number') mySlot.likeVote = 0;
    if (type === 'like') { if (mySlot.likeVote === 1) mySlot.likeVote = 0; else mySlot.likeVote = 1; }
    else { if (mySlot.likeVote === -1) mySlot.likeVote = 0; else mySlot.likeVote = -1; }
    var newVote = mySlot.likeVote;
    var slotEl = findMySlot();
    if (slotEl) { if (newVote === 1) showFlyingReact('Po2.webp', slotEl); else if (newVote === -1) showFlyingReact('Po3.webp', slotEl); }
    var all = getLobbies();
    for (var j = 0; j < all.length; j++) { if (all[j].id === currentRoomId) { all[j].players = players; break; } }
    saveLobbies(all);
    renderRoom(lobby);
    updateMyButtonsState(lobby);
  } catch(e){}
}

function findMySlot(){
  try {
    var u = safeGetUser(); if (!u || !u.phone) return null;
    var area = $('roomGridArea'); if (!area) return null;
    var lobby = currentRoomId ? getLobbyById(currentRoomId) : null; if (!lobby) return null;
    var players = Array.isArray(lobby.players) ? lobby.players : [];
    var myIndex = -1;
    for (var i = 0; i < players.length; i++) { if (players[i] && players[i].phone === u.phone) { myIndex = i; break; } }
    if (myIndex < 0) return null;
    var slots = area.querySelectorAll('.player-slot');
    return slots[myIndex] || null;
  } catch(e){ return null; }
}

function openOwnProfile(){
  try {
    var u = safeGetUser(); if (!u) return;
    var ppTitle = $('ppTitle'); if (ppTitle) ppTitle.textContent = 'مشخصات کاربری';
    var av = $('ppAvatar'); if (av) av.src = u.avatar || 'Av.jpg';
    var nameWrap = $('ppNameWrap');
    if (nameWrap) { var crown = (ADMIN_PHONES.indexOf(u.phone) > -1) ? CROWN_SVG : ''; nameWrap.innerHTML = crown + '<span id="ppNameText">' + escapeHtml(u.name || 'کاربر') + '</span>'; }
    var ppc = $('ppUserCode'); if (ppc) ppc.textContent = getUserCode(u.phone);
    var role = getRoleForPhone(u.phone);
    var roleEl = $('ppRoleText'); if (roleEl) roleEl.textContent = ADMIN_ROLE_LABEL[u.phone] || ROLE_LABELS[role] || 'کاربر عادی';
    var checkEl = $('ppCheck'); if (checkEl) { if (role === 'creator' || role === 'developer') checkEl.classList.add('show'); else checkEl.classList.remove('show'); }
    var stats = getStatsForPhone(u.phone); var minutes = getMinutesForPhone(u.phone);
    if ($('ppGames')) $('ppGames').textContent = toFa(stats.games || 0);
    if ($('ppWins')) $('ppWins').textContent = toFa(stats.wins || 0);
    if ($('ppMinutes')) $('ppMinutes').textContent = toFa(minutes || 0);
    if ($('ppScore')) $('ppScore').textContent = toFa(stats.score || 0);
    var actionsRow = $('ppActionsRow'); if (actionsRow) actionsRow.style.display = 'none';
    var overlay = $('playerProfileMenu'); if (overlay) overlay.classList.add('active');
  } catch(e){}
}

var miniMenuPlayer = null; var miniMenuOwner = false;
function openMiniMenu(player, isOwner){ try { miniMenuPlayer = player; miniMenuOwner = isOwner; var title = $('miniMenuTitle'); if (title) title.textContent = player.name || 'کاربر'; var mm = $('miniMenu'); if (mm) mm.classList.add('active'); } catch(e){} }
function closeMiniMenu(){ var mm = $('miniMenu'); if (mm) mm.classList.remove('active'); miniMenuPlayer = null; miniMenuOwner = false; }

async function openOtherProfile(player, isOwner){
  try {
    if (!player || !player.phone) return;
    var ppTitle = $('ppTitle'); if (ppTitle) ppTitle.textContent = 'مشخصات کاربری';
    var av = $('ppAvatar'); if (av) { av.src = player.avatar || 'Av.jpg'; av.onerror = function(){ this.src = 'Av.jpg'; }; }
    var nameWrap = $('ppNameWrap');
    if (nameWrap) { var crown = isOwner ? CROWN_SVG : ''; nameWrap.innerHTML = crown + '<span id="ppNameText">' + escapeHtml(player.name || 'کاربر') + '</span>'; }
    var ppc = $('ppUserCode'); if (ppc) { var c = getUserCode(player.phone); if (c === '---') { try { var cl = await getCloud('usercode:' + player.phone); if (cl) { c = cl; localStorage.setItem('sag_usercode_' + player.phone, cl); } } catch(e){} } ppc.textContent = c; }
    var role = getRoleForPhone(player.phone);
    try { var r = await getCloud('role:' + player.phone); if (r) { role = r; localStorage.setItem('sag_roles_' + player.phone, r); } } catch(e){}
    var roleEl = $('ppRoleText'); if (roleEl) roleEl.textContent = ADMIN_ROLE_LABEL[player.phone] || ROLE_LABELS[role] || 'کاربر عادی';
    var checkEl = $('ppCheck'); if (checkEl) { if (role === 'creator' || role === 'developer') checkEl.classList.add('show'); else checkEl.classList.remove('show'); }
    var stats = getStatsForPhone(player.phone); var minutes = getMinutesForPhone(player.phone);
    try { var rs = await getCloud('stats:' + player.phone); if (rs) { var ps = JSON.parse(rs); stats = { games: ps.games || 0, wins: ps.wins || 0, score: ps.score || 0 }; localStorage.setItem('sag_stats_' + player.phone, rs); } } catch(e){}
    try { var rm = await getCloud('mins:' + player.phone); if (rm) { minutes = parseInt(rm, 10) || 0; localStorage.setItem('sag_minutes_' + player.phone, rm); } } catch(e){}
    if ($('ppGames')) $('ppGames').textContent = toFa(stats.games || 0);
    if ($('ppWins')) $('ppWins').textContent = toFa(stats.wins || 0);
    if ($('ppMinutes')) $('ppMinutes').textContent = toFa(minutes || 0);
    if ($('ppScore')) $('ppScore').textContent = toFa(stats.score || 0);
    var actionsRow = $('ppActionsRow'); if (actionsRow) actionsRow.style.display = 'none';
    var overlay = $('playerProfileMenu'); if (overlay) overlay.classList.add('active');
  } catch(e){}
}
function closePlayerProfile(){ var overlay = $('playerProfileMenu'); if (overlay) overlay.classList.remove('active'); }

var reportTarget = null; var selectedReportReason = '';
var REPORT_REASONS = ['توهین و بی‌احترامی', 'استفاده از الفاظ رکیک', 'تقلب در بازی', 'مزاحمت و آزار', 'تبلیغات ناخواسته', 'سایر موارد'];

function openReportModal(player){
  try {
    if (!player || !player.phone) return;
    reportTarget = player; selectedReportReason = '';
    var nameEl = $('reportTargetName'); if (nameEl) nameEl.textContent = player.name || 'کاربر';
    var reasonsWrap = $('reportReasons');
    if (reasonsWrap) {
      reasonsWrap.innerHTML = '';
      for (var i = 0; i < REPORT_REASONS.length; i++) {
        (function(reason){
          var btn = document.createElement('button');
          btn.className = 'report-reason-btn'; btn.textContent = reason;
          btn.onclick = function(){ selectedReportReason = reason; var all = reasonsWrap.querySelectorAll('.report-reason-btn'); for (var k = 0; k < all.length; k++) all[k].classList.remove('selected'); btn.classList.add('selected'); };
          reasonsWrap.appendChild(btn);
        })(REPORT_REASONS[i]);
      }
    }
    var rm = $('reportModal'); if (rm) rm.classList.add('active');
  } catch(e){}
}
function closeReportModal(){ var rm = $('reportModal'); if (rm) rm.classList.remove('active'); reportTarget = null; selectedReportReason = ''; }
function sendReport(){
  try {
    if (!reportTarget) return;
    if (!selectedReportReason) { toast('لطفاً دلیل گزارش را انتخاب کن'); return; }
    var u = safeGetUser(); if (!u) return;
    var reports = getReports();
    reports.push({ id: genId(), reporterPhone: u.phone, reporterName: u.name || 'کاربر', targetPhone: reportTarget.phone, targetName: reportTarget.name || 'کاربر', reason: selectedReportReason, createdAt: new Date().toISOString(), status: 'pending' });
    saveReports(reports); closeReportModal(); updateAdminBadge(); updateAdminTabsBadges();
    toast('گزارش ارسال شد');
  } catch(e){ toast('خطا در ارسال گزارش'); }
}

var currentFilter = '';
function renderLobbies(){
  try {
    var wrap = $('lobbiesList'); if (!wrap) return;
    wrap.innerHTML = '';
    var all = getLobbies();
    var visible = all.slice();
    if (currentFilter) { var q = currentFilter.toLowerCase(); visible = visible.filter(function(l){ return (l.name && l.name.toLowerCase().indexOf(q) > -1) || (l.code && String(l.code).indexOf(q) > -1); }); }
    if (visible.length === 0) {
      var empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.innerHTML = '<div class="empty-icon"><svg viewBox="0 0 24 24" fill="none"><rect x="3" y="6" width="18" height="13" rx="2" stroke="#4a7ba8" stroke-width="2" fill="none"/><path d="M8 3v4M16 3v4" stroke="#4a7ba8" stroke-width="2" stroke-linecap="round"/><circle cx="9" cy="13" r="1.5" fill="#4a7ba8"/><circle cx="15" cy="13" r="1.5" fill="#4a7ba8"/></svg></div>' +
        '<div class="empty-text">' + (currentFilter ? 'لابی پیدا نشد' : 'هنوز لابی‌ای نیست') + '</div>' +
        '<div class="empty-sub">' + (currentFilter ? 'با نام دیگری امتحان کن' : 'با دکمه + پایین لابی بساز') + '</div>';
      wrap.appendChild(empty); return;
    }
    var title = document.createElement('div');
    title.className = 'section-title';
    title.textContent = (currentFilter ? 'نتایج جستجو' : 'لابی‌های فعال') + ' (' + visible.length + ')';
    wrap.appendChild(title);
    var frag = document.createDocumentFragment();
    for (var i = 0; i < visible.length; i++) { try { var c = buildLobbyCard(visible[i]); if (c) frag.appendChild(c); } catch(e){} }
    wrap.appendChild(frag);
  } catch(e){}
}
function buildLobbyCard(lobby){
  var card = document.createElement('div');
  card.className = 'lobby-card';
  var players = Array.isArray(lobby.players) ? lobby.players : [];
  var occupied = players.length;
  var isFull = occupied >= MAX_SLOTS;
  var btnClass = isFull ? 'locked' : '';
  var btnText = isFull ? 'پر' : 'پیوستن';
  var counterText = occupied + '/' + MAX_SLOTS;
  var lockHtml = '';
  if (lobby.isPrivate && lockImgReady) lockHtml = '<img src="Go1.webp" class="lc-lock" alt="قفل">';
  card.innerHTML = '<div class="lc-left"><div class="lc-name-row"><span class="lc-name-tag">لابی</span><span class="lc-name">' + escapeHtml(lobby.name || 'بی‌نام') + '</span></div><div class="lc-code">' + escapeHtml(lobby.code || '') + '</div></div><div class="lc-divider"></div><div class="lc-right"><div class="lc-top-row">' + lockHtml + '<div class="lc-counter">' + counterText + '</div></div><button class="lc-join ' + btnClass + '">' + btnText + '</button></div>';
  var joinBtn = card.querySelector('.lc-join');
  if (joinBtn) { joinBtn.addEventListener('click', function(e){ e.stopPropagation(); if (isFull) { toast('لابی پر است'); return; } if (lobby.isPrivate && lobby.password) openPasswordModal(lobby); else joinLobby(lobby); }); }
  return card;
}

var passwordLobby = null;
function openPasswordModal(lobby){ passwordLobby = lobby; var pi = $('passwordInput'); if (pi) pi.value = ''; var pe = $('pwError'); if (pe) pe.textContent = ''; var pm = $('passwordModal'); if (pm) pm.classList.add('active'); setTimeout(function(){ try { if (pi) pi.focus(); } catch(e){} }, 300); }
function closePasswordModal(){ var pm = $('passwordModal'); if (pm) pm.classList.remove('active'); passwordLobby = null; }
function tryPassword(){ if (!passwordLobby) return; var pi = $('passwordInput'); if (!pi) return; var pwd = pi.value.trim(); if (pwd === passwordLobby.password) { var lb = passwordLobby; closePasswordModal(); joinLobby(lb); } else { var pe = $('pwError'); if (pe) pe.textContent = 'رمز وارد شده درست نیست'; pi.value = ''; } }

var joinLockUntil = 0;
function joinLobby(lobby){
  try {
    var u = safeGetUser(); if (!u || !u.phone) { toast('ابتدا وارد شوید'); return; }
    if (Date.now() < joinLockUntil) return;
    joinLockUntil = Date.now() + 2000;
    if (currentRoomId === lobby.id) return;
    var all = getLobbies();
    for (var i = 0; i < all.length; i++) {
      if (all[i].id === lobby.id) {
        if (!Array.isArray(all[i].players)) all[i].players = [];
        var alreadyIn = false;
        for (var j = 0; j < all[i].players.length; j++) { if (all[i].players[j] && all[i].players[j].phone === u.phone) { alreadyIn = true; break; } }
        if (!alreadyIn) { if (all[i].players.length >= MAX_SLOTS) { toast('لابی پر است'); return; } all[i].players.push({ phone: u.phone, name: u.name || 'کاربر', avatar: u.avatar || 'Av.jpg', ready: false, micOn: false, likeVote: 0 }); }
        saveLobbies(all);
        showRoomView(all[i].id);
        toast('به لابی پیوستی');
        return;
      }
    }
    toast('لابی پیدا نشد');
  } catch(e) { toast('خطا در پیوستن'); }
}

function exitRoom(){
  if (!currentRoomId) { showListView(); return; }
  var lobby = getLobbyById(currentRoomId); if (!lobby) { showListView(); return; }
  var u = safeGetUser();
  var isOwner = u && u.phone === lobby.creatorPhone;
  var ct = $('confirmExitText');
  if (ct) ct.textContent = isOwner ? 'شما مالک لابی هستید. با خروج، لابی برای همیشه حذف می‌شود.' : 'آیا می‌خواهی از لابی خارج شوی؟';
  var cm = $('confirmExitModal'); if (cm) cm.classList.add('active');
}
function doExitRoom(){
  if (!currentRoomId) { showListView(); return; }
  var lobby = getLobbyById(currentRoomId); if (!lobby) { showListView(); return; }
  var u = safeGetUser();
  var isOwner = u && u.phone === lobby.creatorPhone;
  if (isOwner) { deleteLobby(currentRoomId); toast('لابی حذف شد'); }
  else {
    var all = getLobbies();
    for (var i = 0; i < all.length; i++) { if (all[i].id === currentRoomId) { if (Array.isArray(all[i].players)) all[i].players = all[i].players.filter(function(p){ return p && p.phone !== u.phone; }); break; } }
    saveLobbies(all);
    toast('از لابی خارج شدی');
  }
  var cm = $('confirmExitModal'); if (cm) cm.classList.remove('active');
  lastRoomSnap = '';
  showListView();
}

var selectedNameIndex = -1; var editingSlotIndex = -1; var isLockOn = false;
function openModal(id){ var el = $(id); if (el) el.classList.add('active'); }
function closeModal(id){ var el = $(id); if (el) el.classList.remove('active'); }

function updateLockToggleIcon(){
  var t = $('lockToggle'); if (!t) return;
  t.innerHTML = '';
  var img = document.createElement('img'); img.src = 'Go1.webp'; img.alt = 'قفل';
  if (isLockOn) { img.style.cssText = 'width:42px;height:42px;object-fit:contain;display:block;filter:brightness(1.3) drop-shadow(0 0 4px #ffd94a)'; t.classList.add('on'); }
  else { img.style.cssText = 'width:42px;height:42px;object-fit:contain;display:block;opacity:.5;filter:grayscale(1)'; t.classList.remove('on'); }
  t.appendChild(img);
}
function openCreateModal(){
  selectedNameIndex = -1;
  var l = $('selectedNameLabel'); if (l) l.textContent = 'انتخاب لابی';
  var s = $('selectNameBtn'); if (s) s.classList.remove('selected');
  var lp = $('lobbyPassword'); if (lp) lp.value = '';
  isLockOn = false; updateLockToggleIcon();
  var pf = $('passwordField'); if (pf) pf.classList.remove('show');
  openModal('createModal');
}
function toggleLock(){
  isLockOn = !isLockOn; updateLockToggleIcon();
  var pf = $('passwordField');
  if (isLockOn) { if (pf) pf.classList.add('show'); setTimeout(function(){ var lp = $('lobbyPassword'); if (lp) lp.focus(); }, 200); }
  else { if (pf) pf.classList.remove('show'); var lp = $('lobbyPassword'); if (lp) lp.value = ''; }
}
function openMyNamesModal(){ renderMyNames(); openModal('myNamesModal'); }
function renderMyNames(){
  var wrap = $('myNamesList'); if (!wrap) return;
  wrap.innerHTML = '';
  var mine = getMyNames();
  for (var i = 0; i < MAX_SLOTS; i++) {
    var slot = mine[i] || { name: '', status: 'empty' };
    var row = document.createElement('div');
    row.className = 'name-slot' + ((i === selectedNameIndex && slot.status === 'active') ? ' selected' : '');
    row.setAttribute('data-idx', i);
    var nameHtml = slot.name ? '<div class="ns-name">' + escapeHtml(slot.name) + '</div>' : '<div class="ns-name empty">خالی</div>';
    var statusHtml = '';
    if (slot.status === 'active') statusHtml = '<div class="ns-status active">فعال</div>';
    else if (slot.status === 'pending') statusHtml = '<div class="ns-status pending">درحال انتظار</div>';
    else if (slot.status === 'rejected') statusHtml = '<div class="ns-status rejected">رد شده</div>';
    row.innerHTML = '<div class="ns-num">' + (i + 1) + '</div><div class="ns-info">' + nameHtml + statusHtml + '</div><button class="ns-edit" data-idx="' + i + '">✎</button>';
    wrap.appendChild(row);
  }
  wrap.onclick = function(e){
    var editBtn = e.target.closest('.ns-edit');
    if (editBtn) { e.stopPropagation(); openNamePicker(parseInt(editBtn.getAttribute('data-idx'), 10)); return; }
    var row = e.target.closest('.name-slot'); if (!row) return;
    var idx = parseInt(row.getAttribute('data-idx'), 10);
    var slotData = getMyNames()[idx];
    if (!slotData || !slotData.name) { toast('این اسلات خالیه'); return; }
    if (slotData.status !== 'active') { toast('این اسم هنوز تایید نشده'); return; }
    selectedNameIndex = idx;
    var l = $('selectedNameLabel'); if (l) l.textContent = slotData.name;
    var s = $('selectNameBtn'); if (s) s.classList.add('selected');
    closeModal('myNamesModal');
  };
}
function openNamePicker(idx){ editingSlotIndex = idx; var mine = getMyNames(); var slot = mine[idx] || { name: '' }; var ni = $('namePickerInput'); if (ni) ni.value = slot.name || ''; var np = $('namePicker'); if (np) np.classList.add('active'); setTimeout(function(){ if (ni) ni.focus(); }, 300); }
function confirmNamePick(){
  var ni = $('namePickerInput'); if (!ni) return;
  var newName = ni.value.trim();
  if (newName.length < 2) { toast('اسم لابی حداقل ۲ حرف باشد'); return; }
  if (newName.length > 15) { toast('اسم لابی حداکثر ۱۵ حرف باشد'); return; }
  var mine = getMyNames();
  var oldName = (mine[editingSlotIndex] || {}).name || '';
  if (oldName !== newName) { var coins = getUserCoins(); if (coins < NAME_COST) { toast('سکه کافی نداری'); return; } setUserCoins(coins - NAME_COST); toast('۱۰۰ سکه کم شد'); }
  mine[editingSlotIndex] = { name: newName, status: 'pending' };
  saveMyNames(mine);
  var reqs = getPendingRequests();
  var u = safeGetUser();
  if (u) { reqs = reqs.filter(function(r){ return !(r && r.phone === u.phone && r.slotIndex === editingSlotIndex); }); reqs.push({ id: genId(), phone: u.phone, creatorName: u.name || 'کاربر', slotIndex: editingSlotIndex, name: newName, createdAt: new Date().toISOString() }); savePendingRequests(reqs); }
  var np = $('namePicker'); if (np) np.classList.remove('active');
  renderMyNames(); updateAdminBadge(); updateAdminTabsBadges();
  toast('اسم برای تایید مدیر ارسال شد');
}

var createLockUntil = 0;
function doCreateLobby(){
  try {
    if (Date.now() < createLockUntil) { toast('صبر کن'); return; }
    createLockUntil = Date.now() + 2500;
    var btn = $('doCreateBtn'); if (btn) { btn.disabled = true; setTimeout(function(){ if (btn) btn.disabled = false; }, 2500); }
    if (selectedNameIndex < 0) { toast('اول باید یه لابی انتخاب کنی'); return; }
    var mine = getMyNames();
    var slot = mine[selectedNameIndex];
    if (!slot || !slot.name) { toast('اسم لابی خالیه'); return; }
    if (slot.status !== 'active') { toast('این اسم هنوز تایید نشده'); return; }
    var password = ''; var isPrivate = false;
    if (isLockOn) { var lp = $('lobbyPassword'); password = lp ? lp.value.trim() : ''; if (password.length < 2) { toast('رمز حداقل ۲ حرف باشد'); return; } isPrivate = true; }
    var u = safeGetUser(); if (!u || !u.phone) { toast('ابتدا وارد شوید'); return; }
    var lobby = { id: genId(), creatorPhone: u.phone, creatorName: u.name || 'کاربر', name: slot.name, isPrivate: isPrivate, password: password, players: [{ phone: u.phone, name: u.name || 'کاربر', avatar: u.avatar || 'Av.jpg', ready: false, micOn: false, likeVote: 0 }], maxPlayers: MAX_SLOTS, createdAt: new Date().toISOString(), code: '#L' + Math.floor(1000 + Math.random() * 9000) };
    var all = getLobbies();
    while (all.some(function(l){ return l.id === lobby.id; })) { lobby.id = genId(); }
    all.push(lobby);
    saveLobbies(all);
    closeModal('createModal');
    lastRoomSnap = '';
    showRoomView(lobby.id);
    toast('لابی ساخته شد');
  } catch(e) { toast('خطا در ساخت لابی'); }
}

var adminTab = 'names';
function updateAdminBadge(){ if (!isAdmin()) return; var reqs = getPendingRequests(); var reps = getReports(); var total = reqs.length + reps.length; var badge = $('adminBadge'); if (!badge) return; if (total > 0) { badge.textContent = total; badge.style.display = 'flex'; } else { badge.style.display = 'none'; } }
function updateAdminTabsBadges(){ if (!isAdmin()) return; var reqs = getPendingRequests(); var reps = getReports(); var tNB = $('tabNamesBadge'); if (tNB) { if (reqs.length > 0) { tNB.textContent = reqs.length; tNB.classList.add('show'); } else tNB.classList.remove('show'); } var tRB = $('tabReportsBadge'); if (tRB) { if (reps.length > 0) { tRB.textContent = reps.length; tRB.classList.add('show'); } else tRB.classList.remove('show'); } }
function openAdminPanel(){ if (!isAdmin()) { toast('دسترسی ندارید'); return; } renderAdminContent(); updateAdminTabsBadges(); openModal('adminPanel'); }
function switchAdminTab(tab){ adminTab = tab; var t1 = $('tabNamesBtn'), t2 = $('tabReportsBtn'); if (t1) t1.classList.remove('active'); if (t2) t2.classList.remove('active'); if (tab === 'names' && t1) t1.classList.add('active'); if (tab === 'reports' && t2) t2.classList.add('active'); renderAdminContent(); }
function renderAdminContent(){ if (adminTab === 'names') renderAdminList(); else renderAdminReportsList(); }
function renderAdminList(){
  var wrap = $('adminList'); if (!wrap) return;
  wrap.innerHTML = '';
  var reqs = getPendingRequests();
  if (reqs.length === 0) { wrap.innerHTML = '<div class="no-pending"><div class="no-pending-icon">✓</div>درخواست نام لابی جدیدی نیست</div>'; return; }
  var frag = document.createDocumentFragment();
  for (var i = 0; i < reqs.length; i++) {
    var req = reqs[i]; if (!req || !req.id) continue;
    var card = document.createElement('div');
    card.className = 'pending-card';
    card.innerHTML = '<div class="pending-name">' + escapeHtml(req.name || '') + '</div><div class="pending-meta">سازنده: <b>' + escapeHtml(req.creatorName || '') + '</b><br>اسلات: <b>' + ((parseInt(req.slotIndex, 10) || 0) + 1) + '</b></div><div class="pending-actions"><button class="btn-accept" data-id="' + escapeHtml(req.id) + '">تایید</button><button class="btn-reject" data-id="' + escapeHtml(req.id) + '">رد</button></div>';
    frag.appendChild(card);
  }
  wrap.appendChild(frag);
  wrap.onclick = function(e){ var acc = e.target.closest('.btn-accept'); if (acc) { approveRequest(acc.getAttribute('data-id')); return; } var rej = e.target.closest('.btn-reject'); if (rej) { rejectRequest(rej.getAttribute('data-id')); } };
}
function renderAdminReportsList(){
  var wrap = $('adminList'); if (!wrap) return;
  wrap.innerHTML = '';
  var reps = getReports();
  if (reps.length === 0) { wrap.innerHTML = '<div class="no-pending"><div class="no-pending-icon">✓</div>گزارشی ثبت نشده</div>'; return; }
  var frag = document.createDocumentFragment();
  for (var i = 0; i < reps.length; i++) {
    var r = reps[i]; if (!r || !r.id) continue;
    var card = document.createElement('div');
    card.className = 'report-card';
    card.innerHTML = '<div class="report-name"><span class="rep-icon">⚠️</span>' + escapeHtml(r.targetName || 'کاربر') + '</div><div class="report-meta">گزارش‌دهنده: <b>' + escapeHtml(r.reporterName || '') + '</b></div><div class="report-reason">دلیل: ' + escapeHtml(r.reason || '') + '</div><div class="report-actions"><button class="rep-dismiss" data-id="' + escapeHtml(r.id) + '">رد گزارش</button><button class="rep-punish" data-id="' + escapeHtml(r.id) + '">تایید و مجازات</button></div>';
    frag.appendChild(card);
  }
  wrap.appendChild(frag);
  wrap.onclick = function(e){ var dis = e.target.closest('.rep-dismiss'); if (dis) { dismissReport(dis.getAttribute('data-id')); return; } var pun = e.target.closest('.rep-punish'); if (pun) { punishReport(pun.getAttribute('data-id')); } };
}
function dismissReport(id){ var reps = getReports().filter(function(r){ return r.id !== id; }); saveReports(reps); renderAdminReportsList(); updateAdminBadge(); updateAdminTabsBadges(); toast('گزارش رد شد'); }
function punishReport(id){ var reps = getReports(); var rep = null; for (var i = 0; i < reps.length; i++) if (reps[i].id === id) { rep = reps[i]; break; } if (!rep) return; var filtered = reps.filter(function(r){ return r.id !== id; }); saveReports(filtered); renderAdminReportsList(); updateAdminBadge(); updateAdminTabsBadges(); toast('کاربر ' + (rep.targetName || '') + ' مجازات شد'); }
function approveRequest(reqId){
  var reqs = getPendingRequests(); var req = null;
  for (var i = 0; i < reqs.length; i++) if (reqs[i].id === reqId) { req = reqs[i]; break; }
  if (!req) return;
  var all = getAllNames();
  var userSlots = all[req.phone]; if (!Array.isArray(userSlots)) userSlots = [];
  while (userSlots.length < MAX_SLOTS) userSlots.push({ name: '', status: 'empty' });
  userSlots[req.slotIndex] = { name: req.name, status: 'active' };
  all[req.phone] = userSlots;
  saveAllNames(all);
  savePendingRequests(reqs.filter(function(r){ return r.id !== reqId; }));
  renderAdminList(); updateAdminBadge(); updateAdminTabsBadges();
  toast('اسم تایید شد');
}
function rejectRequest(reqId){
  var reqs = getPendingRequests(); var req = null;
  for (var i = 0; i < reqs.length; i++) if (reqs[i].id === reqId) { req = reqs[i]; break; }
  if (!req) return;
  var all = getAllNames();
  var userSlots = all[req.phone]; if (!Array.isArray(userSlots)) userSlots = [];
  while (userSlots.length < MAX_SLOTS) userSlots.push({ name: '', status: 'empty' });
  userSlots[req.slotIndex] = { name: req.name, status: 'rejected' };
  all[req.phone] = userSlots;
  saveAllNames(all);
  savePendingRequests(reqs.filter(function(r){ return r.id !== reqId; }));
  renderAdminList(); updateAdminBadge(); updateAdminTabsBadges();
  toast('اسم رد شد');
}

/* ============ POLL (online sync) ============ */
function startPolling(){
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(async function(){
    try {
      if (currentView === 'list') {
        var cloudLobbies = await loadLobbiesFromCloud();
        if (cloudLobbies) renderLobbies();
      } else if (currentView === 'room' && currentRoomId) {
        if (Date.now() < actionLockUntil) return;
        var cloud2 = await loadLobbiesFromCloud();
        if (cloud2) {
          var found = null;
          for (var i = 0; i < cloud2.length; i++) if (cloud2[i].id === currentRoomId) { found = cloud2[i]; break; }
          if (found) {
            var rs = JSON.stringify(found);
            if (rs !== lastRoomSnap) { lastRoomSnap = rs; renderRoom(normalizeLobby(found)); }
          } else { toast('لابی بسته شد'); showListView(); }
        }
      }
    } catch(e){}
  }, POLL_INTERVAL);
}

/* ============ INIT ============ */
async function init(){
  var u = safeGetUser();
  if (!u || !u.phone) { window.location.href = 'index.html'; return; }
  try { await ensureUserCode(u.phone); } catch(e){}
  try { await loadUserDataFromCloud(u.phone); } catch(e){}
  try { await loadLobbiesFromCloud(); } catch(e){}

  var bb = $('backBtn'); if (bb) bb.addEventListener('click', function(){ if (currentView === 'room') { exitRoom(); return; } window.location.href = 'Safe Asli Go.html'; });
  var rbb = $('roomBackBtn'); if (rbb) rbb.addEventListener('click', exitRoom);

  var si = $('searchInput'); var searchTimer = null;
  if (si) si.addEventListener('input', function(){ var val = this.value.trim(); clearTimeout(searchTimer); searchTimer = setTimeout(function(){ currentFilter = val; renderLobbies(); }, 250); });

  var ab = $('addBtn'); if (ab) ab.addEventListener('click', openCreateModal);
  var snb = $('selectNameBtn'); if (snb) snb.addEventListener('click', openMyNamesModal);
  var lt = $('lockToggle'); if (lt) lt.addEventListener('click', toggleLock);
  var dcb = $('doCreateBtn'); if (dcb) dcb.addEventListener('click', doCreateLobby);

  document.querySelectorAll('[data-close]').forEach(function(btn){ btn.addEventListener('click', function(){ closeModal(this.getAttribute('data-close')); }); });
  document.querySelectorAll('.modal').forEach(function(m){ m.addEventListener('click', function(e){ if (e.target === m) closeModal(m.id); }); });

  var npc = $('npCancel'); if (npc) npc.addEventListener('click', function(){ $('namePicker').classList.remove('active'); });
  var npk = $('npConfirm'); if (npk) npk.addEventListener('click', confirmNamePick);
  var pwc = $('pwCancel'); if (pwc) pwc.addEventListener('click', closePasswordModal);
  var pwo = $('pwOk'); if (pwo) pwo.addEventListener('click', tryPassword);
  var pwi = $('passwordInput'); if (pwi) pwi.addEventListener('keypress', function(e){ if (e.key === 'Enter') tryPassword(); });
  var pwm = $('passwordModal'); if (pwm) pwm.addEventListener('click', function(e){ if (e.target === this) closePasswordModal(); });

  var adb = $('adminBtn'); if (adb) adb.addEventListener('click', openAdminPanel);
  if (isAdmin()) { var adb2 = $('adminBtn'); if (adb2) adb2.classList.add('show'); }

  var tnb = $('tabNamesBtn'); if (tnb) tnb.addEventListener('click', function(){ switchAdminTab('names'); });
  var trb = $('tabReportsBtn'); if (trb) trb.addEventListener('click', function(){ switchAdminTab('reports'); });

  var ccb = $('confCancelBtn'); if (ccb) ccb.addEventListener('click', function(){ $('confirmExitModal').classList.remove('active'); });
  var ceb = $('confExitBtn'); if (ceb) ceb.addEventListener('click', doExitRoom);
  var cem = $('confirmExitModal'); if (cem) cem.addEventListener('click', function(e){ if (e.target === this) this.classList.remove('active'); });

  var ppc = $('playerProfileCloseBtn'); if (ppc) ppc.addEventListener('click', closePlayerProfile);
  var ppm = $('playerProfileMenu'); if (ppm) ppm.addEventListener('click', function(e){ if (e.target === ppm) closePlayerProfile(); });

  var mc = $('miniCancelBtn'); if (mc) mc.addEventListener('click', closeMiniMenu);
  var mm = $('miniMenu'); if (mm) mm.addEventListener('click', function(e){ if (e.target === mm) closeMiniMenu(); });
  var mp = $('miniProfileBtn'); if (mp) mp.addEventListener('click', function(){ var p = miniMenuPlayer; var o = miniMenuOwner; closeMiniMenu(); setTimeout(function(){ openOtherProfile(p, o); }, 150); });
  var mr = $('miniReportBtn'); if (mr) mr.addEventListener('click', function(){ var p = miniMenuPlayer; closeMiniMenu(); setTimeout(function(){ openReportModal(p); }, 150); });

  var rpc = $('rpCancelBtn'); if (rpc) rpc.addEventListener('click', closeReportModal);
  var rps = $('rpSendBtn'); if (rps) rps.addEventListener('click', sendReport);
  var rpm = $('reportModal'); if (rpm) rpm.addEventListener('click', function(e){ if (e.target === rpm) closeReportModal(); });

  var micB = $('micBtn'); if (micB) micB.addEventListener('click', toggleMic);
  var likeB = $('likeBtn'); if (likeB) likeB.addEventListener('click', function(){ toggleLike('like'); });
  var dislikeB = $('dislikeBtn'); if (dislikeB) dislikeB.addEventListener('click', function(){ toggleLike('dislike'); });

  updateLockToggleIcon();
  renderLobbies();
  updateAdminBadge();
  updateAdminTabsBadges();
  startPolling();

  document.addEventListener('gesturestart', function(e){ e.preventDefault(); });
  document.addEventListener('contextmenu', function(e){ e.preventDefault(); });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();

})();