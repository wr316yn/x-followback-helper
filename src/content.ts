import { installTheme } from './theme';
import { installLanguage } from './language';
import { currentOwner,isOwnFollowers,followerCells,parseCell,profileObservation,handleFromPath,relationButton } from './adapter';
import { emptyData,labels,safeAvatar,type AccountData,type Command,type Entry,type Observation } from './model';
import css from './panel.css?inline';

if(!document.getElementById('x-followback-helper')) start();
function start() {
 const host=document.createElement('div');host.id='x-followback-helper';
 const root=host.attachShadow({mode:'open'});
 root.innerHTML=`<style>${css}</style><button class="launcher" aria-expanded="false" aria-controls="panel">回关助手</button>
 <section class="panel" id="panel" aria-label="X 回关助手" hidden>
 <header class="heading"><div><h2>把回关留在眼前</h2><small id="owner">正在确认当前账号</small></div><button class="close" aria-label="收起助手">×</button></header>
 <p class="intro">整理你已浏览的关注者。关注由你亲自点击。</p>
 <div class="stats" aria-live="polite"></div>
 <div class="controls"><input type="search" aria-label="搜索账号或名称" placeholder="搜索账号或名称"><select aria-label="筛选名单"><option value="pending">待回关</option><option value="following">已关注</option><option value="requested">请求待批准</option><option value="unknown">状态未知</option><option value="ignored">已忽略</option><option value="all">全部记录</option></select><button id="pause">暂停收集</button></div>
 <p class="status" role="status"></p><div class="list" aria-label="账号名单"></div>
 <div class="confirm" hidden><p>清空当前账号的本地名单与忽略记录？不会改变 X 上的关注关系。清空后暂停收集。</p><button id="confirm-clear">清空记录</button> <button id="cancel-clear">取消</button></div>
 <footer class="footer"><span>仅本地保存 · 历史关系需复核</span><button id="clear">清空记录</button></footer></section>`;
 document.documentElement.append(host);
 installLanguage(root);
 installTheme(root,host);
 const $=<T extends Element=HTMLElement>(s:string)=>root.querySelector<T>(s)!;
 const panel=$<HTMLElement>('.panel'), launcher=$<HTMLButtonElement>('.launcher'), list=$('.list');
 let owner:string|null=null,data:AccountData=emptyData(),loaded=false,paused=false,loading=false,collecting=false,error='',open=false;
 let epoch=0,lastSignature='',lastRoute='',lastPrimary:Element|null=null,scanTimer:ReturnType<typeof setTimeout>;
 const seen=new Set<string>(),sent=new Map<string,string>(),stable=new Map<string,{signature:string;since:number}>();
 let quick=false, quickOwner:string|null=null, quickTicks=0, idleTicks=0, lastCount=0;
 const quickButton=document.createElement('button');quickButton.id='quick';quickButton.textContent='快捷收集';quickButton.style.gridColumn='1 / -1';$('.controls').append(quickButton);
 const quickHint=document.createElement('p');quickHint.className='quick-hint';quickHint.style.cssText='grid-column:1/-1;font-size:12px;margin:0;color:var(--muted)' ;quickButton.after(quickHint);
 function stopQuick(message='已停止快捷收集'){quick=false;quickButton.textContent='快捷收集';quickHint.textContent=message;}
 quickButton.onclick=()=>{
   if(quick){stopQuick();return;}
   if(!owner || !loaded || !isOwnFollowers(document,location.pathname,owner))return;
   quick=true;quickOwner=owner;paused=false;quickTicks=0;idleTicks=0;lastCount=seen.size;
   quickButton.textContent='停止收集';quickHint.textContent='正在自动浏览；只收集已加载内容，不会自动关注。';render();
 };
 setInterval(()=>{
   quickButton.disabled=!quick && (!loaded || !owner || !isOwnFollowers(document,location.pathname,owner));
   if(!quick)return;
   if(document.hidden || paused || error || currentOwner(document)!==quickOwner || !quickOwner || !isOwnFollowers(document,location.pathname,quickOwner)){stopQuick();return;}
   if(++quickTicks>100){stopQuick('已达到本次浏览上限，可点击继续收集。');return;}
   idleTicks=seen.size===lastCount?idleTicks+1:0;lastCount=seen.size;
   if(idleTicks>=5){stopQuick('暂未发现新账号，已停止；不代表已收集全部关注者。');return;}
   if(document.querySelector('[role="dialog"], [data-testid="primaryColumn"] [role="alert"]')){stopQuick();return;}
   window.scrollBy({top:Math.max(250,window.innerHeight*0.65),behavior:'instant'});
 },3000);
 let confirmClear=false;
 function toggle(){open=!open;panel.hidden=!open;launcher.setAttribute('aria-expanded',String(open));if(open){render();$<HTMLInputElement>('input').focus();}else launcher.focus();}
 launcher.onclick=toggle;$<HTMLButtonElement>('.close').onclick=toggle;
 root.addEventListener('keydown',event=>{if((event as KeyboardEvent).key==='Escape'&&open)toggle();});
 chrome.runtime.onMessage.addListener(message=>{if(message.type==='toggle')toggle();});
 $<HTMLInputElement>('input').oninput=()=>render();$<HTMLSelectElement>('select').onchange=()=>render();
 $<HTMLButtonElement>('#pause').onclick=()=>{paused=!paused;sent.clear();stable.clear();render();schedule();};
 $<HTMLButtonElement>('#clear').onclick=()=>{confirmClear=true;render();};
 $<HTMLButtonElement>('#cancel-clear').onclick=()=>{confirmClear=false;render();};
 $<HTMLButtonElement>('#confirm-clear').onclick=async()=>{
   if(!owner || !loaded || currentOwner(document)!==owner)return;
   paused=true;confirmClear=false;seen.clear();sent.clear();stable.clear();
   await request({type:'clear',owner,revision:data.revision});render();
 };
 async function request(cmd:Command):Promise<boolean> {
   const token=epoch;
   try {
     const response=await chrome.runtime.sendMessage(cmd);
     if(token!==epoch || owner!==cmd.owner || currentOwner(document)!==owner)return false;
     if(!response?.ok)throw new Error(response?.error || '扩展连接已断开，请刷新 X 页面。');
     if(response.data.revision!==data.revision){seen.clear();sent.clear();stable.clear();}
     data=response.data;loaded=true;error='';render();return true;
   } catch(e) {
     if(token===epoch){error=e instanceof Error?e.message:'无法读取本地记录，请刷新页面。';render();}return false;
   }
 }
 async function scan(){
   const detected=currentOwner(document);
   if(detected!==owner){
     owner=detected;epoch++;data=emptyData();loaded=false;loading=false;paused=false;confirmClear=false;
     seen.clear();sent.clear();stable.clear();lastSignature='';error='';render();
   }
   if(!owner)return;
   if(!loaded){
     if(loading)return;loading=true;const token=epoch;
     await request({type:'load',owner});if(token===epoch)loading=false;return;
   }
   const route=location.pathname,primary=document.querySelector('[data-testid="primaryColumn"]');
   if(route!==lastRoute || primary!==lastPrimary){stable.clear();lastRoute=route;lastPrimary=primary;}
   render();
   if(paused || collecting)return;
   const observations:Observation[]=[];
   if(isOwnFollowers(document,route,owner)) {
     for(const cell of followerCells(document)) {const item=parseCell(cell);if(item && item.handle!==owner)observations.push(item);}
   } else {
     const handle=handleFromPath(route),entry=handle && data.entries[handle];
     if(handle && entry){const observation=profileObservation(document,route,handle,entry.name);if(observation)observations.push(observation);}
   }
   const present=new Set(observations.map(o=>o.handle));
   for(const handle of stable.keys())if(!present.has(handle))stable.delete(handle);
   const updates:Observation[]=[];
   for(const item of observations) {
     const sig=[item.relation,item.userId,item.name,item.avatarUrl,!!item.followerSeenAt].join('|'),prev=stable.get(item.handle);
     if(!prev || prev.signature!==sig){stable.set(item.handle,{signature:sig,since:Date.now()});continue;}
     // Wait for transient/optimistic UI states to settle; this is still page evidence, not an API receipt.
     if(Date.now()-prev.since<1200)continue;
     if(sent.get(item.handle)!==sig)updates.push(item);
   }
   if(updates.length){
     collecting=true;const token=epoch;
     const ok=await request({type:'observe',owner,revision:data.revision,entries:updates});
     if(ok && token===epoch)for(const item of updates){sent.set(item.handle,[item.relation,item.userId,item.name,item.avatarUrl,!!item.followerSeenAt].join('|'));if(item.followerSeenAt)seen.add(item.handle);}
     collecting=false;render();
   }
 }
 function schedule(){clearTimeout(scanTimer);scanTimer=setTimeout(()=>void scan(),180);}
 const observer=new MutationObserver(schedule);
 observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['data-testid','aria-selected','disabled','aria-busy','href','style']});
 setInterval(()=>void scan(),1000);
 chrome.storage.onChanged.addListener((changes,area)=>{
   if(area==='local' && owner && changes[`account:${owner}`]) {
     const next=changes[`account:${owner}`].newValue as AccountData|undefined;
     if(currentOwner(document)!==owner)return;
     if(next?.revision!==data.revision){seen.clear();sent.clear();stable.clear();paused=true;}
     data=next || emptyData();loaded=true;render();
   }
 });
 function render(){
   const own=!!owner && isOwnFollowers(document,location.pathname,owner);
   const all=Object.values(data.entries),query=$<HTMLInputElement>('input').value.trim().toLowerCase(),filter=$<HTMLSelectElement>('select').value;
   const matches=all.filter(e=>(filter==='all' || (filter==='ignored'?e.ignored:!e.ignored && e.relation===filter)) && `${e.handle} ${e.name}`.toLowerCase().includes(query)).sort((a,b)=>b.checkedAt-a.checkedAt || a.handle.localeCompare(b.handle));
   $('#owner').textContent=owner?`@${owner} 的关注者`:'请先登录 X，确认账号后再收集';
   $('.stats').textContent=`本次已检查 ${seen.size} 人 · 待回关记录 ${all.filter(e=>e.relation==='pending'&&!e.ignored).length} 人（含历史）`;
   const status=$('.status');status.classList.toggle('error',!!error);
   status.replaceChildren();
   if(error)status.textContent=error;
   else if(!owner)status.textContent='无法确认当前账号。请打开 X 首页；若仍未识别，请刷新页面。';
   else if(!loaded)status.textContent='正在读取本地名单…';
   else if(paused)status.textContent='已暂停收集与状态更新。点击“继续收集”恢复。';
   else if(own)status.textContent=followerCells(document).length===0 && document.querySelector('[data-testid="primaryColumn"] [data-testid="UserCell"]')
     ?'当前列表无法确认关注者身份，已跳过收集。请刷新页面；若持续出现，页面结构可能已变更。'
     :'向下浏览以发现更多人；仅覆盖已加载名单。页面状态稳定后更新。';
   else {
     status.append(document.createTextNode('历史名单可查看；继续收集请前往 '));
     const a=document.createElement('a');a.href=`https://x.com/${owner}/followers`;a.textContent='我的关注者';status.append(a);
   }
   $<HTMLButtonElement>('#pause').textContent=paused?'继续收集':'暂停收集';
   $<HTMLButtonElement>('#pause').disabled=!loaded || !owner;
   $<HTMLButtonElement>('#clear').disabled=!loaded || !owner;
   $<HTMLElement>('.confirm').hidden=!confirmClear;
   const signature=JSON.stringify([matches,filter,query,owner,seen.size]);
   if(signature===lastSignature)return;lastSignature=signature;
   const scroll=list.scrollTop;const active=root.activeElement as HTMLElement|null;const focusKey=active?.dataset.key;
   list.replaceChildren();
   if(!matches.length){const p=document.createElement('p');p.className='empty';p.textContent=query?'没有匹配的账号。':filter==='pending'?'暂未发现待回关账号。打开自己的关注者页面，缓慢向下浏览。':'这个分类还没有记录。';list.append(p);}
   // Bound mounted rows; more can be shown without mutating X's virtualized timeline.
   let shown=0;
   const appendMore=()=>{
     list.querySelector('.more')?.remove();
     for(const entry of matches.slice(shown,shown+100))list.append(row(entry));shown+=100;
     if(shown<matches.length){const more=document.createElement('button');more.className='more';more.textContent=`显示更多（剩余 ${matches.length-shown}）`;more.onclick=appendMore;list.append(more);}
   };appendMore();list.scrollTop=scroll;
   if(focusKey)[...list.querySelectorAll<HTMLElement>('button')].find(b=>b.dataset.key===focusKey)?.focus({preventScroll:true});
 }
 function row(entry:Entry){
   const item=document.createElement('article');item.className='row';
   item.innerHTML='<div class="identity"><span class="avatar" aria-hidden="true"></span><div class="who"><div class="name"></div><div class="handle"></div></div><span class="badge"></span></div><p class="when"></p><div class="actions"><button class="primary">查看并回关</button><button class="ignore"></button></div>';
   item.querySelector('.avatar')!.textContent=Array.from(entry.name)[0] || '@';
   const avatarUrl=safeAvatar(entry.avatarUrl);
   if(avatarUrl){const img=document.createElement('img');img.alt='';img.loading='lazy';img.decoding='async';img.referrerPolicy='no-referrer';img.onerror=()=>img.remove();img.src=avatarUrl;item.querySelector('.avatar')!.append(img);}

   item.querySelector('.name')!.textContent=entry.name;item.querySelector('.handle')!.textContent=`@${entry.handle}`;
   const badge=item.querySelector('.badge')!;badge.textContent=entry.ignored?'已忽略':labels[entry.relation];badge.classList.add(entry.relation);
   const time=new Date(entry.checkedAt).toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
   item.querySelector('.when')!.textContent=`${seen.has(entry.handle)?'本次已检查':'历史记录'} · ${time} 页面显示${labels[entry.relation]}；操作前复核`;
   const view=item.querySelector<HTMLButtonElement>('.primary')!;view.dataset.key=`view:${entry.handle}`;
   if(entry.relation!=='pending')view.textContent='查看账号';
   view.onclick=()=>{
     if(quick)stopQuick();
     if(!owner || currentOwner(document)!==owner){schedule();return;}
     if(isOwnFollowers(document,location.pathname,owner)){
       const cell=followerCells(document).find(c=>parseCell(c)?.handle===entry.handle);
       const button=cell && relationButton(cell);
       if(cell && button){cell.scrollIntoView({block:'center',behavior:'instant'});button.focus({preventScroll:true});if(open)toggle();button.focus({preventScroll:true});return;}
     }
     window.open(`https://x.com/${entry.handle}`,'_blank','noopener,noreferrer');
   };
   const ignore=item.querySelector<HTMLButtonElement>('.ignore')!;ignore.textContent=entry.ignored?'取消忽略':'暂时忽略';ignore.dataset.key=`ignore:${entry.handle}`;
   ignore.onclick=async()=>{if(owner && currentOwner(document)===owner){ignore.disabled=true;await request({type:'ignore',owner,revision:data.revision,handle:entry.handle,ignored:!entry.ignored});ignore.disabled=false;}};
   return item;
 }
 void scan();
}


