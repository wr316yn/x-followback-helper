import { labels } from './model';
const phrases:Record<string,string>={
'把回关留在眼前':'Keep follow-backs in sight','X 回关助手':'X Follow-back Helper','回关助手':'Follow-back Helper','正在确认当前账号':'Checking your account','收起助手':'Close helper','整理你已浏览的关注者。关注由你亲自点击。':'Organize followers you browse. You choose whom to follow.',
'搜索账号或名称':'Search name or handle','筛选名单':'Filter list','待回关':'To follow back','已关注':'Following','请求待批准':'Request pending','状态未知':'Unknown','已忽略':'Ignored','全部记录':'All records','暂停收集':'Pause collection','继续收集':'Resume collection','账号名单':'Accounts',
'清空当前账号的本地名单与忽略记录？不会改变 X 上的关注关系。清空后暂停收集。':'Clear this account’s local list and ignored accounts? Your X relationships will not change. Collection will pause.',
'清空记录':'Clear records','取消忽略':'Unignore','取消':'Cancel','仅本地保存 · 历史关系需复核':'Stored locally · Recheck historical relationships',
'请先登录 X，确认账号后再收集':'Sign in to X to start collecting','无法确认当前账号。请打开 X 首页；若仍未识别，请刷新页面。':'Cannot identify your account. Open X Home or refresh the page.',
'正在读取本地名单…':'Loading local records…','已暂停收集与状态更新。点击“继续收集”恢复。':'Collection and updates paused. Select Resume collection to continue.',
'当前列表无法确认关注者身份，已跳过收集。请刷新页面；若持续出现，页面结构可能已变更。':'Cannot verify follower membership. Collection skipped. Refresh; X may have changed its page layout.',
'向下浏览以发现更多人；仅覆盖已加载名单。页面状态稳定后更新。':'Browse down to find more people. Only loaded accounts are collected; updates wait for the page to settle.',
'历史名单可查看；继续收集请前往 ':'View saved records. To collect more, open ', '我的关注者':'My followers','没有匹配的账号。':'No matching accounts.',
'暂未发现待回关账号。打开自己的关注者页面，缓慢向下浏览。':'No follow-back candidates found yet. Open your followers and browse down.',
'这个分类还没有记录。':'No records in this category.','查看并回关':'Review and follow back','查看账号':'View account','暂时忽略':'Ignore for now','本次已检查':'Checked this session','历史记录':'Saved record',
'快捷收集':'Quick collect','停止收集':'Stop collection','已停止快捷收集':'Quick collection stopped',
'正在自动浏览；只收集已加载内容，不会自动关注。':'Browsing automatically. Collects loaded accounts only; never follows anyone.',
'已达到本次浏览上限，可点击继续收集。':'Session limit reached. Select Quick collect to continue.',
'暂未发现新账号，已停止；不代表已收集全部关注者。':'No new accounts detected. Stopped; this does not mean all followers were collected.',
'扩展连接已断开，请刷新 X 页面。':'Extension disconnected. Refresh X.', '无法读取本地记录，请刷新页面。':'Cannot read local records. Refresh the page.',
'本地记录读写失败。请检查扩展是否仍启用，或清理存储空间后重试。':'Local storage failed. Check the extension is enabled or free storage and retry.'
};
export function english(text:string):string {
 if(phrases[text])return phrases[text];
 const stats=/^本次已检查 (\d+) 人 · 待回关记录 (\d+) 人（含历史）$/.exec(text);
 if(stats)return `Checked ${stats[1]} this session · ${stats[2]} follow-back records (includes history)`;
 const owner=/^@(.+) 的关注者$/.exec(text);if(owner)return `Followers of @${owner[1]}`;
 const more=/^显示更多（剩余 (\d+)）$/.exec(text);if(more)return `Show more (${more[1]} remaining)`;
 if(text.includes(' 页面显示')){
  let result=text.replace('本次已检查','Checked this session').replace('历史记录','Saved record').replace(' 页面显示',' · Page showed: ').replace('；操作前复核','; recheck before acting');
  for(const label of Object.values(labels))result=result.replace(label,phrases[label]);return result;
 }
 return text;
}
export function installLanguage(root:ShadowRoot){
 let language='zh';const originals=new WeakMap<Text,{source:string;output:string}>();
 const attributes=new WeakMap<Element,Map<string,{source:string;output:string}>>();
 const button=document.createElement('button');button.id='language';button.type='button';
 button.innerHTML='<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18M5 6.5c4 2 10 2 14 0M5 17.5c4-2 10-2 14 0"/></svg><span></span>';
 root.querySelector('.heading')!.insertBefore(button,root.querySelector('.close'));
 function apply(){
  observer.disconnect();
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  while(walker.nextNode()){
   const node=walker.currentNode as Text;
   if(node.parentElement?.closest('style,#language,.name,.handle,.avatar'))continue;
   const previous=originals.get(node),source=previous && node.data===previous.output?previous.source:node.data;
   const output=language==='en'?english(source):source;
   originals.set(node,{source,output});if(node.data!==output)node.data=output;
  }
  for(const element of root.querySelectorAll('[aria-label],[placeholder]'))for(const key of ['aria-label','placeholder']){
   const value=element.getAttribute(key);if(value===null)continue;
   const map=attributes.get(element)||new Map();const prev=map.get(key);const source=prev&&prev.output===value?prev.source:value;
   const output=language==='en'?english(source):source;map.set(key,{source,output});attributes.set(element,map);
   if(value!==output)element.setAttribute(key,output);
  }
  button.querySelector('span')!.textContent=language==='en'?'EN':'中文';button.setAttribute('aria-label',language==='en'?'中文':'English');button.title=language==='en'?'Current language: English. Switch to Chinese':'当前语言：中文。切换为英文';(root.host as HTMLElement).lang=language==='en'?'en':'zh-CN';
  observer.observe(root,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['aria-label','placeholder']});
 }
 const observer=new MutationObserver(apply);
 button.onclick=()=>{language=language==='en'?'zh':'en';apply();void chrome.storage.local.set({language});};
 chrome.storage.local.get('language').then(data=>{language=data.language==='en'?'en':'zh';apply();}).catch(()=>apply());
 apply();
}
