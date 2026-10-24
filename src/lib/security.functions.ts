import {createServerFn} from '@tanstack/react-start';
import {requireSupabaseAuth} from '@/integrations/supabase/auth-middleware';
import {z} from 'zod';
export const recoverAuthenticator=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(z.object({org:z.string().uuid(),password:z.string().min(1).max(72),code:z.string().min(1).max(100)})).handler(async({data,context})=>{
 const {data:own,error:ownError}=await context.supabase.auth.getUser();
 if(ownError||!own.user?.email||!own.user.email_confirmed_at)throw new Error('Verified account required.');
 const {data:members,error}=await context.supabase.rpc('my_organisations');
 if(error||!Array.isArray(members)||!members.some(m=>m&&typeof m==='object'&&!Array.isArray(m)&&m['org_id']===data.org&&m['active']===true))throw new Error('Active membership required.');
 const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
 const {data:allowed,error:limitError}=await supabaseAdmin.rpc('recovery_attempt',{_org:data.org,_user:context.userId});
 if(limitError||!allowed)throw new Error('Recovery unavailable. Try again later.');
 const {createClient}=await import('@supabase/supabase-js');
 const url=process.env['SUPABASE_URL'];const key=process.env['SUPABASE_PUBLISHABLE_KEY'];
 if(!url||!key)throw new Error('Recovery unavailable.');
 const auth=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:session,error:passwordError}=await auth.auth.signInWithPassword({email:own.user.email,password:data.password});
 if(passwordError||session.user?.id!==context.userId)throw new Error('Password or recovery code is incorrect.');
 if(session.session)await auth.auth.signOut({scope:'local'});
 const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(data.code.trim().toUpperCase()));
 const hash=Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
 const {data:consumed,error:consumeError}=await supabaseAdmin.rpc('recovery_consume',{_org:data.org,_user:context.userId,_hash:hash});
 if(consumeError||!consumed)throw new Error('Password or recovery code is incorrect.');
 const {data:factors,error:factorError}=await supabaseAdmin.auth.admin.mfa.listFactors({userId:context.userId});
 if(factorError)throw new Error('Recovery started, but factors could not be reset.');
 for(const factor of factors.factors){const r=await supabaseAdmin.auth.admin.mfa.deleteFactor({userId:context.userId,id:factor.id});if(r.error)throw new Error('Could not reset authenticator.');}
 return {reset:true};
});
