/* Monthly drafts, explicit public snapshots, and editable weekly Kakao summaries. */
(()=>{
'use strict';
const el=id=>document.getElementById(id),R=window.LukenReport,esc=R.esc;
const allowed=()=>!!user&&active==='marketing'&&hasAccess('marketing'),write=()=>allowed()&&canEdit('marketing');
const monthNow=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit'}).format(new Date());
const dateKey=d=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
let client=null,identity=null,record=null,loading=false,error='',seq=0,saving=false,editing=null,works=[],keywords=[];
const css=document.createElement('link');css.rel='stylesheet';css.href='./marketing-reports.css?v=1';document.head.append(css);
const pane=el('cwReportPane');
pane.innerHTML='<div class="report-toolbar"><input type="month" id="reportMonth" min="2000-01" max="2100-12" aria-label="보고 월"><button class="btn" id="reportReload">새로고침</button><button class="btn" id="reportWeekly">주간 카톡 요약</button></div><div id="reportState" class="report-empty" role="status"></div><div id="reportSummary"></div>';
el('reportMonth').value=monthNow();
function modal(id,html){const d=document.createElement('dialog');d.id=id;d.className='report-dialog';d.innerHTML=html;document.body.append(d);return d;}
const editor=modal('reportEditor','<form id="reportForm"><h2 id="reportEditorTitle">월간 리포트</h2><p class="report-note">아래 내용은 고객용 리포트에 사용됩니다. 내부 메모나 비공개 정보를 넣지 마세요. 빈 수치는 0으로 처리하지 않습니다.</p><div class="field"><label for="reportHeadline">이번 달 한 줄 요약</label><textarea id="reportHeadline" maxlength="5000" placeholder="이번 달 주요 성과와 전달할 내용을 적어주세요."></textarea></div><section class="report-section"><h3>핵심 지표</h3><p class="report-note">원본 통계에서 확인 가능한 항목만 입력하세요. 전월과 같은 지표·집계 기준으로 비교합니다.</p><div class="report-metric-grid" id="reportMetrics"></div><button class="small-btn" id="reportPrevious" type="button" style="margin-top:12px">전월 보고서에서 비교값 채우기</button></section><section class="report-section"><h3>키워드 순위</h3><div id="reportKeywords"></div><button class="small-btn" id="reportAddKeyword" type="button">＋ 키워드</button><div class="field" style="margin-top:14px"><label for="reportRankBasis">측정 기준</label><textarea id="reportRankBasis" maxlength="5000" placeholder="예: 10월 31일 14시, 동일 위치·기기 기준 / 시작 순위는 계약 시작일 기준"></textarea></div></section><section class="report-section"><h3>이번 달 진행 업무</h3><p class="report-note">완료 미션에서 제목만 가져옵니다. 보고할 항목을 선택하고 증빙 링크를 추가하세요. 업무 상세 메모는 가져오지 않습니다.</p><button class="small-btn" id="reportCandidatesToggle" type="button">완료 업무 선택</button><div id="reportCandidates" hidden></div><div id="reportWorks" style="margin-top:14px"></div><button class="small-btn" id="reportAddWork" type="button">＋ 직접 추가</button></section><div class="field"><label for="reportAnalysis">결과 분석</label><textarea id="reportAnalysis" maxlength="5000" placeholder="좋아진 점, 부족한 점과 원인을 적어주세요."></textarea></div><div class="field"><label for="reportPlan">다음 달 계획</label><textarea id="reportPlan" maxlength="5000" placeholder="집중할 작업 2~3개를 적어주세요."></textarea></div><p class="report-error" id="reportError" role="alert"></p><div class="modal-actions"><button class="btn" type="button" id="reportEditorClose">닫기</button><button class="btn" type="button" id="reportEditorPreview">미리보기</button><button class="btn primary" id="reportSave" type="submit">초안 저장</button></div></form>');
el('reportMetrics').innerHTML='<b>지표</b><b>전월</b><b>이번 달</b>'+R.metrics.map(([id,title,unit])=>'<label for="report_'+id+'_current">'+title+' ('+unit+')</label><input id="report_'+id+'_previous" type="number" min="0" max="1000000000000" step="'+(id==='spend'?'.01':'1')+'" aria-label="'+title+' 전월"><input id="report_'+id+'_current" type="number" min="0" max="1000000000000" step="'+(id==='spend'?'.01':'1')+'" aria-label="'+title+' 이번 달">').join('');
const preview=modal('reportPreview','<div class="actions" style="justify-content:flex-end;margin-bottom:16px"><button class="btn" id="reportPreviewClose">닫기</button></div><p class="report-note">초안 미리보기 · 아직 고객에게 공개되지 않은 내용일 수 있습니다.</p><article id="reportPreviewBody"></article>');
const share=modal('reportShare','<h2>고객용 리포트 공유</h2><p class="report-note">초안을 확인한 뒤 공개하세요. 초안 저장만으로는 기존 공유 내용이 바뀌지 않습니다.</p><p id="reportShareState" class="report-note"></p><input id="reportShareUrl" class="report-share-url" readonly aria-label="고객용 리포트 링크"><div class="actions"><button class="btn primary" id="reportPublish">고객용으로 공개 / 갱신</button><button class="btn" id="reportShareCopy">링크 복사</button><button class="btn" id="reportRotate">새 링크 발급</button><button class="btn danger" id="reportRevoke">공유 중지</button><button class="btn" id="reportShareClose">닫기</button></div><p class="report-error" id="reportShareError" role="alert"></p>');
const weekly=modal('reportWeeklyDialog','<h2>주간 카톡 요약</h2><p class="report-note">최근 7일의 완료일이 기록된 업무를 모았습니다. 내용을 확인·수정한 뒤 카톡에 붙여넣으세요. 자동 발송되지 않습니다.</p><div class="field"><textarea id="reportWeeklyText" rows="15" style="min-height:280px" aria-label="주간 카톡 요약"></textarea></div><p id="reportWeeklyInfo" class="report-note"></p><div class="modal-actions"><button class="btn" id="reportWeeklyClose">닫기</button><button class="btn primary" id="reportWeeklyCopy">요약 복사</button></div>');
function reset(){seq++;client=null;identity=null;record=null;editing=null;works=[];keywords=[];loading=false;error='';for(const d of [editor,preview,share,weekly])if(d.open)d.close();el('reportForm').reset();el('reportPreviewBody').replaceChildren();el('reportSummary').replaceChildren();el('reportShareUrl').value='';el('reportWeeklyText').value='';el('reportWorks').replaceChildren();el('reportKeywords').replaceChildren();}
const previousRender=render;render=function(){previousRender();if(!allowed()||identity&&identity!==user.id)reset();};
function setup(e){return ['42P01','PGRST205','PGRST202','42883'].includes(e.code)?'리포트 저장소 설정이 필요합니다. Supabase SQL Editor에서 marketing-reports.sql을 한 번 실행해 주세요.':e.code==='23505'?'같은 월의 리포트가 이미 있습니다. 닫고 새로고침해 주세요.':e.message||'연결과 권한을 확인한 뒤 다시 시도해 주세요.';}
function draw(){
 if(!allowed()||!client)return;
 el('reportState').textContent=loading?'리포트를 불러오는 중입니다…':error||'';
 if(loading||error){el('reportSummary').replaceChildren();return;}
 const month=el('reportMonth').value;
 el('reportSummary').innerHTML='<div class="report-card"><b>'+esc(month)+' 월간 리포트</b><p>'+(record?(record.share_enabled?'고객 공개 중 · 마지막 공개 '+esc(new Date(record.published_at).toLocaleDateString('ko-KR',{timeZone:'Asia/Seoul'})):'비공개 초안 / 공유 중지 상태'):'아직 작성된 리포트가 없습니다.')+'</p><div class="actions">'+(write()?'<button class="btn primary" id="reportEdit">'+(record?'초안 수정':'리포트 작성')+'</button>':'')+(record?'<button class="btn" id="reportOpenPreview">초안 미리보기</button>':'')+(record&&write()?'<button class="btn" id="reportOpenShare">고객용 공유</button>':'')+'</div></div><p class="report-note">순위·통계는 직접 입력합니다. 실제 방문·매출과 구분해서 해석하고, 비교 자료가 없는 항목은 빈칸으로 두세요.</p>';
 if(el('reportEdit'))el('reportEdit').onclick=openEditor;
 if(el('reportOpenPreview'))el('reportOpenPreview').onclick=()=>showPreview(record.report_data);
 if(el('reportOpenShare'))el('reportOpenShare').onclick=()=>{el('reportShareError').textContent='';drawShare();share.showModal();};
}
async function load(){
 if(!allowed()||!client)return;const month=el('reportMonth').value;if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)){error='보고 월을 선택해 주세요.';draw();return;}
 const token=++seq,uid=user.id,id=client.id;loading=true;error='';record=null;draw();
 try{const result=await db.from('marketing_reports').select('id,client_id,report_month,report_data,share_token,share_enabled,published_at,updated_at').eq('client_id',id).eq('report_month',month+'-01').maybeSingle();if(token!==seq||!allowed()||user.id!==uid||client?.id!==id)return;if(result.error)throw result.error;record=result.data||null;}
 catch(e){if(token===seq)error=setup(e);}
 finally{if(token===seq){loading=false;draw();}}
}
document.addEventListener('luken-client-tab-changed',e=>{
 if(!allowed()||!e.detail?.id)return;const changed=client?.id!==e.detail.id;if(changed){reset();client={id:e.detail.id,label:e.detail.label};identity=user.id;el('reportMonth').value=monthNow();}
 if(e.detail.tab==='reports'&&(changed||!record&&!loading&&!error))load();
});
document.addEventListener('luken-client-closed',reset);
el('reportReload').onclick=load;el('reportMonth').onchange=load;
function rowsDraw(){
 el('reportKeywords').innerHTML=keywords.map((k,i)=>'<div class="report-row"><input data-rk="'+i+'" data-key="keyword" maxlength="100" placeholder="핵심 키워드" aria-label="키워드" value="'+esc(k.keyword)+'"><input data-rk="'+i+'" data-key="start_rank" type="number" min="1" max="1000" placeholder="시작 순위" aria-label="시작 순위" value="'+esc(k.start_rank??'')+'"><input data-rk="'+i+'" data-key="current_rank" type="number" min="1" max="1000" placeholder="현재 순위" aria-label="현재 순위" value="'+esc(k.current_rank??'')+'"><button type="button" class="small-btn" data-rk-remove="'+i+'" aria-label="키워드 삭제">×</button></div>').join('');
 el('reportWorks').innerHTML=works.map((w,i)=>'<div class="report-row report-work-row"><input data-rw="'+i+'" data-key="title" maxlength="300" placeholder="고객에게 보고할 업무" aria-label="진행 업무" value="'+esc(w.title)+'"><input data-rw="'+i+'" data-key="url" type="url" maxlength="2000" placeholder="증빙 링크 (선택)" aria-label="증빙 링크" value="'+esc(w.url)+'"><button type="button" class="small-btn" data-rw-remove="'+i+'" aria-label="업무 삭제">×</button></div>').join('');
 editor.querySelectorAll('[data-rk]').forEach(x=>x.oninput=()=>{keywords[+x.dataset.rk][x.dataset.key]=x.value;});
 editor.querySelectorAll('[data-rw]').forEach(x=>x.oninput=()=>{works[+x.dataset.rw][x.dataset.key]=x.value;});
 editor.querySelectorAll('[data-rk-remove]').forEach(x=>x.onclick=()=>{keywords.splice(+x.dataset.rkRemove,1);rowsDraw();});
 editor.querySelectorAll('[data-rw-remove]').forEach(x=>x.onclick=()=>{works.splice(+x.dataset.rwRemove,1);rowsDraw();});
}
function openEditor(){
 if(!write()||loading||error||!client)return;editing={id:record?.id||null,version:record?.updated_at||null,clientId:client.id,label:client.label,month:el('reportMonth').value};const data=record?.report_data||{};el('reportForm').reset();el('reportEditorTitle').textContent=client.label+' · '+editing.month;el('reportHeadline').value=data.summary||'';el('reportAnalysis').value=data.analysis||'';el('reportPlan').value=data.next_plan||'';el('reportRankBasis').value=data.rank_basis||'';
 for(const [key]of R.metrics)for(const side of ['current','previous'])el('report_'+key+'_'+side).value=data.metrics?.[key]?.[side]??'';
 works=(data.work_items||[]).map(x=>({...x}));keywords=(data.keywords||[]).map(x=>({...x}));rowsDraw();el('reportCandidates').hidden=true;el('reportError').textContent='';editor.showModal();
}
function number(value,label,rank=false){if(value===''||value==null)return null;const n=Number(value);if(!Number.isFinite(n)||n<(rank?1:0)||n>(rank?1000:1e12)||(rank&&!Number.isInteger(n)))throw Error(label+' 값을 확인해 주세요.');return n;}
function collect(){
 const metrics={};for(const [key,title]of R.metrics){metrics[key]={};for(const side of ['current','previous']){const n=number(el('report_'+key+'_'+side).value,title);if(key!=='spend'&&n!=null&&!Number.isInteger(n))throw Error(title+'는 정수로 입력해 주세요.');metrics[key][side]=n;}}
 const k=keywords.map(x=>({keyword:x.keyword.trim(),start_rank:number(x.start_rank,'시작 순위',true),current_rank:number(x.current_rank,'현재 순위',true)}));if(k.some(x=>!x.keyword))throw Error('키워드명을 입력하거나 빈 행을 삭제해 주세요.');
 const w=works.map(x=>({title:x.title.trim(),url:x.url.trim()}));if(w.some(x=>!x.title||x.title.length>300))throw Error('업무 제목을 입력하거나 빈 행을 삭제해 주세요.');if(w.some(x=>x.url&&!R.safeUrl(x.url)))throw Error('증빙 링크는 올바른 http 또는 https 주소로 입력해 주세요.');
 return {summary:el('reportHeadline').value.trim(),metrics,keywords:k,rank_basis:el('reportRankBasis').value.trim(),work_items:w,analysis:el('reportAnalysis').value.trim(),next_plan:el('reportPlan').value.trim()};
}
el('reportAddKeyword').onclick=()=>{if(keywords.length>=20){el('reportError').textContent='키워드는 최대 20개입니다.';return;}keywords.push({keyword:'',start_rank:null,current_rank:null});rowsDraw();};
el('reportAddWork').onclick=()=>{if(works.length>=50){el('reportError').textContent='업무는 최대 50개입니다.';return;}works.push({title:'',url:''});rowsDraw();};
el('reportCandidatesToggle').onclick=()=>{
 if(!editing||!write())return;const candidates=state.tasks.filter(t=>t.unit==='marketing'&&t.clientId===editing.clientId&&t.status==='완료'&&(!t.completedAt||dateKey(new Date(t.completedAt)).slice(0,7)===editing.month));
 el('reportCandidates').innerHTML='<p class="report-note">완료일이 없는 기존 미션은 이달 업무인지 확인 후 선택해 주세요.</p>'+candidates.map(t=>'<label class="report-candidate"><input type="checkbox" data-report-mission="'+esc(t.id)+'" '+(t.completedAt?'checked':'')+'><span>'+esc(t.title)+(t.completedAt?' · '+esc(dateKey(new Date(t.completedAt))):' · 완료일 미기록')+'</span></label>').join('')+(candidates.length?'<button class="small-btn" type="button" id="reportImport">선택 업무 추가</button>':'<p class="report-note">선택 가능한 완료 미션이 없습니다. 업무를 직접 추가할 수 있습니다.</p>');el('reportCandidates').hidden=false;
 if(el('reportImport'))el('reportImport').onclick=()=>{const selected=[...editor.querySelectorAll('[data-report-mission]')].filter(x=>x.checked).map(x=>state.tasks.find(t=>t.id===x.dataset.reportMission)).filter(Boolean);for(const t of selected)if(works.length<50&&!works.some(w=>w.title===t.title))works.push({title:t.title.slice(0,300),url:''});rowsDraw();el('reportCandidates').hidden=true;};
};
el('reportPrevious').onclick=async()=>{
 if(!editing||saving||!write())return;const context=editing,d=new Date(editing.month+'-15T12:00:00Z');d.setUTCMonth(d.getUTCMonth()-1);const month=d.toISOString().slice(0,7),uid=user.id,id=editing.clientId;
 try{const result=await db.from('marketing_reports').select('report_data').eq('client_id',id).eq('report_month',month+'-01').maybeSingle();if(!write()||user.id!==uid||editing!==context||!editor.open)return;if(result.error)throw result.error;if(!result.data){el('reportError').textContent='전월 보고서가 없습니다. 비교값을 직접 입력하거나 빈칸으로 두세요.';return;}if(!confirm('입력한 전월 수치를 전월 보고서의 이번 달 수치로 바꿀까요?'))return;for(const [key]of R.metrics)el('report_'+key+'_previous').value=result.data.report_data?.metrics?.[key]?.current??'';el('reportError').textContent='';}catch(e){if(editing===context&&editor.open)el('reportError').textContent=setup(e);}
};
function showPreview(data){if(!client)return;el('reportPreviewBody').innerHTML=R.render({client_label:editor.open?editing?.label:client.label,month:(editor.open?editing?.month:el('reportMonth').value)+'-01',data});preview.showModal();}
el('reportEditorPreview').onclick=()=>{try{showPreview(collect());}catch(e){el('reportError').textContent=e.message;}};
function busy(value){saving=value;for(const d of [editor,share])d.querySelectorAll('input,textarea,button').forEach(x=>x.disabled=value);el('reportSave').textContent=value?'저장 중…':'초안 저장';}
el('reportForm').onsubmit=async e=>{
 e.preventDefault();if(!write()||saving||!editing)return;let data;try{data=collect();}catch(e){el('reportError').textContent=e.message;return;}const uid=user.id,context={...editing};busy(true);el('reportError').textContent='';
 try{const result=await db.rpc('luken_save_report',{p_id:context.id,p_version:context.version,p_client_id:context.clientId,p_month:context.month+'-01',p_data:data});if(result.error)throw result.error;if(!result.data?.id)throw Error('저장 결과를 확인하지 못했습니다.');if(!write()||user.id!==uid||client?.id!==context.clientId)return;editor.close();editing=null;await load();}
 catch(e){if(write()&&user.id===uid)el('reportError').textContent=setup(e);}
 finally{busy(false);}
};
function drawShare(){const url=new URL('report/',location.href);url.search='';url.hash=new URLSearchParams({token:record.share_token}).toString();el('reportShareUrl').value=record.share_enabled?url.href:'';el('reportShareState').textContent=record.share_enabled?'현재 공개 중인 스냅샷이 공유됩니다. 수정한 초안을 반영하려면 다시 공개하세요.':'아직 공개되지 않았거나 공유가 중지되어 있습니다.';el('reportShareCopy').disabled=!record.share_enabled;el('reportRotate').disabled=!record.published_at;}
async function publish(action){
 if(!write()||saving||!record)return;const message={publish:'현재 저장된 초안을 고객용 링크에 공개할까요? 내부 정보가 없는지 확인해 주세요.',rotate:'기존 링크는 무효화됩니다. 마지막 공개본의 새 링크를 발급할까요?',revoke:'고객용 리포트 공유를 중지할까요?'}[action];if(!confirm(message))return;const uid=user.id,id=record.id;busy(true);el('reportShareError').textContent='';
 try{const result=await db.rpc('luken_publish_report',{p_id:id,p_version:record.updated_at,p_action:action});if(result.error)throw result.error;if(!result.data?.id)throw Error('공유 결과를 확인하지 못했습니다.');if(!write()||user.id!==uid)return;await load();if(record?.id===id)drawShare();else share.close();}
 catch(e){if(write()&&user.id===uid)el('reportShareError').textContent=setup(e);}
 finally{busy(false);if(record)drawShare();}
}
el('reportPublish').onclick=()=>publish('publish');el('reportRotate').onclick=()=>publish('rotate');el('reportRevoke').onclick=()=>publish('revoke');
async function copy(id,info){try{await navigator.clipboard.writeText(el(id).value);el(info).textContent='복사했습니다. 내용을 확인한 뒤 카톡으로 전달해 주세요.';}catch{el(id).focus();el(id).select();el(info).textContent='위 내용을 선택해 직접 복사해 주세요.';}}
el('reportShareCopy').onclick=()=>{if(write()&&el('reportShareUrl').value)copy('reportShareUrl','reportShareError');};
el('reportWeekly').onclick=()=>{
 if(!allowed()||!client)return;const end=new Date(),start=new Date(end);start.setUTCDate(start.getUTCDate()-6);const first=dateKey(start),last=dateKey(end);
 const tasks=state.tasks.filter(t=>t.unit==='marketing'&&t.clientId===client.id);const completed=tasks.filter(t=>t.status==='완료'&&t.completedAt&&dateKey(new Date(t.completedAt))>=first&&dateKey(new Date(t.completedAt))<=last);const next=tasks.filter(t=>t.status!=='완료').sort((a,b)=>(a.due||'9999').localeCompare(b.due||'9999')).slice(0,3);
 el('reportWeeklyText').value='['+client.label+' 주간 진행 공유]\n'+first+' ~ '+last+'\n\n이번 주 완료 업무\n'+(completed.map(t=>'• '+t.title).join('\n')||'• 확인 후 입력')+'\n\n주요 변화\n• 확인 후 입력\n\n다음 진행 업무\n'+(next.map(t=>'• '+t.title).join('\n')||'• 확인 후 입력');el('reportWeeklyInfo').textContent=tasks.some(t=>t.status==='완료'&&!t.completedAt)?'완료일이 없는 기존 미션은 자동 포함하지 않았습니다. 필요한 내용을 직접 보완하세요.':'';weekly.showModal();
};
el('reportWeeklyCopy').onclick=()=>{if(allowed())copy('reportWeeklyText','reportWeeklyInfo');};
el('reportEditorClose').onclick=()=>{if(!saving&&confirm('저장하지 않은 변경 내용은 사라집니다. 닫을까요?')){editor.close();editing=null;}};editor.addEventListener('cancel',e=>{if(saving||!confirm('저장하지 않은 변경 내용은 사라집니다. 닫을까요?'))e.preventDefault();});
el('reportPreviewClose').onclick=()=>preview.close();el('reportWeeklyClose').onclick=()=>weekly.close();el('reportShareClose').onclick=()=>{if(!saving)share.close();};share.addEventListener('cancel',e=>{if(saving)e.preventDefault();});
})();
