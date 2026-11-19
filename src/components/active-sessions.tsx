import {useQuery,useQueryClient} from '@tanstack/react-query';
import {useState} from 'react';
import {toast} from 'sonner';
import {supabase} from '@/integrations/supabase/client';
import {deviceLabel,sessionsQuery,orgSessionsQuery} from '@/lib/session-security';
import {Button} from '@/components/ui/button';
export function ActiveSessions({user}:{user:string}){
 const q=useQuery(sessionsQuery(user)),qc=useQueryClient(),[busy,setBusy]=useState(false);
 async function revoke(id:string){setBusy(true);try{const {error}=await supabase.rpc('revoke_my_session',{_session:id});if(error)throw error;await qc.invalidateQueries({queryKey:['sessions',user]});toast.success('Device signed out.');}catch{toast.error('Could not sign out this device.');}finally{setBusy(false);}}
 return <section className="space-y-3 border-t pt-6"><h2 className="font-semibold">Active sessions</h2><p className="text-xs text-muted-foreground">Revoked devices cannot refresh their session. Existing access tokens may remain valid until expiry.</p>{q.isError?<p role="alert" className="text-destructive">Could not load active sessions.</p>:q.isPending?<p>Loading…</p>:<ul className="divide-y">{q.data.map(s=><li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div className="min-w-0 text-sm"><p>{deviceLabel(s.user_agent)} {s.is_current&&<span className="text-xs text-primary">This device</span>}</p><p className="break-all text-xs text-muted-foreground">{s.ip??'IP unavailable'} · {s.aal}</p><p className="text-xs text-muted-foreground">Signed in {new Date(s.created_at).toLocaleString('en-GB')}<br/>Last active {new Date(s.last_active).toLocaleString('en-GB')}</p></div><Button variant="outline" size="sm" disabled={s.is_current||busy} onClick={()=>void revoke(s.id)}>Sign out</Button></li>)}</ul>}</section>;
}
export function MemberSessions({org,user}:{org:string;user:string}){
 const q=useQuery(orgSessionsQuery(org)),qc=useQueryClient(),[busy,setBusy]=useState(false);const session=q.data?.find(s=>s.user_id===user);
 async function revoke(){if(!window.confirm('Sign out all devices for this member? This also signs them out of every other organisation they belong to. Existing access tokens can remain valid until expiry.'))return;setBusy(true);try{const {error}=await supabase.rpc('revoke_member_sessions',{_org:org,_user:user});if(error)throw error;await qc.invalidateQueries({queryKey:['org-sessions',org]});toast.success('All member sessions revoked.');}catch{toast.error('Could not sign out member devices.');}finally{setBusy(false);}}
 return <div className="space-y-1 py-2 text-xs"><p>{q.isPending?'Loading sessions…':q.isError?'Sessions unavailable':`${session?.session_count??0} active sessions`}</p>{session?.last_active&&<p className="text-muted-foreground">Last active {new Date(session.last_active).toLocaleString('en-GB')}</p>}<Button variant="ghost" size="sm" disabled={busy||q.isPending||q.isError} onClick={()=>void revoke()}>Sign out all devices</Button></div>;
}