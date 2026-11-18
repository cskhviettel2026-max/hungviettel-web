import { createSign } from "node:crypto";

const api="https://sheets.googleapis.com/v4/spreadsheets/";
const tokenEndpoint="https://oauth2.googleapis.com/token";

export async function sheetClient(id:string,credentials: string) {
  if(!/^[\w-]{10,150}$/.test(id))throw new Error("Cần ID Google Sheets hợp lệ.");
  let account;
  try { account=JSON.parse(credentials); }
  catch { throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON không phải JSON hợp lệ."); }
  if(typeof account.client_email!=="string"||typeof account.private_key!=="string")throw new Error("Service account thiếu email hoặc private key.");
  const now=Math.floor(Date.now()/1000);
  const encode=(value:unknown)=>Buffer.from(JSON.stringify(value)).toString("base64url");
  const assertion=encode({alg:"RS256",typ:"JWT"})+"."+encode({
    iss:account.client_email,scope:"https://www.googleapis.com/auth/spreadsheets",aud:tokenEndpoint,iat:now,exp:now+3600
  });
  const signature=createSign("RSA-SHA256").update(assertion).sign(account.private_key,"base64url");
  const response=await fetch(tokenEndpoint,{
    method:"POST",body:new URLSearchParams({grant_type:"urn:ietf:params:oauth:grant-type:jwt-bearer",assertion:assertion+"."+signature}),
    signal:AbortSignal.timeout(9000)
  });
  if(!response.ok)throw new Error("Google OAuth trả HTTP "+response.status+".");
  const oauth=await response.json();
  if(typeof oauth.access_token!=="string")throw new Error("Google không cấp access token.");
  return async (path:string,body?:unknown)=>{
    const result=await fetch(api+id+path,{
      method:body===undefined?"GET":"POST",
      headers:{Authorization:"Bearer "+oauth.access_token,"Content-Type":"application/json"},
      body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(12_000)
    });
    if(!result.ok)throw new Error("Google Sheets trả HTTP "+result.status+". Kiểm tra quyền chia sẻ và cấu hình Sheet.");
    return result.json();
  };
}
