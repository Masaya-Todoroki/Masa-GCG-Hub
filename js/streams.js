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
    function setNickname(){
        nickname=nickname.trim();$('nickname-display').textContent=nickname||'Choose a nickname';$('message-input').disabled=!nickname||!me;$('send-button').disabled=!nickname||!me
    }
    function promptNickname(){
        if(!$('nickname-dialog').open){
            $('nickname-input').value=nickname;$('nickname-error').textContent='';$('nickname-dialog').showModal()
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
            const body=document.createElement('div');body.className='msg-body';renderChatBody(body,m.message);outer.append(top,body);box.append(outer)
        }
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
    $('open-picker').addEventListener('click', () => { picker.hidden = !picker.hidden; if (!picker.hidden) setPickerTab('emoji'); });
    $('close-picker').addEventListener('click', () => picker.hidden = true);
    picker.querySelectorAll('[data-picker-tab]').forEach(b => b.addEventListener('click', () => setPickerTab(b.dataset.pickerTab)));
    picker.querySelector('emoji-picker').addEventListener('emoji-click', event => {
        const input = $('message-input'); const emoji = event.detail.unicode;
        if (!emoji) return;
        input.setRangeText(emoji, input.selectionStart, input.selectionEnd, 'end'); input.focus();
    });
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
        me=user;const {
            data:allowed
        }
        =await client.rpc('gcg_is_admin');admin=allowed===true;playerLockButton.hidden=!admin;if(!admin)setPlayerLock(false);$('admin-link').hidden=!admin;$('admin-panel').hidden=!admin;captureUi();setNickname();await Promise.all([loadStream(),loadMessages()]);if(!nickname)promptNickname();channel=client.channel('gcg-streams-updates').on('postgres_changes',{
            event:'*',schema:'public',table:'gcg_chat_messages'
        }
        ,()=>loadMessages()).on('postgres_changes',{
            event:'*',schema:'public',table:'gcg_stream_settings'
        }
        ,()=>loadStream()).on('broadcast', {event:'chat-reaction'}, ({payload})=>{
            if(payload && REACTIONS.includes(payload.emoji)) spawnReaction(payload.emoji);
        }).subscribe();setInterval(()=>{
            if(!document.hidden){
                loadMessages();loadStream()
            }
        }
        ,15000)
    }
    // Broadcast transient reactions; they are not saved to the chat database.
    const REACTIONS = ['🔥','❤️','😂','☝️','💯'];
    let lastReactionAt = 0;
    function spawnReaction(emoji) {
        if (!REACTIONS.includes(emoji)) return;
        const layer = $('reaction-float-layer');
        const item = document.createElement('span');
        item.className = 'reaction-float';
        item.textContent = emoji;
        item.style.setProperty('--reaction-x', `${12 + Math.random() * 72}%`);
        item.style.setProperty('--reaction-drift', `${Math.round(Math.random() * 90 - 45)}px`);
        layer.appendChild(item);
        item.addEventListener('animationend', () => item.remove(), {once:true});
        // Clean up if the animation is interrupted.
        setTimeout(() => item.remove(), 4000);
    }
    document.querySelectorAll('[data-reaction]').forEach(button => {
        button.addEventListener('click', async () => {
            if (!channel || !me) return;
            const now = Date.now();
            if (now - lastReactionAt < 300) return;
            lastReactionAt = now;
            const emoji = button.dataset.reaction;
            spawnReaction(emoji);
            try {
                await channel.send({type:'broadcast', event:'chat-reaction', payload:{emoji}});
            } catch (error) {
                console.warn('Reaction broadcast failed:', error);
            }
        });
    });

    // Poll a tiny cache-busted deployment manifest for future site updates.
    // This feature only works for viewers after they've loaded this release once.
    const PAGE_VERSION = '20261106-r1';
    let refreshScheduled = false;
    async function checkPageVersion() {
        if (refreshScheduled) return;
        try {
            const response = await fetch(`version.json?check=${Date.now()}`, {cache:'no-store'});
            if (!response.ok) return;
            const manifest = await response.json();
            if (!manifest || typeof manifest.streams !== 'string' || manifest.streams === PAGE_VERSION) return;
            refreshScheduled = true;
            const notice = document.createElement('div');
            notice.className = 'update-notice';
            notice.setAttribute('role','status');
            notice.textContent = '🔄 Masa has deployed an update! Refreshing in 5 seconds…';
            document.body.appendChild(notice);
            setTimeout(() => window.location.reload(), 5000);
        } catch (error) { console.warn('Version check unavailable:', error); }
    }
    setInterval(checkPageVersion, 60000);
    setTimeout(checkPageVersion, 10000);

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
        nickname=name;localStorage.setItem('gcg_chat_nickname',name);setNickname();$('nickname-dialog').close();$('message-input').focus()
    }
    );$('edit-nickname').addEventListener('click',promptNickname);$('message-form').addEventListener('submit',async e=>{
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
