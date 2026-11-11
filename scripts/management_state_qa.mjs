// Dependency-free management-state regressions. This reads source only: all
// requests, dialogs, credentials and records are in-memory test doubles.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../frontend/src/admin-controller.js',import.meta.url),'utf8');
const startup=source.lastIndexOf('// CONTROLLER_STARTUP');
assert.ok(startup>=0,'explicit application startup marker');
let appSource=source.slice(source.indexOf('const cleanups=[];'),startup);
// Swap only the two browser URL loaders for controlled deferred imports. The
// functions and their request-generation guards execute unchanged in the VM.
let loaders=0;
appSource=appSource.replace(/await import\(('\/static\/(?:retention-ui|pack-ui)\.mjs')\)/g,(_match,path)=>{
  loaders++;return `await globalThis.importForTest(${path})`;
});
assert.equal(loaders,2,'both browser-only module imports are controlled');
const deletionSource=readFileSync(new URL('../ota_server/static/retention-ui.mjs',import.meta.url),'utf8')
  .replace('export async function openArtifactDeletion','async function openArtifactDeletion');
const features=['release_management','artifact_deletion','metadata_management','firmware_state'];
const capabilities={contract:2,features};
let passed=0;

function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};}
const turn=()=>new Promise(resolve=>setImmediate(resolve));
function element(extra={}){
  return {content:'test-only',isConnected:true,disabled:false,hidden:false,value:'',textContent:'',innerHTML:'',
    addEventListener(){},querySelectorAll(){return[];},classList:{toggle(){}},replaceChildren(){},close(){},showModal(){},...extra};
}
function runtime(fetcher=async()=>{throw Error('Unexpected request');},loader=async()=>{throw Error('Unexpected module import');}){
  const nodes=new Map(),handlers=new Map(),windowHandlers=new Map();
  const ctx={
    document:{querySelector(selector){if(!nodes.has(selector))nodes.set(selector,element());return nodes.get(selector);},
      querySelectorAll(){return[];},addEventListener(type,handler){handlers.set(type,handler);},removeEventListener(){}},
    window:{addEventListener(type,handler){windowHandlers.set(type,handler);},dispatchEvent(event){windowHandlers.get(event.type)?.(event);}},
    location:{hash:'#releases'},Event,
    FormData:class{constructor(form){this.form=form;}*[Symbol.iterator](){yield*(this.form?.fields||[]);}},
    setTimeout(){return 1;},clearTimeout(){},console,fetch:fetcher,importForTest:loader,notifications:[],
  };
  ctx.notify=message=>ctx.notifications.push(message);
  vm.createContext(ctx);vm.runInContext(appSource,ctx,{filename:'frontend/src/admin-controller.js'});
  return {ctx,nodes,handlers,evaluate:code=>vm.runInContext(code,ctx)};
}
function response(status,data){return{status,ok:status>=200&&status<300,json:async()=>data};}
function snapshot(path,tick=0){
  return path.endsWith('capabilities')?capabilities:path.endsWith('overview')?{tick}:
    path.endsWith('catalog')?{products:[],targets:[],keys:[],gateways:[],adapters:{}}:[];
}
async function test(name,work){await work();passed++;console.log('PASS '+name);}

await test('forced refresh waits for a queued fresh snapshot',async()=>{
  let count=0;const pending=[];
  const app=runtime(path=>{const tick=Math.floor(count++/7),request=deferred();pending.push(()=>request.resolve(response(200,snapshot(path,tick))));return request.promise;});
  app.evaluate('render=()=>{};');
  const first=app.evaluate('refresh()'),second=app.evaluate('refresh()');
  assert.equal(first,second,'concurrent callers share the queued job');
  let finished=false;second.then(()=>finished=true);
  pending.splice(0).forEach(finish=>finish());await turn();
  assert.equal(count,14);assert.equal(pending.length,7);assert.equal(finished,false);
  pending.splice(0).forEach(finish=>finish());await second;
  assert.equal(app.evaluate('state.overview.tick'),1,'the old snapshot is replaced');
});

await test('background refresh cannot perpetually requeue a slow request',async()=>{
  let count=0;const pending=[];
  const app=runtime(path=>{count++;const request=deferred();pending.push(()=>request.resolve(response(200,snapshot(path))));return request.promise;});
  app.evaluate('render=()=>{};');
  const first=app.evaluate('refresh()');
  for(let index=0;index<20;index++)assert.equal(app.evaluate('refresh(false)'),first);
  pending.splice(0).forEach(finish=>finish());await first;
  assert.equal(count,7,'no extra pass is queued by background timers');
  assert.equal(app.evaluate('refreshJob'),null);
});

await test('an old backend produces a persistent read-only banner and no writes',async()=>{
  let requests=0;
  const app=runtime(async path=>{requests++;return path.endsWith('capabilities')?
    response(404,{detail:'Not Found'}):response(200,snapshot(path));});
  assert.equal(await app.evaluate('synchronize()'),true);
  assert.equal(app.evaluate('managementReady'),false);
  assert.equal(app.ctx.notifications.findLast(message=>Object.hasOwn(message,'managementReady')).managementReady,false,'Vue receives the persistent read-only state');
  const before=requests;
  await assert.rejects(app.evaluate("post('/api/admin/releases/missing/delete',{})"),/重启 OTA/);
  assert.equal(requests,before,'no destructive request reaches fetch');
});

await test('business-record 404 differs from a missing management route',async()=>{
  const app=runtime(async()=>response(404,{error:'发布不存在或已删除'}));
  app.evaluate('managementReady=true;render=()=>{};');
  await assert.rejects(app.evaluate("post('/api/admin/releases/missing/delete',{})"),error=>
    error.message==='发布不存在或已删除'&&!error.routeMissing);
  assert.equal(app.evaluate('managementReady'),true);
  app.ctx.fetch=async()=>response(404,{detail:'Not Found'});
  await assert.rejects(app.evaluate("post('/api/admin/releases/missing/delete',{})"),error=>
    error.routeMissing===true&&error.status===404&&error.message.includes('重启 OTA'));
  assert.equal(app.evaluate('managementReady'),false);
});

function submitFixture(){
  const app=runtime(),request=deferred(),submit=element(),error=element({hidden:true}),messages=[];
  const form=element({dataset:{kind:'release-delete',id:'test-release'},matches(){return true;},
    querySelector(selector){return selector.includes('submit')?submit:error;}});
  let closed=0,secrets=0;
  app.nodes.set('#entry-form',form);app.ctx.request=()=>request.promise;
  app.ctx.recordClose=()=>closed++;app.ctx.recordToast=(...message)=>messages.push(message);
  app.ctx.recordSecret=()=>secrets++;
  app.evaluate('managementReady=true;api=request;closeDialog=recordClose;toast=recordToast;showSecret=recordSecret;refresh=async()=>{};');
  return{app,request,form,error,messages,closed:()=>closed,secrets:()=>secrets,
    submit:()=>app.handlers.get('submit')({target:form,preventDefault(){}})};
}

await test('completion of a detached form cannot close a replacement dialog',async()=>{
  const fixture=submitFixture(),work=fixture.submit();
  fixture.form.isConnected=false;fixture.app.nodes.set('#entry-form',element({id:'replacement'}));
  fixture.request.resolve({ok:true});await work;assert.equal(fixture.closed(),0);
});

await test('errors after closing a form remain visible through a toast',async()=>{
  const fixture=submitFixture(),work=fixture.submit();fixture.form.isConnected=false;
  fixture.request.reject(Error('发布状态发生变化'));await work;
  assert.equal(fixture.messages.at(-1)[0],'发布状态发生变化');assert.equal(fixture.messages.at(-1)[1],true);
});

await test('one-time credentials are still presented after a form is closed',async()=>{
  const fixture=submitFixture(),work=fixture.submit();fixture.form.isConnected=false;
  fixture.request.resolve({token:'test-only-not-a-real-credential'});await work;
  assert.equal(fixture.secrets(),1,'a successfully created credential must not be silently discarded');
});

const selectedArtifact={id:'wanted-artifact',version:'V1.0.0',target_name:'Test target',sha256:'a'.repeat(64),can_publish:true,notes:'artifact notes'};
function publishFixture(){
  const request=deferred(),forms=[],paths=[],app=runtime();
  app.ctx.request=path=>{paths.push(path);return request.promise;};
  app.ctx.recordForm=(kind,title,body)=>{
    const fields={'[name=artifact_id]':element(),'[name=channel]':element(),'[name=notes]':element()};
    const form=element({dataset:{kind},body,fields,querySelector(selector){return fields[selector];}});
    app.nodes.set('#entry-form',form);forms.push(form);
  };
  app.evaluate(`managementReady=true;api=request;formDialog=(kind,title,body)=>{formRequest++;recordForm(kind,title,body);};
    state={targets:[{id:'target'}],artifacts:[{id:'other-artifact',version:'V1.0.0',target_name:'Test target',sha256:'b'.repeat(64),can_publish:true}],
      releases:[{id:'test-release',artifact_id:'wanted-artifact',channel:'beta',notes:'release notes'}]};`);
  return{app,request,forms,paths};
}

await test('republish retrieves and selects the exact artifact outside the list',async()=>{
  const fixture=publishFixture(),work=fixture.app.evaluate("openForm('republish','test-release')");
  assert.deepEqual(fixture.paths,['/api/admin/artifacts/wanted-artifact']);
  fixture.request.resolve(selectedArtifact);await work;
  const form=fixture.forms[0];
  assert.equal(form.fields['[name=artifact_id]'].value,'wanted-artifact');
  assert.equal(form.fields['[name=channel]'].value,'beta');assert.equal(form.fields['[name=notes]'].value,'release notes');
  assert.ok(form.publishArtifacts.some(item=>item.id==='wanted-artifact'));assert.match(form.body,/aaaaaaaaaa/);
});

await test('a replacement dialog cancels the late exact-artifact lookup',async()=>{
  const fixture=publishFixture(),work=fixture.app.evaluate("openForm('republish','test-release')");
  fixture.app.evaluate("showDialog('帮助','replacement');");fixture.request.resolve(selectedArtifact);await work;
  assert.equal(fixture.forms.length,0);assert.equal(fixture.app.nodes.get('#dialog-title').textContent,'帮助');
});

await test('a missing build cannot silently republish another same-version artifact',async()=>{
  const fixture=publishFixture(),work=fixture.app.evaluate("openForm('republish','test-release')");
  fixture.request.resolve({...selectedArtifact,can_publish:false,publish_block_reasons:['固件已删除']});
  await assert.rejects(work,/固件已删除/);assert.equal(fixture.forms.length,0);
});

for(const [kind,path,exported] of [['delete-artifact','/static/retention-ui.mjs','openArtifactDeletion'],['pack','/static/pack-ui.mjs','openPack']]){
  await test(`a delayed ${kind} module cannot overwrite a newer dialog`,async()=>{
    const load=deferred(),paths=[],calls=[];
    const app=runtime(undefined,name=>{paths.push(name);return load.promise;});
    app.evaluate('managementReady=true;state={};');
    const work=app.evaluate(`openForm('${kind}','test-artifact')`);
    assert.deepEqual(paths,[path]);app.evaluate("showDialog('帮助','replacement');");
    load.resolve({[exported]:(...args)=>calls.push(args)});await work;
    assert.equal(calls.length,0);assert.equal(app.nodes.get('#dialog-title').textContent,'帮助');
  });
}

function deletionFixture(){
  const lookup=deferred(),mutation=deferred(),handlers=new Map(),elements=new Map();let title='',anchor=null,changed=0;
  const showDialog=(next,body)=>{
    if(anchor)anchor.isConnected=false;
    title=next;anchor=body.includes('data-artifact-delete-owner')?element():null;
    elements.set('[data-artifact-delete-owner]',anchor);
    elements.set('#artifact-delete-confirm',element({addEventListener(type,handler){handlers.set(type,handler);}}));
    elements.set('#artifact-delete-error',element({hidden:true}));
  };
  const ctx={document:{querySelector(selector){return elements.get(selector);}},window:{addEventListener(){}},
    api:()=>lookup.promise,post:()=>mutation.promise,esc:value=>String(value??''),size:String,showDialog,
    onChanged:async()=>changed++,toast(){}};
  vm.createContext(ctx);vm.runInContext(deletionSource,ctx,{filename:'ota_server/static/retention-ui.mjs'});
  const open=()=>vm.runInContext("openArtifactDeletion({id:'test-artifact',api,post,esc,size,showDialog,onChanged,toast})",ctx);
  const plan={artifact:{version:'V1.0.0',target_name:'Test target',size:256,sha256:'a'.repeat(64)},
    reasons:[],can_delete:true,recoverable_bytes:256,shared_references:0,preview_token:'test-preview-token'};
  return{lookup,mutation,open,plan,showDialog,title:()=>title,changed:()=>changed,
    confirm:()=>handlers.get('click')()};
}

await test('a late firmware deletion preview cannot replace a newer dialog',async()=>{
  const fixture=deletionFixture(),work=fixture.open();fixture.showDialog('帮助','replacement');
  fixture.lookup.resolve(fixture.plan);await work;assert.equal(fixture.title(),'帮助');
});

await test('a completed firmware deletion refreshes data without replacing a newer dialog',async()=>{
  const fixture=deletionFixture(),preview=fixture.open();fixture.lookup.resolve(fixture.plan);await preview;
  const work=fixture.confirm();fixture.showDialog('帮助','replacement');
  fixture.mutation.resolve({warnings:[],freed_bytes:256,shared_file_retained:false});await work;
  assert.equal(fixture.changed(),1);assert.equal(fixture.title(),'帮助');
});

await test('a late event lookup cannot replace a newer help dialog',async()=>{
  const app=runtime(),lookup=deferred();app.ctx.lookup=()=>lookup.promise;
  app.evaluate('managementReady=true;api=lookup;');
  const button={dataset:{action:'events',id:'test-attempt'}};
  const work=app.handlers.get('click')({target:{closest(){return button;}}});
  app.evaluate("showDialog('帮助','replacement');");lookup.resolve([]);await work;
  assert.equal(app.nodes.get('#dialog-title').textContent,'帮助');
});

console.log(`Management-state QA passed: ${passed} in-memory regressions; no production data or network accessed.`);
