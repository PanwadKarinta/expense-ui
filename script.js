/* ═══════════════════════════════════════════════════════════
   MODULE 1 — STORAGE HELPERS
   ───────────────────────────────────────────────────────────
   localStorage ทำงานอย่างไร:
   - เป็น key-value store ในเบราว์เซอร์
   - เก็บข้อมูลได้เฉพาะ String ต้องแปลงด้วย JSON
   - ข้อมูลยังอยู่แม้ปิด Tab หรือ Refresh หน้า
   - localStorage.setItem(key, value) — บันทึก
   - localStorage.getItem(key)        — อ่าน
   - ถ้า key ไม่มี getItem คืน null
   ═══════════════════════════════════════════════════════════ */
const lsGet = (k, def=[]) => { try{ return JSON.parse(localStorage.getItem(k)) ?? def }catch{ return def } };
const lsSet = (k, v)       => localStorage.setItem(k, JSON.stringify(v));

/* ═══════════════════════════════════════════════════════════
   MODULE 2 — AUTH SYSTEM
   ───────────────────────────────────────────────────────────
   โครงสร้าง User object (เก็บใน localStorage key: fc_users):
   {
     username:    "john",          -- unique, case-insensitive
     displayName: "John Doe",      -- ชื่อที่แสดง
     password:    "sha256hash...", -- hash ของ "username:password"
     createdAt:   "ISO date"
   }

   Session (sessionStorage — หายเมื่อปิด Tab):
   { username, displayName }

   หลักการ SHA-256 Hash:
   - ไม่เก็บรหัสผ่านตรงๆ เก็บเป็น hash แทน
   - ตอน login: hash input แล้วเปรียบเทียบกับที่บันทึก
   ═══════════════════════════════════════════════════════════ */

/** SHA-256 ด้วย Web Crypto API (built-in browser) */
async function sha256(str){
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('');
}

const getUsers   = ()  => lsGet('fc_users', []);
const saveUsers  = u   => lsSet('fc_users', u);
const getSess    = ()  => { try{ return JSON.parse(sessionStorage.getItem('fc_sess')) }catch{ return null } };
const saveSess   = s   => sessionStorage.setItem('fc_sess', JSON.stringify(s));
const clearSess  = ()  => sessionStorage.removeItem('fc_sess');

let CU = null; // Current User object

/* ── Tab Switch ── */
function switchTab(t){
  document.getElementById('loginForm').style.display = t==='login' ? '' : 'none';
  document.getElementById('regForm')  .style.display = t==='reg'   ? '' : 'none';
  document.getElementById('tabL').classList.toggle('on', t==='login');
  document.getElementById('tabR').classList.toggle('on', t==='reg');
  ['lErr','rUErr','rNErr','rEErr','rPErr','rP2Err'].forEach(id=>{
    const e=document.getElementById(id); if(e){e.textContent='';e.classList.remove('on')}
  });
}

/** แสดง/ซ่อนรหัสผ่าน */
function eyeToggle(id, el){
  const i = document.getElementById(id);
  i.type = i.type==='password'?'text':'password';
  el.textContent = i.type==='password'?'👁':'🙈';
}

/** ตรวจ email แบบ real-time */
function liveCheckEmail(){
  const v  = document.getElementById('rEmail').value.trim();
  const ic = document.getElementById('rEmailIco');
  const er = document.getElementById('rEErr');
  if(!v){ ic.textContent='📧'; er.classList.remove('on'); return; }
  const validFmt = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  if(!validFmt){
    ic.textContent='❌'; er.textContent='รูปแบบอีเมลไม่ถูกต้อง'; er.classList.add('on'); return;
  }
  const taken = getUsers().some(u => u.email && u.email.toLowerCase()===v.toLowerCase());
  ic.textContent = taken ? '❌' : '✅';
  er.textContent  = taken ? 'อีเมลนี้ถูกใช้แล้ว' : '';
  er.classList.toggle('on', taken);
}
function liveCheckUser(){
  const v=document.getElementById('rUser').value.trim();
  const ic=document.getElementById('rUserIco');
  const er=document.getElementById('rUErr');
  if(!v){ic.textContent='✏️';er.classList.remove('on');return}
  if(!/^[a-zA-Z0-9_]{3,20}$/.test(v)){
    ic.textContent='❌';er.textContent='ใช้ a-z 0-9 _ เท่านั้น (3-20 ตัว)';er.classList.add('on');return;
  }
  const taken=getUsers().some(u=>u.username.toLowerCase()===v.toLowerCase());
  ic.textContent=taken?'❌':'✅';
  er.textContent=taken?'ชื่อผู้ใช้นี้ถูกใช้แล้ว':'';
  er.classList.toggle('on',taken);
}

/** แถบความแข็งแกร่งรหัสผ่าน */
function pwStrength(){
  const p=document.getElementById('rPass').value;
  let s=0;
  if(p.length>=6) s++;
  if(p.length>=10) s++;
  if(/[A-Z]/.test(p)||/[0-9]/.test(p)) s++;
  if(/[^a-zA-Z0-9]/.test(p)) s++;
  const cols=['#c0392b','#e67e22','#d4622a','#1a7f5a'];
  const lbls=['อ่อนมาก','อ่อน','ปานกลาง','แข็งแกร่ง'];
  for(let i=1;i<=4;i++) document.getElementById('ps'+i).style.background = i<=s?cols[s-1]:'var(--bdr)';
  document.getElementById('psLbl').textContent=p?lbls[s-1]||'':'';
  document.getElementById('psLbl').style.color=p?cols[s-1]:'var(--mut)';
}

/* ── REGISTER ── */
async function doRegister(){
  const user  = document.getElementById('rUser').value.trim();
  const name  = document.getElementById('rName').value.trim();
  const email = document.getElementById('rEmail').value.trim();
  const pass  = document.getElementById('rPass').value;
  const pass2 = document.getElementById('rPass2').value;
  let ok = true;

  const se=(id,m)=>{const e=document.getElementById(id);e.textContent=m;e.classList.add('on');ok=false};
  ['rUErr','rNErr','rEErr','rPErr','rP2Err'].forEach(id=>{
    const e=document.getElementById(id); e.classList.remove('on');
  });

  // ── Validate ──
  if(!/^[a-zA-Z0-9_]{3,20}$/.test(user))
    se('rUErr','ใช้ a-z 0-9 _ เท่านั้น (3-20 ตัว)');
  else if(getUsers().some(u=>u.username.toLowerCase()===user.toLowerCase()))
    se('rUErr','ชื่อผู้ใช้นี้ถูกใช้แล้ว');

  if(!name) se('rNErr','กรุณากรอกชื่อที่แสดง');

  if(!email)
    se('rEErr','กรุณากรอกอีเมล');
  else if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    se('rEErr','รูปแบบอีเมลไม่ถูกต้อง');
  else if(getUsers().some(u=>u.email && u.email.toLowerCase()===email.toLowerCase()))
    se('rEErr','อีเมลนี้ถูกใช้แล้ว');

  if(pass.length<6) se('rPErr','รหัสผ่านต้องมีอย่างน้อย 6 ตัว');
  else if(pass!==pass2) se('rP2Err','รหัสผ่านไม่ตรงกัน');

  if(!ok) return;

  const btn = document.getElementById('regBtn');
  btn.textContent='⏳ กำลังประมวลผล...'; btn.disabled=true;

  const pwh = await sha256(user.toLowerCase()+':'+pass);
  // บันทึก email ไว้ใน user object ด้วย
  const nu  = {
    username:user, displayName:name, email,
    password:pwh, createdAt:new Date().toISOString()
  };
  const arr = getUsers(); arr.push(nu); saveUsers(arr);
  loginSuccess(nu, true);
  showToast(`🎉 ยินดีต้อนรับ ${name}! บัญชีสร้างสำเร็จแล้ว`, 'ok');
}

/* ── LOGIN ── */
async function doLogin(){
  const user=document.getElementById('lUser').value.trim();
  const pass=document.getElementById('lPass').value;
  const err=document.getElementById('lErr');
  err.classList.remove('on');
  if(!user||!pass){err.textContent='กรุณากรอกข้อมูลให้ครบ';err.classList.add('on');return}

  const pwh = await sha256(user.toLowerCase()+':'+pass);
  const found = getUsers().find(u=>u.username.toLowerCase()===user.toLowerCase()&&u.password===pwh);
  if(!found){err.classList.add('on');return}
  loginSuccess(found);
}

/* ── เปิด / ปิด Auth Modal ── */

/**
 * openAuth(tab) — เปิด modal และเลือก tab
 * เรียกจากปุ่มใน topbar, sidebar, guest banner
 */
function openAuth(tab){
  switchTab(tab);
  document.getElementById('authWrap').classList.add('show');
  document.getElementById('authWrap').classList.remove('gone');
  // focus field แรก
  setTimeout(()=>{
    const f = tab==='login'
      ? document.getElementById('lUser')
      : document.getElementById('rUser');
    if(f) f.focus();
  }, 80);
}

/** closeAuth() — ปิด modal (X button หรือ backdrop) */
function closeAuth(){
  document.getElementById('authWrap').classList.remove('show');
}

/** authBackdropClose(e) — ปิดเมื่อคลิกนอก acard */
function authBackdropClose(e){
  if(e.target === document.getElementById('authWrap')) closeAuth();
}

function loginSuccess(u, silent=false){
  CU = u;
  saveSess({username:u.username, displayName:u.displayName});
  closeAuth();            // ปิด modal
  setAuthUI(true, u);     // อัปเดต UI ทั้งหมดเป็นสถานะ logged-in
  initApp();
  if(!silent) showToast(`👋 ยินดีต้อนรับ ${u.displayName||u.username}!`, 'ok');
}

/* ── Custom Confirm Dialog (แทน browser confirm ที่อาจถูก block) ── */
let _logoutPending = false;

function doLogout(){
  // แสดง custom confirm dialog
  const ov = document.getElementById('confirmOverlay');
  ov.style.display = 'flex';
  _logoutPending = true;
  closeSB();
}

function confirmYes(){
  document.getElementById('confirmOverlay').style.display = 'none';

  if(_logoutPending){
    _logoutPending = false;
    clearSess(); CU = null;
    setAuthUI(false);
    document.getElementById('lUser').value = '';
    document.getElementById('lPass').value = '';
    goPage('dash');
    renderCalendarGuest();
    showToast('👋 ออกจากระบบแล้ว', 'ok');
    return;
  }

  if(_deleteAllPending){
    _deleteAllPending = false;
    lsSet(tkKey(), []);
    renderCalendar();
    initManagePage();
    showToast('🗑️ ล้างข้อมูลทั้งหมดแล้ว', 'ok');
    // reset dialog text กลับ
    resetConfirmDialog();
    return;
  }
}

function confirmNo(){
  document.getElementById('confirmOverlay').style.display = 'none';
  _logoutPending    = false;
  _deleteAllPending = false;
  resetConfirmDialog();
}

/** reset text ใน confirm dialog กลับเป็น logout ตั้งต้น */
function resetConfirmDialog(){
  try{
    const ov = document.getElementById('confirmOverlay');
    ov.querySelector('div > div:nth-child(2)').textContent = 'ออกจากระบบ';
    ov.querySelector('div > div:nth-child(3)').textContent = 'ต้องการออกจากระบบใช่หรือไม่?';
  }catch(e){}
}

/**
 * setAuthUI(loggedIn, user)
 * ─────────────────────────────────────────────
 * ควบคุม UI ทั้งหมดที่แตกต่างระหว่าง guest / logged-in
 *
 * Guest state:
 *   - แสดง: guestBtns (topbar), sbGuestZone (sidebar), guestBanner
 *   - ซ่อน : userChip (topbar), sbUserZone (sidebar), sbLogoutBtn
 *   - เมนู add/report/budget: คลิกแล้วขอ login
 *
 * Logged-in state:
 *   - แสดง: userChip, sbUserZone, sbLogoutBtn
 *   - ซ่อน : guestBtns, sbGuestZone, guestBanner
 */
function setAuthUI(loggedIn, u=null){
  const show = (id, v) => document.getElementById(id).style.display = v;

  if(loggedIn && u){
    // ── Logged-in ──
    show('guestBtns',   'none');
    show('guestBanner', 'none');
    show('userChip',    'flex');
    show('sbGuestZone', 'none');
    show('sbUserZone',  'flex');
    show('sbLogoutBtn', 'block');

    // ใส่ชื่อ / อักษรย่อ
    const ini = (u.displayName||u.username).charAt(0).toUpperCase();
    document.getElementById('sbAv').textContent   = ini;
    document.getElementById('sbName').textContent = u.displayName||u.username;
    document.getElementById('tbAv').textContent   = ini;
    document.getElementById('tbName').textContent = u.displayName||u.username;

    // เมนู add/report/budget คลิกได้ตามปกติ
    ['add','report','budget'].forEach(pid=>{
      const el = document.querySelector(`.nitem[data-page="${pid}"]`);
      if(el){ el.onclick = ()=>goPage(pid); el.style.opacity='1'; el.style.pointerEvents=''; }
    });
  } else {
    // ── Guest ──
    show('guestBtns',   'flex');
    show('guestBanner', 'flex');
    show('userChip',    'none');
    show('sbGuestZone', 'block');
    show('sbUserZone',  'none');
    show('sbLogoutBtn', 'none');

    // เมนู add/report/budget → ขอ login ก่อน
    ['add','report','budget'].forEach(pid=>{
      const el = document.querySelector(`.nitem[data-page="${pid}"]`);
      if(el){
        el.onclick = ()=>{ closeSB(); openAuth('login'); showToast('🔑 กรุณาเข้าสู่ระบบก่อน','wrn'); };
        el.style.opacity='.45'; el.style.pointerEvents='auto';
      }
    });
  }
}

function setUserUI(u){/* legacy — ใช้ setAuthUI แทน */}

/* ═══════════════════════════════════════════════════════════
   MODULE 3 — APP STATE
   ═══════════════════════════════════════════════════════════ */
let CY=new Date().getFullYear(), CM=new Date().getMonth();

const TH_MON=['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน',
              'กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
const TH_DAY=['อา','จ','อ','พ','พฤ','ศ','ส'];

/*
  หมวดหมู่ธุรกรรม
  Income categories : รายได้ประเภทต่างๆ
  Expense categories: รายจ่ายประเภทต่างๆ
  ใช้ใน <select> dropdown และ Pie chart
*/
const CATS={
  income:  ['เงินเดือน','โบนัส','เงินออม','รายได้พิเศษ','ค่าจ้างอิสระ','อื่นๆ'],
  expense: ['อาหาร','อินเทอร์เน็ต','ค่าเดินทาง','ช้อปปิ้ง','บันเทิง','สุขภาพ','ค่าเช่า','การศึกษา','อื่นๆ'],
};

/* key แยกตาม username ทำให้ผู้ใช้แต่ละคนมีข้อมูลแยกกัน */
const tkKey = () => `fc_txn_${CU.username}`;
const bgKey = () => `fc_bgt_${CU.username}`;

let barInst=null, pieInst=null;

/* ═══════════════════════════════════════════════════════════
   MODULE 4 — NAVIGATION / SIDEBAR
   ═══════════════════════════════════════════════════════════ */
const toggleSB = ()=>{document.getElementById('sidebar').classList.toggle('open');document.getElementById('sbo').classList.toggle('on')};
const closeSB  = ()=>{document.getElementById('sidebar').classList.remove('open');document.getElementById('sbo').classList.remove('on')};

const PTITLES={dash:'🏠 Dashboard',add:'➕ เพิ่มรายการ',report:'📊 รายงาน',budget:'🎯 งบประมาณ',manage:'🗂️ จัดการข้อมูล'};

function goPage(pid){
  // หน้าที่ต้อง login — ถ้ายัง guest ให้เปิด auth modal
  if(!CU && ['add','report','budget','manage'].includes(pid)){
    openAuth('login');
    showToast('🔑 กรุณาเข้าสู่ระบบก่อน','wrn');
    return;
  }
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('on'));
  document.getElementById('page-'+pid).classList.add('on');
  document.querySelectorAll('.nitem').forEach(n=>n.classList.toggle('active',n.dataset.page===pid));
  document.getElementById('topTitle').textContent=PTITLES[pid];
  if(pid==='report') renderReport();
  if(pid==='budget') renderBudgetPage();
  if(pid==='dash')   renderCalendar();
  if(pid==='add')    resetForm();
  if(pid==='manage') initManagePage();
  closeSB();
}

function shiftMonth(d){
  CM+=d;
  if(CM<0){CM=11;CY--}
  if(CM>11){CM=0;CY++}
  renderCalendar();   // renderCalendar จะเรียก guest mode เองถ้า CU เป็น null
  if(CU && document.getElementById('page-report').classList.contains('on')) renderReport();
}

/* ═══════════════════════════════════════════════════════════
   MODULE 5 — CALENDAR
   ───────────────────────────────────────────────────────────
   วิธีสร้างปฏิทิน:
   1. new Date(CY, CM, 1)  → วันแรกของเดือน
   2. new Date(CY, CM+1,0) → วันสุดท้ายของเดือน
   3. firstDay.getDay()    → วันอาทิตย์=0 … วันเสาร์=6
   4. วนลูปสร้าง cell และเพิ่มข้อมูล income/expense

   ระบบเตือนเกินงบ:
   - รวม expense แต่ละวัน
   - ถ้า expense > daily budget → เพิ่ม class "overbgt"
   - CSS จะเปลี่ยนสีพื้นหลังและแสดง icon ⚠ อัตโนมัติ
   ═══════════════════════════════════════════════════════════ */
/** renderCalendarGuest — แสดงปฏิทินว่างๆ ใน guest mode */
function renderCalendarGuest(){
  CU = null;
  const now = new Date();
  document.getElementById('monLabel').textContent = `${TH_MON[CM]} ${CY+543}`;
  document.getElementById('calTitle').textContent = `ปฏิทิน ${TH_MON[CM]} ${CY+543}`;
  document.getElementById('calHead').innerHTML = TH_DAY.map(d=>`<div class="caldn">${d}</div>`).join('');

  const fd=new Date(CY,CM,1), sdow=fd.getDay(), tot=new Date(CY,CM+1,0).getDate();
  const grid=document.getElementById('calGrid'); grid.innerHTML='';
  const pl=new Date(CY,CM,0).getDate();
  for(let i=0;i<sdow;i++){
    const c=document.createElement('div'); c.className='ccell dim';
    const s=document.createElement('span'); s.className='cdt'; s.textContent=pl-sdow+1+i;
    c.appendChild(s); grid.appendChild(c);
  }
  for(let d=1;d<=tot;d++){
    const isT=d===now.getDate()&&CM===now.getMonth()&&CY===now.getFullYear();
    const cell=document.createElement('div');
    cell.className='ccell'+(isT?' today':'');
    // คลิก cell ขอ login
    cell.onclick=()=>{ openAuth('login'); showToast('🔑 กรุณาเข้าสู่ระบบเพื่อบันทึกรายการ','wrn'); };
    const dt=document.createElement('span'); dt.className='cdt'; dt.textContent=d;
    cell.appendChild(dt); grid.appendChild(cell);
  }
  const used=sdow+tot;
  for(let i=1;i<=(used%7===0?0:7-(used%7));i++){
    const c=document.createElement('div'); c.className='ccell dim';
    const s=document.createElement('span'); s.className='cdt'; s.textContent=i;
    c.appendChild(s); grid.appendChild(c);
  }
  // reset summary cards
  ['dInc','dExp','dBal','dBud'].forEach(id=>document.getElementById(id).textContent='฿0');
  ['lbInc','lbExp','lbBal'].forEach((id,i)=>{
    const labels=['รายรับเดือนนี้','รายจ่ายเดือนนี้','ยอดคงเหลือ'];
    document.getElementById(id).textContent=labels[i];
  });
}

function renderCalendar(){
  // ถ้ายัง guest ให้ render แบบว่าง
  if(!CU){ renderCalendarGuest(); return; }

  const txns = lsGet(tkKey());
  const bgt  = lsGet(bgKey(),{daily:0}).daily||0;
  const now  = new Date();

  document.getElementById('monLabel').textContent = `${TH_MON[CM]} ${CY+543}`;
  document.getElementById('calTitle').textContent = `ปฏิทิน ${TH_MON[CM]} ${CY+543}`;

  // หัวตาราง
  document.getElementById('calHead').innerHTML =
    TH_DAY.map(d=>`<div class="caldn">${d}</div>`).join('');

  const fd   = new Date(CY,CM,1);
  const ld   = new Date(CY,CM+1,0);
  const sdow = fd.getDay();
  const tot  = ld.getDate();

  /* สร้าง dayMap เพื่อ lookup รายได้/รายจ่ายของแต่ละวัน
     key: 'YYYY-MM-DD', value: {income, expense}
  */
  const dm={};
  txns.forEach(t=>{
    if(!dm[t.date]) dm[t.date]={income:0,expense:0};
    dm[t.date][t.type]+=t.amount;
  });

  const grid=document.getElementById('calGrid');
  grid.innerHTML='';

  // cell ว่างก่อนวันที่ 1
  const pl=new Date(CY,CM,0).getDate();
  for(let i=0;i<sdow;i++){
    const c=document.createElement('div');
    c.className='ccell dim';
    const s=document.createElement('span');s.className='cdt';s.textContent=pl-sdow+1+i;
    c.appendChild(s);grid.appendChild(c);
  }

  // cell วันที่ของเดือนนี้
  for(let d=1;d<=tot;d++){
    const mm=String(CM+1).padStart(2,'0');
    const dd=String(d).padStart(2,'0');
    const key=`${CY}-${mm}-${dd}`;
    const data=dm[key]||{income:0,expense:0};
    const isT =d===now.getDate()&&CM===now.getMonth()&&CY===now.getFullYear();
    const overB=bgt>0&&data.expense>bgt;

    const cell=document.createElement('div');
    cell.className='ccell'+(isT?' today':'')+(overB?' overbgt':'');

    const dt=document.createElement('span');dt.className='cdt';dt.textContent=d;
    cell.appendChild(dt);

    if(data.income>0){
      const s=document.createElement('span');s.className='cinc';
      s.textContent=`+${fmt(data.income)}`;cell.appendChild(s);
    }
    if(data.expense>0){
      const s=document.createElement('span');s.className='cexp';
      s.textContent=`-${fmt(data.expense)}`;cell.appendChild(s);
    }
    const w=document.createElement('span');w.className='cwarn';w.textContent='⚠';cell.appendChild(w);

    // คลิก cell → ไปหน้า Add พร้อม pre-fill วันที่นั้น
    cell.onclick=()=>{goPage('add');document.getElementById('fDate').value=key};
    grid.appendChild(cell);
  }

  // cell หลังสิ้นเดือน
  const used=sdow+tot;
  for(let i=1;i<=(used%7===0?0:7-(used%7));i++){
    const c=document.createElement('div');c.className='ccell dim';
    const s=document.createElement('span');s.className='cdt';s.textContent=i;
    c.appendChild(s);grid.appendChild(c);
  }

  updateDashCards(txns);
}

function updateDashCards(txns){
  const tk=getToday();
  const mm=String(CM+1).padStart(2,'0');
  const pre=`${CY}-${mm}`;

  // กรองรายการของเดือนที่กำลังแสดงอยู่
  const mo=txns.filter(t=>t.date.startsWith(pre));
  const mI=mo.filter(t=>t.type==='income') .reduce((s,t)=>s+t.amount,0);
  const mE=mo.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);

  // งบประมาณ: ยังคงแสดง "งบเหลือวันนี้" เป็นรายวัน
  const tdE=txns.filter(t=>t.date===tk&&t.type==='expense').reduce((s,t)=>s+t.amount,0);
  const bgt=lsGet(bgKey(),{daily:0}).daily||0;

  // อัปเดต label ให้ตรงกับเดือนที่กำลังดู
  const monName=TH_MON[CM];
  document.getElementById('lbInc').textContent=`รายรับ ${monName}`;
  document.getElementById('lbExp').textContent=`รายจ่าย ${monName}`;
  document.getElementById('lbBal').textContent=`ยอดคงเหลือ ${monName}`;

  // แสดงยอดรวมทั้งเดือน
  document.getElementById('dInc').textContent=`฿${fmt(mI)}`;
  document.getElementById('dExp').textContent=`฿${fmt(mE)}`;
  document.getElementById('dBal').textContent=`฿${fmt(mI-mE)}`;
  document.getElementById('dBud').textContent=bgt>0?`฿${fmt(bgt-tdE)}`:'ยังไม่ตั้ง';

  // แจ้งเตือนถ้าเกินงบวันนี้
  if(bgt>0&&tdE>bgt) showToast(`⚠️ รายจ่ายวันนี้เกินงบ ฿${fmt(tdE-bgt)}!`,'wrn');
}

/* ═══════════════════════════════════════════════════════════
   MODULE 6 — TRANSACTIONS CRUD
   ───────────────────────────────────────────────────────────
   Transaction object:
   {
     id:       1700000000000,    -- Date.now() เป็น unique ID
     date:     "2024-11-15",    -- YYYY-MM-DD
     type:     "income"|"expense",
     amount:   500,
     category: "เงินเดือน",      -- จาก CATS
     note:     "..."
   }
   เก็บเป็น Array ใน localStorage key: fc_txn_<username>
   ═══════════════════════════════════════════════════════════ */

function resetForm(){
  document.getElementById('fDate').value=getToday();
  document.getElementById('fAmt').value='';
  document.getElementById('fNote').value='';
  setType('income');
}

/** เลือก type → เปลี่ยน style ปุ่มและสร้าง dropdown ใหม่ */
function setType(t){
  document.getElementById('fType').value=t;
  document.getElementById('btnI').className='tbtn'+(t==='income'?' ion':'');
  document.getElementById('btnE').className='tbtn'+(t==='expense'?' eon':'');
  // สร้าง option ตาม type
  document.getElementById('fCat').innerHTML=
    CATS[t].map(c=>`<option value="${c}">${c}</option>`).join('');
}

function addTxn(){
  const date=document.getElementById('fDate').value;
  const type=document.getElementById('fType').value;
  const amt =parseFloat(document.getElementById('fAmt').value);
  const cat =document.getElementById('fCat').value;
  const note=document.getElementById('fNote').value.trim();
  if(!date)         return showToast('กรุณาเลือกวันที่','err');
  if(!amt||amt<=0)  return showToast('กรุณากรอกจำนวนเงินที่ถูกต้อง','err');

  const txn={id:Date.now(),date,type,amount:amt,category:cat,note:note||(type==='income'?'รายรับ':'รายจ่าย')};
  const all=lsGet(tkKey()); all.push(txn); lsSet(tkKey(),all);
  showToast('✅ บันทึกรายการสำเร็จ!','ok');
  document.getElementById('fAmt').value='';
  document.getElementById('fNote').value='';
  renderCalendar();
}

function delTxn(id){
  if(!confirm('ต้องการลบรายการนี้?'))return;
  lsSet(tkKey(),lsGet(tkKey()).filter(t=>t.id!==id));
  renderCalendar(); renderReport();
  showToast('🗑️ ลบรายการแล้ว','ok');
}

/* ═══════════════════════════════════════════════════════════
   MODULE 7 — REPORT & CHARTS
   ───────────────────────────────────────────────────────────
   Chart.js ทำงานอย่างไร:
   1. ระบุ <canvas> element
   2. new Chart(canvas.getContext('2d'), config)
   3. config: { type, data:{ labels, datasets:[] }, options }
   4. Bar chart: type = 'bar'
   5. Pie/Doughnut chart: type = 'doughnut'
   6. ก่อน render ใหม่ต้อง instance.destroy() ก่อน
      เพราะ Chart.js ไม่ล้างข้อมูลเองเมื่อสร้างใหม่บน canvas เดิม
   ═══════════════════════════════════════════════════════════ */
function renderReport(){
  const txns=lsGet(tkKey());
  const mm=String(CM+1).padStart(2,'0');
  const mo=txns.filter(t=>t.date.startsWith(`${CY}-${mm}`));
  const mI=mo.filter(t=>t.type==='income') .reduce((s,t)=>s+t.amount,0);
  const mE=mo.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);

  document.getElementById('rInc').textContent=`฿${fmt(mI)}`;
  document.getElementById('rExp').textContent=`฿${fmt(mE)}`;
  document.getElementById('rNet').textContent=`฿${fmt(mI-mE)}`;
  document.getElementById('rCnt').textContent=mo.length;

  buildBarChart(mo);
  buildPieChart(mo);
  buildTxnTable(mo);
}

/** Bar Chart: รายรับ vs รายจ่าย แต่ละวันของเดือน */
function buildBarChart(txns){
  const days=new Date(CY,CM+1,0).getDate();
  const iA=Array(days).fill(0), eA=Array(days).fill(0);

  // จัดกลุ่มข้อมูลตามวัน (index 0 = วันที่ 1)
  txns.forEach(t=>{
    const d=parseInt(t.date.split('-')[2])-1;
    if(t.type==='income') iA[d]+=t.amount; else eA[d]+=t.amount;
  });

  if(barInst) barInst.destroy();  // ทำลาย instance เก่าก่อน
  barInst=new Chart(document.getElementById('barChart').getContext('2d'),{
    type:'bar',
    data:{
      labels:Array.from({length:days},(_,i)=>i+1),
      datasets:[
        {label:'รายรับ', data:iA,backgroundColor:'rgba(26,127,90,.72)',borderColor:'#1a7f5a',borderWidth:1,borderRadius:4},
        {label:'รายจ่าย',data:eA,backgroundColor:'rgba(192,57,43,.72)',borderColor:'#c0392b',borderWidth:1,borderRadius:4},
      ]
    },
    options:{
      responsive:true,
      plugins:{legend:{labels:{font:{family:'Sarabun'},color:'#2c1810'}}},
      scales:{
        x:{ticks:{color:'#9b8070',font:{family:'Sarabun',size:10}},grid:{color:'rgba(0,0,0,.05)'}},
        y:{ticks:{color:'#9b8070',font:{family:'Sarabun',size:10},callback:v=>'฿'+fmt(v)},grid:{color:'rgba(0,0,0,.05)'}},
      }
    }
  });
}

/** Doughnut Chart: สัดส่วนรายจ่ายตามหมวดหมู่ */
function buildPieChart(txns){
  // รวมยอดรายจ่ายตาม category
  const cm={};
  txns.filter(t=>t.type==='expense').forEach(t=>{cm[t.category]=(cm[t.category]||0)+t.amount});

  const labels=Object.keys(cm);
  const data  =Object.values(cm);
  const COLS  =['#e67e22','#c0392b','#8e44ad','#2980b9','#27ae60','#f39c12','#16a085','#d35400','#7f8c8d'];

  if(pieInst) pieInst.destroy();
  pieInst=new Chart(document.getElementById('pieChart').getContext('2d'),{
    type:'doughnut',
    data:{
      labels,
      datasets:[{data,backgroundColor:labels.map((_,i)=>COLS[i%COLS.length]),borderWidth:2,borderColor:'#fff',hoverOffset:8}]
    },
    options:{
      responsive:true,cutout:'55%',
      plugins:{legend:{position:'bottom',labels:{font:{family:'Sarabun'},color:'#2c1810',padding:11}}}
    }
  });
}

/** ตารางรายการ */
function buildTxnTable(txns){
  const c=document.getElementById('txTable');
  document.getElementById('txCnt').textContent=txns.length+' รายการ';
  if(!txns.length){
    c.innerHTML='<div class="empty"><div class="ei">📭</div><p>ยังไม่มีรายการในเดือนนี้</p></div>';
    return;
  }
  const sorted=[...txns].sort((a,b)=>b.date.localeCompare(a.date));
  c.innerHTML=`<table>
    <thead><tr><th>วันที่</th><th>ประเภท</th><th>หมวดหมู่</th><th>หมายเหตุ</th><th style="text-align:right">จำนวน</th><th></th></tr></thead>
    <tbody>${sorted.map(t=>`<tr>
      <td>${fmtDate(t.date)}</td>
      <td><span class="bdg ${t.type==='income'?'bi':'be'}">${t.type==='income'?'💚 รายรับ':'❤️ รายจ่าย'}</span></td>
      <td><span class="bdg bc">🏷 ${esc(t.category)}</span></td>
      <td style="color:var(--mut)">${esc(t.note)}</td>
      <td style="text-align:right;font-weight:700;color:${t.type==='income'?'var(--inc)':'var(--exp)'}">
        ${t.type==='income'?'+':'-'}฿${fmt(t.amount)}</td>
      <td><button class="delbtn" onclick="delTxn(${t.id})">🗑️</button></td>
    </tr>`).join('')}</tbody></table>`;
}

/* ═══════════════════════════════════════════════════════════
   MODULE 8 — BUDGET SYSTEM
   ───────────────────────────────────────────────────────────
   การทำงาน:
   1. ผู้ใช้ตั้ง daily budget (บาท/วัน)
   2. บันทึกใน localStorage key: fc_bgt_<username>
   3. Calendar render → ตรวจทุกวัน: expense > budget?
      ถ้าใช่ → class "overbgt" → CSS เปลี่ยนสีพื้นหลัง
   4. Dashboard แสดง "งบเหลือวันนี้" = budget - todayExpense
   5. ถ้าเกิน → Toast warning สีส้ม
   ═══════════════════════════════════════════════════════════ */
function saveBudget(){
  const v=parseFloat(document.getElementById('bgtIn').value);
  if(!v||v<=0) return showToast('กรุณากรอกงบประมาณที่ถูกต้อง','err');
  lsSet(bgKey(),{daily:v});
  document.getElementById('curBgt').textContent=`฿${fmt(v)}`;
  showToast('✅ บันทึกงบประมาณสำเร็จ!','ok');
  renderBudgetPage(); renderCalendar();
}

function renderBudgetPage(){
  const b=lsGet(bgKey(),{daily:0}).daily||0;
  document.getElementById('curBgt').textContent=`฿${fmt(b)}`;
  document.getElementById('bgtIn').value=b||'';
  const tk=getToday();
  const tE=lsGet(tkKey()).filter(t=>t.date===tk&&t.type==='expense').reduce((s,t)=>s+t.amount,0);
  const el=document.getElementById('bgtStatus');
  if(!b){el.innerHTML='';return}
  const pct=Math.min(tE/b*100,100);
  const over=tE>b;
  const col=over?'var(--exp)':pct>75?'var(--wrn)':'var(--inc)';
  el.innerHTML=`<div style="background:var(--surf2);border:1px solid var(--bdr);border-radius:9px;padding:14px">
    <div style="font-size:.77rem;color:var(--mut);margin-bottom:7px">สถานะงบวันนี้ (${fmtDate(tk)})</div>
    <div style="display:flex;justify-content:space-between;margin-bottom:5px">
      <span style="font-size:.83rem">ใช้ไป: <strong style="color:${col}">฿${fmt(tE)}</strong></span>
      <span style="font-size:.83rem;color:var(--mut)">งบ: ฿${fmt(b)}</span>
    </div>
    <div class="pbarw"><div class="pbarf" style="width:${pct}%;background:${col}"></div></div>
    <div style="margin-top:7px;font-size:.76rem;color:${col}">
      ${over?`⚠️ เกินงบ ฿${fmt(tE-b)}!`:`✅ เหลืองบ ฿${fmt(b-tE)}`}
    </div>
  </div>`;
}

/* ═══════════════════════════════════════════════════════════
   MODULE 9 — UI UTILITIES
   ═══════════════════════════════════════════════════════════ */

let toastTmr;
/** Toast notification
 *  type: 'ok' = เขียว | 'err' = แดง | 'wrn' = ส้ม
 */
function showToast(msg,type='ok'){
  const el=document.getElementById('toast');
  document.getElementById('toastIco').textContent={ok:'✅',err:'❌',wrn:'⚠️'}[type]||'ℹ️';
  document.getElementById('toastMsg').textContent=msg;
  el.className=`toast show ${type}`;
  clearTimeout(toastTmr);
  toastTmr=setTimeout(()=>el.classList.remove('show'),3500);
}

const fmt     = n  => n.toLocaleString('th-TH',{minimumFractionDigits:0,maximumFractionDigits:2});
const fmtDate = s  => { if(!s)return''; const[y,m,d]=s.split('-'); return `${d}/${m}/${y}` };
const esc     = s  => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
function getToday(){
  const d=new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

/* ═══════════════════════════════════════════════════════════
   MODULE 9B — MANAGE DATA
   ─────────────────────────────────────────────────────────
   ฟีเจอร์ลบข้อมูลการเงิน 3 แบบ:
   1. ลบตามเดือน/ปี  — เลือกเดือนและปีที่ต้องการลบ
   2. ลบตามประเภท   — ลบรายรับ หรือ รายจ่ายทั้งหมด
   3. ล้างทั้งหมด    — ลบทุกรายการของบัญชีนี้
   ═══════════════════════════════════════════════════════════ */

/** เริ่มต้นหน้า Manage — populate dropdowns และ preview */
function initManagePage(){
  const txns = lsGet(tkKey());

  // ── สร้าง dropdown เดือน ──
  const mSel = document.getElementById('delMonth');
  mSel.innerHTML = '<option value="">— เลือกเดือน —</option>';
  TH_MON.forEach((m,i)=>{
    const v = String(i+1).padStart(2,'0');
    mSel.innerHTML += `<option value="${v}">${m}</option>`;
  });

  // ── สร้าง dropdown ปี จากข้อมูลจริง + ปีปัจจุบัน ──
  const years = [...new Set(txns.map(t=>t.date.split('-')[0]))]
    .map(Number).sort((a,b)=>b-a);
  const curY = new Date().getFullYear();
  if(!years.includes(curY)) years.unshift(curY);
  const ySel = document.getElementById('delYear');
  ySel.innerHTML = years.map(y=>`<option value="${y}">${y+543} (${y})</option>`).join('');

  // reset type selector
  document.getElementById('delType').value = '';
  document.getElementById('dtInc').className = 'tbtn';
  document.getElementById('dtExp').className = 'tbtn';

  // reset preview areas
  updateDelMonthPreview();
  document.getElementById('delTypePreview').innerHTML = '';
}

/** อัปเดต preview จำนวนรายการที่จะถูกลบ (ตามเดือน) */
function updateDelMonthPreview(){
  const mm  = document.getElementById('delMonth').value;
  const yy  = document.getElementById('delYear').value;
  const el  = document.getElementById('delPreview');
  if(!mm || !yy){ el.innerHTML=''; return; }

  const txns   = lsGet(tkKey());
  const prefix = `${yy}-${mm}`;
  const target = txns.filter(t=>t.date.startsWith(prefix));
  const inc    = target.filter(t=>t.type==='income') .reduce((s,t)=>s+t.amount,0);
  const exp    = target.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);

  if(!target.length){
    el.innerHTML=`<div style="font-size:.8rem;color:var(--mut);padding:10px 0">ไม่มีรายการในเดือนนี้</div>`;
    return;
  }
  el.innerHTML=`
    <div style="background:rgba(192,57,43,.06);border:1px solid rgba(192,57,43,.18);
      border-radius:9px;padding:12px 14px;font-size:.82rem;">
      <div style="font-weight:700;color:var(--exp);margin-bottom:6px">
        พบ ${target.length} รายการใน ${TH_MON[parseInt(mm)-1]} ${parseInt(yy)+543}
      </div>
      <div style="color:var(--mut);line-height:1.8">
        💚 รายรับ: <strong style="color:var(--inc)">฿${fmt(inc)}</strong>
        &nbsp;|&nbsp;
        ❤️ รายจ่าย: <strong style="color:var(--exp)">฿${fmt(exp)}</strong>
      </div>
    </div>`;
}

/** เลือกประเภทที่จะลบ + แสดง preview */
function setDelType(type){
  document.getElementById('delType').value = type;
  document.getElementById('dtInc').className = 'tbtn' + (type==='income'  ? ' ion' : '');
  document.getElementById('dtExp').className = 'tbtn' + (type==='expense' ? ' eon' : '');

  const txns  = lsGet(tkKey());
  const found = txns.filter(t=>t.type===type);
  const total = found.reduce((s,t)=>s+t.amount,0);
  const label = type==='income' ? '💚 รายรับ' : '❤️ รายจ่าย';
  const col   = type==='income' ? 'var(--inc)' : 'var(--exp)';
  const el    = document.getElementById('delTypePreview');

  if(!found.length){
    el.innerHTML=`<div style="font-size:.8rem;color:var(--mut);padding:10px 0">ไม่มีรายการประเภทนี้</div>`;
    return;
  }
  el.innerHTML=`
    <div style="background:rgba(192,57,43,.06);border:1px solid rgba(192,57,43,.18);
      border-radius:9px;padding:12px 14px;font-size:.82rem;">
      <div style="font-weight:700;color:${col};margin-bottom:4px">
        พบ ${label} ทั้งหมด ${found.length} รายการ
      </div>
      <div style="color:var(--mut)">ยอดรวม: <strong style="color:${col}">฿${fmt(total)}</strong></div>
    </div>`;
}

/** ลบรายการตามเดือน/ปีที่เลือก */
function deleteByMonth(){
  const mm = document.getElementById('delMonth').value;
  const yy = document.getElementById('delYear').value;
  if(!mm || !yy) return showToast('กรุณาเลือกเดือนและปีก่อน','wrn');

  const txns   = lsGet(tkKey());
  const prefix = `${yy}-${mm}`;
  const remain = txns.filter(t=>!t.date.startsWith(prefix));
  const count  = txns.length - remain.length;
  if(!count) return showToast('ไม่มีรายการในเดือนที่เลือก','wrn');

  lsSet(tkKey(), remain);
  showToast(`🗑️ ลบ ${count} รายการใน ${TH_MON[parseInt(mm)-1]} ${parseInt(yy)+543} แล้ว`, 'ok');
  updateDelMonthPreview();
  renderCalendar();
}

/** ลบรายการตามประเภท */
function deleteByType(){
  const type = document.getElementById('delType').value;
  if(!type) return showToast('กรุณาเลือกประเภทก่อน','wrn');

  const txns   = lsGet(tkKey());
  const remain = txns.filter(t=>t.type!==type);
  const count  = txns.length - remain.length;
  if(!count) return showToast('ไม่มีรายการประเภทนี้','wrn');

  lsSet(tkKey(), remain);
  const label = type==='income' ? 'รายรับ' : 'รายจ่าย';
  showToast(`🗑️ ลบ${label}ทั้งหมด ${count} รายการแล้ว`, 'ok');
  setDelType(type);   // refresh preview
  renderCalendar();
}

/** ล้างข้อมูลทั้งหมดของ user นี้ */
function deleteAllData(){
  const count = lsGet(tkKey()).length;
  if(!count) return showToast('ไม่มีข้อมูลที่จะลบ','wrn');

  // ใช้ custom confirm
  _deleteAllPending = true;
  const ov = document.getElementById('confirmOverlay');
  // เปลี่ยน text ใน dialog ชั่วคราว
  ov.querySelector('div > div:nth-child(2)').textContent = 'ล้างข้อมูลการเงิน';
  ov.querySelector('div > div:nth-child(3)').textContent =
    `ต้องการลบรายการทั้งหมด ${count} รายการ? ไม่สามารถกู้คืนได้`;
  ov.style.display = 'flex';
}
let _deleteAllPending = false;

/* ═══════════════════════════════════════════════════════════
   MODULE 10 — BOOT
   เริ่มต้นแอปเมื่อ DOM โหลดเสร็จ
   ═══════════════════════════════════════════════════════════ */

/** สร้าง demo account + ข้อมูลตัวอย่าง */
async function createDemo(){
  const users=getUsers();
  if(users.some(u=>u.username==='demo'))return;
  const pw=await sha256('demo:demo1234');
  users.push({username:'demo',displayName:'Demo User',password:pw,createdAt:new Date().toISOString()});
  saveUsers(users);
  // ไม่ใส่ข้อมูลตัวอย่าง — เริ่มต้นด้วยข้อมูลว่างเปล่า
}

/* seedDemo ถูกลบออกแล้ว — ผู้ใช้ทุกคนเริ่มต้นด้วยข้อมูลว่าง */

function initApp(){
  // แสดงวันที่วันนี้ใน topbar
  const n=new Date();
  document.getElementById('tbDate').textContent=
    `${n.getDate()} ${TH_MON[n.getMonth()]} ${n.getFullYear()+543}`;
  // ค่า default ในฟอร์ม
  document.getElementById('fDate').value=getToday();
  setType('income');
  // แสดงงบประมาณปัจจุบัน
  const b=lsGet(bgKey(),{daily:0}).daily||0;
  document.getElementById('curBgt').textContent=`฿${fmt(b)}`;
  // render ปฏิทิน (มีข้อมูลของ user)
  renderCalendar();
}

/* ─────────────────────────────────────────────────────
   Entry point — รันเมื่อ DOM พร้อม

   Flow ใหม่:
   1. แสดง Dashboard ทันที (guest mode)
   2. อัปเดต topbar / sidebar เป็น guest state
   3. ตรวจ session ที่ยังค้างอยู่
      - ถ้ามี → loginSuccess โดยไม่ต้องกรอกอีก
   ───────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async ()=>{
  await createDemo();   // สร้าง demo account ถ้ายังไม่มี

  // แสดงวันที่วันนี้
  const n=new Date();
  document.getElementById('tbDate').textContent=
    `${n.getDate()} ${TH_MON[n.getMonth()]} ${n.getFullYear()+543}`;

  // เริ่มต้นเป็น guest — render ปฏิทินว่าง + UI guest
  setAuthUI(false);
  renderCalendarGuest();

  // ตรวจ session ค้าง — ถ้ามีให้ login อัตโนมัติ (ไม่ต้องกรอก)
  const sess = getSess();
  if(sess){
    const u = getUsers().find(u=>u.username===sess.username);
    if(u){
      CU = u;
      setAuthUI(true, u);
      initApp();
    }
  }
});
