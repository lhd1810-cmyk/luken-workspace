/* Internal request inbox + per-client submission links. No public history/chat. */
(()=>{
'use strict';
const esc=escapeHtml,$r=id=>document.getElementById(id);
const allowed=()=>!!user&&active==='marketing'&&hasAccess('marketing');
const write=()=>allowed()&&canEdit('marketing');
let opened=false,loading=false,rows=[],error='',seq=0,identity=null,editing=null,saving=false,linkClient=null,linkBusy=false,linkSeq=0,pendingCount=null,countBusy=false,detailSeq=0;
const statuses=['접수','처리 중','완료'];
const nowDate=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const time=value=>new Date(value).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});
const panel=document.createElement('section');panel.id='marketingRequests';panel.className='panel';panel.hidden=true;$r('leadPanel').before(panel);
const style=document.createElement('style');style.textContent=`#marketingRequests[hidden]{display:none!important}#marketingRequests{margin-bottom:20px}.mr-filters{display:flex;gap:8px;flex-wrap:wrap;width:100%}.mr-filters input,.mr-filters select{padding:10px;border:1px solid var(--border);border-radius:9px;max-width:100%}.mr-filters input{flex:1;min-width:150px}.mr-list{padding:0 18px 18px}.mr-item{display:block;width:100%;text-align:left;border:1px solid var(--border);border-radius:12px;background:white;padding:15px;margin-top:12px;color:var(--ink);cursor:pointer}.mr-item:hover{border-color:#aaaee8}.mr-line{display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap}.mr-item p{white-space:pre-wrap;overflow-wrap:anywhere;font-size:13px;line-height:1.6;margin:12px 0;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}.mr-muted{font-size:12px;color:#737e90;line-height:1.7}.mr-label{font-size:11px;padding:5px 9px;border-radius:6px;background:#eeefff;color:#5658db}.mr-late{color:#b42318;font-weight:700}.mr-photo-grid{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px}.mr-photo-grid a{width:calc((100% - 20px)/3);font-size:11px;overflow-wrap:anywhere;color:#5658db}.mr-photo-grid img{width:100%;height:120px;object-fit:cover;border-radius:9px}.mr-dialog{border:0;border-radius:16px;width:min(640px,calc(100% - 24px));padding:24px;max-height:90dvh;overflow:auto;color:var(--ink)}.mr-dialog::backdrop{background:#12182977}.mr-dialog h2{margin-top:0;font-size:20px}.mr-content{white-space:pre-wrap;overflow-wrap:anywhere;background:#f7f8fc;padding:15px;border-radius:10px;line-height:1.8;font-size:14px;margin:16px 0}.mr-error{color:#b42318;white-space:pre-wrap;font-size:13px}.mr-dialog input[type=checkbox]{width:auto}.mr-dialog input:disabled,.mr-dialog textarea:disabled{opacity:1;color:#475166}.mr-check{display:flex;gap:8px;align-items:center;margin:14px 0;font-size:13px}.mr-links{display:flex;gap:8px;flex-wrap:wrap}.mc-client-actions{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}.mr-count{font-size:12px;font-weight:700;color:#5658db}@media(max-width:760px){.mr-list{padding:0 12px 12px}.mr-dialog{padding:20px 16px}.mr-photo-grid a{width:calc((100% - 10px)/2)}.mc-branch{flex-wrap:wrap}.mc-client-actions{justify-content:flex-start}}`;
document.head.append(style);
panel.innerHTML='<div class="panel-head"><div><h2>고객 요청</h2><p>추가 대화와 완료 안내는 기존 카톡으로 진행하세요.</p></div><div class="actions"><button class="btn" id="mrReload">새로고침</button><button class="btn" id="mrClose">접기</button></div><div class="mr-filters"><input id="mrSearch" placeholder="매장명 · 요청 내용 검색" aria-label="고객 요청 검색"><select id="mrFilter" aria-label="요청 상태"><option value="open">미완료 요청</option><option>접수</option><option>처리 중</option><option>완료</option><option value="all">전체 요청</option></select></div><p class="mr-muted" id="mrSummary"></p></div><p class="mc-msg" id="mrMessage" role="status"></p><div class="mr-list" id="mrList"></div>';
const dialog=document.createElement('dialog');dialog.id='mrDialog';dialog.className='mr-dialog';dialog.innerHTML='<form id="mrForm"><h2>고객 요청 상세</h2><b id="mrClient"></b><p class="mr-muted" id="mrDates"></p><div class="mr-content" id="mrContent"></div><div class="mr-photo-grid" id="mrPhotos"></div><div class="notice mr-muted">고객에게는 내부 처리 상태와 메모가 공개되지 않습니다. 일정·추가 비용·완료 안내는 카톡으로 전달하세요.</div><div class="field" style="margin-top:18px"><label for="mrStatus">처리 상태</label><select id="mrStatus">'+statuses.map(x=>'<option>'+x+'</option>').join('')+'</select></div><label class="mr-check"><input type="checkbox" id="mrExtra">추가 비용 협의 필요</label><div class="field"><label for="mrNote">내부 처리 메모</label><textarea id="mrNote" maxlength="5000" placeholder="처리 내용이나 카톡으로 협의한 내용을 적어두세요."></textarea></div><p class="mr-error" id="mrError" role="alert"></p><div class="modal-actions"><button class="btn" id="mrCancel" type="button">닫기</button><button class="btn primary" id="mrSave" type="submit">저장</button></div></form>';document.body.append(dialog);
const linkDialog=document.createElement('dialog');linkDialog.id='mrLinkDialog';linkDialog.className='mr-dialog';linkDialog.innerHTML='<h2>고객 요청 링크</h2><b id="mrLinkLabel"></b><p class="mr-muted">이 매장 전용 링크를 카톡으로 보내주세요. 고객은 같은 링크를 계속 사용하면 됩니다.</p><div class="field"><label for="mrLinkUrl">요청서 링크</label><input id="mrLinkUrl" readonly></div><p id="mrLinkState" class="mr-muted"></p><div class="mr-links"><button class="btn primary" id="mrLinkCopy">링크 복사</button><button class="btn" id="mrLinkRotate">새 링크 발급</button><button class="btn danger" id="mrLinkRevoke">사용 중지</button><button class="btn" id="mrLinkClose">닫기</button></div><p class="mr-error" id="mrLinkError" role="alert"></p>';document.body.append(linkDialog);
function badge(){const el=$r('mrPending');if(el)el.textContent=pendingCount==null?'요청을 확인하고 처리 상태를 관리합니다.':'미완료 요청 '+pendingCount+'건';}
function sync(){
 if(!allowed()||identity&&identity!==user.id){opened=false;rows=[];seq++;detailSeq++;linkSeq++;identity=null;pendingCount=null;editing=null;linkClient=null;if(dialog.open)dialog.close();if(linkDialog.open)linkDialog.close();$r('mrForm').reset();$r('mrPhotos').replaceChildren();$r('mrList').replaceChildren();$r('mrLinkUrl').value='';}
 if(!write()&&linkDialog.open){linkSeq++;linkClient=null;linkDialog.close();$r('mrLinkUrl').value='';}
 if(dialog.open){$r('mrSave').hidden=!write();for(const id of ['mrStatus','mrNote','mrExtra'])$r(id).disabled=!write()||saving;}
 panel.hidden=!opened||!allowed();badge();
}
const prev=render;render=function(){prev();sync();};
function setupError(e){return ['42P01','PGRST202','PGRST205','42883'].includes(e.code)?'고객 요청 저장소 설정이 필요합니다. Supabase SQL Editor에서 marketing-requests.sql을 한 번 실행해 주세요.':e.message||'연결과 권한을 확인한 뒤 다시 시도해 주세요.';}
async function count(){
 if(!allowed()||countBusy)return;const uid=user.id;countBusy=true;
 try{const result=await db.from('marketing_requests').select('id',{count:'exact',head:true}).neq('status','완료');if(!result.error&&allowed()&&user.id===uid){pendingCount=result.count;badge();}}
 finally{countBusy=false;}
}
window.openMarketingRequests=()=>{if(!allowed())return;opened=true;sync();panel.scrollIntoView({behavior:'smooth',block:'start'});load();};
function draw(){
 if(!allowed())return;
 $r('mrMessage').textContent=loading?'요청을 불러오는 중입니다…':error|| (rows.length===500?'최근 500건을 표시합니다. 상태 필터로 범위를 좁혀주세요.':'');
 const q=$r('mrSearch').value.trim().toLowerCase();
 const list=rows.filter(r=>[r.client_label,r.content].some(x=>String(x).toLowerCase().includes(q))).sort((a,b)=>(a.status==='완료')-(b.status==='완료')||(a.desired_date||'9999').localeCompare(b.desired_date||'9999')||a.created_at.localeCompare(b.created_at));
 $r('mrSummary').textContent=loading||error?'':'현재 '+list.length+'건 · 희망일이 빠른 요청부터 표시';
 $r('mrList').innerHTML=loading||error?'':list.map(r=>'<button class="mr-item" type="button" data-mr-id="'+esc(r.id)+'"><span class="mr-line"><b>'+esc(r.client_label)+'</b><span class="mr-label">'+esc(r.status)+'</span></span><p>'+esc(r.content)+'</p><span class="mr-line"><span class="mr-muted '+(r.status!=='완료'&&r.desired_date&&r.desired_date<nowDate()?'mr-late':'')+'">희망일 '+esc(r.desired_date||'미지정')+(r.extra_cost?' · 추가 비용 협의':'')+'</span><span class="mr-muted">접수 '+esc(time(r.created_at))+'</span></span></button>').join('')||'<p class="mc-msg">'+(q?'검색 조건에 맞는 요청이 없습니다.':'해당 상태의 요청이 없습니다. 고객사 관리에서 요청 링크를 복사해 전달해 주세요.')+'</p>';
 panel.querySelectorAll('[data-mr-id]').forEach(b=>b.onclick=()=>detail(b.dataset.mrId));
}
async function load(){
 if(!allowed())return;const token=++seq,uid=user.id;identity=uid;loading=true;error='';rows=[];draw();
 try{let query=db.from('marketing_requests').select('id,client_label,content,desired_date,status,extra_cost,created_at,updated_at').order('created_at',{ascending:false}).limit(500);const f=$r('mrFilter').value;if(f==='open')query=query.neq('status','완료');else if(f!=='all')query=query.eq('status',f);const result=await query;if(token!==seq||!allowed()||user.id!==uid)return;if(result.error)throw result.error;rows=result.data||[];await count();}
 catch(e){if(token===seq)error=setupError(e);}
 finally{if(token===seq){loading=false;draw();}}
}
async function detail(id){
 if(!allowed()||loading||saving)return;const token=++detailSeq,uid=user.id;
 $r('mrMessage').textContent='요청 상세를 불러오는 중입니다…';
 try{const result=await db.from('marketing_requests').select('*').eq('id',id).single();if(token!==detailSeq||!allowed()||user.id!==uid)return;if(result.error)throw result.error;editing=result.data;if(!editing)throw Error('요청을 찾을 수 없습니다.');const r=editing;
  $r('mrClient').textContent=r.client_label;$r('mrDates').textContent='접수 '+time(r.created_at)+' · 희망일 '+(r.desired_date||'미지정');$r('mrContent').textContent=r.content;
  $r('mrPhotos').replaceChildren();for(const p of r.photos||[]){if(typeof p.data!=='string'||p.data.length>950000||!/^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/]*={0,2}$/.test(p.data))continue;const a=document.createElement('a');a.href=p.data;a.download=p.name||'고객사진.jpg';const img=document.createElement('img');img.src=p.data;img.alt=p.name||'첨부 사진';a.append(img,document.createTextNode('사진 저장'));$r('mrPhotos').append(a);}
  $r('mrStatus').value=r.status;$r('mrNote').value=r.internal_note||'';$r('mrExtra').checked=r.extra_cost;$r('mrError').textContent='';$r('mrSave').hidden=!write();for(const id of ['mrStatus','mrNote','mrExtra'])$r(id).disabled=!write();dialog.showModal();$r('mrMessage').textContent='';
 }catch(e){if(token===detailSeq&&allowed())$r('mrMessage').textContent=setupError(e);}
}
function busy(value){saving=value;dialog.querySelectorAll('button,input,textarea,select').forEach(el=>el.disabled=value);$r('mrSave').textContent=value?'저장 중…':'저장';}
$r('mrForm').onsubmit=async e=>{
 e.preventDefault();if(!write()||saving||!editing)return;const uid=user.id;busy(true);$r('mrError').textContent='';
 try{const result=await db.rpc('luken_update_request',{p_id:editing.id,p_version:editing.updated_at,p_status:$r('mrStatus').value,p_note:$r('mrNote').value.trim(),p_extra_cost:$r('mrExtra').checked});if(result.error)throw result.error;if(!result.data?.id)throw Error('저장 결과를 확인하지 못했습니다.');if(!write()||user.id!==uid)return;dialog.close();await load();}
 catch(e){if(write()&&user.id===uid)$r('mrError').textContent=setupError(e);}
 finally{busy(false);}
};
async function link(action='get'){
 if(!write()||linkBusy||!linkClient)return;const uid=user.id,id=linkClient.id,token=++linkSeq;linkBusy=true;$r('mrLinkError').textContent='';linkDialog.querySelectorAll('button').forEach(b=>b.disabled=true);
 try{const result=await db.rpc('luken_request_link',{p_client_id:id,p_action:action});if(token!==linkSeq||!write()||user.id!==uid||linkClient?.id!==id)return;if(result.error)throw result.error;if(!result.data?.token)throw Error('링크를 확인하지 못했습니다.');const url=new URL('customer-request/',location.href);url.search='';url.hash=new URLSearchParams({token:result.data.token}).toString();$r('mrLinkUrl').value=result.data.enabled?url.href:'';$r('mrLinkState').textContent=result.data.enabled?'사용 중 · 링크로 요청만 제출할 수 있습니다.':'사용 중지됨 · 새 링크를 발급하면 다시 접수할 수 있습니다.';}
 catch(e){if(token===linkSeq&&write())$r('mrLinkError').textContent=setupError(e);}
 finally{linkBusy=false;if(token===linkSeq){linkDialog.querySelectorAll('button').forEach(b=>b.disabled=false);$r('mrLinkCopy').disabled=!$r('mrLinkUrl').value;}}
}
document.addEventListener('click',e=>{
 const b=e.target.closest('[data-client-request-link]');if(!b||!write()||linkBusy)return;
 identity=user.id;linkClient={id:b.dataset.clientRequestLink,label:b.dataset.clientLabel};$r('mrLinkLabel').textContent=linkClient.label;$r('mrLinkUrl').value='';$r('mrLinkState').textContent='링크를 준비하고 있습니다…';$r('mrLinkError').textContent='';linkDialog.showModal();link();
});
$r('mrLinkCopy').onclick=async()=>{const url=$r('mrLinkUrl').value;if(!url||!write())return;try{await navigator.clipboard.writeText(url);$r('mrLinkState').textContent='복사했습니다. 고객에게 카톡으로 전달해 주세요.';}catch{$r('mrLinkUrl').focus();$r('mrLinkUrl').select();$r('mrLinkError').textContent='위 링크를 선택해 직접 복사해 주세요.';}};
$r('mrLinkRotate').onclick=()=>{if(confirm('기존 링크는 더 이상 사용할 수 없습니다. 새 링크를 발급할까요?'))link('rotate');};
$r('mrLinkRevoke').onclick=()=>{if(confirm('이 매장의 요청 링크를 중지할까요? 기존 요청은 유지됩니다.'))link('revoke');};
$r('mrLinkClose').onclick=()=>{if(!linkBusy)linkDialog.close();};linkDialog.addEventListener('cancel',e=>{if(linkBusy)e.preventDefault();});
$r('mrCancel').onclick=()=>{if(!saving)dialog.close();};dialog.addEventListener('cancel',e=>{if(saving)e.preventDefault();});
$r('mrReload').onclick=load;$r('mrClose').onclick=()=>{opened=false;panel.hidden=true;};$r('mrSearch').oninput=draw;$r('mrFilter').onchange=load;
setInterval(()=>{if(allowed()&&document.visibilityState==='visible'){count().catch(()=>{});if(opened&&!loading&&!saving&&!dialog.open)load();}},60000);
document.addEventListener('visibilitychange',()=>{if(allowed()&&document.visibilityState==='visible'){count().catch(()=>{});if(opened&&!dialog.open)load();}});
sync();
})();
