import fs from "node:fs";const p="site/market-functions.mjs";let s=fs.readFileSync(p,"utf8");s=s.split(String.fromCharCode(92,92,39)).join(String.fromCharCode(92,39));fs.writeFileSync(p,s);
