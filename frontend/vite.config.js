import {fileURLToPath} from 'node:url';
import {defineConfig} from 'vite';
import vue from '@vitejs/plugin-vue';

// Only the dedicated generated subdirectory is replaced by builds. Never
// empty static/, which also owns the signing worker and local key store.
const outDir=fileURLToPath(new URL('../ota_server/static/admin/',import.meta.url));
export default defineConfig({
  plugins:[vue()],
  define:{
    'process.env.NODE_ENV':JSON.stringify('production'),
    __VUE_OPTIONS_API__:false,
    __VUE_PROD_DEVTOOLS__:false,
    __VUE_PROD_HYDRATION_MISMATCH_DETAILS__:false,
  },
  build:{
    outDir,emptyOutDir:true,target:'es2022',sourcemap:false,
    lib:{entry:fileURLToPath(new URL('./src/main.js',import.meta.url)),formats:['es'],fileName:()=> 'admin.js',cssFileName:'admin'},
    rolldownOptions:{external:id=>id.startsWith('/static/'),output:{chunkFileNames:'chunks/[name]-[hash].js'}},
  },
});
