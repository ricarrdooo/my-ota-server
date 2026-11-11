// Fix two documentation images only. Serves local mock data; never touches OTA service data.
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {mkdtemp,readFile,writeFile,copyFile,access,rm} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';

const output='F:\\Code\\esp32\\00_BASIC\\tmp\\ota_user_manual\\screenshots';
const html=await readFile('F:\\Code\\esp32\\00_BASIC\\main\\desk_settings.html');
const fullFile=path.join(output,'10_publish_full.png');
try{await access(fullFile);}catch{await copyFile(path.join(output,'10_publish.png'),fullFile);}
const image=await readFile(fullFile);
const config={pc_ip:'192.168.1.100',port:8765,key_configured:true,brightness:70,led_brightness:20,city:'ningbo',night_start:1380,night_end:480,night_brightness:8,idle_seconds:0,cpu_alert:90,ram_alert:95,disk_alert:95,quota_alert:90,night_enabled:false,alerts_enabled:false,page_order:[0,1,2,3,4,5]};
const ota={ready:true,busy:false,enabled:true,pending_report:false,server_url:'https://ota.example.com',device_id:'example-device-id',token_configured:true,allow_lan_http:false,last_http:200,status:'Connected; installed artifact SHA-256 reported',target_id:'desktop-s3-n8r8-st7735s-v1'};
const server=createServer((req,res)=>{
 if(req.url==='/crop'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><meta charset="utf-8"><style>html,body{margin:0;padding:0;overflow:hidden}img{display:block;width:1232px;height:996px}</style><img src="/source.png">');}
 else if(req.url==='/source.png'){res.setHeader('Content-Type','image/png');res.end(image);}
 else if(req.url==='/api/config'||req.url==='/api/ota/config'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(req.url==='/api/config'?config:ota));}
 else {res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html);}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base='http://127.0.0.1:'+server.address().port;
const temporary=await mkdtemp(path.join(tmpdir(),'ota-manual-fix-'));let browser,ws,id=0;const pending=new Map();
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,label){const end=Date.now()+20000;while(Date.now()<end){try{if(await fn())return;}catch{}await pause(100);}throw Error(label+' timed out');}
function cdp(method,params={}){const n=++id;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(n);reject(Error(method+' timeout'));},25000);pending.set(n,{resolve,reject,timer});ws.send(JSON.stringify({id:n,method,params}));});}
async function evaluate(expression){const r=await cdp('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.text);return r.result.value;}
try{
 const profile=path.join(temporary,'edge');
 browser=spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',['--headless=new','--remote-debugging-port=0','--user-data-dir='+profile,'--no-first-run','--no-default-browser-check','about:blank'],{windowsHide:true,stdio:'ignore'});
 let port;await until(async()=>{port=Number((await readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]);return port;},'Edge');
 const pages=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();ws=new WebSocket(pages.find(x=>x.type==='page').webSocketDebuggerUrl);
 await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
 ws.addEventListener('message',event=>{const m=JSON.parse(event.data);if(m.id){const p=pending.get(m.id);if(p){pending.delete(m.id);clearTimeout(p.timer);m.error?p.reject(Error(m.error.message)):p.resolve(m.result);}}});
 await cdp('Page.enable');await cdp('Runtime.enable');await cdp('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});
 await cdp('Page.navigate',{url:base+'/'});await until(()=>evaluate("document.querySelector('#ota_settings')?.hidden===false"),'settings loaded');
 await evaluate('document.fonts.ready');await pause(150);
 // CDP clip is in document coordinates, unlike getBoundingClientRect.
 const data=await evaluate(`(()=>{const r=document.querySelector('#ota_settings').getBoundingClientRect();const clip={x:Math.floor(r.x+scrollX)-12,y:Math.floor(r.y+scrollY)-12,width:Math.ceil(r.width)+24,height:Math.ceil(r.height)+24};return {clip,annotations:[['#ota_url','填服务器根地址，不带 API 路径'],['#ota_device','填设备标识，不是代理标识'],['#ota_token','首次填写设备访问密钥'],['#ota_save','保存 OTA 配置']].map(([selector,label],index)=>{const b=document.querySelector(selector).getBoundingClientRect();return {selector,label,number:index+1,rect:{x:b.x+scrollX-clip.x,y:b.y+scrollY-clip.y,width:b.width,height:b.height}}})};})()`);
 let shot=await cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{...data.clip,scale:1}});
 await writeFile(path.join(output,'16_device_settings.png'),Buffer.from(shot.data,'base64'));
 const manifest=JSON.parse(await readFile(path.join(output,'manifest.json'),'utf8'));
 const settings=manifest.screenshots.find(s=>s.id==='16_device_settings');Object.assign(settings,{width:data.clip.width,height:data.clip.height,crop:data.clip,annotations:data.annotations});
 await cdp('Emulation.setDeviceMetricsOverride',{width:1232,height:680,deviceScaleFactor:1,mobile:false});await cdp('Page.navigate',{url:base+'/crop'});
 await until(()=>evaluate('document.querySelector("img")?.complete&&document.querySelector("img").naturalWidth===1232'),'source screenshot');
 shot=await cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:false,clip:{x:0,y:0,width:1232,height:680,scale:1}});
 await writeFile(path.join(output,'10_publish.png'),Buffer.from(shot.data,'base64'));
 const publishing=manifest.screenshots.find(s=>s.id==='10_publish');publishing.height=680;publishing.crop.height=680;
 await writeFile(path.join(output,'manifest.json'),JSON.stringify(manifest,null,2),'utf8');
 console.log(JSON.stringify({updated:['10_publish','16_device_settings'],settings_size:[data.clip.width,data.clip.height],publish_size:[1232,680]}));
}finally{
 if(ws?.readyState===1){try{await cdp('Browser.close');}catch{}ws.close();}if(browser&&browser.exitCode===null)browser.kill();for(const p of pending.values())clearTimeout(p.timer);server.closeAllConnections();await new Promise(r=>server.close(r));
 const target=path.resolve(temporary);if(path.dirname(target)===path.resolve(tmpdir())&&path.basename(target).startsWith('ota-manual-fix-')){try{await rm(target,{recursive:true,force:true,maxRetries:8,retryDelay:150});}catch{}}
}
