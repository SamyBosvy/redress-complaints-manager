import {useState} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {toast} from 'sonner';
import {supabase} from '@/integrations/supabase/client';
import type {Organisation} from '@/lib/org';
import {Field} from '@/components/settings/controls';
import {Input} from '@/components/ui/input';
import {Button} from '@/components/ui/button';
export function SessionSettings({org}:{org:Organisation}){
 const [idle,setIdle]=useState(org.idle_timeout_minutes),[hours,setHours]=useState(org.max_session_hours),[busy,setBusy]=useState(false),qc=useQueryClient();
 return <form className="max-w-3xl space-y-4 border-t pt-6" onSubmit={e=>{e.preventDefault();void (async()=>{setBusy(true);try{const {error}=await supabase.from('organisations').update({idle_timeout_minutes:idle,max_session_hours:hours}).eq('id',org.id);if(error)throw error;await Promise.all([qc.invalidateQueries({queryKey:['membership']}),qc.invalidateQueries({queryKey:['session-limits']})]);toast.success('Session security saved.');}catch{toast.error('Could not save session security.');}finally{setBusy(false);}})();}}><h2 className="font-semibold">Session security</h2><div className="grid gap-4 sm:grid-cols-2"><Field label="Idle timeout (minutes)"><Input type="number" min={15} max={480} required value={idle} onChange={e=>setIdle(Number(e.target.value))}/></Field><Field label="Maximum session length (hours)"><Input type="number" min={1} max={168} required value={hours} onChange={e=>setHours(Number(e.target.value))}/></Field></div><p className="text-sm text-muted-foreground">Inactive sessions show a one-minute warning before local sign-out. Maximum session length is checked hourly, preventing further refresh after expiry. The strictest setting across a member’s active organisations applies; existing access tokens can remain valid until expiry.</p><Button disabled={busy}>Save session security</Button></form>;
}