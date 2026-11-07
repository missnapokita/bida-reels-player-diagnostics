export const PROVIDERS=['goodshort','shortmax','netshort','starshort','dramabite','microdrama','idrama','rapidtv','cubetv','reelbuzz','happyshort','shortwave','dramabox','dramawave','reelshort','freereels','dotdrama','flextv','flickreels'];
const LABELS={goodshort:'GoodShort',shortmax:'ShortMax',netshort:'NetShort',starshort:'StarShort',dramabite:'DramaBite',microdrama:'MicroDrama',idrama:'iDrama',rapidtv:'RapidTV',cubetv:'CubeTV',reelbuzz:'ReelBuzz',happyshort:'HappyShort',shortwave:'ShortsWave',dramabox:'DramaBox',dramawave:'DramaWave',reelshort:'ReelShort',freereels:'FreeReels',dotdrama:'DotDrama',flextv:'FlexTV',flickreels:'FlickReels'};
export const label=value=>LABELS[value]||String(value||'Unknown');
export const redact=(value,max=400)=>String(value??'').replace(/https?:\/\/[^\s"'<>]+/gi,'[URL removed]').replace(/bearer\s+[A-Za-z0-9_.=-]+/gi,'[token removed]').replace(/(?:authorization|password|secret|api[_-]?key|key|access[_-]?token|id[_-]?token|refresh[_-]?token|signature|sig|token)\s*[:=]\s*["']?[^\s,;"'}]+/gi,'[credential removed]').replace(/\b[a-fA-F0-9]{32,64}\b/g,'[opaque credential removed]').replace(/[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/g,'[JWT removed]').replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,'[email removed]').slice(0,max);
const numeric=(value,fallback=0)=>value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value))?Number(value):fallback;
export function normalize(value={}){
 const status=['resolving','retrying','loading','ready','playing','paused','ended','stopped','error'].includes(value.status)?value.status:'unknown';
 return {id:String(value.id||'import-'+Math.random().toString(36).slice(2)).slice(0,80),client:String(value.client||'').slice(0,30),revision:numeric(value.revision),title:redact(value.title||'Untitled',240),provider:PROVIDERS.includes(value.provider)?value.provider:'unknown',episode:Math.max(1,numeric(value.episode,1)),surface:value.surface==='reels'?'reels':'story',status,stage:redact(value.stage,40),started_at:numeric(value.started_at),updated_at:numeric(value.updated_at),received_at:numeric(value.received_at),attempts:numeric(value.attempts,1),resolve_ms:numeric(value.resolve_ms,-1),first_frame_ms:numeric(value.first_frame_ms,-1),position_s:numeric(value.position_s),duration_s:numeric(value.duration_s),buffering_count:numeric(value.buffering_count),stream_host:/^[a-z0-9.-]{1,120}$/i.test(value.stream_host||'')?value.stream_host:'',media_type:redact(value.media_type,80),video_tracks:redact(value.video_tracks,400),device:redact(value.device,100),app_version:redact(value.app_version,80),engine:redact(value.engine,80),error_code:redact(value.error_code,80),error_message:redact(value.error_message,240),http_status:numeric(value.http_status),events:(Array.isArray(value.events)?value.events:[]).slice(-40).map(e=>({at:numeric(e?.at),stage:redact(e?.stage,40),status:redact(e?.status,32),message:redact(e?.message,240)}))};
}
export function parseReport(text){
 if(typeof text!=='string'||text.length>1024*1024)throw Error('Use a report smaller than 1 MB.');
 const trimmed=text.trim();let parsed;
 try{parsed=JSON.parse(trimmed);}catch{const start=trimmed.indexOf('{');if(start<0)throw Error('Paste the copied JSON report from the app.');try{parsed=JSON.parse(trimmed.slice(start));}catch{throw Error('The report is incomplete or is not valid JSON. Copy it again from the app.');}}
 let values=Array.isArray(parsed)?parsed:parsed.sessions||parsed.reports||(parsed.report?[parsed.report]:parsed.id?[parsed]:null);
 if(!Array.isArray(values)||!values.length)throw Error('No playback sessions found. Play an episode first, then copy a fresh report.');
 if(values.length>100)values=values.slice(0,100);
 return values.filter(v=>v&&typeof v==='object'&&!Array.isArray(v)).map(normalize).sort((a,b)=>(b.received_at||b.updated_at)-(a.received_at||a.updated_at));
}
export const key=report=>(report.client||'local')+':'+report.id;
export function filtered(reports,{provider='',status='',query=''}={}){const needle=query.trim().toLowerCase();return reports.filter(r=>(!provider||r.provider===provider)&&(!status||r.status===status)&&(!needle||(r.title+' '+label(r.provider)+' '+r.episode).toLowerCase().includes(needle)));}
export function diagnosis(r){
 if(r.status==='error'){
  if(r.stage==='provider_lookup'||r.error_code.startsWith('PROVIDER_'))return ['Provider lookup failed',r.error_message||'The provider did not return a playable episode URL.'];
  if(r.error_code.includes('NO_VIDEO_FRAME'))return ['No video frame was received','A stream URL was returned, but the player never rendered its first frame. Inspect the format, supported video tracks and preceding network events.'];
  if(r.error_code.includes('VIDEO_UNSUPPORTED'))return ['Video decoder unsupported',r.error_message||'The device cannot decode the selected video track.'];
  if(r.error_code.includes('SOURCE_HTML')||r.error_code.includes('SOURCE_JSON'))return ['The response was not a video',r.error_message];
  if(r.http_status)return ['Request failed · HTTP '+r.http_status,r.error_message||'Check the timeline to see whether the failure occurred at the provider API or media server.'];
  return ['Playback error',r.error_message||r.error_code||'Inspect the last event in the timeline.'];
 }
 if(r.status==='playing')return [r.attempts>1?'Playback recovered':'Video playback started',r.attempts>1?'The episode started after a retry. Earlier failures remain in its timeline.':'The player rendered a video frame and reported that it was playing.'];
 if(r.status==='resolving'||r.status==='retrying')return ['Waiting for the provider','The app is requesting a playable episode URL. A poster and episode count alone do not verify that the stream is available.'];
 if(r.status==='loading')return [r.first_frame_ms>=0?'Waiting for more video data':'Waiting for the first video frame',r.first_frame_ms>=0?'Playback previously started and is buffering again.':'Inspect stream resolution, format detection and decoder events below.'];
 if(r.status==='stopped'&&r.first_frame_ms<0)return ['Closed before the first frame','The player was stopped or the user left before a video frame was recorded. This alone does not establish the cause.'];
 if(r.status==='ended')return ['Episode finished','The player reported that the episode reached its end.'];
 return ['Last recorded state: '+r.status,'The timeline records the last events received for this episode.'];
}
export const exportReport=reports=>'BIDA REELS PLAYER DIAGNOSTICS\n\n'+JSON.stringify({schema:1,generated_at:Date.now(),sessions:reports.map(normalize)},null,2);
