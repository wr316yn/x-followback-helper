import { defineConfig } from 'vite';
export default defineConfig({publicDir:false,build:{lib:{entry:'src/background.ts',formats:['es'],fileName:()=> 'background.js'},emptyOutDir:false}});
