'use strict';

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

async function upstashGet(url, token, k){
    try{
        const c=new AbortController();const t=setTimeout(()=>c.abort(),8000);
        const r=await fetch(url+'/get/'+encodeURIComponent(k),{headers:{'Authorization':'Bearer '+token},signal:c.signal});
        clearTimeout(t);if(!r.ok)return null;const d=await r.json();
        if(d&&d.result){try{return JSON.parse(d.result);}catch(e){return d.result;}}
        return null;
    }catch(e){return null;}
}
async function upstashSet(url, token, k, v){
    try{
        const jsonValue=JSON.stringify(v);const c=new AbortController();const t=setTimeout(()=>c.abort(),8000);
        const r=await fetch(url+'/set/'+encodeURIComponent(k)+'/'+encodeURIComponent(jsonValue),{headers:{'Authorization':'Bearer '+token},signal:c.signal});
        clearTimeout(t);return r.ok;
    }catch(e){return false;}
}
async function dbGet(key){
    let v=await upstashGet(UPSTASH_OLD_URL,UPSTASH_OLD_TOKEN,key);if(v!==null)return v;
    v=await upstashGet(UPSTASH_NEW_URL,UPSTASH_NEW_TOKEN,key);if(v!==null)return v;
    return null;
}
async function dbSet(key,value){
    const p1=upstashSet(UPSTASH_OLD_URL,UPSTASH_OLD_TOKEN,key,value);
    const p2=upstashSet(UPSTASH_NEW_URL,UPSTASH_NEW_TOKEN,key,value);
    const r=await Promise.allSettled([p1,p2]);
    return r.some(x=>x.status==='fulfilled'&&x.value===true);
}

// ✅ اکانت‌های پیش‌فرض که همیشه باید وجود داشته باشن
const DEFAULT_USERS = [
    {id:'u-creator',firstName:'سازنده',lastName:'مافیاسان',gameName:'Creator',mobile:'09904844031',email:'-',password:'Par1617230',role:'creator',avatar:null},
    {id:'u-sup1',firstName:'پشتیبانی',lastName:'مافیاسان',gameName:'Support 1',mobile:'09940940720',email:'-',password:'Erfan.sh85',role:'support',avatar:null},
    {id:'u-sup2',firstName:'پشتیبانی',lastName:'مافیاسان',gameName:'Support 2',mobile:'09904845012',email:'-',password:'1234567890',role:'support',avatar:null}
];

let usersCache = [];
let requestsCache = [];
let formSettings = {};
let announcements = [];
let currentSession = localStorage.getItem('ms_session') || null;

// ✅ تضمین وجود اکانت‌های پیش‌فرض با رمز درست
function ensureDefaultUsers(){
    let changed = false;
    DEFAULT_USERS.forEach(du => {
        const ex = usersCache.find(u => u.mobile === du.mobile);
        if(!ex){ usersCache.push({...du}); changed = true; }
        else {
            if(ex.password !== du.password){ ex.password = du.password; changed = true; }
            if(ex.role !== du.role){ ex.role = du.role; changed = true; }
        }
    });
    return changed;
}

async function loadAllData(){
    try{
        const [u, r, s, a] = await Promise.all([
            dbGet(USERS_KEY), dbGet(REQUESTS_KEY), dbGet(SETTINGS_KEY), dbGet(ANNOUNCE_KEY)
        ]);
        
        // ✅ اصلاح حیاتی: اگر به دلیل خطای شبکه u نال بود، دیتابیس را بازنویسی نمی‌کنیم تا اطلاعات کاربران پاک نشود.
        if(u && Array.isArray(u)) {
            usersCache = u;
        } else {
            usersCache = JSON.parse(JSON.stringify(DEFAULT_USERS));
        }
        
        if(r && Array.isArray(r)) requestsCache = r; else requestsCache = [];
        if(s && typeof s === 'object') formSettings = s;
        else formSettings = {nazer:true,nazerArshad:true,admin:true,adminArshad:true,gardanandeh:true,poshtibani:true};
        if(a && Array.isArray(a)) announcements = a; else announcements = [];

        // ✅ فقط در صورتی تغییرات را ذخیره کن که داده‌ها از دیتابیس خوانده شده باشند (u !== null) و نیاز به آپدیت دیفالت‌ها باشد.
        if(u !== null && ensureDefaultUsers()){ 
            await dbSet(USERS_KEY, usersCache); 
        }
        
        // مقداردهی اولیه سایر کلیدها فقط در صورتی که واقعاً خالی باشند
        if(!r){ await dbSet(REQUESTS_KEY, requestsCache); }
        if(!s){ await dbSet(SETTINGS_KEY, formSettings); }
        if(!a){ await dbSet(ANNOUNCE_KEY, announcements); }
    }catch(e){
        console.error(e);
        toast('خطا در دریافت اطلاعات','err');
    }
}

async function saveUsers(){ return await dbSet(USERS_KEY, usersCache); }
async function saveRequests(){ return await dbSet(REQUESTS_KEY, requestsCache); }

function currentUser(){ return usersCache.find(u => u.id === currentSession) || null; }
const isStaff = u => u && (u.role === 'creator' || u.role === 'support');
const isCreator = u => u && u.role === 'creator';
const statusFa = s => ({pending:'در انتظار',approved:'تایید شده',rejected:'رد شده'}[s]);

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
    nazer:{title:'ناظر',rule:'حداقل سن مورد نیاز ۱۹ سال به بالا.'},
    nazerArshad:{title:'ناظر ارشد',rule:'حداقل سن مورد نیاز ۲۵ سال به بالا.'},
    admin:{title:'ادمین',rule:'حداقل سن ۲۲ سال به بالا می‌باشد.'},
    adminArshad:{title:'ادمین ارشد',rule:'حداقل سن مورد نیاز برای تایید شدن ۲۷ سال می‌باشد.'},
    gardanandeh:{title:'گرداننده',rule:'سن مورد نظر باید حداقل ۲۵ سال به بالا باشد و از طرف پشتیبانی انتخاب می‌شود.'},
    poshtibani:{title:'پشتیبانی',rule:'انتخاب نیروی پشتیبانی فقط با تشخیص و تایید سازنده سایت انجام می‌شود.'}
};

const ROLE_TICK = {
    poshtibani:{c:'#2f81f7'}, gardanandeh:{c:'#2fbf71'}, adminArshad:{c:'#111111'},
    admin:{c:'#ff8c00'}, nazerArshad:{c:'#800080'}, nazer:{c:'#ff69b4'}
};
function roleTickHtml(role){
    const t=ROLE_TICK[role]; if(!t) return '';
    return '<span class="rtick" style="background:'+t.c+'">✓</span>';
}

let toastTimer;
function toast(msg,type='ok'){
    const t=$('#toast');t.textContent=msg;t.className='toast show '+(type==='err'?'t-err':'t-ok');
    clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),3500);
}

let currentPage='home', currentRole='nazer';

async function compressImage(file, maxSize=800, quality=0.7){
    return new Promise((res,rej)=>{
        const img = new Image();
        img.onload = ()=>{
            const canvas = document.createElement('canvas');
            let w=img.width, h=img.height;
            if(w>h){if(w>maxSize){h*=maxSize/w;w=maxSize;}} else {if(h>maxSize){w*=maxSize/h;h=maxSize;}}
            canvas.width=w;canvas.height=h;
            const ctx=canvas.getContext('2d');
            ctx.drawImage(img,0,0,w,h);
            res(canvas.toDataURL('image/jpeg',quality));
        };
        img.onerror=rej;
        img.src=URL.createObjectURL(file);
    });
}
async function readAsDataURL(f){
    return new Promise((res,rej)=>{
        const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(f);
    });
}

function renderUserArea(){
    const u=currentUser();const area=$('#userArea');
    if(u){
        area.innerHTML=`<img src="${u.avatar || defaultAvatar}" class="user-avatar" alt="avatar" onerror="this.src='${defaultAvatar}'">
            <span><b>${esc(u.firstName)}</b> ${badge(u)}</span>
            <button class="btn btn-ghost" id="logoutBtn">خروج</button>`;
    }else{
        area.innerHTML=`<button class="btn btn-gold" id="openRegister">ثبت نام</button>
            <button class="btn btn-ghost" id="openLogin">ورود</button>`;
    }
}

function renderNavLinks(){
    const u=currentUser();
    $$('#navLinksDesktop a').forEach(a=>a.classList.remove('active'));
    const active=$$(`#navLinksDesktop a[data-page="${currentPage}"]`);
    if(active.length) active[0].classList.add('active');
    const panelLink=$('#navLinksDesktop a[data-page="panel"]');
    const rulesLink=$('#navLinksDesktop a[data-page="rules"]');
    const formsLink=$('#navLinksDesktop a[data-page="forms"]');
    if(u){
        if(panelLink) panelLink.style.display=isStaff(u)?'':'none';
        if(rulesLink) rulesLink.style.display='';
        if(formsLink) formsLink.style.display='';
    }else{
        if(panelLink) panelLink.style.display='none';
        if(rulesLink) rulesLink.style.display='none';
        if(formsLink) formsLink.style.display='none';
    }
}

function updateRoleButtons(){
    $$('#roleGrid [data-role]').forEach(b=>{
        const key=b.dataset.role;
        const on=formSettings[key]!==false;
        b.disabled=!on;
        b.classList.toggle('off',!on);
        b.textContent=ROLES[key].title+(on?'':' (غیرفعال)');
    });
}

function renderPublicAnnounce(){
    const box=$('#publicAnnounce');
    if(!announcements.length){box.innerHTML='<p class="muted small">هنوز معرفی‌ای ثبت نشده است.</p>';return;}
    box.innerHTML=announcements.map(a=>`
        <div class="ann-card">
            <span>${roleTickHtml(a.role)} <b>${esc(a.name)}</b> — <span class="gold">${ROLES[a.role]?ROLES[a.role].title:a.role}</span></span>
            <span class="small muted">${a.date}</span>
        </div>`).join('');
}

function showPage(name){
    const u=currentUser();
    if(name==='forms' && !u) name='home';
    if(name==='rules' && !u) name='home';
    if(name==='panel' && !isStaff(u)) name='home';
    currentPage=name;
    $$('.page').forEach(p=>p.classList.toggle('active',p.id==='page-'+name));
    if(name==='forms'){renderMyRequests();updateRoleButtons();renderPublicAnnounce();}
    if(name==='panel') renderPanel();
    renderNavLinks();renderUserArea();
    $('#navLinksDesktop').classList.remove('open');
    window.scrollTo({top:0,behavior:'smooth'});
}

function renderMyRequests(){
    const u=currentUser();if(!u) return;
    const reqs=requestsCache.filter(r=>r.userId===u.id);
    const box=$('#myRequests');
    if(!reqs.length){box.innerHTML='<p class="muted small">هنوز درخواستی ثبت نکرده‌اید.</p>';return;}
    box.innerHTML=reqs.map(r=>`
        <div class="card req-card">
            <div class="req-head">
                <strong>درخواست مقام <b class="gold">${ROLES[r.role].title}</b></strong>
                <span class="status st-${r.status}">${statusFa(r.status)}</span>
                <span class="small muted">${r.date}</span>
            </div>
            <div class="replies">
                ${r.replies && r.replies.length?r.replies.map(rep=>`
                    <div class="reply"><b>${esc(rep.author)} ${rep.badge}</b><p>${esc(rep.text)}</p><span class="small muted">${rep.date}</span></div>
                `).join(''):'<p class="small muted">هنوز پاسخی ثبت نشده است.</p>'}
            </div>
        </div>`).join('');
}

function renderPanel(){
    const u=currentUser();if(!isStaff(u)) return;
    $('#panelRoleTitle').innerHTML=(isCreator(u)?'سازنده ':'پشتیبانی ')+badge(u);
    renderPanelReqs(); renderPanelUsers(); renderSettings(); renderAnnounce();
}

function renderPanelReqs(){
    const box=$('#panelReqs');
    if(!requestsCache.length) box.innerHTML='<p class="muted small">هنوز درخواستی ثبت نشده است.</p>';
    else{
        box.innerHTML=requestsCache.map(r=>{
            const owner=usersCache.find(x=>x.id===r.userId);
            const delApproved = r.status==='approved' ? `<button class="btn btn-red" data-delreq="${r.id}">حذف مقام</button>` : '';
            const ownerInfo = owner ? `
                <div style="margin-top:10px;padding:10px;background:rgba(0,0,0,.3);border-radius:8px;">
                    <b style="color:#f0b429;">اطلاعات حساب:</b><br>
                    <span>نام کاربری: ${esc(owner.firstName)} ${esc(owner.lastName)}</span><br>
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
                    ${r.media && r.media.startsWith('data:audio')?`<audio controls src="${r.media}"></audio>`:`<video controls src="${r.media}"></video>`}
                </div>
                <div class="replies">
                    ${r.replies && r.replies.length?r.replies.map(rep=>`
                        <div class="reply"><b>${esc(rep.author)} ${rep.badge}</b><p>${esc(rep.text)}</p><span class="small muted">${rep.date}</span></div>
                    `).join(''):'<p class="small muted">هنوز پاسخی ثبت نشده.</p>'}
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
}

function renderPanelUsers(){
    const usersTable=$('#panelUsers');
    usersTable.innerHTML=`<div class="table-wrap"><table>
        <tr><th>نام</th><th>نام خانوادگی</th><th>بازی</th><th>موبایل</th><th>ایمیل</th><th>مقام</th></tr>
        ${usersCache.map(x=>`<tr><td>${esc(x.firstName)}</td><td>${esc(x.lastName)}</td><td>${esc(x.gameName||'-')}</td><td>${esc(x.mobile)}</td><td>${esc(x.email||'-')}</td><td>${badge(x)||'کاربر'}</td></tr>`).join('')}
    </table></div>`;
}

function renderSettings(){
    const box=$('#panelSettings');
    const u=currentUser();
    if(!isCreator(u)){box.innerHTML='<p class="muted small">فقط سازنده دسترسی به تنظیمات فرم‌ها دارد.</p>';return;}
    box.innerHTML=Object.keys(ROLES).map(key=>{
        const on=formSettings[key]!==false;
        return `<div class="setting-row"><b>فرم ${ROLES[key].title}</b>
            <button class="btn ${on?'btn-green':'btn-red'}" data-toggleform="${key}">${on?'فعال ✓':'غیرفعال ✕'}</button></div>`;
    }).join('');
    $$('#panelSettings [data-toggleform]').forEach(b=>{
        b.onclick=async()=>{
            const key=b.dataset.toggleform;
            formSettings[key]=!(formSettings[key]!==false);
            const ok=await dbSet(SETTINGS_KEY, formSettings);
            if(!ok){toast('خطا در ذخیره تنظیمات','err');return;}
            renderSettings();updateRoleButtons();
            toast(formSettings[key]?'فرم '+ROLES[key].title+' فعال شد':'فرم '+ROLES[key].title+' غیرفعال شد');
        };
    });
}

function renderAnnounce(){
    const u=currentUser();
    const box=$('#panelAnnounce');
    if(!isCreator(u)){box.innerHTML='<p class="muted small">فقط سازنده دسترسی به معرفی مقام دارد.</p>';return;}
    box.innerHTML=`
        <div class="card form" style="margin-bottom:14px">
            <label>نام و نام خانوادگی فرد<input id="annName" placeholder="نام کامل"></label>
            <label>مقام<select id="annRole">${Object.keys(ROLES).map(k=>`<option value="${k}">${ROLES[k].title}</option>`).join('')}</select></label>
            <button class="btn btn-gold btn-block" id="annAdd">ثبت معرفی</button>
        </div>
        <div id="annList"></div>`;
    renderAnnList();
    $('#annAdd').onclick=async()=>{
        const name=$('#annName').value.trim();
        if(!name){toast('نام را وارد کنید','err');return;}
        announcements.unshift({id:'a'+Date.now(),name,role:$('#annRole').value,date:today()});
        const ok=await dbSet(ANNOUNCE_KEY, announcements);
        if(!ok){toast('خطا در ذخیره','err');announcements.shift();return;}
        $('#annName').value='';
        renderAnnList();renderPublicAnnounce();
        toast('معرفی ثبت شد');
    };
}
function renderAnnList(){
    const box=$('#annList');
    if(!announcements.length){box.innerHTML='<p class="muted small">هنوز معرفی‌ای ثبت نشده.</p>';return;}
    box.innerHTML=announcements.map(a=>`
        <div class="ann-card">
            <span>${roleTickHtml(a.role)} <b>${esc(a.name)}</b> — <span class="gold">${ROLES[a.role]?ROLES[a.role].title:a.role}</span> <span class="small muted">${a.date}</span></span>
            <button class="btn btn-red" data-delann="${a.id}">حذف</button>
        </div>`).join('');
    $$('#annList [data-delann]').forEach(b=>{
        b.onclick=async()=>{
            announcements=announcements.filter(x=>x.id!==b.dataset.delann);
            const ok=await dbSet(ANNOUNCE_KEY, announcements);
            if(!ok){toast('خطا در ذخیره','err');return;}
            renderAnnList();renderPublicAnnounce();
            toast('حذف شد');
        };
    });
}

document.addEventListener('click', async e=>{
    const pg=e.target.closest('[data-page]');
    if(pg){e.preventDefault();showPage(pg.dataset.page);return;}
    const rl=e.target.closest('[data-role]');
    if(rl){openRole(rl.dataset.role);return;}
    const cl=e.target.closest('[data-close]');
    if(cl){$('#'+cl.dataset.close).classList.remove('show');return;}
    const lt=e.target.closest('[data-light]');
    if(lt){$('#lightboxImg').src=lt.src;$('#lightbox').classList.add('show');return;}
    const tb=e.target.closest('[data-tab]');
    if(tb){
        $$('.tab').forEach(t=>t.classList.toggle('active',t===tb));
        $('#panelReqs').classList.toggle('hidden',tb.dataset.tab!=='reqs');
        $('#panelUsers').classList.toggle('hidden',tb.dataset.tab!=='users');
        $('#panelSettings').classList.toggle('hidden',tb.dataset.tab!=='settings');
        $('#panelAnnounce').classList.toggle('hidden',tb.dataset.tab!=='announce');
        return;
    }
    if(e.target.closest('#openRegister')){openModal('modalRegister');return;}
    if(e.target.closest('#openLogin')){openModal('modalLogin');return;}
    if(e.target.closest('#logoutBtn')){
        currentSession=null;localStorage.removeItem('ms_session');
        toast('از حساب خارج شدید');showPage('home');return;
    }
    const rp=e.target.closest('[data-reply]');
    if(rp){
        const id=rp.dataset.reply, txt=$('#rep-'+id).value.trim();
        if(!txt){toast('متن پاسخ را بنویسید','err');return;}
        const me=currentUser(), r=requestsCache.find(x=>x.id===id);
        if(r){
            if(!r.replies) r.replies=[];
            r.replies.push({author:me.firstName+' '+me.lastName,badge:badge(me),text:txt,date:today()});
            const ok=await saveRequests();
            if(!ok){toast('خطا در ذخیره پاسخ','err');return;}
            renderPanelReqs();toast('پاسخ ثبت شد');
        }
        return;
    }
    const ap=e.target.closest('[data-approve]');
    if(ap){
        const r=requestsCache.find(x=>x.id===ap.dataset.approve);
        if(r){r.status='approved';const ok=await saveRequests();if(!ok){toast('خطا در ذخیره','err');return;}renderPanelReqs();toast('درخواست تایید شد');}
        return;
    }
    const rj=e.target.closest('[data-reject]');
    if(rj){
        const r=requestsCache.find(x=>x.id===rj.dataset.reject);
        if(r){r.status='rejected';const ok=await saveRequests();if(!ok){toast('خطا در ذخیره','err');return;}renderPanelReqs();toast('درخواست رد شد','err');}
        return;
    }
    const dr=e.target.closest('[data-delreq]');
    if(dr){
        const id=dr.dataset.delreq;
        requestsCache=requestsCache.filter(x=>x.id!==id);
        const ok=await saveRequests();
        if(!ok){toast('خطا در ذخیره','err');return;}
        renderPanelReqs();toast('مقام حذف شد');
        return;
    }
});

$('#menuToggle').addEventListener('click',()=>{ $('#navLinksDesktop').classList.toggle('open'); });

function openModal(id){$('#'+id).classList.add('show');}
$$('.modal .dialog').forEach(d=>d.addEventListener('click',e=>e.stopPropagation()));
$$('.modal').forEach(m=>{ if(m.id!=='lightbox') m.addEventListener('click',()=>m.classList.remove('show')); });
$('#lightbox').addEventListener('click',()=>$('#lightbox').classList.remove('show'));

$('#roleRulesBtn').addEventListener('click',()=>$('#roleRulesBox').classList.toggle('hidden'));
$('#roleApplyBtn').addEventListener('click',()=>openApply(currentRole));

function openRole(key){
    currentRole=key;
    $('#roleTitle').textContent=ROLES[key].title;
    $('#roleRulesText').textContent=ROLES[key].rule;
    $('#roleRulesBox').classList.add('hidden');
    showPage('role');
}
function openApply(key){
    const u=currentUser();
    if(!u){toast('ابتدا ثبت نام کنید یا وارد حساب شوید','err');openModal('modalLogin');return;}
    if(formSettings[key]===false){toast('فرم این مقام فعلاً غیرفعال است','err');return;}
    currentRole=key;
    $('#applyRoleTitle').textContent=ROLES[key].title;
    showPage('apply');
}

function bindImgPrev(inputId, prevId, maxMB=1.5){
    $('#'+inputId).addEventListener('change', ev=>{
        const f=ev.target.files[0];if(!f) return;
        if(f.size>maxMB*1024*1024){toast('حجم عکس باید کمتر از '+maxMB+' مگابایت باشد','err');ev.target.value='';return;}
        const p=$('#'+prevId);p.classList.remove('hidden');
        p.src=URL.createObjectURL(f);
    });
}
bindImgPrev('rAvatar','rAvatarPrev');
bindImgPrev('aShenas','prevShenas');
bindImgPrev('aPhoto','prevPhoto');

$('#aMedia').addEventListener('change', ev=>{
    const f=ev.target.files[0];if(!f) return;
    if(!(f.type.startsWith('video')||f.type.startsWith('audio'))){toast('فایل باید ویدیو یا ویس باشد','err');ev.target.value='';return;}
    const url=URL.createObjectURL(f);
    const mediaEl=document.createElement(f.type.startsWith('video')?'video':'audio');
    mediaEl.preload='metadata';mediaEl.src=url;
    mediaEl.onloadedmetadata=()=>{
        const dur=mediaEl.duration;
        if(dur>120){toast('مدت زمان نباید بیشتر از ۲ دقیقه باشد','err');ev.target.value='';$('#mediaName').textContent='';}
        else{$('#mediaName').textContent='فایل انتخاب شد: '+f.name+' ('+Math.round(dur)+' ثانیه)';}
        URL.revokeObjectURL(url);
    };
    mediaEl.onerror=()=>{toast('فایل معتبر نیست','err');ev.target.value='';$('#mediaName').textContent='';URL.revokeObjectURL(url);};
});

// ✅ ثبت نام و ورود مستقیم به حساب کاربری
$('#registerForm').addEventListener('submit', async e=>{
    e.preventDefault();
    const mobile=$('#rMobile').value.trim();
    if(!/^09\d{9}$/.test(mobile)){toast('شماره موبایل معتبر نیست','err');return;}
    if(usersCache.some(u=>u.mobile===mobile)){toast('این شماره قبلا ثبت نام شده است','err');return;}
    
    let avatar=null;
    const af=$('#rAvatar').files[0];
    if(af){ try{avatar=await compressImage(af,400,0.6);}catch(err){avatar=await readAsDataURL(af);} }
    
    const nu={
        id:'u'+Date.now(),
        firstName:$('#rFirst').value.trim(),
        lastName:$('#rLast').value.trim(),
        gameName:$('#rGame').value.trim(),
        mobile, email:$('#rEmail').value.trim(), password:$('#rPass').value,
        role:'user', avatar
    };
    
    usersCache.push(nu);
    const ok=await saveUsers();
    if(!ok){toast('خطا در ثبت نام','err');usersCache.pop();return;}
    
    // ✅ تنظیم نشست (Session) و ورود خودکار
    currentSession=nu.id;
    localStorage.setItem('ms_session',nu.id);
    
    $('#modalRegister').classList.remove('show');
    e.target.reset();
    $('#rAvatarPrev').classList.add('hidden');
    
    toast('ثبت نام با موفقیت انجام شد، خوش آمدید');
    showPage('forms'); // هدایت مستقیم به بخش کاربری
});

$('#loginForm').addEventListener('submit', async e=>{
    e.preventDefault();
    const mobile=$('#lMobile').value.trim();
    const pass=$('#lPass').value;
    
    // اطمینان از وجود اکانت‌های پیش‌فرض
    if(ensureDefaultUsers()){ await saveUsers(); }
    
    const u=usersCache.find(x=>x.mobile===mobile && x.password===pass);
    if(!u){toast('شماره موبایل یا رمز عبور اشتباه است','err');return;}
    
    // ✅ تنظیم نشست (Session) و ورود مستقیم
    currentSession=u.id;
    localStorage.setItem('ms_session',u.id);
    
    $('#modalLogin').classList.remove('show');
    e.target.reset();
    
    toast('خوش آمدید '+u.firstName+' '+badge(u));
    // ✅ هدایت هوشمند: پشتیبانی به پنل، کاربر ساده به فرم‌ها
    showPage(isStaff(u)?'panel':'forms');
});

$('#applyForm').addEventListener('submit', async e=>{
    e.preventDefault();
    const u=currentUser();if(!u){toast('ابتدا وارد حساب شوید','err');return;}
    if(formSettings[currentRole]===false){toast('فرم این مقام فعلاً غیرفعال است','err');return;}
    const mobile=$('#aMobile').value.trim(), nid=$('#aNid').value.trim(), email=$('#aEmail').value.trim();
    if(!/^09\d{9}$/.test(mobile)){toast('شماره موبایل معتبر نیست','err');return;}
    if(!/^\d{10}$/.test(nid)){toast('کد ملی باید ۱۰ رقم باشد','err');return;}
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){toast('ایمیل معتبر نیست','err');return;}
    const sh=$('#aShenas').files[0], md=$('#aMedia').files[0], phf=$('#aPhoto').files[0];
    if(!sh||!md||!phf){toast('همه فایل‌ها الزامی است','err');return;}
    
    const mediaUrl=URL.createObjectURL(md);
    const mediaEl=document.createElement(md.type.startsWith('video')?'video':'audio');
    mediaEl.preload='metadata';mediaEl.src=mediaUrl;
    await new Promise((res,rej)=>{mediaEl.onloadedmetadata=res;mediaEl.onerror=rej;});
    const dur=mediaEl.duration;URL.revokeObjectURL(mediaUrl);
    if(dur>120){toast('مدت زمان نباید بیشتر از ۲ دقیقه باشد','err');return;}
    
    let shData, phData, mdData;
    try{
        [shData, phData] = await Promise.all([compressImage(sh,800,0.7), compressImage(phf,800,0.7)]);
        mdData = await readAsDataURL(md);
    }catch(err){toast('خطا در پردازش فایل‌ها','err');return;}
    
    const req={
        id:'r'+Date.now(), userId:u.id, role:currentRole,
        firstName:$('#aFirst').value.trim(), lastName:$('#aLast').value.trim(),
        mobile, landline:$('#aLand').value.trim(), nid, province:$('#aProvince').value.trim(), email,
        shenas:shData, media:mdData, photo:phData,
        status:'pending', replies:[], date:today()
    };
    requestsCache.unshift(req);
    const ok=await saveRequests();
    if(!ok){toast('خطا در ارسال درخواست','err');requestsCache.shift();return;}
    
    e.target.reset();
    $('#prevShenas').classList.add('hidden');
    $('#prevPhoto').classList.add('hidden');
    $('#mediaName').textContent='';
    toast('درخواست شما با موفقیت ثبت شد و برای پشتیبانی ارسال شد');
    showPage('forms');
});

function applyFallbacks(){
    $$('img[data-ph]').forEach(img=>{
        const fix=()=>{img.src=ph(img.dataset.ph);};
        if(img.complete && img.naturalWidth===0) fix();
        else img.addEventListener('error',fix,{once:true});
    });
}

(async function init(){
    applyFallbacks();
    await loadAllData();
    renderUserArea();
    renderNavLinks();
    showPage('home');
})();