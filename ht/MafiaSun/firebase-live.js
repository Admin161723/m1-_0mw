/* ============================================================ */
/*  Firebase Live - سیستم سیگنال زنده                          */
/* ============================================================ */

var FIREBASE_CONFIG = {
  apiKey: "AIzaSyCP75sEM4FFCZ2fB5N36Xu-b2Th9nnrLd8",
  authDomain: "mafiasu-681c7.firebaseapp.com",
  databaseURL: "https://mafiasu-681c7-default-rtdb.firebaseio.com",
  projectId: "mafiasu-681c7",
  storageBucket: "mafiasu-681c7.firebasestorage.app",
  messagingSenderId: "180192927804",
  appId: "1:180192927804:web:e0c501a0d20af3b6892339"
};

var _fbDb = null;
var _fbReady = false;
var _myPhone = null;
var _signalListeners = {};
var _lastSignals = {};
var _valueListeners = {};

function initFirebaseLive(myPhone) {
  _myPhone = myPhone || 'unknown';
  try {
    if (typeof firebase === 'undefined') {
      console.warn('⚠️ Firebase SDK not loaded');
      return false;
    }
    if (!firebase.apps.length) {
      firebase.initializeApp(FIREBASE_CONFIG);
    }
    _fbDb = firebase.database();
    _fbReady = true;
    console.log('✅ Firebase Live ready for', _myPhone);
    return true;
  } catch(e) {
    console.error('❌ Firebase init error:', e);
    return false;
  }
}

async function sendLiveSignal(channel, type, data) {
  if (!_fbReady || !_fbDb) return false;
  try {
    var ref = _fbDb.ref('signals/' + channel);
    var payload = {
      type: type || 'update',
      data: data || {},
      from: _myPhone,
      time: Date.now()
    };
    await ref.push(payload);
    return true;
  } catch(e) {
    return false;
  }
}

function subscribeLive(channel, callback) {
  if (!_fbReady || !_fbDb) return function(){};
  try {
    var ref = _fbDb.ref('signals/' + channel);
    var q = ref.limitToLast(1);
    var handler = q.on('child_added', function(snapshot) {
      var sig = snapshot.val();
      if (!sig) return;
      if (sig.from === _myPhone) return;
      var key = channel + '_' + (sig.time || 0);
      if (_lastSignals[key]) return;
      _lastSignals[key] = true;
      try { callback(sig); } catch(e) {}
    });
    _signalListeners[channel] = { ref: ref, handler: handler };
    return function() {
      try {
        ref.off('child_added', handler);
        delete _signalListeners[channel];
      } catch(e) {}
    };
  } catch(e) {
    return function(){};
  }
}

function subscribeLiveValue(path, callback) {
  if (!_fbReady || !_fbDb) return function(){};
  try {
    var ref = _fbDb.ref(path);
    var handler = ref.on('value', function(snapshot) {
      var val = snapshot.val();
      try { callback(val); } catch(e) {}
    });
    _valueListeners[path] = { ref: ref, handler: handler };
    return function() {
      try {
        ref.off('value', handler);
        delete _valueListeners[path];
      } catch(e) {}
    };
  } catch(e) {
    return function(){};
  }
}

async function setLiveValue(path, value) {
  if (!_fbReady || !_fbDb) {
    try {
      if (typeof firebase !== 'undefined' && !firebase.apps.length) {
        firebase.initializeApp(FIREBASE_CONFIG);
        _fbDb = firebase.database();
        _fbReady = true;
      }
    } catch(e) {}
  }
  if (!_fbReady || !_fbDb) return false;
  try {
    await _fbDb.ref(path).set(value);
    console.log('🔥 setLiveValue:', path, '=', value);
    return true;
  } catch(e) {
    return false;
  }
}

async function removeLiveValue(path) {
  if (!_fbReady || !_fbDb) return false;
  try {
    await _fbDb.ref(path).remove();
    return true;
  } catch(e) { return false; }
}

function setOnlineStatusLive(phone, isOnline, extra) {
  if (!_fbReady || !_fbDb) return;
  var path = 'online/' + phone;
  var data = { online: isOnline, lastSeen: Date.now() };
  if (extra) { for (var k in extra) data[k] = extra[k]; }
  _fbDb.ref(path).set(data).catch(function(){});
}

function cleanupMySignalChannels() {
  if (!_fbReady || !_fbDb || !_myPhone) return;
  try {
    _fbDb.ref('online/' + _myPhone).remove().catch(function(){});
  } catch(e) {}
}

window.addEventListener('beforeunload', function() {
  cleanupMySignalChannels();
});

window.FBLive = {
  init: initFirebaseLive,
  send: sendLiveSignal,
  subscribe: subscribeLive,
  subscribeValue: subscribeLiveValue,
  setValue: setLiveValue,
  removeValue: removeLiveValue,
  setOnline: setOnlineStatusLive,
  isReady: function() { return _fbReady; },
  getDb: function() { return _fbDb; }
};

try {
  if (typeof firebase !== 'undefined' && !firebase.apps.length) {
    firebase.initializeApp(FIREBASE_CONFIG);
    _fbDb = firebase.database();
    _fbReady = true;
    console.log('✅ Firebase Live auto-initialized');
  }
} catch(e) {}

console.log('✅ firebase-live.js loaded');