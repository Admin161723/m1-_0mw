(function() {
  if (window.__OG_LOADED__) return;
  window.__OG_LOADED__ = true;

  console.log('✅ offline-guard loaded');

  var overlay = null;
  var isShown = false;

  function getOverlay() {
    if (overlay) return overlay;
    overlay = document.getElementById('__og_overlay__');
    if (overlay) return overlay;

    overlay = document.createElement('div');
    overlay.id = '__og_overlay__';
    overlay.innerHTML = ''
      + '<div style="width:340px;max-width:100%;border-radius:10px;padding:5px;'
      + 'background:linear-gradient(180deg,#ffe066,#f5c518 50%,#d9a404);'
      + 'box-shadow:0 0 28px rgba(245,197,24,.4),0 18px 40px rgba(0,0,0,.55);">'
      + '<div style="background:linear-gradient(180deg,#e0218a,#c4187a 60%,#a8126b);'
      + 'border-radius:7px;padding:32px 22px 28px;text-align:center;font-family:Tahoma,Vazirmatn,sans-serif;">'
      + '<div style="color:#fff;font-size:18px;font-weight:700;line-height:1.9;'
      + 'text-shadow:0 2px 3px rgba(0,0,0,.4);">اتصال اینترنت شما<br>قطع شده است</div>'
      + '<button id="__og_btn__" style="border:none;cursor:pointer;margin-top:28px;'
      + 'background:linear-gradient(180deg,#9bf53a,#6fdc1e 50%,#4dbb0c);color:#fff;'
      + 'font-weight:800;font-size:19px;border-radius:8px;padding:11px 42px;'
      + 'font-family:Tahoma,Vazirmatn,sans-serif;'
      + 'box-shadow:0 5px 0 #36900a,0 10px 18px rgba(0,0,0,.4);">تلاش مجدد</button>'
      + '</div></div>';

    overlay.style.cssText = ''
      + 'position:fixed !important;'
      + 'top:0 !important;left:0 !important;right:0 !important;bottom:0 !important;'
      + 'width:100vw !important;height:100vh !important;'
      + 'z-index:2147483647 !important;'
      + 'background:rgba(0,0,0,0.85) !important;'
      + 'display:none !important;'
      + 'align-items:center !important;justify-content:center !important;'
      + 'padding:20px !important;box-sizing:border-box !important;'
      + 'direction:rtl !important;';

    var target = document.body || document.documentElement;
    target.appendChild(overlay);

    var btn = document.getElementById('__og_btn__');
    if (btn) {
      btn.onclick = function() {
        console.log('🔄 retry clicked');
        checkNow();
      };
    }

    console.log('✅ overlay created');
    return overlay;
  }

  function show() {
    var o = getOverlay();
    o.style.setProperty('display', 'flex', 'important');
    isShown = true;
    console.log('🔴 OFFLINE overlay shown');
  }

  function hide() {
    if (!overlay) return;
    overlay.style.setProperty('display', 'none', 'important');
    isShown = false;
    console.log('🟢 OFFLINE overlay hidden');
  }

  function checkWithImage(cb) {
    var img = new Image();
    var done = false;
    var timer = setTimeout(function() {
      if (!done) { done = true; cb(false); }
    }, 4000);
    img.onload = function() {
      if (!done) { done = true; clearTimeout(timer); cb(true); }
    };
    img.onerror = function() {
      if (!done) { done = true; clearTimeout(timer); cb(false); }
    };
    img.src = 'https://www.google.com/favicon.ico?_=' + Date.now();
  }

  var checkBusy = false;
  var failCount = 0;

  function checkNow() {
    if (checkBusy) return;
    checkBusy = true;

    console.log('🔍 checking internet... onLine=' + navigator.onLine);

    if (!navigator.onLine) {
      failCount = 99;
      show();
      checkBusy = false;
      return;
    }

    checkWithImage(function(ok) {
      console.log('🔍 image check result: ' + ok);
      if (ok) {
        failCount = 0;
        if (isShown) {
          hide();
          try { window.location.reload(); } catch(e) {}
        }
      } else {
        failCount++;
        if (failCount >= 2) show();
      }
      checkBusy = false;
    });
  }

  function init() {
    console.log('🚀 offline-guard init');
    getOverlay();

    window.addEventListener('offline', function() {
      console.log('📡 offline event');
      failCount = 99;
      show();
    });

    window.addEventListener('online', function() {
      console.log('📡 online event');
      setTimeout(function() { checkNow(); }, 500);
    });

    document.addEventListener('visibilitychange', function() {
      if (!document.hidden) setTimeout(checkNow, 300);
    });

    window.addEventListener('focus', function() {
      setTimeout(checkNow, 300);
    });

    setInterval(checkNow, 2000);

    setTimeout(checkNow, 300);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.ogCheck = checkNow;
  window.ogShow = show;
  window.ogHide = hide;
})();