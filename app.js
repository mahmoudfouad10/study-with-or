const CLIPS = {
  wave:  {src:'assets/or-wave.webm',  poster:'assets/or-wave.png',  ar:520/616},
  read:  {src:'assets/or-read.webm',  poster:'assets/or-read.png',  ar:400/709},
  tea:   {src:'assets/or-tea.webm',   poster:'assets/or-tea.png',   ar:377/668},
  cheer: {src:'assets/or-cheer.webm', poster:'assets/or-cheer.png', ar:490/696},
  push:  {src:'assets/or-push.webm',  poster:'assets/or-push.png',  ar:738/686}
};
const FRAMES = {
  study: {a:'assets/frame-study-a.webp', b:'assets/frame-study-b.webp', c:'assets/frame-study-c.webp', d:'assets/frame-study-d.webp', e:'assets/frame-study-e.webp'},
  rest:  {a:'assets/frame-rest-a.webp',  b:'assets/frame-rest-b.webp',  c:'assets/frame-rest-c.webp',  d:'assets/frame-rest-d.webp',  e:'assets/frame-rest-e.webp'}
};

/* ---------- الحالة ---------- */
const S = {
  mode:'study',           // study | rest
  page:'wheel',           // wheel | timer
  studyVals:[25,30,45,50,60,90],
  restVals:[5,10,15,20],
  picked:45,
  total:45*60, left:45*60, running:false, tick:null, endAt:0
};
const $ = id => document.getElementById(id);
let transitionTimer = null, fadeT = null, rz = null, wl = null;
function clearTransition(){ if(transitionTimer){ clearTimeout(transitionTimer); transitionTimer=null; } }
async function lockScreen(){ try{ if (navigator.wakeLock) wl = await navigator.wakeLock.request('screen'); }catch(e){} }
function unlockScreen(){ if (wl){ wl.release().catch(()=>{}); wl=null; } }

/* ---------- الصوت ---------- */
let AC=null, rainGain=null, chimeVol=.7, rainVol=.3;
function audioInit(){
  if (AC) { if (AC.state==='suspended') AC.resume().catch(()=>{}); return; }
  if (document.getElementById('intro')) return; // المطر يبدأ بعد انتهاء المقدمة فقط
  AC = new (window.AudioContext||window.webkitAudioContext)();
  // مطر: ضوضاء بنية + فلتر
  const len = 3*AC.sampleRate, buf = AC.createBuffer(1,len,AC.sampleRate), d = buf.getChannelData(0);
  let last=0;
  for (let i=0;i<len;i++){ const w=Math.random()*2-1; last=(last+.02*w)/1.02; d[i]=last*3.2; }
  const src = AC.createBufferSource(); src.buffer=buf; src.loop=true;
  const lp = AC.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=480;
  const hp = AC.createBiquadFilter(); hp.type='highpass'; hp.frequency.value=180;
  rainGain = AC.createGain(); rainGain.gain.value=rainVol*.9;
  src.connect(lp); lp.connect(hp); hp.connect(rainGain); rainGain.connect(AC.destination);
  src.start();
}
function chime(){
  if (!AC) return;
  const notes=[1318.5,1046.5,1318.5,1568];
  notes.forEach((f,i)=>{
    const t = AC.currentTime + i*.45;
    [1,.5].forEach((mult,h)=>{
      const o=AC.createOscillator(), g=AC.createGain();
      o.type='sine'; o.frequency.value=f*(h+1);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(chimeVol*.5*mult, t+.02);
      g.gain.exponentialRampToValueAtTime(.0001, t+1.6);
      o.connect(g); g.connect(AC.destination);
      o.start(t); o.stop(t+1.7);
    });
  });
}
$('rainVol').addEventListener('input', e=>{ rainVol=e.target.value/100; if(rainGain) rainGain.gain.value=rainVol*.9; savePrefs(); });
$('chimeVol').addEventListener('input', e=>{ chimeVol=e.target.value/100; savePrefs(); });
function armAudio(){
  audioInit();
  if (!AC) return;
  AC.resume().then(()=>{
    if (AC.state==='running') document.removeEventListener('pointerdown', armAudio);
  }).catch(()=>{});
}
document.addEventListener('pointerdown', armAudio);

/* ---------- العجلة ---------- */
const cv = $('wheel'), ctx2d = cv.getContext('2d');
let angle = 0, spinning=false;
function sizeWheelCanvas(){ // وضوح العجلة على شاشات HiDPI
  const dpr = Math.min(window.devicePixelRatio||1, 2.5);
  cv.width = Math.round(460*dpr); cv.height = Math.round(460*dpr);
  ctx2d.setTransform(dpr,0,0,dpr,0,0);
  drawWheel();
}
window.addEventListener('resize', sizeWheelCanvas);
// لو الـ devicePixelRatio اتغير بعد التحميل (نقل النافذة لشاشة تانية مثلاً)
let _dprMql = null;
function watchDpr(){
  if (_dprMql) _dprMql.removeEventListener('change', _dprChanged);
  _dprMql = matchMedia('(resolution:' + window.devicePixelRatio + 'dppx)');
  _dprMql.addEventListener('change', _dprChanged);
}
function _dprChanged(){ sizeWheelCanvas(); watchDpr(); }
watchDpr();
function wheelColors(){
  return S.mode==='study'
    ? ['#2e6b57','#17352b','#7fc8bc','#2e6b57','#17352b','#7fc8bc']
    : ['#6f5fa3','#4a3f73','#b8a9e0','#8d7bb8'];
}
function drawWheel(){
  const vals = S.mode==='study'? S.studyVals : S.restVals;
  const cols = wheelColors(), n = vals.length, arc = 2*Math.PI/n;
  const cx=230, cy=230, r=215;
  ctx2d.clearRect(0,0,460,460);
  ctx2d.save(); ctx2d.translate(cx,cy); ctx2d.rotate(angle);
  for (let i=0;i<n;i++){
    ctx2d.beginPath(); ctx2d.moveTo(0,0);
    ctx2d.arc(0,0,r, i*arc - Math.PI/2, (i+1)*arc - Math.PI/2);
    ctx2d.closePath(); ctx2d.fillStyle=cols[i%cols.length]; ctx2d.fill();
    ctx2d.strokeStyle='rgba(0,0,0,.25)'; ctx2d.lineWidth=2; ctx2d.stroke();
    // الرقم
    ctx2d.save();
    ctx2d.rotate(i*arc + arc/2 - Math.PI/2);
    ctx2d.translate(r*.62, 0);
    ctx2d.rotate(-(angle + i*arc + arc/2 - Math.PI/2));
    const light = cols[i%cols.length]==='#7fc8bc' || cols[i%cols.length]==='#b8a9e0';
    ctx2d.fillStyle = light? '#12342b' : '#f2fbf7';
    ctx2d.font = '800 40px "Segoe UI", Tahoma, sans-serif';
    ctx2d.textAlign='center'; ctx2d.textBaseline='middle';
    ctx2d.shadowColor='rgba(0,0,0,.3)'; ctx2d.shadowBlur=4;
    ctx2d.fillText(String(vals[i]), 0, 0);
    ctx2d.restore();
  }
  // إطار العجلة
  ctx2d.beginPath(); ctx2d.arc(0,0,r+7,0,2*Math.PI);
  ctx2d.strokeStyle='#3d5d4e'; ctx2d.lineWidth=15; ctx2d.stroke();
  ctx2d.beginPath(); ctx2d.arc(0,0,r-1,0,2*Math.PI);
  ctx2d.strokeStyle='#668477'; ctx2d.lineWidth=3; ctx2d.stroke();
  ctx2d.restore();
}
function spin(){
  if (spinning) return;
  spinning = true; $('spinBtn').disabled = true;
  $('editPanel').classList.remove('open');
  // المساعد بيدفع العجلة الحقيقية: مقطع الدفع تحت العجلة والعجلة بتلف لوحدها وتقف على النتيجة
  const mobileSpin = (window.innerWidth < 760 || window.innerHeight > window.innerWidth * 1.15);
  if (mobileSpin) charPlace(72, 2, 15, 'push');
  else charPlace(32, 19, 41, 'push');
  charPlay('push', false);
  const vals = S.mode==='study'? S.studyVals : S.restVals;
  const n = vals.length, arc = 2*Math.PI/n;
  const targetIdx = Math.floor(Math.random()*n);
  // العايز المؤشر (فوق، -90deg) يقف في نص القطاع targetIdx
  const TAU = 2*Math.PI;
  const start = ((angle % TAU)+TAU)%TAU;
  const finalA = (TAU - (targetIdx*arc + arc/2)) % TAU;
  const delta = ((finalA - start) % TAU + TAU) % TAU;
  const target = 5*TAU + delta;
  const dur = 4300, t0 = performance.now();
  function ease(p){ // خروج ناعم مع ارتداد صغير في الآخر
    const c=.55;
    return 1 + (c+1)*Math.pow(p-1,3) + c*Math.pow(p-1,2);
  }
  function frame(t){
    const p = Math.min(1,(t-t0)/dur);
    angle = start + target*ease(p);
    drawWheel();
    if (p<1) requestAnimationFrame(frame);
    else {
      angle = (start+target)%(2*Math.PI); drawWheel();
      spinning=false; $('spinBtn').disabled=false;
      setChars();
      S.picked = vals[targetIdx];
      toast(S.mode==='study' ? `مذاكرة ${S.picked} ${arMin(S.picked)}` : `راحة ${S.picked} ${arMin(S.picked)}`);
      if (S.mode==='study') setTodo(1, true); // حدد الوقت
      transitionTimer = setTimeout(()=>{ transitionTimer=null; gotoTimer(); }, 1100);
    }
  }
  setTimeout(()=>requestAnimationFrame(frame), 800); // العجلة تبدأ مع وصول إيد المساعد ليها
}
$('spinBtn').addEventListener('click', spin);
cv.addEventListener('click', spin);

/* ---------- تعديل الأوقات ---------- */
$('editToggle').addEventListener('click', ()=>{
  const p = $('editPanel'); p.classList.toggle('open');
  const vals = S.mode==='study'? S.studyVals : S.restVals;
  $('editInputs').innerHTML = vals.map((v,i)=>`<input type="number" min="1" max="180" value="${v}" data-i="${i}">`).join('');
  // لو اللوحة هتتقصّ من تحت، افتحها لفوق
  p.classList.remove('up');
  if (p.classList.contains('open') && p.getBoundingClientRect().bottom > window.innerHeight - 8)
    p.classList.add('up');
});
$('editApply').addEventListener('click', ()=>{
  const fields = [...$('editInputs').querySelectorAll('input')];
  if (!fields.length){ toast('لازم تضيف وقت واحد على الأقل'); return; }
  const raw = fields.map(el=>el.value.trim());
  if (raw.some(v=>v==='' || !Number.isInteger(Number(v)) || Number(v)<1 || Number(v)>180)){
    toast('اختار أوقات صحيحة من دقيقة لـ 180 دقيقة');
    return;
  }
  const vals = raw.map(Number);
  if (S.mode==='study') S.studyVals = vals; else S.restVals = vals;
  savePrefs();
  angle=0; drawWheel(); $('editPanel').classList.remove('open');
});

/* ---------- التنقل ---------- */
function charEl(){ return $('charOr'); }
function charPlay(name, loop){
  const C = charEl(), v = C.querySelector('video'), c = CLIPS[name];
  if (!v){ // متصفح مش بيدعم الفيديو الشفاف: صورة ثابتة لكل حالة
    const img = C.querySelector('img');
    if (img) img.src = c.poster;
    return;
  }
  if (v.dataset.clip !== name){
    v.dataset.clip = name;
    v.poster = c.poster;
    v.src = c.src;
    v.load();
  }
  v.loop = !!loop;
  if (C.classList.contains('frozen')) return;
  v.play().catch(()=>{});
}
function freezeChar(f){
  const C = charEl(), v = C.querySelector('video');
  C.classList.toggle('frozen', f);
  if (v){ if (f) v.pause(); else v.play().catch(()=>{}); }
}
function charPlace(top, left, h, name){
  const C = charEl();
  C.style.top=top+'%'; C.style.left=left+'%'; C.style.height=h+'%';
  C.style.aspectRatio = String(CLIPS[name].ar);
}
const charVideo = charEl().querySelector('video');
charVideo.addEventListener('error', ()=>{
  const C = charEl();
  if (C.querySelector('img')) return;
  const img = document.createElement('img');
  img.src = CLIPS[charVideo.dataset.clip||'wave'].poster;
  img.alt = '';
  charVideo.replaceWith(img);
});

function setChars(){
  const mobile = (window.innerWidth < 760 || window.innerHeight > window.innerWidth * 1.15);
  let clip, top, left, h;
  if (mobile){
    clip = (S.page==='timer') ? (S.mode==='study' ? 'read' : 'tea') : 'wave';
    top=72; left=6; h=15;
  } else if (S.page==='wheel'){
    clip='wave'; top=33; left=10; h=39;
  } else {
    clip = S.mode==='study' ? 'read' : 'tea';
    top=40; left=8; h=32;
  }
  charPlace(top, left, h, clip);
  charPlay(clip, true);
  charEl().classList.remove('frozen');
}
function setFrames(){
  const set = FRAMES[S.mode];
  document.querySelectorAll('.frame').forEach(f=>{
    f.querySelector('img').src = set[f.dataset.slot];
  });
}
function show(p, noPush){
  $('pageWheel').classList.toggle('on', p==='wheel');
  $('pageTimer').classList.toggle('on', p==='timer');
  const fe=document.querySelector('.frame[data-slot="e"]'); if(fe) fe.style.display=(p==='timer')?'none':'';
  $('backBtn').style.display = (p==='wheel' && S.mode==='study') ? 'none' : 'inline-block';
  S.page = p;
  document.body.classList.toggle('rest', S.mode==='rest');
  const step = (S.mode==='study' ? (p==='wheel' ? 1 : 2) : (p==='wheel' ? 3 : 4));
  document.querySelectorAll('#journey [data-step]').forEach(el=>{
    const n = Number(el.dataset.step);
    el.classList.toggle('active', n===step);
    el.classList.toggle('complete', n<step);
    el.setAttribute('aria-current', n===step ? 'step' : 'false');
  });
  fadeChars(); setFrames();
  if (!noPush){ const h='#'+p+'-'+S.mode+(p==='timer' ? '-'+S.picked : ''); if (location.hash!==h) history.pushState(null,'',h); }
}
function fadeChars(){ // انتقال ناعم بين أوضاع المساعد
  const cs = document.querySelectorAll('.char');
  cs.forEach(c=>c.style.opacity=0);
  clearTimeout(fadeT);
  fadeT = setTimeout(()=>{ setChars(); cs.forEach(c=>c.style.opacity=1); }, 300);
}
function gotoTimer(noPush){
  S.total = S.picked*60; S.left = S.total; S.running=false;
  updateTimerUI();
  $('startBtn').textContent='ابدأ ▶';
  const _clk = '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="vertical-align:-3px;margin-inline-end:6px"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2.5h6"/></svg>';
  $('timerLabel').innerHTML = _clk + (S.mode==='study'? 'وقت المذاكرة' : 'وقت الراحة');
  show('timer', noPush);
}
$('backBtn').addEventListener('click', ()=>{
  if (spinning) return; // متتراجعش في نص اللفة عشان الحالة متتلخبطش
  clearTransition();
  stopTick();
  if (S.page==='timer') { show('wheel'); }
  else if (S.page==='wheel' && S.mode==='rest') { S.mode='study'; newRound(); angle=0; drawWheel(); show('wheel'); }
});

/* ---------- التايمر ---------- */
function arMin(n){ return n===1 ? 'دقيقة' : n===2 ? 'دقيقتين' : (n>=3 && n<=10) ? 'دقائق' : 'دقيقة'; }
function fmt(s){ s=Math.max(0,Math.ceil(s)); return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0'); }
function updateTimerUI(){
  $('timerDigits').textContent = fmt(S.left);
  $('progressBar').style.width = (S.total? (S.left/S.total*100):0)+'%';
  document.title = S.running ? fmt(S.left)+' - Study with OR' : 'Study with OR';
}
function stopTick(){ if(S.tick){clearInterval(S.tick); S.tick=null;} S.running=false; unlockScreen(); }
$('startBtn').addEventListener('click', ()=>{
  if (S.running) return;
  clearTransition();
  if (S.left<=0){ S.left=S.total; updateTimerUI(); }
  S.running=true; S.endAt = Date.now()+S.left*1000; lockScreen(); // الشاشة تفضل صاحية وقت الجلسة
  $('startBtn').textContent='شغال...';
  freezeChar(false);
  if (S.mode==='study') setTodo(2, true); // بدء المذاكرة
  S.tick = setInterval(()=>{
    S.left = (S.endAt-Date.now())/1000;
    if (S.left<=0){ S.left=0; updateTimerUI(); finishTimer(); }
    else updateTimerUI();
  },250);
});
$('pauseBtn').addEventListener('click', ()=>{
  if (!S.running) return;
  S.left = Math.max(0, (S.endAt-Date.now())/1000);
  stopTick();
  updateTimerUI();
  freezeChar(true);
  if (S.left<=0){ finishTimer(); return; }
  $('startBtn').textContent='استئناف ▶';
});
$('resetBtn').addEventListener('click', ()=>{
  clearTransition();
  stopTick(); S.left=S.total; updateTimerUI(); $('startBtn').textContent='ابدأ ▶';
  freezeChar(false);
});
$('skipBtn').addEventListener('click', ()=>{ // تخطي المرحلة الحالية
  clearTransition();
  stopTick(); S.left=0; updateTimerUI();
  $('startBtn').textContent='ابدأ ▶';
  const wasRest = (S.mode==='rest');
  S.mode = wasRest ? 'study' : 'rest';
  if (wasRest) newRound();
  angle=0; drawWheel(); show('wheel');
});
function finishTimer(){
  clearTransition();
  stopTick(); chime(); $('startBtn').textContent='ابدأ ▶';
  if (S.mode==='study'){
    toast('خلص وقت المذاكرة! وقت الراحة');
    // المساعد بيحتفل بقفزة أول ما المذاكرة تخلص
    const mobileEnd = (window.innerWidth < 760 || window.innerHeight > window.innerWidth * 1.15);
    if (mobileEnd) charPlace(66, 6, 18, 'cheer');
    else charPlace(34, 8, 36, 'cheer');
    charEl().classList.remove('frozen');
    charPlay('cheer', false);
    transitionTimer = setTimeout(()=>{ transitionTimer=null; S.mode='rest'; angle=0; drawWheel(); show('wheel'); }, 6600);
  } else {
    freezeChar(true);
    toast('خلصت الراحة، نرجع نذاكر؟');
    transitionTimer = setTimeout(()=>{ transitionTimer=null; S.mode='study'; newRound(); angle=0; drawWheel(); show('wheel'); }, 2600);
  }
}
let toastTimer = null;
function toast(msg){
  $('toast').textContent = msg; $('toast').classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>$('toast').classList.remove('show'), 2200);
}

/* ---------- البراويز ---------- */
const lb = $('lightbox');
document.querySelectorAll('.frame').forEach(f=>{
  f.addEventListener('click', ()=>{
    lb.querySelector('img').src = f.querySelector('img').src;
    lb.classList.add('open');
  });
  f.addEventListener('keydown', e=>{ if (e.key==='Enter' || e.key===' '){ e.preventDefault(); f.click(); } });
});
lb.addEventListener('click', ()=>lb.classList.remove('open'));
document.addEventListener('keydown', e=>{ if(e.key==='Escape') lb.classList.remove('open'); });

/* ---------- السبورة ---------- */
function setTodo(i, done){
  const t = document.querySelectorAll('.todo')[i];
  if (!t) return;
  t.classList.toggle('done', done);
  t.querySelector('.box').textContent = done ? '✓' : '';
  savePrefs();
}
function newRound(){ setTodo(1, false); setTodo(2, false); } // جولة مذاكرة جديدة
document.querySelectorAll('.todo').forEach(t=>{
  t.addEventListener('click', ()=>{
    t.classList.toggle('done');
    t.querySelector('.box').textContent = t.classList.contains('done')? '✓':'';
    savePrefs();
  });
});

/* ---------- حفظ التفضيلات ---------- */
function savePrefs(){
  try {
    localStorage.setItem('swo', JSON.stringify({studyVals:S.studyVals, restVals:S.restVals, rainVol, chimeVol,
      todos:[...document.querySelectorAll('.todo')].map(t=>t.classList.contains('done'))}));
  } catch(e) {}
}
function loadPrefs(){
  try {
    const p = JSON.parse(localStorage.getItem('swo')||'null');
    if (!p) return;
    const ok = a => Array.isArray(a) && a.length>0 && a.length<=12 && a.every(v=>Number.isInteger(v) && v>=1 && v<=180);
    if (ok(p.studyVals)) S.studyVals = p.studyVals;
    if (ok(p.restVals)) S.restVals = p.restVals;
    if (typeof p.rainVol==='number' && p.rainVol>=0 && p.rainVol<=1){ rainVol=p.rainVol; $('rainVol').value=Math.round(rainVol*100); }
    if (typeof p.chimeVol==='number' && p.chimeVol>=0 && p.chimeVol<=1){ chimeVol=p.chimeVol; $('chimeVol').value=Math.round(chimeVol*100); }
    if (Array.isArray(p.todos)) p.todos.forEach((d,i)=>{
      const t=document.querySelectorAll('.todo')[i];
      if (t){ t.classList.toggle('done', !!d); t.querySelector('.box').textContent = d ? '✓' : ''; }
    });
  } catch(e) {}
}

/* ---------- بداية ---------- */
loadPrefs();
// تحميل مسبق لصور الحالات والبراويز عشان أول تحويلة تكون سلسة
Object.values(CLIPS).map(c=>c.poster)
  .concat(Object.values(FRAMES.study), Object.values(FRAMES.rest))
  .forEach(u=>{ const im=new Image(); im.src=u; });
sizeWheelCanvas(); setChars(); setFrames();
window.addEventListener('resize', ()=>{ clearTimeout(rz); rz=setTimeout(setChars, 150); });
// الروابط: #wheel-study  #timer-study-45  #wheel-rest  #timer-rest-10
function route(h, instant){
  const parts = h.split('-');
  S.mode = parts[1]==='rest' ? 'rest' : 'study';
  S.picked = parseInt(parts[2]) || 45;
  clearTransition(); stopTick();
  angle=0; drawWheel();
  const pgs = document.querySelectorAll('.page');
  if (instant) pgs.forEach(p=>p.style.transition='none');
  if (parts[0]==='timer') gotoTimer(true); else show('wheel', true);
  if (instant) setTimeout(()=>pgs.forEach(p=>p.style.transition=''), 80);
}
window.addEventListener('popstate', ()=>route(location.hash.replace('#','') || 'wheel-study'));
(function(){
  const h = location.hash.replace('#','');
  if (!h){ history.replaceState(null,'','#wheel-study'); return; }
  const _intro = document.getElementById('intro'); if (_intro) _intro.remove();
  route(h, true);
})();

/* ===== intro ===== */
(function () {
  const intro = document.getElementById('intro');
  if (!intro) return;
  const vid = document.getElementById('introVideo');
  const tap = document.getElementById('introTap');
  let done = false, playing = false;
  function endIntro() {
    if (done) return; done = true;
    try { vid.pause(); } catch(e) {}
    intro.classList.add('leave');
    setTimeout(() => { intro.remove(); audioInit(); }, 900);
  }
  tap.addEventListener('click', (e) => {
    e.stopPropagation();
    if (playing) return; playing = true;
    tap.style.display = 'none';
    intro.classList.add('playing');
    vid.play().catch(() => { vid.play().catch(endIntro); });
  });
  vid.addEventListener('ended', endIntro);
  vid.addEventListener('error', ()=>{
    const img = document.createElement('img');
    img.src = 'assets/or-wave.png';
    img.id = 'introVideo';
    img.alt = '';
    vid.replaceWith(img);
    tap.textContent = '▶ دخول';
    tap.addEventListener('click', (e)=>{ e.stopPropagation(); endIntro(); });
  });
  intro.addEventListener('click', () => { if (playing) endIntro(); });
  setTimeout(() => {
    if (!playing && !done) {
      playing = true; tap.style.display = 'none';
      intro.classList.add('playing');
      vid.play().catch(endIntro);
    }
  }, 9000);
})();
