import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import {AsyncLocalStorage} from "node:async_hooks";
import {fileURLToPath,pathToFileURL} from "node:url";
import {DatabaseSync} from "node:sqlite";
import {createRequire} from "node:module";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
process.chdir(root);
if(fs.existsSync(path.join(root,".env.local")))process.loadEnvFile(path.join(root,".env.local"));
if(fs.existsSync(path.join(root,".dev.vars")))process.loadEnvFile(path.join(root,".dev.vars"));
let dependencyRoot=root;try{const saved=JSON.parse(fs.readFileSync(path.join(root,".local","dependencies.json"),"utf8"));if(typeof saved.root==="string"&&fs.existsSync(path.join(saved.root,"node_modules","esbuild")))dependencyRoot=saved.root;}catch{}
const dependencyRequire=createRequire(path.join(dependencyRoot,"package.json"));
const {build}=dependencyRequire("esbuild");
const nodePaths=[path.join(dependencyRoot,"node_modules")];
const argPort=process.argv.indexOf("--port");
const port=Number(argPort>=0?process.argv[argPort+1]:process.env.PORT||4173);
if(!Number.isInteger(port)||port<1024||port>65535)throw Error("Choose a port between 1024 and 65535.");
const origin="http://127.0.0.1:"+port;
const dataDir=path.join(root,".local");
const runtimeDir=path.join(root,".sites-runtime","local-app");
fs.mkdirSync(dataDir,{recursive:true});
fs.mkdirSync(runtimeDir,{recursive:true});
const sqlite=new DatabaseSync(path.join(dataDir,"ripees.sqlite"));
sqlite.exec("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;");
sqlite.exec("CREATE TABLE IF NOT EXISTS local_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)");
for(const name of fs.readdirSync(path.join(root,"drizzle")).filter(n=>n.endsWith(".sql")).sort()){
 if(sqlite.prepare("SELECT name FROM local_migrations WHERE name=?").get(name))continue;
 sqlite.exec("BEGIN");
 try{
  sqlite.exec(fs.readFileSync(path.join(root,"drizzle",name),"utf8"));
  if(name==="0005_admin_authentication.sql"){
   for(const table of ["admin_setup_tokens","admin_recovery_codes"]){
    const columns=sqlite.prepare(`PRAGMA table_info("${table}")`).all();
    if(columns.length&&!columns.some(column=>column.name==="claim_id"))sqlite.exec(`ALTER TABLE "${table}" ADD COLUMN claim_id TEXT`);
   }
  }
  sqlite.prepare("INSERT INTO local_migrations VALUES (?,?)").run(name,new Date().toISOString());
  sqlite.exec("COMMIT");
 }
 catch(error){sqlite.exec("ROLLBACK");throw error;}
}
const database={prepare(sql){let values=[];return {
 bind(...args){values=args;return this},
 async first(column){const result=sqlite.prepare(sql).get(...values);return column?(result?.[column]??null):(result??null)},
 async all(){return {results:sqlite.prepare(sql).all(...values),success:true}},
 async run(){const r=sqlite.prepare(sql).run(...values);return {success:true,meta:{changes:r.changes,last_row_id:Number(r.lastInsertRowid)}}}
}},async batch(statements){sqlite.exec("BEGIN");try{const results=[];for(const statement of statements)results.push(await statement.run());sqlite.exec("COMMIT");return results}catch(error){sqlite.exec("ROLLBACK");throw error}}};
const context=new AsyncLocalStorage();
globalThis.__ripeesLocalContext=context;
globalThis.__ripeesLocalEnv={DB:database,RIPEES_ADMIN_EMAILS:process.env.RIPEES_ADMIN_EMAILS,RIPEES_AUTH_PEPPER:process.env.RIPEES_AUTH_PEPPER,RIPEES_ENABLE_AI:process.env.RIPEES_ENABLE_AI,OPENAI_API_KEY:process.env.OPENAI_API_KEY,OPENAI_CHAT_MODEL:process.env.OPENAI_CHAT_MODEL,CHAT_AI_DAILY_LIMIT:process.env.CHAT_AI_DAILY_LIMIT};
const plugins=[{name:"ripees-local-bindings",setup(b){
 b.onResolve({filter:/^cloudflare:workers$/},()=>({path:"workers",namespace:"local"}));
 b.onResolve({filter:/^next\/headers$/},()=>({path:"headers",namespace:"local"}));
 b.onResolve({filter:/^next\/navigation$/},()=>({path:"navigation",namespace:"local"}));
 b.onResolve({filter:/^next\/link$/},()=>({path:"link",namespace:"local"}));
 b.onLoad({filter:/.*/,namespace:"local"},args=>({contents:args.path==="workers"?"export const env=globalThis.__ripeesLocalEnv;":args.path==="headers"?"export async function headers(){return globalThis.__ripeesLocalContext.getStore()?.headers||new Headers();}":args.path==="link"?'import {createElement} from "react"; export default function Link(props){return createElement("a",props);}':"export function redirect(url){throw new Error('Unexpected server redirect: '+url);} export function usePathname(){return window.location.pathname;} export function useRouter(){return {push(url){window.location.assign(url)},replace(url){window.location.replace(url)}};}"}));
 b.onResolve({filter:/\.html\?raw$/},args=>({path:path.resolve(args.resolveDir,args.path.replace("?raw","")),namespace:"raw"}));
 b.onLoad({filter:/.*/,namespace:"raw"},args=>({contents:fs.readFileSync(args.path,"utf8"),loader:"text"}));
}}];
console.log("Preparing RIPEES website, CRM and chatbot…");
await build({stdin:{contents:'export * as admin from "./app/api/admin/route.ts";export * as adminAuth from "./app/api/admin-auth/route.ts";export * as enquiries from "./app/api/enquiries/route.ts";export * as website from "./app/website/route.ts";export * as chat from "./app/api/chat/route.ts";export * as leads from "./app/api/leads/route.ts";export * as backup from "./app/api/backup/route.ts";export * as feedback from "./app/api/chat-feedback/route.ts";export * as insights from "./app/api/chat-insights/route.ts";export * as terms from "./app/terms/route.ts";export * as privacy from "./app/privacy/route.ts";',resolveDir:root},bundle:true,nodePaths,platform:"node",format:"esm",outfile:path.join(runtimeDir,"server.mjs"),plugins,logLevel:"warning"});
await build({stdin:{contents:'import {createRoot} from "react-dom/client";import Workspace from "./app/admin/workspace";createRoot(document.getElementById("root")).render(<Workspace/>);',resolveDir:root,loader:"tsx"},bundle:true,nodePaths,platform:"browser",format:"esm",jsx:"automatic",define:{"process.env.NODE_ENV":JSON.stringify("development")},outfile:path.join(runtimeDir,"admin.js"),logLevel:"warning"});
await build({stdin:{contents:'import {createRoot} from "react-dom/client";import Login from "./app/admin/login/page";createRoot(document.getElementById("root")).render(<Login/>);',resolveDir:root,loader:"tsx"},bundle:true,nodePaths,platform:"browser",format:"esm",jsx:"automatic",define:{"process.env.NODE_ENV":JSON.stringify("development")},outfile:path.join(runtimeDir,"admin-login.js"),logLevel:"warning"});
await build({stdin:{contents:'import {createRoot} from "react-dom/client";import Controls from "./app/admin/auth-controls";createRoot(document.getElementById("auth-controls")).render(<Controls/>);',resolveDir:root,loader:"tsx"},bundle:true,nodePaths,platform:"browser",format:"esm",jsx:"automatic",define:{"process.env.NODE_ENV":JSON.stringify("development")},outfile:path.join(runtimeDir,"admin-controls.js"),logLevel:"warning"});
const routes=await import(pathToFileURL(path.join(runtimeDir,"server.mjs")).href);
const contentType={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".png":"image/png",".svg":"image/svg+xml",".jpg":"image/jpeg",".jpeg":"image/jpeg",".webp":"image/webp",".ico":"image/x-icon"};
const layout=(title,body)=>'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+title+'</title><link rel="icon" type="image/svg+xml" href="/favicon.svg?v=ripees"><link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon-32.png?v=ripees"><link rel="apple-touch-icon" sizes="180x180" href="/assets/apple-touch-icon.png"></head><body>'+body+"</body></html>";
const localBadge='<div style="position:fixed;left:10px;bottom:10px;z-index:40;background:#edf3df;border:1px solid #cedbb9;border-radius:20px;padding:6px 12px;font:10px sans-serif;color:#35512d">Local test · saved on this computer · <a href="/admin" style="color:inherit">Owner workspace ↗</a></div>';
const adminPage=layout("RIPEES — local owner workspace",'<link rel="stylesheet" href="/local-assets/admin.css"><div id="auth-controls"></div><script type="module" src="/local-assets/admin-controls.js"></script><div id="root"></div><script type="module" src="/local-assets/admin.js"></script>');
const adminLoginPage=layout("RIPEES — administrator sign in",'<div id="root"></div><script type="module" src="/local-assets/admin-login.js"></script>');
async function sendWebResponse(response,res){res.statusCode=response.status;for(const[k,v]of response.headers)res.setHeader(k,v);res.setHeader("Cache-Control","no-store");if(response.headers.get("content-type")?.includes("text/event-stream")){res.flushHeaders();const reader=response.body.getReader();res.on("close",()=>reader.cancel().catch(()=>{}));try{while(!res.destroyed){const {value,done}=await reader.read();if(done)break;res.write(Buffer.from(value));}}finally{reader.releaseLock();res.end();}}else res.end(Buffer.from(await response.arrayBuffer()));}
function send(res,status,body,type="text/html; charset=utf-8"){res.writeHead(status,{"Content-Type":type,"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"});res.end(body)}
async function staticFile(base,relative,res){let decoded;try{decoded=decodeURIComponent(relative)}catch{return send(res,400,"Bad path.","text/plain")};const target=path.resolve(base,decoded);if(!target.startsWith(base+path.sep))return send(res,403,"Forbidden.","text/plain");try{if(!fs.statSync(target).isFile())return send(res,404,"Not found.","text/plain");send(res,200,fs.readFileSync(target),contentType[path.extname(target)]||"application/octet-stream");}catch{send(res,404,"Not found.","text/plain")}}
const server=http.createServer(async(req,res)=>{
 try{
  if(!["127.0.0.1:"+port,"localhost:"+port].includes(req.headers.host||""))return send(res,403,"Local connections only.","text/plain");
  const url=new URL(req.url,origin);
  if(url.pathname==="/favicon.ico")return staticFile(path.join(root,"public"),"favicon.ico",res);
  if(url.pathname==="/"){res.writeHead(302,{Location:"/website"});return res.end();}
  if(url.pathname==="/admin/login")return send(res,200,adminLoginPage);
  if(url.pathname==="/admin"){
   return send(res,200,adminPage);
  }
  if(url.pathname.startsWith("/local-assets/"))return staticFile(runtimeDir,url.pathname.slice("/local-assets/".length),res);
  if(url.pathname.startsWith("/assets/")||["/style.css","/app.js","/chat.css","/chat.js","/favicon.svg","/motion.css","/motion.js","/theme-effects.js"].includes(url.pathname))return staticFile(path.join(root,"public"),url.pathname.slice(1),res);
  const headers=new Headers();for(const[k,v]of Object.entries(req.headers)){if(v!==undefined)headers.set(k,Array.isArray(v)?v.join(","):v);}
  let bytes=0;const chunks=[];for await(const chunk of req){bytes+=chunk.length;if(bytes>10100000)return send(res,413,"Request is too large.","text/plain");chunks.push(chunk);}
  const method=req.method||"GET";const request=new Request(new URL(req.url,"http://"+req.headers.host),{method,headers,...(["GET","HEAD"].includes(method)?{}:{body:Buffer.concat(chunks)})});
  await context.run({headers},async()=>{
   let response;
   if((url.pathname==="/terms"||url.pathname==="/privacy")&&method==="GET")return sendWebResponse(routes[url.pathname.slice(1)].GET(),res);
   if(url.pathname==="/website"&&method==="GET"){response=await routes.website.GET(request);if(response.ok){const body=(await response.text()).replace("</body>",localBadge+"</body>");response=new Response(body,{headers:response.headers});}}
   else if(url.pathname==="/api/admin"){response=method==="GET"?await routes.admin.GET():method==="POST"?await routes.admin.POST(request):new Response("Method not allowed",{status:405});if(method==="GET"&&response.ok){const data=await response.json();response=Response.json({...data,storageMode:"local"},{headers:response.headers});}}
   else if(url.pathname==="/api/admin-auth")response=method==="POST"?await routes.adminAuth.POST(request):new Response("Method not allowed",{status:405});
   else if(url.pathname==="/api/chat-feedback"&&method==="POST")response=await routes.feedback.POST(request);
   else if(url.pathname==="/api/chat-insights"&&method==="GET")response=await routes.insights.GET();
   else if(url.pathname==="/api/backup"&&method==="GET")response=await routes.backup.GET();
   else if(url.pathname==="/api/leads"&&method==="GET")response=await routes.leads.GET(request);
   else if(url.pathname==="/api/enquiries"&&method==="POST")response=await routes.enquiries.POST(request);
   else if(url.pathname==="/api/chat")response=method==="GET"?await routes.chat.GET():method==="POST"?await routes.chat.POST(request):new Response("Method not allowed",{status:405});
   else response=new Response("Not found",{status:404});
   await sendWebResponse(response,res);
  });
 }catch(error){console.error("Local request failed:",error instanceof Error?error.message:"unknown");if(!res.headersSent)send(res,500,"The local request could not be completed.","text/plain");else res.end();}
});
server.on("error",error=>{console.error("Could not start local server:",error.message);process.exitCode=1;});
server.listen(port,"127.0.0.1",()=>{console.log("\nRIPEES is running locally.\nWebsite: "+origin+"/website\nOwner workspace: "+origin+"/admin\nData: "+path.join(dataDir,"ripees.sqlite")+"\nChatbot: approved answers with optional AI assistance (owner setting).\nPress Ctrl+C to stop.\n");});
function shutdown(){server.close(()=>{sqlite.close();process.exit(0)});}
process.on("SIGINT",shutdown);process.on("SIGTERM",shutdown);
