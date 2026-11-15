import { emptyData, reduce, validHandle, type AccountData, type Command } from './model';
let queue:Promise<unknown>=Promise.resolve();
chrome.runtime.onMessage.addListener((cmd:Command,sender,respond)=>{
 if(!sender.tab || !sender.url?.startsWith('https://x.com/') || !validHandle(cmd?.owner) || !['load','observe','ignore','clear'].includes(cmd.type)) return;
 queue=queue.catch(()=>{}).then(async()=>{
   try {
     const key=`account:${cmd.owner.toLowerCase()}`;
     const stored=await chrome.storage.local.get(key);
     const previous:AccountData=(stored[key] as AccountData|undefined) || emptyData();
     const next=reduce(previous,cmd);
     if(cmd.type!=='load') await chrome.storage.local.set({[key]:next});
     respond({ok:true,data:next});
   } catch { respond({ok:false,error:'本地记录读写失败。请检查扩展是否仍启用，或清理存储空间后重试。'}); }
 });
 return true;
});
chrome.action.onClicked.addListener(async tab=>{
 if(tab.id && tab.url?.startsWith('https://x.com/')) {
   try { await chrome.tabs.sendMessage(tab.id,{type:'toggle'}); } catch { await chrome.tabs.create({url:'https://x.com/home'}); }
 } else await chrome.tabs.create({url:'https://x.com/home'});
});
