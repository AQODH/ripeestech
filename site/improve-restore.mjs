import fs from 'node:fs';
const p='app/api/admin/route.ts';let s=fs.readFileSync(p,'utf8');
const start=s.indexOf('const statements=[db().prepare');
const end=s.indexOf('await db().batch(statements);',start);
const productCols=['id','name','summary','description','category','status','price','features','url','image','sort_order','created_at','updated_at'];
const leadCols=['id','name','email','phone','company','interest','message','status','notes','created_at','updated_at'];
const bulk=(table,cols)=>"INSERT INTO "+table+" ("+cols.join(',')+") SELECT "+cols.map(c=>"json_extract(value,'$."+c+"')").join(',')+" FROM json_each(?) WHERE true ON CONFLICT(id) DO UPDATE SET "+cols.filter(c=>c!=='id'&&c!=='created_at').map(c=>c+'=excluded.'+c).join(',');
const replacement='const statements=[db().prepare("INSERT INTO site_content (id,value,revision,updated_at,updated_by) VALUES (\'website\',?,1,?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value,revision=site_content.revision+1,updated_at=excluded.updated_at,updated_by=excluded.updated_by").bind(JSON.stringify(settings),now,u.userId),db().prepare('+JSON.stringify(bulk('products',productCols))+').bind(JSON.stringify(backup.products.map(p=>({...p,updated_at:now})))),db().prepare('+JSON.stringify(bulk('leads',leadCols))+').bind(JSON.stringify(backup.leads.map(l=>({...l,updated_at:now}))))];';
if(start<0||end<0)throw Error('restore block not found');s=s.slice(0,start)+replacement+s.slice(end);
s=s.replace('if(data.action==="lead"){','if(data.action==="deleteLead"){const id=z.string().uuid().parse(data.id);await db().prepare("DELETE FROM leads WHERE id=?").bind(id).run();return json({ok:true});}\nif(data.action==="lead"){');
fs.writeFileSync(p,s);
let w=fs.readFileSync('app/admin/workspace.tsx','utf8');w=w.replace('<button disabled={busy} type="submit">{busy?"Saving…":"Save enquiry"}</button>','<div className="modal-actions"><button className="danger-link" type="button" disabled={busy} onClick={()=>{if(confirm("Permanently delete this enquiry and its contact details? Download a backup first if needed."))save({action:"deleteLead",id:lead.id},()=>setLead(null))}}>Delete enquiry</button><button disabled={busy} type="submit">{busy?"Saving…":"Save enquiry"}</button></div>');fs.writeFileSync('app/admin/workspace.tsx',w);

