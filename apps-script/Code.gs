function runZoomReminders() {
  const properties = PropertiesService.getScriptProperties();
  const url = properties.getProperty("ZOOM_TRIGGER_URL");
  const secret = properties.getProperty("ZOOM_TRIGGER_SECRET");
  if (!url || !secret) throw new Error("Cần cấu hình ZOOM_TRIGGER_URL và ZOOM_TRIGGER_SECRET.");
  const headers = { Authorization: "Bearer " + secret };
  const previewBypass = properties.getProperty("VERCEL_AUTOMATION_BYPASS_SECRET");
  if (previewBypass) headers["x-vercel-protection-bypass"] = previewBypass;
  const response = UrlFetchApp.fetch(url, {
    method: "post",
    headers: headers,
    muteHttpExceptions: true,
    followRedirects: false
  });
  if (response.getResponseCode() !== 200) throw new Error("Endpoint Zoom trả HTTP " + response.getResponseCode());
}

function installZoomTrigger() {
  for (const trigger of ScriptApp.getProjectTriggers()) {
    if (trigger.getHandlerFunction() === "runZoomReminders") ScriptApp.deleteTrigger(trigger);
  }
  ScriptApp.newTrigger("runZoomReminders").timeBased().everyMinutes(1).create();
}
