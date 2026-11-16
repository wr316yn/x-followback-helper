import { readFileSync,readdirSync,statSync,mkdirSync,writeFileSync } from 'node:fs';
import { join,relative } from 'node:path';
import { zipSync,strToU8 } from 'fflate';
mkdirSync('release',{recursive:true});
const files={};
function add(dir,prefix){for(const f of readdirSync(dir)){const path=join(dir,f);if(statSync(path).isDirectory())add(path,prefix);else files[`${prefix}/${relative('dist',path).replaceAll('\\','/')}`]=new Uint8Array(readFileSync(path));}}
add('dist','X回关助手');
for(const f of ['安装使用.md','PRIVACY.md','REFERENCES.md','TEST-REPORT.md'])files[f]=strToU8(readFileSync(f,'utf8'));
writeFileSync('release/X回关助手-v1.1.0.zip',zipSync(files));
console.log('Created release/X回关助手-v1.1.0.zip');
const source={};
const excluded=new Set(['node_modules','dist','release','artifacts','.git']);
function addSource(dir='.'){
 for(const f of readdirSync(dir)){
   if(excluded.has(f))continue;
   const path=join(dir,f);
   if(statSync(path).isDirectory())addSource(path);
   else source[`x-followback-helper/${path.replaceAll('\\','/')}`]=new Uint8Array(readFileSync(path));
 }
}
addSource();
writeFileSync('release/X回关助手-v1.1.0-源码.zip',zipSync(source));
console.log('Created release/X回关助手-v1.1.0-源码.zip');
