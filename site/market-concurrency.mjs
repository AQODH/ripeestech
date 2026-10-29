import fs from "node:fs";
let s=fs.readFileSync("app/api/admin/route.ts","utf8");
s=s.replace('updated_at:z.string().optional()','updated_at:z.string().datetime().optional()');
s=s.replace('p.sort_order,now,p.id,p.updated_at??""','p.sort_order,new Date(Math.max(Date.now(),Date.parse(p.updated_at||"1970-01-01T00:00:00.000Z")+1)).toISOString(),p.id,p.updated_at??""');
s=s.replace('const notes=str(12000).parse(data.notes);','const notes=str(12000).parse(data.notes);const expected=z.string().datetime().parse(data.updated_at);const changed=new Date(Math.max(Date.now(),Date.parse(expected)+1)).toISOString();');
s=s.replace('.bind(status,notes,now,id,str(60).parse(data.updated_at))','.bind(status,notes,changed,id,expected)');
fs.writeFileSync("app/api/admin/route.ts",s);

