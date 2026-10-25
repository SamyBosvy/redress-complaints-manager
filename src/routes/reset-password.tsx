import {createFileRoute, Link, useNavigate} from '@tanstack/react-router';
import {useEffect, useState} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {toast} from 'sonner';
import {supabase} from '@/integrations/supabase/client';
import {pageHead} from '@/lib/settings';
import {clearAndSignOut} from '@/lib/sign-out';
import {Field} from '@/components/settings/controls';
import {Input} from '@/components/ui/input';
import {Button} from '@/components/ui/button';
export const Route = createFileRoute('/reset-password')({head:()=>pageHead('Reset password','Set a new Redress password.'), component:Reset});
function Reset() {
  const [valid,setValid]=useState(false);
  const [password,setPassword]=useState('');
  const [confirm,setConfirm]=useState('');
  const [busy,setBusy]=useState(false);
  const navigate=useNavigate();
  const qc=useQueryClient();
  useEffect(()=> {
    // The auth client consumes the recovery hash before this page mounts.
    void supabase.auth.getUser().then(({data})=>setValid(Boolean(data.user)));
  },[]);
  async function submit(e:React.FormEvent) {
    e.preventDefault();
    if(password!==confirm){toast.error('Passwords must match.');return;}
    setBusy(true);
    try {
      const {error}=await supabase.auth.updateUser({password});
      if(error)throw error;
      await clearAndSignOut(qc);
      await navigate({to:'/auth',search:{},replace:true});
      toast.success('Password updated.');
    } catch {toast.error('Could not update your password. Please try again.');}
    finally {setBusy(false);}
  }
  return <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-5 px-4 py-8">
    <h1 className="text-2xl font-semibold">Reset password</h1>
    {valid ? <form className="space-y-4" onSubmit={submit}>
      <Field label="New password"><Input required type="password" minLength={8} maxLength={72} autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)}/></Field>
      <Field label="Confirm password"><Input required type="password" autoComplete="new-password" value={confirm} onChange={e=>setConfirm(e.target.value)}/></Field>
      <Button className="min-h-12 w-full" disabled={busy}>Set new password</Button>
    </form> : <p className="text-sm text-muted-foreground">Open a valid password-reset link from your email.</p>}
    <Link to="/auth" className="text-sm text-primary">Back to sign in</Link>
  </div>;
}
