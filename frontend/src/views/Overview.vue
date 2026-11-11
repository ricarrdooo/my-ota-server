<script setup>
import {computed,inject} from 'vue';
import PageHeader from '../components/PageHeader.vue';
import Panel from '../components/Panel.vue';
import Empty from '../components/Empty.vue';
import Action from '../components/Action.vue';
import Badge from '../components/Badge.vue';
import Table from '../components/Table.vue';
import AttemptTable from '../components/AttemptTable.vue';
import Icon from '../components/Icon.vue';
import {size,when} from '../format.js';
const {snapshot}=inject('admin');
const stats=computed(()=>{const s=snapshot.value;return [['在线设备',s.overview.online_devices,`已登记 ${s.overview.devices} 台设备`,'devices'],['活动发布',s.overview.active_releases,'stable / beta 更新通道','releases'],['等待完成',s.overview.pending_attempts,'以应用启动确认为准','clock'],['硬件型号',s.overview.targets,`${s.overview.products} 个产品 · 独立校验规则`,'products']];});
const active=computed(()=>snapshot.value.releases.filter(item=>item.active));
const needsSetup=computed(()=>!snapshot.value.targets.length||!snapshot.value.devices.length);
const steps=computed(()=>[['建立产品与硬件配置','明确镜像格式、容量和签名公钥。',snapshot.value.targets.length>0,'products'],['添加设备或联网网关','设备使用独立凭据接入。',snapshot.value.devices.length>0,'devices'],['打包并上传固件','在本机检查、计算摘要并签名。',snapshot.value.artifacts.length>0,'artifacts'],['确认发布到更新通道','由你决定何时让设备发现更新。',snapshot.value.releases.length>0,'releases']]);
</script>
<template>
 <PageHeader title="工作台总览" description="设备状态、固件发布与升级进度，一处掌握。"><Action kind="pack" tone="primary">＋ 打包并上传</Action></PageHeader>
 <div class="stats"><div v-for="[name,value,foot,icon] in stats" :key="name" class="stat"><div class="stat-top">{{name}}<span class="stat-icon"><Icon :name="icon"/></span></div><strong>{{value}}</strong><div class="stat-foot">{{foot}}</div></div></div>
 <div class="overview-grid"><div>
  <Panel title="最近升级"><template #extra><a class="section-link" href="#attempts">查看全部 →</a></template><AttemptTable v-if="snapshot.attempts.length" :rows="snapshot.attempts.slice(0,6)"/><Empty v-else title="还没有升级记录" description="添加设备并发布固件后，每次下载与启动确认都会在这里留下记录。"/></Panel>
  <Panel title="当前发布"><Table v-if="active.length" :columns="['硬件型号','版本','通道','发布时间']"><tr v-for="item in active.slice(0,5)" :key="item.id"><td><strong>{{item.target_name}}</strong></td><td>{{item.version}}</td><td><Badge :tone="item.channel==='stable'?'green':'blue'">{{item.channel}}</Badge></td><td>{{when(item.created)}}</td></tr></Table><Empty v-else title="准备你的第一个版本" description="固件校验通过后保存，由你决定何时发布。"><Action kind="pack" tone="secondary">打包并上传</Action></Empty></Panel>
 </div><div>
  <Panel v-if="needsSetup" title="从这里开始"><div class="section-body"><a v-for="([name,description,done,link],index) in steps" :key="link" class="setup-step" :class="{done}" :href="'#'+link"><span class="step-num">{{done?'✓':index+1}}</span><div class="step-text"><b>{{name}}</b><p>{{description}}</p></div></a></div></Panel>
  <Panel title="工作区状态"><div class="section-body workspace-facts"><p>固件存储 <b>{{size(snapshot.overview.storage_bytes)}}</b><small v-if="snapshot.overview.storage_warning">统计不完整，请检查存储权限</small></p><p>镜像适配 <b>ESP-IDF / MCUboot / Cortex-M</b></p><div class="quiet-note">文件传输完成不等于升级成功；成功状态来自设备新应用的启动确认。</div></div></Panel>
 </div></div>
</template>
