import {db,json,owner,noCache} from "../../../lib/crm-server";
import {requestFailure} from "../../../lib/requests";
export const dynamic="force-dynamic";
// Owner-only CSV of people who opted in (and are not unsubscribed). Open in Excel or paste into your mailer.
const cell=(v:string)=>{const s=/^[=+\-@\t\r]/.test(v)?"'"+v:v;return '"'+s.replaceAll('"','""')+'"'};
export async function GET(req?:Request){
  try{
    if(!await owner())return json({error:"Owner sign-in is required."},403);
    if(req&&new URL(req.url).searchParams.get("format")==="json"){
      const counts=await db().prepare("SELECT COUNT(*) AS total, SUM(CASE WHEN unsubscribed_at='' THEN 1 ELSE 0 END) AS active FROM subscribers").first<{total:number;active:number|null}>();
      const {results:items}=await db().prepare("SELECT email,source,created_at,unsubscribed_at FROM subscribers ORDER BY created_at DESC LIMIT 200").all();
      return json({items,total:Number(counts?.total||0),active:Number(counts?.active||0)});
    }
    const {results}=await db().prepare("SELECT email,source,created_at,unsubscribed_at FROM subscribers ORDER BY created_at DESC LIMIT 50001").all<{email:string;source:string;created_at:string;unsubscribed_at:string}>();
    if(results.length>50000)return json({error:"Too many rows for one export. Use a D1 export."},413);
    const lines=["email,source,subscribed_at,status",...results.map(r=>[cell(r.email),cell(r.source),cell(r.created_at),r.unsubscribed_at?"unsubscribed":"active"].join(","))];
    return new Response(lines.join("\r\n"),{headers:{...noCache,"Content-Type":"text/csv; charset=utf-8","Content-Disposition":'attachment; filename="ripees-subscribers.csv"'}});
  }catch(e){return requestFailure(e)??json({error:"Could not export subscribers."},503)}
}
