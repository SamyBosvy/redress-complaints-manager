import {createFileRoute,Link,useNavigate} from '@tanstack/react-router';
import {useEffect,useState} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {toast} from 'sonner';
import {supabase} from '@/integrations/supabase/client';
import {selectOrganisation} from '@/lib/org';
import {hashSecret,pageHead} from '@/lib/settings';
import {Button} from '@/components/ui/button';
import {Logo} from '@/components/logo';
export const Route=createFileRoute('/invite')({head:()=>pageHead('Join a firm','Accept your Redress firm invitation.'),component:Invite});
function Invite(){const [token,setToken]=useState('');const [signed,setSigned]=useState(false);const [busy,setBusy]=useState(false);const navigate=useNavigate();const qc=useQueryClient();useEffect(()=>{const t=window.location.hash.slice(1)||sessionStorage.getItem('redress-invite')||'';setToken(t);if(t)sessionStorage.setItem('redress-invite',t);void supabase.auth.getUser().then(({data})=>setSigned(!!data.user?.email_confirmed_at));},[]);async function accept(){setBusy(true);try{const {data,error}=await supabase.rpc('accept_org_invite',{_hash:await hashSecret(token)});if(error)throw error;selectOrganisation(data);sessionStorage.removeItem('redress-invite');await qc.cancelQueries();qc.clear();await navigate({to:'/app'});}catch(e){toast.error(e instanceof Error?e.message:'Invitation unavailable.');}finally{setBusy(false);}}return <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-5 px-4 py-8"><Logo/><h1 className="text-2xl font-semibold">Join your firm</h1><p className="text-sm text-muted-foreground">Use the verified email address that received this invitation.</p>{!token?<p>No invitation link was supplied.</p>:signed?<Button className="min-h-12" disabled={busy} onClick={accept}>Accept invitation</Button>:<><Button asChild className="min-h-12"><Link to="/auth">Sign in</Link></Button><Button asChild variant="outline"><Link to="/auth" search={{mode:'signup'}}>Create account</Link></Button></>}</div>;}
