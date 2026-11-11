export const commandLabels={queued:'等待设备接收',claimed:'设备已接收',executing:'正在执行',succeeded:'执行成功',failed:'执行失败',expired:'等待已过期'};
export const commandNames={'ota.install':'固件升级','device.restart':'设备重启'};
export const commandPending=command=>!!command&&['queued','claimed','executing'].includes(command.status);
export const commandTone=command=>command?.status==='succeeded'?'green':command?.status==='failed'?'red':command?.status==='expired'?'amber':'blue';
export const remoteAvailable=snapshot=>snapshot?.capabilities?.features?.includes('remote_commands')===true;
export const deviceOnline=(device,now)=>!device.revoked&&!!device.last_seen&&now-device.last_seen<180;
export function remoteBlockReason(device,snapshot){
 if(!remoteAvailable(snapshot))return '请重启 OTA 后台并刷新页面，以启用远程控制';
 if(device.revoked)return '设备凭据已停用';
 if(device.agent_kind!=='device')return '此网关尚未接入远程指令';
 if(device.remote_commands_version!==1)return '请先安装支持远程控制的设备固件';
 if(commandPending(device.latest_command))return '设备还有未结束的指令，请查看控制记录';
 return '';
}
