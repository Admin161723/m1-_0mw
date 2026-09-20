(function() {
  if (window.__OG_LOADED__) return;
  window.__OG_LOADED__ = true;

  // ═══ اصلاح: هر دو شماره ادمین رو بشناس ═══
  var ADMIN_PHONES = ['09908823688', '09904844031'];

  function isCreator() {
    try {
      var loggedIn = localStorage.getItem('currentLoggedInUser');
      if (!loggedIn) return false;
      var data = JSON.parse(loggedIn);
      if (!data || !data.phone) return false;
      return ADMIN_PHONES.indexOf(String(data.phone)) > -1;
    } catch(e) { return false; }
  }

  function isGamePage() {
    try {
      var path = String(window.location.pathname || '').toLowerCase();
      var href = String(window.location.href || '').toLowerCase();
      if (path.indexOf('index.html') !== -1 || href.indexOf('index.html') !== -1) return false;
      if (path === '/' || path === '' || /\/$/.test(path)) return false;
      return true;
    } catch(e) { return false; }
  }

  var overlay = null;
  var isShown = false;
  var currentMode = 'offline';
  var offlineFailCount = 0;
  var checkBusy = false;

  var OG_CSS = document.createElement('style');
  OG_CSS.textContent = ''
    + '.og-wrap{position:fixed !important;top:0 !important;left:0 !important;right:0 !important;bottom:0 !important;'
    + 'width:100vw !important;height:100vh !important;z-index:2147483647 !important;'
    + 'background:rgba(0,0,0,0.85) !important;display:none !important;'
    + 'align-items:center !important;justify-content:center !important;'
    + 'padding:20px !important;box-sizing:border-box !important;direction:rtl !important;'
    + 'font-family:Tahoma,Vazirmatn,sans-serif !important;}'
    + '.og-dialog{width:340px;max-width:100%;border-radius:10px;padding:5px;'
    + 'background:linear-gradient(180deg,#ffe066,#f5c518 50%,#d9a404);'
    + 'box-shadow:0 0 28px rgba(245,197,24,.4),0 18px 40px rgba(0,0,0,.55);'
    + 'animation:ogPop .45s cubic-bezier(.2,1.4,.4,1) both;}'
    + '@keyframes ogPop{from{transform:scale(.7);opacity:0;}to{transform:scale(1);opacity:1;}}'
    + '.og-box{background:linear-gradient(180deg,#e0218a,#c4187a 60%,#a8126b);'
    + 'border-radius:7px;padding:32px 22px 28px;text-align:center;position:relative;overflow:hidden;}'
    + '.og-msg{color:#fff;font-size:18px;font-weight:700;line-height:1.9;'
    + 'text-shadow:0 2px 3px rgba(0,0,0,.4);}'
    + '.og-btn{position:relative;overflow:hidden;border:none;cursor:pointer;'
    + 'margin-top:28px;background:linear-gradient(180deg,#9bf53a,#6fdc1e 50%,#4dbb0c);'
    + 'color:#fff;font-weight:800;font-size:19px;border-radius:8px;padding:11px 42px;'
    + 'text-shadow:0 2px 2px rgba(0,70,0,.55);'
    + 'box-shadow:0 5px 0 #36900a,0 10px 18px rgba(0,0,0,.4),inset 0 2px 3px rgba(255,255,255,.55);'
    + 'transition:transform .12s ease,filter .12s ease;'
    + 'font-family:Tahoma,Vazirmatn,sans-serif;outline:none;}'
    + '.og-btn:active{transform:translateY(4px);'
    + 'box-shadow:0 2px 0 #36900a,inset 0 3px 8px rgba(0,0,0,.35);}'
    + '.og-btn::after{content:"";position:absolute;top:-60%;left:-30%;width:38%;height:220%;'
    + 'background:linear-gradient(100deg,transparent,rgba(255,255,255,.8),transparent);'
    + 'transform:skewX(-20deg);animation:ogShine 2.4s ease-in-out infinite;}'
    + '@keyframes ogShine{0%,55%{left:-40%;}100%{left:135%;}}'
    + '.og-btn.og-loading{background:linear-gradient(180deg,#ffe066,#f5c518 50%,#d9a404);'
    + 'color:#5a3d00;text-shadow:none;box-shadow:0 5px 0 #a58a00,0 10px 18px rgba(0,0,0,.4);}'
    + '.og-btn.og-loading::after{animation:none;display:none;}';
  document.head.appendChild(OG_CSS);

  function getOverlay() {
    if (overlay) return overlay;
    overlay = document.getElementById('__og_overlay__');
    if (overlay) return overlay;

    overlay = document.createElement('div');
    overlay.id = '__og_overlay__';
    overlay.className = 'og-wrap';
    overlay.innerHTML = ''
      + '<div class="og-dialog">'
      + '<div class="og-box">'
      + '<div class="og-msg" id="__og_msg__">اتصال اینترنت شما<br>قطع شده است</div>'
      + '<button id="__og_btn__" class="og-btn">تلاش مجدد</button>'
      + '</div></div>';

    var target = document.body || document.documentElement;
    target.appendChild(overlay);

    var btn = document.getElementById('__og_btn__');
    if (btn) btn.onclick = onRetryClick;

    return overlay;
  }

  function setMessage(html) {
    var m = document.getElementById('__og_msg__');
    if (m) m.innerHTML = html;
  }

  function show() {
    // ═══ FIX: اگه ادمین هستیم و توی صفحه بازی هستیم، هیچوقت نشون نده ═══
    if (isCreator() && isGamePage()) return;
    var o = getOverlay();
    o.style.setProperty('display', 'flex', 'important');
    isShown = true;
  }

  function hide() {
    if (!overlay) return;
    overlay.style.setProperty('display', 'none', 'important');
    isShown = false;
    offlineFailCount = 0;
  }

  function setBtnLoading() {
    var btn = document.getElementById('__og_btn__');
    if (btn) {
      btn.classList.add('og-loading');
      btn.textContent = 'در حال بررسی...';
      btn.disabled = true;
    }
  }

  function setBtnNormal() {
    var btn = document.getElementById('__og_btn__');
    if (btn) {
      btn.classList.remove('og-loading');
      btn.textContent = 'تلاش مجدد';
      btn.disabled = false;
    }
  }

  function realCheck() {
    return new Promise(function(resolve) {
      var img = new Image();
      var done = false;
      var timer = setTimeout(function() {
        if (!done) { done = true; resolve(false); }
      }, 3500);
      img.onload = function() {
        if (!done) { done = true; clearTimeout(timer); resolve(true); }
      };
      img.onerror = function() {
        if (!done) { done = true; clearTimeout(timer); resolve(false); }
      };
      img.src = 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css?_=' + Date.now();
    });
  }

  async function checkNow() {
    if (checkBusy) return;
    checkBusy = true;

    try {
      // ═══ FIX: اگه ادمینیم، اصلاً چک نکن ═══
      if (isCreator() && isGamePage()) {
        if (isShown) hide();
        checkBusy = false;
        return;
      }

      if (navigator.onLine === true) {
        offlineFailCount = 0;
        if (isShown && currentMode === 'offline') hide();
        checkBusy = false;
        return;
      }

      var reallyOnline = await realCheck();
      if (reallyOnline) {
        offlineFailCount = 0;
        if (isShown && currentMode === 'offline') hide();
      } else {
        offlineFailCount++;
        if (offlineFailCount >= 2 && !isShown) {
          currentMode = 'offline';
          setMessage('اتصال اینترنت شما<br>قطع شده است');
          show();
        }
      }
    } catch(e) {
      offlineFailCount = 0;
    }

    checkBusy = false;
  }

  function onRetryClick() {
    setBtnLoading();

    if (currentMode === 'away') {
      setTimeout(function() {
        try { localStorage.removeItem('currentLoggedInUser'); } catch(e) {}
        try { window.location.href = 'index.html'; } catch(e) {}
      }, 400);
      return;
    }

    realCheck().then(function(ok) {
      if (ok) {
        try { localStorage.setItem('__og_skip__', '1'); } catch(e) {}
        if (isGamePage()) {
          try { localStorage.removeItem('currentLoggedInUser'); } catch(e) {}
          try { window.location.href = 'index.html'; } catch(e) {}
        } else {
          try { window.location.reload(); } catch(e) {}
        }
      } else {
        setBtnNormal();
      }
    }).catch(function() {
      setBtnNormal();
    });
  }

  function showAway() {
    // ═══ FIX: ادمین هم رد کن ═══
    if (isCreator() && isGamePage()) return;
    currentMode = 'away';
    setMessage('ارتباط شما با سرور<br>قطع شده است');
    setBtnNormal();
    show();
  }

  function init() {
    getOverlay();

    window.addEventListener('offline', function() {
      setTimeout(function() { checkNow(); }, 1500);
    });

    window.addEventListener('online', function() {
      offlineFailCount = 0;
      if (isShown && currentMode === 'offline') {
        hide();
        setTimeout(function() {
          try { window.location.reload(); } catch(e) {}
        }, 300);
      }
    });

    setInterval(checkNow, 3000);
    setTimeout(checkNow, 1000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.ogCheck = checkNow;
  window.ogShow = show;
  window.ogHide = hide;
  window.ogShowAway = showAway;
  window.ogIsCreator = isCreator;
})();