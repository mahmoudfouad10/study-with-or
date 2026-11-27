const ASSETS = {
  tom1:'assets/tom1.webp', tom2:'assets/tom2.webp', tom3:'assets/tom3.webp',
  jerry1:'assets/jerry1.webp', jerry2:'assets/jerry2.webp', jerry3:'assets/jerry3.webp',
  tomspin1:'assets/tom-spin1.webp', tomspin2:'assets/tom-spin2.webp', tomspin3:'assets/tom-spin3.webp',
  jerryspin1:'assets/jerry-spin1.webp', jerryspin2:'assets/jerry-spin2.webp', jerryspin3:'assets/jerry-spin3.webp', jerryspin4:'assets/jerry-spin4.webp',
  jerryspin5:'assets/jerry-spin5.webp', jerryspin6:'assets/jerry-spin6.webp', jerryspin7:'assets/jerry-spin7.webp'
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

/* ---------- الصوت ---------- */
let AC=null, rainGain=null, chimeVol=.7, rainVol=.3;
function audioInit(){
  if (AC) return;
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
$('rainVol').addEventListener('input', e=>{ rainVol=e.target.value/100; if(rainGain) rainGain.gain.value=rainVol*.9; });
$('chimeVol').addEventListener('input', e=>{ chimeVol=e.target.value/100; });
document.addEventListener('pointerdown', audioInit, {once:true});

/* ---------- العجلة ---------- */
const cv = $('wheel'), ctx2d = cv.getContext('2d');
let angle = 0, spinning=false;
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
  // إطار خشبي
  ctx2d.beginPath(); ctx2d.arc(0,0,r+7,0,2*Math.PI);
  ctx2d.strokeStyle='#6b4c2f'; ctx2d.lineWidth=15; ctx2d.stroke();
  ctx2d.beginPath(); ctx2d.arc(0,0,r-1,0,2*Math.PI);
  ctx2d.strokeStyle='#8b6539'; ctx2d.lineWidth=3; ctx2d.stroke();
  ctx2d.restore();
}
function spin(){
  if (spinning) return;
  spinning = true; $('spinBtn').disabled = true;
  const vals = S.mode==='study'? S.studyVals : S.restVals;
  const _poses = S.mode==='study' ? ['tomspin1','tomspin2','tomspin3','tomspin2'] : ['jerryspin1','jerryspin2','jerryspin3','jerryspin4','jerryspin5','jerryspin6','jerryspin7'];
  const _chImg = (S.mode==='study' ? $('charTom') : $('charJerry')).querySelector('img');
  let _pi=0;
  const _poseTimer=setInterval(()=>{ _chImg.src=ASSETS[_poses[_pi%_poses.length]]; _pi++; }, 170);
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
      clearInterval(_poseTimer); setChars();
      S.picked = vals[targetIdx];
      toast(S.mode==='study' ? `مذاكرة ${S.picked} دقيقة` : `راحة ${S.picked} دقائق`);
      setTimeout(()=>gotoTimer(), 1100);
    }
  }
  requestAnimationFrame(frame);
}
$('spinBtn').addEventListener('click', spin);
cv.addEventListener('click', spin);

/* ---------- تعديل الأوقات ---------- */
$('editToggle').addEventListener('click', ()=>{
  const p = $('editPanel'); p.classList.toggle('open');
  const vals = S.mode==='study'? S.studyVals : S.restVals;
  $('editInputs').innerHTML = vals.map((v,i)=>`<input type="number" min="1" max="180" value="${v}" data-i="${i}">`).join('');
});
$('editApply').addEventListener('click', ()=>{
  const vals = [...$('editInputs').querySelectorAll('input')]
    .map(el=>Math.max(1,Math.min(180,parseInt(el.value)||1)));
  if (S.mode==='study') S.studyVals = vals; else S.restVals = vals;
  angle=0; drawWheel(); $('editPanel').classList.remove('open');
});

/* ---------- التنقل ---------- */
function setChars(){
  const T=$('charTom'), J=$('charJerry');
  let ti, tt, tl, th, ji, jt, jl, jh;
  if (S.page==='wheel' && S.mode==='study'){ ti='tom1'; tt=48; tl=11; th=30;  ji='jerry2'; jt=55; jl=64.5; jh=22; }
  else if (S.page==='wheel' && S.mode==='rest'){ ti='tom2'; tt=48; tl=12; th=30;  ji='jerry1'; jt=55; jl=64.3; jh=22; }
  else if (S.page==='timer' && S.mode==='study'){ ti='tom3'; tt=54; tl=11.5; th=24;  ji='jerry3'; jt=58; jl=76.5; jh=20; }
  else { ti='tom2'; tt=50; tl=12; th=28;  ji='jerry2'; jt=58; jl=77; jh=22; }
  if (window.innerWidth < 760 || window.innerHeight > window.innerWidth * 1.15){
    const A = {tom1:.746, tom2:.564, tom3:.824, jerry1:.715, jerry2:.657, jerry3:.765};
    tt=73.5; tl=12; th=13;  jt=75; jh=11;
    jl = 96 - (jh/100 * window.innerHeight * A[ji] / window.innerWidth * 100);
  }
  T.querySelector('img').src = ASSETS[ti];
  T.style.top=tt+'%'; T.style.left=tl+'%'; T.style.height=th+'%'; T.style.width='auto'; T.style.aspectRatio='auto';
  J.querySelector('img').src = ASSETS[ji];
  J.style.top=jt+'%'; J.style.left=jl+'%'; J.style.height=jh+'%'; J.style.width='auto';
  T.classList.add('anim'); J.classList.add('anim');
  T.classList.remove('frozen'); J.classList.remove('frozen');
}
function setFrames(){
  const set = FRAMES[S.mode];
  document.querySelectorAll('.frame').forEach(f=>{
    f.querySelector('img').src = set[f.dataset.slot];
  });
}
function show(p){
  $('pageWheel').classList.toggle('on', p==='wheel');
  $('pageTimer').classList.toggle('on', p==='timer');
  const fe=document.querySelector('.frame[data-slot="e"]'); if(fe) fe.style.display=(p==='timer')?'none':'';
  $('backBtn').style.display = (p==='wheel' && S.mode==='study') ? 'none' : 'inline-block';
  S.page = p;
  document.body.classList.toggle('rest', S.mode==='rest');
  setChars(); setFrames();
}
function gotoTimer(){
  S.total = S.picked*60; S.left = S.total; S.running=false;
  updateTimerUI();
  $('startBtn').textContent='ابدأ ▶';
  const _clk = '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="vertical-align:-3px;margin-inline-end:6px"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2.5h6"/></svg>';
  $('timerLabel').innerHTML = _clk + (S.mode==='study'? 'وقت المذاكرة' : 'وقت الراحة');
  show('timer');
}
$('backBtn').addEventListener('click', ()=>{
  stopTick();
  if (S.page==='timer') { show('wheel'); }
  else if (S.page==='wheel' && S.mode==='rest') { S.mode='study'; angle=0; drawWheel(); show('wheel'); }
});

/* ---------- التايمر ---------- */
function fmt(s){ s=Math.max(0,Math.ceil(s)); return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0'); }
function updateTimerUI(){
  $('timerDigits').textContent = fmt(S.left);
  $('progressBar').style.width = (S.total? (S.left/S.total*100):0)+'%';
}
function stopTick(){ if(S.tick){clearInterval(S.tick); S.tick=null;} S.running=false; }
$('startBtn').addEventListener('click', ()=>{
  if (S.running) return;
  S.running=true; S.endAt = Date.now()+S.left*1000;
  $('startBtn').textContent='شغال...';
  S.tick = setInterval(()=>{
    S.left = (S.endAt-Date.now())/1000;
    if (S.left<=0){ S.left=0; updateTimerUI(); finishTimer(); }
    else updateTimerUI();
  },250);
});
$('pauseBtn').addEventListener('click', ()=>{
  if (!S.running) return;
  stopTick(); $('startBtn').textContent='استئناف ▶';
});
$('resetBtn').addEventListener('click', ()=>{
  stopTick(); S.left=S.total; updateTimerUI(); $('startBtn').textContent='ابدأ ▶';
  $('charTom').classList.remove('frozen'); $('charJerry').classList.remove('frozen');
});
function finishTimer(){
  stopTick(); chime(); $('startBtn').textContent='ابدأ ▶';
  $('charTom').classList.add('frozen'); $('charJerry').classList.add('frozen');
  if (S.mode==='study'){
    toast('خلص وقت المذاكرة! وقت الراحة');
    setTimeout(()=>{ S.mode='rest'; angle=0; drawWheel(); show('wheel'); }, 2600);
  } else {
    toast('خلصت الراحة، نرجع نذاكر؟');
    setTimeout(()=>{ S.mode='study'; angle=0; drawWheel(); show('wheel'); }, 2600);
  }
}
function toast(msg){
  $('toast').textContent = msg; $('toast').classList.add('show');
  setTimeout(()=>$('toast').classList.remove('show'), 2200);
}

/* ---------- البراويز ---------- */
const lb = $('lightbox');
document.querySelectorAll('.frame').forEach(f=>{
  f.addEventListener('click', ()=>{
    lb.querySelector('img').src = f.querySelector('img').src;
    lb.classList.add('open');
  });
});
lb.addEventListener('click', ()=>lb.classList.remove('open'));
document.addEventListener('keydown', e=>{ if(e.key==='Escape') lb.classList.remove('open'); });

/* ---------- السبورة ---------- */
document.querySelectorAll('.todo').forEach(t=>{
  t.addEventListener('click', ()=>{
    t.classList.toggle('done');
    t.querySelector('.box').textContent = t.classList.contains('done')? '✓':'';
  });
});

/* ---------- بداية ---------- */
drawWheel(); setChars(); setFrames();
// لدعم المعاينة المباشرة لصفحة معينة: index.html#timer-study-45 أو #wheel-rest
(function(){
  const h = location.hash.replace('#','');
  if (!h) return;
  const _intro = document.getElementById('intro'); if (_intro) _intro.remove();
  const parts = h.split('-');
  if (parts[1]) S.mode = parts[1];
  if (parts[2]) S.picked = parseInt(parts[2])||45;
  document.querySelectorAll('.page').forEach(p=>p.style.transition='none');
  if (parts[0]==='timer') gotoTimer();
  else { angle=0; drawWheel(); show('wheel'); }
})();

/* ===== intro ===== */
(function () {
  const intro = document.getElementById('intro');
  if (!intro) return;
  const vid = document.getElementById('introVideo');
  const tap = document.getElementById('introTap');
  let done = false, playing = false;
  fetch(vid.dataset.src).then(r => r.blob()).then(b => { vid.src = URL.createObjectURL(b); }).catch(() => {});
  function endIntro() {
    if (done) return; done = true;
    try { vid.pause(); } catch(e) {}
    intro.classList.add('leave');
    setTimeout(() => intro.remove(), 900);
  }
  tap.addEventListener('click', (e) => {
    e.stopPropagation();
    if (playing) return; playing = true;
    tap.style.display = 'none';
    vid.play().catch(() => { vid.muted = true; vid.play().catch(endIntro); });
  });
  vid.addEventListener('ended', endIntro);
  vid.addEventListener('error', endIntro);
  intro.addEventListener('click', () => { if (playing) endIntro(); });
  setTimeout(() => {
    if (!playing && !done) {
      playing = true; tap.style.display = 'none';
      vid.muted = true; vid.play().catch(endIntro);
    }
  }, 9000);
})();
