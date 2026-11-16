export type ThemeMode='auto'|'light'|'dark';
export function pageDark(doc:Document):boolean {
 for(const element of [doc.body,doc.documentElement]){
  const values=getComputedStyle(element).backgroundColor.match(/[\d.]+/g)?.map(Number);
  if(values && (values[3]??1)>0.5)return values[0]*.299+values[1]*.587+values[2]*.114<128;
 }
 return matchMedia('(prefers-color-scheme: dark)').matches;
}
export function installTheme(root:ShadowRoot,host:HTMLElement){
 let mode:ThemeMode='auto';let interacted=false;
 const button=document.createElement('button');button.id='theme';button.type='button';
 const follow=document.createElement('button');follow.id='theme-auto';follow.type='button';
 root.querySelector('.heading')!.insertBefore(button,root.querySelector('.close'));
 root.querySelector('.footer')!.prepend(follow);
 const sun='<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>';
 const moon='<path d="M20.5 14.2A9 9 0 0 1 9.8 3.5a9 9 0 1 0 10.7 10.7Z"/>';
 function update(){
  const dark=mode==='dark'||(mode==='auto'&&pageDark(document));host.toggleAttribute('data-dark',dark);
  const english=host.lang==='en';const title=dark?(english?'Switch to daylight':'切换日光主题'):(english?'Switch to night':'切换黑夜主题');
  if(button.getAttribute('aria-label')!==title)button.setAttribute('aria-label',title);if(button.title!==title)button.title=title;
  const icon=dark?sun:moon;
  if(button.dataset.icon!==icon){button.dataset.icon=icon;button.innerHTML=`<svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icon}</svg>`;}
  const text=mode==='auto'?(english?'Following X':'跟随 X 中'):(english?'Follow X':'跟随 X');
  if(follow.textContent!==text)follow.textContent=text;follow.disabled=mode==='auto';
 }
 async function save(value:ThemeMode){interacted=true;mode=value;update();await chrome.storage.local.set({theme:value});}
 button.onclick=()=>void save(host.hasAttribute('data-dark')?'light':'dark');follow.onclick=()=>void save('auto');
 chrome.storage.local.get('theme').then(data=>{if(!interacted)mode=data.theme==='light'||data.theme==='dark'?data.theme:'auto';update();}).catch(()=>update());
 chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes.theme){const value=changes.theme.newValue;mode=value==='light'||value==='dark'?value:'auto';update();}});
 new MutationObserver(update).observe(host,{attributes:true,attributeFilter:['lang']});
 setInterval(update,1000);update();
}
