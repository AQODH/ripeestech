import fs from "node:fs";
let server=fs.readFileSync("scripts/local-server.mjs","utf8").replace('import {fileURLToPath} from "node:url";','import {fileURLToPath,pathToFileURL} from "node:url";');
server=server.replace(/^const routes=.*$/m,'const routes=await import(pathToFileURL(path.join(runtimeDir,"server.mjs")).href);');
fs.writeFileSync("scripts/local-server.mjs",server);
let chat=fs.readFileSync("app/api/chat/route.ts","utf8").replace('.split("\\n").map(x=>x.trim())','.split("\\n").map((x:string)=>x.trim())');fs.writeFileSync("app/api/chat/route.ts",chat);
const pkg=JSON.parse(fs.readFileSync("package.json","utf8"));pkg.scripts.local="node scripts/local-server.mjs";fs.writeFileSync("package.json",JSON.stringify(pkg,null,2)+"\n");
let test=fs.readFileSync("tests/crm-server-test.mjs","utf8");test=test.replace("const migration=fs.readdirSync('drizzle').find(x=>x.endsWith('.sql'));sqlite.exec(fs.readFileSync('drizzle/'+migration,'utf8'));","for(const migration of fs.readdirSync('drizzle').filter(x=>x.endsWith('.sql')).sort())sqlite.exec(fs.readFileSync('drizzle/'+migration,'utf8'));");fs.writeFileSync("tests/crm-server-test.mjs",test);

