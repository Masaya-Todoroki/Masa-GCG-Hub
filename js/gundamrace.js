'use strict';
// =============================================================
// GAMEPLAY SETTINGS — edit game behaviour here.
// Visual sizes and proportions are in css/gundamrace.css.
// =============================================================
const GAME_SETTINGS = {
    // Optional countdown timer (local viewer preference)
    showTimerByDefault: true,
    timerPreferenceKey: "gcg-race-show-timer",
    // Track and camera
    relativeStartScreenFraction: 0.10,
    finishLineScreenFraction: 0.15,
    // At the selected duration, the finish is near the front of the screen.
    nominalFinishScreenFraction: 0.75,
    speedReferenceDurationSeconds: 60,
    durationSpeedScaleRange: [0.5, 2.0],
    earlyFinishBufferFraction: 0.025,
    earlyFinishResponseSeconds: 1.5,
    trackViewportLengths: 5,
    minimumTrackWidthPx: 3000,
    finishInsetPx: 160,
    finishStopOffsetPx: 0,
    // Independent racer decisions (speed is relative to constant road speed)
    openingSeconds: 2,
    openingSpeedRange: [0.98, 1.04],
    decisionSeconds: [3.0, 8.0],
    speedRanges: [[0.78,0.94],[0.96,1.12],[1.15,1.32],[1.35,1.55]],
    speedWeights: [22,48,24,6],
    minimumSpeed: 0.65,
    maximumSpeed: 1.65,
    speedResponseSeconds: 0.65,
    // Hidden stamina, identical for every avatar
    staminaMaximum: 100,
    staminaDrainPerSecond: 28,
    staminaRecoveryPerSecond: 25,
    staminaNeutralSpeed: 1.05,
    staminaLow: 25,
    exhaustedSpeed: 0.96,
    // Position awareness; probabilistic, not forced catch-up
    leadGapFraction: 0.20,
    leaderEaseChance: 0.65,
    leaderEaseSpeed: [0.82,0.99],
    // Screen safety: only near the edge, never prevents a finish
    frontSlowdownThresholdRange: [0.50,0.75],
    frontSlowdownChanceRange: [0.12,0.80],
    frontSlowdownFullChanceFraction: 0.85,
    frontSlowdownSeconds: [2.0,5.0],
    frontSlowdownSpeed: [0.80,0.98],
    frontSoftFraction: 0.85,
    frontHardFraction: 0.95,
    frontRecoverySpeed: 0.92,
    finishRelaxFraction: 0.12,
    rearSoftFraction: 0.10,
    rearHardFraction: -0.15,
    // Scenario manager
    scenarioOpeningSeconds: 4,
    scenarioCheckSeconds: [2,4],
    scenarioRacerCooldownSeconds: [8,14],
    scenarioConcurrentFraction: 0.15,
    scenarioMaxConcurrent: 5,
    scenarioMinConcurrent: 2,
    scenarioChance: 0.80,
    breakawayActivationChance: 0.35, // Single roll per race
    breakawayParticipantWeights: [0.50, 0.35, 0.15], // Solo, duo, trio
    breakawayStartDistanceScreens: 2, // Leader distance from finish in viewport widths
    breakawayExhaustionStamina: 0,
    breakawayIgnoreExhaustion: true, // Testing only
    scenarioDurationSeconds: [2,4],
    scenarioWeights: { lucky: 40, breakaway: 30, comeback: 20, secondWind: 15 },
    luckySpeed: [1.35,1.60],
    breakawaySpeed: [1.35,1.60],
    comebackSpeed: [1.30,1.55],
    secondWindSpeed: [1.18,1.40],
    comebackStamina: 35,
    secondWindStamina: 45,
    breakawayGapFraction: 0.22,
    comebackGapFraction: 0.15,
    breakawayMinimumStamina: 35,
    // Earliest activation, as a fraction of the selected race duration
    scenarioStartFractions: { lucky: 0.05, comeback: 0, secondWind: 0.65 },
    comebackLatestFraction: 1,
    comebackDurationSeconds: [7,12],
    comebackLeadingGapFraction: 0.08,
    // Breakaway can evolve into bait near the finish.
    baitMinimumTransitionChance: 0.50, // Chance at the minimum eligible lead
    baitMaximumTransitionChance: 1.0, // Chance at or above the maximum lead multiplier
    baitMaximumChanceLeadMultiplier: 2.0,
    baitMinimumLeadFraction: 0.08,
    baitLeadSafetySeconds: 0.35,
    breakawayMinimumSpeed: 1.03,
    comebackMinimumSpeed: 1.0,
    secondWindMaximumStamina: 70,
    baitTurnDistanceFraction: 0.20,
    baitFallAdvanceFractionRange: [0.03,0.05],
    baitFallSafetyMarginPx: 12,
    baitTauntSeconds: [0.8,1.4],
    baitBackwardSpeed: 1.12,
    baitFallChance: 0.5,
    baitFallSeconds: 0.35,
    baitRecoverySeconds: [1.5,3.5],
    // Toolbar display settings (default name size comes from CSS --name-size).
    nameSizeRangePx: [8, 32],
    nameSizeStepPx: 1,
    nameSizePreferenceKey: "gundamRaceNameSizePx",
    debugMode: true,
    debugLogEvents: true,
    debugReadoutIntervalMs: 250,
    debugWindowWidthPx: 560,
    debugWindowHeightPx: 720,
    animationFrameMs: 125,
    maxFrameMs: 100
};

const visualSetting = (name) => parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue(name)
);

const $=id=>document.getElementById(id),rand=(a,b)=>a+Math.random()*(b-a);
let avatarAssignments=[],avatarCategory="Pilots",selectedAvatarIndex=-1;
let raceScenario="normal",avatars=[],racers=[],running=false,frame=0,finishX=0,worldWidth=0,camera=0,placements=[],activeDurationMs=60000,roster=[],excludedWinners=[],resultsAutoOpened=false;
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
 $('status').textContent=avatars.length+' avatars loaded';syncAvatarAssignments();
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
 const f=Math.floor(now/GAME_SETTINGS.animationFrameMs)%r.frames;
 r.sprite.style.backgroundPosition=`${r.frames===1?0:f/(r.frames-1)*100}% 0%`;
}
function idleRunner(r){
 r.sheetActive=false;
 if(r.idleImage){r.sprite.style.backgroundImage=`url("${r.idleImage}")`;r.sprite.style.backgroundSize='contain';r.sprite.style.backgroundPosition='center'}
}

function render(){
 const race=$('race');worldWidth=Math.max(race.clientWidth*GAME_SETTINGS.trackViewportLengths,GAME_SETTINGS.minimumTrackWidthPx);finishX=worldWidth-GAME_SETTINGS.finishInsetPx;
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
 r.baitRole=null;r.baitCurve=null;r.baitPhase=null;r.node.classList.remove("bait-fallen");r.sprite.style.transform="scaleX(-1)";r.x=race.clientWidth*GAME_SETTINGS.relativeStartScreenFraction;r.finished=false;r.finishTime=Infinity;r.speed=rand(.97,1.03);r.surge=0;r.nextSurge=0;r.phase=rand(0,7);r.sheetActive=false;
 node.style.transform=`translate(${r.x}px,${y}px)`;
 });
 updateRaceProgress(0);$('start').disabled=racers.length<2;
}
function updateRaceTimer(ms){
 const timer=$("raceTimer");if(!timer)return;
 const selected=Number($("duration").value);
 const total=running?activeDurationMs:(Number.isFinite(selected)&&selected>=1&&selected<=3600?selected*1000:activeDurationMs);
 const seconds=Math.max(0,Math.ceil((total-ms)/1000));
 const value=String(Math.floor(seconds/60)).padStart(2,"0")+":"+String(seconds%60).padStart(2,"0");
 if(timer.textContent!==value)timer.textContent=value;
}
function prepare(){
 if(running)return;const names=$('names').value.split(/\r?\n/).map(s=>s.trim()).filter(Boolean).slice(0,100);
 if(names.length<2){$('message').textContent='Please enter at least two players.';return}
 syncAvatarAssignments();roster=names.map((name,i)=>({id:i,name:name.slice(0,40),avatar:avatarAssignments[i]?.avatar||assignAvatar()}));excludedWinners=[];racers=[...roster];placements=[];clearLivePlacements();render();updateRaceTimer(0);
 $('overlay').style.display='none';$('status').textContent=racers.length+' racers ready';
}
function endRace(){
 running=false;setStartButton(false);placements=[...racers].sort((a,b)=>a.finishTime-b.finishTime);
 updateRaceProgress(1);
 updateEligibleRacers();
 $('status').textContent='Race finished';$('start').disabled=racers.length<2;$('reset').disabled=false;$('edit').disabled=false;
 if($('overlay').style.display==='flex'&&$('results'))showPlacements();
 updateDebugReadout(debugActiveMode,debugElapsed);
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
 updateDebugReadout(debugActiveMode,debugElapsed);
 // Preserve the progress bar and any already recorded finishers.
}
// No planned ranks: all positions are integrated from actual speed.
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
const choose=items=>items[Math.floor(Math.random()*items.length)];
function weightedIndex(weights){
 let pick=Math.random()*weights.reduce((a,b)=>a+b,0);
 for(let i=0;i<weights.length;i++){pick-=weights[i];if(pick<0)return i;}
 return weights.length-1;
}
function fieldSnapshot(){
 return racers.filter(r=>!r.finished).map(r=>({r,x:r.x})).sort((a,b)=>b.x-a.x);
}
function decideSpeed(r,field,vw,elapsed){
 const g=GAME_SETTINGS;
 const weights=[...g.speedWeights];
 if(r.stamina<g.staminaLow){weights[0]*=3;weights[2]*=0.25;weights[3]=0;}
 r.targetSpeed=rand(...g.speedRanges[weightedIndex(weights)]);
 if(field.length>1 && field[0].r===r && field[0].x-field[1].x>vw*g.leadGapFraction && Math.random()<g.leaderEaseChance){
  r.targetSpeed=rand(...g.leaderEaseSpeed);
 }
 // Roll once per independent decision, not every animation frame.
 const screenFraction=(r.x-camera)/vw;
 if(!r.baitPhase && elapsed>=r.boostUntil && elapsed>=r.frontSlowdownUntil && screenFraction>=r.frontSlowdownThreshold && camera<finishX-vw*g.finishLineScreenFraction){
  const t=clamp((screenFraction-r.frontSlowdownThreshold)/(g.frontSlowdownFullChanceFraction-r.frontSlowdownThreshold),0,1);
  const [low,high]=g.frontSlowdownChanceRange;
  if(Math.random()<low+(high-low)*t){
   r.frontSlowdownUntil=elapsed+rand(...g.frontSlowdownSeconds)*1000;
   r.frontSlowdownTarget=rand(...g.frontSlowdownSpeed);
  }
 }
 r.nextDecision=elapsed+rand(...g.decisionSeconds)*1000;
}
// Shared, read-only eligibility rules for the manager and monitor.
function scenarioOpportunities(field,vw,elapsed,progress,comebackStart,baitUsed){
 const g=GAME_SETTINGS, result={};
 const available=field.filter(({r})=>elapsed>=r.boostUntil && elapsed>=r.scenarioReadyAt && !r.baitPhase && !committedBreakaways.includes(r));
 const leader=field[0];
 const active=field.filter(({r})=>elapsed<r.boostUntil || r.baitPhase).length;
 const capacity=Math.min(g.scenarioMaxConcurrent,Math.max(g.scenarioMinConcurrent,Math.ceil(field.length*g.scenarioConcurrentFraction)));
 const add=(type,pool,reason,latest=1,earliest=g.scenarioStartFractions[type])=>{
  const waiting=type==='breakaway' && (!leader || finishX-leader.x>vw*g.breakawayStartDistanceScreens)?'Waiting for final stretch':progress<earliest?`Waiting for ${Math.round(earliest*100)}% progress`:progress>latest?'Window closed':field.length<2?'Not enough racers':placements.length?'Winner already finished':active>=capacity?'Concurrent event limit reached':null;
  result[type]={pool:waiting?[]:pool,reason:waiting||(pool.length?'Eligible':reason)};
 };
 add('lucky',available,'No available racers');
 const committed=committedBreakaways;
 add('breakaway',breakawayRolled?[]:available.filter(({r,x})=>leader && leader.x-x<=vw*g.breakawayGapFraction && r.stamina>=g.breakawayMinimumStamina && Math.max(r.relativeSpeed,r.targetSpeed)>=g.breakawayMinimumSpeed),committed.length?'Committed: '+committed.map(r=>r.name).join(', '):breakawayRolled?'Race roll completed':'Waiting for a near-front racer with energy',1,0);
 add('comeback',available.filter(({r,x})=>leader && leader.x-x>=vw*g.comebackGapFraction && r.targetSpeed>=g.comebackMinimumSpeed && r.stamina>=g.comebackStamina),'Waiting for a trailing racer with energy to accelerate',g.comebackLatestFraction,comebackStart);
 add('secondWind',available.filter(({r})=>r.stamina<=g.secondWindMaximumStamina),'Waiting for a tired racer');
 return result;
}
function runScenario(opportunities,elapsed,progress,forcedType=null){
 const g=GAME_SETTINGS;
 const types=Object.keys(opportunities).filter(k=>opportunities[k].pool.length);
 if(!types.length)return false;
 const type=forcedType||types[weightedIndex(types.map(k=>g.scenarioWeights[k]))];
 const pool=[...opportunities[type].pool];
 const count=type==='breakaway'?Math.min(pool.length,1+weightedIndex(g.breakawayParticipantWeights)):1;
 const selected=[];
 for(let i=0;i<count;i++){const entry=choose(pool);pool.splice(pool.indexOf(entry),1);selected.push(entry.r);}
 if(type==='breakaway')committedBreakaways=selected;
 for(const r of selected){
 if(type==='comeback')r.stamina=g.staminaMaximum;
 if(type==='secondWind')r.stamina=clamp(r.stamina+g.secondWindStamina,0,g.staminaMaximum);
 r.boostSpeed=rand(...g[type+'Speed']);
 r.boostUntil=type==='breakaway'?Infinity:elapsed+rand(...(type==='comeback'?g.comebackDurationSeconds:g.scenarioDurationSeconds))*1000;
 if(type==='breakaway'){r.baitChecked=false;r.frontSlowdownUntil=0;r.targetSpeed=r.boostSpeed;r.boostUntil=Infinity;}
 r.scenarioReadyAt=r.boostUntil+rand(...g.scenarioRacerCooldownSeconds)*1000;
 r.activeScenario=type;
 lastScenario=`${type} → ${r.name}`;
 if(raceAdmin&&g.debugMode&&g.debugLogEvents)console.debug('[Race scenario]',type,r.name);
 }
 lastScenario=`${type} → ${selected.map(r=>r.name).join(", ")}`;
 return type;
}
// Shared geometry for every avatar, including the tallest/widest sprite.
function baitGeometry(vw){
 const g=GAME_SETTINGS;
 const reach=Math.max(0,...racers.map(r=>Math.hypot(r.sprite.offsetHeight,r.sprite.offsetWidth)))+g.baitFallSafetyMarginPx;
 const turnDistance=Math.max(vw*g.baitTurnDistanceFraction,reach+vw*g.baitFallAdvanceFractionRange[1]);
 return {turnX:finishX-turnDistance,turnDistance};
}
// Read-only transition check; the monitor never rolls random numbers.
function baitOpportunity(field,vw,elapsed,progress,pace,baitUsed){
 const g=GAME_SETTINGS;
 if(committedBreakaways.length>1)return {pool:[],reason:"Group breakaway — bait disabled"};
 const committedBreakaway=committedBreakaways[0], leader=field.find(({r})=>r===committedBreakaway), second=field.find(entry=>entry!==leader);
 if(baitUsed)return {pool:[],reason:'Committed to bait — '+(field.find(({r})=>r.baitPhase)?.r.name || 'attempt completed')};
 if(placements.length)return {pool:[],reason:'Race finishing'};
 if(!leader||!second)return {pool:[],reason:committedBreakaway?'Committed: '+committedBreakaway.name+' — attempt ended':'Waiting for committed breakaway'};
 const r=leader.r, distance=finishX-leader.x, lead=leader.x-second.x;
 const {turnDistance}=baitGeometry(vw);
 const approachWindow=pace*g.maximumSpeed*g.maxFrameMs;
 const required=Math.max(vw*g.baitMinimumLeadFraction,pace*1000*(g.baitTauntSeconds[1]+g.baitLeadSafetySeconds)*Math.max(1,second.r.relativeSpeed));
 const chance=lead<required?0:g.baitMinimumTransitionChance+(g.baitMaximumTransitionChance-g.baitMinimumTransitionChance)*Math.min(1,Math.max(0,(lead/required-1)/Math.max(0.000001,g.baitMaximumChanceLeadMultiplier-1)));
 const detail=`${r.name} | bait ${Math.round(chance*100)}% | finish ${Math.round(distance)}px | lead ${Math.round(lead)}px / ${Math.round(required)}px required`;
 const reason=r.activeScenario!=='breakaway'||elapsed>=r.boostUntil?'Waiting for active breakaway leader':r.baitChecked?'Opportunity already rolled':distance<turnDistance?'Missed taunt position':distance>turnDistance+approachWindow||finishX-camera>vw?'Approaching finish':leader!==field[0]?'Committed racer not leading':lead<required?'Lead too small':null;
 return {pool:reason?[]:[leader],chance,reason:`${reason||'Eligible'} — ${detail}`};
}
let committedBreakaways=[];
let breakawayRolled=false;
let lastScenario='None yet';
let debugWindow, debugReadout, debugElapsed=0, debugActiveMode='random';
let monitorState=null;
function updateDebugReadout(mode,elapsed){
 debugElapsed=elapsed;
 if(!debugWindow || debugWindow.closed || !debugReadout)return;
 const m=monitorState;
 const opportunities=running&&m?scenarioOpportunities(fieldSnapshot(),m.vw,elapsed,m.progress,m.comebackStart,m.baitUsed):null;
 if(opportunities)opportunities.bait=baitOpportunity(fieldSnapshot(),m.vw,elapsed,m.progress,m.pace,m.baitUsed);
 const lines=opportunities?Object.entries(opportunities).map(([type,{pool,reason}])=>`${type}: ${reason}${pool.length?' — '+pool.map(({r})=>r.name).join(', '):''}`).join('\n'):'Start a race to see opportunities.';
 debugReadout.textContent=`${running?'Running':'Idle'} | Last event: ${lastScenario}\nElapsed: ${(elapsed/1000).toFixed(1)}s${running&&m?` | Next check: ${Math.max(0,(m.nextScenario-elapsed)/1000).toFixed(1)}s`:''}\n\nBREAKAWAY: ${committedBreakaways.map(r=>r.name).join(', ') || (breakawayRolled?'Roll unsuccessful':'Not selected')}\n\nPOSSIBLE SCENARIOS (not guaranteed)\n${lines}\n\nRACERS\n`+racers.map(r=>`${r.name}: ${r.finished?'Finished':`${(r.relativeSpeed??1).toFixed(2)}× | stamina ${Math.round(r.stamina??GAME_SETTINGS.staminaMaximum)}%${r.baitPhase?' | bait: '+r.baitPhase:elapsed<r.boostUntil?' | '+r.activeScenario:elapsed<r.frontSlowdownUntil?' | easing off':''}`}`).join('\n');
}
function openDebugWindow(){
 if(!raceAdmin)return;
 if(debugWindow&&!debugWindow.closed){debugWindow.focus();return;}
 const g=GAME_SETTINGS;
 debugWindow=window.open('','GundamRaceDebug',`popup,width=${g.debugWindowWidthPx},height=${g.debugWindowHeightPx}`);
 if(!debugWindow){alert('Please allow popups for this site to open race debugging.');return;}
 const d=debugWindow.document;
 d.title='Gundam Race — Debug';
 d.body.replaceChildren();
 Object.assign(d.body.style,{fontFamily:'system-ui, sans-serif',padding:'16px',margin:'0',background:'#eaf1fa',color:'#14243c'});
 const heading=d.createElement('h2');heading.textContent='Race debug';
 debugReadout=d.createElement('pre');Object.assign(debugReadout.style,{whiteSpace:'pre-wrap',fontSize:'13px',lineHeight:'1.6'});
 d.body.append(heading,debugReadout);
 updateDebugReadout(debugActiveMode,debugElapsed);
 debugWindow.focus();
}
function start(){
 if(running)return;
 updateEligibleRacers();if(racers.length<2)return;
 const input=$('duration'), seconds=Number(input.value);
 if(!Number.isFinite(seconds)||seconds<1||seconds>3600){input.setCustomValidity('Enter a duration between 1 and 3600 seconds.');input.reportValidity();return;}
 input.setCustomValidity('');activeDurationMs=seconds*1000;
 randomBackground();clearLivePlacements();placements=[];resultsAutoOpened=false;render();updateRaceTimer(0);
 running=true;setStartButton(true);$('reset').disabled=true;$('edit').disabled=true;$('overlay').style.display='none';
 const g=GAME_SETTINGS,vw=$('race').clientWidth,duration=activeDurationMs;
 const cameraEnd=Math.max(0,finishX-vw*g.finishLineScreenFraction);
 const nominalCameraDistance=Math.max(1,finishX-vw*g.nominalFinishScreenFraction);
 const pace=nominalCameraDistance/duration;
 const speedScale=clamp(Math.sqrt(g.speedReferenceDurationSeconds/seconds),...g.durationSpeedScaleRange);
 const mode='random';
 const comebackStart=g.scenarioStartFractions.comeback;
 let baitUsed=false;
 let nextScenario=Math.min(g.scenarioOpeningSeconds*1000,duration*0.35);
 committedBreakaways=[];breakawayRolled=false;
 lastScenario='None yet';
 monitorState={vw,progress:0,comebackStart,baitUsed,nextScenario,pace};
 let nextReadout=0;
 let elapsed=0,previous=performance.now();
 racers.forEach(r=>{
  r.stamina=g.staminaMaximum;r.relativeSpeed=1;r.targetSpeed=rand(...g.openingSpeedRange);
  r.nextDecision=Math.min(g.openingSeconds*1000,duration*0.2)+rand(0,g.decisionSeconds[0]*1000);
  r.boostUntil=0;r.scenarioReadyAt=0;r.boostSpeed=1;r.activeScenario=null;r.baitChecked=false;
  r.frontSlowdownThreshold=rand(...g.frontSlowdownThresholdRange);r.frontSlowdownUntil=0;r.frontSlowdownTarget=1;animateRunner(r,previous);
 });
 updateDebugReadout(mode,0);
 function tick(now){
  if(!running)return;
  const dt=clamp(now-previous,0,g.maxFrameMs);previous=now;elapsed+=dt;
  const oldCamera=camera;camera=placements.length?oldCamera:Math.min(cameraEnd,pace*elapsed);
  const progress=clamp(camera/nominalCameraDistance,0,1);
  const field=fieldSnapshot();
  if(elapsed>=nextScenario && field.length>1 && !placements.length){
   const opportunities=scenarioOpportunities(field,vw,elapsed,progress,comebackStart,baitUsed);
   let activated=false;
   if(!breakawayRolled && opportunities.breakaway.pool.length){
    breakawayRolled=true;
    if(Math.random()<g.breakawayActivationChance){runScenario(opportunities,elapsed,progress,"breakaway");activated=true;}
   }
   if(!activated && Math.random()<g.scenarioChance){
    delete opportunities.breakaway;
    runScenario(opportunities,elapsed,progress);
   }
   nextScenario=elapsed+rand(...g.scenarioCheckSeconds)*1000;
  }
  monitorState={vw,progress,comebackStart,baitUsed,nextScenario,pace};
  const bait=baitOpportunity(field,vw,elapsed,progress,pace,baitUsed);
  if(bait.pool.length){
   const r=bait.pool[0].r;r.baitChecked=true;
   if(Math.random()<bait.chance){
    baitUsed=true;r.baitPhase='approach';r.baitWillFall=Math.random()<g.baitFallChance;
    r.baitTurnX=baitGeometry(vw).turnX;
    r.baitFallX=r.baitTurnX+vw*rand(...g.baitFallAdvanceFractionRange);
    r.targetSpeed=r.boostSpeed;
    r.activeScenario='bait';r.boostUntil=Infinity;r.boostSpeed=1;
    lastScenario=`breakaway → bait → ${r.name}`;
    if(raceAdmin&&g.debugMode&&g.debugLogEvents)console.debug('[Race scenario]',lastScenario);
   }
  }
  const crossed=[];
  for(const {r} of field){
   if(r.activeScenario==='breakaway' && elapsed<r.boostUntil){
    if(!g.breakawayIgnoreExhaustion && r.stamina<=g.breakawayExhaustionStamina){r.boostUntil=elapsed;r.targetSpeed=rand(...g.speedRanges[0]);}
   }
   if(committedBreakaways.length===1 && r===committedBreakaways[0] && r.activeScenario==='breakaway' && r.baitChecked){r.boostUntil=elapsed;r.activeScenario=null;}
   if(!(r.activeScenario==='breakaway'&&elapsed<r.boostUntil) && elapsed>=r.nextDecision)decideSpeed(r,field,vw,elapsed);
   if(r.activeScenario==='comeback' && elapsed<r.boostUntil && field.some(({r: other})=>other!==r && other.baitPhase) && field[0].x-r.x<=vw*g.comebackLeadingGapFraction){r.boostUntil=elapsed;r.targetSpeed=rand(...g.speedRanges[1]);}
   if(r.baitPhase==='approach' && r.x>=r.baitTurnX){
     r.baitPhase='taunt';r.baitUntil=elapsed+rand(...g.baitTauntSeconds)*1000;r.relativeSpeed=0;
   }
   if(r.baitPhase==='taunt' && elapsed>=r.baitUntil)r.baitPhase='cross';
   if(r.baitPhase==='fallen' && elapsed>=r.baitUntil){r.baitPhase=null;r.boostUntil=elapsed;r.sprite.style.transformOrigin='';}
   let target=elapsed<r.boostUntil && r.baitPhase!=='approach'?Math.max(r.targetSpeed,r.boostSpeed):r.targetSpeed;
   if(!r.baitPhase && elapsed>=r.boostUntil && elapsed<r.frontSlowdownUntil)target=Math.min(target,r.frontSlowdownTarget);
   // Exhaustion limits sustained sprinting, but a lucky boost can still help.
   if(r.stamina<g.staminaLow && elapsed>=r.boostUntil){
    const cap=g.exhaustedSpeed+(g.maximumSpeed-g.exhaustedSpeed)*r.stamina/g.staminaLow;
    target=Math.min(target,cap);
   }
   // Soft screen bounds only while the camera moves. No rank or finish manipulation.
   if(camera<cameraEnd && !r.baitPhase){
    const sx=r.x-oldCamera;
    const front=clamp((sx/vw-g.frontSoftFraction)/(g.frontHardFraction-g.frontSoftFraction),0,1);
    const rear=clamp((g.rearSoftFraction-sx/vw)/(g.rearSoftFraction-g.rearHardFraction),0,1);
    const relax=clamp((1-progress)/g.finishRelaxFraction,0,1);
    const frontLimit=r.activeScenario==='breakaway' && elapsed<r.boostUntil?0:front*relax;
    if(target>1)target=1+(target-1)*(1-frontLimit);
    target=Math.min(target, g.maximumSpeed+(g.frontRecoverySpeed-g.maximumSpeed)*frontLimit);
    if(target<1)target=1+(target-1)*(1-rear);
   }
   if(!r.baitPhase || r.baitPhase==='approach')target=1+(target-1)*speedScale;
   // Bait approach preserves ordinary racing speed; no manufactured lead.
   if(r.baitPhase==='cross')target=g.baitBackwardSpeed;
   const holding=['taunt','falling','fallen'].includes(r.baitPhase);
   target=holding?0:clamp(target,g.minimumSpeed,g.maximumSpeed);
   // Only constrain an individual who risks crossing before the selected time.
   if(elapsed<duration && !holding){
    const remaining=duration-elapsed;
    const distance=finishX-r.x;
    const buffer=vw*g.earlyFinishBufferFraction;
    const horizon=Math.max(remaining,g.earlyFinishResponseSeconds*1000);
    if(distance<pace*target*horizon+buffer){
     target=Math.min(target,Math.max(0,(distance-buffer)/Math.max(pace*horizon,Number.EPSILON)));
    }
   }
   r.relativeSpeed+=(target-r.relativeSpeed)*(1-Math.exp(-dt/(g.speedResponseSeconds*1000)));
   const delta=r.relativeSpeed-g.staminaNeutralSpeed;
   r.stamina=clamp(r.stamina-delta*(delta>0?g.staminaDrainPerSecond:g.staminaRecoveryPerSecond)*dt/1000,0,g.staminaMaximum);
   if(holding)r.relativeSpeed=0;
   const oldX=r.x;let nextX=oldX+r.relativeSpeed*pace*dt;
   if(elapsed<duration)nextX=Math.min(nextX,finishX-vw*g.earlyFinishBufferFraction);
   if(r.baitPhase==='approach')nextX=Math.min(nextX,r.baitTurnX);
   if(r.baitPhase==='cross' && r.baitWillFall && nextX>=r.baitFallX){
    nextX=r.baitFallX;r.baitPhase='falling';r.baitFallStart=elapsed;r.relativeSpeed=0;
   }
   let fallFraction=0;
   if(r.baitPhase==='falling'){
    fallFraction=clamp((elapsed-r.baitFallStart)/(g.baitFallSeconds*1000),0,1);
    if(fallFraction===1){r.baitPhase='fallen';r.baitUntil=elapsed+rand(...g.baitRecoverySeconds)*1000;}
   }else if(r.baitPhase==='fallen')fallFraction=1;
   r.x=Math.min(finishX,nextX);
   const backwards=['taunt','cross','falling','fallen'].includes(r.baitPhase);
   r.sprite.style.transformOrigin=fallFraction?'center bottom':'';
   r.sprite.style.transform=backwards?`rotate(${fallFraction*90}deg) scaleX(1)`:'scaleX(-1)';
   const crossingX=r.x;
   if(elapsed>=duration && crossingX>=finishX){
    r.finished=true;r.finishTime=Math.max(duration,elapsed-dt+dt*(finishX-oldX)/Math.max(Number.EPSILON,nextX-oldX));crossed.push(r);
   }
   r.node.style.transform=`translate(${r.x+(r.finished?g.finishStopOffsetPx:0)}px,${r.y}px)`;
   if(r.finished||holding||r.baitPhase==='falling')idleRunner(r);else animateRunner(r,now);
  }
  // Resolve crossings within a frame by interpolated crossing time, not roster order.
  crossed.sort((a,b)=>a.finishTime-b.finishTime).forEach(recordFinisher);
  updateRaceTimer(placements.length?placements[0].finishTime:elapsed);
  $('world').style.transform=`translateX(${-camera}px)`;
  $('scenery').querySelector('.track').style.setProperty('--road-offset',`${-camera}px`);
  $('scenery').querySelector('.fence').style.setProperty('--fence-offset',`${-camera}px`);
  updateRaceProgress(racers.some(r=>r.finished)?1:progress);
  if(elapsed>=nextReadout){updateDebugReadout(mode,elapsed);nextReadout=elapsed+g.debugReadoutIntervalMs;}
  if(racers.every(r=>r.finished)){endRace();return;}
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
  render();updateRaceTimer(0);
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
 $('raceNamesPanel').hidden=true;$('raceAvatarsPanel').hidden=true;$('setRaceAvatars').style.display='none';
 $('prepare').closest('.modalfooter').style.display='none';
 $('message').textContent=running?'Race continues in the background. Exclusions apply to the next race.':`${racers.length} eligible for the next race. Use the eligibility switches beside each finisher.`;
 if(!resetScroll)list.scrollTop=previousScroll;
 $('overlay').style.display='flex';
}
function hideModal(){$('overlay').style.display='none'}
$('closeModal').onclick=hideModal;
function edit(){
 if(running)return;
 setAvatarPickerOpen(false);
 $('raceNamesPanel').hidden=false;$('raceAvatarsPanel').hidden=true;$('setRaceAvatars').style.display='';
 $('modalTitle').textContent='Enter up to 100 Names';$('clearNames').style.display='';$('names').style.display='';$('namesCount').style.display='';
 $('prepare').closest('.modalfooter').style.display='';$('results')?.remove();$('prepare').disabled=false;$('prepare').textContent='🏁 Prepare Race';$('prepare').onclick=prepare;
 $('message').textContent='';$('overlay').style.display='flex';updateCount();
}
function currentNames(){return $('names').value.split(/\r?\n/).map(s=>s.trim()).filter(Boolean).slice(0,100).map(s=>s.slice(0,40))}
function syncAvatarAssignments(){
 const available=new Map();
 for(const item of avatarAssignments){if(!available.has(item.name))available.set(item.name,[]);available.get(item.name).push(item)}
 avatarAssignments=currentNames().map(name=>{const previous=available.get(name)?.shift();return previous||{name,avatar:assignAvatar()}});
 // If the CSV arrived after names were entered, fill previously unassigned avatars.
 for(const item of avatarAssignments)if(!item.avatar)item.avatar=assignAvatar();
}
function avatarThumbnail(id){
 const img=document.createElement('img');img.alt='';img.loading='lazy';
 if(!id)return img;
 img.src=path(id)+'.webp';
 img.onerror=()=>{if(!img.dataset.fallback){img.dataset.fallback='1';img.src=path(id)+'.png'}else img.style.visibility='hidden'};
 return img;
}
function renderAvatarPlayers(){
 const list=$('raceAvatarPlayers');list.replaceChildren();
 avatarAssignments.forEach((item,index)=>{
  const row=document.createElement('div');row.className='race-avatar-player';
  const name=document.createElement('span');name.textContent=item.name;
  const choose=document.createElement('button');choose.type='button';choose.className='race-avatar-current';
  choose.append(avatarThumbnail(item.avatar));
  choose.setAttribute('aria-label','Change avatar for '+item.name);
  choose.dataset.playerIndex=index;
  choose.onclick=()=>{selectedAvatarIndex=index;avatarCategory=item.avatar?.split('/')[0]||'Pilots';renderAvatarGrid();setAvatarPickerOpen(true);$('backToAvatarPlayers').focus();};
  const random=document.createElement('button');random.type='button';random.textContent='🎲';random.title='Random avatar';random.setAttribute('aria-label','Randomise avatar for '+item.name);
  random.onclick=()=>{item.avatar=assignAvatar();renderAvatarPlayers();if(selectedAvatarIndex===index)renderAvatarGrid()};
  row.append(name,choose,random);list.append(row);
 });
}
function renderAvatarGrid(){
 const grid=$('raceAvatarGrid');grid.replaceChildren();
 const current=avatarAssignments[selectedAvatarIndex];
 $('modalTitle').textContent='Choose Avatar for '+(current?.name||'Player');
 document.querySelectorAll('[data-race-category]').forEach(btn=>{const active=btn.dataset.raceCategory===avatarCategory;btn.classList.toggle('active',active);btn.setAttribute('aria-pressed',String(active))});
 for(const id of avatars.filter(a=>a.startsWith(avatarCategory+'/'))){
  const button=document.createElement('button');button.type='button';button.className='race-avatar-option';
  button.classList.toggle('selected',current?.avatar===id);button.setAttribute('aria-pressed',String(current?.avatar===id));
  button.setAttribute('aria-label',id.split('/')[1]);button.append(avatarThumbnail(id));
  button.onclick=()=>{if(!current)return;current.avatar=id;closeAvatarPicker();};grid.append(button);
 }
 if(!grid.children.length)grid.textContent='No avatars available in this category.';
}
function setAvatarPickerOpen(open){
 $('modal').classList.toggle('avatar-picker-open',open);
 $('raceAvatarPicker').hidden=!open;
 $('prepare').closest('.modalfooter').style.display=open?'none':'';
}
function closeAvatarPicker(){
 const index=selectedAvatarIndex;
 setAvatarPickerOpen(false);$('modalTitle').textContent='Set Avatars';
 selectedAvatarIndex=-1;renderAvatarPlayers();
 $('raceAvatarPlayers').querySelector('[data-player-index="'+index+'"]')?.focus();
}
function showAvatarSetup(){
 setAvatarPickerOpen(false);
 syncAvatarAssignments();$('raceNamesPanel').hidden=true;$('raceAvatarsPanel').hidden=false;
 $('modalTitle').textContent='Set Avatars';$('clearNames').style.display='none';$('namesCount').style.display='';
 $('setRaceAvatars').style.display='none';$('prepare').closest('.modalfooter').style.display='';
 $('raceAvatarPicker').hidden=true;selectedAvatarIndex=-1;renderAvatarPlayers();
 $('message').textContent='';
}
function updateCount(){syncAvatarAssignments();$('namesCount').textContent=`Names: ${avatarAssignments.length} / 100`}
$('setRaceAvatars').onclick=showAvatarSetup;
$('backToNames').onclick=edit;
$('backToAvatarPlayers').onclick=closeAvatarPicker;
$('randomiseAll').onclick=()=>{avatarAssignments.forEach(item=>item.avatar=assignAvatar());renderAvatarPlayers();if(selectedAvatarIndex>=0)renderAvatarGrid()};
document.querySelectorAll('[data-race-category]').forEach(btn=>btn.onclick=()=>{avatarCategory=btn.dataset.raceCategory;renderAvatarGrid()});
$('names').addEventListener('input',updateCount);$('clearNames').onclick=()=>{$('names').value='';updateCount()};
$('prepare').onclick=prepare;$('start').onclick=()=>running?stopRace():start();$('edit').onclick=edit;
$('reset').onclick=()=>{if(running)return;placements=[];clearLivePlacements();render();updateRaceTimer(0);$('status').textContent='Ready for another race'};
$('placements').onclick=()=>{if(placements.length)showPlacements()};
window.addEventListener('resize',()=>{if(!running&&racers.length)render()});
// Initialise the race independently of optional toolbar controls.
$("duration").addEventListener("input",()=>{if(!running)updateRaceTimer(0);});
updateRaceTimer(0);
loadProgressIcon();updateRaceProgress(0);preloadScenery();randomBackground();loadAvatars();updateCount();
// Live name-size control; no changes to race progress or racer state.
const nameSizeInput=$('nameSize');
if(nameSizeInput && $('nameSizeValue')){
nameSizeInput.min=GAME_SETTINGS.nameSizeRangePx[0];
nameSizeInput.max=GAME_SETTINGS.nameSizeRangePx[1];
nameSizeInput.step=GAME_SETTINGS.nameSizeStepPx;
let savedNameSize=visualSetting('--name-size');
try{
 const saved=localStorage.getItem(GAME_SETTINGS.nameSizePreferenceKey);
 if(saved!==null && saved.trim()!=='' && Number.isFinite(Number(saved))) savedNameSize=Number(saved);
}catch(_){}
nameSizeInput.value=Math.min(GAME_SETTINGS.nameSizeRangePx[1],Math.max(GAME_SETTINGS.nameSizeRangePx[0],savedNameSize));
function updateNameSize(){
 document.documentElement.style.setProperty('--name-size',`${nameSizeInput.value}px`);
 $('nameSizeValue').textContent=`${nameSizeInput.value}px`;
}
nameSizeInput.addEventListener('input',()=>{
 updateNameSize();
 try{localStorage.setItem(GAME_SETTINGS.nameSizePreferenceKey,nameSizeInput.value);}catch(_){}
});
updateNameSize();
}

// Timer visibility is independent of authentication and race state.
const timerToggle=$('showTimer'), timerDisplay=$('raceTimer');
if(timerToggle && timerDisplay){
 let visible=GAME_SETTINGS.showTimerByDefault;
 try{const saved=localStorage.getItem(GAME_SETTINGS.timerPreferenceKey);if(saved!==null)visible=saved==='true';}catch(_){}
 timerToggle.checked=visible;timerDisplay.hidden=!visible;
 timerToggle.addEventListener('change',()=>{
  timerDisplay.hidden=!timerToggle.checked;
  try{localStorage.setItem(GAME_SETTINGS.timerPreferenceKey,String(timerToggle.checked));}catch(_){}
 });
}

// Read-only debug monitor; fail closed unless the existing admin RPC approves.
let raceAdmin=false;
const debugControls=$('debugControls');
debugControls.hidden=true;
if(GAME_SETTINGS.debugMode){
 const debugButton=document.createElement('button');debugButton.type='button';debugButton.textContent='Debug';debugButton.hidden=true;debugButton.onclick=openDebugWindow;
 debugControls.after(debugButton);
 const url=window.GCG_SUPABASE_URL,key=window.GCG_SUPABASE_PUBLISHABLE_KEY;
 if(window.supabase && url && key && /^https:\/\/.+\.supabase\.co\/?$/.test(url) && !key.startsWith('PASTE_')){
  try {
  const client=window.supabase.createClient(url,key);
  let checkNumber=0;
  async function updateAdmin(){
   const current=++checkNumber;
   raceAdmin=false;debugButton.hidden=true;
   try{
    const {data:{user},error}=await client.auth.getUser();
    if(error||!user||current!==checkNumber)return;
    const {data:allowed,error:roleError}=await client.rpc('gcg_is_admin');
    if(current!==checkNumber)return;
    raceAdmin=!roleError&&allowed===true;
    debugButton.hidden=!raceAdmin;
   }catch(_){ /* Keep debug hidden on authentication failure. */ }
   finally{if(current===checkNumber&&!raceAdmin&&debugWindow&&!debugWindow.closed)debugWindow.close();}
  }
  client.auth.onAuthStateChange(()=>setTimeout(updateAdmin,0));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)updateAdmin();});
  updateAdmin();
  } catch(error){console.warn('Race admin authentication unavailable',error);}
 }
 window.addEventListener('pagehide',()=>{if(debugWindow&&!debugWindow.closed)debugWindow.close();});
}


