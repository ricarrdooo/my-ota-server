// The Vue application owns all page rendering. This narrow bridge preserves
// established native dialogs and the audited browser-local signing workflow.
export function createAdminController(notify=()=>{}){
const cleanups=[];
const listen=(target,type,handler)=>{target.addEventListener(type,handler);cleanups.push(()=>target.removeEventListener(type,handler));};
const $=(s,r=document)=>r.querySelector(s),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const csrf=$('meta[name="csrf-token"]').content;
const labels={created:'已创建',downloading:'正在下载',downloaded:'下载完成',transferring:'正在传输',validating:'正在校验',installing:'正在安装',pending_boot:'等待启动确认',confirmed:'升级成功',failed:'升级失败',rolled_back:'已回滚'};
let state=null,refreshJob=null,refreshAgain=false,toastTimer,managementReady=false,formRequest=0;
const ADMIN_CONTRACT=2,ADMIN_FEATURES=['release_management','artifact_deletion','metadata_management','firmware_state'];
const RESTART_MESSAGE='页面与运行中的后台版本不一致，请先重启 OTA 服务，再按 Ctrl+F5 刷新页面。';
function compatible(capabilities){return capabilities?.contract===ADMIN_CONTRACT&&Array.isArray(capabilities.features)&&ADMIN_FEATURES.every(feature=>capabilities.features?.includes(feature));}
function managementGuard(){if(managementReady)return true;toast(RESTART_MESSAGE,true);return false;}

function toast(message,error=false){const box=$('#toast');box.textContent=message;box.className='toast'+(error?' error':'');box.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>box.hidden=true,6000);}
async function api(path,options={}){
 const method=(options.method||'GET').toUpperCase();
 if(path.startsWith('/api/admin/')&&!['GET','HEAD','OPTIONS'].includes(method)&&path!=='/api/admin/logout'&&!managementReady)throw Error(RESTART_MESSAGE);
 const headers={'X-CSRF-Token':csrf,...options.headers};if(options.body&&!(options.body instanceof FormData))headers['Content-Type']='application/json';
 const deadline=method==='GET'&&!options.signal?new AbortController():null;
 const timer=deadline?setTimeout(()=>deadline.abort(),15000):null;
 try{
 const response=await fetch(path,{...options,headers,credentials:'same-origin',...(deadline?{signal:deadline.signal}:{})});
 if(response.status===401){location.href='/login';throw Error('请重新登录');}
 let data;try{data=await response.json();}catch{throw Error('后台返回了无法识别的响应（HTTP '+response.status+'），请检查服务或代理配置。');}
 if(!response.ok){
  const routeMissing=response.status===404&&data.detail==='Not Found';
  const error=Error(routeMissing?RESTART_MESSAGE:typeof data.error==='string'?data.error:typeof data.detail==='string'?data.detail:'请求失败（HTTP '+response.status+'）');
  error.status=response.status;error.routeMissing=routeMissing;
  if(routeMissing&&path!=='/api/admin/capabilities'){managementReady=false;render();}
  throw error;
 }
 return data;
 }catch(error){if(deadline?.signal.aborted)throw Error('读取后台数据超时，请检查网络后刷新页面。');throw error;}
 finally{if(timer)clearTimeout(timer);}
}
const post=(path,body={})=>api(path,{method:'POST',body:JSON.stringify(body)});
const when=v=>v?new Date(v*1000).toLocaleString('zh-CN',{hour12:false}):'尚未联系';
const size=v=>v>=1048576?(v/1048576).toFixed(2)+' MiB':v>=1024?Math.round(v/1024)+' KiB':v+' B';
const action=(name,label,id='',kind='')=>`<button data-action="${esc(name)}" data-id="${esc(id)}" class="${esc(kind)}">${esc(label)}</button>`;
const empty=(title,description,button='')=>`<div class="empty"><div class="empty-symbol">↥</div><h3>${esc(title)}</h3><p>${esc(description)}</p>${button}</div>`;
async function synchronize(){
 notify({syncing:true});$('#sync-status').textContent='正在同步';
 try{
  const capabilityRequest=api('/api/admin/capabilities').catch(error=>{if(error.routeMissing)return null;throw error;});
  const [overview,catalog,devices,artifacts,releases,attempts,capabilities]=await Promise.all([api('/api/admin/overview'),api('/api/admin/catalog'),api('/api/admin/devices'),api('/api/admin/artifacts'),api('/api/admin/releases'),api('/api/admin/attempts'),capabilityRequest]);
  state={overview,...catalog,devices,artifacts,releases,attempts,capabilities};managementReady=compatible(capabilities);render();
  $('#sync-status').textContent=managementReady?'已同步 '+new Date().toLocaleTimeString('zh-CN',{hour12:false}):'后台待重启';return true;
 }catch(error){toast(error.message,true);$('#sync-status').textContent='同步失败';if(!state)notify({error:error.message});return false;}finally{notify({syncing:false});}
}
function refresh(force=true){
 if(refreshJob){if(force!==false)refreshAgain=true;return refreshJob;}
 const job=(async()=>{let result;do{refreshAgain=false;result=await synchronize();}while(refreshAgain);return result;})();
 refreshJob=job;job.finally(()=>{if(refreshJob===job)refreshJob=null;});return job;
}
function render(){notify({snapshot:state,managementReady});}
const options=(items,label='name',includeId=true)=>items.map(x=>`<option value="${esc(x.id)}">${esc(x[label])}${includeId?' · '+esc(x.id.slice(0,28)):''}</option>`).join('');
const field=(label,name,attrs='',value='')=>`<label>${esc(label)}<input name="${esc(name)}" ${attrs} value="${esc(value)}"></label>`;
const select=(label,name,content)=>`<label>${esc(label)}<select name="${esc(name)}" ${name==='gateway_id'?'':'required'}>${content}</select></label>`;
function showDialog(title,body){formRequest++;$('#dialog-title').textContent=title;$('#dialog-body').innerHTML=body;$('#dialog').showModal();}
function closeDialog(){formRequest++;window.dispatchEvent(new Event('ota:dialog-close'));$('#dialog').close();$('#dialog-body').replaceChildren();}
function formDialog(kind,title,body,submit='保存'){showDialog(title,`<form id="entry-form" data-kind="${kind}">${body}<div class="form-error" role="alert" hidden></div><div class="form-actions"><button type="button" data-action="close">取消</button><button class="primary" type="submit">${submit}</button></div></form>`);}
function showSecret(data){showDialog('保存设备凭据',`<div class="notice">以下密钥只显示这一次。关闭前请复制保存；忘记后可以轮换。</div><p class="muted">设备 / 代理标识</p><pre>${esc(data.id)}</pre>${data.agent_id?`<p class="muted">联网代理标识</p><pre>${esc(data.agent_id)}</pre>`:''}<p class="muted">访问密钥</p><div id="secret-token" class="secret-value">${esc(data.token)}</div><div class="form-actions">${action('copy-token','复制密钥','','primary')}${action('close','我已保存')}</div>`);}
function downloadJSON(value,name){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
const managed={product:['products','产品'],target:['targets','硬件型号'],key:['keys','签名公钥'],device:['devices','设备'],gateway:['gateways','网关']};
async function openForm(kind,id='',preset=null){
 if(!managementGuard())return;const request=++formRequest;
 if(kind==='republish'){
  const item=state.releases.find(x=>x.id===id);if(!item){toast('发布记录已变化，请刷新页面',true);return;}
  return openForm('publish',item.artifact_id,{channel:item.channel,notes:item.notes||''});
 }
 if(kind==='edit-release'||kind==='delete-release'){
  const item=state.releases.find(x=>x.id===id);if(!item){toast('发布记录已变化，请刷新页面',true);return;}
  const deleting=kind==='delete-release',blocked=item.can_delete===false||!!item.active||item.attempt_count>0;
  const context=`<p><b>${esc(item.version)}</b> · ${esc(item.target_name)}</p><p class="muted">${esc(item.channel)} 通道 · 发布 #${item.seq}</p><p class="mono artifact-delete-digest">SHA-256：${esc(item.sha256)}</p>`;
  const reasons=(item.delete_block_reasons||[...(item.active?['当前为活动发布，请先撤回再删除。']:[]),...(item.attempt_count?['已有 '+item.attempt_count+' 条升级记录，需保留历史。']:[])]).map(reason=>`<p class="notice error">${esc(reason)}</p>`).join('');
  const body=deleting?context+reasons+'<div class="notice">只移除此条发布，不删除固件库文件，不会让已安装设备回退。内部保留发布序号与审计信息，避免序号被重复使用。</div><p class="form-hint">此操作不能在界面撤销；仍可从固件库新建发布。</p>':context+`<label>发布说明<textarea name="notes" maxlength="2000">${esc(item.notes||'')}</textarea></label><div class="notice">仅修改这一次发布的说明，不改固件库说明、版本号、签名、摘要或通道。</div>`;
  formDialog(deleting?'release-delete':'release-edit',deleting?'删除发布':'编辑发布说明',body,deleting?'确认删除发布':'保存修改');$('#entry-form').dataset.id=id;
  if(deleting){const button=$('[type=submit]',$('#entry-form'));button.className='danger';button.disabled=blocked;if(blocked)button.textContent='此发布受保护，不能删除';}return;
 }
 if(kind.startsWith('edit-')||kind.startsWith('delete-')){
  const entity=kind.replace(/^(edit|delete)-/,''),spec=managed[entity];
  if(spec){
   const [collection,label]=spec,item=state[collection].find(x=>x.id===id);if(!item){toast('记录已变化，请刷新页面',true);return;}
   const deleting=kind.startsWith('delete-');
   const identity=`<p class="muted">标识：<span class="mono artifact-delete-digest">${esc(item.id)}</span></p>`;
   const consequence=entity==='device'?'删除直连设备会同时移除其访问凭据；网关子设备不会删除网关凭据。':entity==='gateway'?'删除网关会同时使其访问凭据失效。有授权子设备时不能删除。':entity==='key'?'删除未引用公钥不会删除本机私钥。有硬件或固件引用时不能删除；在用公钥可使用“吊销”。':'已有引用或历史记录时不能删除。不会级联删除其他数据。';
   const body=deleting?`<p>确认删除${esc(label)}“${esc(item.name)}”吗？</p>${identity}<div class="notice error">${esc(consequence)}没有回收站。</div>`:field(label+'名称','name',`required maxlength="${entity==='target'?100:80}"`,item.name)+(entity==='product'?`<label>产品说明<textarea name="description" maxlength="500">${esc(item.description||'')}</textarea></label>`:'')+identity+(entity==='target'?'<div class="notice">仅修改显示名称，不改变芯片、布局、容量、签名公钥等兼容参数。兼容参数变化请新增硬件型号。</div>':'');
   formDialog(deleting?'manage-delete':'manage-edit',(deleting?'删除':'编辑')+label,body,deleting?'确认删除':'保存修改');
   const form=$('#entry-form');form.dataset.id=id;form.dataset.collection=collection;
   if(deleting)$('[type=submit]',form).className='danger';return;
  }
 }
 if(kind==='delete-artifact'){const {openArtifactDeletion}=await import('/static/retention-ui.mjs');if(request!==formRequest)return;await openArtifactDeletion({id,api,post,esc,size,showDialog,onChanged:refresh,toast});return;}
 if(kind==='pack'){const {openPack}=await import('/static/pack-ui.mjs');if(request!==formRequest)return;openPack({state,api,post,esc,size,showDialog,closeDialog,onUploaded:refresh,onAdvanced:()=>openForm('upload'),toast});return;}
 if(['key','target'].includes(kind)&&!state.products.length){toast('请先创建产品',true);return;}
 if(['device','upload','publish'].includes(kind)&&!state.targets.length){toast('请先添加签名公钥和硬件型号',true);return;}
 if(kind==='product')formDialog(kind,'新建产品',field('产品名称','name','required maxlength="80" placeholder="例如：桌面伴侣"')+field('产品标识','id','required pattern="[a-z0-9](?:[a-z0-9_]|-){1,63}" placeholder="例如：desk-monitor"')+'<label>产品说明<textarea name="description" maxlength="500"></textarea></label>');
 if(kind==='key')formDialog(kind,'添加签名公钥',select('所属产品','product_id',options(state.products))+field('公钥名称','name','required maxlength="80"')+'<label>公钥 PEM<textarea name="pem" class="mono" required placeholder="-----BEGIN PUBLIC KEY-----"></textarea></label><label>或选择 public.pem<input type="file" id="pem-file" accept=".pem,.pub"></label><p class="form-hint">只上传 RSA-3072/4096 公钥。同一公钥归属一个产品，私钥留在本机。</p>');
 if(kind==='target'){
  if(!state.keys.some(k=>!k.revoked)){toast('请先添加签名公钥',true);return;}
  formDialog(kind,'新增硬件型号',select('所属产品','product_id',options(state.products))+select('镜像格式 / 适配器','adapter',Object.entries(state.adapters).map(([v,n])=>`<option value="${v}">${esc(n)}</option>`).join(''))+'<div class="form-grid">'+field('型号名称','name','required maxlength="100"')+field('型号标识','id','required pattern="[a-z0-9](?:[a-z0-9_]|-){1,63}"')+field('MCU 型号','mcu','required')+field('硬件修订','hw_revision','required','1.0')+field('布局标识','layout_id','required pattern="[a-z0-9](?:[a-z0-9_]|-){1,63}"')+field('最大镜像字节数','max_size','required type="number" min="256" max="134217728"')+field('最低 Bootloader 版本','min_bootloader','required','0.1.0')+'</div>'+select('签名公钥','key_id','')+'<label>此硬件已实现的能力</label><div class="checkboxes"><label><input type="checkbox" checked disabled>完整固件暂存</label><label><input type="checkbox" checked disabled>应用启动确认</label><label><input type="checkbox" name="rollback">自动回滚</label><label><input type="checkbox" name="gateway_transport">网关传输</label></div><label>适配器配置 JSON<textarea name="config" class="mono" required></textarea></label><p class="form-hint">仅声明实机已实现的能力。配置不可变，布局/公钥变化时新增型号。JSON 地址使用十进制。</p>');fillKeys();fillPreset();
 }
 if(kind==='device')formDialog(kind,'添加设备',field('设备名称','name','required maxlength="80"')+select('硬件型号','target_id',options(state.targets))+select('更新通道','channel','<option value="stable">stable · 稳定版</option><option value="beta">beta · 测试版</option>')+select('联网方式','gateway_id','<option value="">直接联网 · 生成独立凭据</option>'+options(state.gateways.filter(x=>!x.revoked))));
 if(kind==='gateway')formDialog(kind,'添加联网网关',field('网关名称','name','required maxlength="80"')+'<p class="form-hint">网关只能代理分配给它的子设备，目标 MCU 需实现匹配的 Bootloader 和传输协议。</p>');
 if(kind==='upload')formDialog(kind,'上传签名固件','<div class="notice">导出硬件配置，在本机生成 manifest.json 和 signature.txt，再上传以下三个文件。</div><label>固件文件<input name="firmware" type="file" required accept=".bin"></label><label>manifest.json<input name="manifest" type="file" required accept=".json"></label><label>signature.txt<input name="signature" type="file" required accept=".txt,.sig"></label><label>更新说明<textarea name="notes" maxlength="2000"></textarea></label>','上传并验证');
 if(kind==='publish'){
  let selected=null;if(id){selected=await api('/api/admin/artifacts/'+encodeURIComponent(id));if(request!==formRequest)return;if(!selected.can_publish)throw Error(selected.publish_block_reasons?.join('；')||selected.firmware_message||'此固件当前不可发布');}
  const files=state.artifacts.filter(item=>item.can_publish);if(selected&&!files.some(item=>item.id===selected.id))files.unshift(selected);
  if(!files.length){toast('请先上传可用且已验证的固件',true);return;}
  const choices=files.map(item=>({...item,label:`${item.version} · ${item.target_name} · SHA ${item.sha256.slice(0,10)} · ${item.id.slice(0,8)}`}));
  formDialog(kind,'发布固件',select('固件版本 / 构建','artifact_id',options(choices,'label',false))+select('发布通道','channel','<option value="stable">stable · 稳定版</option><option value="beta">beta · 测试版</option>')+'<label>发布说明<textarea name="notes" maxlength="2000"></textarea></label><div class="notice">请核对固件摘要与通道。发布将替代此硬件型号、此通道的活动发布。</div>','确认发布');
  const form=$('#entry-form');form.publishArtifacts=files;if(id)$('[name=artifact_id]',form).value=id;
  if(preset)$('[name=channel]',form).value=preset.channel;
  $('[name=notes]',form).value=preset?preset.notes:(selected||files[0]).notes||'';
 }
 if(kind==='channel'){formDialog(kind,'切换设备更新通道',select('更新通道','channel','<option value="stable">stable · 稳定版</option><option value="beta">beta · 测试版</option>'));$('#entry-form').dataset.id=id;$('[name=channel]',$('#dialog')).value=state.devices.find(x=>x.id===id).channel;}
}
function fillKeys(){const f=$('#entry-form');$('[name=key_id]',f).innerHTML=options(state.keys.filter(x=>x.product_id===$('[name=product_id]',f).value&&!x.revoked));}
function fillPreset(){const f=$('#entry-form'),a=$('[name=adapter]',f).value,p={'esp-idf-app':{name:'ESP32-S3 桌面伴侣',id:'desktop-s3-n8r8-st7735s-v1',mcu:'ESP32-S3',layout_id:'ota-3m-v1',max_size:3145728,config:{chip_id:9,project_name:'00_BASIC'}},'raw-cortexm':{name:'STM32 自定义应用',id:'stm32-custom-v1',mcu:'请填写精确型号',layout_id:'stm32-app-v1',max_size:262144,config:{app_address:134250496,ram_start:536870912,ram_size:65536}},'mcuboot-image':{name:'MCUboot 应用目标',id:'mcuboot-target-v1',mcu:'请填写精确型号',layout_id:'mcuboot-slot-v1',max_size:262144,config:{header_size:512,load_address:0}}}[a];for(const[k,v]of Object.entries(p))$(`[name="${k}"]`,f).value=k==='config'?JSON.stringify(v,null,2):v;}
listen(document,'change',async e=>{if(e.target.id==='pem-file'&&e.target.files[0])$('[name=pem]',$('#dialog')).value=await e.target.files[0].text();if(e.target.name==='product_id'&&$('#entry-form')?.dataset.kind==='target')fillKeys();if(e.target.name==='adapter')fillPreset();if(e.target.name==='artifact_id'&&$('#entry-form')?.dataset.kind==='publish')$('[name=notes]',$('#dialog')).value=($('#entry-form').publishArtifacts||state.artifacts).find(x=>x.id===e.target.value)?.notes||'';});
listen(document,'submit',async e=>{if(!e.target.matches('form#entry-form'))return;e.preventDefault();const form=e.target,kind=form.dataset.kind,data=Object.fromEntries(new FormData(form)),submit=$('[type=submit]',form),error=$('.form-error',form);if(!managementGuard())return;submit.disabled=true;error.hidden=true;try{let result;if(kind==='release-edit')result=await api('/api/admin/releases/'+encodeURIComponent(form.dataset.id),{method:'PATCH',body:JSON.stringify(data)});else if(kind==='release-delete')result=await post('/api/admin/releases/'+encodeURIComponent(form.dataset.id)+'/delete',{});else if(kind==='manage-edit')result=await api('/api/admin/'+form.dataset.collection+'/'+encodeURIComponent(form.dataset.id),{method:'PATCH',body:JSON.stringify(data)});else if(kind==='manage-delete')result=await post('/api/admin/'+form.dataset.collection+'/'+encodeURIComponent(form.dataset.id)+'/delete',{});else if(kind==='target'){data.max_size=Number(data.max_size);data.config=JSON.parse(data.config);data.capabilities=['staging','app_confirm'];for(const k of ['rollback','gateway_transport']){if(data[k])data.capabilities.push(k);delete data[k];}result=await post('/api/admin/targets',data);}else if(kind==='device'){if(!data.gateway_id)data.gateway_id=null;result=await post('/api/admin/devices',data);}else if(kind==='upload')result=await api('/api/admin/artifacts',{method:'POST',body:new FormData(form)});else if(kind==='channel')result=await post('/api/admin/devices/'+form.dataset.id+'/channel',data);else result=await post('/api/admin/'+({product:'products',key:'keys',gateway:'gateways',publish:'releases'}[kind]),data);if(form.isConnected&&$('#entry-form')===form)closeDialog();toast(kind==='upload'?(result.duplicate?'固件已存在':'固件验证通过，已存入固件库'):'操作成功');await refresh();if(result.token)showSecret(result);}catch(err){if(form.isConnected){error.textContent=err.message;error.hidden=false;}else toast(err.message,true);}finally{if(form.isConnected)submit.disabled=!managementReady;}});
const handleClick=async e=>{const b=e.target.closest('[data-action]');if(!b)return;const{action:kind,id}=b.dataset;if(['product','key','target','device','gateway','pack','upload','publish','channel','delete-artifact','edit-release','delete-release','republish',...Object.keys(managed).flatMap(key=>['edit-'+key,'delete-'+key])].includes(kind)){try{await openForm(kind,id);}catch(error){toast(error.message,true);}return;}try{if(kind==='close'){closeDialog();return;}if(kind==='copy-token'){await navigator.clipboard.writeText($('#secret-token').textContent);toast('密钥已复制');return;}if(kind==='profile'){downloadJSON(await api('/api/admin/targets/'+id+'/profile'),id+'.profile.json');toast('型号配置已导出');return;}if(kind==='events'){const request=++formRequest;const events=await api('/api/admin/attempts/'+id+'/events');if(request!==formRequest)return;showDialog('升级事件',events.length?events.map(x=>{const p=JSON.parse(x.payload);return `<div class="setup-step"><span class="step-num">${x.seq}</span><div class="step-text"><b>${esc(labels[p.state]||p.state)}</b><p>${esc(when(x.created))} · ${p.progress}%</p>${p.error?`<p>${esc(p.error)}</p>`:''}</div></div>`;}).join(''):empty('暂无事件','设备尚未上报安装进度。'));return;}const prompts={withdraw:'撤回后新的升级尝试不能选择它，已创建的下载仍绑定原文件。继续吗？',revoke:'停用此凭据？网关凭据停用会同时影响其子设备。',rotate:'旧密钥会立即失效，请准备更新设备或网关配置。继续吗？','revoke-key':'吊销公钥将停止相关固件的检查和下载。继续吗？'};if(!confirm(prompts[kind]||'确认操作？'))return;const path=kind==='withdraw'?'/api/admin/releases/'+id+'/withdraw':kind==='revoke-key'?'/api/admin/keys/'+id+'/revoke':'/api/admin/agents/'+id+'/'+(kind==='rotate'?'rotate':'revoke'),data=await post(path);toast('操作成功');await refresh();if(data.token)showSecret(data);}catch(error){toast(error.message,true);}};
listen(document,'click',handleClick);
listen($('#dialog-close'),'click',closeDialog);listen($('#dialog'),'cancel',closeDialog);listen($('#refresh'),'click',refresh);
listen(document,'visibilitychange',()=>{if(!document.hidden)void refresh();});
listen($('#logout'),'click',async()=>{try{await post('/api/admin/logout');location.href='/login';}catch(error){toast(error.message,true);}});
listen($('#help'),'click',()=>showDialog('开始使用 OTA Station','<p class="muted">1. 创建产品，首次生成签名密钥，仅将公钥添加到后台。</p><p class="muted">2. 创建精确硬件型号，添加设备并保存凭据。</p><p class="muted">3. 首次打包时导入 private.pem，之后只需选择设备、应用 bin，写下更新说明；版本、摘要和清单自动读取或生成。</p><p class="muted">4. 服务器复核通过后，点击“确认发布”。发布影响同型号、同通道的设备，不只限于所选设备。</p><p class="form-hint">签名权限作为不可导出的 CryptoKey 保存在当前浏览器 IndexedDB；原 PEM 和解锁密码不保存、不发送服务器。加密私钥仅首次导入需原密码，后续无需输入。仅在可信个人电脑使用，清除网站数据或换浏览器后需重新导入；请离线备份原私钥。已有离线签名文件可使用高级三文件上传。ESP32、STM32 仍需匹配客户端与 Bootloader。详见 README。</p>'));

// CONTROLLER_STARTUP
let poll=null;
return {
 handleClick,refresh,openForm,closeDialog,request:api,
 start(){poll=setInterval(()=>{if(!document.hidden)refresh(false);},15000);return refresh();},
 dispose(){if(poll)clearInterval(poll);cleanups.forEach(cleanup=>cleanup());closeDialog();},
};
}
