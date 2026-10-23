/* LUKEN customer directory: Supabase storage, branch-scoped RLS required. */
(()=>{
'use strict';
const esc=escapeHtml;
const allowed=()=>!!user&&active==='marketing'&&hasAccess('marketing');
const writable=()=>allowed()&&canEdit('marketing');
const statuses=['상담 중','진행 중','보류','계약 종료'];
let opened=false,rows=[],loading=false,error='',request=0,ownerId=null,saving=false,editing=null;
const panel=document.createElement('section');panel.id='marketingClients';panel.className='panel';panel.hidden=true;
$('leadPanel').before(panel);
const style=document.createElement('style');style.textContent=`#marketingClients[hidden]{display:none!important}#marketingClients{margin-bottom:20px}.mc-toolbar{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.mc-toolbar input,.mc-toolbar select{padding:10px;border:1px solid var(--border);border-radius:9px;max-width:100%}.mc-body{padding:16px 20px}.mc-brand{border:1px solid var(--border);border-radius:12px;margin-bottom:14px;overflow:hidden}.mc-brand h3{margin:0;padding:14px;background:#f7f8fc;font-size:15px}.mc-branch{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:14px;border-top:1px solid var(--border)}.mc-branch p{margin:6px 0;color:#657083;font-size:12px;white-space:pre-wrap;overflow-wrap:anywhere}.mc-status{font-size:11px;background:#eeefff;color:#5658db;padding:4px 8px;border-radius:6px}.mc-msg{padding:16px;color:#667085;line-height:1.7}#mcDialog{border:0;border-radius:16px;padding:24px;width:min(620px,calc(100% - 24px));max-height:90dvh;overflow:auto;color:var(--ink)}#mcDialog::backdrop{background:#12182977}#mcDialog h2{margin:0 0 20px}#mcDialog textarea{min-height:100px}#mcError{color:#b42318;white-space:pre-wrap}#mcDialog input:disabled,#mcDialog select:disabled,#mcDialog textarea:disabled{opacity:1;color:#475166;background:#f7f8fb}@media(max-width:760px){.mc-body{padding:12px}.mc-toolbar{width:100%}.mc-toolbar input{flex:1;min-width:140px}.mc-branch{align-items:flex-start;padding:12px}#mcDialog{padding:20px 16px}}`;
document.head.append(style);
panel.innerHTML='<div class="panel-head"><div><h2>고객사 관리</h2><p id="mcCounts">브랜드별 지점을 함께 관리합니다.</p></div><div class="mc-toolbar"><button class="btn" id="mcReload">새로고침</button><button class="btn primary" id="mcAdd">＋ 고객사 등록</button><button class="btn" id="mcClose">접기</button></div><div class="mc-toolbar"><input id="mcSearch" placeholder="브랜드 · 지점 · 담당자 · 연락처 검색" aria-label="고객사 검색"><select id="mcFilter" aria-label="고객사 상태"><option value="all">전체 상태</option>'+statuses.map(x=>'<option>'+x+'</option>').join('')+'</select></div></div><div id="mcMessage" class="mc-msg" role="status"></div><div class="mc-body" id="mcList"></div>';
const fields=[['brand_name','브랜드명','text',120],['branch_name','지점명','text',120],['contact_name','고객사 담당자','text',120],['phone','연락처','tel',60],['email','이메일','email',254],['address','주소','text',500],['service','이용 서비스','text',500],['contract_start','계약 시작일','date'],['contract_end','계약 종료일','date']];
const dialog=document.createElement('dialog');dialog.id='mcDialog';
dialog.innerHTML='<form id="mcForm"><h2 id="mcTitle">고객사 등록</h2><div class="two">'+fields.map(([key,label,type,max])=>'<div class="field"><label for="mc_'+key+'">'+label+(key==='brand_name'||key==='branch_name'?' *':'')+'</label><input id="mc_'+key+'" type="'+type+'" '+(max?'maxlength="'+max+'"':'')+' '+(key==='brand_name'||key==='branch_name'?'required':'')+'></div>').join('')+'<div class="field"><label for="mc_status">진행 상태</label><select id="mc_status">'+statuses.map(x=>'<option>'+x+'</option>').join('')+'</select></div></div><div class="field"><label for="mc_memo">고객사 메모</label><textarea id="mc_memo" maxlength="5000" placeholder="업무 범위, 전달 사항 등을 기록하세요."></textarea></div><p id="mcError" role="alert"></p><div class="modal-actions"><button class="btn danger" type="button" id="mcDelete">삭제</button><button class="btn" type="button" id="mcCancel">닫기</button><button class="btn primary" id="mcSave" type="submit">저장</button></div></form>';
document.body.append(dialog);
function sync(){
 if(!allowed()||ownerId&&ownerId!==user.id){opened=false;rows=[];request++;ownerId=null;editing=null;if(dialog.open)dialog.close();$('mcForm').reset();$('mcList').replaceChildren();}
 panel.hidden=!opened||!allowed();$('mcAdd').hidden=!writable();
}
const previousRender=render;render=function(){previousRender();sync();};
window.openMarketingClients=()=>{if(!allowed())return;opened=true;sync();panel.scrollIntoView({behavior:'smooth',block:'start'});load();};
function draw(){
 if(!allowed())return;
 $('mcAdd').disabled=loading||!!error;
 $('mcMessage').textContent=loading?'고객사를 불러오는 중입니다…':error|| (rows.length===1000?'최근 1,000개 지점까지 표시됩니다.':'');
 const q=$('mcSearch').value.trim().toLowerCase(),status=$('mcFilter').value;
 const visible=rows.filter(r=>(status==='all'||r.status===status)&&[r.brand_name,r.branch_name,r.contact_name,r.phone,r.service].some(v=>String(v||'').toLowerCase().includes(q)));
 const groups=new Map();for(const row of visible){if(!groups.has(row.brand_name))groups.set(row.brand_name,[]);groups.get(row.brand_name).push(row);}
 $('mcCounts').textContent='전체 '+new Set(rows.map(r=>r.brand_name)).size+'개 브랜드 · '+rows.length+'개 지점 / 현재 '+visible.length+'개 지점 표시';
 $('mcList').innerHTML=error||loading?'':visible.length?[...groups].sort(([a],[b])=>a.localeCompare(b,'ko')).map(([brand,branches])=>'<div class="mc-brand"><h3>'+esc(brand)+' · '+branches.length+'개 지점</h3>'+branches.sort((a,b)=>a.branch_name.localeCompare(b.branch_name,'ko')).map(r=>'<div class="mc-branch"><div><b>'+esc(r.branch_name)+'</b> <span class="mc-status">'+esc(r.status)+'</span><p>'+esc([r.contact_name,r.phone].filter(Boolean).join(' · ')||'담당자 정보 미등록')+'</p><p>'+esc(r.service||'서비스 미등록')+'</p><p>계약 '+esc(r.contract_start||'미정')+' ~ '+esc(r.contract_end||'미정')+'</p></div><div class="mc-client-actions"><button class="btn" data-mc-id="'+esc(r.id)+'">'+(writable()?'상세·수정':'상세 보기')+'</button>'+(writable()&&r.status!=='계약 종료'?'<button class="btn" data-client-request-link="'+esc(r.id)+'" data-client-label="'+esc(r.brand_name+' · '+r.branch_name)+'">요청 링크</button>':'')+'</div></div>').join('')+'</div>').join(''):'<p class="mc-msg">'+(rows.length?'검색 조건에 맞는 고객사가 없습니다.':'등록된 고객사가 없습니다.'+(writable()?' 고객사 등록을 눌러 첫 지점을 추가하세요.':''))+'</p>';
 panel.querySelectorAll('[data-mc-id]').forEach(b=>b.onclick=()=>edit(b.dataset.mcId));
}
async function load(){
 if(!allowed())return;const token=++request,uid=user.id;ownerId=uid;loading=true;error='';rows=[];draw();
 try{const result=await db.from('marketing_clients').select('*').order('created_at',{ascending:false}).limit(1000);if(token!==request||!allowed()||user.id!==uid)return;if(result.error)throw result.error;rows=result.data||[];}
 catch(e){if(token!==request)return;error=['42P01','PGRST205'].includes(e.code)?'고객사 저장소 설정이 필요합니다. Supabase SQL Editor에서 marketing-clients.sql을 한 번 실행한 뒤 새로고침해 주세요.':'고객사를 불러오지 못했습니다. 권한과 연결을 확인한 뒤 새로고침해 주세요.';}
 finally{if(token===request){loading=false;draw();}}
}
function edit(id){
 if(!allowed()||loading||error)return;const row=id?rows.find(x=>x.id===id):null;if(id&&!row||!id&&!writable())return;
 editing=row?{...row}:null;$('mcForm').reset();$('mcError').textContent='';
 for(const [key]of fields)$('mc_'+key).value=row?.[key]||'';
 $('mc_status').value=row?.status||'진행 중';$('mc_memo').value=row?.memo||'';
 $('mcTitle').textContent=row?(writable()?'고객사 수정':'고객사 상세'):'고객사 등록';
 dialog.querySelectorAll('input,textarea,select').forEach(el=>el.disabled=!writable());
 $('mcSave').hidden=!writable();$('mcDelete').hidden=!row||!writable();dialog.showModal();
}
function busy(value){saving=value;dialog.querySelectorAll('button,input,textarea,select').forEach(el=>el.disabled=value);$('mcSave').textContent=value?'저장 중…':'저장';}
function failure(e){return e.code==='23505'?'같은 브랜드와 지점이 이미 등록되어 있습니다.':e.code==='PGRST116'?'다른 사용자가 변경한 정보입니다. 닫고 새로고침한 뒤 다시 시도하세요.':'저장하지 못했습니다. 권한과 연결을 확인해 주세요.';}
function close(){if(!saving)dialog.close();}
dialog.addEventListener('cancel',e=>{if(saving)e.preventDefault();});
$('mcCancel').onclick=close;$('mcClose').onclick=()=>{opened=false;panel.hidden=true;};$('mcAdd').onclick=()=>edit();$('mcReload').onclick=load;$('mcSearch').oninput=draw;$('mcFilter').onchange=draw;
$('mcForm').onsubmit=async e=>{
 e.preventDefault();if(!writable()||saving)return;const uid=user.id;
 const payload=Object.fromEntries(fields.map(([key,,type])=>[key,type==='date'?$('mc_'+key).value||null:$('mc_'+key).value.trim()]));payload.status=$('mc_status').value;payload.memo=$('mc_memo').value.trim();
 if(!payload.brand_name||!payload.branch_name){$('mcError').textContent='브랜드명과 지점명을 입력해 주세요.';return;}
 if(payload.contract_start&&payload.contract_end&&payload.contract_end<payload.contract_start){$('mcError').textContent='계약 종료일은 시작일 이후로 입력해 주세요.';return;}
 busy(true);$('mcError').textContent='';
 try{const query=editing?db.from('marketing_clients').update(payload).eq('id',editing.id).eq('updated_at',editing.updated_at):db.from('marketing_clients').insert({...payload,created_by:uid});const result=await query.select('id').single();if(result.error||!result.data)throw result.error||{};if(!writable()||user.id!==uid)return;dialog.close();await load();}
 catch(e){if(writable()&&user.id===uid)$('mcError').textContent=failure(e);}
 finally{busy(false);}
};
$('mcDelete').onclick=async()=>{
 if(!writable()||saving||!editing||!confirm(editing.brand_name+' '+editing.branch_name+' 고객사를 삭제하시겠습니까?'))return;
 const uid=user.id;busy(true);try{const result=await db.from('marketing_clients').delete().eq('id',editing.id).eq('updated_at',editing.updated_at).select('id').single();if(result.error||!result.data)throw result.error||{};if(!writable()||user.id!==uid)return;dialog.close();await load();}catch(e){if(writable()&&user.id===uid)$('mcError').textContent=failure(e);}finally{busy(false);}
};
sync();
})();

