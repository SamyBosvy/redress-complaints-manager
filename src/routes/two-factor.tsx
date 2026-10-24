import {createFileRoute,useNavigate} from '@tanstack/react-router';
import {useQueryClient} from '@tanstack/react-query';
import {toast} from 'sonner';
import {membershipQuery,useMembership} from '@/lib/org';
import {pageHead} from '@/lib/settings';
import {clearAndSignOut} from '@/lib/sign-out';
import {AccountSecurity} from '@/components/account-security';
import {Button} from '@/components/ui/button';
import {InstallAppButton} from '@/components/install-app';
export const Route=createFileRoute('/two-factor')({loader:({context})=>context.queryClient.ensureQueryData(membershipQuery),head:()=>pageHead('Two-factor verification','Verify or enrol your authenticator.'),component:TwoFactor});
function TwoFactor(){const m=useMembership();const qc=useQueryClient();const navigate=useNavigate();return <div className="mx-auto flex min-h-dvh max-w-md flex-col gap-5 px-4 py-8"><h1 className="text-2xl font-semibold">Secure your account</h1>{m?.user?<AccountSecurity org={m.access?.org_id} required/>:<p>Sign in before verifying an authenticator.</p>}<Button variant="outline" className="min-h-12 w-full" onClick={async()=>{try{await clearAndSignOut(qc);await navigate({to:'/auth',search:{},replace:true});}catch{toast.error('Could not sign out.');}}}>Sign out</Button><InstallAppButton/></div>;}
