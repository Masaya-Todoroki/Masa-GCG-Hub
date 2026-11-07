(()=>{
    'use strict';const $=id=>document.getElementById(id),url=window.GCG_SUPABASE_URL,key=window.GCG_SUPABASE_PUBLISHABLE_KEY;const valid=window.supabase&&/^https:\/\/.+\.supabase\.co\/?$/.test(url||'')&&key&&!key.startsWith('PASTE_');let client,admin=false,me=null,nickname=localStorage.getItem('gcg_chat_nickname')||'',lastSend=0,channel=null;const feedback=(s)=>$('chat-feedback').textContent=s;function videoId(raw){
        try{
            const u=new URL(raw);const host=u.hostname.toLowerCase().replace(/^www\./,'');let id='';if(host==='youtu.be')id=u.pathname.slice(1).split('/')[0];else if(['youtube.com','m.youtube.com','music.youtube.com','youtube-nocookie.com'].includes(host)){
                if(u.pathname==='/watch'||u.pathname==='/live')id=u.pathname==='/watch'?u.searchParams.get('v'):u.pathname.split('/')[2];else if(u.pathname.startsWith('/shorts/')||u.pathname.startsWith('/embed/'))id=u.pathname.split('/')[2]
            }
            return /^[\w-]{11}$/.test(id||'')?id:null
        }
        catch{
            return null
        }
    }
    function showStream(s){
        const id=s&&s.video_id;const validId=/^[\w-]{11}$/.test(id||'');$('video').hidden=!validId;$('empty-video').hidden=!!validId;if(validId&&$('video').dataset.id!==id){
            $('video').src='https://www.youtube-nocookie.com/embed/'+encodeURIComponent(id)+'?rel=0';$('video').dataset.id=id
        }
        if(!validId){
            $('video').removeAttribute('src');delete $('video').dataset.id
        }
        $('youtube-link').hidden=!validId;if(validId)$('youtube-link').href='https://www.youtube.com/watch?v='+encodeURIComponent(id);$('stream-status').textContent=s?.is_live?'● LIVE':'FEATURED VIDEO';$('stream-status').classList.toggle('live',!!s?.is_live);if(admin){
            $('stream-url').value=validId?'https://www.youtube.com/watch?v='+id:'';$('stream-live').checked=!!s?.is_live
        }
    }
    async function loadStream(){
        const {
            data,error
        }
        =await client.from('gcg_stream_settings').select('video_id,title,description,is_live').eq('id',1).maybeSingle();if(error){
            $('admin-feedback').textContent='Stream settings unavailable. Run STREAMS_SETUP.sql first.';return
        }
        showStream(data)
    }
    // Avatar profile v13: CSV-backed local customiser; no database migration required.
    const PROFILE_VERSION = 'gcg_chat_profile_v1';
    const PROFILE_COLORS = ['#FFFFFF','#FFCE70','#FF8B9B','#BDA4FF','#72E6CB','#8BCBFF','#FFE681','#FFA775'];
    let avatarList = {Pilots:[],Units:[]};
    let avatarCategory = 'Pilots';
    let selectedAvatar = '';
    let nameColor = '#FFFFFF';
    let draftAvatar = '';
    let draftColor = '#FFFFFF';
    const profileKey = () => me?.id ? PROFILE_VERSION + ':' + me.id : PROFILE_VERSION;
    function avatarUrl(id) {
        const [category,filename] = (id||'').split('/');
        if (!['Pilots','Units'].includes(category) || !/^[a-z0-9_ ()-]+$/i.test(filename||'')) return '';
        return 'images/Avatars/'+category+'/'+encodeURIComponent(filename);
    }
    function imageWithFallback(img,id) {
        const base = avatarUrl(id);
        if (!base) {img.hidden=true;img.removeAttribute('src');return;}
        img.hidden=false;
        let ext=0;
        img.onerror=()=>{if(ext===0){ext++;img.src=base+'.webp';}else{img.hidden=true;}};
        img.src=base+'.png';
    }
    // Optional horizontal walking sheet of 128x128 frames: <avatar>_Spritesheet.webp.
    // Sheets are only shown while walking; the normal portrait remains the idle image.
    function loadWalkerSpritesheet(walker,id){
        const base=avatarUrl(id);
        walker.spriteReady=false;
        walker.spriteFrameCount=0;
        walker.spriteFrame=-1;
        walker.sprite.style.display='none';
        walker.img.style.visibility='visible';
        walker.spriteToken=(walker.spriteToken||0)+1;
        const token=walker.spriteToken;
        if(!base)return;
        const probe=new Image();
        probe.onload=()=>{
            if(token!==walker.spriteToken)return;
            // Each frame is 128x128. Reject malformed sheets and use the idle image.
            if(probe.naturalHeight!==128 || probe.naturalWidth<128 || probe.naturalWidth%128!==0)return;
            walker.spriteFrameCount=probe.naturalWidth/128;
            walker.sprite.style.backgroundSize=(walker.spriteFrameCount*100)+'% 100%';
            walker.sprite.style.backgroundImage='url("'+probe.src.replace(/"/g,'%22')+'")';
            walker.spriteReady=true;
        };
        probe.onerror=()=>{if(token===walker.spriteToken)walker.spriteReady=false;};
        probe.src=base+'_Spritesheet.webp';
    }
    function updateWalkerVisual(walker,now){
        const walking=walker.spriteReady && Math.abs(walker.velocity)>0.01;
        walker.sprite.style.display=walking?'block':'none';
        walker.img.style.visibility=walking?'hidden':'visible';
        if(walking){
            // At 8 fps, loop through however many 128px frames the image contains.
            const frame=Math.floor(now/125)%walker.spriteFrameCount;
            if(walker.spriteFrame!==frame){
                walker.sprite.style.backgroundPosition=(walker.spriteFrameCount>1?frame/(walker.spriteFrameCount-1)*100:0)+'% 0';
                walker.spriteFrame=frame;
            }
        }
        const flip=walker.velocity>0?'scaleX(-1)':'scaleX(1)';
        walker.img.style.transform=flip;
        walker.sprite.style.transform=flip;
    }
    function applyProfile() {
        const identity=$('identity-avatar');
        imageWithFallback(identity,selectedAvatar);
        $('nickname-display').style.color=nameColor;
    }
    function restoreProfile() {
        try {
            const p=JSON.parse(localStorage.getItem(profileKey())||'{}');
            if (typeof p.avatar==='string') selectedAvatar=p.avatar;
            if (PROFILE_COLORS.includes(p.color)) nameColor=p.color;
        } catch(_) {}
        applyProfile();
    }
    async function loadAvatars() {
        try {
            const response=await fetch('data/Avatars.csv',{cache:'no-cache'});
            if(!response.ok) throw new Error('HTTP '+response.status);
            const csv=(await response.text()).replace(/^\uFEFF/,'').trim().split(/\r?\n/);
            const headers=csv.shift().split(',').map(x=>x.trim());
            const columns={Units:headers.indexOf('Units'),Pilots:headers.indexOf('Pilots')};
            avatarList={Pilots:[],Units:[]};
            for(const row of csv) {
                const values=row.split(',');
                for(const category of ['Pilots','Units']){
                    const value=values[columns[category]]?.trim();
                    if(value && /^[a-z0-9_ ()-]+$/i.test(value)) avatarList[category].push(value);
                }
            }
            $('avatar-feedback').textContent='';
        } catch(e) {
            $('avatar-feedback').textContent='Avatar list unavailable. Upload data/Avatars.csv to your site.';
        }
        renderAvatarGrid();
    }
    function avatarDisplayName(id) {
        return id; // Display the exact value supplied in Avatars.csv.
    }
    function renderAvatarGrid(){
        const grid=$('avatar-grid');
        grid.replaceChildren();
        for(const filename of avatarList[avatarCategory]){
            const id=avatarCategory+'/'+filename;
            const btn=document.createElement('button');
            btn.type='button';btn.className='avatar-option';
            btn.classList.toggle('selected',draftAvatar===id);
            btn.setAttribute('aria-pressed',String(draftAvatar===id));
            const img=document.createElement('img');
            img.alt='';img.loading='lazy';
            imageWithFallback(img,id);
            const label=document.createElement('span');label.textContent=avatarDisplayName(filename);
            btn.append(img,label);
            btn.addEventListener('click',()=>{
                draftAvatar=id;
                renderAvatarGrid();
                updateProfilePreview();
            });
            grid.append(btn);
        }
        if(!grid.children.length){
            const empty=document.createElement('p');
            empty.className='avatar-empty';empty.textContent='No avatars in this category yet.';
            grid.append(empty);
        }
    }
    function updateProfilePreview(){
        $('profile-preview-name').textContent=$('nickname-input').value.trim()||'Your name';
        $('profile-preview-name').style.color=draftColor;
        imageWithFallback($('profile-preview-avatar'),draftAvatar);
        for(const button of $('profile-colors').children){
            button.classList.toggle('selected',button.dataset.color===draftColor);
            button.setAttribute('aria-pressed',String(button.dataset.color===draftColor));
        }
    }
    function initProfileEditor(){
        for(const color of PROFILE_COLORS){
            const button=document.createElement('button');
            button.type='button';button.className='profile-color';
            button.style.setProperty('background-color',color,'important');button.dataset.color=color;
            button.setAttribute('aria-label','Select '+color+' name colour');
            button.addEventListener('click',()=>{draftColor=color;updateProfilePreview();});
            $('profile-colors').append(button);
        }
        document.querySelectorAll('[data-avatar-category]').forEach(button=>{
            button.addEventListener('click',()=>{
                avatarCategory=button.dataset.avatarCategory;
                document.querySelectorAll('[data-avatar-category]').forEach(b=>{
                    b.classList.toggle('active',b===button);
                    b.setAttribute('aria-pressed',String(b===button));
                });
                renderAvatarGrid();
            });
        });
        $('nickname-input').addEventListener('input',updateProfilePreview);
        loadAvatars();
    }
    initProfileEditor();
    // AVATAR SETTINGS — edit these values to customise the overlay.
    const AVATAR_SETTINGS = {
        size: 0.125,       // Avatar width as a fraction of video height (0.125 = 12.5%).
        bottomOffset: 0,   // Pixels above the bottom of the video, at 450px video height.
        moveSpeed: 1,      // Multiplier for walking speed (1 = default).
        nameScale: 1       // Multiplier for name text size (1 = default).
    };
    // Viewer avatars: Presence synchronises profiles, but movement stays browser-local.
    const avatarLayer=$('stream-avatar-layer');
    const avatarToggle=$('avatars-toggle');
    let avatarPresence=null;
    const viewerSessionId = (window.crypto?.randomUUID?.() || ('viewer-'+Date.now()+'-'+Math.random().toString(36).slice(2)));
    const walkers=new Map();
    const activeNameColors=new Map();
    // All avatar dimensions and movement are based on the rendered video size.
    let avatarScale=1;
    let previousOverlayWidth=0;
    function resizeAvatarOverlay(){
        const h=avatarLayer.clientHeight;
        const w=avatarLayer.clientWidth;
        if(!h||!w)return;
        avatarScale=h/450;
        avatarLayer.style.setProperty('--walker-size',Math.round(h*AVATAR_SETTINGS.size*100)/100+'px');
        avatarLayer.style.setProperty('--walker-bottom',Math.round(AVATAR_SETTINGS.bottomOffset*avatarScale*100)/100+'px');
        avatarLayer.style.setProperty('--walker-font',Math.round(h*.027*AVATAR_SETTINGS.nameScale*100)/100+'px');
        for(const walker of walkers.values()){
            const limit=Math.max(0,w-walker.element.offsetWidth);
            // Preserve horizontal progress across normal/theatre/mobile resizing.
            // Normalised position is relative to the available walking range.
            if(previousOverlayWidth){
                const previousLimit=Math.max(0,previousOverlayWidth-(walker.previousElementWidth || walker.element.offsetWidth));
                const fraction=previousLimit>0?walker.x/previousLimit:0.5;
                walker.x=Math.max(0,Math.min(limit,fraction*limit));
            } else walker.x=Math.max(0,Math.min(limit,walker.x));
            walker.previousElementWidth=walker.element.offsetWidth;
            walker.element.style.transform='translate3d('+walker.x+'px,0,0)';
        }
        previousOverlayWidth=w;
    }
    if(window.ResizeObserver){new ResizeObserver(resizeAvatarOverlay).observe(avatarLayer.parentElement);}
    window.addEventListener('resize',resizeAvatarOverlay);
    requestAnimationFrame(resizeAvatarOverlay);

    let overlayEnabled=localStorage.getItem('gcg_overlay_visible')!=='false';
    const safeColor=c=>PROFILE_COLORS.includes(c)?c:'#FFFFFF';
    function setOverlayVisible(value){
        overlayEnabled=!!value;
        avatarLayer.hidden=!overlayEnabled;
        avatarToggle.setAttribute('aria-pressed',String(overlayEnabled));
        avatarToggle.textContent=overlayEnabled?'👾 Avatars: On':'👾 Avatars: Off';
        try{localStorage.setItem('gcg_overlay_visible',String(overlayEnabled));}catch(_){}
    }
    avatarToggle.addEventListener('click',()=>setOverlayVisible(!overlayEnabled));
    setOverlayVisible(overlayEnabled);
    // Presence represents a connected browser session only. Profile changes are
    // broadcast independently so rapid avatar swaps never untrack the viewer.
    function ownPresence(){return {session_id:viewerSessionId,connected_at:sessionStartedAt};}
    const sessionStartedAt=Date.now();
    const remoteProfiles=new Map();
    let profileBroadcastTimer=null;
    let profileBroadcastPending=false;
    function broadcastProfile(immediate=false){
        if(!avatarPresence || !me)return;
        profileBroadcastPending=true;
        clearTimeout(profileBroadcastTimer);
        profileBroadcastTimer=setTimeout(flushProfileBroadcast,immediate?0:250);
        updateOwnWalkerImmediately();
    }
    async function flushProfileBroadcast(){
        if(!profileBroadcastPending || !avatarPresence || !me)return;
        profileBroadcastPending=false;
        const profile={nickname:nickname||'',avatar:selectedAvatar||'',color:safeColor(nameColor),updated_at:Date.now()};
        try{
            const result=await avatarPresence.send({type:'broadcast',event:'profile-change',payload:{session_id:viewerSessionId,profile}});
            if(result && result!=='ok')throw new Error('Broadcast returned '+JSON.stringify(result));
        }catch(err){
            console.warn('Profile broadcast failed:',err);
            profileBroadcastPending=true;
            clearTimeout(profileBroadcastTimer);
            profileBroadcastTimer=setTimeout(flushProfileBroadcast,1200);
        }
    }
    function receiveRemoteProfile(payload){
        if(!payload || !payload.session_id || payload.session_id===viewerSessionId || !payload.profile)return;
        const previous=remoteProfiles.get(payload.session_id);
        if(previous && Number(previous.updated_at)>Number(payload.profile.updated_at))return;
        remoteProfiles.set(payload.session_id,payload.profile);
        syncAvatarPresence();
    }
    function requestRemoteProfiles(){
        if(!avatarPresence)return;
        avatarPresence.send({type:'broadcast',event:'profile-request',payload:{session_id:viewerSessionId}}).catch(err=>console.warn('Profile request:',err));
    }
    function refreshChatNameColors(){
        document.querySelectorAll('.msg-name').forEach(el=>{
            const color=activeNameColors.get(el.textContent.trim().toLowerCase());
            el.style.color=color || '';
        });
    }
    function syncAvatarPresence(){
        if(!avatarPresence)return;
        const state=avatarPresence.presenceState();
        // Only actual Supabase presence entries count; never fabricate a local
        // presence entry (which previously caused a misleading extra viewer).
        const connected=new Set(Object.entries(state)
            .filter(([,entries])=>Array.isArray(entries)&&entries.length)
            .map(([id])=>id));
        const countElement=$('viewer-count-number');
        if(countElement)countElement.textContent=String(connected.size);
        const seen=new Set();
        activeNameColors.clear();
        for(const id of connected){
            const profile=id===viewerSessionId
                ? {nickname:nickname||'',avatar:selectedAvatar||'',color:safeColor(nameColor)}
                : remoteProfiles.get(id);
            if(!profile || !profile.nickname || !avatarUrl(profile.avatar))continue;
            activeNameColors.set(String(profile.nickname).trim().toLowerCase(),safeColor(profile.color));
            seen.add(id);
            let walker=walkers.get(id);
            if(!walker){
                const element=document.createElement('div');element.className='stream-walker';
                const label=document.createElement('span');label.className='stream-walker-name';
                const img=document.createElement('img');img.className='stream-walker-image';img.alt='';
                const sprite=document.createElement('span');sprite.className='stream-walker-sprite';sprite.setAttribute('aria-hidden','true');
                element.append(label,img,sprite);avatarLayer.append(element);
                walker={element,label,img,sprite,spriteReady:false,spriteFrame:-1,x:Math.random()*Math.max(0,avatarLayer.clientWidth-avatarLayer.clientHeight*AVATAR_SETTINGS.size),velocity:0,pauseUntil:0,last:performance.now(),avatar:''};
                walkers.set(id,walker);resizeAvatarOverlay();
            }
            walker.label.textContent=String(profile.nickname).slice(0,24);
            walker.label.style.color=safeColor(profile.color);
            if(walker.avatar!==profile.avatar){walker.avatar=profile.avatar;imageWithFallback(walker.img,profile.avatar);loadWalkerSpritesheet(walker,profile.avatar);}
        }
        for(const [id,walker] of walkers){
            if(seen.has(id))continue;
            walker.element.remove();walkers.delete(id);
        }
        for(const id of remoteProfiles.keys())if(!connected.has(id))remoteProfiles.delete(id);
        refreshChatNameColors();
    }
    function updateOwnWalkerImmediately(){
        // Local selection is independent of the network echo.
        syncAvatarPresence();
    }
    function animateWalkers(now){
        if(overlayEnabled && !document.hidden && walkers.size){
            const width=avatarLayer.clientWidth;
            for(const walker of walkers.values()){
                const dt=Math.min((now-walker.last)/1000,.08);walker.last=now;
                const limit=Math.max(0,width-walker.element.offsetWidth);
                if(now>walker.pauseUntil && Math.random()<dt*.35){
                    walker.velocity=Math.random()<.2?0:(Math.random()<.5?-1:1)*(12+Math.random()*25)*avatarScale*AVATAR_SETTINGS.moveSpeed;
                    walker.pauseUntil=now+600+Math.random()*3000;
                }
                walker.x=Math.max(0,Math.min(limit,walker.x+walker.velocity*dt));
                if(walker.x===0 && walker.velocity<0)walker.velocity=Math.abs(walker.velocity);
                if(walker.x===limit && walker.velocity>0)walker.velocity=-Math.abs(walker.velocity);
                walker.element.style.transform='translate3d('+Math.round(walker.x)+'px,0,0)';
                updateWalkerVisual(walker,now);
            }
        } else for(const walker of walkers.values())walker.last=now;
        requestAnimationFrame(animateWalkers);
    }
    requestAnimationFrame(animateWalkers);
    function startAvatarPresence(){
        if(!client||!me)return;
        avatarPresence=client.channel('gcg-stream-avatar-presence',{config:{
            presence:{key:viewerSessionId},broadcast:{ack:true,self:false}
        }});
        avatarPresence.on('presence',{event:'sync'},syncAvatarPresence)
          .on('presence',{event:'join'},()=>{syncAvatarPresence();requestRemoteProfiles();})
          .on('presence',{event:'leave'},syncAvatarPresence)
          .on('broadcast',{event:'profile-change'},({payload})=>receiveRemoteProfile(payload))
          .on('broadcast',{event:'profile-request'},({payload})=>{
              if(payload?.session_id!==viewerSessionId)broadcastProfile(true);
          })
          .subscribe(async status=>{
              if(status==='SUBSCRIBED'){
                  try{await avatarPresence.track(ownPresence());}
                  catch(err){console.warn('Initial presence tracking failed:',err);}
                  syncAvatarPresence();broadcastProfile(true);requestRemoteProfiles();
              }else if(status==='CHANNEL_ERROR'||status==='TIMED_OUT')console.warn('Avatar presence connection:',status);
          });
        window.addEventListener('pagehide',()=>{avatarPresence?.untrack();});
    }
    function setNickname(){
        nickname=nickname.trim();$('nickname-display').textContent=nickname||'Choose a nickname';applyProfile();$('message-input').disabled=!nickname||!me;$('send-button').disabled=!nickname||!me
    }
    function promptNickname(){
        if(!$('nickname-dialog').open){
            $('nickname-input').value=nickname;draftAvatar=selectedAvatar;draftColor=nameColor;avatarCategory=selectedAvatar.startsWith('Units/')?'Units':'Pilots';document.querySelectorAll('[data-avatar-category]').forEach(b=>{const active=b.dataset.avatarCategory===avatarCategory;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});renderAvatarGrid();updateProfilePreview();$('nickname-error').textContent='';(()=>{const dialog=$('nickname-dialog');dialog.setAttribute('tabindex','-1');dialog.setAttribute('autofocus','');dialog.showModal();dialog.focus({preventScroll:true});})()
        }
    }
    function renderMessages(rows){
        const box=$('messages');box.replaceChildren();if(!rows?.length){
            const p=document.createElement('p');p.className='notice';p.textContent='No messages yet. Start the conversation!';box.append(p);return
        }
        for(const m of rows){
            const outer=document.createElement('div');outer.className='msg';const top=document.createElement('div');top.className='msg-top';const name=document.createElement('span');name.className='msg-name'+(m.is_admin?' admin':'');name.textContent=m.nickname;top.append(name);if(m.is_admin){
                const tag=document.createElement('span');tag.className='admin-tag';tag.textContent='ADMIN';top.append(tag)
            }
            const time=document.createElement('span');time.className='msg-time';time.textContent=new Date(m.created_at).toLocaleTimeString([],{
                hour:'2-digit',minute:'2-digit'
            }
            );top.append(time);if(admin){
                const del=document.createElement('button');del.className='delete-msg';del.textContent='✕';del.title='Delete message';del.addEventListener('click',async()=>{
                    if(!confirm('Delete this message?'))return;const {
                        error
                    }
                    =await client.rpc('gcg_delete_chat_message',{
                        p_id:m.id
                    }
                    );if(error)feedback(error.message);else await loadMessages()
                }
                );top.append(del)
            }
            const body=document.createElement('div');body.className='msg-body';
            const diceMatch=/^\[gcg-dice:d6:([1-6])\]$/.exec(m.message||'');
            const cardMatch=/^\[gcg-card:([A-Z0-9]+-\d{3})\]$/.exec(m.message||'');
            if(diceMatch){
                // Show a dice roll as one plain chat line, with the player's live name colour.
                // Keep timestamp and admin delete controls in the standard message header.
                name.remove();
                const die=document.createElement('span');die.textContent='🎲 ';
                const roller=document.createElement('span');roller.className='msg-name';roller.textContent=m.nickname;
                const result=document.createElement('span');result.textContent=` rolled a ${diceMatch[1]}!`;
                body.append(die,roller,result);
            }else if(cardMatch){
                name.remove();
                const card=cardById.get(cardMatch[1]);
                const prefix=document.createElement('span');prefix.textContent='🃏 ';
                const drawer=document.createElement('span');drawer.className='msg-name';drawer.textContent=m.nickname;
                const detail=document.createElement('span');detail.textContent=card?` drew ${card.name} (${card.id})!`:` drew ${cardMatch[1]}!`;
                body.append(prefix,drawer,detail);
            }else{renderChatBody(body,m.message)}
            outer.append(top,body);box.append(outer)
        }
        refreshChatNameColors();
        box.scrollTop=box.scrollHeight
    }
    async function loadMessages(){
        const {
            data,error
        }
        =await client.from('gcg_chat_messages').select('id,nickname,message,is_admin,created_at').order('created_at',{
            ascending:false
        }
        ).limit(100);if(error){
            $('messages').textContent='Chat unavailable. Run STREAMS_SETUP.sql and check Supabase settings.';return
        }
        renderMessages((data||[]).reverse())
    }

    // Emoji / GIF / custom emote picker. Never inject user text as HTML.
    let customEmojis = [], gifTimer = null, gifAbort = null, gifBlocked = false;
    const picker = $('chat-picker');
    function renderChatBody(target, message) {
        const gifMatch = /^:gif:([a-zA-Z0-9_-]{4,100}):$/.exec(message || '');
        if (gifMatch) {
            const img = document.createElement('img');
            img.className = 'msg-gif'; img.loading = 'lazy'; img.alt = 'GIF';
            img.src = 'https://media.giphy.com/media/' + encodeURIComponent(gifMatch[1]) + '/giphy.gif';
            target.append(img); return;
        }
        const codes = customEmojis.filter(e => /^:[a-z0-9_-]+:$/i.test(e.shortcode) && /^images\/emojis\/[a-zA-Z0-9_.-]+$/.test(e.image));
        if (!codes.length) { target.textContent = message; return; }
        const pattern = new RegExp('(' + codes.map(e => e.shortcode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'g');
        for (const part of String(message).split(pattern)) {
            const found = codes.find(e => e.shortcode === part);
            if (found) { const img = document.createElement('img'); img.className = 'inline-emote'; img.alt = found.name || part; img.title = part; img.src = found.image; target.append(img); }
            else target.append(document.createTextNode(part));
        }
    }
    function setPickerTab(tab) {
        for (const button of picker.querySelectorAll('[data-picker-tab]')) button.classList.toggle('active', button.dataset.pickerTab === tab);
        for (const name of ['emoji', 'gifs', 'custom']) $(name + '-panel').hidden = name !== tab;
        if (tab === 'gifs' && !$('gif-results').childElementCount && !gifBlocked) searchGifs('');
    }
    $('open-picker').addEventListener('click', () => { picker.hidden = !picker.hidden; if (!picker.hidden && $('emoji-panel').hidden) setPickerTab('emoji'); });
    $('close-picker').addEventListener('click', () => picker.hidden = true);
    // Dismiss the chat picker when clicking outside it (but not when toggling it).
    document.addEventListener('pointerdown', event => {
        if (!picker.hidden && !picker.contains(event.target) && !$('open-picker').contains(event.target)) {
            picker.hidden = true;
        }
    });
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && !picker.hidden) picker.hidden = true;
    });
    picker.querySelectorAll('[data-picker-tab]').forEach(b => b.addEventListener('click', () => setPickerTab(b.dataset.pickerTab)));
    // Lightweight native emoji picker: no third-party web component, database, or layout work on open.
    const emojiGroups = [
      ['Faces', '😀 😃 😄 😁 😆 😅 😂 🤣 🥲 😊 😇 🙂 🙃 😉 😌 😍 🥰 😘 😗 😙 😚 😋 😛 😝 😜 🤪 🤨 🧐 🤓 😎 🥸 🤩 🥳 😏 😒 😞 😔 😟 😕 🙁 ☹️ 😣 😖 😫 😩 🥺 😢 😭 😤 😠 😡 🤬 🤯 😳 🥵 🥶 😱 😨 😰 😥 😓 🤗 🤔 🫣 🤭 🫢 🤫 🤥 😶 😐 😑 😬 🙄 😯 😮 😲 🥱 😴 🤤 😪 😵 🤐 🥴 🤢 🤮 🤧 😷 🤒 🤕 🤑 🤠 😈 👿 👻 💀 ☠️ 👽 🤖 💩'],
      ['Hands', '👍 👎 👊 ✊ 🤛 🤜 👏 🙌 👐 🤲 🤝 🙏 ✌️ 🤞 🫰 🤟 🤘 👌 🤌 🤏 👈 👉 👆 👇 ☝️ ✋ 🤚 🖐️ 🖖 👋 🤙 💪 🦾 🖕 🫶 ❤️'],
      ['Hearts', '❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 ❤️‍🔥 ❤️‍🩹 💕 💞 💓 💗 💖 💘 💝 💟 ❣️ 💯 🔥 ✨ ⭐ 🌟 💫 🎉 🎊 💥 💢 💦 💨 💬 💤'],
      ['Animals', '🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐨 🐯 🦁 🐮 🐷 🐸 🐵 🐔 🐧 🐦 🦆 🦅 🦉 🦇 🐺 🐗 🐴 🦄 🐝 🦋 🐌 🐞 🐢 🐍 🦎 🐙 🦑 🦀 🐠 🐟 🐬 🦈 🐳 🐊 🦖 🦕'],
      ['Food', '🍎 🍏 🍊 🍋 🍌 🍉 🍇 🍓 🫐 🍒 🍑 🥭 🍍 🥥 🥝 🍅 🥑 🍆 🥦 🥬 🥒 🌶️ 🌽 🥕 🥔 🍞 🥐 🥨 🧀 🍖 🍗 🥩 🍔 🍟 🍕 🌭 🥪 🌮 🌯 🍜 🍣 🍙 🍚 🍛 🍰 🎂 🍪 🍩 🍫 🍬 🍭 ☕ 🍵 🧋 🍺'],
      ['Activities', '⚽ 🏀 🏈 ⚾ 🎾 🏐 🎱 🏓 🏸 🥊 🥋 🎮 🕹️ 🎲 ♟️ 🎯 🎨 🎭 🎬 🎤 🎧 🎼 🎹 🥁 🎸 🎺 🎻 🏆 🥇 🥈 🥉 🚀 🛸 🚗 🏎️ ✈️ 🌍 🌙 ☀️ 🌈 ⚡ ☄️'],
      ['Symbols', '✅ ❌ ❗ ❓ ‼️ ⁉️ ⭕ ❎ ✔️ ✖️ ➕ ➖ ➗ ♻️ ⚠️ 🚫 🔞 💢 💯 🆗 🆒 🆕 🆙 🆓 🔴 🟠 🟡 🟢 🔵 🟣 ⚫ ⚪ 🟤 🏳️ 🏴 🏁']
    ].map(([name, values]) => ({name, emojis: values.split(' ')}));
    let emojiCategory = 'Faces';
    const emojiGrid = $('emoji-grid'), emojiSearch = $('emoji-search');
    const categoryBar = $('emoji-categories');
    for (const group of emojiGroups) {
        const button = document.createElement('button'); button.type = 'button';
        button.textContent = group.name; button.dataset.category = group.name;
        button.addEventListener('click', () => { emojiCategory = group.name; emojiSearch.value = ''; renderEmojiGrid(); });
        categoryBar.append(button);
    }
    function renderEmojiGrid() {
        const term = emojiSearch.value.trim().toLowerCase();
        const selected = term ? emojiGroups : emojiGroups.filter(group => group.name === emojiCategory);
        const fragment = document.createDocumentFragment();
        for (const group of selected) {
            if (term && !group.name.toLowerCase().includes(term)) continue;
            for (const emoji of group.emojis) {
                const button = document.createElement('button'); button.type = 'button';
                button.className = 'emoji-choice'; button.textContent = emoji;
                button.setAttribute('aria-label', emoji); fragment.append(button);
            }
        }
        emojiGrid.replaceChildren(fragment);
        for (const button of categoryBar.children) button.classList.toggle('active', !term && button.dataset.category === emojiCategory);
    }
    emojiSearch.addEventListener('input', renderEmojiGrid);
    emojiGrid.addEventListener('click', event => {
        const button = event.target.closest('.emoji-choice'); if (!button) return;
        const input = $('message-input'); input.setRangeText(button.textContent, input.selectionStart, input.selectionEnd, 'end'); input.focus();
    });
    renderEmojiGrid();
    fetch('custom-emojis.json').then(r => r.ok ? r.json() : { emojis: [] }).then(data => {
        customEmojis = Array.isArray(data.emojis) ? data.emojis.filter(e => e && /^:[a-z0-9_-]+:$/i.test(e.shortcode) && /^images\/emojis\/[a-zA-Z0-9_.-]+$/.test(e.image)) : [];
        const grid = $('custom-results'); grid.replaceChildren();
        if (!customEmojis.length) { grid.textContent = 'Custom Gundam emotes coming soon!'; return; }
        for (const e of customEmojis) {
            const b = document.createElement('button'); b.type = 'button'; b.title = e.shortcode;
            const img = document.createElement('img'); img.src = e.image; img.alt = e.name || e.shortcode;
            b.append(img, document.createTextNode(e.name || e.shortcode));
            b.addEventListener('click', () => { const input = $('message-input'); input.setRangeText(e.shortcode, input.selectionStart, input.selectionEnd, 'end'); input.focus(); });
            grid.append(b);
        }
    }).catch(() => { $('custom-results').textContent = 'Custom emotes unavailable.'; });
    async function sendGif(id) {
        if (!/^[a-zA-Z0-9_-]{4,100}$/.test(id)) return;
        if (!client || !me || !nickname) { feedback('Join the chat first.'); return; }
        if (Date.now() - lastSend < 4000) { feedback('Please wait a few seconds between messages.'); return; }
        const { error } = await client.rpc('gcg_send_chat_message', { p_nickname: nickname, p_message: ':gif:' + id + ':' });
        if (error) { feedback(error.message); return; }
        lastSend = Date.now(); picker.hidden = true; await loadMessages();
    }
    async function searchGifs(term) {
        if (gifBlocked) return;
        const apiKey = window.GCG_GIPHY_API_KEY;
        if (!apiKey || apiKey.startsWith('PASTE_')) { $('gif-status').textContent = 'Add your GIPHY beta key in js/giphy-config.js to enable GIF search.'; return; }
        if (gifAbort) gifAbort.abort(); gifAbort = new AbortController();
        $('gif-status').textContent = 'Loading GIFs…';
        const endpoint = term ? 'search' : 'trending';
        const params = new URLSearchParams({ api_key: apiKey, limit: '16', rating: 'pg-13' });
        if (term) params.set('q', term);
        try {
            const response = await fetch('https://api.giphy.com/v1/gifs/' + endpoint + '?' + params, { signal: gifAbort.signal });
            if (response.status === 429) { gifBlocked = true; $('gif-limit').hidden = false; $('gif-results').replaceChildren(); $('gif-status').textContent = ''; return; }
            if (!response.ok) throw new Error('GIF search unavailable (' + response.status + ')');
            const json = await response.json(); const grid = $('gif-results'); grid.replaceChildren();
            for (const gif of (json.data || [])) {
                if (!/^[a-zA-Z0-9_-]{4,100}$/.test(gif.id || '')) continue;
                const preview = gif.images?.fixed_width?.url || gif.images?.downsized?.url;
                if (!preview || !/^https:\/\//.test(preview)) continue;
                const button = document.createElement('button'); button.type = 'button'; button.title = gif.title || 'Send GIF';
                const img = document.createElement('img'); img.src = preview; img.alt = gif.title || 'GIF'; img.loading = 'lazy';
                button.append(img); button.addEventListener('click', () => sendGif(gif.id)); grid.append(button);
            }
            $('gif-status').textContent = grid.childElementCount ? '' : 'No GIFs found.';
        } catch (error) { if (error.name !== 'AbortError') $('gif-status').textContent = error.message; }
    }
    $('gif-search').addEventListener('input', event => {
        clearTimeout(gifTimer); gifTimer = setTimeout(() => searchGifs(event.target.value.trim()), 450);
    });
    $('gif-retry').addEventListener('click', () => { gifBlocked = false; $('gif-limit').hidden = true; searchGifs($('gif-search').value.trim()); });

    async function start(){
        if(!valid){
            $('messages').textContent='Supabase connection not configured. Keep your existing js/admin-config.js.';return
        }
        client=window.supabase.createClient(url,key);let {
            data:{
                user
            }
        }
        =await client.auth.getUser();if(!user){
            const result=await client.auth.signInAnonymously();if(result.error){
                feedback('Chat needs Anonymous Sign-Ins enabled in Supabase Authentication → Providers.');$('messages').textContent='Unable to join chat: '+result.error.message;await loadStream();return
            }
            user=result.data.user
        }
        me=user;restoreProfile();startAvatarPresence();const {
            data:allowed
        }
        =await client.rpc('gcg_is_admin');admin=allowed===true;playerLockButton.hidden=!admin;if(!admin)setPlayerLock(false);$('admin-link').hidden=!admin;$('admin-panel').hidden=!admin;captureUi();setNickname();await Promise.all([loadStream(),loadMessages()]);lastRefreshCommand = await readRefreshCommand();refreshBaselineLoaded = true;if(!nickname)promptNickname();channel=client.channel('gcg-streams-updates').on('postgres_changes',{
            event:'*',schema:'public',table:'gcg_chat_messages'
        }
        ,()=>loadMessages()).on('postgres_changes',{
            event:'*',schema:'public',table:'gcg_stream_settings'
        }
        ,payload=>{loadStream();receiveRefreshUpdate(payload);}).on('broadcast', {event:'chat-reaction'}, ({payload})=>{
            if(payload && REACTIONS.includes(payload.emoji)) spawnReaction(payload.emoji);
        }).subscribe();setInterval(()=>{
            if(!document.hidden){
                loadMessages();loadStream()
            }
        }
        ,15000)
    }
    // Broadcast transient reactions; they are not saved to the chat database.
    const FINGER_TONES = ['☝️', '☝🏻', '☝🏼', '☝🏽', '☝🏾', '☝🏿', 'shining-finger', 'darkness-finger'];
    const CUSTOM_FINGERS = {
        'shining-finger': 'images/emojis/ShiningFinger.webp',
        'darkness-finger': 'images/emojis/DarknessFinger.webp'
    };
    function setFingerContent(element, tone) {
        element.replaceChildren();
        if (CUSTOM_FINGERS[tone]) {
            const image = document.createElement('img');
            image.src = CUSTOM_FINGERS[tone];
            image.alt = tone === 'shining-finger' ? 'Shining Finger' : 'Darkness Finger';
            image.className = 'custom-finger-image';
            element.appendChild(image);
        } else {
            element.textContent = tone;
        }
    }
    const REACTIONS = ['🔥', '❤️', '😂', '💯', ...FINGER_TONES];
    const fingerButton = $('finger-reaction');
    const fingerPicker = $('finger-tone-picker');
    const fingerStorageKey = 'gcg-finger-tone';
    let selectedFinger = '☝️';
    try {
        const stored = localStorage.getItem(fingerStorageKey);
        if (FINGER_TONES.includes(stored)) selectedFinger = stored;
    } catch (_) { /* Local storage may be unavailable. */ }
    setFingerContent(fingerButton, selectedFinger);
    fingerButton.dataset.reaction = selectedFinger;

    let lastReactionAt = 0;
    function spawnReaction(emoji) {
        if (!REACTIONS.includes(emoji)) return;
        const layer = $('reaction-float-layer');
        const item = document.createElement('span');
        item.className = 'reaction-float';
        setFingerContent(item, emoji);
        item.style.setProperty('--reaction-x', `${12 + Math.random() * 72}%`);
        item.style.setProperty('--reaction-drift', `${Math.round(Math.random() * 90 - 45)}px`);
        layer.appendChild(item);
        item.addEventListener('animationend', () => item.remove(), {once: true});
        setTimeout(() => item.remove(), 4000);
    }

    async function sendReaction(emoji) {
        if (!channel || !me || !REACTIONS.includes(emoji)) return;
        const now = Date.now();
        if (now - lastReactionAt < 300) return;
        lastReactionAt = now;
        spawnReaction(emoji);
        try {
            await channel.send({type: 'broadcast', event: 'chat-reaction', payload: {emoji}});
        } catch (error) {
            console.warn('Reaction broadcast failed:', error);
        }
    }

    document.querySelectorAll('[data-reaction]').forEach(button => {
        if (button === fingerButton) return;
        button.addEventListener('click', () => sendReaction(button.dataset.reaction));
    });

    // Hold, drag over a tone, and release to select only (mouse or touch).
    // Pointer capture keeps the gesture active after leaving the original button.
    let holdTimer = null;
    let activePointer = null;
    let holdTriggered = false;
    let suppressFingerClick = false;
    function cancelFingerHold() {
        if (holdTimer !== null) clearTimeout(holdTimer);
        holdTimer = null;
    }
    function toneAtPoint(x, y) {
        const target = document.elementFromPoint(x, y);
        return target?.closest('[data-finger-tone]')?.closest('#finger-tone-picker')
            ? target.closest('[data-finger-tone]') : null;
    }
    function highlightFingerTone(x, y) {
        const hovered = toneAtPoint(x, y);
        fingerPicker.querySelectorAll('[data-finger-tone]').forEach(button => {
            button.classList.toggle('finger-tone-hover', button === hovered);
        });
        return hovered;
    }
    function chooseFingerTone(tone) {
        if (!FINGER_TONES.includes(tone)) return;
        selectedFinger = tone;
        setFingerContent(fingerButton, tone);
        fingerButton.dataset.reaction = tone;
        try { localStorage.setItem(fingerStorageKey, tone); } catch (_) {}
        fingerPicker.hidden = true;
    }
    fingerButton.addEventListener('pointerdown', event => {
        if (event.button !== 0 || activePointer !== null) return;
        cancelFingerHold();
        activePointer = event.pointerId;
        holdTriggered = false;
        fingerButton.setPointerCapture(event.pointerId);
        holdTimer = setTimeout(() => {
            holdTimer = null;
            fingerPicker.hidden = false;
            holdTriggered = true;
            suppressFingerClick = true;
        }, 500);
    });
    fingerButton.addEventListener('pointermove', event => {
        if (event.pointerId === activePointer && holdTriggered) {
            highlightFingerTone(event.clientX, event.clientY);
        }
    });
    fingerButton.addEventListener('pointerup', event => {
        if (event.pointerId !== activePointer) return;
        cancelFingerHold();
        activePointer = null;
        if (holdTriggered) {
            const tone = highlightFingerTone(event.clientX, event.clientY);
            if (tone) chooseFingerTone(tone.dataset.fingerTone);
            // Releasing outside the picker leaves it open for a normal click.
        }
        if (fingerButton.hasPointerCapture(event.pointerId))
            fingerButton.releasePointerCapture(event.pointerId);
    });
    fingerButton.addEventListener('pointercancel', event => {
        if (event.pointerId !== activePointer) return;
        cancelFingerHold();
        activePointer = null;
        holdTriggered = false;
        suppressFingerClick = true;
        fingerPicker.hidden = true;
    });
    fingerButton.addEventListener('contextmenu', event => event.preventDefault());
    fingerButton.addEventListener('click', event => {
        if (holdTriggered || suppressFingerClick) {
            event.preventDefault();
            holdTriggered = false;
            suppressFingerClick = false;
            return;
        }
        fingerPicker.hidden = true;
        sendReaction(selectedFinger);
    });
    fingerPicker.querySelectorAll('[data-finger-tone]').forEach(button => {
        // Fallback: picker can also be used by clicking after releasing.
        button.addEventListener('click', () => chooseFingerTone(button.dataset.fingerTone));
    });
    document.addEventListener('pointerdown', event => {
        if (!event.target.closest('.finger-reaction-wrap')) fingerPicker.hidden = true;
    });
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape') fingerPicker.hidden = true;
    });

    // Automatic deployment updates. The manifest and the loaded JS share this release ID.
    const PAGE_VERSION = '20261107-r16';
    const AUTO_REFRESH_ATTEMPT_KEY = 'gcg-streams-auto-refresh-attempt';
    let automaticRefreshPending = false;
    let automaticRefreshChecking = false;
    async function checkPageVersion() {
        if (automaticRefreshChecking || automaticRefreshPending || viewerRefreshPending) return;
        automaticRefreshChecking = true;
        try {
            const response = await fetch(`version.json?check=${Date.now()}`, { cache: 'no-store' });
            if (!response.ok) return; // Missing manifest: do not reload.
            const manifest = await response.json();
            const latest = typeof manifest?.streams === 'string' ? manifest.streams.trim() : '';
            if (!latest || latest === PAGE_VERSION) {
                if (latest === PAGE_VERSION) sessionStorage.removeItem(AUTO_REFRESH_ATTEMPT_KEY);
                return;
            }
            // A deploy can publish version.json before the new JS. Try once per target
            // version per tab; never loop if GitHub Pages still serves the older JS.
            if (sessionStorage.getItem(AUTO_REFRESH_ATTEMPT_KEY) === latest) return;
            automaticRefreshPending = true;
            sessionStorage.setItem(AUTO_REFRESH_ATTEMPT_KEY, latest);
            const notice = document.createElement('div');
            notice.className = 'update-notice';
            notice.setAttribute('role', 'status');
            document.body.append(notice);
            let seconds = 5;
            notice.textContent = `🔄 New Streams update available. Refreshing in ${seconds} seconds…`;
            const countdown = setInterval(() => {
                seconds -= 1;
                if (seconds <= 0) {
                    clearInterval(countdown);
                    const next = new URL(window.location.href);
                    next.searchParams.set('gcg_update', latest);
                    window.location.replace(next.href);
                    return;
                }
                notice.textContent = `🔄 New Streams update available. Refreshing in ${seconds} seconds…`;
            }, 1000);
        } catch (error) {
            console.warn('Stream update check unavailable:', error);
        } finally {
            automaticRefreshChecking = false;
        }
    }
    setInterval(checkPageVersion, 60000);
    setTimeout(checkPageVersion, 10000);

    // Admin-triggered refresh is independent of automatic deployment checks.
    let lastRefreshCommand = null;
    let refreshBaselineLoaded = false;
    let viewerRefreshPending = false;
    async function readRefreshCommand() {
        const {data, error} = await client.from('gcg_stream_settings')
            .select('refresh_command').eq('id', 1).maybeSingle();
        if (error) { console.warn('Refresh command unavailable:', error.message); return; }
        return data?.refresh_command || null;
    }
    function handleRefreshCommand(command) {
        if (!refreshBaselineLoaded || !command || viewerRefreshPending || automaticRefreshPending || command === lastRefreshCommand) return;
        lastRefreshCommand = command;
        viewerRefreshPending = true;
        const notice = document.createElement('div');
        notice.className = 'update-notice';
        notice.setAttribute('role', 'status');
        document.body.append(notice);
        let seconds = 5;
        notice.textContent = `🔄 Admin requested a page refresh. Reloading in ${seconds} seconds…`;
        const countdown = setInterval(() => {
            seconds -= 1;
            if (seconds <= 0) { clearInterval(countdown); window.location.reload(); return; }
            notice.textContent = `🔄 Admin requested a page refresh. Reloading in ${seconds} seconds…`;
        }, 1000);
    }
    async function receiveRefreshUpdate(payload) {
        // Supabase Realtime sends the updated settings row to existing subscribers.
        const command = payload?.new?.refresh_command;
        if (typeof command === 'string') handleRefreshCommand(command);
    }
    $('refresh-all-viewers').addEventListener('click', async () => {
        if (!admin || !client || viewerRefreshPending) return;
        if (!confirm('Refresh the Streams page for everyone currently connected?')) return;
        const button = $('refresh-all-viewers');
        button.disabled = true;
        $('admin-feedback').textContent = 'Sending refresh command…';
        try {
            const {error} = await client.rpc('gcg_request_stream_refresh');
            if (error) throw error;
            $('admin-feedback').textContent = 'Refresh requested. Connected viewers will reload in 5 seconds.';
        } catch (error) {
            $('admin-feedback').textContent = 'Refresh failed: ' + error.message + ' (Run STREAMS_MANUAL_REFRESH_SETUP.sql first.)';
            button.disabled = false;
        }
    });

    /* Lock only the embedded player's mouse interactions, without reloading it. */
    const playerLockButton=$('player-lock-toggle');
    let playerLocked=false;
    function setPlayerLock(locked){
        playerLocked=!!locked;
        $('video-frame').classList.toggle('player-locked',playerLocked);
        playerLockButton.setAttribute('aria-pressed',String(playerLocked));
        playerLockButton.textContent=playerLocked?'🔒 Unlock Player':'🔓 Lock Player';
    }
    playerLockButton.addEventListener('click',()=>{
        if(!admin)return;
        setPlayerLock(!playerLocked);
    });
    /* Theatre mode enlarges the player while preserving the chat. */ function setTheatre(enabled){
        document.body.classList.toggle('theatre-mode',enabled); $('theatre-toggle').setAttribute('aria-pressed',String(enabled)); $('theatre-toggle').textContent=enabled?'▣ Exit Theatre':'▣ Theatre Mode';
    }
    $('theatre-toggle').addEventListener('click',()=>setTheatre(!document.body.classList.contains('theatre-mode'))); document.addEventListener('keydown',e=>{
        if(e.key==='Escape'&&document.body.classList.contains('theatre-mode')&&!document.querySelector('dialog[open]'))setTheatre(false)
    }
    ); /* Capture the *tab's displayed embed rectangle*, not inaccessible YouTube iframe pixels. */ /* Keep the tab capture alive so the browser asks permission only once per session. */ let captureStream=null,captureVideo=null,captureBusy=false; const captureButton=$('screenshot-button'),captureStart=$('capture-start'),captureStop=$('capture-stop'),captureFeedback=$('capture-feedback'); function captureUi(){
        const active=!!captureStream?.active;captureStart.hidden=!admin||active;captureStop.hidden=!admin||!active;captureButton.hidden=!admin;captureButton.disabled=!active||captureBusy;captureButton.textContent=active?'▢ Copy video frame':'▢ Screenshot (start capture first)'
    }
    function stopCapture(){
        captureStream?.getTracks().forEach(t=>t.stop());captureStream=null;if(captureVideo){
            captureVideo.pause();captureVideo.srcObject=null;captureVideo=null
        }
        captureUi()
    }
    async function startCapture(){
        if(!admin||captureStream?.active)return; if(!navigator.mediaDevices?.getDisplayMedia||!navigator.clipboard?.write||typeof ClipboardItem==='undefined'){
            captureFeedback.textContent='Use Chrome or Edge on HTTPS or localhost.';return
        }
        if(!$('video').dataset.id){
            captureFeedback.textContent='No featured video to capture.';return
        }
        captureStart.disabled=true;captureFeedback.textContent='Select “This Tab” and approve sharing once…'; let stream; try{
            stream=await navigator.mediaDevices.getDisplayMedia({
                video:{
                    displaySurface:'browser'
                }
                ,audio:false,preferCurrentTab:true,selfBrowserSurface:'include'
            }
            ); if(stream.getVideoTracks()[0]?.getSettings().displaySurface!=='browser')throw new Error('Please choose This Tab (not a window or screen).'); const v=document.createElement('video');v.muted=true;v.playsInline=true;v.srcObject=stream;await v.play(); if(!v.videoWidth)await new Promise((resolve,reject)=>{
                v.onloadedmetadata=resolve;setTimeout(()=>reject(new Error('Capture video did not start.')),5000)
            }
            ); captureStream=stream;captureVideo=v; stream.getVideoTracks()[0].addEventListener('ended',()=>{
                stopCapture();captureFeedback.textContent='Capture stopped.'
            }
            ); captureFeedback.textContent='Ready! Move the pointer off the YouTube video, let its controls fade, then click Copy or press S.';
        }
        catch(e){
            stream?.getTracks().forEach(t=>t.stop());captureFeedback.textContent=e.name==='NotAllowedError'?'Sharing cancelled.':e.message||'Could not start capture.'
        }
        finally{
            captureStart.disabled=false;captureUi()
        }
    }
    async function copyFrame(){
        if(!admin||!captureStream?.active||!captureVideo||captureBusy)return; captureBusy=true;captureUi(); captureFeedback.textContent='Preparing screenshot…'; try{
            if(!document.hasFocus())throw new Error('Click the Streams page to focus it, then try again.'); const v=captureVideo,rect=$('video-frame').getBoundingClientRect(); const sx=v.videoWidth/window.innerWidth,sy=v.videoHeight/window.innerHeight; if(Math.abs(sx-sy)>0.15||rect.left<0||rect.top<0||rect.right>window.innerWidth+2||rect.bottom>window.innerHeight+2)throw new Error('Keep the entire player visible on screen; Theatre Mode may help.'); const x=Math.round(rect.left*sx),y=Math.round(rect.top*sy),w=Math.round(rect.width*sx),h=Math.round(rect.height*sy); if(w<10||h<10||x<0||y<0||x+w>v.videoWidth+2||y+h>v.videoHeight+2)throw new Error('Could not crop the embed area.'); const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h; canvas.getContext('2d').drawImage(v,x,y,w,h,0,0,w,h); /* Encode synchronously so the clipboard write is initiated within the button/key gesture. */ /* Opera may reject ClipboardItem entries whose PNG is provided as a pending Promise. */ const dataUrl=canvas.toDataURL('image/png'); const binary=atob(dataUrl.slice(dataUrl.indexOf(',')+1)); const bytes=new Uint8Array(binary.length); for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i); const png=new Blob([bytes],{
                type:'image/png'
            }
            ); await navigator.clipboard.write([new ClipboardItem({
                'image/png':png
            }
            )]); captureFeedback.textContent='✓ Copied to clipboard! Paste with Ctrl+V.';
        }
        catch(e){
            console.error('[GCG screenshot] Clipboard capture failed:',e); captureFeedback.textContent='Copy failed: '+(e.message||String(e));
        }
        finally{
            captureBusy=false;captureUi()
        }
    }
    captureStart.addEventListener('click',startCapture); captureStop.addEventListener('click',()=>{
        stopCapture();captureFeedback.textContent='Capture stopped.'
    }
    ); captureButton.addEventListener('click',copyFrame); document.addEventListener('keydown',e=>{
        if(e.key.toLowerCase()!=='s'||e.ctrlKey||e.altKey||e.metaKey||e.repeat)return; if(['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)||document.activeElement?.isContentEditable)return; if(admin&&captureStream?.active){
            e.preventDefault();copyFrame()
        }
    }
    ); window.addEventListener('pagehide',stopCapture); $('nickname-form').addEventListener('submit',e=>{
        e.preventDefault();const name=$('nickname-input').value.trim();if(name.length<2||name.length>24||/[<>\r\n]/.test(name)){
            $('nickname-error').textContent='Use 2–24 characters; no angle brackets.';return
        }
        nickname=name;selectedAvatar=draftAvatar;nameColor=draftColor;localStorage.setItem('gcg_chat_nickname',name);try{localStorage.setItem(profileKey(),JSON.stringify({avatar:selectedAvatar,color:nameColor}));}catch(_){}setNickname();updateOwnWalkerImmediately();broadcastProfile();activeNameColors.set(name.toLowerCase(),safeColor(nameColor));refreshChatNameColors();$('nickname-dialog').close()
    }
    );
    // Cards are loaded from the DeckBuilder's existing JSON set files (not duplicated).
    // To add a newly released set, add its filename to CARD_SET_FILES.
    const CARD_SET_FILES=[...Array.from({length:6},(_,i)=>`GD${String(i+1).padStart(2,'0')}.json`),
        ...Array.from({length:14},(_,i)=>`ST${String(i+1).padStart(2,'0')}.json`),'EB01.json'];
    const cardById=new Map();let cardPoolPromise=null;
    async function loadCardPool(){
        if(!cardPoolPromise)cardPoolPromise=(async()=>{
            const responses=await Promise.allSettled(CARD_SET_FILES.map(async file=>{
                const response=await fetch(`DeckBuilder/Data/${file}`);
                if(!response.ok)throw new Error(`${file}: HTTP ${response.status}`);
                const data=await response.json();return Array.isArray(data.cards)?data.cards:[];
            }));
            cardById.clear();
            for(const result of responses){
                if(result.status!=='fulfilled')continue;
                for(const card of result.value){
                    if(typeof card.id==='string'&&typeof card.name==='string'&&/^[A-Z0-9]+-\d{3}$/.test(card.id))
                        cardById.set(card.id,{id:card.id,name:card.name});
                }
            }
            if(!cardById.size)throw new Error('No cards found in DeckBuilder/Data');
            return Array.from(cardById.values());
        })().catch(error=>{cardPoolPromise=null;throw error});
        return cardPoolPromise;
    }
    // Preload for chat history and immediate draws. Retry if files were temporarily unavailable.
    loadCardPool().then(()=>{if(typeof loadMessages==='function')loadMessages()}).catch(()=>{});
    $('draw-card').addEventListener('click',async()=>{
        if(!nickname||!me){promptNickname();return}
        if(Date.now()-lastSend<4000){feedback('Please wait a few seconds between messages or draws.');return}
        const button=$('draw-card');button.disabled=true;
        try{
            const cards=await loadCardPool();
            const random=new Uint32Array(1);crypto.getRandomValues(random);
            const card=cards[random[0]%cards.length];
            lastSend=Date.now();
            const {error}=await client.rpc('gcg_send_chat_message',{
                p_nickname:nickname,p_message:`[gcg-card:${card.id}]`
            });
            if(error)throw error;
            feedback('Messages are public. Be respectful.');await loadMessages();
        }catch(error){feedback('Card draw failed: '+error.message)}
        finally{button.disabled=false}
    });
    // A dice roll is generated once by the sender and saved as a chat message.
    // Every viewer renders the same stored result; no additional database schema is needed.
    $('roll-dice').addEventListener('click',async()=>{
        if(!nickname||!me){promptNickname();return}
        if(Date.now()-lastSend<4000){feedback('Please wait a few seconds between messages or rolls.');return}
        const button=$('roll-dice');button.disabled=true;
        const result=crypto.getRandomValues(new Uint32Array(1))[0]%6+1;
        lastSend=Date.now();
        try{
            const {error}=await client.rpc('gcg_send_chat_message',{
                p_nickname:nickname,p_message:`[gcg-dice:d6:${result}]`
            });
            if(error)feedback(error.message);
            else{feedback('Messages are public. Be respectful.');await loadMessages()}
        }catch(error){feedback('Dice roll failed: '+error.message)}
        finally{button.disabled=false}
    });
    $('edit-nickname').addEventListener('click',promptNickname);$('message-form').addEventListener('submit',async e=>{
        e.preventDefault();const msg=$('message-input').value.trim();if(!msg||!nickname||!me)return;if(Date.now()-lastSend<4000){
            feedback('Please wait a few seconds between messages.');return
        }
        lastSend=Date.now();$('send-button').disabled=true;const {
            error
        }
        =await client.rpc('gcg_send_chat_message',{
            p_nickname:nickname,p_message:msg
        }
        );if(error)feedback(error.message);else{
            $('message-input').value='';feedback('Messages are public. Be respectful.');await loadMessages()
        }
        $('send-button').disabled=false
    }
    );$('stream-form').addEventListener('submit',async e=>{
        e.preventDefault();if(!admin)return;const id=videoId($('stream-url').value);if(!id){
            $('admin-feedback').textContent='Enter a valid YouTube video or livestream URL.';return
        }
        const {
            error
        }
        =await client.rpc('gcg_set_featured_stream',{
            p_video_id:id,p_title:'Featured GCG Stream',p_description:'',p_is_live:$('stream-live').checked
        }
        );$('admin-feedback').textContent=error?error.message:'Featured video saved!';if(!error)await loadStream()
    }
    );$('clear-chat').addEventListener('click',async()=>{
        if(!admin)return;if(!confirm('Permanently delete ALL community chat messages? This cannot be undone.'))return;const btn=$('clear-chat');btn.disabled=true;$('admin-feedback').textContent='Clearing chat…';try{
            const {
                error
            }
            =await client.rpc('gcg_clear_chat');if(error)throw error;$('admin-feedback').textContent='Chat cleared successfully.';await loadMessages()
        }
        catch(e){
            $('admin-feedback').textContent='Clear chat failed: '+e.message
        }
        finally{
            btn.disabled=false
        }
    }
    );$('clear-stream').addEventListener('click',async()=>{
        if(!admin||!confirm('Clear the featured video?'))return;const {
            error
        }
        =await client.rpc('gcg_set_featured_stream',{
            p_video_id:null,p_title:'',p_description:'',p_is_live:false
        }
        );$('admin-feedback').textContent=error?error.message:'Featured video cleared.';if(!error)await loadStream()
    }
    );start().catch(e=>{
        $('messages').textContent='Connection failed: '+e.message
    }
    )
}
)();
