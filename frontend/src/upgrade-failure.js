const phases = {
  'wifi connection':'连接 Wi-Fi','clock sync':'同步设备时间',
  'manifest request':'获取固件清单','manifest verification':'验证固件清单',
  'partition selection':'选择备用分区','save upgrade journal':'保存升级记录',
  'attempt request':'创建升级记录','save download event':'保存下载进度',
  'firmware connection':'连接固件下载地址','firmware length':'检查固件长度',
  'firmware header':'检查固件头','prepare flash':'准备备用分区',
  'firmware download':'下载固件','image verification':'校验固件',
  'select boot partition':'设置启动分区','boot verification':'启动自检'
};
const networkStages = new Set(['manifest request','attempt request','firmware connection','firmware download']);
export function explainFailure(stage, code, http) {
  let detail = code;
  if (http === 401) detail = '服务器拒绝了设备凭据，请核对设备标识和访问密钥';
  else if (http === 0 && networkStages.has(stage)) detail = '未收到 HTTP 响应，请检查服务器地址和网络连接';
  else if (http >= 400) detail = '服务器返回 HTTP ' + http;
  else if (stage === 'firmware download') detail = '固件传输未完整结束';
  return (phases[stage] || stage) + ' · ' + detail + (detail !== code ? '（' + code + '）' : '');
}
export function eventError(error) {
  const match = /^([a-z ]+) failed: ([\w:()-]+) \(HTTP (\d+)\)$/.exec(error || '');
  return match ? explainFailure(match[1],match[2],Number(match[3])) : error;
}
