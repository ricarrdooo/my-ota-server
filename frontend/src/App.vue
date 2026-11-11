<script setup>
import {computed,onMounted,onBeforeUnmount,provide,ref,shallowRef,watch} from 'vue';
import {createAdminController} from './admin-controller.js';
import {titles} from './format.js';
import Icon from './components/Icon.vue';
import Overview from './views/Overview.vue';
import Products from './views/Products.vue';
import Devices from './views/Devices.vue';
import Artifacts from './views/Artifacts.vue';
import Releases from './views/Releases.vue';
import Attempts from './views/Attempts.vue';

const snapshot=shallowRef(null),ready=ref(false),syncing=ref(true),error=ref('');
const readPage=()=>Object.hasOwn(titles,location.hash.slice(1))?location.hash.slice(1):'overview';
const current=ref(readPage());
const components={overview:Overview,products:Products,devices:Devices,artifacts:Artifacts,releases:Releases,attempts:Attempts};
const component=computed(()=>components[current.value]);
let controller;
provide('admin',{snapshot,ready,request:(...args)=>controller.request(...args),refresh:()=>controller.refresh()});
watch(current,page=>{document.title=titles[page]+' · OTA Station';},{immediate:true});
const hashChanged=()=>{current.value=readPage();};
const forward=event=>controller?.handleClick(event);
onMounted(()=>{
 controller=createAdminController(update=>{
  if(Object.hasOwn(update,'snapshot')){snapshot.value=update.snapshot;error.value='';}
  if(Object.hasOwn(update,'managementReady'))ready.value=update.managementReady;
  if(Object.hasOwn(update,'syncing'))syncing.value=update.syncing;
  if(update.error)error.value=update.error;
 });
 window.addEventListener('hashchange',hashChanged);controller.start();
});
onBeforeUnmount(()=>{window.removeEventListener('hashchange',hashChanged);controller?.dispose();});
</script>

<template>
 <div class="desktop-app" data-visual-theme="atelier">
  <aside class="sidebar">
   <a class="brand" href="#overview"><span class="brand-symbol"><Icon name="releases"/></span><span>OTA Station<small>个人固件工作台</small></span></a>
   <div class="nav-caption">工作区</div>
   <nav aria-label="主导航"><a v-for="(label,page) in titles" :key="page" :href="'#'+page" :data-page="page" :class="{active:current===page}"><span class="nav-icon"><Icon :name="page"/></span>{{label}}</a></nav>
   <div class="sidebar-bottom"><div class="private-label"><span class="dot"/>个人工作区</div><p>本机签名 · 独立凭据<br>固件始终由你掌控</p><button id="logout" class="quiet"><Icon name="logout"/>退出登录</button></div>
  </aside>
  <div class="workspace">
   <header class="topbar"><div class="crumb">控制台 <span>/</span><b id="crumb">{{titles[current]}}</b></div><div class="top-actions"><span id="sync-status" class="sync" v-once>正在同步</span><div class="theme-control"><Icon name="theme"/><select id="theme-select" class="theme-select" data-theme-select aria-label="外观主题"><option value="system">跟随系统</option><option value="light">浅色模式</option><option value="dark">暗色模式</option></select></div><button id="refresh" class="icon-button" :class="{spinning:syncing}" aria-label="刷新数据"><Icon name="refresh"/></button><button id="help" class="avatar" aria-label="使用帮助"><Icon name="help"/></button></div></header>
   <main id="main" @click.stop="forward">
    <div v-if="error&&!snapshot" class="empty"><h3>暂时无法载入工作台</h3><p>{{error}}</p></div>
    <template v-else-if="snapshot">
     <div v-if="!ready" class="notice error runtime-warning" role="alert"><b>后台需要重启，暂为只读模式</b><p>页面与运行中的后台版本不一致，请先重启 OTA 服务，再按 Ctrl+F5 刷新页面。</p><p>仅刷新浏览器不能代替重启服务。</p></div>
     <component :is="component" :key="current"/>
    </template>
    <div v-else class="vue-loading" role="status"><div class="skeleton title"/><div class="skeleton-cards"><div v-for="i in 4" :key="i" class="skeleton"/></div><div class="skeleton table"/><p>正在连接工作台…</p></div>
   </main>
   <footer class="footer"><span>OTA Station</span><span>本地签名 · 手动发布</span></footer>
  </div>
  <!-- The interop hosts intentionally stay outside reactive page rendering.
       The audited signing worker and native dialogs exclusively own these nodes. -->
  <div id="toast" class="toast" role="status" aria-live="polite" hidden v-once/>
  <dialog id="dialog" v-once><div class="dialog-heading"><h2 id="dialog-title"/><button id="dialog-close" class="icon-button" aria-label="关闭">×</button></div><div id="dialog-body"/></dialog>
 </div>
</template>
