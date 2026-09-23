(function(){'use strict';
var UPSTASH_URL="https://holy-hamster-122717.upstash.io";
var UPSTASH_TOKEN="gQAAAAAAAd9dAAIgcDFlNmYwM2VkZDJiM2Y0YWI2ODBmNmIyMTZjMmRkMTZmNg";
var ADMIN_PHONES=["09908823688","09904844031"];
var ADMIN_FIXED_CODES={"09908823688":"1","09904844031":"2"};
var ADMIN_ROLE_LABEL={"09908823688":"سازنده","09904844031":"برنامه‌نویس"};
var ROLE_LABELS={creator:"سازنده",developer:"برنامه‌نویس",admin:"ادمین",moderator:"ناظر",vip:"کاربر ویژه",user:"کاربر عادی"};
var NAME_COST=100;
var MAX_SLOTS=4;
var REACTION_COOLDOWN=3000;
var REACTION_VISIBLE=2500;
var ACTION_LOCK=1500;
var POLL_INTERVAL=500;
var FRIENDS_PAGE="Safe TalarDs.html";
var CROWN_SVG='<svg class="crown-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 8L7 12L12 4L17 12L21 8V20H3V8Z" fill="#ffd94a" stroke="#b38600" stroke-width="1.5" stroke-linejoin="round"/><circle cx="3" cy="8" r="1.5" fill="#ffd94a" stroke="#b38600" stroke-width="1"/><circle cx="21" cy="8" r="1.5" fill="#ffd94a" stroke="#b38600" stroke-width="1"/><circle cx="12" cy="4" r="1.5" fill="#ffd94a" stroke="#b38600" stroke-width="1"/></svg>';
var lockImgPreload=new Image();
var lockImgReady=!1;
lockImgPreload.onload=function(){lockImgReady=!0;try{renderLobbies()}catch(e){}};
lockImgPreload.src="Go1.webp";
var lastKnownPlayers={};
var recentlyCreated=null;
var kickRedirecting=!1;
var reactionCheckTimer=null;

function $(e){return document.getElementById(e)}
function safeGetUser(){try{return JSON.parse(localStorage.getItem("currentUser")||"null")}catch(e){return null}}
function getCurrentPhone(){var e=safeGetUser();return e&&e.phone?e.phone:null}
function isAdmin(){var e=safeGetUser();return e&&ADMIN_PHONES.indexOf(e.phone)>-1}
function getUserCoins(){var e=safeGetUser();return e&&typeof e.coins=="number"?e.coins:1500}
function setUserCoins(e){var t=safeGetUser();if(!t)return;t.coins=e;try{localStorage.setItem("currentUser",JSON.stringify(t))}catch(e){}}
var toastTimer=null;
function toast(e){try{var t=document.querySelector(".toast-msg");t&&t.parentNode&&t.parentNode.removeChild(t);var o=document.createElement("div");o.className="toast-msg";o.textContent=e;document.body.appendChild(o);clearTimeout(toastTimer);toastTimer=setTimeout(function(){o.parentNode&&o.parentNode.removeChild(o)},1800)}catch(e){}}
function escapeHtml(e){return String(e).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}
function toFa(e){return String(e).replace(/\d/g,function(e){return"۰۱۲۳۴۵۶۷۸۹"[e]})}
function genId(){return"id_"+Date.now()+"_"+Math.random().toString(36).substr(2,6)}
function upstashCmd(e){return fetch(UPSTASH_URL,{method:"POST",headers:{Authorization:"Bearer "+UPSTASH_TOKEN,"Content-Type":"application/json"},body:JSON.stringify(e)}).then(function(e){return e.json()}).catch(function(){return{error:1,result:null}})}
function setCloud(e,t){return upstashCmd(["SET",e,t])}
function getCloud(e){return upstashCmd(["GET",e]).then(function(e){return e&&e.result?e.result:null})}
function ensureUserCode(e){if(!e)return"---";if(ADMIN_FIXED_CODES[e]){localStorage.setItem("sag_usercode_"+e,ADMIN_FIXED_CODES[e]);return ADMIN_FIXED_CODES[e]}var t=localStorage.getItem("sag_usercode_"+e);if(t)return t;try{var o=parseInt(localStorage.getItem("sag_user_counter")||"9",10)+1;localStorage.setItem("sag_user_counter",o.toString());localStorage.setItem("sag_usercode_"+e,o.toString());setCloud("usercode:"+e,o.toString());setCloud("sag_user_counter",o.toString());return o.toString()}catch(e){return"---"}}
function getUserCode(e){if(!e)return"---";if(ADMIN_FIXED_CODES[e])return ADMIN_FIXED_CODES[e];try{var t=localStorage.getItem("sag_usercode_"+e);return t||"---"}catch(e){return"---"}}
function getStatsForPhone(e){try{var t=localStorage.getItem("sag_stats_"+e);if(t){var o=JSON.parse(t);return{games:o.games||0,wins:o.wins||0,score:o.score||0}}}catch(e){}return{games:0,wins:0,score:0}}
function getMinutesForPhone(e){try{return parseInt(localStorage.getItem("sag_minutes_"+e)||"0",10)}catch(e){return 0}}
function getRoleForPhone(e){if(!e)return"user";if(ADMIN_PHONES.indexOf(e)>-1){if(e==="09908823688")return"creator";if(e==="09904844031")return"developer";return"admin"}try{var t=localStorage.getItem("sag_roles_"+e);if(t)return t}catch(e){}return"user"}
function getFrameForPhone(phone){if(!phone)return"Ga.webp";if(phone==="09908823688"||phone==="09904844031")return"Ch1.webp";return"Ga.webp"}

async function loadUserDataFromCloud(e){if(e)try{var t=await getCloud("stats:"+e);t&&localStorage.setItem("sag_stats_"+e,t);var o=await getCloud("mins:"+e);o&&localStorage.setItem("sag_minutes_"+e,o);var n=await getCloud("role:"+e);n&&localStorage.setItem("sag_roles_"+e,n);var s=await getCloud("usercode:"+e);s&&localStorage.setItem("sag_usercode_"+e,s)}catch(e){}}
function getReports(){try{var e=localStorage.getItem("sag_reports");if(!e)return[];var t=JSON.parse(e);return Array.isArray(t)?t:[]}catch(e){return[]}}
function saveReports(e){try{localStorage.setItem("sag_reports",JSON.stringify(e||[]))}catch(e){}setTimeout(function(){try{setCloud("sag_reports",JSON.stringify(e))}catch(e){}},100)}
function normalizeLobby(e){if(!e||typeof e!=="object")return null;Array.isArray(e.players)||(e.players=[]);e.maxPlayers||(e.maxPlayers=MAX_SLOTS);typeof e.isPrivate!="boolean"&&(e.isPrivate=!!(e.password&&String(e.password).length>0));typeof e.password!="string"&&(e.password="");for(var t=0;t<e.players.length;t++){if(e.players[t]){typeof e.players[t].likeVote!="number"&&(e.players[t].likeVote=0);typeof e.players[t].likeVoteExpiry!="number"&&(e.players[t].likeVoteExpiry=0)}}return e}
function getLobbies(){try{var e=localStorage.getItem("sag_lobbies");if(!e)return[];var t=JSON.parse(e);if(!Array.isArray(t))return[];for(var o=[],n=0;n<t.length;n++){var s=normalizeLobby(t[n]);s&&s.id&&o.push(s)}return o}catch(e){return[]}}
function saveLobbies(e,t){try{localStorage.setItem("sag_lobbies",JSON.stringify(e||[]))}catch(e){}var o=function(){try{setCloud("sag_lobbies",JSON.stringify(e))}catch(e){}};t?o():setTimeout(o,30)}
function getLobbyById(e){if(!e)return null;for(var t=getLobbies(),o=0;o<t.length;o++)if(t[o].id===e)return t[o];return null}
function deleteLobby(e){try{saveLobbies(getLobbies().filter(function(t){return t.id!==e}),!0)}catch(e){}}
async function loadLobbiesFromCloud(){try{var e=await getCloud("sag_lobbies");if(e){var t=JSON.parse(e);if(Array.isArray(t)){localStorage.setItem("sag_lobbies",JSON.stringify(t));return t}}}catch(e){}return null}
function getAllNames(){try{var e=localStorage.getItem("sag_all_lobby_names");if(!e)return{};var t=JSON.parse(e);return typeof t!="object"||t===null?{}:t}catch(e){return{}}}
function saveAllNames(e){try{localStorage.setItem("sag_all_lobby_names",JSON.stringify(e))}catch(e){}setTimeout(function(){try{setCloud("sag_all_lobby_names",JSON.stringify(e))}catch(e){}},100)}
function getMyNames(){var e=getCurrentPhone(),t=getAllNames(),o=t[e];Array.isArray(o)||(o=[]);for(;o.length<MAX_SLOTS;)o.push({name:"",status:"empty"});return o}
function saveMyNames(e){var t=getCurrentPhone();if(!t)return;var o=getAllNames();o[t]=e;saveAllNames(o)}
function getPendingRequests(){try{var e=localStorage.getItem("sag_lobby_name_requests");if(!e)return[];var t=JSON.parse(e);return Array.isArray(t)?t:[]}catch(e){return[]}}
function savePendingRequests(e){try{localStorage.setItem("sag_lobby_name_requests",JSON.stringify(e||[]))}catch(e){}setTimeout(function(){try{setCloud("sag_lobby_name_requests",JSON.stringify(e))}catch(e){}},100)}

function normalizeInput(str){
  if(str===undefined||str===null)return"";
  var s=String(str);
  s=s.replace(/[۰-۹]/g,function(d){return String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))});
  s=s.replace(/[٠-٩]/g,function(d){return String("٠١٢٣٤٥٦٧٨٩".indexOf(d))});
  s=s.replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF\u00AD]/g,"");
  s=s.replace(/[〈《「『【〔〖〘〚＜‹❮]/g,"<");
  s=s.replace(/[〉》」』】〕〗〙〛＞›❯]/g,">");
  return s;
}

function getBlockedList(){var e=safeGetUser();if(!e||!e.phone)return[];try{var t=localStorage.getItem("sag_blocked_"+e.phone);if(!t)return[];var o=JSON.parse(t);return Array.isArray(o)?o:[]}catch(e){return[]}}
function saveBlockedList(e){var t=safeGetUser();if(!t||!t.phone)return;try{localStorage.setItem("sag_blocked_"+t.phone,JSON.stringify(e||[]))}catch(e){}setTimeout(function(){try{setCloud("blocked:"+t.phone,JSON.stringify(e||[]))}catch(e){}},100)}
function isBlocked(e){var t=getBlockedList();for(var o=0;o<t.length;o++)if(t[o]&&t[o].phone===e)return!0;return!1}

/* ✅ تغییر ۱: renderBlockList - فقط مالک لابی */
function renderBlockList(){
  var e=$("blockListContent");if(!e)return;
  e.innerHTML="";
  var me=safeGetUser();
  var curLobby=currentRoomId?getLobbyById(currentRoomId):null;
  if(!me||!curLobby||me.phone!==curLobby.creatorPhone){
    e.innerHTML='<div class="no-pending"><div class="no-pending-icon">🚫</div>فقط مالک لابی به این بخش دسترسی دارد</div>';
    return;
  }
  var t=getBlockedList();
  if(t.length===0){
    e.innerHTML='<div class="no-pending"><div class="no-pending-icon">✓</div>لیست مسدودی خالی است</div>';
    return;
  }
  for(var o=document.createDocumentFragment(),i=0;i<t.length;i++){
    var n=t[i];if(!n||!n.phone)continue;
    var s=document.createElement("div");s.className="block-item";
    s.innerHTML='<div class="bi-name">'+escapeHtml(n.name||"کاربر")+'</div><button class="bi-unblock" data-phone="'+escapeHtml(n.phone)+'">رفع مسدودی</button>';
    o.appendChild(s)
  }
  e.appendChild(o);
  e.onclick=function(e){var t=e.target.closest(".bi-unblock");if(!t)return;toggleBlock(t.getAttribute("data-phone"))}
}

function toggleBlock(phone, name){
  var list = getBlockedList();
  var idx = -1;
  for(var i = 0; i < list.length; i++){
    if(list[i] && list[i].phone === phone){ idx = i; break; }
  }
  if(idx > -1){
    list.splice(idx, 1);
    saveBlockedList(list);
    toast("رفع مسدودی شد");
    return;
  }
  list.push({phone: phone, name: name || "کاربر", at: new Date().toISOString()});
  saveBlockedList(list);
  toast("کاربر مسدود شد");
  
  var me = safeGetUser();
  if(!me || !currentRoomId) return;
  var curLobby = getLobbyById(currentRoomId);
  if(!curLobby || me.phone !== curLobby.creatorPhone) return;
  if(phone === me.phone) return;
  
  var lbs = getLobbies();
  var found = false;
  for(var k = 0; k < lbs.length; k++){
    if(lbs[k].id === currentRoomId){
      lbs[k].players = (lbs[k].players || []).filter(function(p){ return p && p.phone !== phone; });
      found = true;
      break;
    }
  }
  if(found){
    actionLockUntil = Date.now() + 2000;
    saveLobbies(lbs, true);
    var upd = getLobbyById(currentRoomId);
    if(upd){
      lastRoomSnap = JSON.stringify(upd);
      renderRoom(upd);
    }
  }
}

function parseColorCodes(input){
  if(!input)return{segments:[],plain:""};
  var str = normalizeInput(input);
  var regex = /<\s*#?\s*([0-9a-fA-F]{3})\s*#?\s*>/g;
  var segments = [];
  var lastIndex = 0;
  var match;
  var currentColor = "";
  var colorCount = 0;
  while((match = regex.exec(str)) !== null){
    if(colorCount >= 4) break;
    var txt = str.substring(lastIndex, match.index);
    if(txt) segments.push({text: txt, color: currentColor});
    var code = match[1];
    currentColor = "#" + code[0]+code[0] + code[1]+code[1] + code[2]+code[2];
    lastIndex = regex.lastIndex;
    colorCount++;
  }
  var remainder = str.substring(lastIndex);
  if(remainder) segments.push({text: remainder, color: currentColor});
  if(segments.length === 0) segments.push({text: str, color: ""});
  var plain = str.replace(/<\s*#?\s*([0-9a-fA-F]{3})\s*#?\s*>/g,"").trim();
  return {segments: segments, plain: plain};
}

function formatLobbyName(name){
  if(!name) return "بی‌نام";
  var parsed = parseColorCodes(name);
  var html = "";
  for(var i = 0; i < parsed.segments.length; i++){
    var s = parsed.segments[i];
    if(!s.text) continue;
    if(s.color){
      html += '<span style="color:' + s.color + ';text-shadow:0 2px 5px rgba(0,0,0,.95);unicode-bidi:isolate">' + escapeHtml(s.text) + '</span>';
    } else {
      html += escapeHtml(s.text);
    }
  }
  return html || escapeHtml(name);
}

var currentRoomId=null;
var currentView="list";
var lastRoomSnap="";
var pollTimer=null;
var actionLockUntil=0;

function showListView(){try{currentRoomId=null;currentView="list";lastRoomSnap="";if(reactionCheckTimer){clearTimeout(reactionCheckTimer);reactionCheckTimer=null}var e=$("roomView");e&&e.classList.remove("active");var t=$("listView");t&&t.classList.add("active");var o=$("bgList");o&&o.classList.remove("hidden");var n=$("bgRoom");n&&n.classList.remove("active");renderLobbies()}catch(e){}}
function showRoomView(e){try{var t=getLobbyById(e);if(!t){toast("لابی پیدا نشد");showListView();return}currentRoomId=e;currentView="room";lastRoomSnap=JSON.stringify(t);var o=$("listView");o&&o.classList.remove("active");var n=$("roomView");n&&n.classList.add("active");var s=$("bgList");s&&s.classList.add("hidden");var a=$("bgRoom");a&&a.classList.add("active");renderRoom(t)}catch(e){showListView()}}

/* ✅ تغییر ۲: renderRoom - مخفی کردن دکمه لیست مسدودی برای غیر مالک */
function renderRoom(e){
  try{
    var t=$("roomLobbyName");t&&(t.innerHTML=formatLobbyName(e.name||"بی‌نام"));
    var me=safeGetUser();
    var blockBtn=$("roomBlockBtn");
    if(blockBtn){
      if(me&&me.phone===e.creatorPhone){blockBtn.style.display="";}
      else{blockBtn.style.display="none";}
    }
    var o=$("roomGridArea");if(!o)return;
    var n=o.querySelectorAll(".player-slot");
    var s=Array.isArray(e.players)?e.players.slice():[];
    for(;s.length<MAX_SLOTS;)s.push(null);
    var a=getCurrentPhone(),r=Date.now();
    for(var i=0;i<n.length&&i<MAX_SLOTS;i++){
      var l=n[i],c=s[i];
      l.innerHTML="";l.classList.remove("has-player","ready-green","ready-red");l.onclick=null;
      if(c&&c.phone){
        var d=c.phone===e.creatorPhone,u=d?CROWN_SVG:"",p=c.phone===a;
        l.classList.add("has-player");
        if(d||c.ready)l.classList.add("ready-green");else l.classList.add("ready-red");
        var m="";c.micOn&&(m='<img src="Po1.webp" class="mic-indicator" alt="صحبت" onerror="this.style.display=\'none\'">');
        var g="";
        if(c.likeVoteExpiry&&r<c.likeVoteExpiry){
          if(c.likeVote===1)g='<img src="Po2.webp" class="slot-reaction" alt="لایک" onerror="this.style.display=\'none\'">';
          else if(c.likeVote===-1)g='<img src="Po3.webp" class="slot-reaction" alt="دیس" onerror="this.style.display=\'none\'">';
        }
        var frameSrc=getFrameForPhone(c.phone);
        l.innerHTML=m+g+'<div class="slot-content"><div class="frame-wrap"><img class="avatar" src="'+escapeHtml(c.avatar||"Av.jpg")+'" alt="" onerror="this.src=\'Av.jpg\'"><img class="frame" src="'+frameSrc+'" alt="" onerror="this.style.display=\'none\'"></div></div><div class="player-name-row">'+u+'<span class="pname">'+escapeHtml(c.name||"کاربر")+"</span></div>";
        (function(e,t,o){l.onclick=function(){o?openOwnProfile():openMiniMenu(e,t)}})(c,d,p)
      }
    }
    renderBottomActions(e);
    updateMyButtonsState(e);
    scheduleNextReactionCheck(e)
  }catch(e){console.error("renderRoom:",e)}
}
function scheduleNextReactionCheck(e){if(reactionCheckTimer){clearTimeout(reactionCheckTimer);reactionCheckTimer=null}var t=Date.now(),o=Infinity,n=Array.isArray(e.players)?e.players:[];for(var i=0;i<n.length;i++){if(n[i]&&n[i].likeVoteExpiry&&n[i].likeVoteExpiry>t&&n[i].likeVoteExpiry<o)o=n[i].likeVoteExpiry}if(o!==Infinity){var s=o-t+120;reactionCheckTimer=setTimeout(function(){if(currentRoomId){var e=getLobbyById(currentRoomId);e&&renderRoom(e)}},s)}}
function renderBottomActions(e){try{var t=$("leftActions");if(!t)return;t.innerHTML="";var o=safeGetUser();if(!o||!o.phone)return;var n=o.phone===e.creatorPhone;if(n){var s=Array.isArray(e.players)?e.players:[];var a=s.length===MAX_SLOTS&&s.every(function(e){return e&&e.ready});var r=document.createElement("button");r.className="action-btn start-btn"+(a?"":" disabled");r.innerHTML='<span class="ab-label">شروع بازی</span>';r.onclick=function(){if(!a){s.length<MAX_SLOTS?toast("باید ۴ نفر پر شود"):toast("همه باید آماده باشند");return}toast("بازی شروع شد!")};t.appendChild(r)}else{var l=null,c=Array.isArray(e.players)?e.players:[];for(var i=0;i<c.length;i++)if(c[i]&&c[i].phone===o.phone){l=c[i];break}var d=!!(l&&l.ready);var u=document.createElement("button");u.className="action-btn ready-btn"+(d?"":" not-ready");u.innerHTML='<span class="ab-label">'+(d?"آماده‌ام":"نیستم")+"</span>";u.onclick=toggleReady;t.appendChild(u)}}catch(e){}}
function updateMyButtonsState(e){
  try{
    var t=safeGetUser();if(!t||!t.phone)return;
    var o=null,n=Array.isArray(e.players)?e.players:[];
    for(var i=0;i<n.length;i++)if(n[i]&&n[i].phone===t.phone){o=n[i];break}
    var s=!!(o&&o.micOn);
    var a=$("micImg");
    if(a){a.src=s?"Po5.webp":"Po4.webp";a.style.transform=s?"scaleX(-1)":"";}
    var r=$("micBtn");r&&(s?r.classList.add("on"):r.classList.remove("on"));
    var l=o&&o.likeVote||0,c=$("likeBtn"),d=$("dislikeBtn");
    c&&(l===1?c.classList.add("active"):c.classList.remove("active"));
    d&&(l===-1?d.classList.add("active"):d.classList.remove("active"))
  }catch(e){}
}
function toggleReady(){try{if(!currentRoomId)return;if(Date.now()<actionLockUntil)return;actionLockUntil=Date.now()+ACTION_LOCK;var e=getLobbyById(currentRoomId);if(!e)return;var t=safeGetUser();if(!t||!t.phone)return;var o=Array.isArray(e.players)?e.players:[],n=!1;for(var i=0;i<o.length;i++)if(o[i]&&o[i].phone===t.phone){o[i].ready=!o[i].ready;n=o[i].ready;break}var s=getLobbies();for(var j=0;j<s.length;j++)if(s[j].id===currentRoomId){s[j].players=o;break}saveLobbies(s,!0);renderRoom(e);toast(n?"آماده شدی":"آماده نیستی")}catch(e){}}
function toggleMic(){try{if(!currentRoomId)return;if(Date.now()<actionLockUntil)return;actionLockUntil=Date.now()+ACTION_LOCK;var e=getLobbyById(currentRoomId);if(!e)return;var t=safeGetUser();if(!t||!t.phone)return;var o=Array.isArray(e.players)?e.players:[],n=!1;for(var i=0;i<o.length;i++)if(o[i]&&o[i].phone===t.phone){o[i].micOn=!o[i].micOn;n=o[i].micOn;break}var s=getLobbies();for(var j=0;j<s.length;j++)if(s[j].id===currentRoomId){s[j].players=o;break}saveLobbies(s,!0);renderRoom(e);toast(n?"مایک روشن شد":"مایک بسته شد")}catch(e){}}
var reactionLockUntil=0;
var reactionTimerInterval=null;
function toggleLike(e){try{if(!currentRoomId)return;var t=Date.now();if(t<reactionLockUntil)return;reactionLockUntil=t+REACTION_COOLDOWN;if(Date.now()<actionLockUntil)return;actionLockUntil=Date.now()+ACTION_LOCK;var o=getLobbyById(currentRoomId);if(!o)return;var n=safeGetUser();if(!n||!n.phone)return;var s=Array.isArray(o.players)?o.players:[],a=null;for(var i=0;i<s.length;i++)if(s[i]&&s[i].phone===n.phone){a=s[i];break}if(!a)return;typeof a.likeVote!="number"&&(a.likeVote=0);if(e==="like")a.likeVote===1?a.likeVote=0:a.likeVote=1;else a.likeVote===-1?a.likeVote=0:a.likeVote=-1;a.likeVote===0?a.likeVoteExpiry=0:a.likeVoteExpiry=Date.now()+REACTION_VISIBLE;var r=getLobbies();for(var j=0;j<r.length;j++)if(r[j].id===currentRoomId){r[j].players=s;break}saveLobbies(r,!0);renderRoom(o);updateMyButtonsState(o);startReactionButtonTimer()}catch(e){}}
function startReactionButtonTimer(){var e=$("likeBtn"),t=$("dislikeBtn");if(!e||!t)return;reactionTimerInterval&&clearInterval(reactionTimerInterval);e.classList.add("cooldown");t.classList.add("cooldown");var o=function(){var n=Math.max(0,Math.ceil((reactionLockUntil-Date.now())/1e3));var s=e.querySelector(".timer-overlay");s||(s=document.createElement("div"),s.className="timer-overlay",e.appendChild(s));var a=t.querySelector(".timer-overlay");a||(a=document.createElement("div"),a.className="timer-overlay",t.appendChild(a));if(n>0){s.textContent=n;a.textContent=n;s.style.display="flex";a.style.display="flex"}else{s.style.display="none";a.style.display="none";clearInterval(reactionTimerInterval);reactionTimerInterval=null;e.classList.remove("cooldown");t.classList.remove("cooldown")}};o();reactionTimerInterval=setInterval(o,150)}
function renderProfileStatsRow(e){
  var t=document.querySelector("#playerProfileMenu .pm-stats-row");
  if(!t)return;
  var o=getStatsForPhone(e),n=getMinutesForPhone(e);
  var games=o.games||0,wins=o.wins||0;
  t.innerHTML='<div class="pm-stat-square"><img src="Pa3.webp" class="pm-stat-icon" alt=""><div class="pm-stat-value">'+toFa(games)+'</div><div class="pm-stat-label">تعداد بازی</div></div>'+
    '<div class="pm-stat-square"><img src="Pa5.webp" class="pm-stat-icon" alt=""><div class="pm-stat-value">'+toFa(n||0)+'</div><div class="pm-stat-label">دقایق بازی</div></div>'+
    '<div class="pm-stat-square"><img src="Pa4.webp" class="pm-stat-icon" alt=""><div class="pm-stat-value">'+toFa(wins)+'</div><div class="pm-stat-label">تعداد برد</div></div>'+
    '<div class="pm-stat-square"><img src="Pa6.webp" class="pm-stat-icon" alt=""><div class="pm-stat-value">'+toFa(o.score||0)+'</div><div class="pm-stat-label">امتیاز</div></div>';
}
function openOwnProfile(){
  try{
    var e=safeGetUser();if(!e)return;
    var t=$("ppTitle");t&&(t.textContent="مشخصات کاربری");
    var o=$("ppAvatar");o&&(o.src=e.avatar||"Av.jpg");
    var frameEl=$("ppFrameImg");
    if(frameEl){frameEl.src=getFrameForPhone(e.phone);frameEl.style.display=""}
    var n=$("ppNameWrap");
    if(n){var s=ADMIN_PHONES.indexOf(e.phone)>-1?CROWN_SVG:"";n.innerHTML=s+'<span id="ppNameText">'+escapeHtml(e.name||"کاربر")+"</span>"}
    var a=$("ppUserCode");a&&(a.textContent=getUserCode(e.phone));
    var r=getRoleForPhone(e.phone);
    var l=$("ppRoleText");l&&(l.textContent=ADMIN_ROLE_LABEL[e.phone]||ROLE_LABELS[r]||"کاربر عادی");
    var c=$("ppCheck");c&&(r==="creator"||r==="developer"?c.classList.add("show"):c.classList.remove("show"));
    renderProfileStatsRow(e.phone);
    var d=$("ppActionsRow");d&&(d.style.display="none");
    var u=$("playerProfileMenu");u&&u.classList.add("active")
  }catch(e){}
}
var miniMenuPlayer=null;
var miniMenuOwner=!1;

/* ✅ تغییر ۳: openMiniMenu - دکمه بلاک فقط برای مالک لابی */
function openMiniMenu(e,t){
  try{
    miniMenuPlayer=e;miniMenuOwner=t;
    var o=$("miniMenuTitle");o&&(o.textContent=e.name||"کاربر");
    var n=$("miniKickBtn");n&&n.parentNode&&n.parentNode.removeChild(n);
    var s=$("miniTransferBtn");s&&s.parentNode&&s.parentNode.removeChild(s);
    var bkBtns=$("miniBlockBtn");bkBtns&&bkBtns.parentNode&&bkBtns.parentNode.removeChild(bkBtns);
    var a=safeGetUser();
    var r=currentRoomId?getLobbyById(currentRoomId):null;
    var l=r&&a&&a.phone===r.creatorPhone;
    var c=a&&e.phone===a.phone;
    var d=document.querySelector(".mini-menu-box");
    var m=$("miniCancelBtn");
    if(d&&l&&!c){
      var u=document.createElement("button");u.className="mini-menu-btn mm-kick";u.id="miniKickBtn";u.innerHTML='<span class="mm-icon">🚫</span><span>اخراج از لابی</span>';u.onclick=function(){var e=miniMenuPlayer;closeMiniMenu();setTimeout(function(){kickPlayer(e.phone,e.name)},150)};
      var p=document.createElement("button");p.className="mini-menu-btn mm-transfer";p.id="miniTransferBtn";p.innerHTML='<span class="mm-icon">👑</span><span>انتقال مالکیت</span>';p.onclick=function(){var e=miniMenuPlayer;closeMiniMenu();setTimeout(function(){transferOwnership(e.phone,e.name)},150)};
      if(m){d.insertBefore(u,m);d.insertBefore(p,m)}else{d.appendChild(u);d.appendChild(p)}
    }
    /* ✅ دکمه بلاک فقط برای مالک لابی (l) — نه ادمین */
    if(d&&!c&&l){
      var alreadyBlocked=isBlocked(e.phone);
      var bk=document.createElement("button");
      bk.className="mini-menu-btn "+(alreadyBlocked?"mm-unblock":"mm-block");
      bk.id="miniBlockBtn";
      bk.innerHTML='<span class="mm-icon">'+(alreadyBlocked?'✓':'🚫')+'</span><span>'+(alreadyBlocked?'رفع مسدودی':'مسدود کردن')+'</span>';
      bk.onclick=function(){var p=miniMenuPlayer;closeMiniMenu();setTimeout(function(){toggleBlock(p.phone,p.name)},150)};
      if(m){d.insertBefore(bk,m)}else{d.appendChild(bk)}
    }
    var g=$("miniMenu");g&&g.classList.add("active")
  }catch(e){}
}
function closeMiniMenu(){
  var e=$("miniMenu");e&&e.classList.remove("active");
  miniMenuPlayer=null;miniMenuOwner=!1;
  var t=$("miniKickBtn");t&&t.parentNode&&t.parentNode.removeChild(t);
  var o=$("miniTransferBtn");o&&o.parentNode&&o.parentNode.removeChild(o);
  var bk=$("miniBlockBtn");bk&&bk.parentNode&&bk.parentNode.removeChild(bk);
}
function kickPlayer(e,t){try{if(!currentRoomId)return;var o=getLobbyById(currentRoomId);if(!o)return;var n=safeGetUser();if(!n||n.phone!==o.creatorPhone){toast("فقط مالک لابی می‌تواند اخراج کند");return}if(e===n.phone){toast("نمی‌توانی خودت را اخراج کنی");return}var s=getLobbies();for(var i=0;i<s.length;i++)if(s[i].id===currentRoomId){s[i].players=s[i].players.filter(function(t){return t&&t.phone!==e});break}actionLockUntil=Date.now()+2000;saveLobbies(s,!0);var a=getLobbyById(currentRoomId);a&&renderRoom(a);toast("کاربر "+(t||"")+" اخراج شد")}catch(e){toast("خطا در اخراج")}}
function transferOwnership(e,t){try{if(!currentRoomId)return;var o=getLobbyById(currentRoomId);if(!o)return;var n=safeGetUser();if(!n||n.phone!==o.creatorPhone){toast("فقط مالک لابی می‌تواند مالکیت را منتقل کند");return}if(e===n.phone){toast("خودت مالک هستی");return}var s=getLobbies();for(var i=0;i<s.length;i++)if(s[i].id===currentRoomId){var a=s[i].players,r=-1,l=-1;for(var j=0;j<a.length;j++){a[j]&&a[j].phone===n.phone&&(r=j);a[j]&&a[j].phone===e&&(l=j)}if(r<0||l<0){toast("کاربر پیدا نشد");return}var c=a[r];a[r]=a[l];a[l]=c;s[i].creatorPhone=e;s[i].creatorName=a[r].name||t||"کاربر";break}saveLobbies(s,!0);var d=getLobbyById(currentRoomId);d&&renderRoom(d);toast("مالکیت به "+(t||"")+" منتقل شد")}catch(e){toast("خطا در انتقال مالکیت")}}
async function openOtherProfile(e,t){
  try{
    if(!e||!e.phone)return;
    var o=$("ppTitle");o&&(o.textContent="مشخصات کاربری");
    var n=$("ppAvatar");n&&(n.src=e.avatar||"Av.jpg",n.onerror=function(){this.src="Av.jpg"});
    var frameEl=$("ppFrameImg");
    if(frameEl){frameEl.src=getFrameForPhone(e.phone);frameEl.style.display=""}
    var s=$("ppNameWrap");
    if(s){var a=t?CROWN_SVG:"";s.innerHTML=a+'<span id="ppNameText">'+escapeHtml(e.name||"کاربر")+"</span>"}
    var r=$("ppUserCode");
    if(r){var l=getUserCode(e.phone);if(l==="---")try{var c=await getCloud("usercode:"+e.phone);c&&(l=c,localStorage.setItem("sag_usercode_"+e.phone,c))}catch(e){}r.textContent=l}
    var d=getRoleForPhone(e.phone);
    try{var u=await getCloud("role:"+e.phone);u&&(d=u,localStorage.setItem("sag_roles_"+e.phone,u))}catch(e){}
    var p=$("ppRoleText");p&&(p.textContent=ADMIN_ROLE_LABEL[e.phone]||ROLE_LABELS[d]||"کاربر عادی");
    var m=$("ppCheck");m&&(d==="creator"||d==="developer"?m.classList.add("show"):m.classList.remove("show"));
    try{var g=await getCloud("stats:"+e.phone);g&&localStorage.setItem("sag_stats_"+e.phone,g)}catch(e){}
    try{var h=await getCloud("mins:"+e.phone);h&&localStorage.setItem("sag_minutes_"+e.phone,h)}catch(e){}
    renderProfileStatsRow(e.phone);
    var f=$("ppActionsRow");f&&(f.style.display="none");
    var v=$("playerProfileMenu");v&&v.classList.add("active")
  }catch(e){}
}
function closePlayerProfile(){var e=$("playerProfileMenu");e&&e.classList.remove("active")}
var reportTarget=null;
var selectedReportReason="";
var REPORT_REASONS=["توهین و بی‌احترامی","استفاده از الفاظ رکیک","تقلب در بازی","مزاحمت و آزار","تبلیغات ناخواسته","سایر موارد"];
function openReportModal(e){try{if(!e||!e.phone)return;reportTarget=e;selectedReportReason="";var t=$("reportTargetName");t&&(t.textContent=e.name||"کاربر");var o=$("reportReasons");if(o){o.innerHTML="";for(var i=0;i<REPORT_REASONS.length;i++)!function(e){var t=document.createElement("button");t.className="report-reason-btn";t.textContent=e;t.onclick=function(){selectedReportReason=e;for(var t=o.querySelectorAll(".report-reason-btn"),n=0;n<t.length;n++)t[n].classList.remove("selected");this.classList.add("selected")};o.appendChild(t)}(REPORT_REASONS[i])}var n=$("reportModal");n&&n.classList.add("active")}catch(e){}}
function closeReportModal(){var e=$("reportModal");e&&e.classList.remove("active");reportTarget=null;selectedReportReason=""}
function sendReport(){try{if(!reportTarget)return;if(!selectedReportReason){toast("لطفاً دلیل گزارش را انتخاب کن");return}var e=safeGetUser();if(!e)return;var t=getReports();t.push({id:genId(),reporterPhone:e.phone,reporterName:e.name||"کاربر",targetPhone:reportTarget.phone,targetName:reportTarget.name||"کاربر",reason:selectedReportReason,createdAt:new Date().toISOString(),status:"pending"});saveReports(t);closeReportModal();updateAdminBadge();updateAdminTabsBadges();toast("گزارش ارسال شد")}catch(e){toast("خطا در ارسال گزارش")}}
var currentFilter="";
function renderLobbies(){
  try{
    var e=$("lobbiesList");if(!e)return;e.innerHTML="";
    var t=getLobbies(),o=t.slice();
    if(currentFilter){
      var n=currentFilter.toLowerCase();
      o=o.filter(function(e){var pn=parseColorCodes(e.name||"");var rawNorm=normalizeInput(e.name||"").toLowerCase();return(pn.plain&&pn.plain.toLowerCase().indexOf(n)>-1)||(rawNorm&&rawNorm.indexOf(n)>-1)||(e.code&&String(e.code).indexOf(n)>-1)})
    }
    if(o.length===0){var s=document.createElement("div");s.className="empty-state";s.innerHTML='<div class="empty-icon"><svg viewBox="0 0 24 24" fill="none"><rect x="3" y="6" width="18" height="13" rx="2" stroke="#4a7ba8" stroke-width="2" fill="none"/><path d="M8 3v4M16 3v4" stroke="#4a7ba8" stroke-width="2" stroke-linecap="round"/><circle cx="9" cy="13" r="1.5" fill="#4a7ba8"/><circle cx="15" cy="13" r="1.5" fill="#4a7ba8"/></svg></div><div class="empty-text">'+(currentFilter?"لابی پیدا نشد":"هنوز لابی‌ای نیست")+'</div><div class="empty-sub">'+(currentFilter?"با نام دیگری امتحان کن":"با دکمه + پایین لابی بساز")+"</div>";e.appendChild(s);return}
    var a=document.createElement("div");a.className="section-title";a.textContent=(currentFilter?"نتایج جستجو":"لابی‌های فعال")+" ("+o.length+")";e.appendChild(a);
    var r=document.createDocumentFragment();for(var i=0;i<o.length;i++)try{var l=buildLobbyCard(o[i]);l&&r.appendChild(l)}catch(e){}
    e.appendChild(r)
  }catch(e){}
}
function buildLobbyCard(e){
  var t=document.createElement("div");t.className="lobby-card";
  var o=Array.isArray(e.players)?e.players:[],n=o.length,s=n>=MAX_SLOTS,a=s?"locked":"",r=s?"پر":"پیوستن",l=n+"/"+MAX_SLOTS,c="";
  e.isPrivate&&lockImgReady&&(c='<img src="Go1.webp" class="lc-lock" alt="قفل">');
  var d="";for(var i=0;i<o.length;i++)if(o[i]&&o[i].phone===e.creatorPhone){d=o[i].name||"";break}if(!d)d=e.creatorName||"---";
  var nameHtml = formatLobbyName(e.name || "");
  t.innerHTML='<div class="lc-left"><div class="lc-name-row"><span class="lc-name-tag">لابی</span><span class="lc-name">'+nameHtml+'</span></div><div class="lc-code">'+escapeHtml(e.code||"")+'</div></div><div class="lc-divider"></div><div class="lc-right"><div class="lc-top-row">'+c+'<div class="lc-counter">'+l+'</div></div><button class="lc-join '+a+'">'+r+'</button></div><div class="lc-owner-badge"><span class="lc-owner-crown">👑</span><span class="lc-owner-name">'+escapeHtml(d)+"</span></div>";
  var u=t.querySelector(".lc-join");
  return u&&u.addEventListener("click",function(t){t.stopPropagation();if(s){toast("لابی پر است");return}e.isPrivate&&e.password?openPasswordModal(e):joinLobby(e)}),t
}
var passwordLobby=null;
function openPasswordModal(e){passwordLobby=e;var t=$("passwordInput");t&&(t.value="");var o=$("pwError");o&&(o.textContent="");var n=$("passwordModal");n&&n.classList.add("active");setTimeout(function(){try{t&&t.focus()}catch(e){}},300)}
function closePasswordModal(){var e=$("passwordModal");e&&e.classList.remove("active");passwordLobby=null}
function tryPassword(){if(!passwordLobby)return;var e=$("passwordInput");if(!e)return;var t=e.value.trim();if(t===passwordLobby.password){var o=passwordLobby;closePasswordModal();joinLobby(o)}else{var n=$("pwError");n&&(n.textContent="رمز وارد شده درست نیست");e.value=""}}
var joinLockUntil=0;
async function joinLobby(e){
  try{
    var t=safeGetUser();
    if(!t||!t.phone){toast("ابتدا وارد شوید");return}
    if(Date.now()<joinLockUntil)return;
    joinLockUntil=Date.now()+2e3;
    if(currentRoomId===e.id)return;
    try{
      var blockedRaw=await getCloud("blocked:"+e.creatorPhone);
      if(blockedRaw){
        var blockedList=JSON.parse(blockedRaw);
        if(Array.isArray(blockedList)){
          for(var bi=0;bi<blockedList.length;bi++){
            if(blockedList[bi]&&blockedList[bi].phone===t.phone){
              toast("شما توسط مالک این لابی مسدود شده‌اید");
              return;
            }
          }
        }
      }
    }catch(err){}
    var o=getLobbies();
    for(var i=0;i<o.length;i++)if(o[i].id===e.id){
      Array.isArray(o[i].players)||(o[i].players=[]);
      var n=!1;
      for(var j=0;j<o[i].players.length;j++)if(o[i].players[j]&&o[i].players[j].phone===t.phone){n=!0;break}
      if(!n){
        if(o[i].players.length>=MAX_SLOTS){toast("لابی پر است");return}
        o[i].players.push({phone:t.phone,name:t.name||"کاربر",avatar:t.avatar||"Av.jpg",ready:!1,micOn:!1,likeVote:0,likeVoteExpiry:0})
      }
      saveLobbies(o,!0);
      showRoomView(o[i].id);
      toast("به لابی پیوستی");
      return
    }
    toast("لابی پیدا نشد")
  }catch(e){toast("خطا در پیوستن")}
}
function exitRoom(){if(!currentRoomId){showListView();return}var e=getLobbyById(currentRoomId);if(!e){showListView();return}var t=safeGetUser(),o=t&&t.phone===e.creatorPhone,n=$("confirmExitText");n&&(n.textContent=o?"شما مالک لابی هستید. با خروج، لابی برای همیشه حذف می‌شود.":"آیا می‌خواهی از لابی خارج شوی؟");var s=$("confirmExitModal");s&&s.classList.add("active")}
function doExitRoom(){if(!currentRoomId){showListView();return}var e=getLobbyById(currentRoomId);if(!e){showListView();return}var t=safeGetUser(),o=t&&t.phone===e.creatorPhone;if(o){deleteLobby(currentRoomId);toast("لابی حذف شد")}else{var n=getLobbies();for(var i=0;i<n.length;i++)if(n[i].id===currentRoomId){Array.isArray(n[i].players)&&(n[i].players=n[i].players.filter(function(e){return e&&e.phone!==t.phone}));break}saveLobbies(n,!0);toast("از لابی خارج شدی")}var s=$("confirmExitModal");s&&s.classList.remove("active");lastRoomSnap="";recentlyCreated=null;showListView()}
var selectedNameIndex=-1;
var editingSlotIndex=-1;
var isLockOn=!1;
function openModal(e){var t=$(e);t&&t.classList.add("active")}
function closeModal(e){var t=$(e);t&&t.classList.remove("active")}
function updateLockToggleIcon(){var e=$("lockToggle");if(!e)return;e.innerHTML="";var t=document.createElement("img");t.src="Go1.webp";t.alt="قفل";if(isLockOn){t.style.cssText="width:42px;height:42px;object-fit:contain;display:block;filter:brightness(1.3) drop-shadow(0 0 4px #ffd94a)";e.classList.add("on")}else{t.style.cssText="width:42px;height:42px;object-fit:contain;display:block;opacity:.5;filter:grayscale(1)";e.classList.remove("on")}e.appendChild(t)}
function openCreateModal(){selectedNameIndex=-1;var e=$("selectedNameLabel");e&&(e.textContent="انتخاب لابی");var t=$("selectNameBtn");t&&t.classList.remove("selected");var o=$("lobbyPassword");o&&(o.value="");isLockOn=!1;updateLockToggleIcon();var n=$("passwordField");n&&n.classList.remove("show");openModal("createModal")}
function toggleLock(){isLockOn=!isLockOn;updateLockToggleIcon();var e=$("passwordField");if(isLockOn){e&&e.classList.add("show");setTimeout(function(){var e=$("lobbyPassword");e&&e.focus()},200)}else{if(e&&e.classList.remove("show"),$("lobbyPassword"))$("lobbyPassword").value=""}}
function openMyNamesModal(){renderMyNames();openModal("myNamesModal")}
function renderMyNames(){
  var e=$("myNamesList");if(!e)return;e.innerHTML="";
  var t=getMyNames();
  for(var i=0;i<MAX_SLOTS;i++){
    var o=t[i]||{name:"",status:"empty"},n=document.createElement("div");
    n.className="name-slot"+(i===selectedNameIndex&&o.status==="active"?" selected":"");
    n.setAttribute("data-idx",i);
    var dispName = o.name ? formatLobbyName(o.name) : "";
    var s=o.name?'<div class="ns-name">'+dispName+"</div>":'<div class="ns-name empty">خالی</div>',a="";
    o.status==="active"?a='<div class="ns-status active">فعال</div>':o.status==="pending"?a='<div class="ns-status pending">درحال انتظار</div>':o.status==="rejected"&&(a='<div class="ns-status rejected">رد شده</div>');
    n.innerHTML='<div class="ns-num">'+(i+1)+'</div><div class="ns-info">'+s+a+'</div><button class="ns-edit" data-idx="'+i+'">✎</button>';
    e.appendChild(n)
  }
  e.onclick=function(e){var t=e.target.closest(".ns-edit");if(t){e.stopPropagation();openNamePicker(parseInt(t.getAttribute("data-idx"),10));return}var o=e.target.closest(".name-slot");if(!o)return;var n=parseInt(o.getAttribute("data-idx"),10),s=getMyNames()[n];if(!s||!s.name){toast("این اسلات خالیه");return}if(s.status!=="active"){toast("این اسم هنوز تایید نشده");return}selectedNameIndex=n;var a=$("selectedNameLabel");a&&(a.textContent=normalizeInput(s.name));var r=$("selectNameBtn");r&&r.classList.add("selected");closeModal("myNamesModal")}
}
function openNamePicker(e){
  editingSlotIndex=e;
  var t=getMyNames(),o=t[e]||{name:""},n=$("namePickerInput");
  if(n){n.value=o.name||"";updateNamePreview()}
  var s=$("namePicker");s&&s.classList.add("active");
  setTimeout(function(){n&&n.focus()},300)
}
function updateNamePreview(){
  var e=$("namePickerInput"),p=$("namePreview");
  if(!e||!p)return;
  var v=normalizeInput(e.value);
  if(!v.trim()){p.innerHTML="";return}
  p.innerHTML='<div class="np-preview-label">پیش‌نمایش:</div><div class="np-preview-name">'+formatLobbyName(v)+'</div>';
}
function confirmNamePick(){
  var e=$("namePickerInput");
  if(!e)return;
  var t=normalizeInput(e.value).trim();
  if(t.length<2){toast("اسم لابی حداقل ۲ حرف باشد");return}
  if(t.length>60){toast("اسم لابی حداکثر ۶۰ حرف باشد");return}
  var o=getMyNames(),n=(o[editingSlotIndex]||{}).name||"";
  if(n!==t){var s=getUserCoins();if(s<NAME_COST){toast("سکه کافی نداری");return}setUserCoins(s-NAME_COST);toast("۱۰۰ سکه کم شد")}
  o[editingSlotIndex]={name:t,status:"pending"};
  saveMyNames(o);
  var a=getPendingRequests(),r=safeGetUser();
  r&&(a=a.filter(function(e){return!(e&&e.phone===r.phone&&e.slotIndex===editingSlotIndex)}),a.push({id:genId(),phone:r.phone,creatorName:r.name||"کاربر",slotIndex:editingSlotIndex,name:t,createdAt:new Date().toISOString()}),savePendingRequests(a));
  var l=$("namePicker");l&&l.classList.remove("active");
  renderMyNames();
  updateAdminBadge();
  updateAdminTabsBadges();
  toast("اسم برای تایید مدیر ارسال شد")
}
var createLockUntil=0;
function doCreateLobby(){try{if(Date.now()<createLockUntil){toast("صبر کن");return}createLockUntil=Date.now()+2500;var e=$("doCreateBtn");e&&(e.disabled=!0,setTimeout(function(){e&&(e.disabled=!1)},2500));if(selectedNameIndex<0){toast("اول باید یه لابی انتخاب کنی");return}var t=getMyNames(),o=t[selectedNameIndex];if(!o||!o.name){toast("اسم لابی خالیه");return}if(o.status!=="active"){toast("این اسم هنوز تایید نشده");return}var n="",s=!1;if(isLockOn){var a=$("lobbyPassword");if(n=a?a.value.trim():"",n.length<2){toast("رمز حداقل ۲ حرف باشد");return}s=!0}var r=safeGetUser();if(!r||!r.phone){toast("ابتدا وارد شوید");return}var l={id:genId(),creatorPhone:r.phone,creatorName:r.name||"کاربر",name:o.name,isPrivate:s,password:n,players:[{phone:r.phone,name:r.name||"کاربر",avatar:r.avatar||"Av.jpg",ready:!1,micOn:!1,likeVote:0,likeVoteExpiry:0}],maxPlayers:MAX_SLOTS,createdAt:new Date().toISOString(),code:"#L"+Math.floor(1000+Math.random()*9000)};var c=getLobbies();for(;c.some(function(e){return e.id===l.id});)l.id=genId();c.push(l);try{localStorage.setItem("sag_lobbies",JSON.stringify(c))}catch(e){}setCloud("sag_lobbies",JSON.stringify(c));recentlyCreated={id:l.id,until:Date.now()+8e3};actionLockUntil=Date.now()+3e3;closeModal("createModal");lastRoomSnap="";showRoomView(l.id);toast("لابی ساخته شد")}catch(e){toast("خطا در ساخت لابی")}}
var adminTab="names";
function updateAdminBadge(){if(!isAdmin())return;var e=getPendingRequests(),t=getReports(),o=e.length+t.length,n=$("adminBadge");if(n){if(o>0){n.textContent=o;n.style.display="flex"}else n.style.display="none"}}
function updateAdminTabsBadges(){if(!isAdmin())return;var e=getPendingRequests(),t=getReports(),o=$("tabNamesBadge");if(o){if(e.length>0){o.textContent=e.length;o.classList.add("show")}else o.classList.remove("show")}var n=$("tabReportsBadge");if(n){if(t.length>0){n.textContent=t.length;n.classList.add("show")}else n.classList.remove("show")}}
function openAdminPanel(){if(!isAdmin()){toast("دسترسی ندارید");return}renderAdminContent();updateAdminTabsBadges();openModal("adminPanel")}
function switchAdminTab(e){adminTab=e;var t=$("tabNamesBtn"),o=$("tabReportsBtn");t&&t.classList.remove("active");o&&o.classList.remove("active");e==="names"&&t&&t.classList.add("active");e==="reports"&&o&&o.classList.add("active");renderAdminContent()}
function renderAdminContent(){adminTab==="names"?renderAdminList():renderAdminReportsList()}
function renderAdminList(){var e=$("adminList");if(!e)return;e.innerHTML="";var t=getPendingRequests();if(t.length===0){e.innerHTML='<div class="no-pending"><div class="no-pending-icon">✓</div>درخواست نام لابی جدیدی نیست</div>';return}for(var o=document.createDocumentFragment(),i=0;i<t.length;i++){var n=t[i];if(!n||!n.id)continue;var s=document.createElement("div");s.className="pending-card";s.innerHTML='<div class="pending-name">'+formatLobbyName(n.name||"")+'</div><div class="pending-meta">سازنده: <b>'+escapeHtml(n.creatorName||"")+"</b><br>اسلات: <b>"+((parseInt(n.slotIndex,10)||0)+1)+'</b></div><div class="pending-actions"><button class="btn-accept" data-id="'+escapeHtml(n.id)+'">تایید</button><button class="btn-reject" data-id="'+escapeHtml(n.id)+'">رد</button></div>';o.appendChild(s)}e.appendChild(o);e.onclick=function(e){var t=e.target.closest(".btn-accept");if(t){approveRequest(t.getAttribute("data-id"));return}var o=e.target.closest(".btn-reject");o&&rejectRequest(o.getAttribute("data-id"))}}
function renderAdminReportsList(){var e=$("adminList");if(!e)return;e.innerHTML="";var t=getReports();if(t.length===0){e.innerHTML='<div class="no-pending"><div class="no-pending-icon">✓</div>گزارشی ثبت نشده</div>';return}for(var o=document.createDocumentFragment(),i=0;i<t.length;i++){var n=t[i];if(!n||!n.id)continue;var s=document.createElement("div");s.className="report-card";s.innerHTML='<div class="report-name"><span class="rep-icon">⚠️</span>'+escapeHtml(n.targetName||"کاربر")+'</div><div class="report-meta">گزارش‌دهنده: <b>'+escapeHtml(n.reporterName||"")+'</b></div><div class="report-reason">دلیل: '+escapeHtml(n.reason||"")+'</div><div class="report-actions"><button class="rep-dismiss" data-id="'+escapeHtml(n.id)+'">رد گزارش</button><button class="rep-punish" data-id="'+escapeHtml(n.id)+'">تایید و مجازات</button></div>';o.appendChild(s)}e.appendChild(o);e.onclick=function(e){var t=e.target.closest(".rep-dismiss");if(t){dismissReport(t.getAttribute("data-id"));return}var o=e.target.closest(".rep-punish");o&&punishReport(o.getAttribute("data-id"))}}
function dismissReport(e){var t=getReports().filter(function(t){return t.id!==e});saveReports(t);renderAdminReportsList();updateAdminBadge();updateAdminTabsBadges();toast("گزارش رد شد")}
function punishReport(e){var t=getReports(),o=null;for(var i=0;i<t.length;i++)if(t[i].id===e){o=t[i];break}if(!o)return;var n=t.filter(function(t){return t.id!==e});saveReports(n);renderAdminReportsList();updateAdminBadge();updateAdminTabsBadges();toast("کاربر "+(o.targetName||"")+" مجازات شد")}
function approveRequest(e){var t=getPendingRequests(),o=null;for(var i=0;i<t.length;i++)if(t[i].id===e){o=t[i];break}if(!o)return;var n=getAllNames(),s=n[o.phone];Array.isArray(s)||(s=[]);for(;s.length<MAX_SLOTS;)s.push({name:"",status:"empty"});s[o.slotIndex]={name:o.name,status:"active"};n[o.phone]=s;saveAllNames(n);savePendingRequests(t.filter(function(t){return t.id!==e}));renderAdminList();updateAdminBadge();updateAdminTabsBadges();toast("اسم تایید شد")}
function rejectRequest(e){var t=getPendingRequests(),o=null;for(var i=0;i<t.length;i++)if(t[i].id===e){o=t[i];break}if(!o)return;var n=getAllNames(),s=n[o.phone];Array.isArray(s)||(s=[]);for(;s.length<MAX_SLOTS;)s.push({name:"",status:"empty"});s[o.slotIndex]={name:o.name,status:"rejected"};n[o.phone]=s;saveAllNames(n);savePendingRequests(t.filter(function(t){return t.id!==e}));renderAdminList();updateAdminBadge();updateAdminTabsBadges();toast("اسم رد شد")}
function redirectToFriends(e){if(kickRedirecting)return;kickRedirecting=!0;try{var t=document.createElement("div");t.className="kick-notification";t.innerHTML='<span class="kn-icon">🚫</span><span>'+escapeHtml(e||"شما از لابی اخراج شدید")+"</span>";document.body.appendChild(t)}catch(e){}currentRoomId=null;currentView="list";lastRoomSnap="";setTimeout(function(){window.location.href=FRIENDS_PAGE},1200)}
function startPolling(){pollTimer&&clearInterval(pollTimer);pollTimer=setInterval(async function(){try{if(kickRedirecting)return;if(currentView==="list"){var e=await loadLobbiesFromCloud();if(e){if(recentlyCreated&&Date.now()<recentlyCreated.until){var t=!1;for(var o=0;o<e.length;o++)if(e[o].id===recentlyCreated.id){t=!0;break}if(!t){var n=getLobbies();for(var s=0;s<n.length;s++)if(n[s].id===recentlyCreated.id){e.push(n[s]);break}try{localStorage.setItem("sag_lobbies",JSON.stringify(e))}catch(e){}}}renderLobbies()}}else if(currentView==="room"&&currentRoomId){if(Date.now()<actionLockUntil)return;var a=await loadLobbiesFromCloud();if(a){if(recentlyCreated&&Date.now()<recentlyCreated.until){var r=!1;for(var l=0;l<a.length;l++)if(a[l].id===recentlyCreated.id){r=!0;break}if(!r){var c=getLobbies();for(var d=0;d<c.length;d++)if(c[d].id===recentlyCreated.id){a.push(c[d]);break}try{localStorage.setItem("sag_lobbies",JSON.stringify(a))}catch(e){}}}var u=null;for(var p=0;p<a.length;p++)if(a[p].id===currentRoomId){u=a[p];break}if(u){var m=normalizeLobby(u);var g=Array.isArray(m.players)?m.players:[],f=getCurrentPhone();var v=!1;for(var y=0;y<g.length;y++)if(g[y]&&g[y].phone===f){v=!0;break}if(!v){redirectToFriends("شما از لابی اخراج شدید");return}lastKnownPlayers[currentRoomId]=g.map(function(e){return e?e.phone:null}).filter(function(e){return e});var C=JSON.stringify(m);if(C!==lastRoomSnap){lastRoomSnap=C;renderRoom(m)}}else if(!(recentlyCreated&&Date.now()<recentlyCreated.until&&recentlyCreated.id===currentRoomId)){toast("لابی بسته شد");showListView()}}}}catch(e){}},POLL_INTERVAL)}

async function init(){
  var e=safeGetUser();
  if(!e||!e.phone){window.location.href="index.html";return}
  try{await ensureUserCode(e.phone)}catch(e){}
  try{await loadUserDataFromCloud(e.phone)}catch(e){}
  try{await loadLobbiesFromCloud()}catch(e){}

  var t=$("backBtn");t&&t.addEventListener("click",function(){if(currentView==="room"){exitRoom();return}window.location.href="Safe Asli Go.html"});
  var o=$("roomBackBtn");o&&o.addEventListener("click",exitRoom);

  var n=$("searchInput"),s=null;
  n&&n.addEventListener("input",function(){var e=this.value.trim();clearTimeout(s);s=setTimeout(function(){currentFilter=e;renderLobbies()},250)});

  var a=$("addBtn");a&&a.addEventListener("click",openCreateModal);

  var rb=$("refreshBtn");
  rb&&rb.addEventListener("click",async function(){
    var btn=this;
    btn.classList.add("spinning");
    try{
      await loadLobbiesFromCloud();
      renderLobbies();
      toast("لیست لابی‌ها به‌روز شد")
    }catch(e){}
    setTimeout(function(){btn.classList.remove("spinning")},900)
  });

  var rbb=$("roomBlockBtn");
  rbb&&rbb.addEventListener("click",function(){renderBlockList();openModal("blockListModal")});

  var r=$("selectNameBtn");r&&r.addEventListener("click",openMyNamesModal);
  var l=$("lockToggle");l&&l.addEventListener("click",toggleLock);
  var c=$("doCreateBtn");c&&c.addEventListener("click",doCreateLobby);

  var npi=$("namePickerInput");
  npi&&npi.addEventListener("input",updateNamePreview);

  document.querySelectorAll("[data-close]").forEach(function(e){e.addEventListener("click",function(){closeModal(this.getAttribute("data-close"))})});
  document.querySelectorAll(".modal").forEach(function(e){e.addEventListener("click",function(t){t.target===e&&closeModal(e.id)})});

  var d=$("npCancel");d&&d.addEventListener("click",function(){$("namePicker").classList.remove("active")});
  var u=$("npConfirm");u&&u.addEventListener("click",confirmNamePick);

  var p=$("pwCancel");p&&p.addEventListener("click",closePasswordModal);
  var m=$("pwOk");m&&m.addEventListener("click",tryPassword);
  var g=$("passwordInput");g&&g.addEventListener("keypress",function(e){e.key==="Enter"&&tryPassword()});
  var h=$("passwordModal");h&&h.addEventListener("click",function(e){e.target===this&&closePasswordModal()});

  var f=$("adminBtn");f&&f.addEventListener("click",openAdminPanel);
  if(isAdmin()){var v=$("adminBtn");v&&v.classList.add("show")}
  var y=$("tabNamesBtn");y&&y.addEventListener("click",function(){switchAdminTab("names")});
  var b=$("tabReportsBtn");b&&b.addEventListener("click",function(){switchAdminTab("reports")});

  var S=$("confCancelBtn");S&&S.addEventListener("click",function(){$("confirmExitModal").classList.remove("active")});
  var L=$("confExitBtn");L&&L.addEventListener("click",doExitRoom);
  var A=$("confirmExitModal");A&&A.addEventListener("click",function(e){e.target===this&&this.classList.remove("active")});

  var C=$("playerProfileCloseBtn");C&&C.addEventListener("click",closePlayerProfile);
  var _=$("playerProfileMenu");_&&_.addEventListener("click",function(e){e.target===_&&closePlayerProfile()});

  var B=$("miniCancelBtn");B&&B.addEventListener("click",closeMiniMenu);
  var P=$("miniMenu");P&&P.addEventListener("click",function(e){e.target===P&&closeMiniMenu()});
  var M=$("miniProfileBtn");M&&M.addEventListener("click",function(){var e=miniMenuPlayer,t=miniMenuOwner;closeMiniMenu();setTimeout(function(){openOtherProfile(e,t)},150)});
  var E=$("miniReportBtn");E&&E.addEventListener("click",function(){var e=miniMenuPlayer;closeMiniMenu();setTimeout(function(){openReportModal(e)},150)});

  var k=$("rpCancelBtn");k&&k.addEventListener("click",closeReportModal);
  var I=$("rpSendBtn");I&&I.addEventListener("click",sendReport);
  var x=$("reportModal");x&&x.addEventListener("click",function(e){e.target===x&&closeReportModal()});

  var R=$("micBtn");R&&R.addEventListener("click",toggleMic);
  var O=$("likeBtn");O&&O.addEventListener("click",function(){toggleLike("like")});
  var T=$("dislikeBtn");T&&T.addEventListener("click",function(){toggleLike("dislike")});

  updateLockToggleIcon();
  renderLobbies();
  updateAdminBadge();
  updateAdminTabsBadges();
  startPolling();

  document.addEventListener("gesturestart",function(e){e.preventDefault()});
  document.addEventListener("contextmenu",function(e){e.preventDefault()});
}
document.readyState==="loading"?document.addEventListener("DOMContentLoaded",init):init();
})();