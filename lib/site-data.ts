import { z } from "zod";
import seed from "./hung-seed.json" with { type: "json" };
import labels from "./hung-labels.json" with { type: "json" };

export const services = ["tendoo", "ca", "contract", "invoice", "bhxh", "ftth"] as const;
export type Service = (typeof services)[number];
export function isPriceService(id: string): id is Service {
  return (services as readonly string[]).includes(id);
}
export const serviceNames = Object.fromEntries(seed.serviceCatalog.map(item => [item.id, item.name])) as Record<Service,string>;
export const groups: Record<Service, Record<string,string>> = labels.groups;
const short = z.string().trim().max(240);
const long = z.string().trim().max(8000);
const name = short.min(1, "Vui lòng nhập tên.");
export const identifier = z.string().regex(/^[A-Za-z0-9_-]{1,100}$/, "Mã không hợp lệ.");
const base = { id: identifier, enabled: z.boolean() };
const lines = z.array(z.string().trim().max(600)).max(35);
export function secureUrl(value: string) {
  try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password; }
  catch { return false; }
}
const optionalUrl = z.string().trim().max(2000).refine(value => !value || secureUrl(value), "Dùng đường dẫn https.");
const image = z.string().max(2000).refine(value => !value || /^\/assets\/[\w.-]+$/.test(value) ||
  (secureUrl(value) && new URL(value).hostname.endsWith(".public.blob.vercel-storage.com") &&
  /^\/images\/[\w-]+\.webp$/.test(new URL(value).pathname)), "Vui lòng chọn ảnh hợp lệ.");
const serviceRef = z.union([identifier, z.literal("")]).default("");
const planFields = {
  ...base, name, price: z.number().int().nonnegative().max(1_000_000_000_000).nullable(),
  vatNote: short.default(""), details: lines.default([]),
  tableName: short.default(""), tableDetail: long.default("")
};
const plan = z.object(planFields);
const originals = (id: Service) => z.array(plan.extend({
  group: z.string().refine(group => Object.hasOwn(groups[id],group), "Chọn nhóm gói."),
  tableIndex: z.number().int().nonnegative().default(0)
}).transform(item => ({...item, tableIndex: id === "ftth" ? 0 : Number(item.group)}))).max(400)
  .refine(uniqueIds, "Mã gói bị trùng.");

function uniqueIds(items: {id:string}[]) {
  return new Set(items.map(item => item.id)).size === items.length;
}

export function videoSource(value: string) {
  const idPattern = /^[\w-]{11}$/;
  const playlistPattern = /^[\w-]{12,100}$/;
  if (idPattern.test(value)) return { kind:"youtube", embed:"https://www.youtube.com/embed/" + value, url:"https://www.youtube.com/watch?v=" + value };
  if (!secureUrl(value)) return null;
  const url = new URL(value);
  if (url.pathname.toLowerCase().endsWith(".mp4")) return {kind:"mp4", embed:value, url:value};
  if (!["www.youtube.com","youtube.com","m.youtube.com","youtu.be","www.youtube-nocookie.com"].includes(url.hostname)) return null;
  const parts = url.pathname.split("/");
  const list = url.searchParams.get("list");
  if (list && playlistPattern.test(list)) return {kind:"youtube", embed:"https://www.youtube.com/embed/videoseries?list=" + list, url:"https://www.youtube.com/playlist?list=" + list};
  const id = url.hostname === "youtu.be" ? parts[1] : (url.searchParams.get("v") ?? parts[2] ?? "");
  return idPattern.test(id) ? {kind:"youtube", embed:"https://www.youtube.com/embed/" + id, url:"https://www.youtube.com/watch?v=" + id} : null;
}

const catalog = z.object({
  ...base, name, slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(90), category: short.default(""),
  description: long.default(""), points: lines.default([]), official: optionalUrl.default(""), image: image.default(""),
  detailTitle: short.default(""), detailIntro: long.default(""), detailContent: long.default("")
});
const list = <T extends z.ZodType<{id:string}, z.ZodTypeDef, any>>(schema: T, max = 100) =>
  z.array(schema).max(max).refine(uniqueIds, "Mã mục bị trùng.");

export const contentSchemas = {
  contact:z.object({
    name, role:short, hotline:z.string().regex(/^\+?[\d ().-]{8,24}$/).refine(value=>value.replace(/\D/g,"").length>=8,"Kiểm tra hotline."),
    address:short, email:z.union([z.string().email().max(254),z.literal("")]), portrait:image, ticker:long.transform(value=>value||seed.contact.ticker).default(seed.contact.ticker)
  }),
  media:z.object({products:z.object({tendoo:image, ca:image, contract:image, invoice:image, bhxh:image, ftth:image})}),
  visibility:z.object({gallery:z.boolean(), videos:z.boolean(), faq:z.boolean()}),
  gallery:list(z.object({...base,title:name,subtitle:short,description:long,details:lines,image,service:serviceRef})),
  videos:list(z.object({...base,title:name,link:optionalUrl.or(z.string().regex(/^[\w-]{11}$/)).refine(value => videoSource(value)!==null,"Link hoặc ID video không hợp lệ."),service:serviceRef})),
  faq:list(z.object({...base,q:name,a:long.min(1)})),
  blocks:list(z.object({...base,title:name,description:long,image}),50),
  pageContent:z.record(z.record(z.record(z.string().max(8000)))),
  serviceCatalog:list(catalog).refine(items=>new Set(items.map(item=>item.slug)).size===items.length,"Đường dẫn dịch vụ bị trùng."),
  prices:z.object({tendoo:originals("tendoo"), ca:originals("ca"), contract:originals("contract"), invoice:originals("invoice"), bhxh:originals("bhxh"), ftth:originals("ftth")}),
  customPlans:list(plan.extend({serviceId:identifier}),400),
};
export type ContentKey = keyof typeof contentSchemas;
export type SiteContent = {[K in ContentKey]: z.infer<(typeof contentSchemas)[K]>};
export const defaults = Object.fromEntries(Object.entries(contentSchemas).map(([key,schema]) =>
  [key,schema.parse(seed[key as ContentKey])])) as SiteContent;
export function addressTicker(contact: Pick<SiteContent["contact"],"address"|"hotline">) {
  return [contact.address, "Điện thoại: "+contact.hotline].filter(Boolean).join(" · ");
}
export type CatalogItem = SiteContent["serviceCatalog"][number];
export type Plan = SiteContent["prices"][Service][number] | SiteContent["customPlans"][number];
export function catalogUrl(item: CatalogItem) {
  return isPriceService(item.id) ? "/san-pham-" + item.id + ".html" : "/dich-vu/" + item.slug;
}
export function plansFor(data: SiteContent, id: string): Plan[] {
  return isPriceService(id) ? data.prices[id] : data.customPlans.filter(item=>item.serviceId===id);
}
export const priceText = (price:number|null) => price===null ? "Liên hệ báo giá" : new Intl.NumberFormat("vi-VN").format(price) + " ₫";
export type MediaImagePath = "products.tendoo"|"products.ca"|"products.contract"|"products.invoice"|"products.bhxh"|"products.ftth";
export const mediaImagePaths = ["products.tendoo","products.ca","products.contract","products.invoice","products.bhxh","products.ftth"] as const;
export function mediaImageValue(media:SiteContent["media"], path:MediaImagePath) {
  return media.products[path.slice(9) as Service];
}
export function replaceMediaImage(media:SiteContent["media"], path:MediaImagePath, value:string) {
  return {...media,products:{...media.products,[path.slice(9)]:value}};
}
