'use strict';

// =========================================================================
// 🔒 لایه امنیتی بهینه‌شده (بدون حذف ناگهانی اطلاعات کاربر)
// =========================================================================

// 1. جلوگیری از قرارگیری سایت در آی‌فریم
if (window.top !== window.self) {
    window.top.location = window.self.location;
}

const isInput = (target) => {
    const tag = target.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable;
};

// 2. قفل کردن تعاملات ماوس (فقط برای عناصر غیر ورودی)
document.addEventListener('contextmenu', e => { if (!isInput(e.target)) e.preventDefault(); }, true);
document.addEventListener('selectstart', e => { if (!isInput(e.target)) e.preventDefault(); }, true);
document.addEventListener('dragstart', e => e.preventDefault(), true);
document.addEventListener('drop', e => e.preventDefault(), true);
document.addEventListener('copy', e => { if (!isInput(e.target)) e.preventDefault(); }, true);
document.addEventListener('cut', e => { if (!isInput(e.target)) e.preventDefault(); }, true);

// 3. حذف بلاک کننده دبل‌کلیک سراسری (باعث باگ در دکمه‌های ثبت‌نام می‌شد)
// به جای آن، در زمان ارسال فرم دکمه غیرفعال می‌شود.

// 4. قفل کردن کلیدهای میانبر کیبورد (حفظ شده اما بدون کرش کردن برنامه)
document.addEventListener('keydown', e => {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const ctrl = isMac ? e.metaKey : e.ctrlKey;
    if (e.key === 'F12' || e.key === 'PrintScreen') { e.preventDefault(); return false; }
    if (ctrl && ['u','U','s','S','p','P'].includes(e.key)) { e.preventDefault(); return false; }
    if (ctrl && e.shiftKey && ['i','I','j','J','c','C'].includes(e.key)) { e.preventDefault(); return false; }
    if (isMac && e.altKey && ['i','I','j','J','c','C'].includes(e.key)) { e.preventDefault(); return false; }
    if (ctrl && ['a','A'].includes(e.key) && !isInput(e.target)) { e.preventDefault(); return false; }
}, true);

// 5. تله‌گذاری کنسول (نسخه ایمن: بدون پاک کردن اطلاعات کاربر)
(function detectDevTools() {
    // فقط یک هشدار ساده در کنسول، بدون تخریب صفحه یا حذف سشن
    const check = () => {
        const element = new Image();
        Object.defineProperty(element, 'id', {
            get: function () {
                console.warn('%cتلاش برای باز کردن ابزار توسعه‌دهنده شناسایی شد.', 'color: red; font-weight: bold;');
            }
        });
        console.log('%c', element);
    };
    setInterval(check, 2000);
})();

// 6. بی‌اثر کردن دستورات کنسول
const noop = () => {};
console.log = noop; console.warn = noop; console.error = noop;
console.info = noop; console.debug = noop; console.clear = noop;
// =========================================================================

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const today = () => new Date().toLocaleDateString('fa-IR');

const UPSTASH_OLD_URL = "https://smooth-werewolf-200782.upstash.io";
const UPSTASH_OLD_TOKEN = "gQAAAAAAAxBOAAIgcDFjN2NiMjYxOWNlNjE0NzgyOTExM2JjMjA5ZTc0MjVjMA";
const UPSTASH_NEW_URL = "https://holy-hamster-122717.upstash.io";
const UPSTASH_NEW_TOKEN = "gQAAAAAAAd9dAAIgcDFlNmYwM2VkZDJiM2Y0YWI2ODBmNmIyMTZjMmRkMTZmNg";

const USERS_KEY = 'mafiasun_users';
const REQUESTS_KEY = 'mafiasun_requests';
const SETTINGS_KEY = 'mafiasun_form_settings';
const ANNOUNCE_KEY = 'mafiasun_announces';

// توابع کمکی برای پشتیبان‌گیری محلی (جلوگیری از حذف اطلاعات)
function saveLocalBackup(key, data) {
    try { localStorage.setItem(key + '_backup', JSON.stringify(data)); } catch(e) {}
}
function loadLocalBackup(key) {
    try { 
        const d = localStorage.getItem(key + '_backup'); 
        return d ? JSON.parse(d) : null; 
    } catch(e) { return null; }
}

async function upstashGet(url, token, k){
    try{
        const c = new AbortController();
        const t = setTimeout(() => c.abort(), 10000); // افزایش زمان به 10 ثانیه
        const r = await fetch(url + '/get/' + encodeURIComponent(k), {
            method: 'GET',
            headers: {'Authorization': 'Bearer ' + token},
            signal: c.signal
        });
        clearTimeout(t);
        if (!r.ok) return null;
        const d = await r.json();
        if (d && d.result) {
            try { return JSON.parse(d.result); } catch(e) { return d.result; }
        }
        return null;
    } catch(e) { return null; }
}

async function upstashSet(url, token, k, v){
    try{
        const jsonValue = JSON.stringify(v);
        const c = new AbortController();
        const t = setTimeout(() => c.abort(), 10000);
        // استفاده از متد POST برای اطمینان از ذخیره‌سازی صحیح در Upstash
        const r = await fetch(url + '/set/' + encodeURIComponent(k) + '/' + encodeURIComponent(jsonValue), {
            method: 'POST',
            headers: {'Authorization': 'Bearer ' + token},
            signal: c.signal
        });
        clearTimeout(t);
        return r.ok;
    } catch(e) { return false; }
}

async function dbGet(key){
    let v = await upstashGet(UPSTASH_OLD_URL, UPSTASH_OLD_TOKEN, key);
    if (v !== null) return v;
    v = await upstashGet(UPSTASH_NEW_URL, UPSTASH_NEW_TOKEN, key);
    if (v !== null) return v;
    return null;
}

async function dbSet(key, value){
    const p1 = upstashSet(UPSTASH_OLD_URL, UPSTASH_OLD_TOKEN, key, value);
    const p2 = upstashSet(UPSTASH_NEW_URL, UPSTASH_NEW_TOKEN, key, value);
    const r = await Promise.allSettled([p1, p2]);
    const success = r.some(x => x.status === 'fulfilled' && x.value === true);
    
    // اگر ذخیره‌سازی موفق بود، یک نسخه پشتیبان هم در مرورگر کاربر ذخیره کن
    if (success) {
        saveLocalBackup(key, value);
    }
    return success;
}

const DEFAULT_USERS = [
    {id:'u-creator', firstName:'سازنده', lastName:'مافیاسان', gameName:'Creator', mobile:'09904844031', email:'-', password:'Par1617230', role:'creator', avatar:null},
    {id:'u-sup1', firstName:'پشتیبانی', lastName:'مافیاسان', gameName:'Support 1', mobile:'09940940720', email:'-', password:'Erfan.sh85', role:'support', avatar:null},
    {id:'u-sup2', firstName:'پشتیبانی', lastName:'مافیاسان', gameName:'Support 2', mobile:'09904845012', email:'-', password:'1234567890', role:'support', avatar:null}
];

let usersCache = [];
let requestsCache = [];
let formSettings = {};
let announcements = [];
let currentSession = localStorage.getItem('ms_session') || null;

function ensureDefaultUsers(){
    let changed = false;
    DEFAULT_USERS.forEach(du => {
        const ex = usersCache.find(u => u.mobile === du.mobile);
        if (!ex) { 
            usersCache.push({...du}); 
            changed = true; 
        } else {
            if (ex.password !== du.password) { ex.password = du.password; changed = true; }
            if (ex.role !== du.role) { ex.role = du.role; changed = true; }
        }
    });
    return changed;
}

async function loadAllData(){
    try{
        const [u, r, s, a] = await Promise.all([
            dbGet(USERS_KEY), dbGet(REQUESTS_KEY), dbGet(SETTINGS_KEY), dbGet(ANNOUNCE_KEY)
        ]);

        // منطق اصلاح‌شده: اگر دیتابیس پاسخ نداد، از پشتیبان محلی استفاده کن، نه اینکه همه چیز را پاک کنی!
        if (u && Array.isArray(u)) {
            usersCache = u;
        } else {
            const localU = loadLocalBackup(USERS_KEY);
            if (localU && Array.isArray(localU)) {
                usersCache = localU;
            } else {
                usersCache = JSON.parse(JSON.stringify(DEFAULT_USERS));
            }
        }

        if (r && Array.isArray(r)) requestsCache = r; 
        else requestsCache = loadLocalBackup(REQUESTS_KEY) || [];

        if (s && typeof s === 'object') formSettings = s;
        else formSettings = {nazer:true, nazerArshad:true, admin:true, adminArshad:true, gardanandeh:true, poshtibani:true};

        if (a && Array.isArray(a)) announcements = a; 
        else announcements = loadLocalBackup(ANNOUNCE_KEY) || [];

        if (ensureDefaultUsers()) { 
            await dbSet(USERS_KEY, usersCache); 
        }

        // اطمینان از ذخیره کلیدها اگر خالی بودند
        if (!r) await dbSet(REQUESTS_KEY, requestsCache);
        if (!s) await dbSet(SETTINGS_KEY, formSettings);
        if (!a) await dbSet(ANNOUNCE_KEY, announcements);

    } catch(e) {
        console.error("Load Data Error:", e);
        toast('خطا در دریافت اطلاعات، از نسخه پشتیبان استفاده شد','err');
        // بارگذاری از بکاپ در صورت خطای کامل
        if (!usersCache.length) usersCache = loadLocalBackup(USERS_KEY) || JSON.parse(JSON.stringify(DEFAULT_USERS));
        if (!requestsCache.length) requestsCache = loadLocalBackup(REQUESTS_KEY) || [];
    }
}

async function saveUsers(){ 
    const res = await dbSet(USERS_KEY, usersCache);
    if(!res) toast('هشدار: ذخیره‌سازی با تاخیر مواجه شده است', 'err');
    return res; 
}
async function saveRequests(){ 
    const res = await dbSet(REQUESTS_KEY, requestsCache);
    if(!res) toast('هشدار: درخواست ثبت شد اما ممکن است با تاخیر به دست پشتیبانی برسد', 'err');
    return res; 
}

function currentUser(){ return usersCache.find(u => u.id === currentSession) || null; }
const isStaff = u => u && (u.role === 'creator' || u.role === 'support');
const isCreator = u => u && u.role === 'creator';
const statusFa = s => ({pending:'در انتظار', approved:'تایید شده', rejected:'رد شده'}[s]);

function badge(u){
    if(u && u.role === 'creator') return '<span class="vbadge">✓</span><span class="vlabel">سازنده</span>';
    if(u && u.role === 'support') return '<span class="vbadge">✓</span><span class="vlabel">پشتیبانی</span>';
    return '';
}

const defaultAvatar = 'data:image/svg+xml;utf8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" rx="40" fill="#1d2432"/><circle cx="40" cy="30" r="14" fill="#3a465c"/><path d="M12 72c4-16 16-22 28-22s24 6 28 22" fill="#3a465c"/></svg>'
);

function ph(text){
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1b2334"/><stop offset="1" stop-color="#0d1017"/></linearGradient></defs><rect width="300" height="300" fill="url(#g)"/><circle cx="150" cy="110" r="35" fill="#f0b429" opacity="0.85"/><text x="150" y="190" font-size="16" fill="#8fa0bd" text-anchor="middle">'+text+'</text><text x="150" y="220" font-size="12" fill="#5b6b88" text-anchor="middle">MafiaSun</text></svg>'
    );
}

const ROLES = {
    nazer:{title:'ناظر', rule:'حداقل سن مورد نیاز ۱۹ سال به بالا.'},
    nazerArshad:{title:'ناظر ارشد', rule:'حداقل سن مورد نیاز ۲۵ سال به بالا.'},
    admin:{title:'ادمین', rule:'حداقل سن ۲۲ سال به بالا می‌باشد.'},
    adminArshad:{title:'ادمین ارشد', rule:'حداقل سن مورد نیاز برای تایید شدن ۲۷ سال می‌باشد.'},
    gardanandeh:{title:'گرداننده', rule:'سن مورد نظر باید حداقل ۲۵ سال به بالا باشد و از طرف پشتیبانی انتخاب می‌شود.'},
    poshtibani:{title:'پشتیبانی', rule:'انتخاب نیروی پشتیبانی فقط با تشخیص و تایید سازنده سایت انجام می‌شود.'}
};

const ROLE_TICK = {
    poshtibani:{c:'#2f81f7'}, gardanandeh:{c:'#2fbf71'}, adminArshad:{c:'#111111'},
    admin:{c:'#ff8c00'}, nazerArshad:{c:'#800080'}, nazer:{c:'#ff69b4'}
};

function roleTickHtml(role){
    const t = ROLE_TICK[role]; if(!t) return '';
    return '<span class="rtick" style="background:'+t.c+'">✓</span>';
}

let toastTimer;
function toast(msg, type='ok'){
    const t = $('#toast');
    if(t){
        t.textContent = msg;
        t.className = 'toast show ' + (type==='err' ? 't-err' : 't-ok');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => t.classList.remove('show'), 3500);
    }
}

let currentPage = 'home', currentRole = 'nazer';

async function compressImage(file, maxSize=600, quality=0.6){ // کاهش سایز برای جلوگیری از خطای Upstash
    return new Promise((res, rej) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let w = img.width, h = img.height;
            if(w > h){ if(w > maxSize){ h *= maxSize/w; w = maxSize; }} 
            else { if(h > maxSize){ w *= maxSize/h; h = maxSize; }}
            canvas.width = w; canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, w, h);
            res(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = rej;
        img.src = URL.createObjectURL(file);
    });
}

async function readAsDataURL(f){
    return new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result);
        r.onerror = rej;
        r.readAsDataURL(f);
    });
}

function renderUserArea(){
    const u = currentUser(); const area = $('#userArea');
    if(!area) return;
    if(u){
        area.innerHTML = `<img src="${u.avatar || defaultAvatar}" class="user-avatar" alt="avatar" onerror="this.src='${defaultAvatar}'">
            <span><b>${esc(u.firstName)}</b> ${badge(u)}</span>
            <button class="btn btn-ghost" id="logoutBtn">خروج</button>`;
    } else {
        area.innerHTML = `<button class="btn btn-gold" id="openRegister">ثبت نام</button>
            <button class="btn btn-ghost" id="openLogin">ورود</button>`;
    }
}

function renderNavLinks(){
    const u = currentUser();
    $$('#navLinksDesktop a').forEach(a => a.classList.remove('active'));
    const active = $$(`#navLinksDesktop a[data-page="${currentPage}"]`);
    if(active.length) active[0].classList.add('active');
    
    const panelLink = $('#navLinksDesktop a[data-page="panel"]');
    const rulesLink = $('#navLinksDesktop a[data-page="rules"]');
    const formsLink = $('#navLinksDesktop a[data-page="forms"]');
    
    if(u){
        if(panelLink) panelLink.style.display = isStaff(u) ? '' : 'none';
        if(rulesLink) rulesLink.style.display = '';
        if(formsLink) formsLink.style.display = '';
    } else {
        if(panelLink) panelLink.style.display = 'none';
        if(rulesLink) rulesLink.style.display = 'none';
        if(formsLink) formsLink.style.display = 'none';
    }
}

function updateRoleButtons(){
    $$('#roleGrid [data-role]').forEach(b => {
        const key = b.dataset.role;
        const on = formSettings[key] !== false;
        b.disabled = !on;
        b.classList.toggle('off', !on);
        b.textContent = ROLES[key].title + (on ? '' : ' (غیرفعال)');
    });
}

function renderPublicAnnounce(){
    const box = $('#publicAnnounce');
    if(!box) return;
    if(!announcements.length){ box.innerHTML = '<p class="muted small">هنوز معرفی‌ای ثبت نشده است.</p>'; return; }
    box.innerHTML = announcements.map(a => `
        <div class="ann-card">
            <span>${roleTickHtml(a.role)} <b>${esc(a.name)}</b> — <span class="gold">${ROLES[a.role] ? ROLES[a.role].title : a.role}</span></span>
            <span class="small muted">${a.date}</span>
        </div>`).join('');
}

function showPage(name){
    const u = currentUser();
    if(name === 'forms' && !u) name = 'home';
    if(name === 'rules' && !u) name = 'home';
    if(name === 'panel' && !isStaff(u)) name = 'home';
    
    currentPage = name;
    $$('.page').forEach(p => p.classList.toggle('active', p.id === 'page-' + name));
    
    if(name === 'forms'){ renderMyRequests(); updateRoleButtons(); renderPublicAnnounce(); }
    if(name === 'panel') renderPanel();
    
    renderNavLinks(); renderUserArea();
    const nav = $('#navLinksDesktop'); if(nav) nav.classList.remove('open');
    window.scrollTo({top:0, behavior:'smooth'});
}

function renderMyRequests(){
    const u = currentUser(); if(!u) return;
    const reqs = requestsCache.filter(r => r.userId === u.id);
    const box = $('#myRequests'); if(!box) return;
    if(!reqs.length){ box.innerHTML = '<p class="muted small">هنوز درخواستی ثبت نکرده‌اید.</p>'; return; }
    box.innerHTML = reqs.map(r => `
        <div class="card req-card">
            <div class="req-head">
                <strong>درخواست مقام <b class="gold">${ROLES[r.role].title}</b></strong>
                <span class="status st-${r.status}">${statusFa(r.status)}</span>
                <span class="small muted">${r.date}</span>
            </div>
            <div class="replies">
                ${r.replies && r.replies.length ? r.replies.map(rep => `
                    <div class="reply"><b>${esc(rep.author)} ${rep.badge}</b><p>${esc(rep.text)}</p><span class="small muted">${rep.date}</span></div>
                `).join('') : '<p class="small muted">هنوز پاسخی ثبت نشده است.</p>'}
            </div>
        </div>`).join('');
}

function renderPanel(){
    const u = currentUser(); if(!isStaff(u)) return;
    const titleEl = $('#panelRoleTitle');
    if(titleEl) titleEl.innerHTML = (isCreator(u) ? 'سازنده ' : 'پشتیبانی ') + badge(u);
    renderPanelReqs(); renderPanelUsers(); renderSettings(); renderAnnounce();
}

function renderPanelReqs(){
    const box = $('#panelReqs'); if(!box) return;
    if(!requestsCache.length) {
        box.innerHTML = '<p class="muted small">هنوز درخواستی ثبت نشده است.</p>';
        return;
    }
    box.innerHTML = requestsCache.map(r => {
        const owner = usersCache.find(x => x.id === r.userId);
        const delApproved = r.status === 'approved' ? `<button class="btn btn-red" data-delreq="${r.id}">حذف مقام</button>` : '';
        const ownerInfo = owner ? `
            <div style="margin-top:10px;padding:10px;background:rgba(0,0,0,.3);border-radius:8px;">
                <b style="color:#f0b429;">اطلاعات حساب:</b><br>
                <span>نام: ${esc(owner.firstName)} ${esc(owner.lastName)}</span><br>
                <span>ایمیل: ${esc(owner.email||'-')}</span><br>
                <span>بازی: ${esc(owner.gameName||'-')}</span>
            </div>` : '';
            
        return `<div class="card req-full">
            <div class="req-head">
                ${roleTickHtml(r.role)} <b>${esc(r.firstName)} ${esc(r.lastName)}</b>
                <span class="gold">مقام ${ROLES[r.role].title}</span>
                <span class="status st-${r.status}">${statusFa(r.status)}</span>
            </div>
            <div class="grid-info">
                <span>موبایل: ${esc(r.mobile)}</span><span>ثابت: ${esc(r.landline)}</span>
                <span>کد ملی: ${esc(r.nid)}</span><span>استان: ${esc(r.province)}</span>
                <span>ایمیل: ${esc(r.email||'-')}</span><span>تاریخ: ${r.date}</span>
            </div>
            ${ownerInfo}
            <div class="media-row">
                <figure><figcaption>شناسنامه</figcaption><img src="${r.shenas}" data-light="1" onerror="this.src='${ph('شناسنامه')}'"></figure>
                <figure><figcaption>چهره</figcaption><img src="${r.photo}" data-light="1" onerror="this.src='${ph('چهره')}'"></figure>
            </div>
            <div class="media-row">
                ${r.media && r.media.startsWith('data:audio') ? `<audio controls src="${r.media}"></audio>` : `<video controls src="${r.media}"></video>`}
            </div>
            <div class="replies">
                ${r.replies && r.replies.length ? r.replies.map(rep => `
                    <div class="reply"><b>${esc(rep.author)} ${rep.badge}</b><p>${esc(rep.text)}</p><span class="small muted">${rep.date}</span></div>
                `).join('') : '<p class="small muted">هنوز پاسخی ثبت نشده.</p>'}
            </div>
            <div class="reply-box">
                <textarea id="rep-${r.id}" placeholder="پاسخ به این درخواست..."></textarea>
                <div class="btn-row">
                    <button class="btn btn-gold" data-reply="${r.id}">پاسخ</button>
                    <button class="btn btn-green" data-approve="${r.id}">تایید</button>
                    <button class="btn btn-red" data-reject="${r.id}">رد</button>
                    ${delApproved}
                </div>
            </div>
        </div>`;
    }).join('');
}

function renderPanelUsers(){
    const usersTable = $('#panelUsers'); if(!usersTable) return;
    usersTable.innerHTML = `<div class="table-wrap"><table>
        <tr><th>نام</th><th>نام خانوادگی</th><th>بازی</th><th>موبایل</th><th>ایمیل</th><th>مقام</th></tr>
        ${usersCache.map(x => `<tr><td>${esc(x.firstName)}</td><td>${esc(x.lastName)}</td><td>${esc(x.gameName||'-')}</td><td>${esc(x.mobile)}</td><td>${esc(x.email||'-')}</td><td>${badge(x)||'کاربر'}</td></tr>`).join('')}
    </table></div>`;
}

function renderSettings(){
    const box = $('#panelSettings'); if(!box) return;
    const u = currentUser();
    if(!isCreator(u)){ box.innerHTML = '<p class="muted small">فقط سازنده دسترسی به تنظیمات فرم‌ها دارد.</p>'; return; }
    box.innerHTML = Object.keys(ROLES).map(key => {
        const on = formSettings[key] !== false;
        return `<div class="setting-row"><b>فرم ${ROLES[key].title}</b>
            <button class="btn ${on?'btn-green':'btn-red'}" data-toggleform="${key}">${on?'فعال ✓':'غیرفعال ✕'}</button></div>`;
    }).join('');
    
    $$('#panelSettings [data-toggleform]').forEach(b => {
        b.onclick = async () => {
            const key = b.dataset.toggleform;
            formSettings[key] = !(formSettings[key] !== false);
            const ok = await dbSet(SETTINGS_KEY, formSettings);
            if(!ok){ toast('خطا در ذخیره تنظیمات','err'); return; }
            renderSettings(); updateRoleButtons();
            toast(formSettings[key] ? 'فرم '+ROLES[key].title+' فعال شد' : 'فرم '+ROLES[key].title+' غیرفعال شد');
        };
    });
}

function renderAnnounce(){
    const u = currentUser();
    const box = $('#panelAnnounce'); if(!box) return;
    if(!isCreator(u)){ box.innerHTML = '<p class="muted small">فقط سازنده دسترسی به معرفی مقام دارد.</p>'; return; }
    box.innerHTML = `
        <div class="card form" style="margin-bottom:14px">
            <label>نام و نام خانوادگی فرد<input id="annName" placeholder="نام کامل"></label>
            <label>مقام<select id="annRole">${Object.keys(ROLES).map(k => `<option value="${k}">${ROLES[k].title}</option>`).join('')}</select></label>
            <button class="btn btn-gold btn-block" id="annAdd">ثبت معرفی</button>
        </div>
        <div id="annList"></div>`;
    renderAnnList();
    
    $('#annAdd').onclick = async () => {
        const name = $('#annName').value.trim();
        if(!name){ toast('نام را وارد کنید','err'); return; }
        announcements.unshift({id:'a'+Date.now(), name, role:$('#annRole').value, date:today()});
        const ok = await dbSet(ANNOUNCE_KEY, announcements);
        if(!ok){ toast('خطا در ذخیره','err'); announcements.shift(); return; }
        $('#annName').value = '';
        renderAnnList(); renderPublicAnnounce();
        toast('معرفی ثبت شد');
    };
}

function renderAnnList(){
    const box = $('#annList'); if(!box) return;
    if(!announcements.length){ box.innerHTML = '<p class="muted small">هنوز معرفی‌ای ثبت نشده.</p>'; return; }
    box.innerHTML = announcements.map(a => `
        <div class="ann-card">
            <span>${roleTickHtml(a.role)} <b>${esc(a.name)}</b> — <span class="gold">${ROLES[a.role]?ROLES[a.role].title:a.role}</span> <span class="small muted">${a.date}</span></span>
            <button class="btn btn-red" data-delann="${a.id}">حذف</button>
        </div>`).join('');
        
    $$('#annList [data-delann]').forEach(b => {
        b.onclick = async () => {
            announcements = announcements.filter(x => x.id !== b.dataset.delann);
            const ok = await dbSet(ANNOUNCE_KEY, announcements);
            if(!ok){ toast('خطا در ذخیره','err'); return; }
            renderAnnList(); renderPublicAnnounce();
            toast('حذف شد');
        };
    });
}

document.addEventListener('click', async e => {
    const pg = e.target.closest('[data-page]');
    if(pg){ e.preventDefault(); showPage(pg.dataset.page); return; }
    
    const rl = e.target.closest('[data-role]');
    if(rl){ openRole(rl.dataset.role); return; }
    
    const cl = e.target.closest('[data-close]');
    if(cl){ const m = $('#'+cl.dataset.close); if(m) m.classList.remove('show'); return; }
    
    const lt = e.target.closest('[data-light]');
    if(lt){ const lbImg = $('#lightboxImg'); const lb = $('#lightbox'); if(lbImg) lbImg.src = lt.src; if(lb) lb.classList.add('show'); return; }
    
    const tb = e.target.closest('[data-tab]');
    if(tb){
        $$('.tab').forEach(t => t.classList.toggle('active', t === tb));
        const reqs = $('#panelReqs'); if(reqs) reqs.classList.toggle('hidden', tb.dataset.tab !== 'reqs');
        const users = $('#panelUsers'); if(users) users.classList.toggle('hidden', tb.dataset.tab !== 'users');
        const sets = $('#panelSettings'); if(sets) sets.classList.toggle('hidden', tb.dataset.tab !== 'settings');
        const ann = $('#panelAnnounce'); if(ann) ann.classList.toggle('hidden', tb.dataset.tab !== 'announce');
        return;
    }
    
    if(e.target.closest('#openRegister')){ openModal('modalRegister'); return; }
    if(e.target.closest('#openLogin')){ openModal('modalLogin'); return; }
    
    if(e.target.closest('#logoutBtn')){
        currentSession = null;
        localStorage.removeItem('ms_session');
        toast('از حساب خارج شدید');
        showPage('home');
        return;
    }
    
    const rp = e.target.closest('[data-reply]');
    if(rp){
        const id = rp.dataset.reply, txt = $('#rep-'+id)?.value.trim();
        if(!txt){ toast('متن پاسخ را بنویسید','err'); return; }
        const me = currentUser(), r = requestsCache.find(x => x.id === id);
        if(r){
            if(!r.replies) r.replies = [];
            r.replies.push({author: me.firstName+' '+me.lastName, badge: badge(me), text: txt, date: today()});
            const ok = await saveRequests();
            if(!ok){ toast('خطا در ذخیره پاسخ','err'); return; }
            renderPanelReqs(); toast('پاسخ ثبت شد');
        }
        return;
    }
    
    const ap = e.target.closest('[data-approve]');
    if(ap){
        const r = requestsCache.find(x => x.id === ap.dataset.approve);
        if(r){
            r.status = 'approved';
            const ok = await saveRequests();
            if(!ok){ toast('خطا در ذخیره','err'); return; }
            renderPanelReqs(); toast('درخواست تایید شد');
        }
        return;
    }
    
    const rj = e.target.closest('[data-reject]');
    if(rj){
        const r = requestsCache.find(x => x.id === rj.dataset.reject);
        if(r){
            r.status = 'rejected';
            const ok = await saveRequests();
            if(!ok){ toast('خطا در ذخیره','err'); return; }
            renderPanelReqs(); toast('درخواست رد شد', 'err');
        }
        return;
    }
    
    const dr = e.target.closest('[data-delreq]');
    if(dr){
        const id = dr.dataset.delreq;
        requestsCache = requestsCache.filter(x => x.id !== id);
        const ok = await saveRequests();
        if(!ok){ toast('خطا در ذخیره','err'); return; }
        renderPanelReqs(); toast('مقام حذف شد');
        return;
    }
});

const menuToggle = $('#menuToggle');
if(menuToggle) menuToggle.addEventListener('click', () => { const nav = $('#navLinksDesktop'); if(nav) nav.classList.toggle('open'); });

function openModal(id){ const m = $('#'+id); if(m) m.classList.add('show'); }
$$('.modal .dialog').forEach(d => d.addEventListener('click', e => e.stopPropagation()));
$$('.modal').forEach(m => { if(m.id !== 'lightbox') m.addEventListener('click', () => m.classList.remove('show')); });
const lightbox = $('#lightbox');
if(lightbox) lightbox.addEventListener('click', () => lightbox.classList.remove('show'));

const roleRulesBtn = $('#roleRulesBtn');
if(roleRulesBtn) roleRulesBtn.addEventListener('click', () => { const box = $('#roleRulesBox'); if(box) box.classList.toggle('hidden'); });

const roleApplyBtn = $('#roleApplyBtn');
if(roleApplyBtn) roleApplyBtn.addEventListener('click', () => openApply(currentRole));

function openRole(key){
    currentRole = key;
    const title = $('#roleTitle'); if(title) title.textContent = ROLES[key].title;
    const rules = $('#roleRulesText'); if(rules) rules.textContent = ROLES[key].rule;
    const box = $('#roleRulesBox'); if(box) box.classList.add('hidden');
    showPage('role');
}

function openApply(key){
    const u = currentUser();
    if(!u){ toast('ابتدا ثبت نام کنید یا وارد حساب شوید','err'); openModal('modalLogin'); return; }
    if(formSettings[key] === false){ toast('فرم این مقام فعلاً غیرفعال است','err'); return; }
    currentRole = key;
    const applyTitle = $('#applyRoleTitle'); if(applyTitle) applyTitle.textContent = ROLES[key].title;
    showPage('apply');
}

function bindImgPrev(inputId, prevId, maxMB=1.5){
    const input = $('#'+inputId); if(!input) return;
    input.addEventListener('change', ev => {
        const f = ev.target.files[0]; if(!f) return;
        if(f.size > maxMB*1024*1024){ toast('حجم عکس باید کمتر از '+maxMB+' مگابایت باشد','err'); ev.target.value=''; return; }
        const p = $('#'+prevId); if(p) { p.classList.remove('hidden'); p.src = URL.createObjectURL(f); }
    });
}
bindImgPrev('rAvatar','rAvatarPrev');
bindImgPrev('aShenas','prevShenas');
bindImgPrev('aPhoto','prevPhoto');

const aMedia = $('#aMedia');
if(aMedia){
    aMedia.addEventListener('change', ev => {
        const f = ev.target.files[0]; if(!f) return;
        if(!(f.type.startsWith('video') || f.type.startsWith('audio'))){ toast('فایل باید ویدیو یا ویس باشد','err'); ev.target.value=''; return; }
        const url = URL.createObjectURL(f);
        const mediaEl = document.createElement(f.type.startsWith('video') ? 'video' : 'audio');
        mediaEl.preload = 'metadata'; mediaEl.src = url;
        mediaEl.onloadedmetadata = () => {
            const dur = mediaEl.duration;
            if(dur > 120){ toast('مدت زمان نباید بیشتر از ۲ دقیقه باشد','err'); ev.target.value=''; const mn = $('#mediaName'); if(mn) mn.textContent = ''; }
            else { const mn = $('#mediaName'); if(mn) mn.textContent = 'فایل انتخاب شد: '+f.name+' ('+Math.round(dur)+' ثانیه)'; }
            URL.revokeObjectURL(url);
        };
        mediaEl.onerror = () => { toast('فایل معتبر نیست','err'); ev.target.value=''; const mn = $('#mediaName'); if(mn) mn.textContent = ''; URL.revokeObjectURL(url); };
    });
}

// ================= فرم ثبت نام (اصلاح شده و پایدار) =================
$('#registerForm').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true; btn.textContent = 'در حال ثبت...';

    try {
        const mobile = $('#rMobile').value.trim();
        if(!/^09\d{9}$/.test(mobile)){ toast('شماره موبایل معتبر نیست','err'); btn.disabled = false; btn.textContent = 'ثبت نام'; return; }
        if(usersCache.some(u => u.mobile === mobile)){ toast('این شماره قبلا ثبت نام شده است','err'); btn.disabled = false; btn.textContent = 'ثبت نام'; return; }

        let avatar = null;
        const af = $('#rAvatar').files[0];
        if(af){ 
            try { avatar = await compressImage(af, 400, 0.6); } 
            catch(err) { avatar = await readAsDataURL(af); } 
        }

        const nu = {
            id: 'u' + Date.now(),
            firstName: $('#rFirst').value.trim(),
            lastName: $('#rLast').value.trim(),
            gameName: $('#rGame').value.trim(),
            mobile, 
            email: $('#rEmail').value.trim(), 
            password: $('#rPass').value,
            role: 'user', 
            avatar
        };

        usersCache.push(nu);
        const ok = await saveUsers();
        if(!ok){ 
            toast('خطا در ارتباط با سرور، اما اطلاعات به صورت موقت ذخیره شد','err'); 
        }

        currentSession = nu.id;
        localStorage.setItem('ms_session', nu.id);

        $('#modalRegister').classList.remove('show');
        e.target.reset();
        const rAvatarPrev = $('#rAvatarPrev'); if(rAvatarPrev) rAvatarPrev.classList.add('hidden');

        toast('ثبت نام با موفقیت انجام شد، خوش آمدید');
        showPage('forms');
    } catch(err) {
        toast('خطای غیرمنتظره در ثبت نام','err');
    } finally {
        btn.disabled = false; btn.textContent = 'ثبت نام';
    }
});

// ================= فرم ورود (اصلاح شده) =================
$('#loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true; btn.textContent = 'در حال ورود...';

    try {
        const mobile = $('#lMobile').value.trim();
        const pass = $('#lPass').value;

        if(ensureDefaultUsers()){ await saveUsers(); }

        const u = usersCache.find(x => x.mobile === mobile && x.password === pass);
        if(!u){ toast('شماره موبایل یا رمز عبور اشتباه است','err'); btn.disabled = false; btn.textContent = 'ورود'; return; }

        currentSession = u.id;
        localStorage.setItem('ms_session', u.id);

        $('#modalLogin').classList.remove('show');
        e.target.reset();

        toast('خوش آمدید ' + u.firstName + ' ' + badge(u));
        showPage(isStaff(u) ? 'panel' : 'forms');
    } catch(err) {
        toast('خطا در ورود','err');
    } finally {
        btn.disabled = false; btn.textContent = 'ورود';
    }
});

// ================= فرم ارسال درخواست مقام (اصلاح شده برای ارسال به سازنده) =================
$('#applyForm').addEventListener('submit', async e => {
    e.preventDefault();
    const u = currentUser();
    if(!u){ toast('ابتدا وارد حساب شوید','err'); return; }
    if(formSettings[currentRole] === false){ toast('فرم این مقام فعلاً غیرفعال است','err'); return; }

    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true; btn.textContent = 'در حال ارسال...';

    try {
        const mobile = $('#aMobile').value.trim(), 
              nid = $('#aNid').value.trim(), 
              email = $('#aEmail').value.trim();
              
        if(!/^09\d{9}$/.test(mobile)){ toast('شماره موبایل معتبر نیست','err'); btn.disabled = false; btn.textContent = 'ارسال درخواست'; return; }
        if(!/^\d{10}$/.test(nid)){ toast('کد ملی باید ۱۰ رقم باشد','err'); btn.disabled = false; btn.textContent = 'ارسال درخواست'; return; }
        if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){ toast('ایمیل معتبر نیست','err'); btn.disabled = false; btn.textContent = 'ارسال درخواست'; return; }
        
        const sh = $('#aShenas').files[0], md = $('#aMedia').files[0], phf = $('#aPhoto').files[0];
        if(!sh || !md || !phf){ toast('آپلود همه فایل‌ها (شناسنامه، عکس، مدیا) الزامی است','err'); btn.disabled = false; btn.textContent = 'ارسال درخواست'; return; }

        // بررسی مدت زمان مدیا
        const mediaUrl = URL.createObjectURL(md);
        const mediaEl = document.createElement(md.type.startsWith('video') ? 'video' : 'audio');
        mediaEl.preload = 'metadata'; mediaEl.src = mediaUrl;
        await new Promise((res, rej) => { mediaEl.onloadedmetadata = res; mediaEl.onerror = rej; });
        const dur = mediaEl.duration;
        URL.revokeObjectURL(mediaUrl);
        if(dur > 120){ toast('مدت زمان فایل صوتی/تصویری نباید بیشتر از ۲ دقیقه باشد','err'); btn.disabled = false; btn.textContent = 'ارسال درخواست'; return; }

        let shData, phData, mdData;
        try {
            // فشرده‌سازی قوی‌تر برای اطمینان از ذخیره در Upstash
            [shData, phData] = await Promise.all([compressImage(sh, 600, 0.6), compressImage(phf, 600, 0.6)]);
            mdData = await readAsDataURL(md);
        } catch(err) { 
            toast('خطا در پردازش فایل‌ها. حجم فایل‌ها را بررسی کنید.','err'); 
            btn.disabled = false; btn.textContent = 'ارسال درخواست'; 
            return; 
        }

        const req = {
            id: 'r' + Date.now(), 
            userId: u.id, 
            role: currentRole,
            firstName: $('#aFirst').value.trim(), 
            lastName: $('#aLast').value.trim(),
            mobile, 
            landline: $('#aLand').value.trim(), 
            nid, 
            province: $('#aProvince').value.trim(), 
            email,
            shenas: shData, 
            media: mdData, 
            photo: phData,
            status: 'pending', 
            replies: [], 
            date: today()
        };
        
        requestsCache.unshift(req); // اضافه کردن به ابتدای لیست (جدیدترین اول)
        const ok = await saveRequests();
        
        if(!ok){ 
            toast('هشدار: درخواست ثبت شد اما ممکن است به دلیل مشکل شبکه با تاخیر به دست سازنده برسد.', 'err'); 
        } else {
            toast('درخواست شما با موفقیت ثبت و برای پشتیبانی/سازنده ارسال شد');
        }

        e.target.reset();
        const prevShenas = $('#prevShenas'); if(prevShenas) prevShenas.classList.add('hidden');
        const prevPhoto = $('#prevPhoto'); if(prevPhoto) prevPhoto.classList.add('hidden');
        const mediaName = $('#mediaName'); if(mediaName) mediaName.textContent = '';

        showPage('forms');
    } catch(err) {
        toast('خطای غیرمنتظره در ارسال فرم','err');
    } finally {
        btn.disabled = false; btn.textContent = 'ارسال درخواست';
    }
});

function applyFallbacks(){
    $$('img[data-ph]').forEach(img => {
        const fix = () => { img.src = ph(img.dataset.ph); };
        if(img.complete && img.naturalWidth === 0) fix();
        else img.addEventListener('error', fix, {once:true});
    });
}

(async function init(){
    applyFallbacks();
    await loadAllData();
    renderUserArea();
    renderNavLinks();
    showPage('home');
})();