"use client";
import {useEffect,useState} from "react";
type Sub={email:string;source:string;created_at:string;unsubscribed_at:string};
// Newsletter list. Only people who typed their email AND ticked the consent box appear here.
export default function SubscribersPanel(){
  const[data,setData]=useState<{items:Sub[];total:number;active:number}|null>(null),[error,setError]=useState(""),[retry,setRetry]=useState(0);
  useEffect(()=>{const c=new AbortController();fetch("/api/subscribers?format=json",{signal:c.signal,cache:"no-store"}).then(async r=>{const d:{items:Sub[];total:number;active:number;error?:string}=await r.json();if(!r.ok)throw Error(d.error||"Could not load subscribers.");setError("");setData(d)}).catch(e=>{if(e.name!=="AbortError")setError(e.message)});return()=>c.abort()},[retry]);
  return <>
    <div className="toolbar"><p>People who chose to get your news. Each one agreed on the sign-up form.</p><a className="secondary export-link" href="/api/subscribers">Export subscribers ↓</a></div>
    {error&&<div className="message error" role="alert">{error}<button onClick={()=>setRetry(x=>x+1)}>Retry</button></div>}
    {data&&<div className="stat-row" style={{display:"flex",gap:12,margin:"0 0 14px"}}><div className="panel" style={{padding:"14px 18px"}}><small>Active</small><h2 style={{margin:0}}>{data.active}</h2></div><div className="panel" style={{padding:"14px 18px"}}><small>All sign-ups</small><h2 style={{margin:0}}>{data.total}</h2></div></div>}
    <div className="panel table-wrap" aria-busy={!data&&!error}><table><thead><tr><th>Email</th><th>Joined</th><th>Status</th></tr></thead><tbody>
      {data?.items.map(s=><tr key={s.email}><td><b>{s.email}</b><small>{s.source}</small></td><td>{new Date(s.created_at).toLocaleDateString()}</td><td>{s.unsubscribed_at?"Unsubscribed":"Active"}</td></tr>)}
      {data&&!data.items.length&&<tr><td colSpan={3}>No sign-ups yet. The sign-up box is in the website footer.</td></tr>}
    </tbody></table></div>
    {data&&data.total>200&&<p className="hint">Showing the latest 200. Export for the full list.</p>}
  </>;
}
