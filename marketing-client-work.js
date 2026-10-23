/* Client-scoped requests + missions. Bottom mission table stays unfiltered.
   Client IDs/labels use the existing LUKEN_META_V1 mission metadata. */
(()=>{
'use strict';
const el=id=>document.getElementById(id),esc=escapeHtml;
const allowed=()=>!!user&&active==='marketing'&&hasAccess('marketing');
const directoryAllowed=()=>!!user&&hasAccess('marketing');
const writable=()=>allowed()&&canEdit('marketing');
let selected=null,activeTab='tasks',identity=null,directory=[],directoryUid=null,directoryPromise=null,directoryError='',directorySeq=0,requestSeq=0,requestRows=[],requestLoading=false,requestError='',editorSeq=0,editorLoading=false,editorError='';
const requestCounts=new Map();
const label=c=>c.brand_name+' · '+c.branch_name;
const parking=document.createElement('div');parking.hidden=true;document.body.append(parking);
const panel=document.createElement('div');panel.id='clientWork';panel.hidden=true;parking.append(panel);
const style=document.createElement('style');style.textContent=`#clientWork[hidden],#taskClientField[hidden]{display:none!important}#clientWork{margin-bottom:20px}.cw-body{padding:18px;display:grid;grid-template-columns:1fr 1fr;gap:16px}.cw-column{min-width:0;border:1px solid var(--border);border-radius:12px;padding:15px}.cw-column h3{margin:0 0 10px;font-size:15px}.cw-item{border-top:1px solid var(--border);padding:12px 0}.cw-item p{font-size:12px;color:#657083;line-height:1.7;margin:7px 0;white-space:pre-wrap;overflow-wrap:anywhere}.cw-line{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;align-items:center}.cw-title{font-weight:700;font-size:13px;overflow-wrap:anywhere}.cw-toggle{font-size:12px;display:flex;gap:6px;align-items:center;color:#737e90;margin-bottom:14px}.cw-toggle input{width:auto}.cw-count{font-size:12px;color:#5658db}.cw-msg{font-size:12px;color:#737e90;line-height:1.7}.cw-status{font-size:12px;padding:6px;border:1px solid var(--border);border-radius:8px}.cw-field-hint{font-size:11px;color:#737e90;line-height:1.7;margin:0}@media(max-width:760px){.cw-body{grid-template-columns:1fr;padding:12px;gap:12px}.cw-column{padding:13px}}`;
document.head.append(style);
style.textContent+=`#clientWork{margin:0;border-top:1px solid var(--border);background:#fff}#clientWork [hidden]{display:none!important}.cw-tabs{display:flex;gap:4px;padding:12px 14px 0;border-bottom:1px solid var(--border)}.cw-tab{border:0;background:transparent;padding:11px 12px;font-weight:700;font-size:13px;color:#737e90;border-bottom:2px solid transparent;min-height:44px;cursor:pointer}.cw-tab[aria-selected=true]{color:#5658db;border-color:#5658db}.cw-tab:focus-visible{outline:2px solid #5658db;outline-offset:-2px}.cw-pane{padding:16px}.cw-pane .actions{margin-bottom:14px}.cw-info-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.cw-info-grid dt{font-size:11px;color:#8490a1;margin-bottom:5px}.cw-info-grid dd{margin:0;font-size:13px;white-space:pre-wrap;overflow-wrap:anywhere}.cw-info-wide{grid-column:1/-1}.cw-pane .mr-item{margin-top:10px}.cw-toolbar{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap}.cw-toolbar .cw-toggle{margin:0}@media(max-width:460px){.cw-pane{padding:13px}.cw-tabs{padding-left:8px}.cw-tab{flex:1;padding:10px 8px}.cw-info-grid{grid-template-columns:1fr}}`;
panel.innerHTML='<div class="cw-tabs" role="tablist" aria-label="고객사 메뉴"><button class="cw-tab" id="cwTabTasks" data-cw-tab="tasks" role="tab" aria-selected="true" aria-controls="cwTaskPane">업무</button><button class="cw-tab" id="cwTabRequests" data-cw-tab="requests" role="tab" aria-selected="false" aria-controls="cwRequestPane">고객 요청</button><button class="cw-tab" id="cwTabInfo" data-cw-tab="info" role="tab" aria-selected="false" aria-controls="cwInfoPane">고객 정보</button></div><div class="cw-pane" id="cwTaskPane" role="tabpanel" aria-labelledby="cwTabTasks"><div class="cw-toolbar"><label class="cw-toggle"><input type="checkbox" id="cwTaskDone">완료 업무 포함</label><button class="btn primary" id="cwAdd">＋ 업무 등록</button></div><p class="cw-count" id="cwTaskCount"></p><div id="cwTasks"></div></div><div class="cw-pane" id="cwRequestPane" role="tabpanel" aria-labelledby="cwTabRequests" hidden><div class="cw-toolbar"><label class="cw-toggle"><input type="checkbox" id="cwRequestDone">완료 요청 포함</label><button class="small-btn" id="cwReload">새로고침</button></div><span class="cw-count" id="cwRequestCount"></span><p class="cw-msg" id="cwRequestInfo" role="status"></p><div id="cwRequests"></div></div><div class="cw-pane" id="cwInfoPane" role="tabpanel" aria-labelledby="cwTabInfo" hidden><div id="cwInfo"></div></div>';
const field=document.createElement('div');field.id='taskClientField';field.className='field';field.hidden=true;field.innerHTML='<label for="taskClient">고객사 / 지점</label><select id="taskClient"><option value="">고객사 미지정 · 내부 업무</option></select><p class="cw-field-hint" id="taskClientHint">선택한 고객사 화면과 전체 미션 목록에 함께 표시됩니다.</p>';
el('taskDetail').closest('.field').after(field);
function closeClient(){selected=null;requestSeq++;requestRows=[];requestLoading=false;panel.hidden=true;parking.append(panel);}
window.closeClientWork=()=>{closeClient();window.refreshMarketingClients?.();};
function clear(){closeClient();activeTab='tasks';identity=null;directorySeq++;editorSeq++;directory=[];directoryUid=null;directoryPromise=null;requestCounts.clear();requestError='';editorLoading=false;editorError='';el('cwRequests').replaceChildren();el('cwTasks').replaceChildren();el('cwInfo').replaceChildren();field.hidden=true;el('taskClient').innerHTML='<option value="">고객사 미지정 · 내부 업무</option>';}
window.clientRequestCount=id=>requestCounts.get(id);
window.isClientWorkOpen=id=>selected?.id===id;
function mount(){if(!selected)return false;const holder=el('client-work-'+selected.id);if(!holder){closeClient();return false;}if(panel.parentElement!==holder)holder.append(panel);panel.hidden=false;return true;}
function tab(name){if(!['tasks','requests','info'].includes(name))return;activeTab=name;for(const [key,id]of [['tasks','cwTaskPane'],['requests','cwRequestPane'],['info','cwInfoPane']])el(id).hidden=key!==name;panel.querySelectorAll('[data-cw-tab]').forEach(b=>{b.setAttribute('aria-selected',String(b.dataset.cwTab===name));b.tabIndex=b.dataset.cwTab===name?0:-1;});}
function drawInfo(){
 if(!selected||!allowed())return;const c=window.getMarketingClient?.(selected.id)||directory.find(c=>c.id===selected.id);if(!c)return;
 const fields=[['담당자',c.contact_name],['연락처',c.phone],['이메일',c.email],['진행 상태',c.status],['계약 기간',(c.contract_start||'미정')+' ~ '+(c.contract_end||'미정')],['이용 서비스',c.service],['주소',c.address],['메모',c.memo]];
 el('cwInfo').innerHTML='<div class="actions">'+(writable()?'<button class="btn" id="cwEditInfo">고객 정보 수정</button>'+(c.status!=='계약 종료'?'<button class="btn" data-client-request-link="'+esc(c.id)+'" data-client-label="'+esc(label(c))+'">요청 링크</button>':''):'<span class="cw-msg">조회 전용</span>')+'</div><dl class="cw-info-grid">'+fields.map(([name,value])=>'<div'+(['주소','메모'].includes(name)?' class="cw-info-wide"':'')+'><dt>'+name+'</dt><dd>'+esc(value||'미등록')+'</dd></div>').join('')+'</dl>';
 const edit=el('cwEditInfo');if(edit)edit.onclick=()=>window.editMarketingClient?.(selected.id);
}
window.missionClientName=t=>{if(t.unit!=='marketing')return '';const c=directory.find(c=>c.id===t.clientId);return c?label(c):t.clientLabel||'고객사 미지정';};
async function loadDirectory(force=false){
 if(!directoryAllowed())return [];const uid=user.id;
 if(directoryPromise&&directoryUid===uid)return directoryPromise;
 if(!force&&directoryUid===uid)return directory;
 const token=++directorySeq;directoryUid=uid;directoryError='';
 const promise=(async()=>{try{const result=await db.from('marketing_clients').select('id,brand_name,branch_name').order('brand_name').limit(1000);if(token!==directorySeq||!directoryAllowed()||user.id!==uid)return [];if(result.error)throw result.error;directory=result.data||[];return directory;}catch(e){if(token===directorySeq){directoryError='고객사 목록을 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.';}return [];}finally{if(token===directorySeq)directoryPromise=null;}})();
 directoryPromise=promise;return promise;
}
function drawTasks(){
 if(!selected||!allowed())return;
 const all=state.tasks.filter(t=>t.unit==='marketing'&&t.clientId===selected.id);
 const tasks=all.filter(t=>el('cwTaskDone').checked||t.status!=='완료').sort((a,b)=>(a.status==='완료')-(b.status==='완료')||(a.due||'9999').localeCompare(b.due||'9999'));
 el('cwTaskCount').textContent=tasks.length+'건 / 전체 '+all.length+'건';
 el('cwTasks').innerHTML=tasks.map(t=>'<article class="cw-item"><div class="cw-line"><span class="cw-title">'+esc(t.title)+'</span>'+(writable()?'<button class="small-btn" data-cw-edit="'+esc(t.id)+'">수정</button>':'')+'</div><p>'+esc(t.detail||'업무 내용 미등록')+'</p><div class="cw-line"><span class="cw-msg">마감 '+esc(t.due||'미설정')+'</span>'+(writable()?'<select class="cw-status" data-cw-status="'+esc(t.id)+'" aria-label="'+esc(t.title)+' 상태">'+['진행 중','완료','보류'].map(s=>'<option'+(t.status===s?' selected':'')+'>'+s+'</option>').join('')+'</select>':'<span class="cw-msg">'+esc(t.status)+'</span>')+'</div></article>').join('')||'<p class="cw-msg">'+(all.length?'표시할 미완료 미션이 없습니다.':'이 고객사에 연결된 미션이 없습니다. 새 미션을 등록하거나 기존 미션을 수정해 고객사를 지정하세요.')+'</p>';
 panel.querySelectorAll('[data-cw-edit]').forEach(b=>b.onclick=()=>openEditor(b.dataset.cwEdit));
 panel.querySelectorAll('[data-cw-status]').forEach(b=>b.onchange=()=>updateMissionStatus(b.dataset.cwStatus,b.value,b));
}
function drawRequests(){
 if(!selected||!allowed())return;
 el('cwRequestInfo').textContent=requestLoading?'요청을 불러오는 중입니다…':requestError||(requestRows.length===200?'최근 200건까지 표시됩니다.':'요청을 눌러 처리 상태와 내부 메모를 관리하세요.');
 const rows=requestRows.filter(r=>el('cwRequestDone').checked||r.status!=='완료').sort((a,b)=>(a.status==='완료')-(b.status==='완료')||(a.desired_date||'9999').localeCompare(b.desired_date||'9999'));
 el('cwRequestCount').textContent=requestLoading||requestError?'':rows.length+'건';
 el('cwRequests').innerHTML=requestLoading||requestError?'':rows.map(r=>'<button class="mr-item" type="button" data-cw-request="'+esc(r.id)+'"><span class="cw-line"><span class="mr-label">'+esc(r.status)+'</span><span class="cw-msg">희망일 '+esc(r.desired_date||'미지정')+'</span></span><p>'+esc(r.content)+'</p></button>').join('')||'<p class="cw-msg">해당 상태의 고객 요청이 없습니다.</p>';
 panel.querySelectorAll('[data-cw-request]').forEach(b=>b.onclick=()=>window.openMarketingRequestDetail?.(b.dataset.cwRequest));
}
async function loadRequests(){
 if(!selected||!allowed())return;const token=++requestSeq,uid=user.id,id=selected.id;requestLoading=true;requestError='';requestRows=[];drawRequests();
 try{const result=await db.from('marketing_requests').select('id,client_id,content,desired_date,status,created_at').eq('client_id',id).order('created_at',{ascending:false}).limit(200);if(token!==requestSeq||!allowed()||user.id!==uid||selected?.id!==id)return;if(result.error)throw result.error;requestRows=result.data||[];requestCounts.set(id,requestRows.filter(r=>r.status!=='완료').length);window.refreshMarketingClients?.();}
 catch(e){if(token===requestSeq)requestError=['42P01','PGRST205'].includes(e.code)?'고객 요청 설정이 필요합니다. marketing-requests.sql을 실행해 주세요.':'요청을 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.';}
 finally{if(token===requestSeq){requestLoading=false;drawRequests();}}
}
function sync(){
 if(!allowed()||identity&&identity!==user.id){clear();}
 if(!allowed())return;
 identity=user.id;el('missionListTitle').textContent='전체 고객사 미션';
 if(directoryUid!==user.id)loadDirectory().then(()=>{if(allowed())render();});
 if(selected&&mount()){const c=directory.find(c=>c.id===selected.id);if(c)selected={id:c.id,label:label(c)};el('cwAdd').hidden=!writable();tab(activeTab);drawTasks();drawRequests();drawInfo();}
}
const prior=render;render=function(){prior();if(active!=='marketing')el('missionListTitle').textContent='미션 목록';sync();};
window.openClientWork=async id=>{
 if(!allowed())return;if(selected?.id===id){closeClient();window.refreshMarketingClients?.();return;}identity=user.id;const uid=user.id;await loadDirectory(true);if(!allowed()||user.id!==uid)return;const c=directory.find(c=>c.id===id);if(!c){alert(directoryError||'고객사를 찾을 수 없습니다. 새로고침해 주세요.');return;}
 selected={id:c.id,label:label(c)};activeTab='tasks';el('cwTaskDone').checked=false;el('cwRequestDone').checked=false;window.refreshMarketingClients?.();sync();loadRequests();
};
window.prepareTaskClient=async task=>{
 const token=++editorSeq;const marketing=el('taskUnit').value==='marketing';field.hidden=!marketing;if(!marketing){editorLoading=false;return;}
 const uid=user?.id,taskId=el('editId').value,desired=task?.clientId||(!task?selected?.id:null)||'';editorLoading=true;editorError='';el('taskClient').disabled=true;el('taskClientHint').textContent='고객사 목록을 불러오는 중입니다…';
 await loadDirectory(true);if(token!==editorSeq||!directoryAllowed()||user.id!==uid||el('editId').value!==taskId||el('taskUnit').value!=='marketing')return;
 el('taskClient').innerHTML='<option value="">고객사 미지정 · 내부 업무</option>'+directory.map(c=>'<option value="'+esc(c.id)+'">'+esc(label(c))+'</option>').join('');
 if(desired&&!directory.some(c=>c.id===desired))el('taskClient').insertAdjacentHTML('beforeend','<option value="'+esc(desired)+'">'+esc(task?.clientLabel||'기존 연결 고객사')+'</option>');
 el('taskClient').value=desired;editorLoading=false;editorError=directoryError;el('taskClient').disabled=!!directoryError;el('taskClientHint').textContent=directoryError||'이 고객사 화면과 맨 아래 전체 미션 목록에 함께 표시됩니다.';
};
window.getTaskClientSelection=old=>{
 if(el('taskUnit').value!=='marketing')return {clientId:null,clientLabel:''};
 if(editorLoading||editorError){alert(editorError||'고객사 목록을 불러온 뒤 저장해 주세요.');return false;}
 const id=el('taskClient').value;if(!id)return {clientId:null,clientLabel:''};const c=directory.find(c=>c.id===id);
 return {clientId:id,clientLabel:c?label(c):old?.clientLabel||'기존 연결 고객사'};
};
el('taskUnit').addEventListener('change',()=>{const t=state.tasks.find(x=>x.id===el('editId').value);window.prepareTaskClient(t);});
el('cwAdd').onclick=()=>{if(writable())openEditor();};el('cwReload').onclick=async()=>{if(!allowed())return;await loadTasks();await loadRequests();};
el('cwTaskDone').onchange=drawTasks;el('cwRequestDone').onchange=drawRequests;
panel.querySelectorAll('[data-cw-tab]').forEach((b,index,buttons)=>{b.onclick=()=>tab(b.dataset.cwTab);b.onkeydown=e=>{let next;if(e.key==='ArrowRight')next=(index+1)%buttons.length;else if(e.key==='ArrowLeft')next=(index+buttons.length-1)%buttons.length;else if(e.key==='Home')next=0;else if(e.key==='End')next=buttons.length-1;else return;e.preventDefault();tab(buttons[next].dataset.cwTab);buttons[next].focus();};});
document.addEventListener('click',e=>{const b=e.target.closest('[data-client-work]');if(b)window.openClientWork(b.dataset.clientWork);});
document.addEventListener('luken-clients-updated',e=>{if(!allowed()||!Array.isArray(e.detail))return;directory=e.detail;directoryUid=user.id;render();});
document.addEventListener('luken-clients-rendered',()=>{if(allowed()&&selected)sync();});
document.addEventListener('luken-request-updated',()=>{if(selected&&allowed())loadRequests();});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&selected&&allowed())loadRequests();});
setInterval(()=>{if(document.visibilityState==='visible'&&selected&&allowed()&&!requestLoading)loadRequests();},60000);
sync();
})();
