// Test-only stdin bridge: generated fixture keys never appear in arguments/logs.
import {createPackage,canonical,importSigningKey} from '../ota_server/static/pack-core.mjs';
let text='';for await(const chunk of process.stdin)text+=chunk;
const input=JSON.parse(text);
try{
  if(input.canonical!==undefined)console.log(JSON.stringify({canonical:canonical(input.canonical)}));
  else{
    input.firmware=Uint8Array.from(Buffer.from(input.firmware,'base64'));
    if(input.useCryptoKey){
      if(input.keyVariant==='null')input.signingKey=null;
      else if(input.keyVariant==='plain')input.signingKey={type:'private',extractable:false,algorithm:{name:'RSA-PSS',hash:{name:'SHA-256'},modulusLength:3072},usages:['sign']};
      else if(input.keyVariant){
        // Test-only alternate imports; all material comes from generated fixtures.
        const publicKey=input.keyVariant==='public';
        const pem=publicKey?input.profile.public_key_pem:input.pem;
        const der=Buffer.from(pem.replace(/-----(?:BEGIN|END) [^-]+-----|\s/g,''),'base64');
        const name=input.keyVariant==='algorithm'?'RSASSA-PKCS1-v1_5':input.keyVariant==='usages'?'RSA-OAEP':'RSA-PSS';
        input.signingKey=await crypto.subtle.importKey(publicKey?'spki':'pkcs8',der,
          {name,hash:input.keyVariant==='hash'?'SHA-384':'SHA-256'},input.keyVariant==='extractable',
          [publicKey?'verify':name==='RSA-OAEP'?'decrypt':'sign']);
      }else input.signingKey=await importSigningKey(input.pem,input.password,input.importKeyId||input.profile.target.key_id);
      if(input.cloneKey&&input.signingKey)input.signingKey=structuredClone(input.signingKey);
      delete input.pem;delete input.password;
    }
    console.log(JSON.stringify({result:await createPackage(input)}));
  }
}catch(error){console.log(JSON.stringify({error:error.message}));}
