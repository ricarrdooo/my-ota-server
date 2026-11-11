// Browser-origin local signing keys. IndexedDB structured-clones a non-exportable
// CryptoKey; neither PEM nor its former protection password is stored anywhere.
import {PackError,validateSigningKey} from './pack-core.mjs';

const DATABASE='ota-local-signing-keys';
const STORE='signing-keys';
function validId(keyId) {
  if(typeof keyId!=='string'||!/^[0-9a-f]{64}$/.test(keyId))
    throw new PackError('签名公钥指纹无效，请刷新硬件配置后重试');
}
function failure(action,error) {
  if(error instanceof PackError)return error;
  if(error?.name==='QuotaExceededError')return new PackError('本机存储空间不足，密钥未能保存；请清理空间后重试');
  return new PackError(`无法${action}本机签名密钥，请允许此网站使用本机存储，或退出无痕模式后重试`);
}
async function openDatabase() {
  let factory;
  try{factory=globalThis.indexedDB;}catch(error){throw failure('访问',error);}
  if(!factory)throw new PackError('此浏览器不支持本机密钥保存，请使用支持 IndexedDB 的浏览器');
  return new Promise((resolve,reject)=>{
    let request,done=false;
    const fail=error=>{if(!done){done=true;reject(failure('打开',error));}};
    try{request=factory.open(DATABASE,1);}catch(error){fail(error);return;}
    request.onupgradeneeded=()=>{
      try{if(!request.result.objectStoreNames.contains(STORE))request.result.createObjectStore(STORE,{keyPath:'id'});}
      catch(error){try{request.transaction?.abort();}catch{}fail(error);}
    };
    request.onblocked=()=>fail(new PackError('本机密钥存储被其他页面占用，请关闭其他 OTA 页面后重试'));
    request.onerror=()=>fail(request.error);
    request.onsuccess=()=>{
      const db=request.result;
      if(done){db.close();return;}
      db.onversionchange=()=>db.close();
      done=true;resolve(db);
    };
  });
}
async function transaction(mode,action,callback) {
  const db=await openDatabase();
  try{
    return await new Promise((resolve,reject)=>{
      let tx,value,failed=false;
      const fail=error=>{if(!failed){failed=true;reject(failure(action,error));}};
      try{
        tx=db.transaction(STORE,mode);
        tx.oncomplete=()=>{if(!failed)resolve(value);};
        tx.onerror=()=>fail(tx.error);
        tx.onabort=()=>fail(tx.error);
        callback(tx.objectStore(STORE),result=>{value=result;});
      }catch(error){try{tx?.abort();}catch{}fail(error);}
    });
  }finally{db.close();}
}

export async function getSigningKey(keyId) {
  validId(keyId);
  const record=await transaction('readonly','读取',(store,done)=>{
    const request=store.get(keyId);request.onsuccess=()=>done(request.result);
  });
  if(record===undefined)return null;
  if(!record||record.id!==keyId)throw new PackError('本机密钥记录损坏，请移除后重新导入');
  return validateSigningKey(record.key);
}
export async function saveSigningKey(keyId,key) {
  validId(keyId);validateSigningKey(key);
  await transaction('readwrite','保存',store=>store.put({id:keyId,key}));
}
export async function forgetSigningKey(keyId) {
  validId(keyId);
  await transaction('readwrite','移除',store=>store.delete(keyId));
}
