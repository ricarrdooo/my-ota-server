// Browser-local packaging. Cryptography uses Web Crypto; no private data is sent.
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', {fatal: true});
const RSA = '2a864886f70d010101', PBES2 = '2a864886f70d01050d', PBKDF2 = '2a864886f70d01050c';
const AES_CBC = {'608648016503040102':128, '608648016503040116':192, '60864801650304012a':256};
const PRFS = {'2a864886f70d0207':'SHA-1', '2a864886f70d0209':'SHA-256', '2a864886f70d020a':'SHA-384', '2a864886f70d020b':'SHA-512'};
export class PackError extends Error {}
function need(condition, message) { if (!condition) throw new PackError(message); }
// Re-check structured-cloned keys before using them. Private material must never
// become extractable, and no decrypt/export or unrelated usages are accepted.
export function validateSigningKey(key) {
  let valid=false;
  try{valid=typeof globalThis.CryptoKey==='function'&&key instanceof globalThis.CryptoKey&&
    key.type==='private'&&key.extractable===false&&key.algorithm?.name==='RSA-PSS'&&
    key.algorithm.hash?.name==='SHA-256'&&[3072,4096].includes(key.algorithm.modulusLength)&&
    key.usages.length===1&&key.usages[0]==='sign';}catch{}
  need(valid,
    '本机签名密钥无效；请移除后重新导入 RSA-3072/4096 私钥');
  return key;
}
function hex(bytes) { return Array.from(bytes, x => x.toString(16).padStart(2,'0')).join(''); }
function join(...items) { const out = new Uint8Array(items.reduce((n,x)=>n+x.length,0)); let pos=0; for(const item of items){out.set(item,pos);pos+=item.length;} return out; }
export function canonical(value) {
  function ordered(v) {
    if (v===null || typeof v==='string' || typeof v==='boolean') return v;
    if (typeof v==='number') { need(Number.isSafeInteger(v),'签名配置只能包含安全范围内的整数'); return v; }
    if (Array.isArray(v)) return v.map(ordered);
    need(v && typeof v==='object','签名配置有不支持的数据类型');
    return Object.fromEntries(Object.keys(v).sort().map(k=>[k,ordered(v[k])]));
  }
  // Matches Python ensure_ascii=True, including surrogate pairs and DEL.
  return JSON.stringify(ordered(value)).replace(/[\u007f-\uffff]/g,c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0'));
}
async function sha(bytes) { return hex(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))); }
function node(bytes, pos=0, end=bytes.length) {
  const start=pos;
  need(pos+2<=end,'私钥 DER 数据被截断');
  const tag=bytes[pos++]; let len=bytes[pos++];
  if(len&128){const count=len&127;need(count>=1&&count<=4&&pos+count<=end&&bytes[pos]!==0,'私钥 DER 长度无效');len=0;for(let i=0;i<count;i++)len=len*256+bytes[pos++];need(len>=128,'私钥 DER 长度不是标准编码');}
  need(Number.isSafeInteger(len)&&pos+len<=end,'私钥 DER 长度越界');
  return {tag,body:bytes.subarray(pos,pos+len),full:bytes.subarray(start,pos+len),end:pos+len};
}
function children(n, tag=48) {
  need(n.tag===tag,'私钥 ASN.1 结构不受支持');const items=[];let pos=0;
  while(pos<n.body.length){need(items.length<32,'私钥 ASN.1 项目过多');const item=node(n.body,pos);items.push(item);pos=item.end;}
  return items;
}
function sequence(bytes) { const n=node(bytes);need(n.end===bytes.length,'私钥 DER 包含多余尾部');return children(n); }
function integer(n, limit=Number.MAX_SAFE_INTEGER) {
  need(n?.tag===2&&n.body.length>0&&n.body.length<=7&&!(n.body[0]&128),'私钥整数无效');
  need(n.body.length===1||n.body[0]!==0||(n.body[1]&128),'私钥整数编码无效');
  let value=0;for(const b of n.body)value=value*256+b;need(Number.isSafeInteger(value)&&value<=limit,'私钥参数过大');return value;
}
function oid(n) { need(n?.tag===6,'私钥算法标识无效');return hex(n.body); }
function octets(n) { need(n?.tag===4,'私钥字节字段无效');return n.body; }
function der(tag, body) { const lengths=[];let n=body.length;while(n){lengths.unshift(n%256);n=Math.floor(n/256);}return join(new Uint8Array(body.length<128?[tag,body.length]:[tag,128+lengths.length,...lengths]),body); }
const rsaAlgorithm = new Uint8Array([48,13,6,9,42,134,72,134,247,13,1,1,1,5,0]);
function privateInfo(bytes, pkcs1=false) {
  let inner=bytes;
  if(!pkcs1){const p=sequence(bytes);need(p.length===3&&integer(p[0])===0,'仅支持 PKCS#8 v0 RSA 私钥');const alg=children(p[1]);need((alg.length===1||alg.length===2&&alg[1].tag===5&&alg[1].body.length===0)&&oid(alg[0])===RSA,'仅支持通用 RSA 私钥');inner=octets(p[2]);}
  const parts=sequence(inner);need(parts.length===9&&integer(parts[0])===0,'不支持多素数或非 RSA 私钥');
  for(const p of parts.slice(1))need(p.tag===2&&p.body.length>0&&!(p.body[0]&128),'RSA 私钥整数无效');
  const modulus=parts[1].body[0]===0?parts[1].body.subarray(1):parts[1].body;
  const bits=modulus.length*8-Math.clz32(modulus[0])+24;
  need([3072,4096].includes(bits),'签名私钥必须是 RSA-3072 或 RSA-4096');
  const publicDer=der(48,join(parts[1].full,parts[2].full));
  const spki=der(48,join(rsaAlgorithm,der(3,join(new Uint8Array([0]),publicDer))));
  return {spki, pkcs8:pkcs1?der(48,join(new Uint8Array([2,1,0]),rsaAlgorithm,der(4,inner))):bytes};
}
async function decryptPrivate(bytes,password) {
  const p=sequence(bytes);need(p.length===2,'口令保护私钥结构无效');const alg=children(p[0]);
  need(alg.length===2&&oid(alg[0])===PBES2,'仅支持 PBES2/PBKDF2/AES-CBC 保护的 PKCS#8 私钥，请使用本项目 keygen 生成');
  const params=children(alg[1]);need(params.length===2,'PBES2 参数无效');
  const kdf=children(params[0]),cipher=children(params[1]);
  need(kdf.length===2&&oid(kdf[0])===PBKDF2&&cipher.length===2,'私钥加密算法不受支持');
  const length=AES_CBC[oid(cipher[0])], iv=octets(cipher[1]);need(length&&iv.length===16,'仅支持 AES-CBC 私钥保护');
  const kp=children(kdf[1]);need(kp.length>=2&&kp.length<=4,'PBKDF2 参数无效');
  const salt=octets(kp[0]), iterations=integer(kp[1],2000000);
  need(salt.length>=8&&salt.length<=128&&iterations>=1,'私钥口令派生参数不受支持');
  let at=2,hash='SHA-1';
  if(kp[at]?.tag===2){need(integer(kp[at++])===length/8,'PBKDF2 密钥长度不匹配');}
  if(kp[at]){const prf=children(kp[at++]);need(prf.length>=1&&prf.length<=2,'PBKDF2 PRF 无效');hash=PRFS[oid(prf[0])];need(hash,'PBKDF2 哈希算法不受支持');if(prf[1])need(prf[1].tag===5&&prf[1].body.length===0,'PBKDF2 PRF 参数无效');}
  need(at===kp.length,'私钥派生参数有多余字段');
  const encrypted=octets(p[1]);need(encrypted.length>=16&&encrypted.length%16===0,'加密私钥长度无效');
  need(typeof password==='string'&&password.length>0,'请输入私钥保护密码');
  const encoded=encoder.encode(password);
  try {
    const material=await crypto.subtle.importKey('raw',encoded,'PBKDF2',false,['deriveKey']);
    const aes=await crypto.subtle.deriveKey({name:'PBKDF2',hash,salt,iterations},material,{name:'AES-CBC',length},false,['decrypt']);
    return new Uint8Array(await crypto.subtle.decrypt({name:'AES-CBC',iv},aes,encrypted));
  } catch { throw new PackError('私钥密码不正确或私钥文件损坏，请检查后重试'); }
  finally { encoded.fill(0); }
}
function pemBytes(pem) {
  need(typeof pem==='string'&&pem.length<=65536,'私钥文件过大或不是 PEM 文本');
  const match=/^\s*-----BEGIN (ENCRYPTED PRIVATE KEY|PRIVATE KEY|RSA PRIVATE KEY)-----\s*([A-Za-z0-9+/=\s]+)\s*-----END \1-----\s*$/.exec(pem);
  need(match,'请选择 private.pem；不支持公钥、OpenSSH 或传统加密 RSA PEM');
  let raw;try{raw=Uint8Array.from(atob(match[2].replace(/\s/g,'')),c=>c.charCodeAt(0));}catch{throw new PackError('PEM 文件 Base64 无效');}
  need(raw.length<=16384,'私钥 DER 文件过大');return {label:match[1],raw};
}
export async function importSigningKey(pem,password,keyId) {
  let raw,plain,wrapped;
  try {
    const parsed=pemBytes(pem);raw=parsed.raw;
    plain=parsed.label==='ENCRYPTED PRIVATE KEY'?await decryptPrivate(raw,password):raw;
    const info=privateInfo(plain,parsed.label==='RSA PRIVATE KEY');wrapped=info.pkcs8;
    need(await sha(info.spki)===keyId,'私钥不属于所选硬件型号的公钥，请选择原先配对的 private.pem');
    try{return validateSigningKey(await crypto.subtle.importKey('pkcs8',wrapped,{name:'RSA-PSS',hash:'SHA-256'},false,['sign']));}
    catch{throw new PackError('RSA 私钥无效或浏览器不支持，请使用本项目生成的 PKCS#8 私钥');}
  } finally {raw?.fill(0);plain?.fill(0);wrapped?.fill(0);}
}
async function verificationKey(profile) {
  const pem=profile.public_key_pem;
  need(typeof pem==='string'&&pem.length<=8192,'硬件配置缺少签名公钥，请刷新页面后重试');
  const match=/^\s*-----BEGIN PUBLIC KEY-----\s*([A-Za-z0-9+/=\s]+)\s*-----END PUBLIC KEY-----\s*$/.exec(pem);
  need(match,'硬件配置中的签名公钥格式无效，请刷新后重试');
  let bytes;
  try{bytes=Uint8Array.from(atob(match[1].replace(/\s/g,'')),c=>c.charCodeAt(0));}
  catch{throw new PackError('硬件配置中的签名公钥 Base64 无效');}
  need(await sha(bytes)===profile.target.key_id,'签名公钥指纹与所选硬件型号不一致，请刷新后重试');
  try{return await crypto.subtle.importKey('spki',bytes,{name:'RSA-PSS',hash:'SHA-256'},false,['verify']);}
  catch{throw new PackError('硬件配置中的签名公钥无效或浏览器不支持');}
}
function readers(data){const view=new DataView(data.buffer,data.byteOffset,data.byteLength);return {u16:p=>view.getUint16(p,true),u32:p=>view.getUint32(p,true)};}
function text(data){const end=data.indexOf(0);return decoder.decode(end<0?data:data.subarray(0,end));}
async function inspectImage(data,target) {
  const config=target.config,{u16,u32}=readers(data);
  if(target.adapter==='esp-idf-app'){
    need(data.length>=288&&data[0]===0xe9,'不是 ESP-IDF 应用 bin，请勿选择 bootloader、整包或其他文件');
    const count=data[1],chip=u16(12);
    need(count>=1&&count<=16&&chip===config.chip_id,'ESP 芯片型号或段数与所选板型不匹配');
    need(u32(28)>=256&&u32(32)===0xabcd5432,'缺少 ESP 应用描述符，不是应用 bin');
    const version=text(data.subarray(48,80)),project=text(data.subarray(80,112));
    need(project===config.project_name,'ESP 固件项目名称与所选板型不匹配');
    let pos=24,checksum=0xef;
    for(let i=0;i<count;i++){need(pos+8<=data.length,'ESP 段头被截断');const n=u32(pos+4);pos+=8;need(n%4===0&&pos+n<=data.length,'ESP 段长度错误');for(let j=pos;j<pos+n;j++)checksum^=data[j];pos+=n;}
    const check=pos+15-pos%16,end=check+1;
    need(check<data.length&&data[check]===checksum,'ESP 镜像校验和错误');
    need(data.subarray(pos,check).every(x=>x===0),'ESP 镜像填充错误');
    need(data[23]===1&&end+32===data.length,'ESP 镜像缺少 SHA-256 或尾部格式不受支持');
    need(await sha(data.subarray(0,end))===hex(data.subarray(end)),'ESP 镜像内置 SHA-256 错误');
    return {native_version:version,project,chip_id:chip};
  }
  if(target.adapter==='raw-cortexm'){
    need(data.length>=8&&data.length%4===0,'Cortex-M bin 长度错误');
    const stack=u32(0),reset=u32(4),base=config.app_address;
    need(stack>config.ram_start&&stack<=config.ram_start+config.ram_size&&stack%8===0,'初始栈指针不在目标 RAM 范围');
    need(reset%2===1&&reset-1>=base&&reset-1<base+data.length,'复位向量不在目标应用区域');return {};
  }
  if(target.adapter==='mcuboot-image'){
    need(data.length>=40&&u32(0)===0x96f3b83d,'MCUboot 镜像头无效');
    const header=u16(8),protectedSize=u16(10),bodyEnd=header+u32(12),digestEnd=bodyEnd+protectedSize;
    need(u32(16)===0,'不支持加密、压缩、RAM-load 或多镜像 MCUboot');
    need(header>=32&&header===config.header_size&&u32(4)===(config.load_address||0),'MCUboot 布局不匹配');
    need(bodyEnd<=data.length,'MCUboot 应用被截断');
    function tlvs(start,end){const items=[];while(start<end){need(start+4<=end,'MCUboot TLV 头被截断');const kind=u16(start),length=u16(start+2);start+=4;need(start+length<=end,'MCUboot TLV 越界');items.push([kind,data.subarray(start,start+length)]);start+=length;}return items;}
    if(protectedSize){need(bodyEnd+4<=data.length&&u16(bodyEnd)===0x6908&&u16(bodyEnd+2)===protectedSize&&digestEnd<=data.length,'MCUboot 受保护 TLV 无效');tlvs(bodyEnd+4,digestEnd);}
    need(digestEnd+4<=data.length&&u16(digestEnd)===0x6907,'MCUboot 哈希 TLV 缺失');
    const length=u16(digestEnd+2),end=digestEnd+length;need(length>=4&&end<=data.length,'MCUboot TLV 长度错误');
    const digests=tlvs(digestEnd+4,end).filter(([kind])=>kind===0x10);
    need(digests.length===1&&hex(digests[0][1])===await sha(data.subarray(0,digestEnd)),'MCUboot SHA-256 错误');
    need(data.subarray(end).every(x=>x===255),'MCUboot 存在不支持的尾部');
    return {native_version:`${data[20]}.${data[21]}.${u16(22)}+${u32(24)}`};
  }
  throw new PackError('不支持此固件适配器，不能跳过格式检查');
}
export async function createPackage(input, onProgress=()=>{}) {
  need(globalThis.crypto?.subtle,'浏览器本地签名需要 HTTPS 或本机 localhost/127.0.0.1');
  const {profile,firmware,pem,password}=input,target=profile?.target;
  onProgress('check','正在本地检查板型和固件格式');
  need(profile?.schema_version===1&&target&&profile.target_fingerprint===await sha(encoder.encode(canonical(target))),'硬件配置指纹无效，请刷新后重试');
  const data=firmware instanceof Uint8Array?firmware:new Uint8Array(firmware);
  need(Number.isSafeInteger(target.max_size)&&data.length>=8&&data.length<=target.max_size&&data.length<=134217728,'固件大小超出所选板型容量');
  need(Array.isArray(target.capabilities)&&target.capabilities.includes('staging')&&target.capabilities.includes('app_confirm'),'板型缺少必要 OTA 能力');
  const details=await inspectImage(data,target),version=details.native_version||input.version;
  need(typeof version==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.+-]{0,63}$/.test(version),'无法读取镜像版本；原始 Cortex-M bin 请填写有效版本');
  need(!input.version||!details.native_version||input.version===details.native_version,'版本必须与镜像内置版本一致');
  onProgress('hash','正在本地计算完整 bin 的 SHA-256');
  const manifest={schema_version:1,product_id:target.product_id,target_id:target.id,target_fingerprint:profile.target_fingerprint,
    component:'app',mcu:target.mcu,hw_revision:target.hw_revision,layout_id:target.layout_id,image_format:target.adapter,
    version,size:data.length,sha256:await sha(data),key_id:target.key_id,signature_algorithm:'rsa-pss-sha256',
    min_bootloader_version:target.min_bootloader,required_capabilities:[...target.capabilities].sort()};
  const storedKey=input.signingKey!==undefined;
  onProgress('sign',storedKey?'正在使用本机密钥签名（私钥不上传）':'正在本地解锁私钥并签名（私钥不上传）');
  const key=storedKey?validateSigningKey(input.signingKey):await importSigningKey(pem,password,target.key_id);
  // A local key can be mislabeled in storage or the target can change while the
  // UI is open. Verify with the target's independently fingerprinted public key
  // before returning anything that may be uploaded.
  const verifier=storedKey?await verificationKey(profile):null;
  const payload=encoder.encode(canonical(manifest));
  let binary;
  try{binary=new Uint8Array(await crypto.subtle.sign({name:'RSA-PSS',saltLength:32},key,payload));}
  catch{throw new PackError('本机签名失败，请重新导入所选型号的签名私钥');}
  if(verifier){
    let valid=false;
    try{valid=await crypto.subtle.verify({name:'RSA-PSS',saltLength:32},verifier,binary,payload);}catch{}
    need(valid,'本机签名密钥不属于所选硬件型号，请移除后重新导入正确私钥');
  }
  const signature=btoa(String.fromCharCode(...binary));
  return {manifest,signature,details};
}
