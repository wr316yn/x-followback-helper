import { chromium, expect } from '@playwright/test';
import { mkdtempSync,mkdirSync,writeFileSync,readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve,join } from 'node:path';
import { fixture } from './fixture.mjs';

const target='https://x.com/demo_owner/followers';
const mode=process.env.PW_MODE || 'extension';
const label=process.env.PW_LABEL || mode;
const executablePath=process.env.PW_EXECUTABLE_PATH;
const installViaCDP=process.env.PW_INSTALL_CDP==='true';
const profile=mkdtempSync(join(tmpdir(),'x-followback-test-'));
mkdirSync('artifacts',{recursive:true});
const context=await chromium.launchPersistentContext(profile,{
 headless:false,executablePath,channel:executablePath?undefined:'chromium',viewport:{width:1440,height:1000},
 args:installViaCDP?['--enable-unsafe-extension-debugging']:mode==='extension'?[`--disable-extensions-except=${resolve('dist')}`,`--load-extension=${resolve('dist')}`]:[],
 ignoreDefaultArgs:installViaCDP?['--disable-extensions']:[]
});
const errors=[],checks=[];
try {
 if(installViaCDP){const session=await context.browser().newBrowserCDPSession();await session.send('Extensions.loadUnpacked',{path:resolve('dist')});await session.detach();}
 await context.route('https://x.com/**',r=>r.fulfill({contentType:'text/html',body:fixture}));
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 if(mode==='shim'){
   // Branded browsers can disable command-line extension loading. This fallback tests
   // the built UI/adapter, not installation; the separate Chromium run covers real MV3.
   await context.addInitScript(()=>{
     const listeners=[];const key='__test_storage';
     window.chrome={runtime:{onMessage:{addListener(){}},async sendMessage(cmd){
       let store=JSON.parse(localStorage.getItem(key)||'{}');let data=store[cmd.owner]||{version:1,revision:0,entries:{}};
       if(cmd.type==='clear'&&cmd.revision===data.revision)data={version:1,revision:data.revision+1,entries:{}};
       if(cmd.type==='ignore'&&cmd.revision===data.revision&&data.entries[cmd.handle])data.entries[cmd.handle].ignored=cmd.ignored;
       if(cmd.type==='observe'&&cmd.revision===data.revision)for(const e of cmd.entries){const p=data.entries[e.handle];if(!p&&!e.followerSeenAt)continue;data.entries[e.handle]={...p,...e,followerSeenAt:e.followerSeenAt||p?.followerSeenAt,ignored:p?.ignored||false};}
       store[cmd.owner]=data;localStorage.setItem(key,JSON.stringify(store));return {ok:true,data};
     }},storage:{onChanged:{addListener(f){listeners.push(f);}}}};
   });
 }
 async function load(url=target){await page.goto(url);if(mode==='shim')await page.addScriptTag({path:resolve('dist/content.js')});await expect(page.locator('#x-followback-helper')).toBeAttached({timeout:12000});}
 await load();
 const ui=page.locator('#x-followback-helper');
 await ui.getByRole('button',{name:'回关助手',exact:true}).click();
 await expect(ui.locator('.stats')).toContainText('本次已检查 4 人',{timeout:15000});
 await expect(ui.locator('.row')).toHaveCount(1);await expect(ui.locator('.row')).toContainText('@alice');checks.push('initial detection: 4 followers, 1 pending, sidebar excluded');
 await ui.getByRole('button',{name:'English',exact:true}).click();
 await expect(ui.locator('h2')).toHaveText('Keep follow-backs in sight');
 await expect(ui.locator('.stats')).toContainText('Checked 4 this session');
 await ui.getByRole('button',{name:'Quick collect',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>window.scrollY),{timeout:7000}).toBeGreaterThan(0);
 await ui.getByRole('button',{name:'Stop collection',exact:true}).click();
 await expect(ui.locator('#quick')).toHaveText('Quick collect');
 expect(await page.evaluate(()=>window.clicks)).toBe(0);
 await ui.getByRole('button',{name:'中文',exact:true}).click();
 await expect(ui.locator('h2')).toHaveText('把回关留在眼前');
 await page.evaluate(()=>window.scrollTo(0,0));
 checks.push('English/Chinese toggle and stoppable quick collection without following');
 expect(await page.evaluate(()=>window.clicks)).toBe(0);
 await page.screenshot({path:`artifacts/${label}-light.png`});
 await page.evaluate(()=>document.body.style.backgroundColor='rgb(0, 0, 0)');
 await expect(ui).toHaveAttribute('data-dark','');await page.screenshot({path:`artifacts/${label}-dark.png`});
 await page.evaluate(()=>document.body.style.backgroundColor='white');
 await ui.getByRole('button',{name:'查看并回关'}).click();
 await expect(page.locator('[data-testid="101-follow"]')).toBeFocused();expect(await page.evaluate(()=>window.clicks)).toBe(0);checks.push('locates native button without clicking');
 await page.locator('[data-testid="101-follow"]').click();
 await ui.getByRole('button',{name:'回关助手',exact:true}).click();
 await expect(ui.locator('.row')).toHaveCount(0,{timeout:12000});
 await ui.getByLabel('筛选名单').selectOption('following');await expect(ui.locator('.row')).toHaveCount(2);checks.push('manual native click updates observed relationship');
 await page.evaluate(()=>{let b=document.querySelector('[data-testid="101-unfollow"]');b.dataset.testid='101-follow';b.textContent='回关';});
 await ui.getByLabel('筛选名单').selectOption('pending');await expect(ui.locator('.row')).toHaveCount(1,{timeout:12000});checks.push('failure/rollback restores pending state');
 if(mode==='extension'){
   const profilePage=await context.newPage();await profilePage.goto('https://x.com/alice');
   await profilePage.evaluate(()=>{document.querySelector('[data-testid="primaryColumn"]').innerHTML='<div data-testid="UserName">Alice @alice</div><button data-testid="101-unfollow">Following</button>';});
   await expect(ui.locator('.row')).toHaveCount(0,{timeout:12000});
   await profilePage.evaluate(()=>{const b=document.querySelector('[data-testid="101-unfollow"]');b.dataset.testid='101-follow';b.textContent='Follow';});
   await expect(ui.locator('.row')).toHaveCount(1,{timeout:12000});await profilePage.close();checks.push('profile observation syncs across real extension tabs');
 }
 await ui.getByRole('button',{name:'暂时忽略'}).click();await expect(ui.locator('.row')).toHaveCount(0);
 await page.reload();if(mode==='shim')await page.addScriptTag({path:resolve('dist/content.js')});
 await ui.getByRole('button',{name:'回关助手',exact:true}).click();await ui.getByLabel('筛选名单').selectOption('ignored');await expect(ui.locator('.row')).toHaveCount(1,{timeout:12000});
 await ui.getByRole('button',{name:'取消忽略'}).click();await ui.getByLabel('筛选名单').selectOption('pending');await expect(ui.locator('.row')).toHaveCount(1);checks.push('ignore persists across reload and can be undone');
 await page.evaluate(()=>{addUser('alice','林间工作室');addUser('eric','Eric / 家具设计','follow','Follow back','105');});
 await expect(ui.locator('.stats')).toContainText('本次已检查 5 人',{timeout:12000});await expect(ui.locator('.row')).toHaveCount(2);checks.push('incremental load deduplicates handles');
 await ui.getByLabel('搜索账号或名称').fill('家具');await expect(ui.locator('.row')).toHaveCount(1);await ui.getByLabel('搜索账号或名称').fill('');
 await page.evaluate(()=>{history.pushState({},'', '/outsider/followers');document.querySelector('[role=tab]').setAttribute('href','/outsider/followers');addUser('intruder','Should not collect','follow','Follow','106');});
 await expect(ui.locator('.status')).toContainText('历史名单可查看');await expect(ui.locator('.stats')).toContainText('本次已检查 5 人');checks.push('other person followers list is not collected');
 await page.evaluate(()=>{document.querySelector('[data-testid="AppTabBar_Profile_Link"]').setAttribute('href','/other_owner');document.querySelector('[data-testid="SideNav_AccountSwitcher_Button"]').textContent='@other_owner';});
 await expect(ui.locator('#owner')).toContainText('@other_owner');await expect(ui.locator('.row')).toHaveCount(0);checks.push('account switch isolates records');
 await load();await ui.getByRole('button',{name:'回关助手',exact:true}).click();await expect(ui.locator('.row')).toHaveCount(2,{timeout:12000});
 await ui.getByRole('button',{name:'清空记录',exact:true}).click();await ui.locator('#confirm-clear').click();
 await expect(ui.locator('.row')).toHaveCount(0);await expect(ui.getByRole('button',{name:'继续收集'})).toBeVisible();
 await page.evaluate(()=>addUser('frank','Frank','follow','回关','107'));
 await expect(ui.locator('.stats')).toContainText('本次已检查 0 人');checks.push('clear pauses collection without changing X relationships');
 await ui.getByRole('button',{name:'继续收集'}).click();await expect(ui.locator('.stats')).toContainText('本次已检查 5 人',{timeout:12000});checks.push('resume recollects after explicit action');
 await page.setViewportSize({width:390,height:844});await expect(ui.locator('.panel')).toBeVisible();
 const box=await ui.locator('.panel').boundingBox();expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(390);await page.screenshot({path:`artifacts/${label}-narrow.png`});checks.push('narrow viewport panel remains within screen');
 expect(errors).toEqual([]);
 writeFileSync(`artifacts/browser-${label}.json`,JSON.stringify({mode,executablePath:executablePath||'bundled chromium',checks,errors,passed:true},null,2));
 console.log(JSON.stringify({mode,passed:true,checks},null,2));
} catch(e){writeFileSync(`artifacts/browser-${label}-failure.txt`,String(e));throw e;} finally {await context.close();}
