/* Executive shared calendar. Database RLS is mandatory; no local data fallback. */
(()=>{
'use strict';
const labels={owner:'대표',head:'본부장',shared:'공동'};
const esc=escapeHtml;
const dateKey=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const parseDate=s=>{const [y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d,12);};
const addDays=(s,n)=>{const d=parseDate(s);d.setDate(d.getDate()+n);return dateKey(d);};
const today=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
let month=today().slice(0,7),selected=today(),filter='all',view='month',opened=false,events=[],loading=false,loadError='',requestId=0,saving=false;
const permitted=()=>!!user&&isAdmin;
const root=document.createElement('div');root.id='executiveCalendar';root.hidden=true;document.querySelector('.main').append(root);
const menu=document.createElement('div');menu.id='executiveMenu';menu.hidden=true;menu.innerHTML='<div class="nav-caption">MANAGEMENT</div><button class="unit" id="executiveCalendarButton"><span class="sym">▦</span>경영진 일정<span class="count">비공개</span></button>';
document.querySelector('.side').append(menu);
$('executiveCalendarButton').onclick=()=>{if(!permitted())return;opened=true;sync();load();};
const modal=document.createElement('dialog');modal.id='executiveEventDialog';modal.innerHTML=`<form id="executiveEventForm"><div class="ec-modal-head"><div><small>PRIVATE SCHEDULE</small><h2 id="ecEditorTitle">일정 등록</h2></div><button class="btn" type="button" id="ecClose" aria-label="일정 창 닫기">✕</button></div><input type="hidden" id="ecId"><input type="hidden" id="ecVersion"><label class="ec-field">일정 제목<input id="ecTitle" maxlength="160" required placeholder="어떤 일정인가요?"></label><label class="ec-field">담당자<select id="ecAssignee"><option value="owner">대표</option><option value="head">본부장</option><option value="shared">공동 일정</option></select></label><div class="ec-two"><label class="ec-field">시작일<input id="ecStart" type="date" required></label><label class="ec-field">종료일<input id="ecEnd" type="date" required></label></div><label class="ec-check"><input id="ecAllDay" type="checkbox" checked> 종일 일정</label><div class="ec-two" id="ecTimes"><label class="ec-field">시작 시간<input id="ecStartTime" type="time" value="09:00"></label><label class="ec-field">종료 시간<input id="ecEndTime" type="time" value="10:00"></label></div><label class="ec-field">장소<input id="ecLocation" maxlength="300" placeholder="장소 또는 미팅 링크"></label><label class="ec-field">메모<textarea id="ecMemo" maxlength="5000" rows="3" placeholder="준비 사항이나 참고 내용을 적어주세요."></textarea></label><p id="ecEditorError" role="alert"></p><div class="ec-editor-actions"><button class="btn danger" type="button" id="ecDelete">삭제</button><span></span><button class="btn" type="button" id="ecCancel">취소</button><button class="btn primary" type="submit" id="ecSave">저장</button></div></form>`;
document.body.append(modal);
function sync(){
 if(!permitted()){opened=false;events=[];requestId++;root.replaceChildren();if(modal.open)modal.close();$('executiveEventForm').reset();}
 menu.hidden=!permitted();root.hidden=!opened;document.body.classList.toggle('ec-open',opened);
 $('executiveCalendarButton').classList.toggle('active',opened);
 if(opened){document.querySelectorAll('#units .unit').forEach(b=>b.classList.remove('active'));$('pageTitle').textContent='경영진 일정';$('pageDesc').textContent='대표 · 본부장만 함께 보는 비공개 일정';draw();}
}
const originalRender=render;render=function(){originalRender();sync();};
const originalSelect=selectUnit;selectUnit=function(id){opened=false;document.body.classList.remove('ec-open');root.hidden=true;originalSelect(id);};
function bounds(){const d=parseDate(month+'-01');const first=addDays(dateKey(d),-d.getDay());const last=new Date(d.getFullYear(),d.getMonth()+1,0,12);const cells=Math.ceil((d.getDay()+last.getDate())/7)*7;return {first,last:addDays(first,cells-1),cells};}
function visibleEvents(){return events.filter(e=>filter==='all'||e.assignee===filter).sort((a,b)=>a.start_date.localeCompare(b.start_date)||Number(b.all_day)-Number(a.all_day)||(a.start_time||'').localeCompare(b.start_time||'')||a.title.localeCompare(b.title));}
function timeLabel(e){return e.all_day?'종일':(e.start_time||'').slice(0,5)+'–'+(e.end_time||'').slice(0,5);}
function eventCard(e){return `<button class="ec-event-card" data-event="${esc(e.id)}"><span class="ec-dot ${esc(e.assignee)}"></span><span><b>${esc(e.title)}</b><small>${esc(labels[e.assignee])} · ${esc(timeLabel(e))}${e.location?' · '+esc(e.location):''}</small>${e.start_date!==e.end_date?'<small>'+esc(e.start_date)+' ~ '+esc(e.end_date)+'</small>':''}</span><span aria-hidden="true">›</span></button>`;}
function draw(){
 if(!opened||!permitted())return;
 const {first,cells}=bounds(),list=visibleEvents();let weeks='';
 for(let w=0;w<cells/7;w++){
  const ws=addDays(first,w*7),we=addDays(ws,6);const used=[];
  const bars=list.filter(e=>e.start_date<=we&&e.end_date>=ws).map(e=>{
   const a=e.start_date<ws?0:Math.round((parseDate(e.start_date)-parseDate(ws))/86400000),b=e.end_date>we?6:Math.round((parseDate(e.end_date)-parseDate(ws))/86400000);
   let lane=0;while(used[lane]?.some(([x,y])=>a<=y&&b>=x))lane++;(used[lane]||=([])).push([a,b]);
   return `<button class="ec-bar ${esc(e.assignee)}${e.start_date<ws?' continues-left':''}${e.end_date>we?' continues-right':''}" style="grid-column:${a+1}/${b+2};grid-row:${lane+1}" data-event="${esc(e.id)}" title="${esc(e.title)} · ${esc(labels[e.assignee])}" aria-label="${esc(e.title)} · ${esc(e.start_date)}부터 ${esc(e.end_date)}까지">${!e.all_day&&e.start_date>=ws?esc((e.start_time||'').slice(0,5))+' ':''}${esc(e.title)}</button>`;
  }).join('');
  weeks+=`<div class="ec-week"><div class="ec-days">${Array.from({length:7},(_,n)=>{const d=addDays(ws,n);return `<button class="ec-day${d.slice(0,7)!==month?' outside':''}${d===selected?' selected':''}${d===today()?' today':''}" data-date="${d}" aria-label="${d} 일정 보기" aria-pressed="${d===selected}"><span>${Number(d.slice(-2))}</span></button>`;}).join('')}</div><div class="ec-bars">${bars}</div></div>`;
 }
 const dayEvents=list.filter(e=>e.start_date<=selected&&e.end_date>=selected);
 root.innerHTML=`<div class="ec-toolbar"><div class="ec-month-nav"><button class="btn" data-move="-1" aria-label="이전 달">‹</button><label class="ec-month-label">${Number(month.slice(0,4))}년 ${Number(month.slice(5))}월<input type="month" value="${month}" id="ecMonth" aria-label="연월 선택"></label><button class="btn" data-move="1" aria-label="다음 달">›</button><button class="btn" id="ecToday">오늘</button></div><div class="ec-toolbar-actions"><div class="ec-view"><button class="${view==='month'?'chosen':''}" data-view="month">월간</button><button class="${view==='list'?'chosen':''}" data-view="list">목록</button></div><button class="btn primary" id="ecAdd">＋ 일정 등록</button></div></div><div class="ec-filters" role="group" aria-label="일정 담당자 필터">${[['all','전체'],...Object.entries(labels)].map(([v,l])=>`<button class="${filter===v?'chosen':''}" data-filter="${v}" aria-pressed="${filter===v}">${v==='all'?'':`<i class="ec-dot ${v}"></i>`}${l}</button>`).join('')}<span class="ec-private">🔒 경영진 전용</span></div><div class="ec-message" role="status" ${!loading&&!loadError?'hidden':''}>${loading?'일정을 불러오는 중입니다…':esc(loadError)}${loadError?'<button class="btn" id="ecRetry">다시 시도</button>':''}</div><div class="ec-layout"><div class="ec-calendar" ${view!=='month'?'hidden':''}><div class="ec-weekdays">${['일','월','화','수','목','금','토'].map(d=>'<span>'+d+'</span>').join('')}</div>${weeks}</div><aside class="ec-agenda" ${view!=='month'?'hidden':''}><div class="ec-agenda-head"><small>SELECTED DAY</small><h3>${Number(selected.slice(5,7))}월 ${Number(selected.slice(8))}일 <span>${['일','월','화','수','목','금','토'][parseDate(selected).getDay()]}요일</span></h3><button class="btn" id="ecDayAdd">＋ 이 날짜에 등록</button></div>${dayEvents.map(eventCard).join('')||'<p class="ec-empty">'+(loading?'일정을 확인하고 있어요.':loadError?'일정을 불러온 뒤 확인할 수 있습니다.':'등록된 일정이 없습니다.')+'</p>'}</aside></div><div class="ec-list" ${view!=='list'?'hidden':''}>${list.filter(e=>e.start_date<=dateKey(new Date(Number(month.slice(0,4)),Number(month.slice(5)),0,12))&&e.end_date>=month+'-01').map(eventCard).join('')||'<p class="ec-empty">'+(loadError?'일정을 불러온 뒤 확인할 수 있습니다.':'등록된 일정이 없습니다.')+'</p>'}</div><button class="ec-fab" id="ecFab" aria-label="일정 등록">＋</button>`;
 root.querySelectorAll('[data-date]').forEach(b=>b.onclick=()=>{selected=b.dataset.date;draw();});
 root.querySelectorAll('[data-event]').forEach(b=>b.onclick=()=>edit(b.dataset.event));
 root.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.filter;draw();});
 root.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{view=b.dataset.view;draw();});
 root.querySelectorAll('[data-move]').forEach(b=>b.onclick=()=>{const d=parseDate(month+'-01');d.setMonth(d.getMonth()+Number(b.dataset.move));month=dateKey(d).slice(0,7);selected=month+'-01';load();});
 $('ecMonth').onchange=e=>{if(!/^\d{4}-\d{2}$/.test(e.target.value))return;month=e.target.value;selected=month+'-01';load();};
 $('ecToday').onclick=()=>{selected=today();month=selected.slice(0,7);load();};
 ['ecAdd','ecFab','ecDayAdd'].forEach(id=>$(id).onclick=()=>edit());
 if($('ecRetry'))$('ecRetry').onclick=load;
}
async function load(){
 if(!permitted()||!opened)return;
 const token=++requestId,uid=user.id;loading=true;loadError='';events=[];draw();
 try{
  const b=bounds();const {data,error}=await db.from('executive_events').select('id,title,assignee,start_date,end_date,all_day,start_time,end_time,location,memo,updated_at').lte('start_date',b.last).gte('end_date',b.first).order('start_date').limit(1000);
  if(token!==requestId||!permitted()||user.id!==uid)return;
  if(error)throw error;
  events=data||[];if(events.length===1000)loadError='이번 달 일정이 많습니다. 일부 일정이 표시되지 않을 수 있습니다.';
 }catch(e){if(token!==requestId)return;loadError=['42P01','PGRST205'].includes(e.code)?'일정 저장소 설정이 필요합니다. 관리자에게 경영진 일정 SQL 적용을 요청해 주세요.':'일정을 불러오지 못했습니다. 연결과 경영진 권한을 확인한 뒤 다시 시도해 주세요.';}
 finally{if(token===requestId){loading=false;draw();}}
}
function close(){if(!saving)modal.close();}
function edit(id){
 if(!permitted()||loading||loadError){if(loadError)alert(loadError);return;}
 const e=id?events.find(x=>x.id===id):null;if(id&&!e)return;
 $('executiveEventForm').reset();$('ecEditorError').textContent='';$('ecEditorTitle').textContent=e?'일정 수정':'일정 등록';$('ecId').value=e?.id||'';$('ecVersion').value=e?.updated_at||'';
 $('ecTitle').value=e?.title||'';$('ecAssignee').value=e?.assignee||'shared';$('ecStart').value=e?.start_date||selected;$('ecEnd').value=e?.end_date||selected;$('ecEnd').min=$('ecStart').value;$('ecAllDay').checked=e?e.all_day:true;$('ecStartTime').value=e?.start_time?.slice(0,5)||'09:00';$('ecEndTime').value=e?.end_time?.slice(0,5)||'10:00';$('ecLocation').value=e?.location||'';$('ecMemo').value=e?.memo||'';$('ecDelete').hidden=!e;toggleTimes();modal.showModal();
}
function toggleTimes(){$('ecTimes').hidden=$('ecAllDay').checked;['ecStartTime','ecEndTime'].forEach(id=>$(id).required=!$('ecAllDay').checked);}
$('ecAllDay').onchange=toggleTimes;
$('ecStart').onchange=()=>{if($('ecEnd').value<$('ecStart').value)$('ecEnd').value=$('ecStart').value;$('ecEnd').min=$('ecStart').value;};
$('ecClose').onclick=close;$('ecCancel').onclick=close;
modal.addEventListener('cancel',e=>{if(saving)e.preventDefault();});
function busy(value){saving=value;modal.querySelectorAll('button,input,select,textarea').forEach(e=>e.disabled=value);$('ecSave').textContent=value?'저장 중…':'저장';}
$('executiveEventForm').onsubmit=async e=>{
 e.preventDefault();if(!permitted()||saving)return;
 const id=$('ecId').value,version=$('ecVersion').value,uid=user.id;
 const payload={title:$('ecTitle').value.trim(),assignee:$('ecAssignee').value,start_date:$('ecStart').value,end_date:$('ecEnd').value,all_day:$('ecAllDay').checked,start_time:$('ecAllDay').checked?null:$('ecStartTime').value,end_time:$('ecAllDay').checked?null:$('ecEndTime').value,location:$('ecLocation').value.trim(),memo:$('ecMemo').value.trim()};
 if(!payload.title||payload.end_date<payload.start_date||(!payload.all_day&&payload.end_date===payload.start_date&&payload.end_time<=payload.start_time)){$('ecEditorError').textContent='제목과 날짜를 확인해 주세요. 종료 시간은 시작 시간보다 늦어야 합니다.';return;}
 busy(true);
 try{
  const query=id?db.from('executive_events').update(payload).eq('id',id).eq('updated_at',version):db.from('executive_events').insert(payload);
  const {data,error}=await query.select('id').single();if(error||!data)throw error||new Error();
  if(!permitted()||user.id!==uid)return;
  selected=payload.start_date;month=selected.slice(0,7);modal.close();await load();
 }catch(e){$('ecEditorError').textContent=e.code==='PGRST116'?'다른 사용자가 변경한 일정입니다. 닫고 새로고침한 뒤 다시 수정해 주세요.':'저장하지 못했습니다. 연결과 수정 권한을 확인한 뒤 다시 시도해 주세요.';}
 finally{busy(false);}
};
$('ecDelete').onclick=async()=>{
 if(!permitted()||saving||!$('ecId').value||!confirm('이 일정을 삭제하시겠습니까?'))return;
 const id=$('ecId').value,version=$('ecVersion').value;busy(true);
 try{const {data,error}=await db.from('executive_events').delete().eq('id',id).eq('updated_at',version).select('id').single();if(error||!data)throw error||new Error();modal.close();await load();}
 catch(e){$('ecEditorError').textContent='삭제하지 못했습니다. 다른 사용자의 변경 여부와 연결을 확인해 주세요.';}finally{busy(false);}
};
window.addEventListener('online',()=>{if(opened)load();});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&opened&&!modal.open)load();});
sync();
})();
