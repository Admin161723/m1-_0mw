(function() {
  if (window.__OFFLINE_GUARD_LOADED__) return;
  window.__OFFLINE_GUARD_LOADED__ = true;

  var overlayEl = null;
  var isOfflineShown = false;
  var checkInProgress = false;
  var failCount = 0;
  var OK_COUNT_NEEDED = 1;

  var CSS = ''
    + '.og-overlay{position:fixed!important;top:0!important;left:0!important;right:0!important;bottom:0!important;'
    + 'width:100vw!important;height:100vh!important;z-index:2147483647!important;display:flex!important;'
    + 'align-items:center!important;justify-content:center!important;background:rgba(0,0,0,0.9)!important;'
    + 'padding:20px!important;font-family:Tahoma,Vazirmatn,sans-serif!important;direction:rtl!important;'
    + 'box-sizing:border-box!important;margin:0!important;visibility:visible!important;opacity:1!important;}'
    + '.og-overlay *{box-sizing:border-box!important;}'
    + '.og-dialog{width:340px;max-width:100%;border-radius:10px;padding:5px;'
    + 'background:linear-gradient(180deg,#ffe066,#f5c518 50%,#d9a404);'
    + 'box-shadow:0 0 28px rgba(245,197,24,.4),0 18px 40px rgba(0,0,0,.55);}'
    + '.og-box{background:linear-gradient(180deg,#e0218a,#c4187a 60%,#a8126b);'
    + 'border-radius:7px;padding:32px 22px 28px;text-align:center;}'
    + '.og-msg{color:#fff;font-size:18px;font-weight:700;line-height:1.9;'
    + 'text-shadow:0 2px 3px rgba(0,0,0,.4);}'
    + '.og-btn{border:none;cursor:pointer;margin-top:28px;'
    + 'background:linear-gradient(180deg,#9bf53a,#6fdc1e 50%,#4dbb0c);color:#fff;'
    + 'font-weight:800;font-size:19px;border-radius:8px;padding:11px 42px;'
    + 'text-shadow:0 2px 2px rgba(0,70,0,.55);'
    + 'box-shadow:0 5px 0 #36900a,0 10px 18px rgba(0,0,0,.4);'
    + 'font-family:Tahoma,Vazirmatn,sans-serif;}'
    + '.og-btn:active{transform:translateY(4px);box-shadow:0 2px 0 #36900a;}';

  var HTML = ''
    + '<div class="og-dialog"><div class="og-box">'
    + '<div class="og-msg">اتصال اینترنت شما<br>قطع شده است</div>'
    + '<button class="og-btn" id="ogRetryBtn">تلاش مجدد</button>'
    + '</div></div>';

  function injectCSS() {
    if (document.getElementById('__og_css__')) return;
    var s = document.createElement('style');
    s.id = '__og_css__';
    s.textContent = CSS;
    (document.head || document.documentElement).appendChild(s);
  }

  function createOverlay() {
    if (overlayEl) return overlayEl;
    injectCSS();
    overlayEl = document.createElement('div');
    overlayEl.className = 'og-overlay';
    overlayEl.id = '__og_overlay__';
    overlayEl.style.display = 'none';
    overlayEl.innerHTML = HTML;
    var target = document.body || document.documentElement;
    target.appendChild(overlayEl);
    var btn = document.getElementById('ogRetryBtn');
    if (btn) {
      btn.onclick = function() {
        checkConnection(true);
      };
    }
    return overlayEl;
  }

  function showOverlay() {
    var o = createOverlay();
    o.style.display = 'flex';
    isOfflineShown = true;
    try { localStorage.setItem('__og_offline__', '1'); } catch(e) {}
  }

  function hideOverlay() {
    if (overlayEl) overlayEl.style.display = 'none';
    isOfflineShown = false;
    try { localStorage.removeItem('__og_offline__'); } catch(e) {}
  }

  function xhrCheck(url, timeout, cb) {
    var done = false;
    var xhr = new XMLHttpRequest();
    var timer = setTimeout(function() {
      if (!done) { done = true; try { xhr.abort(); } catch(e){} cb(false); }
    }, timeout);
    try {
      xhr.open('GET', url, true);
      xhr.onload = function() {
        if (!done) { done = true; clearTimeout(timer); cb(xhr.status >= 200 && xhr.status < 500); }
      };
      xhr.onerror = function() { if (!done) { done = true; clearTimeout(timer); cb(false); } };
      xhr.onabort = function() { if (!done) { done = true; clearTimeout(timer); cb(false); } };
      xhr.send();
    } catch(e) { if (!done) { done = true; clearTimeout(timer); cb(false); } }
  }

  function fetchCheck(url, timeout, cb) {
    var done = false;
    var timer = setTimeout(function() {
      if (!done) { done = true; cb(false); }
    }, timeout);
    try {
      fetch(url, { cache: 'no-store', mode: 'no-cors' })
        .then(function() { if (!done) { done = true; clearTimeout(timer); cb(true); } })
        .catch(function() { if (!done) { done = true; clearTimeout(timer); cb(false); } });
    } catch(e) { if (!done) { done = true; clearTimeout(timer); cb(false); } }
  }

  function checkConnection(isManual) {
    if (checkInProgress) return;
    checkInProgress = true;

    if (!navigator.onLine) {
      failCount++;
      if (failCount >= 2 || isManual) {
        showOverlay();
      }
      checkInProgress = false;
      return;
    }

    var url = 'https://www.google.com/generate_204?_=' + Date.now();
    var url2 = 'https://api.ipify.org?format=json&_=' + Date.now();
    var responded = false;

    function onResult(ok) {
      if (responded) return;
      responded = true;

      if (ok) {
        failCount = 0;
        if (isOfflineShown) {
          hideOverlay();
          if (isManual) {
            try { window.location.reload(); } catch(e) {}
          }
        }
      } else {
        failCount++;
        if (failCount >= 2 || isManual) {
          showOverlay();
        }
      }
      checkInProgress = false;
    }

    xhrCheck(url, 3500, function(ok1) {
      if (ok1) { onResult(true); return; }
      fetchCheck(url2, 3500, function(ok2) {
        if (ok2) { onResult(true); return; }
        xhrCheck(url2, 3500, function(ok3) {
          onResult(ok3);
        });
      });
    });
  }

  function init() {
    createOverlay();

    window.addEventListener('offline', function() {
      failCount = 2;
      showOverlay();
    });

    window.addEventListener('online', function() {
      setTimeout(function() { checkConnection(); }, 800);
    });

    document.addEventListener('visibilitychange', function() {
      if (!document.hidden) {
        checkConnection();
      }
    });

    window.addEventListener('focus', function() {
      checkConnection();
    });

    setInterval(function() {
      checkConnection();
    }, 2500);

    setTimeout(function() {
      checkConnection();
    }, 500);

    window.ogCheckConnection = checkConnection;
    window.ogShowOverlay = showOverlay;
    window.ogHideOverlay = hideOverlay;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();