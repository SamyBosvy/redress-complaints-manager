import {createFileRoute,Link,useNavigate} from '@tanstack/react-router';
import {useQueryClient} from '@tanstack/react-query';
import {useState} from 'react';
import {toast} from 'sonner';
import {supabase} from '@/integrations/supabase/client';
import {clearAndSignOut} from '@/lib/sign-out';
import {pageHead} from '@/lib/settings';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
export const Route=createFileRoute('/verify-email')({head:()=>pageHead('Verify email','Confirm your email before firm access.'),component:Verify});
function Verify(){const [email,setEmail]=useState('');const [busy,setBusy]=useState(false);const qc=useQueryClient();const navigate=useNavigate();return <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-4 py-8"><h1 className="text-2xl font-semibold">Verify your email</h1><p className="text-sm text-muted-foreground">Check your inbox for your confirmation link.</p><form className="space-y-3" onSubmit={async e=>{e.preventDefault();setBusy(true);const {error}=await supabase.auth.resend({type:'signup',email,options:{emailRedirectTo:window.location.origin}});setBusy(false);if(error)toast.error(error.message);else toast.success('Confirmation email requested.');}}><Input aria-label="Email" type="email" required value={email} onChange={e=>setEmail(e.target.value)}/><Button className="min-h-12 w-full" disabled={busy}>Resend confirmation</Button></form><Button className="min-h-12 w-full" variant="outline" onClick={async()=>{const {data}=await supabase.auth.getUser();if(!data.user?.email_confirmed_at){toast.error('Your email is not verified yet.');return;}await qc.invalidateQueries();await navigate({to:sessionStorage.getItem('redress-invite')?'/invite':'/app'});}}>Continue</Button><Button variant="ghost" onClick={async()=>{try{await clearAndSignOut(qc);await navigate({to:'/auth',search:{},replace:true});}catch{toast.error('Could not sign out.');}}}>Sign out</Button><Link to="/auth" className="text-center text-sm text-primary">Back to sign in</Link></div>;}
