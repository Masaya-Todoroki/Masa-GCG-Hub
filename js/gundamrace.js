'use strict';
// =============================================================
// GAMEPLAY SETTINGS — edit game behaviour here.
// Visual sizes and proportions are in css/gundamrace.css.
// =============================================================
const GAME_SETTINGS = {
    minimumSpeed: 0.75, // Never move slower than 75% of normal race pace.
    maximumSpeed: 3.0, // Cap dramatic comeback bursts at 3x normal pace.
    comebackChance: 0.35, // Chance of a last-to-first style comeback storyline.
    finishSpread: 0.10, // Finishers arrive over the final 10% of race time.
    storylineVariation: 0.07, // How much the pack changes positions mid-race.
    finishPanelDelay: 0, // Reserved for future placement reveal timing.
    launchBoostChance: 0.35, // Chance each racer gets an opening speed burst.
    launchBoostMin: 0.25, // Minimum extra speed during a launch boost.
    launchBoostMax: 0.75, // Maximum extra speed during a launch boost.
    launchBoostMinMs: 900, // Shortest opening boost duration.
    launchBoostMaxMs: 2200, // Longest opening boost duration.
    crowdHorizontalPx: 105, // Racers closer than this may gently separate.
    crowdVerticalPx: 85, // Only nearby racers vertically affect spacing.
    crowdAvoidanceStrength: 0.16, // Speed adjustment for avoiding clumps.
    crowdMaxSlowdown: 0.20 // Limit the effect so overtaking remains possible.
};

const visualSetting = (name) => parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue(name)
);

const $=id=>document.getElementById(id),rand=(a,b)=>a+Math.random()*(b-a);
let avatars=[],racers=[],running=false,frame=0,finishX=0,worldWidth=0,camera=0,placements=[],activeDurationMs=60000,roster=[],excludedWinners=[],resultsAutoOpened=false;
function updateRaceProgress(value) {
    const progress = Math.max(0, Math.min(1, value));
    const percentage = `${(progress * 100).toFixed(2)}%`;
    $('raceProgressFill').style.width = percentage;
    $('raceProgressIcon').style.left = percentage;
    $('raceProgress').setAttribute('aria-valuenow', String(Math.round(progress * 100)));
}
// Resolve the transparent branding icon regardless of its image extension.
function loadProgressIcon() {
    const icon = $('raceProgressIcon');
    const extensions = ['webp', 'png', 'svg', 'jpg', 'jpeg'];
    let index = 0;
    icon.onerror = () => {
        index++;
        if (index < extensions.length) {
            icon.src = `images/Branding/GCG_Icon.${extensions[index]}`;
        } else {
            icon.style.display = 'none';
        }
    };
}
const safe=s=>String(s);
const path=id=>{const [cat,file]=id.split('/');return 'images/Avatars/'+cat+'/'+encodeURIComponent(file)};
async function loadAvatars(){
 try{const r=await fetch('data/Avatars.csv',{cache:'no-cache'});if(!r.ok)throw Error('HTTP '+r.status);
 const lines=(await r.text()).replace(/^\uFEFF/,'').trim().split(/\r?\n/),headers=lines.shift().split(',').map(x=>x.trim());
 for(const row of lines){const cells=row.split(',');for(const cat of ['Pilots','Units']){const value=cells[headers.indexOf(cat)]?.trim();if(value&&/^[a-z0-9_ ()-]+$/i.test(value))avatars.push(cat+'/'+value)}}
 $('status').textContent=avatars.length+' avatars loaded';
 }catch(e){$('status').textContent='Avatar list unavailable';$('message').textContent='Could not load data/Avatars.csv. Put gundamrace.html at your website root and open via a web server (not file://).';}
}
// Rotate the supplied road image 90 degrees in the browser. No extra asset required.
// The source is vertical; the rotated image repeats horizontally and vertically.
function loadRoad(){
 const road=new Image();
 road.onload=()=>{
  const canvas=document.createElement('canvas');
  canvas.width=road.naturalHeight;canvas.height=road.naturalWidth;
  const ctx=canvas.getContext('2d');
  ctx.translate(canvas.width,0);ctx.rotate(Math.PI/2);
  ctx.drawImage(road,0,0);
  const track=document.querySelector('#scenery .track');
  track.style.setProperty('--road-image',`url("${canvas.toDataURL('image/png')}")`);
  // Preserve the image's natural pixel aspect ratio; don't stretch to fit the screen.
  track.style.setProperty('--road-tile-width',`${canvas.width}px`);
  track.style.setProperty('--road-tile-height',`${canvas.height}px`);
 };
 road.onerror=()=>console.warn('Road image missing: images/gundamrace-assets/Seamless_Road.webp');
 road.src='images/gundamrace-assets/Seamless_Road.webp';
}
loadRoad();
// Load scenery ahead of time so a new race doesn't wait on a background download.
const BACKGROUND_NUMBERS = [1, 2, 3];
const BACKGROUND_FOLDERS = [
 'images/gundamrace-assets/background/',
 'images/gundamrace-assets/'
];
const BACKGROUND_EXTENSIONS = ['webp', 'png', 'jpg', 'jpeg'];
const backgroundCache = new Map();
let currentBackground = 0;
function loadBackground(number) {
 if (backgroundCache.has(number)) return backgroundCache.get(number);
 const base = `BG_0${number}`;
 const paths = BACKGROUND_FOLDERS.flatMap(folder =>
  BACKGROUND_EXTENSIONS.map(ext => `${folder}${base}.${ext}`)
 );
 const pending = new Promise(resolve => {
  function tryNext(index) {
   if (index >= paths.length) { resolve(null); return; }
   const image = new Image();
   image.onload = () => resolve(paths[index]);
   image.onerror = () => tryNext(index + 1);
   image.src = paths[index];
  }
  tryNext(0);
 });
 backgroundCache.set(number, pending);
 return pending;
}
function preloadScenery() {
 BACKGROUND_NUMBERS.forEach(loadBackground);
 // The road texture is decoded by loadRoad(); warm the fence cache too.
 const fence = new Image();
 fence.src = 'images/gundamrace-assets/Fence.webp';
}
function randomBackground() {
 const options = BACKGROUND_NUMBERS.filter(number => number !== currentBackground);
 if (!options.length) return;
 const chosen = options[Math.floor(Math.random() * options.length)];
 currentBackground = chosen;
 // Keep the previous image visible until the next background is ready.
 loadBackground(chosen).then(url => {
  if (url && currentBackground === chosen) {
   document.querySelector('#scenery .backdrop').style.backgroundImage = `url("${url}")`;
  }
 });
}
function assignAvatar(){return avatars.length?avatars[Math.floor(Math.random()*avatars.length)]:null}
function sprite(r){
 const el=document.createElement('div');el.className='sprite';r.sprite=el;el.style.transform='scaleX(-1)';
 if(!r.avatar){el.textContent='🤖';el.style.fontSize='45px';return el}
 const base=path(r.avatar);
 // The plain .webp is the idle pose. Do not use the first spritesheet frame as idle.
 const idle=new Image();idle.onload=()=>{r.idleImage=idle.src;if(!running||!r.sheetActive){el.style.backgroundImage=`url("${idle.src}")`;el.style.backgroundSize='contain';el.style.backgroundPosition='center'}};
 idle.onerror=()=>{const png=new Image();png.onload=()=>{r.idleImage=png.src;if(!running||!r.sheetActive){el.style.backgroundImage=`url("${png.src}")`;el.style.backgroundSize='contain';el.style.backgroundPosition='center'}};png.src=base+'.png'};
 idle.src=base+'.webp';
 const sheet=new Image();
 sheet.onload=()=>{if(sheet.naturalHeight!==128||sheet.naturalWidth<128||sheet.naturalWidth%128!==0)return;r.sheet=sheet.src;r.frames=sheet.naturalWidth/128};
 sheet.src=base+'_Spritesheet.webp';
 return el;
}
function animateRunner(r,now){
 if(!r.frames||!r.sheet)return;
 if(!r.sheetActive){
  r.sheetActive=true;r.sprite.style.backgroundImage=`url("${r.sheet}")`;
  r.sprite.style.backgroundSize=`${r.frames*100}% 100%`;
 }
 const f=Math.floor(now/125)%r.frames;
 r.sprite.style.backgroundPosition=`${r.frames===1?0:f/(r.frames-1)*100}% 0%`;
}
function idleRunner(r){
 r.sheetActive=false;
 if(r.idleImage){r.sprite.style.backgroundImage=`url("${r.idleImage}")`;r.sprite.style.backgroundSize='contain';r.sprite.style.backgroundPosition='center'}
}

function render(){
 const race=$('race');worldWidth=Math.max(race.clientWidth*5,3000);finishX=worldWidth-160;
 $('world').style.width=worldWidth+'px';$('world').style.transform='translateX(0)';$('finish').style.left=finishX+'px';camera=0;
 $('world').querySelectorAll('.runner').forEach(n=>n.remove());
 const h=race.clientHeight, count=racers.length;
 // All runners must fit inside the runway (30%-100% of the race viewport).
 const runwayTop=h*(1-visualSetting("--runway-percent")/100), runwayBottom=h;
 const runwayHeight=runwayBottom-runwayTop;
 const slot=runwayHeight/Math.max(1,count);
 racers.forEach((r,i)=>{
 const node=document.createElement('div');node.className='runner';node.append(sprite(r));
 const label=document.createElement('span');label.className='name';label.textContent=r.name;node.append(label);
 $('world').append(node);r.node=node;
 // Runner top is centred in its runway slot; never enters the sky or buildings.
 const visualHeight=visualSetting("--character-size")+visualSetting("--name-size")+4;
 const y=Math.max(runwayTop,Math.min(runwayBottom-visualHeight,runwayTop+(i+.5)*slot-visualHeight/2));
 r.y=y;
 // Everyone starts at the same horizontal position; opening boosts create movement-based spacing.
 r.x=0;r.finished=false;r.finishTime=Infinity;r.speed=rand(.97,1.03);r.surge=0;r.nextSurge=0;r.phase=rand(0,7);r.sheetActive=false;
 node.style.transform=`translate(0px,${y}px)`;
 });
 updateRaceProgress(0);$('start').disabled=racers.length<2;
}
function prepare(){
 if(running)return;const names=$('names').value.split(/\r?\n/).map(s=>s.trim()).filter(Boolean).slice(0,100);
 if(names.length<2){$('message').textContent='Please enter at least two players.';return}
 roster=names.map((name,i)=>({id:i,name:name.slice(0,40),avatar:assignAvatar()}));excludedWinners=[];racers=[...roster];placements=[];clearLivePlacements();render();
 $('overlay').style.display='none';$('status').textContent=racers.length+' racers ready';
}
function endRace(){
 running=false;setStartButton(false);placements=[...racers].sort((a,b)=>a.finishTime-b.finishTime);
 updateRaceProgress(1);
 updateEligibleRacers();
 $('status').textContent='Race finished';$('start').disabled=racers.length<2;$('reset').disabled=false;$('edit').disabled=false;
 if($('overlay').style.display==='flex'&&$('results'))showPlacements();
 // Keep the live finishers panel visible; the full results remain available via Placements.
}
function setStartButton(isRunning){
 const button=$('start');
 button.textContent=isRunning?'■ Stop Race':'▶ Start Race';
 button.classList.toggle('stop-race',isRunning);
 button.disabled=!isRunning&&racers.length<2;
}
function stopRace(){
 if(!running)return;
 running=false;
 cancelAnimationFrame(frame);
 racers.forEach(idleRunner);
 setStartButton(false);
 $('reset').disabled=false;
 $('edit').disabled=false;
 updateEligibleRacers();
 $('status').textContent='Race stopped';
 if($('overlay').style.display==='flex'&&$('results'))showPlacements(false);
 // Preserve the progress bar and any already recorded finishers.
}
// The finishing order is shuffled once at the start, independently of avatars/names.
// A set of timed distance checkpoints creates the story; each segment has a
// strictly positive speed, so a losing racer never pauses to wait for a result.
function shuffle(items){
 const out=[...items];
 for(let i=out.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[out[i],out[j]]=[out[j],out[i]]}
 return out;
}
function makeRacePlan(duration){
 const order=shuffle(racers);
 const n=order.length;
 const comeback=Math.random()<GAME_SETTINGS.comebackChance;
 const story=shuffle(racers);
 // This is a time-varying *visual* order, not the actual finishing order.
 // All racers share the same starting X position.
 const stages=[0,0.22,0.48,0.70,0.84,1];
 const baseMin=GAME_SETTINGS.minimumSpeed;
 const maxSpeed=GAME_SETTINGS.maximumSpeed;
 const spread=GAME_SETTINGS.finishSpread;
 order.forEach((r,rank)=>{
  r.plannedRank=rank;
  const finishAt=duration*(1-spread+spread*(rank+1)/n);
  const finishFraction=finishAt/duration;
  const storyIndex=story.indexOf(r);
  const storyBias=n>1?(0.5-storyIndex/(n-1)):0;
  const randomBias=rand(-1,1);
  const winnerComeback=comeback&&rank===0;
  // Fractional progress checkpoints. Keep every interval feasible at the
  // minimum speed, while leaving room for late overtakes and strong boosts.
  const knots=[{t:0,p:0}];
  for(let k=1;k<stages.length-1;k++){
   const t=stages[k]*finishFraction;
   let offset=storyBias*GAME_SETTINGS.storylineVariation*2 + randomBias*0.025;
   if(winnerComeback){
    // The eventual winner stays near the back before a late charge.
    offset -= [0,0.055,0.11,0.13,0.07][k];
   }
   const ideal=t/finishFraction + offset*Math.sin(Math.PI*t/finishFraction);
   knots.push({t,p:ideal});
  }
  knots.push({t:finishFraction,p:1});
  // Forward and backward feasibility passes guarantee nonzero movement and
  // keep the needed segment speeds within the configured maximum.
  for(let pass=0;pass<3;pass++){
   for(let k=1;k<knots.length-1;k++){
    const prev=knots[k-1],cur=knots[k];
    const delta=cur.t-prev.t;
    cur.p=Math.max(cur.p,prev.p+baseMin*delta);
    cur.p=Math.min(cur.p,prev.p+maxSpeed*delta);
   }
   for(let k=knots.length-2;k>0;k--){
    const cur=knots[k],next=knots[k+1];
    const delta=next.t-cur.t;
    cur.p=Math.min(cur.p,next.p-baseMin*delta);
    cur.p=Math.max(cur.p,next.p-maxSpeed*delta);
   }
  }
  r.racePlan=knots;
  r.finishAt=finishAt;
 });
}
function plannedPosition(r,elapsedFraction){
 const knots=r.racePlan;
 if(elapsedFraction>=r.finishAt/activeDurationMs)return finishX;
 for(let i=1;i<knots.length;i++){
  if(elapsedFraction<=knots[i].t){
   const a=knots[i-1],b=knots[i];
   return finishX*(a.p+(b.p-a.p)*(elapsedFraction-a.t)/(b.t-a.t));
  }
 }
 return finishX;
}
function start(){
 if(running)return;
 updateEligibleRacers();
 if(racers.length<2)return;
 const durationInput=$('duration');
 const requestedSeconds=Number(durationInput.value);
 if(!Number.isFinite(requestedSeconds)||requestedSeconds<1||requestedSeconds>3600){
  durationInput.setCustomValidity('Enter a duration between 1 and 3600 seconds.');
  durationInput.reportValidity();
  return;
 }
 durationInput.setCustomValidity('');
 activeDurationMs=requestedSeconds*1000;
 randomBackground();clearLivePlacements();placements=[];resultsAutoOpened=false;render();
 running=true;setStartButton(true);
 $('reset').disabled=true;$('edit').disabled=true;$('overlay').style.display='none';
 const begin=performance.now(),duration=activeDurationMs;
 makeRacePlan(duration);
 racers.forEach(r=>animateRunner(r,begin));
 function tick(now){
  if(!running)return;
  const elapsed=Math.min(1,(now-begin)/duration);
  let leader=0,done=0;
  for(const r of racers){
   if(!r.finished){
    r.x=Math.min(finishX,plannedPosition(r,elapsed));
    if(elapsed>=r.finishAt/duration){
     r.x=finishX;r.finished=true;r.finishTime=r.finishAt;
     recordFinisher(r);
    }
   }
   if(r.finished)done++;
   leader=Math.max(leader,r.x);
   r.node.style.transform=`translate(${r.x}px,${r.y}px)`;
   if(!r.finished)animateRunner(r,now);else idleRunner(r);
  }
  const vw=$('race').clientWidth;
  const target=Math.max(0,Math.min(worldWidth-vw,leader-vw*.56));
  camera+=(target-camera)*Math.min(1,Math.max(0,now-(tick.last||now))*.008);
  tick.last=now;
  $('world').style.transform=`translateX(${-camera}px)`;
  $('scenery').querySelector('.track').style.setProperty('--road-offset',`${-camera}px`);
  $('scenery').querySelector('.fence').style.setProperty('--fence-offset',`${-camera}px`);
  updateRaceProgress(finishX>0?leader/finishX:0);
  if(done===racers.length){racers.forEach(idleRunner);endRace();return}
  frame=requestAnimationFrame(tick);
 }
 frame=requestAnimationFrame(tick);
}
function clearLivePlacements(){
 $('liveList').replaceChildren();
 $('liveCount').textContent='0';
 $('livePlacements').style.display='none';
}
function recordFinisher(r){
 // Called on the exact frame a racer crosses the finish line.
 placements.push(r);
 $('livePlacements').style.display='flex';
 $('liveCount').textContent=`${placements.length} / ${racers.length}`;
 const row=document.createElement('div');row.className='liveRow';
 const rank=document.createElement('strong');rank.textContent='#'+placements.length;row.append(rank);
 if(r.avatar){
  const img=document.createElement('img');img.src=path(r.avatar)+'.webp';
  img.onerror=()=>{if(!img.dataset.fallback){img.dataset.fallback='1';img.src=path(r.avatar)+'.png'}else img.style.display='none'};
  row.append(img);
 }
 const label=document.createElement('span');label.textContent=r.name;row.append(label);
 $('liveList').append(row);
 if(placements.length===Math.min(5,racers.length)&&!resultsAutoOpened){
  resultsAutoOpened=true;showPlacements();
 }else if(resultsAutoOpened&&$('overlay').style.display==='flex'&&$('results')){
  showPlacements(false);
 }
 row.scrollIntoView({block:'nearest',behavior:'instant'});
}
// Keep a master roster so removing and restoring winners never loses their original entry.
function updateEligibleRacers(){
 const excluded=new Set(excludedWinners.map(r=>r.id));
 const eligible=roster.filter(r=>!excluded.has(r.id));
 if(!running)racers=eligible;
 $('names').value=eligible.map(r=>r.name).join('\n');
 updateCount();
 $('start').disabled=!running&&eligible.length<2;
 if(!running)$('status').textContent=`${eligible.length} racers eligible · ${excludedWinners.length} excluded`;
}
function toggleExcluded(id){
 const found=excludedWinners.find(r=>r.id===id);
 if(found)excludedWinners=excludedWinners.filter(r=>r.id!==id);
 else{
  const racer=roster.find(r=>r.id===id);
  if(racer)excludedWinners.push(racer);
 }
 updateEligibleRacers();
 showPlacements(false);
}
function restoreWinner(id){
 excludedWinners=excludedWinners.filter(r=>r.id!==id);
 updateEligibleRacers();
 showPlacements();
}
function showPlacements(resetScroll=true){
 if(!placements.length)return;
 $('modalTitle').textContent=running?'🏆 Live Placements':'🏆 Final Placements';
 $('clearNames').style.display='none';$('names').style.display='none';$('namesCount').style.display='none';
 let list=$('results');
 if(!list){list=document.createElement('div');list.id='results';$('modal').insertBefore(list,$('modal').querySelector('.modalfooter'))}
 const previousScroll=list.scrollTop;
 list.replaceChildren();
 // Prize actions appear before the scrolling results, not after them.
 const heading=document.createElement('div');heading.className='prize-heading';
 heading.textContent='🎁 Next Prize Draw';list.append(heading);
 const hint=document.createElement('p');hint.className='prize-hint';
 hint.textContent='Exclude winners, then start the next race.';list.append(hint);
 const raceAgain=document.createElement('button');
 raceAgain.className='prize-race-again primary';
 raceAgain.textContent=running?'🏁 Race in Progress':`🏁 Prepare Next Race (${roster.length-excludedWinners.length} eligible)`;
 raceAgain.disabled=running||roster.length-excludedWinners.length<2;
 raceAgain.onclick=()=>{
  if(running)return;
  updateEligibleRacers();
  placements=[];
  resultsAutoOpened=false;
  clearLivePlacements();
  $('results')?.remove();
  hideModal();
  render();
  $('status').textContent=`${racers.length} racers ready for the next race`;
 };
 list.append(raceAgain);
 const resultsHeading=document.createElement('h3');
 resultsHeading.className='results-heading';resultsHeading.textContent=running?'🏆 Finished So Far':'🏆 Finishing Positions';list.append(resultsHeading);
 placements.forEach((r,i)=>{
  const row=document.createElement('div');row.className='place';
  const b=document.createElement('b');b.textContent='#'+(i+1);row.append(b);
  if(r.avatar){const img=document.createElement('img');img.src=path(r.avatar)+'.webp';img.onerror=()=>{if(!img.dataset.f){img.dataset.f='1';img.src=path(r.avatar)+'.png'}else img.style.display='none'};row.append(img)}
  const label=document.createElement('span');label.textContent=r.name+(i===0?' 🏆':'');row.append(label);
  const excluded=excludedWinners.some(w=>w.id===r.id);
  // Checked means eligible for the next draw; unchecked means excluded.
  const toggle=document.createElement('label');
  toggle.className='eligibility-toggle'+(excluded?' is-excluded':'');
  const input=document.createElement('input');
  input.type='checkbox';
  input.checked=!excluded;
  input.setAttribute('aria-label',`${r.name} eligible for next race`);
  input.onchange=()=>toggleExcluded(r.id);
  const track=document.createElement('span');
  track.className='eligibility-track';
  track.setAttribute('aria-hidden','true');
  const status=document.createElement('span');
  status.className='eligibility-status';
  status.textContent=excluded?'Excluded':'Eligible';
  toggle.append(input,track,status);
  row.append(toggle);
  list.append(row);
 });
 $('prepare').closest('.modalfooter').style.display='none';
 $('message').textContent=running?'Race continues in the background. Exclusions apply to the next race.':`${racers.length} eligible for the next race. Use the eligibility switches beside each finisher.`;
 if(!resetScroll)list.scrollTop=previousScroll;
 $('overlay').style.display='flex';
}
function hideModal(){$('overlay').style.display='none'}
$('closeModal').onclick=hideModal;
function edit(){
 if(running)return;
 $('modalTitle').textContent='Enter up to 100 Names';$('clearNames').style.display='';$('names').style.display='';$('namesCount').style.display='';
 $('prepare').closest('.modalfooter').style.display='';$('results')?.remove();$('prepare').disabled=false;$('prepare').textContent='🏁 Prepare Race';$('prepare').onclick=prepare;
 $('message').textContent='One name per line. Avatars are assigned randomly.';$('overlay').style.display='flex';updateCount();
}
function updateCount(){const n=$('names').value.split(/\r?\n/).filter(s=>s.trim()).length;$('namesCount').textContent=`Names: ${n} / 100`}
$('names').addEventListener('input',updateCount);$('clearNames').onclick=()=>{$('names').value='';updateCount()};
$('prepare').onclick=prepare;$('start').onclick=()=>running?stopRace():start();$('edit').onclick=edit;
$('reset').onclick=()=>{if(running)return;placements=[];clearLivePlacements();render();$('status').textContent='Ready for another race'};
$('placements').onclick=()=>{if(placements.length)showPlacements()};
window.addEventListener('resize',()=>{if(!running&&racers.length)render()});
loadProgressIcon();updateRaceProgress(0);preloadScenery();randomBackground();loadAvatars();updateCount();
