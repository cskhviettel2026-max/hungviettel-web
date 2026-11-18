import { randomUUID } from "node:crypto";
import { priceText } from "../lib/site-data";
import { sql } from "./db";
import { HttpError } from "./http";
import type { Lead } from "./mail";
import { sheetClient } from "./sheets-client";

const title="YeuCauTuVanWeb";
const statusNames:Record<string,string>={new:"Mới",contacted:"Đã liên hệ",closed:"Đã xử lý"};
const emailNames:Record<string,string>={sent:"Đã gửi",failed:"Gửi lỗi",pending:"Chờ gửi",unconfigured:"Chưa cấu hình email",legacy:"Không có dữ liệu cũ"};
export async function exportLeads() {
  const id=process.env.GOOGLE_SHEETS_ID, credentials=process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if(!id||!credentials)throw new HttpError(503,"Chưa cấu hình Google Sheets.");
  const db=sql(), token=randomUUID();
  const [lock]=await db`INSERT INTO hung_export_lock (id,token,expires_at) VALUES (1,${token},now()+interval '90 seconds')
    ON CONFLICT (id) DO UPDATE SET token=excluded.token,expires_at=excluded.expires_at
    WHERE hung_export_lock.expires_at<now() RETURNING id`;
  if(!lock)throw new HttpError(409,"Đang có lượt xuất dữ liệu. Vui lòng thử lại sau.");
  try {
    const [google, leads]=await Promise.all([sheetClient(id,credentials),
      db`SELECT id,created_at,name,phone,email,company,products,quotes,consent,active,status,owner_email,customer_email FROM hung_leads ORDER BY created_at,id`]);
    const rows=[["Mã đăng ký","Thời gian (VN)","Họ tên","Điện thoại","Email","Đơn vị","Dịch vụ","Gói & giá","Đồng ý","Nhận Zoom","Trạng thái","Email anh Hùng","Email khách"]];
    for(const lead of leads as Lead[]){
      rows.push([lead.id,new Date(lead.created_at).toLocaleString("vi-VN",{timeZone:"Asia/Ho_Chi_Minh"}),lead.name,lead.phone,lead.email,lead.company,
        lead.products.join(", "),lead.quotes.map(quote=>quote.name+" · "+priceText(quote.price)).join("; "),
        lead.consent?"Có":"Không",lead.active?"Có":"Không",statusNames[lead.status]??lead.status,emailNames[lead.owner_email]??lead.owner_email,emailNames[lead.customer_email]??lead.customer_email]);
    }
    const metadata=await google("?fields=sheets.properties(sheetId,title,gridProperties)");
    const existing=metadata.sheets?.find((sheet:{properties:{title:string}})=>sheet.properties.title===title)?.properties;
    const used=new Set<number>(metadata.sheets?.map((sheet:{properties:{sheetId:number}})=>sheet.properties.sheetId));
    let sheetId=existing?.sheetId??7543191;
    while(!existing&&used.has(sheetId))sheetId++;
    const rowCount=Math.max(rows.length,existing?.gridProperties.rowCount??100);
    const columnCount=Math.max(rows[0].length,existing?.gridProperties.columnCount??rows[0].length);
    const gridProperties={rowCount,columnCount,frozenRowCount:1};
    const changes:unknown[]=[existing
      ? {updateSheetProperties:{properties:{sheetId,gridProperties},fields:"gridProperties(rowCount,columnCount,frozenRowCount)"}}
      : {addSheet:{properties:{sheetId,title,gridProperties}}}];
    changes.push({updateCells:{
      range:{sheetId,startRowIndex:0,endRowIndex:rowCount,startColumnIndex:0,endColumnIndex:rows[0].length},
      rows:rows.map(row=>({values:row.map(stringValue=>({userEnteredValue:{stringValue}}))})),
      fields:"userEnteredValue"
    }});
    await google(":batchUpdate",{requests:changes});
    return {count:leads.length,url:"https://docs.google.com/spreadsheets/d/"+id+"/edit#gid="+sheetId};
  }catch(error){
    console.error("Export Sheets",error instanceof Error ? error.message : "error");
    throw new HttpError(502,"Xuất Google Sheets thất bại. Kiểm tra quyền chia sẻ và cấu hình.");
  }finally{
    await db`DELETE FROM hung_export_lock WHERE id=1 AND token=${token}`;
  }
}
