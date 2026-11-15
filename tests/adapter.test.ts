// @vitest-environment jsdom
import { beforeEach,describe,expect,it } from 'vitest';
import { currentOwner,isOwnFollowers,parseCell,followerCells,buttonRelation,profileObservation } from '../src/adapter';
const cell=(handle='alice',text='回关',id='101-follow')=>`<div data-testid="cellInnerDiv"><div data-testid="UserCell"><a href="/${handle}">名字 ${handle}</a><a href="/${handle}">@${handle}</a><span data-testid="userFollowIndicator">关注了你</span><button data-testid="${id}">${text}</button></div></div>`;
function setup(){document.body.innerHTML=`<a data-testid="AppTabBar_Profile_Link" href="/owner"></a><button data-testid="SideNav_AccountSwitcher_Button">Owner @owner</button><main data-testid="primaryColumn"><a role="tab" aria-selected="true" href="/owner/followers">关注者</a><section role="region" aria-labelledby="followers"><h1 id="followers">关注者</h1>${cell()}</section></main>`;}
beforeEach(setup);
describe('X DOM boundary',()=>{
 it('requires matching logged-in identity and selected followers tab',()=>{
   expect(currentOwner(document)).toBe('owner');expect(isOwnFollowers(document,'/owner/followers','owner')).toBe(true);
   expect(isOwnFollowers(document,'/someone/followers','owner')).toBe(false);
   document.querySelector('[data-testid="SideNav_AccountSwitcher_Button"]')!.textContent='Other @other';expect(currentOwner(document)).toBeNull();
 });
 it.each(['Followers','关注者','跟隨者','追蹤者'])('reads %s list',label=>{
   document.querySelector('h1')!.textContent=label;expect(followerCells(document)).toHaveLength(1);
 });
 it('excludes recommendations, sidebar and unlabeled regions',()=>{
   document.body.insertAdjacentHTML('beforeend',`<aside>${cell('sidebar')}</aside>`);
   document.querySelector('section')!.insertAdjacentHTML('beforeend',`<div data-testid="cellInnerDiv"><h2>Who to follow</h2></div>${cell('suggested')}`);
   document.querySelector('main')!.insertAdjacentHTML('beforeend',`<section role="region">${cell('unknown')}</section>`);
   expect(followerCells(document).map(c=>parseCell(c)?.handle)).toEqual(['alice']);
 });
 it('parses reused nodes again instead of keeping stale identity',()=>{
   const row=document.querySelector('[data-testid="cellInnerDiv"]')!;row.innerHTML=cell('bob','Following','202-unfollow');
   const parsed=parseCell(row.querySelector('[data-testid="UserCell"]')!);expect(parsed?.handle).toBe('bob');expect(parsed?.relation).toBe('following');
 });
 it('excludes a recommendation after its heading has scrolled out of the DOM',()=>{
   document.querySelector('[data-testid="userFollowIndicator"]')!.remove();expect(followerCells(document)).toHaveLength(0);
 });
 it.each([['回关','101-follow','pending'],['Follow back','101-follow','pending'],['跟隨回去','101-follow','pending'],['正在关注','101-unfollow','following'],['跟隨中','','following'],['Requested','101-unfollow','requested'],['跟隨請求已發送','101-unfollow','requested'],['已请求','101-unfollow','requested'],['Unrecognized','','unknown']])('recognizes %s', (text,id,expected)=>{
   const button=document.createElement('button');button.textContent=text;button.dataset.testid=id;expect(buttonRelation(button)).toBe(expected);
 });
 it('does not classify a disabled/loading button as pending',()=>{const b=document.querySelector('section button') as HTMLButtonElement;b.disabled=true;expect(buttonRelation(b)).toBe('unknown');});
 it('profile updates only use the profile header button',()=>{
   expect(profileObservation(document,'/alice','alice','Alice')).toBeNull();
   document.querySelector('main')!.insertAdjacentHTML('afterbegin','<div data-testid="UserName">Alice @alice</div><button data-testid="101-unfollow">Following</button>');
   expect(profileObservation(document,'/alice','alice','Alice')?.relation).toBe('following');
   expect(profileObservation(document,'/bob','alice','Alice')).toBeNull();
 });
});
