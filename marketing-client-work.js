/* Client-scoped requests + missions. Bottom mission table stays unfiltered.
   Client IDs/labels use the existing LUKEN_META_V1 mission metadata. */
(()=>{
'use strict';
const el=id=>document.getElementById(id),esc=escapeHtml;
const allowed=()=>!!user&&active==='marketing'&&hasAccess('marketing');
const directoryAllowed=()=>!!user&&hasAccess('marketing');
const writable=()=>allowed()&&canEdit('marketing');
let selected=null,identity=null,directory=[],directoryUid=null,directoryPromise=null,directoryError='',directorySeq=0,requestSeq=0,requestRows=[],requestLoading=false,requestError='',editorSeq=0,editorLoading=false,editorError='';
const label=c=>c.brand_name+' · '+c.branch_name;
const panel=document.createElement('section');panel.className='panel';panel.id='clientWork';panel.hidden=true;el('marketingRequests').before(panel);
const style=document.createElement('style');style.textContent=`#clientWork[hidden],#taskClientField[hidden]{display:none!important}#clientWork{margin-bottom:20px}.cw-body{padding:18px;display:grid;grid-template-columns:1fr 1fr;gap:16px}.cw-column{min-width:0;border:1px solid var(--border);border-radius:12px;padding:15px}.cw-column h3{margin:0 0 10px;font-size:15px}.cw-item{border-top:1px solid var(--border);padding:12px 0}.cw-item p{font-size:12px;color:#657083;line-height:1.7;margin:7px 0;white-space:pre-wrap;overflow-wrap:anywhere}.cw-line{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;align-items:center}.cw-title{font-weight:700;font-size:13px;overflow-wrap:anywhere}.cw-toggle{font-size:12px;display:flex;gap:6px;align-items:center;color:#737e90;margin-bottom:14px}.cw-toggle input{width:auto}.cw-count{font-size:12px;color:#5658db}.cw-msg{font-size:12px;color:#737e90;line-height:1.7}.cw-status{font-size:12px;padding:6px;border:1px solid var(--border);border-radius:8px}.cw-field-hint{font-size:11px;color:#737e90;line-height:1.7;margin:0}@media(max-width:760px){.cw-body{grid-template-columns:1fr;padding:12px;gap:12px}.cw-column{padding:13px}}`;
document.head.append(style);
panel.innerHTML='<div class="panel-head"><div><h2 id="cwName">고객사별 업무</h2><p>이 매장의 요청과 미션을 함께 관리합니다. 맨 아래 목록에는 전체 고객사 미션이 표시됩니다.</p></div><div class="actions"><button class="btn primary" id="cwAdd">＋ 이 고객사 미션</button><button class="btn" id="cwReload">새로고침</button><button class="btn" id="cwClose">접기</button></div></div><div class="cw-body"><section class="cw-column"><div class="cw-line"><h3>고객 요청 <span class="cw-count" id="cwRequestCount"></span></h3><button class="small-btn" id="cwAllRequests">요청 목록 열기</button></div><label class="cw-toggle"><input type="checkbox" id="cwRequestDone">완료 요청 포함</label><p class="cw-msg" id="cwRequestInfo" role="status"></p><div id="cwRequests"></div></section><section class="cw-column"><h3>미션 <span class="cw-count" id="cwTaskCount"></span></h3><label class="cw-toggle"><input type="checkbox" id="cwTaskDone">완료 미션 포함</label><div id="cwTasks"></div></section></div>';
const field=document.createElement('div');field.id='taskClientField';field.className='field';field.hidden=true;field.innerHTML='<label for="taskClient">고객사 / 지점</label><select id="taskClient"><option value="">고객사 미지정 · 내부 업무</option></select><p class="cw-field-hint" id="taskClientHint">선택한 고객사 화면과 전체 미션 목록에 함께 표시됩니다.</p>';
el('taskDetail').closest('.field').after(field);
function clear(){selected=null;identity=null;requestSeq++;directorySeq++;editorSeq++;directory=[];directoryUid=null;directoryPromise=null;requestRows=[];requestError='';requestLoading=false;editorLoading=false;editorError='';panel.hidden=true;el('cwRequests').replaceChildren();el('cwTasks').replaceChildren();field.hidden=true;el('taskClient').innerHTML='<option value="">고객사 미지정 · 내부 업무</option>';}
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
 el('cwRequestInfo').textContent=requestLoading?'요청을 불러오는 중입니다…':requestError||(requestRows.length===200?'최근 200건입니다. 요청 목록에서 더 확인하세요.':'요청을 눌러 처리 상태와 내부 메모를 관리하세요.');
 const rows=requestRows.filter(r=>el('cwRequestDone').checked||r.status!=='완료').sort((a,b)=>(a.status==='완료')-(b.status==='완료')||(a.desired_date||'9999').localeCompare(b.desired_date||'9999'));
 el('cwRequestCount').textContent=requestLoading||requestError?'':rows.length+'건';
 el('cwRequests').innerHTML=requestLoading||requestError?'':rows.map(r=>'<button class="mr-item" type="button" data-cw-request="'+esc(r.id)+'"><span class="cw-line"><span class="mr-label">'+esc(r.status)+'</span><span class="cw-msg">희망일 '+esc(r.desired_date||'미지정')+'</span></span><p>'+esc(r.content)+'</p></button>').join('')||'<p class="cw-msg">해당 상태의 고객 요청이 없습니다.</p>';
 panel.querySelectorAll('[data-cw-request]').forEach(b=>b.onclick=()=>window.openMarketingRequestDetail?.(b.dataset.cwRequest));
}
async function loadRequests(){
 if(!selected||!allowed())return;const token=++requestSeq,uid=user.id,id=selected.id;requestLoading=true;requestError='';requestRows=[];drawRequests();
 try{const result=await db.from('marketing_requests').select('id,client_id,content,desired_date,status,created_at').eq('client_id',id).order('created_at',{ascending:false}).limit(200);if(token!==requestSeq||!allowed()||user.id!==uid||selected?.id!==id)return;if(result.error)throw result.error;requestRows=result.data||[];}
 catch(e){if(token===requestSeq)requestError=['42P01','PGRST205'].includes(e.code)?'고객 요청 설정이 필요합니다. marketing-requests.sql을 실행해 주세요.':'요청을 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.';}
 finally{if(token===requestSeq){requestLoading=false;drawRequests();}}
}
function sync(){
 if(!allowed()||identity&&identity!==user.id){clear();}
 if(!allowed())return;
 identity=user.id;el('missionListTitle').textContent='전체 고객사 미션';
 if(directoryUid!==user.id)loadDirectory().then(()=>{if(allowed())render();});
 if(selected){const c=directory.find(c=>c.id===selected.id);if(c)selected={id:c.id,label:label(c)};panel.hidden=false;el('cwName').textContent=selected.label+' · 업무·요청';el('cwAdd').hidden=!writable();drawTasks();drawRequests();}
}
const prior=render;render=function(){prior();if(active!=='marketing')el('missionListTitle').textContent='미션 목록';sync();};
window.openClientWork=async id=>{
 if(!allowed())return;identity=user.id;const uid=user.id;await loadDirectory(true);if(!allowed()||user.id!==uid)return;const c=directory.find(c=>c.id===id);if(!c){alert(directoryError||'고객사를 찾을 수 없습니다. 새로고침해 주세요.');return;}
 selected={id:c.id,label:label(c)};el('cwTaskDone').checked=false;el('cwRequestDone').checked=false;sync();panel.scrollIntoView({behavior:'smooth',block:'start'});loadRequests();
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
el('cwAdd').onclick=()=>{if(writable())openEditor();};el('cwClose').onclick=()=>{selected=null;panel.hidden=true;requestSeq++;};el('cwReload').onclick=async()=>{if(!allowed())return;await loadTasks();await loadRequests();};
el('cwAllRequests').onclick=()=>{if(selected)window.openMarketingRequests?.(selected);};el('cwTaskDone').onchange=drawTasks;el('cwRequestDone').onchange=drawRequests;
document.addEventListener('click',e=>{const b=e.target.closest('[data-client-work]');if(b)window.openClientWork(b.dataset.clientWork);});
document.addEventListener('luken-clients-updated',e=>{if(!allowed()||!Array.isArray(e.detail))return;directory=e.detail;directoryUid=user.id;render();});
document.addEventListener('luken-request-updated',()=>{if(selected&&allowed())loadRequests();});
sync();
})();
