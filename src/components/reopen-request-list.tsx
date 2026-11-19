import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { requestListQuery } from '@/lib/reopen-requests';
import { Button } from './ui/button';
export function ReopenRequestList({org,user}:{org:string;user?:string}){
 const [page,setPage]=useState(1);const q=useQuery(requestListQuery(org,user,page));
 return <section className="mt-6 min-w-0 border-t pt-4"><h2 className="font-semibold">Reopen requests{q.data?` (${q.data.total})`:''}</h2>
 {q.isPending?<p role="status" className="py-4 text-sm">Loading requests…</p>:q.isError?<p role="alert" className="py-4 text-destructive">Could not load reopening requests.</p>:!q.data.rows.length?<p className="py-4 text-sm text-muted-foreground">No reopening requests.</p>:<ul className="divide-y">{q.data.rows.map(r=><li key={r.id} className="py-3"><Link to="/app/c/$id" params={{id:r.complaint_id}} className="break-words text-sm font-medium text-primary hover:underline">{r.complaints?.reference??'Complaint'} · {r.status}</Link><p className="mt-1 whitespace-pre-wrap break-words text-sm">{r.reason}</p>{r.decision_note&&<p className="mt-1 break-words text-sm text-muted-foreground">{r.decision_note}</p>}<p className="mt-1 text-xs text-muted-foreground">Requested {new Date(r.created_at).toLocaleString('en-GB')}{r.decided_at?` · Decided ${new Date(r.decided_at).toLocaleString('en-GB')}`:''}</p></li>)}</ul>}
 {q.data&&q.data.total>50&&<div className="mt-3 flex items-center gap-3"><Button variant="outline" disabled={page===1} onClick={()=>setPage(v=>v-1)}>Previous</Button><span className="text-sm">Page {page}</span><Button variant="outline" disabled={page*50>=q.data.total} onClick={()=>setPage(v=>v+1)}>Next</Button></div>}
 </section>;
}