import { timingSafeEqual } from "node:crypto";
import { failure, hash, HttpError } from "../../../../server/http";
import { processReminders } from "../../../../server/zoom";

export const maxDuration=55;
export async function POST(request:Request) {
  try {
    const secret=process.env.ZOOM_TRIGGER_SECRET;
    const auth=request.headers.get("authorization")??"";
    if(!secret||secret.length<32)throw new HttpError(503,"Chưa cấu hình trigger Zoom.");
    if(!timingSafeEqual(Buffer.from(hash(auth)),Buffer.from(hash("Bearer "+secret))))throw new HttpError(401,"Không có quyền chạy trigger.");
    return Response.json(await processReminders());
  }catch(error){return failure(error);}
}
