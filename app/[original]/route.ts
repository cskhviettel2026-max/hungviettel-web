import { services } from "../../lib/site-data";
import { renderSite } from "../../server/site";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, {params}: {params:Promise<{original:string}>}) {
  const {original}=await params;
  if(original==="index.html")return renderSite("index");
  const id=services.find(service=>original==="san-pham-"+service+".html");
  return id ? renderSite("san-pham-"+id) : new Response("Không tìm thấy trang.",{status:404});
}
