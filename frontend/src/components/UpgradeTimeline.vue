<script setup>
import {inject,onMounted,onBeforeUnmount,ref} from 'vue';
import {taskLabels,when} from '../format.js';
import {eventError} from '../upgrade-failure.js';
const props=defineProps({commandId:String,attemptId:String,modal:Boolean});
const emit=defineEmits(['close']);
const {request}=inject('admin');
const box=ref(null),data=ref(null),error=ref('');
const labels={...taskLabels,queued:'已下发',claimed:'设备已领取',executing:'设备开始执行',created:'已创建升级记录',succeeded:'指令执行成功',expired:'等待领取或执行超时'};
let timer,controller,closed=false;
async function load(){
  if(closed||controller)return;
  controller=new AbortController();
  const timeout=setTimeout(()=>controller?.abort(),12000);
  try{
    const resource=props.commandId?'commands/'+encodeURIComponent(props.commandId):'attempts/'+encodeURIComponent(props.attemptId);
    const result=await request('/api/admin/'+resource+'/timeline',{signal:controller.signal});
    if(!closed){data.value=result;error.value='';}
  }catch(e){if(!closed)error.value=e.status===404?'未找到时间线，请确认后台已更新。':'暂时无法读取时间线，将自动重试。';}
  finally{clearTimeout(timeout);controller=null;if(!closed&&!data.value?.terminal)timer=setTimeout(load,5000);}
}
onMounted(()=>{if(props.modal)box.value.showModal();load();});
onBeforeUnmount(()=>{closed=true;clearTimeout(timer);controller?.abort();});
</script>
<template><component :is="modal?'dialog':'section'" ref="box" class="upgrade-timeline" aria-label="升级时间线" @cancel.prevent="emit('close')">
 <header><h3>升级时间线</h3><button v-if="modal" type="button" aria-label="关闭时间线" @click="emit('close')">关闭</button></header>
 <p v-if="error" role="status">{{error}}</p><p v-else-if="!data">正在读取…</p>
 <template v-if="data"><ol><li v-for="(step,i) in data.steps" :key="i">
 <div><strong>{{labels[step.stage]||step.stage}}</strong><b v-if="step.stage==='downloading'"> {{step.progress}}%</b><b v-else-if="step.stage==='failed' && step.progress>0"> · 失败时 {{step.progress}}%</b></div>
 <small>{{when(step.received)}} · +{{Math.max(0,Math.round(step.received-data.steps[0].received))}} 秒</small>
 <p v-if="step.error" class="command-error">{{eventError(step.error)}}</p></li></ol>
 <small>时间按后台接收记录计算，离线补报的多个步骤可能在同一秒出现。</small>
 <p v-if="!data.terminal" role="status">等待设备更新，当前显示最后收到的记录。</p></template>
</component></template>
<style scoped>
.upgrade-timeline{box-sizing:border-box;padding:18px;color:inherit}.upgrade-timeline:is(dialog){width:min(540px,90vw);max-height:80vh;overflow:auto;background:var(--surface);color:var(--ink);border:1px solid var(--line)}
dialog::backdrop{background:var(--backdrop)}
header{display:flex;align-items:center;justify-content:space-between;gap:12px}h3{margin:0}ol{list-style:none;padding:0;margin:18px 0}
li{position:relative;margin-left:5px;padding:0 0 14px 18px;border-left:1px solid #89959b}li:last-child{border-left-color:transparent;padding-bottom:0}
li::before{position:absolute;content:'';left:-4px;top:5px;width:7px;height:7px;border-radius:50%;background:#41857c}
small{display:block;opacity:.78;margin-top:3px}.command-error{overflow-wrap:anywhere}
</style>
