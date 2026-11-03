import type {ProductRecord} from "./models";
import { env } from "cloudflare:workers";
import { currentAccessOwner } from "./access-owner";
import { getChatGPTUser } from "../app/chatgpt-auth";
import { defaults } from "./content";
export const noCache={"Cache-Control":"no-store","X-Content-Type-Options":"nosniff","Referrer-Policy":"strict-origin-when-cross-origin"};
export function db(){if(!env.DB)throw new Error("Database unavailable");return env.DB;}
export async function owner(){
  // Only the in-process simulator/test binding supplies a JavaScript function.
  if (typeof env.RIPEES_LOCAL_AUTH === "function" && env.RIPEES_LOCAL_AUTH()) {
    if (env.RIPEES_TRUST_IDENTITY_HEADERS !== "true") return null;
    const user = await getChatGPTUser();
    return user && user.email.toLowerCase() === env.RIPEES_ADMIN_EMAIL?.toLowerCase() ? user : null;
  }
  return currentAccessOwner();
}
export function mutationAllowed(req:Request){const origin=req.headers.get("origin");return (!origin||origin===new URL(req.url).origin)&&req.headers.get("sec-fetch-site")!=="cross-site";}
export async function readContent(){const row=await db().prepare("SELECT value,revision FROM site_content WHERE id='website'").first<{value:string;revision:number}>();return {settings:{...defaults,...(row?JSON.parse(row.value):{})},revision:row?.revision??0};}
export async function readProducts(publicOnly=false){const result=await db().prepare("SELECT * FROM products"+(publicOnly?" WHERE status != 'draft'":"")+" ORDER BY sort_order ASC, created_at DESC").all<ProductRecord>();return result.results;}
export function json(data:unknown,status=200){return Response.json(data,{status,headers:noCache});}


export function aiConfigured(){return env.RIPEES_ENABLE_AI==="true"&&Boolean(env.OPENAI_API_KEY&&env.OPENAI_CHAT_MODEL);}

export async function readChatProducts(question:string){const result=await db().prepare("SELECT id,name,summary,description,category,status,price,features,url FROM products WHERE status != 'draft' ORDER BY CASE WHEN instr(lower(?),lower(name))>0 THEN 0 ELSE 1 END,sort_order ASC,created_at DESC LIMIT 30").bind(question).all<ProductRecord>();return result.results;}
