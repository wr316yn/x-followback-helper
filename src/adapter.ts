import { validHandle, type Observation, type Relation } from './model';
export function handleFromPath(path:string):string|null {
 const match=/^\/([a-zA-Z0-9_]{1,15})\/?$/.exec(path);
 return match ? match[1].toLowerCase() : null;
}
export function currentOwner(doc:Document):string|null {
 const path=doc.querySelector('[data-testid="AppTabBar_Profile_Link"]')?.getAttribute('href');
 const owner=path ? handleFromPath(path) : null;
 const switcher=doc.querySelector('[data-testid="SideNav_AccountSwitcher_Button"]');
 const handles=(switcher?.textContent || '').match(/@[a-zA-Z0-9_]{1,15}/g) || [];
 return owner && handles.some(h=>h.slice(1).toLowerCase()===owner) ? owner : null;
}
export function isOwnFollowers(doc:Document,path:string,owner:string):boolean {
 if(path.replace(/\/$/,'').toLowerCase()!==`/${owner}/followers`) return false;
 const selected=doc.querySelector('[data-testid="primaryColumn"] [role="tab"][aria-selected="true"]');
 return selected?.getAttribute('href')?.replace(/\/$/,'').toLowerCase()===`/${owner}/followers`;
}
export function relationButton(root:ParentNode):HTMLButtonElement|null {
 const buttons=[...root.querySelectorAll<HTMLButtonElement>('button')].filter(b=>b.getAttribute('data-testid')!=='UserCell');
 return buttons.find(b=>/^\d+-(follow|unfollow|following|pending|cancelRequest)$/.test(b.dataset.testid || ''))
   || buttons.find(b=>/^(Follow|Follow back|Following|Requested|Pending|关注|回关|正在关注|已关注|已请求|请求已发送|跟隨|跟隨中|跟隨回去|跟隨請求已發送|已跟隨|已申請)$/i.test(b.textContent?.trim() || '')) || null;
}
export function buttonRelation(button:HTMLButtonElement|null):Relation {
 if(!button || button.disabled || button.getAttribute('aria-busy')==='true') return 'unknown';
 const text=button.textContent?.trim() || '', id=button.dataset.testid || '';
 if(/requested|pending|request sent|已请求|请求已发送|待批准|已申請|請求已發送/i.test(text) || /-(pending|cancelRequest)$/.test(id)) return 'requested';
 if(/-(unfollow|following)$/.test(id) || /^(Following|正在关注|已关注|跟隨中|已跟隨)$/i.test(text)) return 'following';
 if(/-follow$/.test(id) || /^(Follow|Follow back|关注|回关|跟隨|跟隨回去)$/i.test(text)) return 'pending';
 return 'unknown';
}
export function parseCell(cell:Element, now=Date.now()):Observation|null {
 const links=[...cell.querySelectorAll<HTMLAnchorElement>('a[href]')];
 const link=links.find(a=>/^@[a-zA-Z0-9_]{1,15}$/.test(a.textContent?.trim() || '') && handleFromPath(a.getAttribute('href') || ''));
 const handle=link && handleFromPath(link.getAttribute('href')!);
 if(!handle || !validHandle(handle)) return null;
 const name=links.find(a=>handleFromPath(a.getAttribute('href') || '')===handle && a.textContent?.trim() && !a.textContent.trim().startsWith('@'))?.textContent?.trim() || handle;
 const button=relationButton(cell);
 return {handle,name,userId:button?.dataset.testid?.match(/^(\d+)-/)?.[1],relation:buttonRelation(button),checkedAt:now,followerSeenAt:now};
}
export function followerCells(doc:Document):Element[] {
 const primary=doc.querySelector('[data-testid="primaryColumn"]');
 if(!primary) return [];
 const result:Element[]=[];
 for(const section of primary.querySelectorAll('section[role="region"]')) {
   const heading=doc.getElementById(section.getAttribute('aria-labelledby') || '');
   if(!heading || !/^(Followers|关注者|跟隨者|追蹤者)$/i.test(heading.textContent?.trim() || '')) continue;
   // Stop when X appends a recommended-users block inside the timeline.
   let recommendations=false;
   for(const row of section.querySelectorAll('[data-testid="cellInnerDiv"]')) {
     if(row.querySelector('h2,h3,[role="heading"]')) recommendations=true;
     if(recommendations || row.closest('aside,[role="complementary"]')) continue;
     for(const cell of row.querySelectorAll('[data-testid="UserCell"]')) {
       // The recommendation heading may have been recycled out of the virtual DOM.
       // Require X's own follower indicator as independent membership evidence.
       if(cell.querySelector('[data-testid="userFollowIndicator"]')) result.push(cell);
     }
   }
 }
 return result;
}
export function profileObservation(doc:Document,path:string,handle:string,name:string):Observation|null {
 if(handleFromPath(path)!==handle) return null;
 const primary=doc.querySelector('[data-testid="primaryColumn"]');
 if(!primary || !primary.querySelector('[data-testid="UserName"]')) return null;
 const buttons=[...primary.querySelectorAll<HTMLButtonElement>('button')].filter(b=>!b.closest('[data-testid="UserCell"],article,section,aside'));
 const button=buttons.find(b=>/^\d+-(follow|unfollow|following|pending|cancelRequest)$/.test(b.dataset.testid || ''));
 if(!button) return null;
 return {handle,name,relation:buttonRelation(button),userId:button.dataset.testid?.match(/^(\d+)-/)?.[1],checkedAt:Date.now()};
}
