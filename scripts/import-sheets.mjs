import { sql } from "../server/db.ts";
import { sheetClient } from "../server/sheets-client.ts";
import { zoomSession } from "../lib/site-data.ts";

const args=process.argv.slice(2);
if(args.length>1||args.some(arg=>!["--apply","--dry-run"].includes(arg))) {
  throw new Error("Dùng npm run db:import -- --dry-run hoặc --apply.");
}
const apply=args.includes("--apply");
const { GOOGLE_LEGACY_SHEETS_ID:id, GOOGLE_SERVICE_ACCOUNT_JSON:credentials }=process.env;
if(!id||!credentials)throw new Error("Cần GOOGLE_LEGACY_SHEETS_ID và GOOGLE_SERVICE_ACCOUNT_JSON.");
const google=await sheetClient(id,credentials);
const headers={
  Registrations:["ID","Created","Name","Phone","Email","Company","Products","Consent","Active","Confirmation","EmailError"],
  Sessions:["SessionID","Title","StartISO","ZoomURL","Enabled","Products"],
  ReminderLog:["Key","SentAt","Email","SessionID"]
};
const tabs=Object.keys(headers);
const query=new URLSearchParams({valueRenderOption:"UNFORMATTED_VALUE",dateTimeRenderOption:"SERIAL_NUMBER"});
for(const tab of tabs)query.append("ranges",tab);
const [sheet,result]=await Promise.all([google("?fields=properties.timeZone"),google("/values:batchGet?"+query)]);
const timeZone=sheet.properties?.timeZone||"Asia/Ho_Chi_Minh";
const products=new Map([["Tendoo","tendoo"],["Viettel-CA","ca"],["vContract","contract"],["S-invoice","invoice"],["vBHXH","bhxh"],["FTTH","ftth"]]);
const errors=[];
function entries(tab,convert){
  const rows=result.valueRanges?.[tabs.indexOf(tab)]?.values;
  if(!rows||!headers[tab].every((header,index)=>rows[0]?.[index]===header))throw new Error("Thiếu tiêu đề đúng mẫu trong tab "+tab+".");
  return rows.slice(1).flatMap((row,index)=>{
    if(!row.some(value=>value!==""))return [];
    try { return [convert(row)]; }
    catch { errors.push(tab+" dòng "+(index+2));return []; }
  });
}
function date(value){
  if(typeof value!=="number"){
    if(typeof value!=="string"||!/(?:Z|[+-]\d{2}:\d{2})$/.test(value))throw new Error("Ngày cần múi giờ.");
    return new Date(value).toISOString();
  }
  const local=Math.round((value-25569)*86_400_000);
  const format=new Intl.DateTimeFormat("en",{timeZone,timeZoneName:"shortOffset"});
  const offset=format.formatToParts(local).find(part=>part.type==="timeZoneName").value;
  const match=offset.match(/^GMT([+-])(\d{1,2})(?::(\d{2}))?$/);
  const minutes=match?(Number(match[2])*60+Number(match[3]||0))*(match[1]==="-"?-1:1):0;
  return new Date(local-minutes*60_000).toISOString();
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
const registrations=entries("Registrations",([id,created,name,phone,mail,company,selected,consent,active,confirmation,error])=>{
  if(!text(id)||!text(name)||!text(phone))throw new Error("Thiếu thông tin.");
  const labels=names(selected);
  let number=text(phone);
  if(typeof phone==="number"&&/^[1-9]\d{8}$/.test(number))number="0"+number;
  return {id:text(id),created:date(created),name:text(name),phone:number,email:email(mail),company:text(company),
    labels,serviceIds:ids(labels),consent:yes(consent),active:yes(active),
    status:text(confirmation).toUpperCase()==="SENT"?"sent":text(error)?"failed":"pending"};
});
const sessions=entries("Sessions",([id,title,startAt,link,enabled,selected])=>{
  return zoomSession.parse({id:text(id),title:text(title),startAt:date(startAt),link:text(link),enabled:yes(enabled),products:ids(names(selected))});
});
const reminders=entries("ReminderLog",([key,sentAt,mail,session])=>{
  const parts=text(key).split("|"), keyEmail=parts.pop(), timestamp=Number(parts.pop());
  const sessionId=text(session);
  if(parts.join("|")!==sessionId||email(keyEmail)!==email(mail)||!Number.isFinite(timestamp))throw new Error("Mã nhắc không hợp lệ.");
  return {sessionId,email:email(mail),startAt:new Date(timestamp).toISOString(),sentAt:date(sentAt)};
});
console.log("Registrations:",registrations.length,"Sessions:",sessions.length,"ReminderLog:",reminders.length,"Dòng cần kiểm tra:",errors.length);
if(errors.length) {
  console.error(errors.slice(0,40).join(", "));
  process.exitCode=1;
}else if(!apply) console.log("Dry-run hoàn tất. Dùng --apply để nhập vào Neon.");
else {
  const db=sql();
  const sessionData=JSON.stringify(sessions);
  const queries=[
    db`INSERT INTO hung_leads (id,name,phone,email,company,products,service_ids,consent,active,owner_email,customer_email,created_at)
      SELECT id,name,phone,email,company,labels,"serviceIds",consent,active,'legacy',status,created
      FROM jsonb_to_recordset(${JSON.stringify(registrations)}::jsonb)
        AS r(id text,name text,phone text,email text,company text,labels jsonb,"serviceIds" jsonb,consent boolean,active boolean,status text,created timestamptz)
      ON CONFLICT DO NOTHING RETURNING id`,
    db`INSERT INTO hung_reminders (session_id,starts_at,email,status,attempted_at,sent_at)
      SELECT "sessionId","startAt",email,'sent',"sentAt","sentAt"
      FROM jsonb_to_recordset(${JSON.stringify(reminders)}::jsonb)
        AS r("sessionId" text,"startAt" timestamptz,email text,"sentAt" timestamptz)
      ON CONFLICT DO NOTHING RETURNING session_id`,
    db`WITH candidates AS (
      SELECT DISTINCT ON (item->>'id') item->>'id' AS id,item
      FROM jsonb_array_elements(${sessionData}::jsonb) AS item
      ORDER BY item->>'id'
    ), imported AS (
      INSERT INTO hung_legacy_zoom_imports (id) SELECT id FROM candidates
      ON CONFLICT DO NOTHING RETURNING id
    ), pending AS (
      SELECT candidates.item FROM candidates JOIN imported USING (id)
    )
    UPDATE hung_content SET data=data||(
      SELECT jsonb_agg(item) FROM pending
      WHERE NOT EXISTS (SELECT 1 FROM jsonb_array_elements(hung_content.data) AS saved WHERE saved->>'id'=item->>'id')
    ),revision=revision+1 WHERE section='zoom' AND EXISTS (
      SELECT 1 FROM pending
      WHERE NOT EXISTS (SELECT 1 FROM jsonb_array_elements(hung_content.data) AS saved WHERE saved->>'id'=item->>'id')
    ) RETURNING section`
  ];
  const [newLeads,newReminders,updated]=await db.transaction(queries);
  console.log("Đã nhập yêu cầu mới:",newLeads.length,"Mốc nhắc mới:",newReminders.length,"Lịch Zoom cập nhật:",Boolean(updated.length));
}
