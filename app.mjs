import {PROVIDERS,label,redact,normalize,parseReport,key,filtered,diagnosis,exportReport} from './diagnostics-model.mjs';
const $=id=>document.getElementById(id);
const state={mode:'import',local:[],live:[],selected:'',details:new Map(),pendingDetails:new Map(),auth:null,user:null,apiRoot:'',loading:false,request:0,detailRequest:0,poll:null,importedAt:0};
const node=(tag,text,cls='')=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=String(text);if(cls)e.className=cls;return e;};
const ago=time=>{if(!time)return 'No timestamp';const n=Math.max(0,Math.round((Date.now()-time)/1000));return n<60?n+'s ago':n<3600?Math.floor(n/60)+'m ago':n<86400?Math.floor(n/3600)+'h ago':Math.floor(n/86400)+'d ago';};
const ms=value=>value<0?'—':value<1000?Math.round(value)+' ms':(value/1000).toFixed(1)+' s';
const all=()=>state.mode==='live'?state.live:state.local;
const view=()=>filtered(all(),{provider:$('provider-filter').value,status:$('status-filter').value,query:$('search').value});
function notice(text,error=false){$('notice').textContent=text;$('notice').classList.toggle('hidden',!text);$('notice').classList.toggle('error',error);}
function mode(value){state.mode=value;state.selected='';state.detailRequest++;$('mode-live').classList.toggle('selected',value==='live');$('mode-import').classList.toggle('selected',value==='import');$('connect-panel').classList.toggle('hidden',value!=='live'||!!state.user);notice('');render();if(value==='live'&&state.user)refreshLive();}
function render(){
 const reports=view();$('count-total').textContent=reports.length;$('count-error').textContent=reports.filter(r=>r.status==='error').length;$('count-loading').textContent=reports.filter(r=>['resolving','loading','retrying'].includes(r.status)).length;$('count-playing').textContent=reports.filter(r=>r.status==='playing').length;
 $('list-caption').textContent=reports.length?reports.length+' episodes · latest first':'No matching episodes';$('copy-all').disabled=!reports.length;$('refresh').disabled=state.mode==='live'&&!state.user;
 $('last-updated').textContent=state.mode==='live'?(state.user?'Live · refreshes every 15 seconds':'Sign in to read live reports'):state.importedAt?'Imported '+ago(state.importedAt):'No report loaded';
 const list=$('session-list');list.replaceChildren();
 if(!reports.length){const empty=node('div',undefined,'empty');empty.append(node('span','▤','empty-icon'),node('h3',all().length?'No episodes match these filters.':state.mode==='live'?'Waiting for app reports.':'Your next clue starts here.'),node('p',state.mode==='live'?'After the backend update, open an episode in the updated app. Reports arrive in small batches.':'Open the app’s Settings → Diagnostics → Copy report, then import it here.'));list.append(empty);$('details').replaceChildren(emptyDetail());return;}
 if(!reports.some(r=>key(r)===state.selected))state.selected=key(reports[0]);
 for(const r of reports){const button=node('button',undefined,'session'+(key(r)===state.selected?' active':''));button.setAttribute('aria-pressed',String(key(r)===state.selected));const top=node('div',undefined,'session-top');const title=node('div');title.append(node('h3',r.title),node('div',label(r.provider)+' · Episode '+r.episode+' · '+(r.surface==='reels'?'Reels':'Story player'),'meta'));top.append(title,node('span',r.status,'badge '+r.status));const bottom=node('div',undefined,'session-bottom');const time=r.received_at||r.updated_at;bottom.append(node('span',r.error_code||r.stage.replaceAll('_',' ')||'No stage recorded'),node('span',(Date.now()-time>90000?'Last report · ':'')+ago(time)));button.append(top,bottom);button.addEventListener('click',()=>{state.selected=key(r);render();});list.append(button);}
 const selected=reports.find(r=>key(r)===state.selected);if(selected)loadDetail(selected);
}
function emptyDetail(){const e=node('div',undefined,'empty details-empty');e.append(node('span','▷','empty-icon'),node('h3','Select an episode'),node('p','The provider, timing, video format and event timeline will appear here.'));return e;}
async function loadDetail(summary){
 if(state.mode!=='live'){drawDetail(summary);return;}
 const cached=state.details.get(key(summary));if(cached&&cached.revision===summary.revision){drawDetail(cached);return;}
 const generation=++state.detailRequest;const expected=state.selected;const box=node('div',undefined,'empty details-empty');box.append(node('h3','Loading event timeline…'));$('details').replaceChildren(box);
 try{const r=await fetchDetail(summary);if(state.mode==='live'&&generation===state.detailRequest&&state.selected===expected)drawDetail(r);}catch(e){if(generation===state.detailRequest){box.replaceChildren(node('h3','Report could not be loaded'),node('p',friendly(e)));}}
}
function drawDetail(r){
 const root=$('details');root.replaceChildren();const header=node('div',undefined,'details-top'),heading=node('div');heading.append(node('span','EPISODE '+r.episode+' / '+label(r.provider).toUpperCase(),'eyebrow'),node('h2',r.title));const meta=node('div',undefined,'detail-meta');meta.append(node('span',r.status,'badge '+r.status),node('span',r.surface==='reels'?'Reels feed':'Story player'));const timestamp=r.received_at||r.updated_at;if(timestamp&&Date.now()-timestamp>90000)meta.append(node('span','Stale · '+ago(timestamp)));heading.append(meta);const copy=node('button','Copy report','copy');copy.addEventListener('click',()=>copyText(exportReport([r])));header.append(heading,copy);root.append(header);
 const [title,explanation]=diagnosis(r);const callout=node('div',undefined,'callout'+(r.status==='error'?' error':''));callout.append(node('h3',title),node('p',explanation));root.append(callout);
 const metrics=node('div',undefined,'metrics');for(const [name,value] of [['Provider lookup',ms(r.resolve_ms)],['First video frame',r.first_frame_ms<0?'Not recorded':ms(r.first_frame_ms)],['Attempts',r.attempts||1]]){const cell=node('div');cell.append(node('small',name),node('strong',value));metrics.append(cell);}root.append(metrics);
 const technical=node('dl',undefined,'technical');for(const [name,value] of [['Engine',r.engine||'Not recorded'],['Video type',r.media_type||'Auto / unknown'],['Stream host',r.stream_host||'Not resolved'],['Playback',r.position_s.toFixed(1)+' / '+r.duration_s.toFixed(1)+' s'],['Device',r.device||'Not recorded'],['App build',r.app_version||'Not recorded'],['Video tracks',r.video_tracks||'No track details recorded'],['Client',r.client?r.client.slice(0,10)+'…':'Local report']])technical.append(node('dt',name),node('dd',value));root.append(technical);
 const line=node('div',undefined,'timeline-heading');line.append(node('h3','Playback timeline'),node('span',r.events.length+' events','muted'));root.append(line);const events=node('ol',undefined,'timeline');for(const e of r.events){const li=node('li'),time=node('time',((e.at-(r.started_at||e.at))/1000).toFixed(1)+'s');const dot=node('span',undefined,'dot '+e.status);const content=node('div');content.append(node('h4',e.stage.replaceAll('_',' ')),node('p',e.message||e.status));li.append(time,dot,content);events.append(li);}if(!r.events.length)events.append(node('li','No event timeline was recorded for this session.'));root.append(events);
}
async function copyText(text){try{await navigator.clipboard.writeText(text);notice('Report copied. You can paste it into your support chat.');}catch{$('report-input').value=text;$('import-error').textContent='Clipboard access was blocked. Select and copy the text below.';$('import-dialog').showModal();$('report-input').focus();$('report-input').select();}}
function apiRoot(){const u=new URL($('api-root').value.trim());if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash||!['','/'].includes(u.pathname))throw Error('Enter the HTTPS API service root without a path, query or credentials.');return u.origin;}
async function request(path,{publicConfig=false,retry=true}={}){
 const root=state.apiRoot||apiRoot(),controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12000);
 try{const headers={Accept:'application/json'};if(!publicConfig){if(!state.user)throw Error('Sign in before opening live diagnostics.');headers.Authorization='Bearer '+await state.user.getIdToken();}
 const response=await fetch(root+'/api/player-diagnostics'+path,{headers,credentials:'omit',redirect:'error',cache:'no-store',signal:controller.signal});
 if(response.status===401&&!publicConfig&&retry){await state.user.getIdToken(true);return request(path,{retry:false});}
 let data;try{data=await response.json();}catch{throw Error('The diagnostics endpoint is not installed or did not return JSON.');}
 if(!response.ok||!data.success){const e=Error(data.error||'Diagnostics request failed (HTTP '+response.status+')');e.status=response.status;throw e;}return data;
 }finally{clearTimeout(timeout);}
}
async function authReady(){
 const root=apiRoot();
 if(state.auth&&root===state.apiRoot)return state.auth;
 if(state.auth){await state.auth.sdk.signOut(state.auth.instance).catch(()=>{});await state.auth.core.deleteApp(state.auth.instance.app);state.auth=null;}
 state.apiRoot=root;const config=await request('/config',{publicConfig:true});if(!config.apiKey)throw Error('Firebase web configuration is missing on the API Worker.');
 const [core,auth]=await Promise.all([import('https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js'),import('https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js')]);
 const app=core.initializeApp({apiKey:config.apiKey,projectId:config.projectId,authDomain:config.authDomain||config.projectId+'.firebaseapp.com'},'bida-player-diagnostics-'+Math.random().toString(36).slice(2));
 const instance=auth.initializeAuth(app,{persistence:auth.inMemoryPersistence,popupRedirectResolver:auth.browserPopupRedirectResolver});state.auth={sdk:auth,instance,core};return state.auth;
}
async function login(google=false){
 $('signin').disabled=true;$('google').disabled=true;notice('Connecting to your diagnostics service…');
 try{if(!google&&(!$('email').value||!$('password').value))throw Error('Enter your administrator email and password, or use Google sign-in.');const auth=await authReady();const result=google?await auth.sdk.signInWithPopup(auth.instance,new auth.sdk.GoogleAuthProvider()):await auth.sdk.signInWithEmailAndPassword(auth.instance,$('email').value.trim(),$('password').value);$('password').value='';state.user=result.user;await refreshLive(true);$('api-root').readOnly=true;$('connect-panel').classList.add('hidden');$('signout').classList.remove('hidden');$('connection').textContent='Live · administrator';$('connection').classList.add('live');notice('');if(state.poll)clearInterval(state.poll);state.poll=setInterval(()=>{if(state.mode==='live'&&state.user&&!document.hidden)refreshLive();},15000);
 }catch(e){if(state.user&&state.auth)await state.auth.sdk.signOut(state.auth.instance).catch(()=>{});state.user=null;state.live=[];notice(friendly(e),true);render();}
 finally{$('signin').disabled=false;$('google').disabled=false;$('password').value='';}
}
function friendly(e){const v=String(e?.message||e||'Unknown error');if(v.includes('ADMIN_REQUIRED'))return 'This Firebase account is not in ADMIN_UIDS on the API Worker.';if(v.includes('ORIGIN_NOT_ALLOWED')||e instanceof TypeError)return 'Connection failed. Check the deployed API URL and BIDA_DIAGNOSTICS_ORIGINS. You can still import a report from the app.';if(v.includes('SCHEMA_NOT_READY'))return 'Apply migration 0003_player_diagnostics.sql to the existing D1 database.';if(v.includes('DATABASE_NOT_CONFIGURED'))return 'Add the existing platform D1 database binding to the API Worker, then deploy the backend update.';if(v.includes('auth/unauthorized-domain'))return 'Add this GitHub Pages domain to Firebase Authentication → Settings → Authorized domains.';if(v.includes('auth/invalid-credential'))return 'The Firebase email/password was not accepted. Try Google if your administrator account uses Google sign-in.';if(v.includes('auth/popup-blocked'))return 'Allow the Google sign-in popup, then try again.';if(v.includes('auth/popup-closed'))return 'Google sign-in was closed.';if(e?.name==='AbortError')return 'The service took too long to respond. Try again or import a local report.';return redact(v,240);}
async function refreshLive(throwOnFailure=false){
 if(!state.user)return;if(state.loading)return;state.loading=true;$('refresh').disabled=true;const generation=++state.request;
 try{const params=new URLSearchParams({limit:'60'});if($('provider-filter').value)params.set('provider',$('provider-filter').value);if($('status-filter').value)params.set('status',$('status-filter').value);const data=await request('/reports?'+params);if(generation!==state.request)return;state.live=(data.reports||[]).map(normalize);if(state.mode==='live')render();notice('');}
 catch(e){if(throwOnFailure)throw e;notice(friendly(e),true);}
 finally{state.loading=false;$('refresh').disabled=false;}
}
async function fetchDetail(summary){
 const id=key(summary)+':'+summary.revision;if(state.pendingDetails.has(id))return state.pendingDetails.get(id);
 const pending=(async()=>{const data=await request('/reports?'+new URLSearchParams({client:summary.client,session:summary.id}));const r=normalize({...data.report,client:data.client,received_at:data.received_at});state.details.set(key(r),r);return r;})();
 state.pendingDetails.set(id,pending);try{return await pending;}finally{state.pendingDetails.delete(id);}
}
function openImport(){$('import-error').textContent='';$('import-dialog').showModal();$('report-input').focus();}
function doImport(){try{const reports=parseReport($('report-input').value);state.local=reports;state.importedAt=Date.now();state.selected='';$('import-dialog').close();mode('import');notice('Loaded '+reports.length+' playback sessions. Signed URLs and credentials are removed from the viewer.');}catch(e){$('import-error').textContent=e.message;}}
for(const provider of PROVIDERS){const option=node('option',label(provider));option.value=provider;$('provider-filter').append(option);}
$('open-import').addEventListener('click',openImport);$('empty-import').addEventListener('click',openImport);$('mode-import').addEventListener('click',()=>mode('import'));$('mode-live').addEventListener('click',()=>mode('live'));$('import-submit').addEventListener('click',doImport);
$('report-file').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;if(file.size>1024*1024){$('import-error').textContent='Choose a JSON/text report smaller than 1 MB.';return;}$('report-input').value=await file.text();doImport();e.target.value='';});
$('search').addEventListener('input',render);for(const id of ['provider-filter','status-filter'])$(id).addEventListener('change',()=>{state.selected='';if(state.mode==='live'&&state.user)refreshLive();else render();});
$('refresh').addEventListener('click',()=>state.mode==='live'?refreshLive():render());$('login-form').addEventListener('submit',e=>{e.preventDefault();login();});$('google').addEventListener('click',()=>login(true));
$('signout').addEventListener('click',async()=>{if(state.auth)await state.auth.sdk.signOut(state.auth.instance).catch(()=>{});state.user=null;state.live=[];state.details.clear();state.request++;state.detailRequest++;if(state.poll)clearInterval(state.poll);$('signout').classList.add('hidden');$('connection').textContent='Local report viewer';$('connection').classList.remove('live');$('api-root').readOnly=false;mode('import');});
$('copy-all').addEventListener('click',async()=>{const reports=view();$('copy-all').disabled=true;try{let values=reports;if(state.mode==='live'){values=[];for(let i=0;i<reports.length;i+=3){values.push(...await Promise.all(reports.slice(i,i+3).map(r=>fetchDetail(r))));}}await copyText(exportReport(values));}catch(e){notice(friendly(e),true);}finally{$('copy-all').disabled=false;}});
render();
