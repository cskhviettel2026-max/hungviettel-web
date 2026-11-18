import { hash } from "./http";
import { readContent, sql } from "./db";
import { deliverLead, mailReady, sendMail } from "./mail";

export async function processReminders(now=new Date()) {
  const {data}=await readContent();
  const db=sql();
  const sessions=data.zoom.filter(session=>{
    const starts=Date.parse(session.startAt);
    return session.enabled&&now.getTime()>=starts-30*60_000&&now.getTime()<starts;
  });
  let sent=0, failed=0;
  if(!mailReady())return {sessions:sessions.length,sent,failed,configured:false};
  for(const session of sessions) {
    if(Date.now()>=Date.parse(session.startAt))continue;
    const rows=await db`WITH eligible AS (
      SELECT DISTINCT ON (lower(lead.email)) lower(lead.email) AS email, lead.name
      FROM hung_leads AS lead
      WHERE lead.active AND lead.consent AND lead.email <> ''
        AND (jsonb_array_length(${JSON.stringify(session.products)}::jsonb)=0
          OR lead.service_ids ?| ARRAY(SELECT jsonb_array_elements_text(${JSON.stringify(session.products)}::jsonb)))
        AND NOT EXISTS (
          SELECT 1 FROM hung_reminders AS rem WHERE rem.session_id=${session.id}
            AND rem.starts_at=${session.startAt}::timestamptz AND rem.email=lower(lead.email)
            AND (rem.status='sent' OR rem.attempted_at > now()-interval '90 seconds')
        )
      ORDER BY lower(lead.email),lead.created_at DESC,lead.id DESC LIMIT 25
    ), claimed AS (
      INSERT INTO hung_reminders (session_id,starts_at,email,status)
      SELECT ${session.id},${session.startAt}::timestamptz,email,'sending' FROM eligible
      WHERE now() < ${session.startAt}::timestamptz
      ON CONFLICT (session_id,starts_at,email) DO UPDATE SET status='sending',attempted_at=now()
      WHERE hung_reminders.status<>'sent' AND hung_reminders.attempted_at<=now()-interval '90 seconds'
      RETURNING email
    )
    SELECT claimed.email, eligible.name FROM claimed JOIN eligible USING (email)`;
    await Promise.all(rows.map(async row=>{
      if(Date.now()>=Date.parse(session.startAt))return;
      const due=new Date(session.startAt).toLocaleString("vi-VN",{timeZone:"Asia/Ho_Chi_Minh"});
      const text=["Chào "+row.name+",","Buổi hướng dẫn sắp bắt đầu: "+session.title,
        "Thời gian: "+due+" (giờ Việt Nam)","Tham gia Zoom: "+session.link,"Hotline: "+data.contact.hotline].join("\n");
      const result=await sendMail(row.email,"Nhắc lịch Zoom · "+session.title,text,
        "hung-zoom/"+hash(session.id+"|"+session.startAt+"|"+row.email));
      await db`UPDATE hung_reminders SET status=${result.status},email_id=${result.id},
        sent_at=CASE WHEN ${result.status}='sent' THEN now() ELSE NULL END
        WHERE session_id=${session.id} AND starts_at=${session.startAt}::timestamptz AND email=${row.email}`;
      if(result.status==="sent")sent++;else failed++;
    }));
  }

  // Recover a pending confirmation when a request ended before its background work ran.
  const pending=await db`SELECT id FROM hung_leads
    WHERE (owner_email='pending' OR customer_email='pending') AND submission_hash IS NOT NULL
      AND created_at > now()-interval '23 hours' AND created_at < now()-interval '1 minute'
      AND (mail_claimed_at IS NULL OR mail_claimed_at < now()-interval '2 minutes')
    ORDER BY created_at LIMIT 15`;
  await Promise.all(pending.map(row=>deliverLead(row.id,data.contact)));
  return {sessions:sessions.length,sent,failed,configured:true};
}
