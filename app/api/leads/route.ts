import { checkExportCount, EXPORT_LIMIT, likePattern, pagedExport } from "../../../lib/crm-transfer";
import { requestFailure } from "../../../lib/requests";
import type {LeadRecord} from "../../../lib/models";
import {z} from "zod";
import {db,owner,json,noCache} from "../../../lib/crm-server";
export const dynamic="force-dynamic";
const status=z.enum(["new","contacted","qualified","won","closed"]);
function filter(req:Request){const url=new URL(req.url),q=(url.searchParams.get("q")||"").trim(),s=url.searchParams.get("status")||"";const conditions:string[]=[],values:string[]=[];if(s){if(!status.safeParse(s).success)throw Error("Invalid status");conditions.push("status=?");values.push(s);}if(q){conditions.push("(name LIKE ? ESCAPE '\\' OR company LIKE ? ESCAPE '\\' OR email LIKE ? ESCAPE '\\' OR interest LIKE ? ESCAPE '\\')");const match=likePattern(q);values.push(match,match,match,match);}return {url,conditions,values};}
const csv=(v:unknown)=>{let t=String(v??"");if(/^\s*[=+@-]/.test(t))t="'"+t;return '"'+t.replace(/"/g,'""')+'"';};
export async function GET(req:Request){try{if(!await owner())return json({error:"Owner sign-in is required."},403);const {url,conditions,values}=filter(req);const baseWhere=conditions.length?" WHERE "+conditions.join(" AND "):"";
if (url.searchParams.get("format") === "csv") {
  const database = db();
  const count = await database.prepare("SELECT COUNT(*) AS count FROM (SELECT 1 FROM leads" + baseWhere + " LIMIT ?)")
    .bind(...values, EXPORT_LIMIT + 1).first<{count: number}>();
  checkExportCount(Number(count?.count || 0));
  const stream = pagedExport<LeadRecord>(
    "\uFEFF" + ["Name","Email","Phone","Company","Interest","Status","Message","Notes","Created"].map(csv).join(",") + "\r\n",
    "",
    async (after, size) => {
      const extra = after ? (baseWhere ? " AND " : " WHERE ") + "(created_at < ? OR (created_at=? AND id<?))" : "";
      const args = after ? [...values, after.created_at, after.created_at, after.id, size] : [...values, size];
      return (await database.prepare("SELECT * FROM leads" + baseWhere + extra +
        " ORDER BY created_at DESC,id DESC LIMIT ?").bind(...args).all<LeadRecord>()).results;
    },
    rows => rows.map(l => [l.name,l.email,l.phone,l.company,l.interest,l.status,l.message,l.notes,l.created_at]
      .map(csv).join(",")).join("\r\n") + "\r\n",
  );
  return new Response(stream, {headers:{...noCache,"Content-Type":"text/csv; charset=utf-8",
    "Content-Disposition":'attachment; filename="ripees-enquiries.csv"'}});
}
const cursor=url.searchParams.get("cursor");if(cursor){if(cursor.length>250)return json({error:"Invalid page."},400);let c:{created_at:string;id:string};try{c=z.object({created_at:z.string().datetime(),id:z.string().uuid()}).parse(JSON.parse(atob(cursor)));}catch{return json({error:"Invalid page. Return to the first page."},400)}conditions.push("(created_at < ? OR (created_at=? AND id<?))");values.push(c.created_at,c.created_at,c.id);}
const countArgs=cursor?values.slice(0,-3):values;const total=await db().prepare("SELECT COUNT(*) AS total FROM leads"+baseWhere).bind(...countArgs).first<{total:number}>();const where=conditions.length?" WHERE "+conditions.join(" AND "):"";const rows=(await db().prepare("SELECT * FROM leads"+where+" ORDER BY created_at DESC,id DESC LIMIT 51").bind(...values).all()).results as LeadRecord[];const items=rows.slice(0,50),last=items.at(-1);return json({items,total:Number(total?.total||0),nextCursor:rows.length>50&&last?btoa(JSON.stringify({created_at:last.created_at,id:last.id})):null});
}catch(e){const failure=requestFailure(e);if(failure)return failure;if(e instanceof Error&&e.message==="Invalid status")return json({error:"Choose a valid status."},400);console.error("Enquiry list unavailable");return json({error:"Could not load enquiries. Please retry."},503)}}

