import { defineConfig } from 'vite';
export default defineConfig({build:{lib:{entry:'src/content.ts',name:'XFollowback',formats:['iife'],fileName:()=> 'content.js'},emptyOutDir:true, sourcemap:false}});
