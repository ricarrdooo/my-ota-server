// Private signing keys stay in this browser's IndexedDB as non-exportable CryptoKeys.
import {importSigningKey} from './pack-core.mjs';
import {getSigningKey,saveSigningKey,forgetSigningKey} from './pack-keystore.mjs';
const $=(selector,root=document)=>root.querySelector(selector);
const PREF='ota.pack.preferences.v1';
let active=null;
function preferences(){try{return JSON.parse(localStorage.getItem(PREF)||'{}')||{};}catch{return {};}}
function remember(device_id,channel){try{localStorage.setItem(PREF,JSON.stringify({device_id,channel}));}catch{/* Optional preferences only. */}}
function cleanup(){
  if(!active)return;
  active.cancelled=true;active.abort?.abort();active.worker?.terminate();active.reject?.(Error('已取消本地打包'));
  active.key=null;
  if(active.form?.isConnected){$('#pack-import-password',active.form).value='';$('#pack-key',active.form).value='';}
  active=null;
}
window.addEventListener('ota:dialog-close',cleanup);
function download(value,name,type){const url=URL.createObjectURL(new Blob([value],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function paintProgress(root,stage,message){const order=['check','hash','sign','upload'],index=order.indexOf(stage);for(const item of root.querySelectorAll('[data-pack-stage]')){const i=order.indexOf(item.dataset.packStage);item.classList.toggle('done',i<index);item.classList.toggle('current',i===index);}$('#pack-status',root).textContent=message;}
function localPackage(ctx,input){return new Promise((resolve,reject)=>{
  ctx.reject=reject;
  const worker=new Worker(new URL('./pack-worker.mjs',import.meta.url),{type:'module'});ctx.worker=worker;
  worker.onmessage=event=>{if(ctx.cancelled)return;const m=event.data;if(m.type==='progress')paintProgress(ctx.form,m.stage,m.message);else{worker.terminate();ctx.worker=null;ctx.reject=null;m.type==='done'?resolve(m.result):reject(Error(m.message||'本地打包失败'));}};
  worker.onerror=event=>{event.preventDefault();worker.terminate();ctx.worker=null;ctx.reject=null;reject(Error('本地签名线程无法启动，请刷新页面或使用命令行打包'));};
  worker.postMessage(input,[input.firmware]);
});}

export function openPack({state,api,post,esc,size,showDialog,closeDialog,onUploaded,onAdvanced,toast}){
  cleanup();
  const targets=state.targets.filter(t=>state.keys.some(k=>k.id===t.key_id&&!k.revoked));
  const devices=state.devices.filter(d=>!d.revoked&&targets.some(t=>t.id===d.target_id));
  if(!devices.length){toast('请先添加设备，并为它的硬件型号配置有效签名公钥',true);return;}
  const pref=preferences();
  showDialog('打包并上传固件',`
    <div class="pack-intro"><span class="pack-lock">本机签名</span><div><b>选设备、选固件，写下更新内容</b><p>私钥首次导入后由当前浏览器记住，之后无需重复选择或输入密码。私钥不上传服务器。</p></div></div>
    <form id="pack-form">
      <div class="pack-device-field">
        <label for="pack-device">选择设备</label>
        <select id="pack-device" required aria-describedby="pack-target-info">${devices.map(d=>{const targetName=d.target_name||targets.find(t=>t.id===d.target_id)?.name;return `<option value="${esc(d.id)}">${esc(d.name)}${d.name===targetName?'':' · '+esc(targetName)}</option>`;}).join('')}</select>
        <div id="pack-target-info" class="pack-target-info"></div>
      </div>
      <label class="pack-file-label">应用固件 .bin<input id="pack-firmware" type="file" required accept=".bin"><span class="form-hint">选择编译生成的应用 bin，不是 bootloader 或合并烧录包。</span></label>
      <label>更新说明（可选）<textarea id="pack-notes" maxlength="2000" placeholder="本次更新了什么？"></textarea></label>
      <div class="pack-local-key"><span id="pack-key-status" role="status">正在读取本机签名配置…</span><button id="pack-forget-key" type="button" class="text-button" hidden>移除本机记忆</button></div>
      <details id="pack-key-setup" class="pack-key-help">
        <summary>首次导入签名私钥 / 更换本机配置</summary>
        <p>仅在你信任的个人电脑导入。浏览器将保存可用的签名权限，不保存原 PEM 或密码，也不传到服务器。换电脑、换浏览器或清除网站数据后需重新导入。请另行离线备份原私钥。</p>
        <label>首次导入私钥 .pem<input id="pack-key" type="file" accept=".pem,.key"></label>
        <label id="pack-import-password-row" hidden>原私钥解锁密码（仅首次导入）<input id="pack-import-password" type="password" autocomplete="off" spellcheck="false" maxlength="1024" placeholder="此文件已加密，首次导入需原密码"></label>
        <button id="pack-import-key" type="button" class="secondary">导入并记住</button>
      </details>
      <details id="pack-options" class="pack-key-help">
        <summary>高级选项：版本与发布通道</summary>
        <div class="form-grid"><label>固件版本<input id="pack-version" maxlength="64" placeholder="选择固件后自动读取"></label><label>发布通道<select id="pack-channel"><option value="stable">stable · 稳定版</option><option value="beta">beta · 测试版</option></select></label></div>
        <p>默认使用所选设备的型号与通道。发布会影响同型号、同通道的其他设备，不是只对这一台生效。</p>
      </details>
      <div id="pack-progress" class="pack-progress" aria-live="polite" hidden><ol><li data-pack-stage="check">检查固件</li><li data-pack-stage="hash">计算摘要</li><li data-pack-stage="sign">本地签名</li><li data-pack-stage="upload">验证入库</li></ol><p id="pack-status"></p></div>
      <div class="form-error" role="alert" hidden></div>
      <div class="form-actions"><button type="button" data-action="close">取消</button><button type="submit" class="primary" disabled>打包并上传</button></div>
      <p class="form-hint pack-foot">上传后仍需确认发布，不会自动升级设备。已有清单和签名？<button type="button" id="pack-advanced-upload" class="text-button">使用高级三文件上传</button></p>
    </form>`);
  const form=$('#pack-form'),deviceSelect=$('#pack-device',form),versionInput=$('#pack-version',form),channel=$('#pack-channel',form);
  const error=$('.form-error',form),passwordInput=$('#pack-import-password',form),keyInput=$('#pack-key',form),setup=$('#pack-key-setup',form);
  const ctx={form,cancelled:false,busy:false,importing:false,preview:0,key:null,keyId:null};active=ctx;
  const secure=!!(globalThis.isSecureContext&&globalThis.crypto?.subtle);
  const device=()=>devices.find(d=>d.id===deviceSelect.value);
  const selected=()=>targets.find(t=>t.id===device().target_id);
  const current=ticket=>!ctx.cancelled&&active===ctx&&form.isConnected&&(ticket===undefined||ctx.preview===ticket);
  const syncSubmit=()=>{$('[type=submit]',form).disabled=!secure||!ctx.key||ctx.busy||ctx.importing;};
  const controls=()=>[...form.querySelectorAll('input,select,textarea,button:not([data-action=close])')];
  function fail(message){error.textContent=message;error.hidden=false;}
  function keyState(ready){$('#pack-key-status',form).textContent=ready?'本机签名已就绪 · 无需密码':'尚未导入签名私钥';$('#pack-forget-key',form).hidden=!ready;setup.open=!ready;syncSubmit();}
  if(devices.some(d=>d.id===pref.device_id))deviceSelect.value=pref.device_id;
  else if(pref.target_id&&devices.some(d=>d.target_id===pref.target_id))deviceSelect.value=devices.find(d=>d.target_id===pref.target_id).id;
  channel.value=device().channel==='beta'?'beta':'stable';

  async function preview(resetVersion=true){
    const ticket=++ctx.preview,t=selected(),d=device(),file=$('#pack-firmware',form).files[0];
    ctx.key=null;syncSubmit();error.hidden=true;
    if(ctx.keyId!==t.key_id){keyInput.value='';passwordInput.value='';$('#pack-import-password-row',form).hidden=true;}
    ctx.keyId=t.key_id;
    $('#pack-target-info',form).innerHTML=`<span>${esc(t.name)}</span><span>${esc(t.adapter)}</span><span>上限 ${size(t.max_size)}</span><span>${esc(channel.value)}</span>`;
    versionInput.readOnly=t.adapter!=='raw-cortexm';versionInput.required=t.adapter==='raw-cortexm';
    versionInput.placeholder=versionInput.readOnly?'从固件自动读取':'此格式需填写版本，例如 1.0.0';
    if(resetVersion)versionInput.value='';
    $('#pack-options',form).open=t.adapter==='raw-cortexm';
    remember(d.id,channel.value);
    try{
      const key=await getSigningKey(t.key_id);
      if(!current(ticket))return;
      ctx.key=key;keyState(!!key);
      if(!secure){fail('本地签名需要 HTTPS，或在服务器电脑上使用 http://127.0.0.1；普通局域网 HTTP 不支持。');return;}
      if(!file||!versionInput.readOnly||!resetVersion)return;
      const bytes=new Uint8Array(await file.slice(0,288).arrayBuffer());
      if(!current(ticket))return;
      if(t.adapter==='esp-idf-app'&&bytes.length>=80&&bytes[0]===0xe9){const s=bytes.subarray(48,80),end=s.indexOf(0);versionInput.value=new TextDecoder().decode(end<0?s:s.subarray(0,end));}
      else if(t.adapter==='mcuboot-image'&&bytes.length>=28){const view=new DataView(bytes.buffer);if(view.getUint32(0,true)===0x96f3b83d)versionInput.value=`${bytes[20]}.${bytes[21]}.${view.getUint16(22,true)}+${view.getUint32(24,true)}`;}
    }catch(e){if(current(ticket)){ctx.key=null;keyState(false);fail(e.message||'无法读取本机签名配置');}}
  }
  deviceSelect.addEventListener('change',()=>{channel.value=device().channel==='beta'?'beta':'stable';preview();});
  $('#pack-firmware',form).addEventListener('change',()=>preview());
  channel.addEventListener('change',()=>{remember(device().id,channel.value);preview(false);});
  keyInput.addEventListener('change',async()=>{
    passwordInput.value='';const file=keyInput.files[0];$('#pack-import-password-row',form).hidden=true;
    if(!file||file.size>65536)return;
    try{const header=await file.slice(0,128).text();if(current()&&keyInput.files[0]===file)$('#pack-import-password-row',form).hidden=!header.includes('BEGIN ENCRYPTED PRIVATE KEY');}catch{/* Import reports the actual error. */}
  });
  $('#pack-import-key',form).addEventListener('click',async()=>{
    if(ctx.busy||ctx.importing||!secure)return;
    const file=keyInput.files[0],keyId=selected().key_id;
    if(!file){fail('请先选择与此设备型号公钥配对的私钥文件');return;}
    if(file.size>65536){fail('私钥文件过大，请选择 PEM 格式的私钥');return;}
    ctx.importing=true;error.hidden=true;const locked=controls();locked.forEach(e=>e.disabled=true);
    let pem='',password='';
    try{
      pem=await file.text();password=passwordInput.value;
      if(!current())return;
      const key=await importSigningKey(pem,password,keyId);
      pem='';password='';passwordInput.value='';
      if(!current())return;
      await saveSigningKey(keyId,key);
      if(!current())return;
      ctx.key=key;keyInput.value='';$('#pack-import-password-row',form).hidden=true;keyState(true);
      toast('已在当前浏览器记住签名配置，后续只需选择固件');
    }catch(e){if(current())fail(e.message||'私钥导入失败，未保存');}
    finally{pem='';password='';if(current()){passwordInput.value='';ctx.importing=false;locked.forEach(e=>e.disabled=false);syncSubmit();}}
  });
  $('#pack-forget-key',form).addEventListener('click',async()=>{
    if(ctx.busy||ctx.importing||!confirm('移除当前浏览器记住的签名配置？不会删除原私钥文件或吊销平台公钥；下次打包需重新导入。'))return;
    const keyId=selected().key_id;ctx.key=null;syncSubmit();
    try{await forgetSigningKey(keyId);if(current())await preview(false);}
    catch(e){if(current())fail(e.message||'移除失败，请重试');}
  });
  $('#pack-advanced-upload',form).addEventListener('click',()=>{closeDialog();onAdvanced();});
  preview();

  form.addEventListener('submit',async event=>{
    event.preventDefault();if(ctx.busy||ctx.importing||ctx.cancelled)return;
    const t=selected(),d=device(),firmware=$('#pack-firmware',form).files[0],key=ctx.key;
    error.hidden=true;
    if(!key){fail('请先完成一次本机私钥导入');return;}
    if(!firmware)return;
    if(firmware.size>t.max_size||firmware.size<8){fail('固件长度无效或超过此型号容量');return;}
    ctx.busy=true;ctx.abort=new AbortController();const locked=controls();locked.forEach(e=>e.disabled=true);
    $('#pack-progress',form).hidden=false;paintProgress(form,'check','正在读取设备型号和固件');
    try{
      const profile=await api('/api/admin/targets/'+encodeURIComponent(t.id)+'/profile',{signal:ctx.abort.signal});
      if(!current())return;
      const firmwareBuffer=await firmware.arrayBuffer();
      if(!current())return;
      const result=await localPackage(ctx,{profile,firmware:firmwareBuffer,signingKey:key,version:versionInput.value||null});
      if(!current())return;
      paintProgress(form,'upload','签名完成，正在上传并由服务器独立复核');
      // Explicit allowlist: neither PEM, password nor CryptoKey is sent.
      const body=new FormData();body.append('firmware',firmware,firmware.name);
      body.append('manifest',new Blob([JSON.stringify(result.manifest,null,2)],{type:'application/json'}),'manifest.json');
      body.append('signature',new Blob([result.signature+'\n'],{type:'text/plain'}),'signature.txt');
      body.append('notes',$('#pack-notes',form).value);
      const uploaded=await api('/api/admin/artifacts',{method:'POST',body,signal:ctx.abort.signal});
      if(!current())return;
      const chosenChannel=channel.value;remember(d.id,chosenChannel);
      await onUploaded();if(!current())return;
      ctx.key=null;form.replaceChildren();active=null;ctx.busy=false;
      showResult({uploaded,result,target:t,device:d,channel:chosenChannel,esc,size,showDialog,closeDialog,post,onUploaded,toast});
    }catch(e){if(!current())return;fail(e.name==='AbortError'?'操作已取消；如已开始上传，请到固件库确认是否入库':e.message);$('#pack-status',form).textContent='未发布。修正后可重新打包并上传。';}
    finally{ctx.busy=false;if(form.isConnected){locked.forEach(e=>e.disabled=false);syncSubmit();}}
  });
}

function showResult({uploaded,result,target,device,channel,esc,size,showDialog,closeDialog,post,onUploaded,toast}){
  const m=result.manifest;
  showDialog('固件已验证，等待发布',`
    <div class="pack-success"><span>✓</span><div><b>${uploaded.duplicate?'固件已存在，校验一致':'打包并上传成功'}</b><p>私钥未上传。制品已入库，尚未激活发布。</p></div></div>
    <dl class="pack-summary"><dt>所选设备</dt><dd>${esc(device.name)}</dd><dt>硬件型号</dt><dd>${esc(target.name)}</dd><dt>固件版本</dt><dd>${esc(m.version)}</dd><dt>固件大小</dt><dd>${size(m.size)}</dd><dt>完整 bin SHA-256</dt><dd class="mono pack-digest">${esc(m.sha256)}</dd></dl>
    <div class="pack-downloads"><button id="pack-save-manifest">下载清单</button><button id="pack-save-signature">下载签名</button></div>
    <label>发布通道<select id="pack-publish-channel"><option value="stable">stable · 稳定版</option><option value="beta">beta · 测试版</option></select></label>
    <p class="form-hint">确认后会替代此型号、此通道的活动发布。同型号、同通道的其他设备也可获取更新，并非只升级所选设备。</p>
    <div id="pack-publish-error" class="form-error" role="alert" hidden></div>
    <div class="form-actions"><button type="button" data-action="close">暂不发布</button><button id="pack-confirm-publish" class="primary">确认发布</button></div>`);
  const root=$('#dialog-body'),select=$('#pack-publish-channel',root),button=$('#pack-confirm-publish',root);
  select.value=channel;button.textContent='确认发布到 '+channel;
  select.addEventListener('change',()=>{remember(device.id,select.value);button.textContent='确认发布到 '+select.value;});
  $('#pack-save-manifest',root).addEventListener('click',()=>download(JSON.stringify(m,null,2)+'\n','manifest.json','application/json'));
  $('#pack-save-signature',root).addEventListener('click',()=>download(result.signature+'\n','signature.txt','text/plain'));
  button.addEventListener('click',async()=>{
    const error=$('#pack-publish-error',root);error.hidden=true;button.disabled=true;select.disabled=true;
    try{await post('/api/admin/releases',{artifact_id:uploaded.id,channel:select.value});await onUploaded();if(button.isConnected){closeDialog();toast('发布成功，设备现在可以检查到此固件');}}
    catch(e){if(error.isConnected){error.textContent=e.message;error.hidden=false;button.disabled=false;select.disabled=false;}}
  });
}
