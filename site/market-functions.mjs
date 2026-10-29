import fs from "node:fs";
let admin=fs.readFileSync("app/api/admin/route.ts","utf8");
admin='import {readBoundedText,requestFailure} from "../../../lib/requests";\n'+admin;
admin=admin.replace('const raw=await req.text();','const raw=await readBoundedText(req,2000000);');
admin=admin.replace('catch(e){if(e instanceof z.ZodError','catch(e){const rejected=requestFailure(e);if(rejected)return rejected;if(e instanceof z.ZodError');
admin=admin.replace('SELECT * FROM leads ORDER BY created_at DESC','SELECT * FROM leads ORDER BY created_at DESC,id DESC LIMIT 50');
admin=admin.replace('return json({...content,products,leads,','const totals=await db().prepare("SELECT COUNT(*) AS total,SUM(status=\'new\') AS new,SUM(status=\'qualified\') AS qualified FROM leads").first<any>();return json({...content,products,leads,leadTotals:{total:Number(totals?.total||0),new:Number(totals?.new||0),qualified:Number(totals?.qualified||0)},');
const start=admin.indexOf('if(data.action==="product"){'),end=admin.indexOf('if(data.action==="deleteProduct")',start);
if(start<0||end<0)throw Error("Product action not found");
admin=admin.slice(0,start)+'if(data.action==="product"){const p=productSchema.parse(data.product);validateLinks(p);if(p.id){const result=await db().prepare("UPDATE products SET name=?,summary=?,description=?,category=?,status=?,price=?,features=?,url=?,image=?,sort_order=?,updated_at=? WHERE id=? AND updated_at=?").bind(p.name.trim(),p.summary.trim(),p.description,p.category,p.status,p.price,p.features,p.url,p.image,p.sort_order,now,p.id,p.updated_at??"").run();if(!result.meta.changes)return json({error:"This product changed elsewhere. Reload before saving."},409);}else{await productStatement(p,now).run();}return json({ok:true});}\n'+admin.slice(end);
admin=admin.replace('if(settings.logo&&!safeUrl(settings.logo))','if(settings.heroImage&&!safeUrl(settings.heroImage))return json({error:"Hero image must use HTTPS or an /assets/ path."},400);if(settings.logo&&!safeUrl(settings.logo))');
fs.writeFileSync("app/api/admin/route.ts",admin);

let chat=fs.readFileSync("app/api/chat/route.ts","utf8");
chat='import {readBoundedText,consumeLimit,requestFailure,limitValue} from "../../../lib/requests";\n'+chat;
chat=chat.replace('mutationAllowed,readContent,readProducts','mutationAllowed,readContent,readChatProducts');
const a=chat.indexOf('async function throttle('),b=chat.indexOf('export async function POST',a);
chat=chat.slice(0,a)+'async function throttle(req:Request){await consumeLimit(req,"chat",limitValue((env as any).CHAT_RATE_LIMIT,15,1,120),60000);await consumeLimit(req,"chat_daily",limitValue((env as any).CHAT_DAILY_LIMIT,500,1,100000),86400000,true);return true;}\n'+chat.slice(b);
chat=chat.replace('const raw=await req.text();','const raw=await readBoundedText(req,32000);').replace('if(raw.length>24000)','if(raw.length>32000)');
chat=chat.replace('const products:any[]=await readProducts(true);const faqs=parseFaq(s.chat_faq);const question=messages.at(-1)!.content;','const question=messages.at(-1)!.content;const retrievalQuery=messages.filter(m=>m.role==="user").map(m=>m.content).join(" ").slice(-8000);const products:any[]=await readChatProducts(retrievalQuery);const faqs=parseFaq(s.chat_faq);');
chat=chat.replace('catch(e){if(e instanceof z.ZodError','catch(e){const rejected=requestFailure(e);if(rejected)return rejected;if(e instanceof z.ZodError');
fs.writeFileSync("app/api/chat/route.ts",chat);

let shared=fs.readFileSync("lib/crm-server.ts","utf8");shared+='\nexport async function readChatProducts(question:string){const result=await db().prepare("SELECT id,name,summary,description,category,status,price,features,url FROM products WHERE status != \'draft\' ORDER BY CASE WHEN instr(lower(?),lower(name))>0 THEN 0 ELSE 1 END,sort_order ASC,created_at DESC LIMIT 30").bind(question).all();return result.results;}\n';fs.writeFileSync("lib/crm-server.ts",shared);

let ui=fs.readFileSync("app/admin/workspace.tsx","utf8");
ui=ui.replace('import ChatbotPanel from "./chatbot-panel";','import ChatbotPanel from "./chatbot-panel";\nimport LeadInbox from "./lead-inbox";');
ui=ui.replace('ownerName:string;storageMode?','ownerName:string;leadTotals?:{total:number;new:number;qualified:number};storageMode?');
ui=ui.replaceAll('data.leads.filter(l=>l.status==="new").length','(data.leadTotals?.new??data.leads.filter(l=>l.status==="new").length)');
ui=ui.replaceAll('data.leads.filter(l=>l.status==="qualified").length','(data.leadTotals?.qualified??data.leads.filter(l=>l.status==="qualified").length)');
const la=ui.indexOf('{tab==="leads"&&'),lb=ui.indexOf('{tab==="chatbot"&&',la);
if(la<0||lb<0)throw Error("Enquiry tab not found");
ui=ui.slice(0,la)+'{tab==="leads"&&<LeadInbox onOpen={l=>{setLead(l);setDirty(false)}} refreshKey={data.leads.map(l=>l.updated_at).join("|")}/>}\n '+ui.slice(lb);
const hook=' const dirtyRef=useRef(dirty);dirtyRef.current=dirty;const modalOpen=Boolean(product||lead||deleteTarget);\n useEffect(()=>{if(!modalOpen)return;const previous=document.activeElement as HTMLElement;const modal=document.querySelector(".editor-modal") as HTMLElement|null;if(!modal)return;const oldOverflow=document.body.style.overflow;document.body.style.overflow="hidden";const focusable=()=>Array.from(modal.querySelectorAll<HTMLElement>(\'button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),a[href]\'));focusable()[0]?.focus();const handler=(e:KeyboardEvent)=>{if(e.key==="Escape"){e.preventDefault();if(dirtyRef.current&&!confirm("Discard unsaved changes?"))return;setProduct(null);setLead(null);setDeleteTarget(null);setDirty(false);}if(e.key==="Tab"){const items=focusable();const first=items[0],last=items.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus()}}};modal.addEventListener("keydown",handler);return()=>{document.body.style.overflow=oldOverflow;modal.removeEventListener("keydown",handler);if(previous?.isConnected)previous.focus()};},[modalOpen]);\n';
ui=ui.replace(' const importRef=',hook+' const importRef=');
fs.writeFileSync("app/admin/workspace.tsx",ui);

let local=fs.readFileSync("scripts/local-server.mjs","utf8");
local=local.replace('export * as chat from "./app/api/chat/route.ts";','export * as chat from "./app/api/chat/route.ts";export * as leads from "./app/api/leads/route.ts";');
local=local.replace('else if(url.pathname==="/api/enquiries"','else if(url.pathname==="/api/leads"&&method==="GET")response=await routes.leads.GET(request);\n   else if(url.pathname==="/api/enquiries"');
fs.writeFileSync("scripts/local-server.mjs",local);

