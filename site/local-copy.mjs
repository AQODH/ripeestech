import fs from "node:fs";
let server=fs.readFileSync("scripts/local-server.mjs","utf8");
server=server.replace('else if(url.pathname==="/api/admin")response=method==="GET"?await routes.admin.GET():method==="POST"?await routes.admin.POST(request):new Response("Method not allowed",{status:405});','else if(url.pathname==="/api/admin"){response=method==="GET"?await routes.admin.GET():method==="POST"?await routes.admin.POST(request):new Response("Method not allowed",{status:405});if(method==="GET"&&response.ok){const data=await response.json();response=Response.json({...data,storageMode:"local"},{headers:response.headers});}}');
fs.writeFileSync("scripts/local-server.mjs",server);
let ui=fs.readFileSync("app/admin/workspace.tsx","utf8");
ui=ui.replace('ownerName:string;chatStatus?', 'ownerName:string;storageMode?:string;chatStatus?');
ui=ui.replace('setNotice("Saved to the shared database.");','setNotice(data?.storageMode==="local"?"Saved on this computer.":"Saved to the shared database.");');
ui=ui.replace('<span className="db-dot"/> Shared database','<span className="db-dot"/> {data?.storageMode==="local"?"Local database":"Shared database"}');
ui=ui.replace('Your site is currently private. Publishing products changes the website for everyone who has access; it does not change who can visit it.','{data.storageMode==="local"?"Local test instance. Changes are saved on this computer and do not update the hosted website.":"Your site is currently private. Publishing products changes the website for everyone who has access; it does not change who can visit it."}');
ui=ui.replace('Edit your content, then save to update the live website.','{data.storageMode==="local"?"Edit your content, then save to update this local website.":"Edit your content, then save to update the live website."}');
ui=ui.replace('"Saved changes are shared across browsers and devices."','(data.storageMode==="local"?"Saved changes are available to other browsers on this computer through the local service.":"Saved changes are shared across browsers and devices.")');
ui=ui.replace('Your browser is not the main database. Changes saved here are stored online and are available from other devices after owner sign-in.','{data.storageMode==="local"?"Your data is saved in the local database file on this computer. Download backups to keep additional copies.":"Your browser is not the main database. Changes saved here are stored online and are available from other devices after owner sign-in."}');
ui=ui.replace('Download website content, products and enquiries as a JSON backup. Your data stays online; the backup is an additional local copy.','{data.storageMode==="local"?"Download website content, products and enquiries as a JSON backup. Your database remains on this computer.":"Download website content, products and enquiries as a JSON backup. Your data stays online; the backup is an additional local copy."}');
fs.writeFileSync("app/admin/workspace.tsx",ui);

