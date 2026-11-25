import {z} from "zod";
import {db,json,mutationAllowed} from "../../../lib/crm-server";
import {readBoundedText,consumeLimit,requestFailure} from "../../../lib/requests";
export const dynamic="force-dynamic";
// Newsletter sign-up. Only runs when a visitor types their own email AND ticks consent.
const CONSENT="I agree to receive RIPEES news and updates by email. I can unsubscribe at any time.";
const schema=z.object({email:z.string().trim().toLowerCase().email().max(250),consent:z.literal(true),website:z.string().max(200).default(""),source:z.string().trim().max(40).default("website")});
export async function POST(req:Request){
  try{
    if(!mutationAllowed(req))return json({error:"Please submit from this website."},403);
    const p=schema.parse(JSON.parse(await readBoundedText(req,4000)));
    if(p.website)return json({ok:true}); // honeypot: bots fill this
    await consumeLimit(req,"subscribe",5,600000);
    await consumeLimit(req,"subscribe_daily",2000,86400000,true);
    const now=new Date().toISOString();
    const token=crypto.randomUUID().replaceAll("-","")+crypto.randomUUID().replaceAll("-","");
    // Re-subscribing after an unsubscribe re-opens the same row; duplicates are ignored quietly.
    await db().prepare("INSERT INTO subscribers (id,email,source,consent_text,unsubscribe_token,created_at,unsubscribed_at) VALUES (?,?,?,?,?,?,'') ON CONFLICT(email) DO UPDATE SET unsubscribed_at='',consent_text=excluded.consent_text,created_at=CASE WHEN subscribers.unsubscribed_at!='' THEN excluded.created_at ELSE subscribers.created_at END").bind(crypto.randomUUID(),p.email,p.source,CONSENT,token,now).run();
    return json({ok:true});
  }catch(e){
    const rejected=requestFailure(e);if(rejected)return rejected;
    if(e instanceof z.ZodError||e instanceof SyntaxError)return json({error:"Please enter a valid email and tick the box to agree."},400);
    console.error("Subscribe failed",e instanceof Error?e.name:"unknown");
    return json({error:"We could not sign you up. Please try again."},503);
  }
}
