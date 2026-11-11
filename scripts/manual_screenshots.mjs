// Current UI documentation screenshots. Owns disposable localhost data only.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output='F:\\Code\\esp32\\00_BASIC\\tmp\\ota_user_manual\\screenshots';
await mkdir(output,{recursive:true});
const temporary=await mkdtemp(path.join(tmpdir(),'ota-manual-'));
const manifest={source:'Current production UI with isolated demonstration data',screenshots:[]};
const pause=ms=>new Promise(r=>setTimeout(r,ms));
let server,browser,ws,fixture,requestId=0,errors='';const pending=new Map();
async function until(fn,label,timeout=30000){const end=Date.now()+timeout;while(Date.now()<end){try{const r=await fn();if(r)return r;}catch{}await pause(100);}throw Error('Timed out: '+label);}
function cdp(method,params={}){const id=++requestId;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout '+method));},25000);pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}));});}
async function evaluate(expression){const result=await cdp('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true});if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);return result.result.value;}
const js=JSON.stringify;
async function click(selector){await until(()=>evaluate(`!!document.querySelector(${js(selector)})`),selector);await evaluate(`document.querySelector(${js(selector)}).click()`);}
async function field(selector,value){await evaluate(`(()=>{const e=document.querySelector(${js(selector)});e.value=${js(value)};e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));})()`);}
async function fill(name,value){await field('dialog [name="'+name+'"]',value);}
async function go(page){await evaluate(`location.hash=${js(page)}`);await until(()=>evaluate(`document.querySelector('nav [data-page="${page}"]')?.classList.contains('active')`),'page '+page);await pause(160);}
async function dialog(kind){await click('#main [data-action="'+kind+'"]');await until(()=>evaluate(`document.querySelector('#entry-form')?.dataset.kind===${js(kind)}`),'dialog '+kind);}
async function closeDialog(){await click('#dialog-close');await pause(80);}
async function setFile(selector,file){const doc=await cdp('DOM.getDocument'),node=await cdp('DOM.querySelector',{nodeId:doc.root.nodeId,selector});await cdp('DOM.setFileInputFiles',{nodeId:node.nodeId,files:[path.join(fixture.directory,file)]});await pause(150);}
async function refresh(){await click('#refresh');await until(()=>evaluate("document.querySelector('#sync-status').textContent.startsWith('已同步')"),'refresh');await pause(120);}
async function capture(id,title,items,cropSelector='#dialog',extra={}){
 await evaluate("document.querySelector('#toast')?.setAttribute('hidden','')");await pause(120);
 const data=await evaluate(`(()=>{const selectors=${js(cropSelector)};const rects=(Array.isArray(selectors)?selectors:[selectors]).filter(Boolean).map(s=>document.querySelector(s)?.getBoundingClientRect()).filter(Boolean);const r=rects.length?{x:Math.min(...rects.map(r=>r.x)),y:Math.min(...rects.map(r=>r.y)),right:Math.max(...rects.map(r=>r.right)),bottom:Math.max(...rects.map(r=>r.bottom))}:null;if(r){r.width=r.right-r.x;r.height=r.bottom-r.y;}const W=innerWidth,H=innerHeight;let clip=r?{x:Math.max(0,Math.floor(r.x)-12),y:Math.max(0,Math.floor(r.y)-12),width:Math.ceil(r.width)+24,height:Math.ceil(r.height)+24}:{x:0,y:0,width:W,height:H};clip.width=Math.min(clip.width,W-clip.x);clip.height=Math.min(clip.height,H-clip.y);return {clip,annotations:${js(items)}.map((item,index)=>{const e=document.querySelector(item.selector);if(!e)throw Error('Missing '+item.selector);const b=e.getBoundingClientRect();return {...item,number:index+1,rect:{x:b.x-clip.x,y:b.y-clip.y,width:b.width,height:b.height}};})};})()`);
 const shot=await cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:false,clip:{...data.clip,scale:1}});
 await writeFile(path.join(output,id+'.png'),Buffer.from(shot.data,'base64'));
 manifest.screenshots.push({id,file:id+'.png',title,width:data.clip.width,height:data.clip.height,crop:data.clip,annotations:data.annotations,...extra});
 await writeFile(path.join(output,'manifest.json'),JSON.stringify(manifest,null,2),'utf8');
 console.log('Captured '+id+' '+data.clip.width+'x'+data.clip.height);
}
async function devicePost(url,body){const r=await fetch(fixture.base+url,{method:'POST',headers:{Authorization:'Bearer '+fixture.device.token,'Content-Type':'application/json'},body:JSON.stringify(body)});if(!r.ok)throw Error('Device fixture HTTP '+r.status+' '+await r.text());return r.json();}
try{
 server=spawn(path.join(root,'.venv/Scripts/python.exe'),['-B','tests/manual_fixture.py',temporary],{cwd:root,windowsHide:true,env:{...process.env,PYTHONPATH:root,PYTHONIOENCODING:'utf8'},stdio:['ignore','pipe','pipe']});
 let lines='';server.stdout.on('data',b=>lines+=b.toString());server.stderr.on('data',b=>errors+=b.toString());
 fixture=await until(()=>{const line=lines.split('\n').find(l=>l.startsWith('MANUAL_READY '));if(line)return JSON.parse(line.slice(13));if(server.exitCode!==null)throw Error(errors);},'isolated fixture',40000);
 const edge='C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',profile=path.join(temporary,'edge');
 browser=spawn(edge,['--headless=new','--remote-debugging-port=0','--disable-background-timer-throttling','--disable-renderer-backgrounding','--user-data-dir='+profile,'--no-first-run','--no-default-browser-check','about:blank'],{windowsHide:true,stdio:'ignore'});
 const port=await until(async()=>Number((await readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]),'Edge');
 const pages=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();ws=new WebSocket(pages.find(x=>x.type==='page').webSocketDebuggerUrl);
 await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
 ws.addEventListener('message',event=>{const m=JSON.parse(event.data);if(m.id){const p=pending.get(m.id);if(p){pending.delete(m.id);clearTimeout(p.timer);m.error?p.reject(Error(m.error.message)):p.resolve(m.result);}}});
 await cdp('Page.enable');await cdp('Runtime.enable');await cdp('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});
 await cdp('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:'light'}]});await cdp('Page.navigate',{url:fixture.base+'/login'});
 await until(()=>evaluate("!!document.querySelector('[name=username]')"),'login');await field('[name=username]','admin');
 await capture('01_login','登录管理后台',[{selector:'[name=username]',label:'输入管理员账号 admin'},{selector:'[name=password]',label:'输入你设置的登录密码'},{selector:'button[type=submit]',label:'进入工作台'}],'.login-card');
 await field('[name=password]','Test-password-2026');await evaluate("document.querySelector('form').requestSubmit()");await until(()=>evaluate("document.querySelector('#sync-status')?.textContent.startsWith('已同步')"),'signed in');
 await capture('02_overview','认识工作台',[{selector:'nav',label:'从这里切换功能页'},{selector:'#main h1',label:'查看当前功能与快捷操作'},{selector:'#refresh',label:'手动刷新数据'}],null);
 await go('products');await dialog('product');await fill('name','温湿度采集器');await fill('id','climate-sensor');await fill('description','同一类设备归为一个产品');
 await capture('03_product','新建产品',[{selector:'[name=name]',label:'填写便于识别的产品名称'},{selector:'[name=id]',label:'填写唯一英文标识'},{selector:'#entry-form [type=submit]',label:'保存产品'}]);await closeDialog();
 await evaluate("(()=>{const p=[...document.querySelectorAll('#main .section')].find(p=>p.querySelector('h2')?.textContent==='硬件型号');if(p)p.dataset.manualTarget='true';})()");
 await capture('04_target','核对硬件型号并导出配置',[{selector:'[data-manual-target] tbody td:first-child',label:'先核对硬件型号与标识'},{selector:'#main [data-action=profile]',label:'导出公开配置给设备开发者'}],'[data-manual-target]');
 await go('devices');await dialog('device');await fill('name','卧室里的设备');
 await capture('05_add_device','添加一台设备',[{selector:'[name=name]',label:'设备名称按位置填写'},{selector:'[name=target_id]',label:'选择匹配的硬件型号'},{selector:'[name=channel]',label:'一般选择 stable'},{selector:'#entry-form [type=submit]',label:'保存设备'}]);
 await evaluate("document.querySelector('#entry-form').requestSubmit()");await until(()=>evaluate("!!document.querySelector('#secret-token')"),'credential');
 await evaluate("(()=>{const p=document.querySelectorAll('#dialog-body pre');p[0].textContent='示例设备标识（截图已遮挡）';if(p[1])p[1].textContent='示例代理标识（截图已遮挡）';document.querySelector('#secret-token').textContent='示例访问密钥（截图已隐藏）';})()");
 await capture('06_credentials','保存设备凭据',[{selector:'#dialog-body pre:first-of-type',label:'设备设置页填这个设备标识'},{selector:'#secret-token',label:'访问密钥仅首次显示'},{selector:'[data-action=copy-token]',label:'复制并妥善保存'}]);await closeDialog();
 await go('artifacts');await click('#main [data-action=pack]');await until(()=>evaluate("!!document.querySelector('#pack-form')"),'pack');await field('#pack-device',fixture.device.id);await setFile('#pack-firmware','app.bin');await field('#pack-notes','新增远程控制，改善升级结果显示');
 await setFile('#pack-key','private.pem');await until(()=>evaluate("!document.querySelector('#pack-import-password-row').hidden"),'password row');
 await capture('08_key_import','首次导入本机签名私钥',[{selector:'#pack-key',label:'选择对应硬件的 private.pem'},{selector:'#pack-import-password',label:'加密文件仅首次输入保护密码'},{selector:'#pack-import-key',label:'导入后由当前浏览器记住'}],['.pack-local-key','#pack-key-setup']);
 await field('#pack-import-password','Browser-local-test-口令-2026');await click('#pack-import-key');await until(()=>evaluate("document.querySelector('#pack-key-status').textContent.includes('已就绪')"),'key remembered');
 await evaluate("document.querySelector('#pack-key-setup').open=false");
 await capture('07_pack','日常打包上传固件',[{selector:'#pack-device',label:'选择要更新的设备'},{selector:'#pack-firmware',label:'选择编译生成的应用 bin'},{selector:'#pack-notes',label:'写清本次更新内容'},{selector:'#pack-form [type=submit]',label:'打包并上传'}],['.pack-device-field','.pack-file-label','#pack-notes','.pack-local-key','#pack-form .form-actions']);
 await evaluate("document.querySelector('#pack-form').requestSubmit()");await until(()=>evaluate("!!document.querySelector('#pack-confirm-publish')"),'package complete',40000);
 await capture('09_pack_result','检查上传结果并确认发布',[{selector:'#dialog-body .pack-success',label:'上传成功还不等于已发布'},{selector:'#pack-publish-channel',label:'确认发布到 stable 通道'},{selector:'#pack-confirm-publish',label:'确认后设备才能检查到此版本'}]);
 await click('#pack-confirm-publish');await until(()=>evaluate("!document.querySelector('#dialog').open"),'published');await refresh();
 const artifacts=await evaluate("fetch('/api/admin/artifacts').then(r=>r.json())");const fresh=artifacts.find(a=>a.version==='V1.0.9');
 await capture('10_publish','固件库与发布入口',[{selector:`[data-artifact-id="${fresh.id}"] [data-action=publish]`,label:'可从固件库再次发布'},{selector:`[data-artifact-id="${fresh.id}"] [data-action=delete-artifact]`,label:'手动管理不再需要的文件'},{selector:'#main [data-action=pack]',label:'下次更新从这里开始'}],'#main');
 await go('devices');await refresh();const row='[data-device-id="'+fixture.device.id+'"]';
 await click(row+' [data-control-kind="ota.install"]');await until(()=>evaluate("document.querySelector('.device-control-dialog .form-actions .primary')?.disabled===false"),'upgrade dialog');
 await capture('11_upgrade','从网页下发升级',[{selector:'.command-version',label:'核对当前版本与待升级版本'},{selector:'.command-expiry select',label:'默认等待 15 分钟'},{selector:'.device-control-dialog .form-actions .primary',label:'确认升级后等待设备领取'}],'.device-control-dialog');
 await click('.device-control-dialog .form-actions .primary');await until(()=>evaluate("!!document.querySelector('.command-receipt')"),'queued');
 const commands=await evaluate(`fetch('/api/admin/devices/${fixture.device.id}/commands').then(r=>r.json())`),command=commands.commands[0];
 const boot='a'.repeat(32),newBoot='b'.repeat(32);await devicePost('/api/v1/devices/commands/claim',{device_id:fixture.device.id,boot_id:boot,remote_commands_version:1});await devicePost('/api/v1/devices/commands/'+command.id+'/events',{device_id:fixture.device.id,boot_id:boot,status:'executing'});
 const listing=commands.available_release;const comp={device_id:fixture.device.id,protocol_version:1,target_id:fixture.target.id,layout_id:fixture.target.layout_id,bootloader_version:'0.1.0',capabilities:['staging','app_confirm']};
 const attempt=await devicePost('/api/v1/ota/attempts',{...comp,release_id:listing.id,request_id:command.id,command_id:command.id});let seq=0;
 for(const state of ['downloading','downloaded','validating','installing','pending_boot'])await devicePost('/api/v1/ota/attempts/'+attempt.id+'/events',{seq:++seq,state,progress:state==='downloading'?35:100});
 await devicePost('/api/v1/ota/attempts/'+attempt.id+'/events',{seq:++seq,state:'confirmed',progress:100,version:'V1.0.9',sha256:listing.sha256});await devicePost('/api/v1/devices/heartbeat',{device_id:fixture.device.id,version:'V1.0.9',sha256:listing.sha256,remote_commands_version:1});
 await until(()=>evaluate("document.querySelector('.command-receipt')?.textContent.includes('执行成功')"),'confirmed success');
 await capture('12_control_success','确认设备已经执行成功',[{selector:'.command-receipt',label:'以执行成功作为完成依据'},{selector:'.command-history-list li:first-child',label:'以后可在控制记录里查询'},{selector:'.command-history-list li:first-child button.quiet',label:'打开这次升级的详细记录'}],'.device-control-dialog');await click('[aria-label="关闭设备控制"]');
 await go('attempts');await refresh();await click('#main [data-attempt-timeline]');await until(()=>evaluate("document.querySelector('dialog.upgrade-timeline')?.textContent.includes('升级成功')"),'events');
 await capture('13_events','查看升级过程',[{selector:'dialog.upgrade-timeline li:first-child',label:'本次操作的起点'},{selector:'dialog.upgrade-timeline li:last-child',label:'启动确认后才是升级成功'}],'dialog.upgrade-timeline');await click('[aria-label="关闭时间线"]');
 await go('devices');await refresh();await click(row+' [data-control-kind="device.restart"]');await until(()=>evaluate("document.querySelector('.device-control-dialog .form-actions .primary')?.disabled===false"),'restart');
 await capture('14_restart','从网页重启设备',[{selector:'.command-device',label:'先确认设备名称'},{selector:'.command-expiry select',label:'离线时可排队等设备上线'},{selector:'.device-control-dialog .form-actions .primary',label:'确认重启，联网补报后成功'}],'.device-control-dialog');await click('[aria-label="关闭设备控制"]');
 await go('artifacts');await click(`[data-artifact-id="${fixture.old_artifact}"] [data-action=delete-artifact]`);await until(()=>evaluate("document.querySelector('#dialog').open"),'delete preview');
 await capture('15_delete','删除不用的固件前先预览',[{selector:'#dialog-body',label:'先检查影响范围与受保护原因'},{selector:'#dialog-body .form-actions',label:'核对后确认，或取消保留'}]);await closeDialog();
 // Actual ESP32 page, with synthetic same-origin API responses, no hardware.
 await cdp('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'}]});
 const settingsHtml=await readFile('F:\\Code\\esp32\\00_BASIC\\main\\desk_settings.html');
 const mock={pc_ip:'192.168.1.100',port:8765,key_configured:true,brightness:70,led_brightness:20,city:'ningbo',night_start:1380,night_end:480,night_brightness:8,idle_seconds:0,cpu_alert:90,ram_alert:95,disk_alert:95,quota_alert:90,night_enabled:false,alerts_enabled:false,page_order:[0,1,2,3,4,5]};
 ws.addEventListener('message',event=>{const m=JSON.parse(event.data);if(m.method==='Fetch.requestPaused'){const u=new URL(m.params.request.url);let b,type='application/json';if(u.pathname==='/'){b=settingsHtml;type='text/html; charset=utf-8';}else if(u.pathname==='/api/config')b=Buffer.from(JSON.stringify(mock));else b=Buffer.from(JSON.stringify({ready:true,busy:false,enabled:true,pending_report:false,server_url:'https://ota.example.com',device_id:'example-device-id',token_configured:true,allow_lan_http:false,last_http:200,status:'Connected; installed artifact SHA-256 reported',target_id:'desktop-s3-n8r8-st7735s-v1'}));cdp('Fetch.fulfillRequest',{requestId:m.params.requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:type}],body:b.toString('base64')}).catch(()=>{});}});
 await cdp('Page.navigate',{url:'http://192.168.1.200/'});await until(()=>evaluate("document.querySelector('#ota_settings')?.hidden===false"),'device settings');await evaluate("document.querySelector('#ota_settings').scrollIntoView({block:'center'})");
 await capture('16_device_settings','填写设备的个人 OTA 服务器',[{selector:'#ota_url',label:'填服务器根地址，不带 API 路径'},{selector:'#ota_device',label:'填设备标识，不是代理标识'},{selector:'#ota_token',label:'首次填写设备访问密钥'},{selector:'#ota_save',label:'保存 OTA 配置'}],'#ota_settings');
 console.log('MANUAL_SCREENSHOTS_READY '+manifest.screenshots.length);
}catch(error){console.error(error.message);if(ws?.readyState===1){try{console.error((await evaluate('document.body.innerText')).slice(-1400));}catch{}}throw error;}
finally{
 if(ws?.readyState===1){try{await cdp('Browser.close');}catch{}ws.close();}if(browser&&browser.exitCode===null)browser.kill();if(server&&server.exitCode===null)server.kill();for(const p of pending.values())clearTimeout(p.timer);
 const t=path.resolve(temporary);if(path.dirname(t)===path.resolve(tmpdir())&&path.basename(t).startsWith('ota-manual-')){try{await rm(t,{recursive:true,force:true,maxRetries:8,retryDelay:150});}catch{}}
}
