import assert from 'node:assert/strict';
const origin='http://127.0.0.1:4173';
const owner={'oai-authenticated-user-id':'local_seedy','oai-authenticated-user-email':'seedy@sites.test'};
let passed=0;
async function read(path,headers={}){const r=await fetch(origin+path,{headers});return {r,data:r.headers.get('content-type')?.includes('json')?await r.json():await r.text()};}
async function write(body,headers={}){const r=await fetch(origin+'/api/admin',{method:'POST',headers:{...owner,'content-type':'application/json','x-ripees-admin':'1',origin,...headers},body:JSON.stringify(body)});return {r,data:await r.json()};}
const ok=(message)=>{passed++;console.log('PASS '+message)};
let result=await read('/api/admin');assert.equal(result.r.status,403);ok('Anonymous access denied');
result=await read('/api/admin',{'oai-authenticated-user-id':'other','oai-authenticated-user-email':'other@example.com'});assert.equal(result.r.status,403);ok('Non-owner access denied');
result=await read('/api/admin',owner);assert.equal(result.r.status,200,JSON.stringify(result.data));let state=result.data;ok('Owner can load workspace');
result=await write({action:'content',settings:state.settings,revision:state.revision},{origin:'https://other.example'});assert.equal(result.r.status,403);ok('Cross-origin write denied');
result=await write({action:'content',settings:{...state.settings,headline1:'A tested shared website.'},revision:state.revision});assert.equal(result.r.status,200,JSON.stringify(result.data));ok('Website content saved');
result=await read('/website');assert.equal(result.r.status,200);assert.ok(result.data.includes('A tested shared website.'));assert.ok(!result.data.includes('{{'));ok('Saved content appears on website with no unresolved fields');
result=await write({action:'content',settings:state.settings,revision:state.revision});assert.equal(result.r.status,409);ok('Stale website save rejected');
const product={name:'Internal QA product',summary:'A <script>danger()</script> product description',description:'For local tests only.',category:'Testing',status:'draft',price:'',features:'Feature one\nFeature two',url:'',image:'',sort_order:0};
result=await write({action:'product',product});assert.equal(result.r.status,200,JSON.stringify(result.data));ok('Product draft saved');
let html=await read('/website');assert.ok(!html.data.includes(product.name));ok('Draft is absent from website');
state=(await read('/api/admin',owner)).data;const saved=state.products.find(p=>p.name===product.name);assert.ok(saved);
result=await write({action:'product',product:{...saved,status:'available'}});assert.equal(result.r.status,200);html=await read('/website');assert.ok(html.data.includes(product.name));assert.ok(html.data.includes('&lt;script&gt;danger()&lt;/script&gt;'));assert.ok(!html.data.includes('<script>danger()'));ok('Published product appears with safely escaped content');
const request={name:'QA Tester',company:'Local QA only',email:'qa@example.com',phone:'',interest:'Custom software',message:'This is a local enquiry test.',website:''};
let r=await fetch(origin+'/api/enquiries',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(request)});assert.equal(r.status,200,await r.text());state=(await read('/api/admin',owner)).data;let lead=state.leads.find(l=>l.email===request.email);assert.ok(lead);ok('Enquiry reaches CRM');
result=await write({action:'lead',id:lead.id,status:'qualified',notes:'Local follow-up note',updated_at:lead.updated_at});assert.equal(result.r.status,200);state=(await read('/api/admin',owner)).data;lead=state.leads.find(l=>l.id===lead.id);assert.equal(lead.status,'qualified');assert.equal(lead.notes,'Local follow-up note');ok('CRM status and notes persist');
const backup={format:'ripees-crm',version:1,settings:state.settings,products:state.products,leads:state.leads};result=await write({action:'restore',backup,revision:state.revision});assert.equal(result.r.status,200,JSON.stringify(result.data));state=(await read('/api/admin',owner)).data;assert.equal(state.products.filter(p=>p.id===saved.id).length,1);assert.equal(state.leads.filter(l=>l.id===lead.id).length,1);ok('Backup imports and merges without duplicate records');
r=await fetch(origin+'/api/enquiries',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({...request,email:'bad'})});assert.equal(r.status,400);ok('Invalid enquiry rejected');
await write({action:'deleteProduct',id:saved.id});await write({action:'deleteLead',id:lead.id});state=(await read('/api/admin',owner)).data;assert.ok(!state.products.some(p=>p.id===saved.id));assert.ok(!state.leads.some(l=>l.id===lead.id));ok('Test records can be removed');
console.log(passed+' integration checks passed against local D1.');

