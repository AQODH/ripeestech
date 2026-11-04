import assert from 'node:assert/strict';
import fs from 'node:fs';
import {build} from 'esbuild';
await build({entryPoints:['lib/legal.ts'],outfile:'tests/.compiled-legal.mjs',bundle:true,platform:'node',format:'esm'});
const {legalPage}=await import('./.compiled-legal.mjs');
for(const kind of ['terms','privacy']){const response=legalPage(kind);assert.equal(response.status,200);const html=await response.text();assert.ok(html.includes('info@ripees.com'));assert.ok(html.includes('+256 787 947343'));assert.ok(html.includes('Kampala, Uganda'));assert.ok(!html.includes('[Insert'));assert.ok(!html.includes('Reeps'));assert.ok(html.includes(kind==='terms'?'Limitation of Liability':'Right to Withdraw Consent'));if(kind==='privacy')assert.ok(html.includes('30-day retention'));console.log('PASS '+kind+' complete supplied policy, confirmed contacts and safe headers');}
const template=fs.readFileSync('site/index.html','utf8');for(const route of ['/terms','/privacy'])assert.ok(template.includes('href="'+route+'"'));assert.ok(template.includes('id="privacy-dialog"'));console.log('PASS Website links to dedicated policies');
