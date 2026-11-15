export type Relation = 'pending' | 'following' | 'requested' | 'unknown';
export interface Observation { handle:string; name:string; userId?:string; relation:Relation; checkedAt:number; followerSeenAt?:number }
export interface Entry extends Observation { ignored:boolean }
export interface AccountData { version:1; revision:number; entries:Record<string,Entry> }
export type Command =
 | {type:'load'; owner:string}
 | {type:'observe'; owner:string; revision:number; entries:Observation[]}
 | {type:'ignore'; owner:string; revision:number; handle:string; ignored:boolean}
 | {type:'clear'; owner:string; revision:number};
export const emptyData = ():AccountData => ({version:1,revision:0,entries:{}});
export const validHandle = (s:unknown):s is string => typeof s === 'string' && /^[a-zA-Z0-9_]{1,15}$/.test(s);
export const labels:Record<Relation,string> = {pending:'待回关',following:'已关注',requested:'请求待批准',unknown:'状态未知'};
export function reduce(data:AccountData, cmd:Command):AccountData {
 if(cmd.type==='load' || cmd.revision!==data.revision) return data;
 if(cmd.type==='clear') return {version:1,revision:data.revision+1,entries:{}};
 const entries={...data.entries};
 if(cmd.type==='ignore') {
   const key=cmd.handle.toLowerCase();
   if(entries[key]) entries[key]={...entries[key],ignored:cmd.ignored};
 } else for(const item of cmd.entries) {
   if(!validHandle(item.handle) || !Object.hasOwn(labels,item.relation) || !Number.isFinite(item.checkedAt)) continue;
   const key=item.handle.toLowerCase(), prev=entries[key];
   // A profile observation may update an existing follower, never create a new one.
   if(!prev && !item.followerSeenAt) continue;
   if(prev && prev.checkedAt>item.checkedAt) continue;
   if(prev?.userId && item.userId && prev.userId!==item.userId) continue;
   entries[key]={handle:key,name:String(item.name).slice(0,160),userId:item.userId || prev?.userId,
     relation:item.relation,checkedAt:item.checkedAt,followerSeenAt:item.followerSeenAt || prev?.followerSeenAt,ignored:prev?.ignored ?? false};
 }
 return {...data,entries};
}
