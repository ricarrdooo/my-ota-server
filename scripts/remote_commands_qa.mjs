// Browser-level contract tests. The HTTP server and all device/command data are
// isolated in this process; this never connects to the running OTA service.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const temporary=await mkdtemp(path.join(tmpdir(),'ota-commands-qa-'));
const outputs=path.join(root,'artifacts');await mkdir(outputs,{recursive:true});
const now=()=>Math.floor(Date.now()/1000);
const baseDevice={target_id:'qa-target',target_name:'ESP32-S3 桌面伴侣',channel:'stable',current_version:'V1.0.6',agent_kind:'device',revoked:0,remote_commands_version:1};
const devices=[{...baseDevice,id:'online-device',name:'书桌上的设备',agent_id:'online-agent',last_seen:now()},{...baseDevice,id:'offline-device',name:'暂时离线的设备',agent_id:'offline-agent',last_seen:now()-3600},{...baseDevice,id:'legacy-device',name:'尚未升级的设备',agent_id:'legacy-agent',last_seen:now(),remote_commands_version:0}];
let featureEnabled=true,holdOverview=false,release={id:'release-one',version:'V1.0.7',sha256:'a'.repeat(64)};
const heldOverviews=new Set();
const commands=[],posted=[],seen=new Map();
const features=['release_management','artifact_deletion','metadata_management','firmware_state'];
const json=(res,value,status=200)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(value));};
const server=createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/'){
   const template=(await readFile(path.join(root,'ota_server/templates/index.html'),'utf8')).replace('{{ csrf }}','qa-csrf');res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(template);return;
  }
  if(url.pathname.startsWith('/static/')){
   const file=path.resolve(root,'ota_server',url.pathname.slice(1));
   if(!file.startsWith(path.join(root,'ota_server','static')+path.sep)){res.writeHead(403);res.end();return;}
   const type=file.endsWith('.css')?'text/css':'text/javascript';res.writeHead(200,{'Content-Type':type});res.end(await readFile(file));return;
  }
  if(url.pathname==='/api/admin/capabilities')return json(res,{contract:2,features:[...features,...(featureEnabled?['remote_commands']:[])]});
  if(url.pathname==='/api/admin/overview'){
   if(holdOverview){heldOverviews.add(res);res.once('close',()=>heldOverviews.delete(res));return;}
   return json(res,{now:now(),devices:devices.length,online_devices:2,active_releases:1,pending_attempts:0,targets:1,products:1});
  }
  if(url.pathname==='/api/admin/catalog')return json(res,{targets:[{id:'qa-target',name:baseDevice.target_name}],products:[],keys:[],gateways:[]});
  if(url.pathname==='/api/admin/devices')return json(res,devices.map(device=>({...device,latest_command:commands.filter(command=>command.device_id===device.id).at(-1)||null})));
  if(['/api/admin/artifacts','/api/admin/releases','/api/admin/attempts'].includes(url.pathname))return json(res,[]);
  const match=url.pathname.match(/^\/api\/admin\/devices\/([^/]+)\/commands$/);
  const timelineId=url.pathname.match(/^\/api\/admin\/commands\/([a-f0-9]+)\/timeline$/)?.[1];
  if(timelineId){
   const cmd=commands.find(c=>c.id===timelineId);if(!cmd)return json(res,{detail:'missing'},404);
   const steps=[{stage:'queued',received:cmd.created_at},{stage:'claimed',received:cmd.created_at+1},
    {stage:'downloading',progress:42,received:cmd.created_at+3}];
   if(cmd.status==='failed')steps.push({stage:'failed',error:cmd.error,received:cmd.created_at+4});
   return json(res,{terminal:cmd.status==='failed',steps});
  }
  if(match&&req.method==='GET')return json(res,{commands:commands.filter(command=>command.device_id===match[1]).toReversed(),available_release:release});
  if(match&&req.method==='POST'){
   assert.equal(req.headers['x-csrf-token'],'qa-csrf');
   let text='';for await(const chunk of req)text+=chunk;const body=JSON.parse(text);posted.push(body);
   assert.match(body.request_id,/^[a-f0-9]{32}$/);assert.equal(body.ttl_seconds,900);
   const previous=seen.get(body.request_id);if(previous){assert.deepEqual(previous.body,body);return json(res,previous.command);}
   if(body.kind==='ota.install'&&(body.expected_release_id!==release.id||body.expected_sha256!==release.sha256))return json(res,{error:'活动发布已变化，请关闭后重新确认升级版本'},409);
   const command={id:(commands.length+1).toString(16).padStart(32,'0'),device_id:match[1],kind:body.kind,status:'queued',created_at:now(),updated_at:now(),expires_at:now()+body.ttl_seconds,error:'',attempt_id:null};
   commands.push(command);seen.set(body.request_id,{body,command});
   return json(res,command);
  }
  return json(res,{detail:'Not Found'},404);
 }catch(error){console.error(error);json(res,{error:error.message},500);}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base='http://127.0.0.1:'+server.address().port;
let browser,ws,nextId=0;const pending=new Map(),exceptions=[];
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn,label,timeout=15000){const end=Date.now()+timeout;while(Date.now()<end){if(await fn())return;await pause(80);}throw Error('Timeout: '+label);}
function cdp(method,params={}){const id=++nextId;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout: '+method));},20000);pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}));});}
async function evaluate(expression){const result=await cdp('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true});if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);return result.result.value;}
const js=JSON.stringify;
const click=selector=>evaluate(`document.querySelector(${js(selector)}).click()`);
const text=()=>evaluate("document.querySelector('.device-control-dialog')?.innerText||''");
const row=id=>`[data-device-id="${id}"]`;
const open=async(id,kind)=>{await click(`${row(id)} [data-control-kind="${kind}"]`);await until(()=>evaluate("!!document.querySelector('.device-control-dialog[open] .command-history-list')||!!document.querySelector('.device-control-dialog[open] .command-history .form-hint')"),'control dialog');await until(()=>evaluate("!document.querySelector('.device-control-dialog .command-history-heading button').disabled"),'command loaded');};
const submit=()=>click('.device-control-dialog .form-actions .primary');
const close=()=>click('[aria-label="关闭设备控制"]');
const refresh=async()=>{await click('#refresh');await pause(300);};
async function screenshot(name){const result=await cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});await writeFile(path.join(outputs,name),Buffer.from(result.data,'base64'));}
try{
 const edge=process.env.OTA_QA_BROWSER||'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
 const profile=path.join(temporary,'edge');browser=spawn(edge,['--headless=new','--remote-debugging-port=0',`--user-data-dir=${profile}`,'--no-first-run','--no-default-browser-check','about:blank'],{windowsHide:true,stdio:'ignore'});
 let port;await until(async()=>{try{port=Number((await readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]);return !!port;}catch{return false;}},'Edge starts');
 const pages=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json();ws=new WebSocket(pages.find(page=>page.type==='page').webSocketDebuggerUrl);
 await new Promise(resolve=>ws.addEventListener('open',resolve,{once:true}));
 ws.addEventListener('message',event=>{const message=JSON.parse(event.data);if(message.id){const request=pending.get(message.id);if(request){clearTimeout(request.timer);pending.delete(message.id);message.error?request.reject(Error(message.error.message)):request.resolve(message.result);}}else if(message.method==='Runtime.exceptionThrown')exceptions.push(message.params.exceptionDetails.exception?.description||message.params.exceptionDetails.text);});
 await cdp('Page.enable');await cdp('Runtime.enable');await cdp('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
 await cdp('Page.navigate',{url:base+'/#devices'});await until(()=>evaluate("!!document.querySelector('[data-device-id=legacy-device]')"),'devices render');
 assert.equal(await evaluate(`document.querySelector('${row('legacy-device')} [data-control-kind="ota.install"]').disabled`),true);
 assert.match(await evaluate(`document.querySelector('${row('legacy-device')}').innerText`),/需更新固件/);
 await open('online-device','ota.install');assert.match(await text(),/V1\.0\.6/);assert.match(await text(),/V1\.0\.7/);await close();assert.equal(posted.length,0,'cancel does not submit');
 await open('offline-device','device.restart');assert.match(await text(),/设备当前离线，指令将排队等待/);
 await screenshot('remote-restart-offline.png');holdOverview=true;await submit();await until(async()=>/指令已提交/.test(await text()),'queued receipt');assert.equal(commands.length,1);assert.equal(commands[0].status,'queued');assert.match(await text(),/等待设备接收/);assert.doesNotMatch(await text(),/执行成功/);
 await until(()=>heldOverviews.size>0,'unrelated overview refresh deliberately hangs');
 assert.equal(await evaluate("document.querySelector('.command-history-heading button').disabled"),false,'accepted POST must release submission controls while overview hangs');
 commands[0].status='executing';await until(async()=>/正在执行/.test(await text()),'execution status polls despite hung overview',8000);
 commands[0].status='succeeded';await until(async()=>/执行成功/.test(await text()),'completion status polls despite hung overview',8000);
 await until(()=>evaluate("document.querySelector('#toast')?.textContent.includes('读取后台数据超时')"),'ordinary GET has bounded timeout',10000);
 assert.match(await evaluate("document.querySelector('.command-receipt').innerText"),/执行成功/,'unrelated refresh timeout cannot turn accepted command into submit failure');
 assert.equal(await evaluate("!!document.querySelector('.device-control-dialog .form-error')"),false);
 assert.equal(posted.length,1,'overview timeout never resubmits a command');
 holdOverview=false;await close();await refresh();
 await evaluate("(()=>{const original=globalThis.fetch;let lose=true;globalThis.fetch=async(input,options)=>{const result=await original(input,options);if(lose&&options?.method==='POST'&&String(input).endsWith('/commands')){lose=false;throw TypeError('Failed to fetch');}return result;};})()");
 await open('online-device','device.restart');await submit();await until(()=>evaluate("!!document.querySelector('.device-control-dialog .form-error')"),'lost-response error');
 const original=posted.at(-1);assert.equal(commands.length,2);await submit();await until(async()=>/指令已提交/.test(await text()),'idempotent retry receipt');assert.equal(commands.length,2);assert.deepEqual(posted.at(-1),original,'retry preserves identity and every parameter');
 commands[1].status='succeeded';await close();await refresh();
 await open('online-device','ota.install');release={id:'release-two',version:'V1.0.8',sha256:'b'.repeat(64)};await submit();await until(()=>evaluate("document.querySelector('.device-control-dialog .form-error')?.textContent.includes('发布版本已变化')"),'release race is rejected');assert.equal(commands.length,2);const racedRequest=posted.at(-1).request_id;
 await click('.device-control-dialog .form-error button');await until(async()=>/V1\.0\.8/.test(await text()),'new version must be reviewed');await screenshot('remote-upgrade-confirm.png');
 const spacing=await evaluate("(()=>{const d=document.querySelector('.device-control-dialog'),n=d.querySelector('.command-queue-note').getBoundingClientRect(),e=d.querySelector('.command-expiry').getBoundingClientRect();return {overflow:d.scrollWidth>d.clientWidth,gap:e.top-n.bottom};})()");assert.equal(spacing.overflow,false);assert.ok(spacing.gap>=15);
 await submit();await until(async()=>/指令已提交/.test(await text()),'upgrade queued');assert.equal(posted.at(-1).expected_release_id,release.id);assert.equal(posted.at(-1).expected_sha256,release.sha256);assert.notEqual(posted.at(-1).request_id,racedRequest,'explicit reconfirmation starts a new request identity');
 await until(()=>evaluate("document.querySelector('section.upgrade-timeline')?.innerText.includes('42%')"),'inline timeline shows last reported progress');
 await click('.command-history-list li:first-child button.quiet');
 await until(()=>evaluate("document.querySelector('dialog.upgrade-timeline[open]')?.innerText.includes('42%')"),'open exact command timeline from history');
 await click('dialog.upgrade-timeline [aria-label="关闭时间线"]');
 const upgrade=commands.at(-1);upgrade.status='failed';upgrade.error='<img src=x onerror=alert(1)> 下载校验失败';
 await click('.device-control-dialog .command-history-heading button');await until(async()=>/下载校验失败/.test(await text()),'failure reason');assert.equal(await evaluate("document.querySelectorAll('.device-control-dialog img').length"),0,'device errors are escaped');assert.doesNotMatch(await evaluate("document.querySelector('.command-receipt').innerText"),/执行成功/);
 await cdp('Emulation.setDeviceMetricsOverride',{width:1280,height:920,deviceScaleFactor:1,mobile:false});await evaluate("document.documentElement.dataset.theme='dark'");await screenshot('remote-commands-dark.png');await close();await refresh();
 featureEnabled=false;await refresh();await until(()=>evaluate("!!document.querySelector('.command-backend-notice')"),'old backend notice');assert.equal(await evaluate(`document.querySelector('${row('online-device')} [data-control-kind="device.restart"]').disabled`),true);
 assert.deepEqual(exceptions,[],'Vue has no runtime exceptions');
 console.log('PASS: remote command browser QA — legacy firmware/old backend gating, version confirmation/cancel, offline queue, command execution/completion polling while overview hangs, bounded GET timeout without false submission failure or duplicate POST, lost-response idempotent retry, publication race, failure escaping, light/dark desktop spacing.');
}catch(error){if(ws?.readyState===1){console.error(await evaluate("document.body.innerText.slice(-2800)"));await screenshot('remote-commands-failure.png');}throw error;}
finally{
 if(ws?.readyState===1){try{await cdp('Browser.close');}catch{}ws.close();}
 if(browser&&browser.exitCode===null)browser.kill();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
 for(const request of pending.values())clearTimeout(request.timer);
 const target=path.resolve(temporary);if(path.dirname(target)===path.resolve(tmpdir())&&path.basename(target).startsWith('ota-commands-qa-')){try{await rm(target,{recursive:true,force:true,maxRetries:8,retryDelay:100});}catch{console.warn('Disposable Edge profile remains locked.');}}
}
