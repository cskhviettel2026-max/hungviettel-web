import { groups, services, type Service } from "./site-data";
type Option = readonly [string,string];
export type Field = {key:string;label:string;kind?:"text"|"area"|"lines"|"number"|"check"|"select"|"image";options?:readonly Option[];optional?:boolean;nullable?:boolean};
const field=(key:string,label:string,kind?:Field["kind"]):Field=>({key,label,kind});
export const contactFields = [
  field("name","Tên chuyên viên"),field("role","Chức danh"),field("hotline","Hotline"),field("address","Địa chỉ"),
  {...field("email","Email nhận tư vấn"),optional:true},field("portrait","Ảnh đại diện","image"),field("ticker","Dòng chữ chạy giới thiệu","area")
];
export const visibilityFields = [field("gallery","Hiển thị banner và thư viện ảnh","check"),field("videos","Hiển thị video","check"),field("faq","Hiển thị FAQ","check")];
export const catalogFields = [
  field("name","Tên dịch vụ"),field("slug","Đường dẫn trang (để trống để tự tạo)"),field("category","Nhóm dịch vụ"),
  field("description","Giới thiệu ngắn","area"),field("points","Lợi ích (mỗi dòng một mục)","lines"),field("official","Link Viettel"),
  {...field("image","Ảnh dịch vụ","image"),optional:true},field("detailTitle","Tiêu đề trang chi tiết"),
  field("detailIntro","Đoạn mở đầu trang chi tiết","area"),field("detailContent","Nội dung trang chi tiết","area")
];
export const customPlanFields:Field[] = [
  field("name","Tên gói"),{...field("price","Giá (đ)","number"),nullable:true},field("vatNote","Ghi chú thuế"),
  field("details","Chi tiết (mỗi dòng một mục)","lines"),field("tableName","Tên riêng trong bảng giá"),field("tableDetail","Chi tiết trong bảng giá","area")
];
export const priceFields = Object.fromEntries(services.map(id=>[id,[...customPlanFields,
  {...field("group","Nhóm báo giá","select"),options:Object.entries(groups[id])}
]])) as Record<Service,Field[]>;
export const listFields = {
  gallery:[field("title","Tiêu đề"),field("subtitle","Tiêu đề phụ"),field("description","Mô tả","area"),field("details","Chi tiết (mỗi dòng một mục)","lines"),field("service","Dịch vụ","select"),{...field("image","Ảnh banner","image"),optional:true}],
  videos:[field("title","Tiêu đề video"),field("link","Link hoặc ID YouTube, playlist, MP4"),field("service","Dịch vụ","select")],
  faq:[field("q","Câu hỏi"),field("a","Trả lời","area")],
  blocks:[field("title","Tiêu đề"),field("description","Nội dung","area"),{...field("image","Ảnh minh họa","image"),optional:true}],
};
