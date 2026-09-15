var PAGES = { game: 'Safe Asli Bazi.html', ban: 'Ban.html' };
var CREATOR_PHONE = '09904844031';
var CREATOR_PHONE_FALLBACK = '09904844031';
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

var UPSTASH_OLD_URL = "https://smooth-werewolf-200782.upstash.io";
var UPSTASH_OLD_TOKEN = "gQAAAAAAAxBOAAIgcDFjN2NiMjYxOWNlNjE0NzgyOTExM2JjMjA5ZTc0MjVjMA";
var UPSTASH_NEW_URL = "https://holy-hamster-122717.upstash.io";
var UPSTASH_NEW_TOKEN = "gQAAAAAAAd9dAAIgcDFlNmYwM2VkZDJiM2Y0YWI2ODBmNmIyMTZjMmRkMTZmNg";

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
  return results.some(function(r){ return r.status === 'fulfilled' && r.value === true; });
}
async function redisDel(key) {
  if (!appVerified) return false;
  await Promise.allSettled([
    upstashDel(UPSTASH_OLD_URL, UPSTASH_OLD_TOKEN, key),
    upstashDel(UPSTASH_NEW_URL, UPSTASH_NEW_TOKEN, key)
  ]);
  return true;
}

async function getUser(p) { return await redisGet('user:' + p); }
async function saveUser(p, u) { return await redisSet('user:' + p, u); }
async function getAllUsers() { return await redisGet('all_users') || {}; }
async function saveAllUsers(u) { return await redisSet('all_users', u); }
async function getMaintenance() { return await redisGet('server_maintenance'); }

function isCreatorPhone(phone) {
  return String(phone || '') === CREATOR_PHONE;
}

function getDeviceId() {
  var id = localStorage.getItem('__device_id__');
  if (!id) {
    var parts = [
      navigator.userAgent || 'ua',
      navigator.platform || 'plat',
      screen.width + 'x' + screen.height,
      screen.colorDepth || 24,
      navigator.language || 'fa',
      navigator.hardwareConcurrency || 4,
      new Date().getTimezoneOffset()
    ];
    var raw = parts.join('|'); var hash = 0;
    for (var i = 0; i < raw.length; i++) { hash = ((hash << 5) - hash) + raw.charCodeAt(i); hash = hash & hash; }
    id = 'dev_' + Math.abs(hash) + '_' + Date.now().toString(36);
    localStorage.setItem('__device_id__', id);
  }
  return id;
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

async function getPhoneForDevice(deviceId) {
  if (!deviceId) return null;
  return await redisGet('device_phone:' + deviceId);
}
async function lockDeviceToPhone(deviceId, phone) {
  if (!deviceId || !phone) return false;
  return await redisSet('device_phone:' + deviceId, { phone: phone, lockedAt: Date.now() });
}

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
    if (user.loginHistory.length > 50) user.loginHistory = user.loginHistory.slice(-50);
    user.lastIP = ip;
    user.lastDevice = deviceId;
    user.lastLogin = Date.now();
    await saveUser(phone, user);
    var allUsers = await getAllUsers();
    allUsers[phone] = user;
    await saveAllUsers(allUsers);
  } catch(e) {}
}

function detectMaliciousApps() {
  try {
    var ua = (navigator.userAgent || '').toLowerCase();
    var platform = (navigator.platform || '').toLowerCase();
    var list = [
      'termux','kali','parrot','nethunter','kex','andronix','userland',
      'linuxdeploy','debian','ubuntu','fedora','archlinux','kali-linux',
      'magisk','supersu','xposed','frida','objection','charles','burpsuite',
      'proxydroid','drony','mitmproxy','wireshark','apktool','jadx','dex2jar',
      'gameguardian','lucky-patcher','game-hacker','cheat-engine','xmodgames',
      'httpcanary','packetcapture','tcpdump','nmap','metasploit','sqlmap',
      'hydra','aircrack','hashcat','john the ripper'
    ];
    for (var i = 0; i < list.length; i++) {
      if (ua.indexOf(list[i]) !== -1 || platform.indexOf(list[i]) !== -1) {
        return { detected: true, name: list[i] };
      }
    }
    if (window.TermuxAPI || window.KaliNethunter || window._KALI || window.AndroidTermux) {
      return { detected: true, name: 'root/injection tool' };
    }
    return { detected: false };
  } catch(e) { return { detected: false }; }
}

function showEl(id) { var e = document.getElementById(id); if (e) e.classList.remove('hidden'); }
function hideEl(id) { var e = document.getElementById(id); if (e) e.classList.add('hidden'); }

function showMaliciousAlert(name) {
  var el = document.getElementById('malAppName');
  if (el) el.textContent = name ? ('> ' + name + ' <') : '';
  showEl('maliciousOverlay');
  appVerified = false;
}
function showServerDownOverlay() { showEl('serverDownOverlay'); }
function showIPBanOverlay(ban) {
  var r = document.getElementById('ipBanReason');
  if (r) r.textContent = 'دلیل: ' + ((ban && ban.reason) || 'تخلف از قوانین');
  showEl('ipBanOverlay');
}
function showDeviceLockOverlay(phone) {
  var p = document.getElementById('deviceLockPhone');
  if (p) p.textContent = phone || '****';
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
    if (!isInsideApp()) {
      clearInterval(appCheckTimer);
      appCheckTimer = null;
      killApp();
    }
  }, 3000);
}

function killApp() {
  appVerified = false;
  if (appCheckTimer) { clearInterval(appCheckTimer); appCheckTimer = null; }
  document.title = 'Access Denied';
  try { window.stop(); } catch(e) {}
  try {
    document.open();
    document.write('<!DOCTYPE html><html dir="rtl" lang="fa"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no"><title>خطا</title><style>*{margin:0;padding:0;box-sizing:border-box}html,body{width:100%;height:100%;overflow:hidden;background:#0a0f1e;font-family:"Vazirmatn",Tahoma,sans-serif;color:white;display:flex;align-items:center;justify-content:center;padding:20px}.box{max-width:420px;width:100%;background:rgba(244,67,54,0.1);border:2px solid #f44336;border-radius:28px;padding:30px 20px;text-align:center}.ico{font-size:56px;margin-bottom:14px}.title{color:#ff6b6b;font-size:22px;font-weight:900;margin-bottom:12px}.text{color:rgba(255,255,255,0.85);font-size:13px;line-height:2.1}</style></head><body><div class="box"><div class="ico">⛔</div><div class="title">دسترسی غیرمجاز</div><div class="text">اجرای بازی فقط از طریق اپلیکیشن رسمی امکان‌پذیر است.<br>لطفاً اپلیکیشن را از سایت رسمی دانلود و نصب کنید.</div></div></body></html>');
    document.close();
  } catch(e) {}
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
      var params = new URLSearchParams({
        phone: phone,
        by: accBan.bannedBy || 'مدیریت',
        reason: accBan.reason || 'بدون دلیل',
        duration: accBan.duration || 'permanent',
        expires: accBan.expiresAt || ''
      });
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
      if (u && u.userCode) {
        var n = parseInt(u.userCode);
        if (!isNaN(n) && n > 0) usedCodes[n] = true;
      }
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
  // cache لوکال اول
  try {
    var cached = localStorage.getItem('user_cache_' + phone);
    if (cached) {
      var cu = JSON.parse(cached);
      if (cu && cu.fullProfile) return cu;
    }
  } catch(e) {}

  try {
    var mafiaUsers = JSON.parse(localStorage.getItem('mafia_users') || '{}');
    if (mafiaUsers[phone] && mafiaUsers[phone].fullProfile) return mafiaUsers[phone];
  } catch(e) {}

  // بعد Redis
  var user = await getUser(phone);
  if (user && user.fullProfile) {
    try { localStorage.setItem('user_cache_' + phone, JSON.stringify(user)); } catch(e) {}
    return user;
  }
  return null;
}

function showPage(pageId) {
  var pages = document.querySelectorAll('.page');
  for (var i = 0; i < pages.length; i++) pages[i].classList.add('hidden');
  var t = document.getElementById(pageId);
  if (t) t.classList.remove('hidden');
}

function goToGame() {
  var target = 'Safe Asli Bazi.html';
  console.log('🎯 Going to game:', target);
  try { window.location.href = target; } catch(e) {}
  setTimeout(function() {
    try { window.location.replace(target); } catch(e) {}
  }, 300);
}

async function redirectToMainPage(userPhone) {
  if (!appVerified) { killApp(); return; }
  isRedirecting = true;

  try {
    var cached = localStorage.getItem('user_cache_' + userPhone);
    var name = 'کاربر';
    if (cached) {
      try { name = JSON.parse(cached).name || 'کاربر'; } catch(e) {}
    }
    localStorage.setItem('currentLoggedInUser', JSON.stringify({
      phone: userPhone,
      timestamp: Date.now(),
      name: name
    }));
    sessionStorage.setItem('currentUserPhone', userPhone);
  } catch(e) {}

  goToGame();
}

function unlockAudio() {
  if (!audioUnlocked) {
    var m = document.getElementById('bgMusic');
    if (m) { m.volume = 0.3; m.play().catch(function(){}); }
    audioUnlocked = true;
  }
}
function playClickSound() {
  try {
    var s = document.getElementById('clickSound');
    if (s) { s.currentTime = 0; s.play().catch(function(){}); }
    unlockAudio();
  } catch(e) {}
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
    if (!appVerified) return;

    var phone = document.getElementById('phoneInput').value.trim();
    var phoneError = document.getElementById('phoneError');
    if (!phone || phone.length < 10) { phoneError.innerText = 'شماره موبایل معتبر وارد کنید'; return; }
    phoneError.innerText = '';

    checkPhoneBtn.disabled = true;
    checkPhoneBtn.innerText = '...';

    var isCrt = isCreatorPhone(phone);
    var user = null;

    try {
      var checkPromise = findUser(phone);
      var timeoutPromise = new Promise(function(resolve) {
        setTimeout(function() { resolve(null); }, 5000);
      });
      user = await Promise.race([checkPromise, timeoutPromise]);
    } catch(e) { user = null; }

    // چک امنیتی فقط اگه کاربر جدید
    if (!user && !isCrt) {
      try {
        var secPromise = performSecurityChecks(phone);
        var secTimeout = new Promise(function(resolve) {
          setTimeout(function() { resolve({ blocked: false }); }, 3000);
        });
        var checks = await Promise.race([secPromise, secTimeout]);
        if (checks.blocked) {
          checkPhoneBtn.disabled = false;
          checkPhoneBtn.innerText = 'ادامه';
          return;
        }
      } catch(e) {}
    }

    tempPhone = phone;
    checkPhoneBtn.disabled = false;
    checkPhoneBtn.innerText = 'ادامه';

    if (user && user.fullProfile === true) {
      document.getElementById('stepPhone').style.display = 'none';
      document.getElementById('stepOtp').style.display = 'none';
      document.getElementById('stepPassword').style.display = 'block';
      document.getElementById('passError').innerText = '';
    } else {
      if (!isCrt) {
        try {
          var locked = await getPhoneForDevice(currentDeviceId);
          if (locked && locked.phone && locked.phone !== phone) {
            showDeviceLockOverlay(locked.phone);
            return;
          }
        } catch(e) {}
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

    var isCrt = isCreatorPhone(tempPhone);
    var user = null;

    // اول cache لوکال
    try {
      var cached = localStorage.getItem('user_cache_' + tempPhone);
      if (cached) {
        var cu = JSON.parse(cached);
        if (cu && cu.password === pass) user = cu;
      }
    } catch(e) {}

    if (!user) {
      try {
        var mafiaUsers = JSON.parse(localStorage.getItem('mafia_users') || '{}');
        if (mafiaUsers[tempPhone] && mafiaUsers[tempPhone].password === pass) {
          user = mafiaUsers[tempPhone];
        }
      } catch(e) {}
    }

    // بعد Redis
    if (!user) {
      try {
        var checkPromise = findUser(tempPhone);
        var timeoutPromise = new Promise(function(resolve) {
          setTimeout(function() { resolve(null); }, 6000);
        });
        user = await Promise.race([checkPromise, timeoutPromise]);
      } catch(e) { user = null; }
    }

    loginBtn.disabled = false;
    loginBtn.innerText = 'ورود';

    if (user && user.password === pass) {
      if (!isCrt) {
        try {
          var locked = await getPhoneForDevice(currentDeviceId);
          if (!locked) {
            await lockDeviceToPhone(currentDeviceId, tempPhone);
          } else if (locked.phone !== tempPhone) {
            showDeviceLockOverlay(locked.phone);
            return;
          }
        } catch(e) {}
      }
      await redirectToMainPage(tempPhone);
    } else if (user && user.password !== pass) {
      document.getElementById('passError').innerText = 'رمز عبور نادرست است';
    } else {
      document.getElementById('passError').innerText = 'کاربر یافت نشد';
    }
  });

  if (forgotPassBtn) forgotPassBtn.addEventListener('click', function() {
    playClickSound();
    showToast('از طریق پشتیبانی پیگیری کنید');
  });

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

  function openAvatarMenu() {
    playClickSound();
    if (avatarMenu) avatarMenu.classList.add('open');
    if (backdrop) backdrop.classList.add('show');
  }
  function closeAvatarMenu() {
    if (avatarMenu) avatarMenu.classList.remove('open');
    if (backdrop) backdrop.classList.remove('show');
  }

  if (avatarCircle) avatarCircle.addEventListener('click', openAvatarMenu);
  if (backdrop) backdrop.addEventListener('click', closeAvatarMenu);

  if (submitProfileBtn) submitProfileBtn.addEventListener('click', async function() {
    playClickSound();
    var gameName = document.getElementById('gameName').value.trim();
    var age = document.getElementById('age').value.trim();
    var newPass = document.getElementById('newPassword').value.trim();

    if (!gameName || !age || !newPass) {
      showToast('لطفاً نام، سن و رمز عبور را وارد کنید', 'error');
      return;
    }
    if (isNaN(age) || age < 5 || age > 99) {
      showToast('سن بین ۵ تا ۹۹ وارد کنید', 'error');
      return;
    }

    var phone = tempPhone;
    if (!phone) { showToast('خطا در شماره تلفن', 'error'); return; }

    var isCrt = isCreatorPhone(phone);

    if (!isCrt) {
      var checks = await performSecurityChecks(phone);
      if (checks.blocked) return;

      var locked = await getPhoneForDevice(currentDeviceId);
      if (locked && locked.phone && locked.phone !== phone) {
        showDeviceLockOverlay(locked.phone);
        return;
      }
    }

    var ageNum = parseInt(age);
    var userCode = await getUniqueUserCode();

    var userData = {
      password: newPass,
      name: gameName,
      age: ageNum,
      avatar: selectedAvatarSrc,
      rank: isCrt ? 'سازنده' : 'کاربر',
      userCode: userCode,
      fullProfile: true,
      canAccessAdult: ageNum >= 18,
      canAccessTeen: ageNum < 18,
      coins: isCrt ? 999999 : 200,
      gems: isCrt ? 999999 : 10,
      dollars: isCrt ? 999999 : 0,
      cups: 0,
      hours: 0,
      level: 1,
      xp: 0,
      compWins: 0,
      friendWins: 0,
      monitorCount: 0,
      bestScore: 0,
      mafiaWins: 0,
      citizenWins: 0,
      ownedAvatars: [],
      ownedTemplates: [],
      currentTemplate: null,
      online: true,
      banned: false,
      lastUpdatedAt: Date.now(),
      createdAt: Date.now(),
      registeredAt: Date.now(),
      registeredIP: currentIP,
      registeredDevice: currentDeviceId
    };

    submitProfileBtn.disabled = true;
    submitProfileBtn.innerText = '...';

    // ذخیره cache لوکال
    try {
      localStorage.setItem('user_cache_' + phone, JSON.stringify(userData));
      var mafiaUsers = JSON.parse(localStorage.getItem('mafia_users') || '{}');
      mafiaUsers[phone] = userData;
      localStorage.setItem('mafia_users', JSON.stringify(mafiaUsers));
    } catch(e) {}

    var saved = await saveUser(phone, userData);
    if (saved) {
      if (!isCrt) await lockDeviceToPhone(currentDeviceId, phone);
      var allUsers = await getAllUsers();
      allUsers[phone] = userData;
      await saveAllUsers(allUsers);
      await redirectToMainPage(phone);
    } else {
      showToast('خطا در ذخیره اطلاعات. دوباره تلاش کنید', 'error');
      submitProfileBtn.disabled = false;
      submitProfileBtn.innerText = 'تایید و ادامه';
    }
  });
}

/* ============================================================ */
/*  ⚡ startBoot - صفحه loading ۳ ثانیه می‌مونه                  */
/* ============================================================ */
async function startBoot() {
  if (window.__BOOT_OK__) return;
  window.__BOOT_OK__ = true;
  console.log('🎬 startBoot');

  // ⚡ بایند event ها فوراً
  bindEvents();

  var selectedImg = document.getElementById('selectedAvatarImg');
  if (selectedImg) selectedImg.src = selectedAvatarSrc;

  var imgs = document.querySelectorAll('img');
  for (var i = 0; i < imgs.length; i++) {
    imgs[i].addEventListener('error', function(){ this.style.display = 'none'; });
  }

  // ⚡ چک لاگین
  var hasLogin = false;
  try {
    var li = localStorage.getItem('currentLoggedInUser');
    if (li) {
      var liObj = JSON.parse(li);
      if (liObj && liObj.phone) hasLogin = true;
    }
  } catch(e) {}

  // ⚡ شروع چک‌های پس‌زمینه (بدون بلاک)
  startAppCheckLoop();
  var mal = detectMaliciousApps();
  if (mal.detected) { showMaliciousAlert(mal.name); return; }

  fetchUserIP().then(function(ip) {
    currentIP = ip;
    currentDeviceId = getDeviceId();
  }).catch(function() {});

  // ⚡ 3 ثانیه صفحه loading می‌مونه
  setTimeout(function() {
    if (hasLogin) {
      console.log('✅ Has login - going to game');
      goToGame();
    } else {
      console.log('📝 No login - showing auth');
      var lp = document.getElementById('loadingPage');
      if (lp) lp.classList.add('hidden');
      var ap = document.getElementById('authPage');
      if (ap) ap.classList.remove('hidden');
      try {
        document.getElementById('stepPhone').style.display = 'block';
        document.getElementById('stepPassword').style.display = 'none';
        document.getElementById('stepOtp').style.display = 'none';
      } catch(e) {}

      // چک سرور بعد از نشون دادن فرم
      setTimeout(async function() {
        try {
          if (currentIP && !isCreatorPhone(tempPhone)) {
            var ipBan = await checkIPBan(currentIP);
            if (ipBan) { showIPBanOverlay(ipBan); return; }
          }
          if (currentDeviceId) {
            var deviceBan = await checkDeviceBan(currentDeviceId);
            if (deviceBan) { showIPBanOverlay(deviceBan); return; }
          }
          var m = await getMaintenance();
          if (m && m.on) { showServerDownOverlay(); return; }
        } catch(e) {}
      }, 500);
    }
  }, 3000);
}

try { lockInspect(); } catch(e) {}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startBoot);
} else {
  startBoot();
}