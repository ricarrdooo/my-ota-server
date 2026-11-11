"""Disposable manual screenshot data; never targets the real OTA directory."""
from pathlib import Path
import json, sys

# Reuse the existing isolated fixture's audited fake keys and image builders.
source=Path(__file__).with_name('browser_fixture.py').read_text(encoding='utf8')
exec(compile(source.split('print("QA_READY ')[0],str(Path(__file__).with_name('browser_fixture.py')),'exec'))

from ota_server.models import ProductInput,KeyInput,DeviceInput,Heartbeat,ReleaseInput
service=app.state.service
service.add_product(ProductInput(id='desk-monitor',name='桌面伴侣',description='桌面温湿度与电脑状态显示设备'))
service.add_key(KeyInput(product_id='desk-monitor',name='桌面伴侣签名公钥',pem=public_pem))
esp_target.update(id='desktop-s3-n8r8-st7735s-v1',name='ESP32-S3 桌面伴侣',product_id='desk-monitor')
target_value=service.add_target(TargetInput.model_validate(esp_target))
demo_device=service.add_device(DeviceInput(name='书桌上的设备',target_id=target_value['id'],channel='stable'))
export_profile={'schema_version':1,'target':profile(target_value),'target_fingerprint':fingerprint(target_value),'public_key_pem':public_pem}
artifacts={}
for version in ['V1.0.7','V1.0.8']:
    payload=esp_fixture(version=version)
    mf,sig=pack(export_profile,payload,key)
    stage=directory/(version+'.part');stage.write_bytes(payload)
    artifacts[version]=service.upload(mf,sig,stage,'示例固件 '+version)
release=service.publish(ReleaseInput(artifact_id=artifacts['V1.0.8']['id'],channel='stable',notes='首次上线版本'))
current=esp_fixture(version='V1.0.8')
service.heartbeat({'id':demo_device['agent_id'],'kind':'device'},Heartbeat(device_id=demo_device['id'],version='V1.0.8',sha256=hashlib.sha256(current).hexdigest(),remote_commands_version=1))
(directory/'app.bin').write_bytes(esp_fixture(version='V1.0.9'))
print('MANUAL_READY '+json.dumps({'base':base,'directory':str(directory),'device':demo_device,'target':target_value,'old_artifact':artifacts['V1.0.7']['id']}),flush=True)
uvicorn.Server(uvicorn.Config(app,host='127.0.0.1',port=sock.getsockname()[1],access_log=False,log_level='warning')).run(sockets=[sock])
