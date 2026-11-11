// One selected artifact only; GET is a preview, POST requires confirmation.
const $=(selector)=>document.querySelector(selector);
let active=null;
window.addEventListener('ota:dialog-close',()=>{if(active){active.closed=true;active=null;}});

export async function openArtifactDeletion({id,api,post,esc,size,showDialog,onChanged,toast}){
  const ctx={closed:false,anchor:null};active=ctx;
  const current=()=>active===ctx&&!ctx.closed&&!!ctx.anchor?.isConnected;
  const show=(title,body)=>{showDialog(title,'<div data-artifact-delete-owner>'+body+'</div>');ctx.anchor=$('[data-artifact-delete-owner]');};
  const endpoint='/api/admin/artifacts/'+encodeURIComponent(id);
  show('删除此固件','<p class="muted">正在检查此固件的发布和下载状态…</p>');
  let plan;
  try{plan=await api(endpoint+'/deletion');}
  catch(error){if(current())show('暂不能删除',`<p class="notice error">${esc(error.message)}</p>`);return;}
  if(!current())return;
  const item=plan.artifact;
  const blocked=plan.reasons.map(reason=>`<p class="notice error">${esc(reason)}</p>`).join('');
  show('删除此固件',`
    <div class="notice">只删除下方这一份固件，不自动清理其他版本，也不限制保留份数。</div>
    <div class="setup-step"><div class="step-text"><b>${esc(item.version)} · ${esc(item.target_name)}</b><p>文件大小：${size(item.size)}</p><p class="mono artifact-delete-digest">SHA-256：${esc(item.sha256)}</p></div></div>
    ${blocked}
    <p class="muted">预计释放空间：<b>${size(plan.recoverable_bytes)}</b></p>
    ${plan.shared_references?`<p class="notice">文件还被其他 ${plan.shared_references} 份固件共用。仅移除此条固件，保留共享文件，不影响其他版本。</p>`:''}
    <p class="form-hint">发布与升级历史会保留。删除后不能直接发布，恢复需要重新上传原固件。</p>
    <p class="notice error">没有回收站。请确认版本和摘要；确认后关闭窗口不会撤销已经开始的删除。</p>
    <div id="artifact-delete-error" class="form-error" role="alert" hidden></div>
    <div class="form-actions"><button type="button" data-action="close">取消</button><button id="artifact-delete-confirm" type="button" class="danger" ${plan.can_delete?'':'disabled'}>${plan.can_delete?'确认删除此固件':'当前不可删除，请查看上方原因'}</button></div>`);
  $('#artifact-delete-confirm').addEventListener('click',async()=>{
    const button=$('#artifact-delete-confirm'),error=$('#artifact-delete-error');
    if(button.disabled)return;
    button.disabled=true;error.hidden=true;button.textContent='正在删除…';
    try{
      const result=await post(endpoint+'/delete',{preview_token:plan.preview_token});
      await onChanged();if(!current())return;
      const warnings=result.warnings.map(message=>`<p class="notice error">${esc(message)}</p>`).join('');
      show('删除结果',`<div class="pack-success"><div><b>${warnings?'文件暂未释放':'此固件已删除'}</b><p>${esc(item.version)} · ${esc(item.target_name)}</p><p>实际释放 ${size(result.freed_bytes)}。${result.shared_file_retained?'共享文件仍供其他版本使用。':''}</p></div></div>${warnings}<p class="form-hint">其他固件未删除；发布和升级历史仍可查看。</p><div class="form-actions"><button type="button" data-action="close">完成</button></div>`);
    }catch(e){if(!current())return;error.textContent=e.message;error.hidden=false;button.textContent='请关闭并重新确认';toast('删除未完成，请重新打开删除窗口',true);}
  });
}
