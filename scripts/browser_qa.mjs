// Real browser smoke test; owns only its isolated browser/server processes.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp, readFile, mkdir, writeFile, access, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
// The requested UI is desktop-first. Preserve the original workflow coverage,
// but do not spend this suite on a separately adapted phone interface.
const desktopOnly=true;
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,description,timeout=20000){const end=Date.now()+timeout;let last;while(Date.now()<end){try{const value=await fn();if(value)return value;}catch(e){last=e;}await pause(100);}throw Error(`Timeout: ${description}${last?' ('+last.message+')':''}`);}
const temporary=await mkdtemp(path.join(tmpdir(),'ota-browser-qa-'));
const outputs=path.join(root,'artifacts');
await mkdir(outputs,{recursive:true});
let server,browser,ws,fixture,serverErrors='',consoleErrors=[],requestId=0,javascriptDialog=null;
const networkErrors=[],networkPaths=new Map();
const pending=new Map();
function cdp(method,params={}){if(desktopOnly&&method==='Emulation.setDeviceMetricsOverride'&&params.mobile)params={...params,width:1440,height:1000,mobile:false};const id=++requestId;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(id);reject(Error(`CDP timeout ${method}`));},20000);pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}));});}
async function evaluate(expression){const result=await cdp('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true});if(result.exceptionDetails)throw Error(result.exceptionDetails.text+': '+result.exceptionDetails.exception?.description);return result.result.value;}
const js=v=>JSON.stringify(v);
async function click(selector){await until(()=>evaluate(`!!document.querySelector(${js(selector)})`),selector);await evaluate(`document.querySelector(${js(selector)}).click()`);}
async function fill(name,value){await evaluate(`(()=>{const e=document.querySelector('dialog [name='+${js(name)}+']');if(!e)throw Error('No field '+${js(name)});e.value=${js(String(value))};e.dispatchEvent(new Event('change',{bubbles:true}));})()`);}
async function dialog(kind){if(kind==='upload'&&!await evaluate("!!document.querySelector('#main [data-action=upload]')")){await openPack();await click('#pack-advanced-upload');}else await click(`#main [data-action="${kind}"]`);await until(()=>evaluate(`document.querySelector('#entry-form')?.dataset.kind===${js(kind)}`),'dialog '+kind);}
async function submit(){assert.equal(await evaluate("document.querySelector('#entry-form').reportValidity()"),true,'form must pass HTML validation');await evaluate("document.querySelector('#entry-form').requestSubmit()");await until(async()=>{const error=await evaluate("document.querySelector('.form-error:not([hidden])')?.textContent");if(error)throw Error(error);return evaluate("!document.querySelector('#entry-form')");},'form submitted');await until(()=>evaluate("document.querySelector('#sync-status').textContent.startsWith('已同步')"),'refresh');}
async function go(page){await evaluate(`location.hash=${js(page)}`);await until(()=>evaluate(`document.querySelector('nav [data-page="${page}"]').classList.contains('active')`),'page '+page);}
async function screenshot(name){if(desktopOnly)name=name.replaceAll('mobile','desktop-alt');await evaluate("document.querySelector('#toast')?.setAttribute('hidden','')");const metrics=await cdp('Page.getLayoutMetrics'),rect=metrics.cssContentSize;const result=await cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{x:0,y:0,width:rect.width,height:rect.height,scale:1}});await writeFile(path.join(outputs,name),Buffer.from(result.data,'base64'));}
async function setFile(selector,file){const doc=await cdp('DOM.getDocument'),node=await cdp('DOM.querySelector',{nodeId:doc.root.nodeId,selector});await cdp('DOM.setFileInputFiles',{nodeId:node.nodeId,files:[path.join(fixture.directory,file)]});}
async function setField(selector,value){await evaluate(`(()=>{const e=document.querySelector(${js(selector)});e.value=${js(value)};e.dispatchEvent(new Event('change',{bubbles:true}));})()`);}
async function openPack(){await click('#main [data-action=pack]');await until(()=>evaluate("!!document.querySelector('#pack-form')"),'pack form');}
async function adminData(path){return evaluate(`fetch(${js('/api/admin/'+path)}).then(r=>r.json())`);}
async function packSubmit(){assert.equal(await evaluate("document.querySelector('#pack-form').reportValidity()"),true,'pack form valid');await evaluate("document.querySelector('#pack-form').requestSubmit()");}
async function packReady(expected=true){await until(()=>evaluate(`document.querySelector('#pack-key-status')?.textContent.includes(${js(expected?'已就绪':'尚未导入')})`),expected?'remembered signing key ready':'missing signing key');}
async function savedKeyInfo(keyId){return evaluate(`(async()=>{const {getSigningKey}=await import('/static/pack-keystore.mjs');const key=await getSigningKey(${js(keyId)});if(!key)return null;let exportBlocked=false;try{await crypto.subtle.exportKey('pkcs8',key);}catch{exportBlocked=true;}return {type:key.type,extractable:key.extractable,usages:[...key.usages],algorithm:key.algorithm.name,exportBlocked};})()`);}
async function importKey(file,password){await setFile('#pack-key',file);if(password!==undefined){await until(()=>evaluate("!document.querySelector('#pack-import-password-row').hidden"),'encrypted key import password revealed');await setField('#pack-import-password',password);}else await until(()=>evaluate("document.querySelector('#pack-import-password-row').hidden"),'unencrypted key has no password prompt');await click('#pack-import-key');}
async function confirmClick(selector,accept=true){javascriptDialog=null;const clicked=cdp('Runtime.evaluate',{expression:`document.querySelector(${js(selector)}).click()`});await until(()=>javascriptDialog,'confirmation dialog');await cdp('Page.handleJavaScriptDialog',{accept});await clicked;}
async function reload(){await cdp('Page.reload');await until(()=>evaluate("document.querySelector('#sync-status')?.textContent.startsWith('已同步')"),'reloaded dashboard');}
async function createDevice(name,targetId){await go('devices');await dialog('device');await fill('name',name);await fill('target_id',targetId);await submit();await until(()=>evaluate("!!document.querySelector('#secret-token')"),'device credential');await click('#dialog-close');return (await adminData('devices')).find(d=>d.name===name).id;}
async function theme(preference,actual=preference){await setField('#theme-select',preference);await until(()=>evaluate(`document.documentElement.dataset.theme===${js(actual)}&&document.documentElement.dataset.themePreference===${js(preference)}`),'theme '+preference+'/'+actual);assert.equal(await evaluate("localStorage.getItem('ota-station-theme')"),preference);}
async function systemTheme(value){await cdp('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value}]});}
async function checkPackSpacing(){
  const result=await evaluate(`(()=>{const r=selector=>document.querySelector(selector).getBoundingClientRect();const label=r('label[for=pack-device]'),select=r('#pack-device'),info=r('#pack-target-info'),fileLabel=r('.pack-file-label'),fileInput=r('.pack-file-label input'),hint=r('.pack-file-label .form-hint'),notes=r('#pack-notes'),key=r('.pack-local-key');return {label:select.top-label.bottom,info:info.top-select.bottom,next:fileLabel.top-info.bottom,hint:hint.top-fileInput.bottom,key:key.top-notes.bottom,overflow:document.querySelector('#dialog').scrollWidth>document.querySelector('#dialog').clientWidth};})()`);
  for(const [key,min]of Object.entries({label:8,info:8,next:18,hint:8,key:16}))assert.ok(result[key]>=min-0.5,`pack ${key} gap: ${result[key]}`);
  assert.equal(result.overflow,false,'pack dialog has no horizontal clipping');
}
async function checkStatusSpacing(){
  const result=await evaluate(`(()=>{let count=0,min=Infinity;for(const cell of document.querySelectorAll('.release-table td.release-status')){const badges=[...cell.querySelectorAll('.badge')];for(let index=1;index<badges.length;index++){count++;min=Math.min(min,badges[index].getBoundingClientRect().top-badges[index-1].getBoundingClientRect().bottom);}}return {count,min};})()`);
  assert.ok(result.count>0,'release status stacks rendered');assert.ok(result.min>=6,`status label gap: ${result.min}`);
}
async function checkWorkbenchStyle(){
  const result=await evaluate(`(()=>{const active=document.querySelector('nav a.active'),sidebar=document.querySelector('.sidebar'),nav=getComputedStyle(active),side=getComputedStyle(sidebar);return {theme:document.querySelector('.desktop-app')?.dataset.visualTheme,icons:document.querySelectorAll('nav a svg').length,foreground:nav.color,background:nav.backgroundColor,sidebar:side.backgroundColor};})()`);
  assert.equal(result.theme,'atelier');assert.equal(result.icons,6,'navigation has one consistent local SVG icon per page');
  const luminance=color=>{const rgb=color.match(/[\d.]+/g).slice(0,3).map(value=>{const channel=Number(value)/255;return channel<=0.04045?channel/12.92:((channel+0.055)/1.055)**2.4;});return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];};
  const a=luminance(result.foreground),b=luminance(result.background),contrast=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
  assert.ok(contrast>=4.5,'selected navigation text contrast: '+contrast.toFixed(2));
}
async function search(selector,value){await evaluate(`(()=>{const input=document.querySelector(${js(selector)});input.value=${js(value)};input.dispatchEvent(new Event('input',{bubbles:true}));})()`);}

try{
  const python=path.join(root,'.venv','Scripts','python.exe');
  await access(python);
  server=spawn(python,['-B','tests/browser_fixture.py',temporary],{cwd:root,windowsHide:true,env:{...process.env,PYTHONPATH:root,PYTHONIOENCODING:'utf-8'},stdio:['ignore','pipe','pipe']});
  let output='';
  server.stdout.on('data',b=>{output+=b.toString();});
  server.stderr.on('data',b=>{serverErrors+=b.toString();});
  fixture=await until(()=>{const line=output.split('\n').find(v=>v.startsWith('QA_READY '));if(line)return JSON.parse(line.slice(9));if(server.exitCode!==null)throw Error(serverErrors);},'fixture starts',30000);
  await until(async()=>{const r=await fetch(fixture.base+'/healthz');return r.ok;},'server health');
  const edge=process.env.OTA_QA_BROWSER||'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  await access(edge);
  const profileDir=path.join(temporary,'edge');
  browser=spawn(edge,['--headless=new','--remote-debugging-port=0',`--user-data-dir=${profileDir}`,'--no-first-run','--no-default-browser-check','about:blank'],{windowsHide:true,stdio:'ignore'});
  const port=await until(async()=>Number((await readFile(path.join(profileDir,'DevToolsActivePort'),'utf8')).split('\n')[0]),'isolated Edge starts');
  const targets=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const page=targets.find(x=>x.type==='page');
  ws=new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
  ws.addEventListener('message',event=>{const m=JSON.parse(event.data);if(m.id){const p=pending.get(m.id);if(p){clearTimeout(p.timer);pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result);}}else if(m.method==='Page.javascriptDialogOpening')javascriptDialog=m.params;else if(m.method==='Runtime.exceptionThrown')consoleErrors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);else if(m.method==='Log.entryAdded'&&m.params.entry.level==='error'&&!m.params.entry.text.includes('favicon.ico'))consoleErrors.push(m.params.entry.text);});
  ws.addEventListener('message',event=>{const message=JSON.parse(event.data);if(message.method==='Network.requestWillBeSent'){const {requestId,request}=message.params;networkPaths.set(requestId,new URL(request.url).pathname);}else if(message.method==='Network.loadingFailed'){const {requestId,errorText,canceled}=message.params;networkErrors.push({path:networkPaths.get(requestId),errorText,canceled:!!canceled});}else if(message.method==='Network.loadingFinished')networkPaths.delete(message.params.requestId);});
  await cdp('Page.enable');await cdp('Runtime.enable');await cdp('Log.enable');await cdp('Network.enable');
  await cdp('Page.addScriptToEvaluateOnNewDocument',{source:"(()=>{const original=globalThis.fetch;globalThis.qaFetchFailures=[];globalThis.fetch=(input,options)=>original(input,options).catch(error=>{qaFetchFailures.push({path:new URL(String(input),location.href).pathname,name:error.name,message:error.message,aborted:!!options?.signal?.aborted});throw error;});})()"});
  await cdp('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await systemTheme('light');
  await cdp('Page.navigate',{url:fixture.base+'/login'});
  await until(()=>evaluate("!!document.querySelector('input[name=username]')"),'login');
  assert.equal(await evaluate("document.documentElement.dataset.themePreference"),'system','theme defaults to system');
  assert.equal(await evaluate("document.documentElement.dataset.theme"),'light');
  await theme('dark');await screenshot('login-dark.png');
  await cdp('Page.reload');await until(()=>evaluate("!!document.querySelector('input[name=username]')"),'reloaded login');
  assert.equal(await evaluate("document.documentElement.dataset.theme"),'dark','login theme persists across reload');
  await theme('system','light');await systemTheme('dark');await until(()=>evaluate("document.documentElement.dataset.theme==='dark'"),'system dark theme change');
  await systemTheme('light');await until(()=>evaluate("document.documentElement.dataset.theme==='light'"),'system light theme change');
  await theme('light');
  await systemTheme('dark');assert.equal(await evaluate("document.documentElement.dataset.theme"),'light','manual preference overrides system dark');await systemTheme('light');
  await screenshot('login-desktop.png');
  await evaluate("document.querySelector('[name=username]').value='admin';document.querySelector('[name=password]').value='Test-password-2026';document.querySelector('form').requestSubmit()");
  await until(()=>evaluate("document.querySelector('#sync-status')?.textContent.startsWith('已同步')"),'dashboard');
  await checkWorkbenchStyle();
  assert.equal(await evaluate("!!document.querySelector('.framework-chip')"),false,'technology banner removed from routine UI');
  assert.equal(await evaluate("document.querySelectorAll('#main .setup-step').length"),4,'first-time setup guidance remains available');
  await screenshot('overview-empty.png');
  await go('products');
  await dialog('product');await fill('name','桌面伴侣 · QA');await fill('id','qa-product');await fill('description','独立测试数据，不连接实机');await submit();
  await dialog('key');await fill('name','测试发布公钥');await fill('pem',fixture.pem);await submit();
  await dialog('target');await fill('adapter','raw-cortexm');
  for(const name of ['name','id','mcu','hw_revision','layout_id','max_size','min_bootloader'])await fill(name,fixture.target[name]);
  await fill('config',JSON.stringify(fixture.target.config));await submit();
  await go('devices');await dialog('device');await fill('name','STM32 测试设备');await submit();
  await until(()=>evaluate("!!document.querySelector('#secret-token')"),'one-time token');
  const token=await evaluate("document.querySelector('#secret-token').textContent");
  const deviceId=await evaluate("document.querySelector('#dialog-body pre').textContent");
  await click('#dialog-close');assert.equal(await evaluate("!!document.querySelector('#secret-token')"),false,'token removed from DOM');
  await dialog('gateway');await fill('name','ESP32 测试网关');await submit();await until(()=>evaluate("!!document.querySelector('#secret-token')"),'gateway token');await click('#dialog-close');
  await dialog('device');await fill('name','网关子设备');
  await evaluate("(()=>{const e=document.querySelector('dialog [name=gateway_id]');e.selectedIndex=1;e.dispatchEvent(new Event('change',{bubbles:true}));})()");await submit();
  assert.equal(await evaluate("document.querySelector('#dialog').open"),false,'gateway child does not expose extra credential');
  await go('artifacts');await dialog('upload');
  assert.equal(await evaluate("!!document.querySelector('#main [data-action=upload]')"),false,'advanced upload has one entry inside the pack dialog');
  const doc=await cdp('DOM.getDocument');
  for(const [name,file]of [['firmware','firmware.bin'],['manifest','manifest.json'],['signature','signature.txt']]){const node=await cdp('DOM.querySelector',{nodeId:doc.root.nodeId,selector:`dialog input[name=${name}]`});await cdp('DOM.setFileInputFiles',{nodeId:node.nodeId,files:[path.join(fixture.directory,file)]});}
  await fill('notes','修复升级流程并完善启动确认');await submit();
  await dialog('publish');await submit();
  const auth={Authorization:'Bearer '+token};
  const compatibility={device_id:deviceId,protocol_version:1,target_id:fixture.target.id,layout_id:fixture.target.layout_id,bootloader_version:'0.1.0',capabilities:['staging','app_confirm']};
  const query=new URLSearchParams({...compatibility,capabilities:compatibility.capabilities.join(',')});
  let response=await fetch(fixture.base+'/api/v1/ota/check?'+query,{headers:auth});assert.equal(response.status,200);const update=await response.json();assert.equal(update.update_available,true);
  async function devicePost(url,body){const r=await fetch(fixture.base+url,{method:'POST',headers:{...auth,'Content-Type':'application/json'},body:JSON.stringify(body)});assert.equal(r.status,200,await r.clone().text());return r.json();}
  const attempt=await devicePost('/api/v1/ota/attempts',{...compatibility,release_id:update.release_id,request_id:crypto.randomUUID()});
  response=await fetch(fixture.base+update.download_path+'?attempt_id='+attempt.id,{headers:{...auth,Range:'bytes=0-31'}});assert.equal(response.status,206);assert.equal((await response.arrayBuffer()).byteLength,32);
  let seq=0;
  for(const state of ['downloading','downloaded','validating','installing','pending_boot'])await devicePost(`/api/v1/ota/attempts/${attempt.id}/events`,{seq:++seq,state,progress:state==='downloading'?20:100});
  await click('#refresh');await until(()=>evaluate("document.querySelector('#sync-status').textContent.startsWith('已同步')"),'refresh pending');await go('attempts');
  await until(()=>evaluate("document.querySelector('#main').textContent.includes('等待启动确认')"),'pending boot visible');
  assert.equal(await evaluate("document.querySelector('#main tbody').textContent.includes('升级成功')"),false,'download must not mark success');
  await devicePost(`/api/v1/ota/attempts/${attempt.id}/events`,{seq:++seq,state:'confirmed',progress:100,version:update.manifest.version,sha256:update.manifest.sha256});
  await click('#refresh');await until(()=>evaluate("document.querySelector('#main tbody').textContent.includes('升级成功')"),'confirmed');
  await click('#main [data-attempt-timeline]');await until(()=>evaluate("document.querySelector('dialog.upgrade-timeline')?.textContent.includes('升级成功')"),'events history');await click('[aria-label="关闭时间线"]');
  // Real isolated backend integration: the admin creates a reboot command in
  // Vue, an authenticated simulated device claims it, and a NEW boot confirms.
  await devicePost('/api/v1/devices/heartbeat',{device_id:deviceId,version:update.manifest.version,sha256:update.manifest.sha256,remote_commands_version:1});
  await go('devices');await click('#refresh');
  const remoteRow=`[data-device-id="${deviceId}"]`;
  await until(()=>evaluate(`document.querySelector('${remoteRow} [data-control-kind="device.restart"]')?.disabled===false`),'remote-capable device');
  await click(remoteRow+' [data-control-kind="device.restart"]');
  await until(()=>evaluate("document.querySelector('.device-control-dialog .form-actions .primary')?.disabled===false"),'reboot confirmation ready');
  assert.equal(await evaluate("document.querySelector('.device-control-dialog').innerText.includes('STM32 测试设备')"),true);
  await click('.device-control-dialog .form-actions .primary');
  await until(()=>evaluate("document.querySelector('.command-receipt')?.textContent.includes('等待设备接收')"),'reboot queued, not succeeded');
  const queuedCommand=(await adminData(`devices/${deviceId}/commands`)).commands[0];
  assert.equal(queuedCommand.kind,'device.restart');assert.equal(queuedCommand.status,'queued');
  const initialBoot='a'.repeat(32),restartedBoot='b'.repeat(32);
  const claimed=await devicePost('/api/v1/devices/commands/claim',{device_id:deviceId,boot_id:initialBoot,remote_commands_version:1});
  assert.equal(claimed.command.id,queuedCommand.id);
  await devicePost(`/api/v1/devices/commands/${queuedCommand.id}/events`,{device_id:deviceId,boot_id:initialBoot,status:'executing'});
  await until(()=>evaluate("document.querySelector('.command-receipt')?.textContent.includes('正在执行')"),'reboot executing is polled');
  await devicePost(`/api/v1/devices/commands/${queuedCommand.id}/events`,{device_id:deviceId,boot_id:restartedBoot,status:'succeeded'});
  await until(()=>evaluate("document.querySelector('.command-receipt')?.textContent.includes('执行成功')"),'reboot success requires new boot report');
  await screenshot('remote-restart-integrated.png');await click('[aria-label="关闭设备控制"]');
  // Import only once. The normal path later needs device, bin and notes only.
  await go('artifacts');await openPack();await setField('#pack-device',deviceId);await packReady(false);
  assert.equal(await evaluate("!!document.querySelector('#pack-password')"),false,'old per-package password field removed');
  assert.equal(await evaluate("!!document.querySelector('#pack-target')"),false,'default path chooses a registered device');
  assert.equal(await evaluate("document.querySelector('#pack-device').value"),deviceId);
  assert.equal(await evaluate("document.querySelector('#pack-key').name+document.querySelector('#pack-import-password').name"),'','local import secrets have no form names');
  assert.equal(await evaluate("document.querySelector('#pack-import-password-row').hidden"),true,'password hidden until an encrypted PEM is selected');
  assert.equal(await evaluate("document.querySelector('#pack-options').open"),true,'raw image version options must be visible');
  assert.equal(await evaluate("document.querySelector('#pack-version').required"),true,'raw image requires explicit version');
  await setFile('#pack-firmware','changed.bin');await setField('#pack-version','2.0.0');await setField('#pack-channel','beta');
  await setField('#pack-notes','浏览器记住签名权限，简化个人固件发布');
  await importKey('private.pem','incorrect');
  await until(()=>evaluate("document.querySelector('#pack-form .form-error:not([hidden])')?.textContent.includes('密码')"),'wrong password stays local');
  assert.equal(await savedKeyInfo(fixture.target.key_id),null,'wrong import password never saves a key');
  assert.equal((await(await fetch(fixture.base+'/qa/security-audit')).json()).uploads.length,1,'wrong password never uploads');
  assert.equal(await evaluate("document.querySelector('#pack-import-password').value"),'','failed import clears password');
  await importKey('other-private.pem');
  await until(()=>evaluate("document.querySelector('#pack-form .form-error:not([hidden])')?.textContent.includes('公钥')"),'mismatched private key rejected');
  assert.equal(await savedKeyInfo(fixture.target.key_id),null,'wrong public key never saved under target key ID');
  await importKey('private.pem','Browser-local-test-口令-2026');await packReady();
  assert.deepEqual(await savedKeyInfo(fixture.target.key_id),{type:'private',extractable:false,usages:['sign'],algorithm:'RSA-PSS',exportBlocked:true},'remembered key is a non-exportable signing-only CryptoKey');
  assert.equal(await evaluate("document.querySelector('#pack-key').files.length"),0,'raw PEM file reference cleared after import');
  assert.equal(await evaluate("document.querySelector('#pack-import-password').value"),'','password cleared after import');
  assert.equal(await evaluate("document.querySelector('#pack-key-setup').open"),false,'daily workflow hides setup');
  await packSubmit();await until(()=>evaluate("!!document.querySelector('#pack-confirm-publish')"),'remembered-key pack verified by server');
  assert.equal((await adminData('artifacts')).length,2);assert.equal((await adminData('releases')).length,1,'upload is not release');
  assert.equal(await evaluate("document.querySelector('#dialog-body').textContent.includes('其他设备')"),true,'release scope explicitly includes same-target same-channel devices');
  await screenshot('pack-result-desktop.png');
  let audit=(await(await fetch(fixture.base+'/qa/security-audit')).json()).uploads;
  assert.deepEqual(audit.at(-1).fields,['firmware','manifest','notes','signature']);
  assert.equal(audit.at(-1).private_seen,false);assert.equal(audit.at(-1).password_seen,false);
  await click('#pack-confirm-publish');await until(()=>evaluate("!document.querySelector('#dialog').open"),'explicit publish');
  assert.equal((await adminData('releases')).length,2);
  // Reload proves IndexedDB persistence rather than a page-only cache.
  await reload();await openPack();await packReady();
  assert.equal(await evaluate("document.querySelector('#pack-device').value"),deviceId,'device preference remembered');
  assert.equal(await evaluate("document.querySelector('#pack-channel').value"),'stable','channel defaults to the actual selected device');
  assert.equal(await evaluate("document.querySelector('#pack-key').files.length"),0,'no PEM needs to be selected again');
  assert.equal(await evaluate("document.querySelector('#pack-import-password-row').hidden"),true,'no password requested after reload');
  await setFile('#pack-firmware','changed.bin');await setField('#pack-version','2.0.0');await packReady();
  await packSubmit();await until(()=>evaluate("!!document.querySelector('#pack-confirm-publish')"),'second package uses persisted key without import');
  assert.equal((await adminData('artifacts')).length,2,'identical package stays idempotent');await click('#dialog-close');
  await openPack();await packReady();await setFile('#pack-firmware','changed.bin');await setField('#pack-version','3.0.0');await packReady();
  await evaluate("document.querySelector('#pack-form').requestSubmit();document.querySelector('#dialog-close').click()");
  await pause(300);assert.equal((await(await fetch(fixture.base+'/qa/security-audit')).json()).uploads.length,3,'cancelled pack does not upload');
  // Another target bound to the same public key reuses the persisted key.
  await go('products');await dialog('target');
  for(const name of ['name','id','mcu','hw_revision','layout_id','max_size','min_bootloader'])await fill(name,fixture.esp_target[name]);
  await submit();const espDeviceId=await createDevice('ESP32 二维码桌面设备',fixture.esp_target.id);
  await click(`#main [data-action=edit-device][data-id="${espDeviceId}"]`);await until(()=>evaluate("document.querySelector('#entry-form')?.dataset.kind==='manage-edit'"),'rename same-label device');
  await fill('name',fixture.esp_target.name);await submit();
  await go('artifacts');await openPack();await setField('#pack-device',espDeviceId);await packReady();
  assert.equal(await evaluate("document.querySelector('#pack-device').selectedOptions[0].textContent"),fixture.esp_target.name,'identical device and hardware labels are not repeated');
  await setFile('#pack-firmware','esp-app.bin');
  await until(()=>evaluate(`document.querySelector('#pack-version').value===${js(fixture.esp_version)}`),'ESP native version autofill');
  assert.equal(await evaluate("document.querySelector('#pack-version').readOnly"),true);
  assert.equal(await evaluate("document.querySelector('#pack-options').open"),false,'ESP version/channel options collapsed by default');
  assert.equal(await evaluate("document.querySelector('#pack-key-setup').open"),false,'matching public key reuses setup across targets');
  assert.equal(await evaluate("document.querySelector('#pack-key').files.length"),0);
  await checkPackSpacing();
  await screenshot('pack-form-desktop.png');
  await theme('dark');await screenshot('pack-form-dark-desktop.png');await theme('light');
  await packSubmit();await until(()=>evaluate("!!document.querySelector('#pack-confirm-publish')"),'ESP persistent-key pack result');
  assert.equal(await evaluate("document.querySelector('.pack-digest').textContent"),fixture.esp_sha256);
  await theme('dark');await screenshot('pack-result-dark.png');await theme('light');
  await click('#dialog-close');assert.equal((await adminData('releases')).length,2,'ESP remains draft without confirmation');
  // A different public key must not silently inherit the first key.
  await go('products');await dialog('key');await fill('name','独立型号公钥');await fill('pem',fixture.other_pem);await submit();
  await dialog('target');await fill('adapter','raw-cortexm');
  for(const name of ['mcu','hw_revision','layout_id','max_size','min_bootloader'])await fill(name,fixture.target[name]);
  await fill('id','qa-stm32-other-v1');await fill('name','独立公钥 STM32');await fill('config',JSON.stringify(fixture.target.config));await fill('key_id',fixture.other_key_id);await submit();
  const otherDeviceId=await createDevice('独立公钥设备','qa-stm32-other-v1');
  await go('artifacts');await openPack();await setField('#pack-device',otherDeviceId);await packReady(false);
  assert.equal(await savedKeyInfo(fixture.other_key_id),null,'different public key has no remembered signing grant');
  assert.equal(await evaluate("document.querySelector('#pack-form [type=submit]').disabled"),true,'different key cannot sign until imported');
  await importKey('other-private.pem');await packReady();
  assert.equal(await evaluate("document.querySelector('#pack-import-password-row').hidden"),true,'unencrypted import never needs a password');
  await setFile('#pack-firmware','changed.bin');await setField('#pack-version','1.0.0');await packReady();
  await packSubmit();await until(()=>evaluate("!!document.querySelector('#pack-confirm-publish')"),'independently keyed device packs successfully');await click('#dialog-close');
  await openPack();await packReady();
  await confirmClick('#pack-forget-key',false);await packReady();assert.ok(await savedKeyInfo(fixture.other_key_id),'cancelled forget leaves saved key intact');
  await confirmClick('#pack-forget-key');await packReady(false);assert.equal(await savedKeyInfo(fixture.other_key_id),null,'forget removes the selected key');
  await setField('#pack-device',espDeviceId);await packReady();assert.ok(await savedKeyInfo(fixture.target.key_id),'forget is isolated by public key');
  await confirmClick('#pack-forget-key');await packReady(false);assert.equal(await savedKeyInfo(fixture.target.key_id),null);
  await click('#dialog-close');await reload();await openPack();await packReady(false);
  assert.equal(await evaluate("document.querySelector('#pack-device').value"),espDeviceId);
  await importKey('plain-private.pem');await packReady();
  await setFile('#pack-firmware','esp-app.bin');await packReady();await packSubmit();
  await until(()=>evaluate("!!document.querySelector('#pack-confirm-publish')"),'unencrypted reimport signs successfully after reload');await click('#dialog-close');
  const stored=await evaluate("localStorage.getItem('ota.pack.preferences.v1')");
  assert.deepEqual(Object.keys(JSON.parse(stored)).sort(),['channel','device_id']);assert.ok(!stored.includes('PRIVATE KEY')&&!stored.includes('Browser-local-test'));
  const localStorageValues=await evaluate("JSON.stringify({...localStorage})");assert.ok(!localStorageValues.includes('PRIVATE KEY')&&!localStorageValues.includes('Browser-local-test'),'localStorage never holds PEM or import passwords');
  audit=(await(await fetch(fixture.base+'/qa/security-audit')).json()).uploads;
  assert.equal(audit.length,6);assert.ok(audit.every(x=>!x.private_seen&&!x.password_seen));
  assert.ok(audit.every(x=>JSON.stringify(x.fields)===JSON.stringify(['firmware','manifest','notes','signature'])),'every upload uses the explicit four-field allowlist');
  // A browser storage refusal must not pretend that import was remembered.
  await evaluate("globalThis.qaOriginalIDB=indexedDB;Object.defineProperty(globalThis,'indexedDB',{configurable:true,value:{open(){throw new DOMException('Blocked by browser QA','SecurityError')}}});true");
  await openPack();await until(()=>evaluate("document.querySelector('#pack-form .form-error:not([hidden])')?.textContent.includes('本机')"),'IndexedDB refusal explained');
  assert.equal(await evaluate("document.querySelector('#pack-form [type=submit]').disabled"),true,'storage refusal disables signing submit');
  await importKey('plain-private.pem');
  await until(()=>evaluate("!document.querySelector('#pack-import-key').disabled&&document.querySelector('#pack-form .form-error:not([hidden])')?.textContent.includes('本机')"),'import save refusal explained');
  assert.equal(await evaluate("document.querySelector('#pack-key-status').textContent.includes('已就绪')"),false,'blocked storage never reports a successful remember');
  assert.equal(await evaluate("document.querySelector('#pack-form [type=submit]').disabled"),true);
  assert.equal((await(await fetch(fixture.base+'/qa/security-audit')).json()).uploads.length,6,'blocked local storage never uploads');
  await click('#dialog-close');await evaluate("Object.defineProperty(globalThis,'indexedDB',{configurable:true,value:globalThis.qaOriginalIDB});delete globalThis.qaOriginalIDB");
  for(const pageName of ['overview','products','devices','artifacts','releases','attempts']){await go(pageName);assert.equal(await evaluate("document.documentElement.scrollWidth<=innerWidth"),true,'desktop overflow '+pageName);}
  await go('overview');await screenshot('overview-desktop.png');
  assert.equal(await evaluate("document.querySelector('#main').textContent.includes('从这里开始')"),false,'configured workspace no longer repeats setup guidance');
  await go('devices');await screenshot('devices-desktop.png');
  const lightBackground=await evaluate("getComputedStyle(document.documentElement).backgroundColor");
  await theme('dark');assert.notEqual(await evaluate("getComputedStyle(document.documentElement).backgroundColor"),lightBackground,'dark theme changes rendered palette');
  await reload();assert.equal(await evaluate("document.documentElement.dataset.theme"),'dark','dashboard theme persists across reload');
  await go('overview');await checkWorkbenchStyle();await screenshot('overview-dark.png');
  for(const pageName of ['overview','products','devices','artifacts','releases','attempts']){await go(pageName);assert.equal(await evaluate("document.documentElement.scrollWidth<=innerWidth"),true,'desktop dark overflow '+pageName);}
  await theme('light');
  await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  for(const pageName of ['overview','products','devices','artifacts','releases','attempts']){await go(pageName);assert.equal(await evaluate("document.documentElement.scrollWidth<=innerWidth"),true,'mobile overflow '+pageName);}
  await go('overview');await screenshot('overview-mobile.png');
  await go('artifacts');await openPack();
  assert.equal(await evaluate("document.querySelector('#dialog').scrollWidth<=document.querySelector('#dialog').clientWidth"),true,'mobile pack dialog overflow');
  await screenshot('pack-form-mobile.png');await theme('dark');await screenshot('pack-form-dark-mobile.png');
  await evaluate("document.querySelector('#pack-key-setup').open=true");await setFile('#pack-key','private.pem');
  await until(()=>evaluate("!document.querySelector('#pack-import-password-row').hidden"),'encrypted import visible in mobile dark mode');
  assert.equal(await evaluate("document.querySelector('#dialog').scrollWidth<=document.querySelector('#dialog').clientWidth"),true,'mobile dark import dialog overflow');
  await screenshot('pack-import-mobile-dark.png');await click('#dialog-close');
  for(const pageName of ['overview','products','devices','artifacts','releases','attempts']){await go(pageName);assert.equal(await evaluate("document.documentElement.scrollWidth<=innerWidth"),true,'mobile dark overflow '+pageName);}
  // Manual deletion: isolated fixture uploads, never production firmware.
  await cdp('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await go('artifacts');
  for(let index=0;index<7;index++){
    await openPack();await setField('#pack-device',deviceId);await packReady();
    await setFile('#pack-firmware',`retention-${index}.bin`);
    await setField('#pack-version',`V2.0.${index}`);await packSubmit();
    await until(()=>evaluate("!!document.querySelector('#pack-confirm-publish')"),'manual deletion fixture uploaded');
    await click('#dialog-close');
  }
  const before=await adminData('artifacts'),beforeStorage=(await adminData('overview')).storage_bytes;
  const selected=before.find(a=>a.version==='V2.0.6');
  const plan=await adminData(`artifacts/${selected.id}/deletion`);
  assert.ok(plan.can_delete&&plan.recoverable_bytes===selected.size,'even newest version can be manually deleted');
  assert.equal(await evaluate("[...document.querySelectorAll('#main thead th')].at(-1).textContent"),'操作');
  assert.equal(await evaluate("[...document.querySelectorAll('#main thead th')].some(th=>th.textContent==='SHA-256')"),false,'artifact SHA is not repeated in a separate column');
  assert.ok(await evaluate("document.querySelectorAll('#main .artifact-fingerprint[title]').length>0"),'exact build digest remains available with a full tooltip');
  assert.equal(await evaluate("!!document.querySelector('[data-action=retention]')"),false,'no bulk latest-five action');
  assert.equal(await evaluate("document.querySelector('#main').textContent.includes('最近 5 份')"),false);
  const deleteSelector=`#main [data-action=delete-artifact][data-id="${selected.id}"]`;
  await until(async()=>{if(await evaluate(`!!document.querySelector(${js(deleteSelector)})`))return true;await click('#refresh');return false;},'latest uploaded row synchronized');
  assert.equal(await evaluate(`!!document.querySelector(${js(deleteSelector)}).parentElement.querySelector('[data-action=publish]')`),true,'publish and delete are adjacent');
  await screenshot('artifacts-manual-desktop.png');
  await click(deleteSelector);await until(()=>evaluate("!!document.querySelector('#artifact-delete-confirm')"),'selected firmware confirmation');
  await screenshot('artifact-delete-desktop.png');
  assert.equal((await adminData('artifacts')).length,before.length,'preview does not remove rows');
  assert.equal((await adminData('overview')).storage_bytes,beforeStorage,'preview never deletes bytes');
  await click('#dialog-close');
  const active=(await adminData('releases')).find(r=>r.active);
  await click(`#main [data-action=delete-artifact][data-id="${active.artifact_id}"]`);
  await until(()=>evaluate("!!document.querySelector('#artifact-delete-confirm')"),'active firmware protection');
  assert.equal(await evaluate("document.querySelector('#artifact-delete-confirm').disabled"),true,'active firmware cannot be confirmed');
  assert.equal(await evaluate("document.querySelector('#dialog-body').textContent.includes('活动发布')"),true);
  await click('#dialog-close');
  await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await click(deleteSelector);await until(()=>evaluate("!!document.querySelector('#artifact-delete-confirm')"),'mobile manual delete');
  assert.equal(await evaluate("document.querySelector('#dialog').scrollWidth<=document.querySelector('#dialog').clientWidth"),true,'delete mobile overflow');
  await screenshot('artifact-delete-mobile.png');
  await click('#artifact-delete-confirm');await until(()=>evaluate("document.querySelector('#dialog-title').textContent==='删除结果'"),'delete result');
  const remaining=await adminData('artifacts');
  assert.equal(remaining.length,before.length-1,'only selected row removed');
  assert.ok(!remaining.some(a=>a.id===selected.id));
  assert.ok(before.filter(a=>a.id!==selected.id).every(a=>remaining.some(b=>b.id===a.id)),'all other versions remain');
  assert.equal(beforeStorage-(await adminData('overview')).storage_bytes,plan.recoverable_bytes,'exact selected bytes reclaimed');
  assert.equal((await adminData('releases')).length,2,'release history preserved');
  await screenshot('artifact-delete-result-mobile.png');await click('#dialog-close');
  // Management edits retain stable IDs. Each deletion is explicit and isolated.
  async function manage(kind,id){
    await click(`#main [data-action="${kind}"][data-id="${id}"]`);
    await until(()=>evaluate("document.querySelector('#entry-form')?.dataset.kind.startsWith('manage-')"),'management form '+kind);
  }
  await cdp('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await go('products');
  await manage('edit-product','qa-product');await fill('name','桌面伴侣 · 可管理');await fill('description','产品说明可以编辑；引用关系受保护');await submit();
  assert.equal((await adminData('catalog')).products.find(x=>x.id==='qa-product').description,'产品说明可以编辑；引用关系受保护');
  const profileBefore=await adminData(`targets/${fixture.target.id}/profile`);
  await manage('edit-target',fixture.target.id);
  assert.equal(await evaluate("!!document.querySelector('#entry-form [name=mcu]')"),false,'compatibility fields not editable');
  await fill('name','STM32 监测终端');await submit();
  assert.equal((await adminData(`targets/${fixture.target.id}/profile`)).target_fingerprint,profileBefore.target_fingerprint,'renaming preserves signed identity');
  await manage('edit-key',fixture.target.key_id);await fill('name','个人发布公钥');await submit();
  await screenshot('management-products-desktop.png');
  // New empty product: cancel retains it; confirm removes only this product.
  await dialog('product');await fill('id','qa-empty-product');await fill('name','待删除产品');await submit();
  await manage('delete-product','qa-empty-product');await click('#dialog-close');
  assert.ok((await adminData('catalog')).products.some(p=>p.id==='qa-empty-product'));
  await manage('delete-product','qa-empty-product');await submit();
  assert.ok(!(await adminData('catalog')).products.some(p=>p.id==='qa-empty-product'));
  // An unused hardware model can be removed without affecting existing targets.
  await dialog('target');await fill('adapter','raw-cortexm');
  for(const name of ['mcu','hw_revision','layout_id','max_size','min_bootloader'])await fill(name,fixture.target[name]);
  await fill('id','qa-unused-target');await fill('name','未使用型号');await fill('config',JSON.stringify(fixture.target.config));await submit();
  await manage('delete-target','qa-unused-target');await submit();
  assert.ok(!(await adminData('catalog')).targets.some(t=>t.id==='qa-unused-target'));
  await go('devices');
  await manage('edit-device',deviceId);await fill('name','STM32 桌面监控');await submit();
  const disposable=await createDevice('无历史测试设备',fixture.target.id);
  await manage('delete-device',disposable);await submit();
  assert.ok(!(await adminData('devices')).some(d=>d.id===disposable));
  await dialog('gateway');await fill('name','临时空网关');await submit();await until(()=>evaluate("!!document.querySelector('#secret-token')"),'disposable gateway secret');await click('#dialog-close');
  const gateway=(await adminData('catalog')).gateways.find(g=>g.name==='临时空网关');
  await manage('edit-gateway',gateway.id);await fill('name','已编辑的空网关');await submit();
  await manage('delete-gateway',gateway.id);await submit();
  assert.ok(!(await adminData('catalog')).gateways.some(g=>g.id===gateway.id));
  await screenshot('management-devices-desktop.png');
  await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await go('products');await manage('edit-target',fixture.target.id);
  assert.equal(await evaluate("document.querySelector('#dialog').scrollWidth<=document.querySelector('#dialog').clientWidth"),true,'management edit mobile overflow');
  await screenshot('management-target-mobile.png');await click('#dialog-close');
  await manage('delete-target',fixture.target.id);
  assert.equal(await evaluate("document.querySelector('#dialog-body').textContent.includes('不会级联')"),true);
  assert.equal(await evaluate("document.querySelector('#dialog').scrollWidth<=document.querySelector('#dialog').clientWidth"),true,'management delete mobile overflow');
  await screenshot('management-delete-mobile.png');await click('#dialog-close');
  for(const themeName of ['light','dark']){
    await theme(themeName);
    for(const pageName of ['products','devices','artifacts']){
      await go(pageName);
      assert.equal(await evaluate("document.documentElement.scrollWidth<=innerWidth"),true,'management mobile '+themeName+'/'+pageName);
    }
  }
  // Releases have independent editable notes and protected, selected deletion.
  await cdp('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await go('releases');
  const betaRelease=(await adminData('releases')).find(r=>r.channel==='beta'&&r.active);
  const originalArtifact=(await adminData('artifacts')).find(a=>a.id===betaRelease.artifact_id);
  const releaseCount=(await adminData('releases')).length;
  async function releaseForm(kind,id){
    await click(`#main [data-action="${kind}"][data-id="${id}"]`);
    await until(()=>evaluate("document.querySelector('#entry-form')?.dataset.kind.startsWith('release-')"),'release form '+kind);
  }
  assert.equal(await evaluate("[...document.querySelectorAll('#main thead th')].at(-1).textContent"),'操作');
  await releaseForm('edit-release',betaRelease.id);
  const editedNotes='修订发布说明 <img src=x onerror="window.qaReleaseXss=1">';
  await fill('notes',editedNotes);await submit();
  assert.equal((await adminData('releases')).find(r=>r.id===betaRelease.id).notes,editedNotes);
  assert.equal((await adminData('artifacts')).find(a=>a.id===originalArtifact.id).notes,originalArtifact.notes,'release edit never changes artifact notes');
  assert.equal(await evaluate("!!window.qaReleaseXss||!!document.querySelector('#main img')"),false,'release notes escaped in row and title');
  await releaseForm('edit-release',betaRelease.id);
  assert.equal(await evaluate("document.querySelector('#entry-form [name=notes]').value"),editedNotes,'notes escaped inside textarea');
  await fill('notes','完善设备设置入口与发布管理');await submit();
  await releaseForm('delete-release',betaRelease.id);
  assert.equal(await evaluate("document.querySelector('#entry-form [type=submit]').disabled"),true,'active release deletion blocked');
  assert.equal(await evaluate("document.querySelector('#dialog-body').textContent.includes('先撤回')"),true);
  await click('#dialog-close');
  await confirmClick(`#main [data-action=withdraw][data-id="${betaRelease.id}"]`);
  await until(()=>evaluate(`!!document.querySelector('#main [data-action=republish][data-id="${betaRelease.id}"]')`),'withdrawn beta refresh');
  await screenshot('management-releases-desktop.png');
  await click(`#main [data-action=republish][data-id="${betaRelease.id}"]`);
  await until(()=>evaluate("document.querySelector('#entry-form')?.dataset.kind==='publish'"),'republish form');
  assert.equal(await evaluate("document.querySelector('#entry-form [name=channel]').value"),'beta','republish preserves original channel');
  assert.equal(await evaluate("document.querySelector('#entry-form [name=notes]').value"),'完善设备设置入口与发布管理','republish inherits release notes');
  await click('#dialog-close');assert.equal((await adminData('releases')).length,releaseCount,'republish cancellation is read-only');
  await click(`#main [data-action=republish][data-id="${betaRelease.id}"]`);
  await until(()=>evaluate("document.querySelector('#entry-form')?.dataset.kind==='publish'"),'republish again');
  await submit();
  const republished=(await adminData('releases')).find(r=>r.channel==='beta'&&r.active);
  assert.ok(republished.seq>betaRelease.seq&&republished.id!==betaRelease.id,'republish makes a new higher sequence');
  assert.equal(republished.notes,'完善设备设置入口与发布管理');
  const storageBeforeDelete=(await adminData('overview')).storage_bytes;
  await releaseForm('delete-release',betaRelease.id);
  assert.equal(await evaluate("document.querySelector('#entry-form [type=submit]').disabled"),false,'unused withdrawn publication deletable');
  await screenshot('management-release-delete-desktop.png');await click('#dialog-close');
  assert.equal((await adminData('releases')).length,releaseCount+1,'delete cancellation retains release');
  await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await releaseForm('delete-release',betaRelease.id);
  assert.equal(await evaluate("document.querySelector('#dialog').scrollWidth<=document.querySelector('#dialog').clientWidth"),true,'release delete mobile overflow');
  await screenshot('management-release-delete-mobile.png');await submit();
  const releasesAfterDelete=await adminData('releases');
  assert.equal(releasesAfterDelete.length,releaseCount);
  assert.ok(!releasesAfterDelete.some(r=>r.id===betaRelease.id)&&releasesAfterDelete.some(r=>r.id===republished.id));
  assert.equal((await adminData('overview')).storage_bytes,storageBeforeDelete,'release deletion never removes firmware bytes');
  assert.ok((await adminData('artifacts')).some(a=>a.id===originalArtifact.id),'underlying artifact remains available');
  const historical=releasesAfterDelete.find(r=>r.attempt_count>0);
  if(historical.active){
    await confirmClick(`#main [data-action=withdraw][data-id="${historical.id}"]`);
    await until(()=>evaluate(`!!document.querySelector('#main [data-action=republish][data-id="${historical.id}"]')`),'withdraw historical release');
  }
  await releaseForm('delete-release',historical.id);
  assert.equal(await evaluate("document.querySelector('#entry-form [type=submit]').disabled"),true,'withdrawn release history deletion blocked');
  assert.equal(await evaluate("document.querySelector('#dialog-body').textContent.includes('升级记录')"),true);
  await screenshot('management-release-protected-mobile.png');await click('#dialog-close');
  await releaseForm('edit-release',republished.id);
  assert.equal(await evaluate("document.querySelector('#dialog').scrollWidth<=document.querySelector('#dialog').clientWidth"),true,'release edit mobile overflow');
  await screenshot('management-release-edit-mobile.png');await click('#dialog-close');
  for(const preference of ['light','dark']){await theme(preference);assert.equal(await evaluate("document.documentElement.scrollWidth<=innerWidth"),true,'release mobile layout '+preference);}
  // Reproduce the user's exact scenario: two builds share a version string,
  // but only releases tied to the selected artifact become unavailable.
  await cdp('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await go('artifacts');
  for(let index=0;index<2;index++){
    await openPack();await setField('#pack-device',deviceId);await packReady();
    await setFile('#pack-firmware',`retention-${index}.bin`);await setField('#pack-version','V7.7.7');
    await setField('#pack-notes',index?'同版本 · 第二个构建':'同版本 · 第一个构建');await packSubmit();
    await until(()=>evaluate("!!document.querySelector('#pack-confirm-publish')"),'same-version build uploaded');await click('#dialog-close');
  }
  const sameVersion=(await adminData('artifacts')).filter(a=>a.version==='V7.7.7');
  assert.equal(sameVersion.length,2);assert.notEqual(sameVersion[0].sha256,sameVersion[1].sha256);
  const artifactA=sameVersion.find(a=>a.notes.includes('第一个')),artifactB=sameVersion.find(a=>a.notes.includes('第二个'));
  const sampleReleases=[];
  for(const artifact of [artifactA,artifactA,artifactB]){
    await go('artifacts');await click(`#main [data-action=publish][data-id="${artifact.id}"]`);
    await until(()=>evaluate("document.querySelector('#entry-form')?.dataset.kind==='publish'"),'publish exact same-version build');
    assert.equal(await evaluate("document.querySelector('#entry-form [name=artifact_id]').value"),artifact.id,'publish selects exact artifact');
    assert.equal(await evaluate(`document.querySelector('#entry-form [name=artifact_id]').selectedOptions[0].textContent.split(${js(artifact.id.slice(0,8))}).length-1`),1,'publish option does not repeat its artifact ID');
    await fill('channel','stable');await submit();
    sampleReleases.push((await adminData('releases')).find(r=>r.active&&r.channel==='stable'));
  }
  await go('artifacts');await click(`#main [data-action=delete-artifact][data-id="${artifactA.id}"]`);
  await until(()=>evaluate("!!document.querySelector('#artifact-delete-confirm')"),'delete shared-version artifact preview');
  await click('#artifact-delete-confirm');await until(()=>evaluate("document.querySelector('#dialog-title').textContent==='删除结果'"),'same-version deletion result');await click('#dialog-close');
  await go('releases');
  const afterArtifactDelete=await adminData('releases');
  assert.equal(afterArtifactDelete.filter(r=>r.artifact_id===artifactA.id&&r.firmware_state==='deleted').length,2,'all releases for the exact deleted artifact reflect deletion');
  assert.equal(afterArtifactDelete.find(r=>r.id===sampleReleases[2].id).firmware_state,'available','same version with different digest stays usable');
  assert.equal(await evaluate(`document.querySelectorAll('#main tr[data-artifact-id="${artifactA.id}"] [data-firmware-state=deleted]').length`),2);
  assert.equal(await evaluate(`document.querySelectorAll('#main tr[data-artifact-id="${artifactA.id}"] [data-action=republish]').length`),0);
  assert.equal(await evaluate("document.querySelectorAll('#main .artifact-fingerprint').length>=3"),true,'SHA and artifact IDs visible');
  await screenshot('release-build-states-dark.png');await theme('light');await screenshot('release-build-states-light.png');await theme('dark');
  await search('input[aria-label="搜索发布"]','V7.7.7');
  await until(()=>evaluate("document.querySelectorAll('#main tbody tr').length===3"),'Vue live version search');
  await click('#refresh');await until(()=>evaluate("document.querySelector('#sync-status').textContent.startsWith('已同步')"),'filter refresh');
  assert.equal(await evaluate("document.querySelector('input[aria-label=搜索发布]').value"),'V7.7.7','reactive refresh preserves search input');
  await search('input[aria-label="搜索发布"]','no-such-build');await until(()=>evaluate("document.querySelector('#main .empty')?.textContent.includes('没有匹配')"),'Vue empty search result');
  await click('#main .empty button');await until(()=>evaluate(`document.querySelectorAll('#main tbody tr').length===${afterArtifactDelete.length}`),'clear search restores releases');
  await setField('select[aria-label="发布通道"]','stable');await until(()=>evaluate("[...document.querySelectorAll('#main tbody tr')].every(row=>row.querySelector('td:nth-child(3) .badge').textContent==='stable')"),'Vue channel filter');
  await setField('select[aria-label="发布通道"]','');
  for(const width of [1280,1440,1920]){
    await cdp('Emulation.setDeviceMetricsOverride',{width,height:1080,deviceScaleFactor:1,mobile:false});
    await go('releases');await checkStatusSpacing();assert.equal(await evaluate("document.documentElement.scrollWidth<=innerWidth"),true,'desktop page overflow '+width);
    await checkWorkbenchStyle();
    await screenshot(`vue-releases-${width}.png`);
    await go('artifacts');await openPack();await packReady();await checkPackSpacing();
    await screenshot(`vue-pack-dark-${width}.png`);await theme('light');await checkPackSpacing();await screenshot(`vue-pack-light-${width}.png`);await theme('dark');await click('#dialog-close');
  }
  await go('releases');
  await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  assert.equal(await evaluate("document.documentElement.scrollWidth<=innerWidth"),true,'management cards avoid horizontal overflow');
  assert.equal(await evaluate("getComputedStyle(document.querySelector('.management-table tbody tr')).display"),desktopOnly?'table-row':'grid','management layout matches viewport mode');
  await screenshot('release-build-states-mobile.png');
  await releaseForm('delete-release',sampleReleases[0].id);
  assert.equal(await evaluate("document.querySelector('#entry-form [type=submit]').disabled"),false,'deleted firmware does not disable deleting unused publication');await submit();
  assert.ok(!(await adminData('releases')).some(r=>r.id===sampleReleases[0].id));
  // Hold an old poll snapshot and a completed deletion response, then change
  // dialogs. The post-mutation refresh must replay and never close the new UI.
  await evaluate(`(()=>{const original=globalThis.fetch;globalThis.qaRealFetch=original;let held=false;globalThis.qaAppReleaseGets=0;globalThis.fetch=(url,options)=>{const path=new URL(String(url),location.href).pathname;const method=options?.method||'GET';if(path==='/api/admin/releases'&&method==='GET'&&options?.credentials==='same-origin'){globalThis.qaAppReleaseGets++;if(!held){held=true;return original(url,options).then(response=>new Promise(resolve=>{globalThis.qaReleaseOldPoll=()=>resolve(response);}));}}if(path===${js('/api/admin/releases/'+sampleReleases[1].id+'/delete')}&&method==='POST')return original(url,options).then(response=>new Promise(resolve=>{globalThis.qaDeleteResponse=()=>resolve(response);}));return original(url,options);};})()`);
  await click('#refresh');await until(()=>evaluate("typeof qaReleaseOldPoll==='function'"),'old poll captured');
  await releaseForm('delete-release',sampleReleases[1].id);await evaluate("document.querySelector('#entry-form').requestSubmit()");
  await until(()=>evaluate("typeof qaDeleteResponse==='function'"),'delete completed server-side while response held');
  await click('#dialog-close');await click('#help');
  await evaluate("qaDeleteResponse()");await pause(100);await evaluate("qaReleaseOldPoll()");
  await until(()=>evaluate(`!document.querySelector('#main tr[data-release-id="${sampleReleases[1].id}"]')&&document.querySelector('#sync-status').textContent.startsWith('已同步')`),'fresh snapshot replays after delete');
  assert.ok(await evaluate("qaAppReleaseGets>=2"),'mutation waits for a fresh replay');
  assert.equal(await evaluate("document.querySelector('#dialog-title').textContent"),'开始使用 OTA Station','late old success does not close newer help');
  await evaluate("globalThis.fetch=qaRealFetch;delete globalThis.qaRealFetch;delete globalThis.qaDeleteResponse;delete globalThis.qaReleaseOldPoll");await click('#dialog-close');
  // The old worker/new static-file combination is explicit read-only, not a
  // generic Not Found after an enabled destructive button.
  await evaluate("globalThis.qaRealFetch=fetch;globalThis.qaLegacyWrites=0;globalThis.fetch=(url,options)=>{if(String(url).includes('/api/admin/capabilities'))return Promise.resolve(new Response(JSON.stringify({detail:'Not Found'}),{status:404,headers:{'Content-Type':'application/json'}}));if(options?.method&&options.method!=='GET')qaLegacyWrites++;return qaRealFetch(url,options);};");
  await click('#refresh');await until(()=>evaluate("!!document.querySelector('.runtime-warning')"),'old backend mismatch banner');
  assert.equal(await evaluate("document.querySelector('#main [data-action=delete-release]').disabled"),true,'unsupported management actions disabled');
  await click('#main [data-action=delete-release]');
  assert.equal(await evaluate("qaLegacyWrites"),0,'no mutation reaches the incompatible worker');
  await screenshot('backend-restart-warning-mobile.png');
  await evaluate("globalThis.fetch=qaRealFetch;delete globalThis.qaRealFetch");await click('#refresh');
  await until(()=>evaluate("!document.querySelector('.runtime-warning')&&document.querySelector('#sync-status').textContent.startsWith('已同步')"),'compatible worker clears warning');
  // A route-level 404 is explained differently from a business-level 404.
  await confirmClick(`#main [data-action=withdraw][data-id="${republished.id}"]`);
  await until(()=>evaluate(`!!document.querySelector('#main [data-action=republish][data-id="${republished.id}"]')`),'unused beta withdrawn for 404 scenario');
  await releaseForm('delete-release',republished.id);
  await evaluate(`globalThis.qaRealFetch=fetch;globalThis.fetch=(url,options)=>String(url)===${js('/api/admin/releases/'+republished.id+'/delete')}?Promise.resolve(new Response(JSON.stringify({detail:'Not Found'}),{status:404,headers:{'Content-Type':'application/json'}})):qaRealFetch(url,options);`);
  await evaluate("document.querySelector('#entry-form').requestSubmit()");
  await until(()=>evaluate("document.querySelector('#entry-form .form-error')?.textContent.includes('重启')"),'missing route explains backend restart');
  assert.ok((await adminData('releases')).some(r=>r.id===republished.id),'mocked missing interface never deletes release');
  assert.equal(await evaluate("document.querySelector('#entry-form [type=submit]').disabled"),true);
  await screenshot('delete-route-restart-message.png');
  await evaluate("globalThis.fetch=qaRealFetch;delete globalThis.qaRealFetch");await click('#dialog-close');await click('#refresh');
  await until(()=>evaluate("!document.querySelector('.runtime-warning')"),'post-test compatibility restored');
  assert.deepEqual(consoleErrors,[],'browser console / CSP');
  console.log('Browser QA passed: existing workflow + one-time encrypted/unencrypted import, wrong password/key rejection, non-exportable IndexedDB persistence across reload, multiple packages without PEM/password, same-key target reuse, different-key isolation, forget/cancel/reimport, denied storage handling, ESP V1.0.0 autofill, explicit publish, four-field secret audit, system/light/dark themes and persisted preference, desktop dialogs.');
  console.log('Manual management QA passed: per-row publish/delete, 操作 header, no latest-five policy, newest-version selection, cancel/read-only preview, active release protection, exact one-row deletion and space recovery, retained history, product/target/key/device/gateway edits, isolated unused-entity deletion, stable target fingerprint, mobile light/dark layouts.');
  console.log('Screenshots: '+outputs);
  console.log('Release QA passed: independent editable notes with XSS escaping, 操作 header, active/history protection, withdrawal, republish keeps beta channel and notes, higher sequence, cancel/delete only selected publication, firmware files retained, desktop light/dark layout.');
  console.log('Regression QA passed: same-version different SHA isolation, same-artifact release deletion state propagation, deletion after firmware removal, SHA identity, light/dark desktop tables, queued refresh replay, stale-dialog isolation, old-worker read-only handshake, precise Not Found restart guidance without real deletion.');
  console.log('Vue desktop QA passed: reactive six-page workspace, live search/channel filters, search persists through refresh, empty/reset interaction, 1280/1440/1920 widths, >=6px status gaps, separate device/metadata/file fields and notes/key panel, light/dark desktop dialogs, no CDN/CSP errors. Viewport mode is desktop-only.');
  console.log('Simplification QA passed: no framework banner, one advanced upload entry that still works, no repeated SHA column or selected IDs/device labels, setup guidance only before basic configuration, all safety and generic MCU workflows retained.');
  console.log('Atelier style QA passed: warm-paper/sage and graphite themes, six consistent self-hosted SVG nav icons, selected-nav text contrast >=4.5, unchanged label/field gaps, login palette and desktop widths.');
  console.log('Remote command integration QA passed: Vue confirmation/queue, real admin command API, authenticated simulated device claim, executing poll, changed boot ID completion, and visible success; isolated test database only.');
}catch(error){
  console.error('Fixture diagnosis:',{exitCode:server?.exitCode,stderr:serverErrors?.slice(-2000),networkErrors:networkErrors.slice(-10)});
  if(ws?.readyState===1){try{console.error('Browser diagnosis:',await evaluate("JSON.stringify({url:location.href,text:document.body.innerText.slice(0,1800),toast:document.querySelector('#toast')?.textContent,fetchFailures:globalThis.qaFetchFailures?.slice(-8)})"));console.error('Console:',consoleErrors);await screenshot('qa-failure.png');}catch{}}
  throw error;
}finally{
  if(ws?.readyState===1){try{await cdp('Browser.close');}catch{}ws.close();}
  for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error('QA cleanup'));}
  pending.clear();
  if(browser&&browser.exitCode===null)browser.kill();
  if(server&&server.exitCode===null)server.kill();
  // Only remove the exact disposable directory returned by our own mkdtemp.
  const resolved=path.resolve(temporary);
  if(path.dirname(resolved)===path.resolve(tmpdir())&&path.basename(resolved).startsWith('ota-browser-qa-')){
    try{await rm(resolved,{recursive:true,force:true,maxRetries:8,retryDelay:100});}catch{console.warn('Temporary browser profile is still locked; screenshots remain in artifacts/.');}
  }
}
