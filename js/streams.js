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
            const body=document.createElement('div');body.className='msg-body';body.textContent=m.message;outer.append(top,body);box.append(outer)
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
        =await client.rpc('gcg_is_admin');admin=allowed===true;$('admin-link').hidden=!admin;$('admin-panel').hidden=!admin;captureUi();setNickname();await Promise.all([loadStream(),loadMessages()]);if(!nickname)promptNickname();channel=client.channel('gcg-streams-updates').on('postgres_changes',{
            event:'*',schema:'public',table:'gcg_chat_messages'
        }
        ,()=>loadMessages()).on('postgres_changes',{
            event:'*',schema:'public',table:'gcg_stream_settings'
        }
        ,()=>loadStream()).subscribe();setInterval(()=>{
            if(!document.hidden){
                loadMessages();loadStream()
            }
        }
        ,15000)
    }
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
