export const titles={overview:'总览',products:'产品与硬件',devices:'设备与网关',artifacts:'固件文件',releases:'版本发布',attempts:'升级记录'};
export const when=value=>value?new Date(value*1000).toLocaleString('zh-CN',{hour12:false}):'尚未联系';
export const size=value=>value>=1048576?(value/1048576).toFixed(2)+' MiB':value>=1024?Math.round(value/1024)+' KiB':value+' B';
export const matches=(item,query,fields)=>!query.trim()||fields.some(field=>String(item[field]??'').toLowerCase().includes(query.trim().toLowerCase()));
export const taskLabels={created:'已创建',downloading:'正在下载',downloaded:'下载完成',transferring:'传输中',validating:'校验中',installing:'安装中',pending_boot:'等待启动确认',confirmed:'升级成功',failed:'升级失败',rolled_back:'已回滚'};
export const taskTone=state=>state==='confirmed'?'green':state==='failed'?'red':['rolled_back','pending_boot'].includes(state)?'amber':'blue';
export const fileStates={available:['文件可用','green'],deleted:['固件已删除','red'],missing:['文件缺失','amber'],corrupt:['校验异常','red'],storage_error:['存储不可读','red'],unknown:['状态待确认','']};
