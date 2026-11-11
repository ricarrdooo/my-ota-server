<script setup>
import {computed,inject,nextTick,onBeforeUnmount,onMounted,ref} from 'vue';
import Badge from './Badge.vue';
import UpgradeTimeline from './UpgradeTimeline.vue';
import {explainFailure,eventError} from '../upgrade-failure.js';
const selectedTimeline=ref(''),diagnostic=ref(null);
import {when} from '../format.js';
import {commandLabels,commandNames,commandPending,commandTone,deviceOnline,remoteBlockReason} from '../remote-commands.js';

const props=defineProps({deviceId:{type:String,required:true},kind:{type:String,default:''}});
const emit=defineEmits(['close']);
const {snapshot,ready,request,refresh}=inject('admin');
const dialog=ref(null),commands=ref([]),release=ref(null),loaded=ref(false),loading=ref(false),sending=ref(false),error=ref(''),sent=ref(null),ttl=ref(900);
const submittedPayload=ref(null),needsReconfirm=ref(false);
let poll=null,disposed=false,loadingJob=null;
const requests=new Set();
const device=computed(()=>snapshot.value.devices.find(item=>item.id===props.deviceId));
const online=computed(()=>deviceOnline(device.value,snapshot.value.overview.now));
const active=computed(()=>commands.value.find(commandPending));
const installing=computed(()=>props.kind==='ota.install');
const title=computed(()=>props.kind?(installing.value?'升级设备固件':'重启设备'):'设备控制记录');
const blocked=computed(()=>remoteBlockReason({...device.value,latest_command:loaded.value?active.value:device.value.latest_command},snapshot.value));
const canSubmit=computed(()=>ready.value&&loaded.value&&!error.value&&!needsReconfirm.value&&!sending.value&&!active.value&&!blocked.value&&(!installing.value||!!release.value));
const submittedCommand=computed(()=>sent.value&&commands.value.find(item=>item.id===sent.value.id)||sent.value);
async function api(path,options={}){
 const controller=new AbortController();requests.add(controller);
 const timeout=setTimeout(()=>controller.abort(),15000);
 try{return await request(path,{...options,signal:controller.signal});}
 catch(e){if(e.name==='AbortError')throw Error('连接超时，暂时无法确认结果。你可以重试，重复提交不会重复执行同一条指令。');if(e instanceof TypeError)throw Error('网络连接中断，暂时无法确认结果。请重新读取状态或重试提交，同一条指令不会重复执行。');throw e;}
 finally{clearTimeout(timeout);requests.delete(controller);}
}
async function load(silent=false){
 if(loadingJob)return loadingJob;
 if(!silent)loading.value=true;
 const job=(async()=>{
  try{
   const result=await api('/api/admin/devices/'+encodeURIComponent(props.deviceId)+'/commands');
   if(disposed)return;
   diagnostic.value=result.last_upgrade_failure;commands.value=result.commands;release.value=result.available_release;loaded.value=true;
   if(!sending.value)error.value='';
  }catch(e){if(!disposed)error.value=e.message;}
  finally{if(!disposed)loading.value=false;}
 })();
 loadingJob=job;await job;loadingJob=null;
}
async function send(){
 // Freeze the request identity AND all values after the first attempt. A lost
 // response can then be retried without creating another upgrade or reboot.
 if(sending.value||sent.value||!loaded.value||active.value||blocked.value||needsReconfirm.value||!ready.value)return;
 if(!submittedPayload.value)submittedPayload.value={kind:props.kind,ttl_seconds:Number(ttl.value),request_id:crypto.randomUUID().replaceAll('-',''),...(installing.value?{expected_release_id:release.value.id,expected_sha256:release.value.sha256}:{})};
 sending.value=true;error.value='';let accepted=false;
 try{
  const result=await api('/api/admin/devices/'+encodeURIComponent(props.deviceId)+'/commands',{method:'POST',body:JSON.stringify(submittedPayload.value)});
  if(disposed)return;
  sent.value=result;accepted=true;
 }catch(e){if(!disposed){error.value=e.message;if(e.status===409&&/发布.*变化/.test(e.message))needsReconfirm.value=true;}}
 finally{if(!disposed)sending.value=false;}
 // Once the server accepted the command, submission is complete. A slow
 // unrelated overview/catalog refresh must never stop command-status polling
 // or turn an accepted command into a reported submission failure.
 if(accepted&&!disposed){void load(true);void refresh().catch(()=>{});}
}
function reconfirm(){submittedPayload.value=null;needsReconfirm.value=false;error.value='';load();}
function close(){dialog.value?.close();emit('close');}
function onVisible(){if(!document.hidden&&!sending.value)void load(true);}
onMounted(async()=>{
 await nextTick();dialog.value.showModal();load();
 document.addEventListener('visibilitychange',onVisible);
 poll=setInterval(()=>{if(!document.hidden&&!sending.value)load(true);},5000);
});
onBeforeUnmount(()=>{disposed=true;document.removeEventListener('visibilitychange',onVisible);if(poll)clearInterval(poll);for(const controller of requests)controller.abort();dialog.value?.close();});
</script>

<template>
 <dialog ref="dialog" class="device-control-dialog" aria-labelledby="device-control-title" @cancel.prevent="close">
  <div class="dialog-heading"><div><p class="command-eyebrow">远程设备控制</p><h2 id="device-control-title">{{title}}</h2></div><button type="button" class="icon-button" aria-label="关闭设备控制" @click="close">×</button></div>
  <div class="device-control-body">
   <div class="command-device"><div><strong>{{device.name}}</strong><p>{{device.target_name}} · {{device.current_version||'等待版本上报'}}</p></div><Badge :tone="online?'green':'amber'">{{online?'最近在线':'设备离线'}}</Badge></div>
   <template v-if="kind&&!sent">
    <div v-if="installing" class="command-version"><div><span>当前版本</span><strong>{{device.current_version||'等待上报'}}</strong></div><span class="command-arrow" aria-hidden="true">→</span><div><span>待升级版本</span><strong>{{loading?'正在读取…':release?.version||'暂无可用发布'}}</strong></div></div>
    <p v-if="installing" class="command-description">设备领取指令后，将下载已发布固件、验证文件并重启；新版本启动确认后才算升级成功。</p>
    <p v-else class="command-description">设备领取指令后会重启，期间屏幕和连接会短暂中断。恢复联网后才确认执行结果。</p>
    <div class="notice command-queue-note"><b>{{online?'设备联网后领取指令':'设备当前离线，指令将排队等待'}}</b><p>提交指令不代表设备已经执行；超过等待时间仍未领取将自动过期。设备正在升级时，请等待现有操作结束。</p></div>
    <label class="command-expiry">等待设备的最长时间<select v-model="ttl" :disabled="sending||!!submittedPayload"><option :value="300">5 分钟</option><option :value="900">15 分钟</option><option :value="3600">1 小时</option></select></label>
    <p v-if="!loading&&blocked" class="form-hint">{{blocked}}</p>
    <p v-else-if="loaded&&installing&&!release" class="form-hint">请先为此设备的更新通道发布可用固件，再返回升级。</p>
   </template>
   <div v-if="submittedCommand" class="command-receipt" role="status" aria-live="polite"><Badge :tone="commandTone(submittedCommand)">{{commandLabels[submittedCommand.status]||'状态待确认'}}</Badge><h3>{{commandPending(submittedCommand)?'指令已提交，正在等待设备完成':'设备执行结果'}}</h3><p>{{commandNames[submittedCommand.kind]}} · 提交于 {{when(submittedCommand.created_at)}}</p><p v-if="commandPending(submittedCommand)">此页面会自动刷新结果，可以关闭后从“控制记录”继续查看。</p><p v-if="submittedCommand.error" class="command-error">{{submittedCommand.error}}</p></div>
   <div v-if="error||needsReconfirm" class="form-error" role="alert">{{needsReconfirm?'发布版本已变化，请重新查看并确认升级目标。':error}}<button v-if="needsReconfirm" type="button" class="quiet" @click="reconfirm">重新确认版本</button><button v-else-if="!sending" type="button" class="quiet" @click="load()">重新读取状态</button></div>
   <UpgradeTimeline v-if="submittedCommand?.kind==='ota.install'" :key="submittedCommand.id" :command-id="submittedCommand.id"/>
   <section v-if="diagnostic" class="command-receipt"><h3>设备最近一次升级失败</h3><p class="command-error">{{explainFailure(diagnostic.stage,diagnostic.error_code,diagnostic.http_status)}}</p><small>最后下载进度 {{diagnostic.progress}}% · {{diagnostic.occurred?'设备记录 '+when(diagnostic.occurred):'记录时设备时钟未同步'}} · 后台收到 {{when(diagnostic.received)}}</small></section>
   <section class="command-history"><div class="command-history-heading"><h3>最近控制记录</h3><button type="button" class="quiet" :disabled="loading||sending" @click="load()">{{loading?'正在刷新…':'刷新记录'}}</button></div>
    <p v-if="!loaded&&!error" class="form-hint" role="status">正在读取设备控制状态…</p>
    <ol v-else-if="commands.length" class="command-history-list"><li v-for="command in commands.slice(0,8)" :key="command.id"><div class="command-history-line"><strong>{{commandNames[command.kind]||'设备操作'}}</strong><Badge :tone="commandTone(command)">{{commandLabels[command.status]||'状态待确认'}}</Badge></div><p>{{when(command.created_at)}}<span v-if="command.status==='queued'"> · 等待至 {{when(command.expires_at)}}</span></p><p v-if="command.error" class="command-error">{{eventError(command.error)}}</p><button v-if="command.kind==='ota.install'" type="button" class="quiet" @click="selectedTimeline=command.id">查看升级时间线</button></li></ol>
    <p v-else-if="loaded" class="form-hint">还没有远程控制记录。升级与重启的执行结果会保存在这里。</p>
   </section>
   <UpgradeTimeline v-if="selectedTimeline" :key="selectedTimeline" :command-id="selectedTimeline" modal @close="selectedTimeline=''"/>
   <div class="form-actions"><button type="button" @click="close">{{sent||!kind?'关闭':'取消'}}</button><button v-if="kind&&!sent" type="button" class="primary" :disabled="sending||needsReconfirm||(!canSubmit&&!submittedPayload)||!!active||!!blocked||!ready" @click="send">{{sending?'正在提交…':submittedPayload?'重试提交':installing?'确认升级':'确认重启'}}</button></div>
  </div>
 </dialog>
</template>
