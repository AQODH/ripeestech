import {db,noCache} from "../../../lib/crm-server";
export const dynamic="force-dynamic";
// Link to put at the bottom of every newsletter: https://YOUR-SITE/api/unsubscribe?t=<unsubscribe_token>
const page=(msg:string,status=200)=>new Response(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>RIPEES newsletter</title><body style="font:16px system-ui;background:#06122e;color:#eaf1ff;display:grid;place-items:center;min-height:100vh;margin:0"><p style="max-width:420px;padding:24px;text-align:center">${msg}<br><br><a style="color:#5ee6e6" href="/">Back to RIPEES</a></p>`,{status,headers:{...noCache,"Content-Type":"text/html; charset=utf-8"}});
export async function GET(req:Request){
  const t=new URL(req.url).searchParams.get("t")||"";
  if(!/^[a-f0-9]{64}$/.test(t))return page("This unsubscribe link is not valid.",400);
  try{
    await db().prepare("UPDATE subscribers SET unsubscribed_at=? WHERE unsubscribe_token=? AND unsubscribed_at=''").bind(new Date().toISOString(),t).run();
    return page("You are unsubscribed. You will not get more newsletters from us.");
  }catch{return page("Something went wrong. Please try again.",503)}
}
