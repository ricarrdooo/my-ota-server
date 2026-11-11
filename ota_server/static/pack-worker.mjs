import {createPackage,PackError} from './pack-core.mjs';
self.onmessage=async event=>{
  const input=event.data;
  try{
    const result=await createPackage(input,(stage,message)=>self.postMessage({type:'progress',stage,message}));
    self.postMessage({type:'done',result});
  }catch(error){
    self.postMessage({type:'error',message:error instanceof PackError?error.message:'本地打包失败：文件可能损坏或浏览器不支持，请检查后重试'});
  }finally{
    input.pem='';input.password='';input.signingKey=null;if(input.firmware)new Uint8Array(input.firmware).fill(0);
    self.close();
  }
};
