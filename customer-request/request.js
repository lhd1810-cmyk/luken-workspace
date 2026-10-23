/* Public submission form. The secret link grants submission only, never reads. */
(()=>{
'use strict';
const el=id=>document.getElementById(id);
const token=new URLSearchParams(location.hash.slice(1)).get('token')||'';
const today=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
let db,photos=[],busy=false,processing=false,key=crypto.randomUUID();
function show(id){for(const name of ['loading','unavailable','requestForm','success'])el(name).hidden=name!==id;}
function error(message){el('formError').textContent=message;}
function resetKey(){key=crypto.randomUUID();}
function setBusy(value){busy=value;el('requestForm').querySelectorAll('button,input,textarea').forEach(x=>x.disabled=value);el('submit').textContent=value?'접수 중…':'요청 보내기';}
async function context(){
 show('loading');
 if(!/^[a-f0-9]{64}$/.test(token)){show('unavailable');return;}
 try{
  if(!window.supabase)throw Error('접수 화면을 불러오지 못했습니다. 네트워크 연결을 확인하고 다시 시도해 주세요.');
  db??=window.supabase.createClient('https://ptwsmkdaaodqskxlvcel.supabase.co','sb_publishable_hwcnT1AgSLzMXAvaeVUr6A_wNmS1M43',{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false,storageKey:'luken-customer-request-public'}});
  const result=await db.rpc('luken_request_context',{p_token:token});
  if(result.error)throw Error('접수 화면을 준비 중이거나 연결이 지연되고 있습니다. 담당자에게 카톡으로 문의해 주세요.');
  if(!result.data?.label){el('unavailableText').textContent='링크가 만료되었거나 사용할 수 없습니다. 담당자에게 카톡으로 문의해 주세요.';show('unavailable');return;}
  el('storeLabel').textContent=result.data.label;el('desiredDate').min=today();show('requestForm');
 }catch(e){el('unavailableText').textContent=e.message;show('unavailable');}
}
function preview(){
 el('previews').replaceChildren();photos.forEach((p,index)=>{const box=document.createElement('div');box.className='photo';const img=document.createElement('img');img.src=p.data;img.alt=p.name;const remove=document.createElement('button');remove.type='button';remove.textContent='×';remove.setAttribute('aria-label',p.name+' 삭제');remove.onclick=()=>{if(busy||processing)return;photos.splice(index,1);resetKey();preview();};box.append(img,remove);el('previews').append(box);});
}
async function compress(file){
 if(!/^image\/(jpeg|png|webp|heic|heif)$/.test(file.type)||file.size>15*1024*1024)throw Error('사진은 JPG·PNG·WebP 형식, 원본 15MB 이하로 선택해 주세요.');
 const url=URL.createObjectURL(file);
 try{
  const img=new Image();await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error('이 사진을 읽지 못했습니다. JPG·PNG 사진으로 다시 선택해 주세요.'));img.src=url;});
  if(!img.naturalWidth||img.naturalWidth*img.naturalHeight>100000000)throw Error('사진 크기가 너무 큽니다. 작은 사진으로 다시 선택해 주세요.');
  const scale=Math.min(1,1400/Math.max(img.naturalWidth,img.naturalHeight));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));const ctx=canvas.getContext('2d');if(!ctx)throw Error('사진을 처리하지 못했습니다.');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);
  let data='';for(const quality of [.82,.65,.48,.3]){data=canvas.toDataURL('image/jpeg',quality);if(data.length<=950000)break;}
  if(data.length>950000)throw Error('사진 용량이 큽니다. 작은 사진으로 다시 선택해 주세요.');
  return {name:(file.name.replace(/\.[^.]+$/,'').slice(0,110)||'사진')+'.jpg',data};
 }finally{URL.revokeObjectURL(url);}
}
el('photos').onchange=async()=>{
 if(busy||processing)return;const files=[...el('photos').files];el('photos').value='';if(!files.length)return;
 if(photos.length+files.length>3){error('사진은 최대 3장까지 첨부할 수 있습니다.');return;}
 processing=true;el('submit').disabled=true;el('photos').disabled=true;error('사진을 준비하고 있습니다…');
 try{const prepared=[];for(const file of files)prepared.push(await compress(file));photos.push(...prepared);resetKey();preview();error('');}catch(e){error(e.message);}finally{processing=false;el('submit').disabled=false;el('photos').disabled=false;}
};
el('content').oninput=resetKey;el('desiredDate').onchange=resetKey;
el('requestForm').onsubmit=async event=>{
 event.preventDefault();if(busy||processing||!db)return;error('');
 const content=el('content').value.trim(),date=el('desiredDate').value||null;
 if(!content||content.length>5000){error('요청 내용을 1~5,000자로 입력해 주세요.');return;}
 if(date&&date<today()){error('희망일은 오늘 이후로 선택해 주세요.');return;}
 if(el('website').value){error('접수하지 못했습니다. 담당자에게 카톡으로 문의해 주세요.');return;}
 setBusy(true);
 try{const result=await db.rpc('luken_submit_request',{p_token:token,p_submission_key:key,p_content:content,p_desired_date:date,p_photos:photos});if(result.error)throw result.error;if(!result.data?.id)throw Error('접수 결과를 확인하지 못했습니다. 같은 내용으로 다시 시도해 주세요.');el('receipt').textContent='접수 번호 '+result.data.id.slice(0,8).toUpperCase();show('success');photos=[];preview();el('requestForm').reset();window.scrollTo({top:0,behavior:'smooth'});}
 catch(e){error(e.message||'접수하지 못했습니다. 연결을 확인하고 다시 눌러주세요.');}
 finally{setBusy(false);}
};
el('another').onclick=()=>{resetKey();error('');context();};el('retry').onclick=context;
context();
})();
