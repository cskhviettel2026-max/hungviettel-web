import { sql } from "../server/db.ts";
import { readSheet } from "read-excel-file/node";

const [file,mode,...extra]=process.argv.slice(2);
if(!file?.toLowerCase().endsWith(".xlsx")||extra.length||(mode&&!["--apply","--dry-run"].includes(mode))) {
  throw new Error('Dùng npm run db:import -- "duong-dan.xlsx" --dry-run hoặc --apply.');
}
const apply=mode==="--apply";
const rows=await readSheet(file,"Registrations");
const headers=["ID","Created","Name","Phone","Email","Company","Products","Consent","Active","Confirmation","EmailError"];
const vietnamOffset=7*60*60_000;
const products=new Map([["Tendoo","tendoo"],["Viettel-CA","ca"],["vContract","contract"],["S-invoice","invoice"],["vBHXH","bhxh"],["FTTH","ftth"]]);
const errors=[];
function entries(convert){
  if(!rows||!headers.every((header,index)=>rows[0]?.[index]===header))throw new Error("Thiếu tiêu đề đúng mẫu trong tab Registrations.");
  return rows.slice(1).flatMap((row,index)=>{
    if(!row.some(value=>value!=null&&value!==""))return [];
    try { return [convert(row)]; }
    catch { errors.push("Registrations dòng "+(index+2));return []; }
  });
}
function date(value){
  if(value instanceof Date)return new Date(value.getTime()-vietnamOffset).toISOString();
  if(typeof value!=="number"){
    if(typeof value!=="string"||!/(?:Z|[+-]\d{2}:\d{2})$/.test(value))throw new Error("Ngày cần múi giờ.");
    return new Date(value).toISOString();
  }
  return new Date(Math.round((value-25569)*86_400_000)-vietnamOffset).toISOString();
}
const text=value=>String(value??"").trim();
const yes=value=>value===true||text(value).toUpperCase()==="TRUE";
function names(value) {return text(value).split(",").map(text).filter(Boolean);}
function ids(names){
  return names.map(name=>{
    if(!products.has(name))throw new Error("Tên dịch vụ chưa có ánh xạ.");
    return products.get(name);
  });
}
function email(value){
  const address=text(value).toLowerCase();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address))throw new Error("Email không hợp lệ.");
  return address;
}
const registrations=entries(([id,created,name,phone,mail,company,selected,consent,,confirmation,error])=>{
  if(!text(id)||!text(name)||!text(phone))throw new Error("Thiếu thông tin.");
  const labels=names(selected);
  let number=text(phone);
  if(typeof phone==="number"&&/^[1-9]\d{8}$/.test(number))number="0"+number;
  return {id:text(id),created:date(created),name:text(name),phone:number,email:email(mail),company:text(company),
    labels,serviceIds:ids(labels),consent:yes(consent),
    status:text(confirmation).toUpperCase()==="SENT"?"sent":text(error)?"failed":"pending"};
});
console.log("Registrations:",registrations.length,"Dòng cần kiểm tra:",errors.length);
if(errors.length) {
  console.error(errors.slice(0,40).join(", "));
  process.exitCode=1;
}else if(!apply) console.log("Dry-run hoàn tất. Dùng --apply để nhập vào Neon.");
else {
  const db=sql();
  const inserted=await db`INSERT INTO hung_leads (id,name,phone,email,company,products,service_ids,consent,owner_email,customer_email,created_at)
    SELECT id,name,phone,email,company,labels,"serviceIds",consent,'legacy',status,created
    FROM jsonb_to_recordset(${JSON.stringify(registrations)}::jsonb)
      AS r(id text,name text,phone text,email text,company text,labels jsonb,"serviceIds" jsonb,consent boolean,status text,created timestamptz)
    ON CONFLICT DO NOTHING RETURNING id`;
  console.log("Đã nhập yêu cầu mới:",inserted.length);
}
