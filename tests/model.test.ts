import { expect,it } from 'vitest';
import { emptyData,reduce,type Command,type Observation } from '../src/model';
const alice:Observation={handle:'Alice',name:'Alice',userId:'101',relation:'pending',checkedAt:100,followerSeenAt:100};
const observe=(entries:Observation[],revision=0):Command=>({type:'observe',owner:'owner',revision,entries});
it('deduplicates handles and preserves ignore preference',()=>{
 let data=reduce(emptyData(),observe([alice,{...alice,handle:'alice'}]));
 data=reduce(data,{type:'ignore',owner:'owner',revision:0,handle:'alice',ignored:true});
 data=reduce(data,observe([{...alice,relation:'following',checkedAt:200}]));
 expect(Object.keys(data.entries)).toHaveLength(1);expect(data.entries.alice.ignored).toBe(true);expect(data.entries.alice.relation).toBe('following');
});
it('clear invalidates old requests from other tabs',()=>{
 const cleared=reduce(reduce(emptyData(),observe([alice])),{type:'clear',owner:'owner',revision:0});
 expect(reduce(cleared,observe([alice])).entries).toEqual({});expect(cleared.revision).toBe(1);
});
it('rejects older observations and changed identity',()=>{
 const data=reduce(emptyData(),observe([alice]));
 expect(reduce(data,observe([{...alice,checkedAt:99,relation:'following'}])).entries.alice.relation).toBe('pending');
 expect(reduce(data,observe([{...alice,userId:'999',checkedAt:200}])).entries.alice.userId).toBe('101');
});
it('profile updates cannot invent follower membership',()=>{
 expect(reduce(emptyData(),observe([{...alice,followerSeenAt:undefined}])).entries).toEqual({});
 const data=reduce(emptyData(),observe([alice]));
 expect(reduce(data,observe([{...alice,followerSeenAt:undefined,checkedAt:200,relation:'following'}])).entries.alice.followerSeenAt).toBe(100);
});
it('keeps unknown as unknown rather than asserting follow success',()=>{
 const data=reduce(emptyData(),observe([alice]));
 expect(reduce(data,observe([{...alice,checkedAt:200,relation:'unknown'}])).entries.alice.relation).toBe('unknown');
});

it('preserves avatar through profile refresh and rejects external image hosts',()=>{
 const avatarUrl='https://pbs.twimg.com/profile_images/101/photo_normal.jpg';
 let data=reduce(emptyData(),observe([{...alice,avatarUrl}]));
 expect(data.entries.alice.avatarUrl).toBe(avatarUrl);
 data=reduce(data,observe([{...alice,checkedAt:200}]));expect(data.entries.alice.avatarUrl).toBe(avatarUrl);
 data=reduce(data,observe([{...alice,checkedAt:300,avatarUrl:'https://evil.example/image.png'}]));expect(data.entries.alice.avatarUrl).toBe(avatarUrl);
});
