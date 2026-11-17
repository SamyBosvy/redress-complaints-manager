import { useEffect, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Circle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useMembership, type Organisation } from '@/lib/org';
import { detectSetup, setupProgress, setupRole, setupHidden, saveSetupHidden, setupCompletion } from '@/lib/onboarding';
import { onboardingQuery } from '@/lib/onboarding-query';
import { firmDate } from '@/lib/reopening';

export function SetupProgress({force=false}:{force?:boolean}){
 const m=useMembership();
 if(!m?.org||!setupRole(m.role))return null;
 return <ProgressContent key={`${m.user.id}:${m.org.id}:${force}`} user={m.user.id} org={m.org} readOnly={setupRole(m.role)==='read'} force={force}/>;
}
function ProgressContent({user,org,readOnly,force}:{user:string;org:Organisation;readOnly:boolean;force:boolean}){
 const qc=useQueryClient();
 const [hidden,setHidden]=useState(false);
 const [ready,setReady]=useState(false);
 const [completeHidden,setCompleteHidden]=useState(false);
 const year=Number(firmDate(new Date().toISOString(),org.time_zone).slice(0,4));
 const {data,isError,isPending}=useQuery({...onboardingQuery(org,qc,year),enabled:ready&&(force||!hidden)});
 const steps=data?detectSetup(data,year):[];
 const progress=setupProgress(steps);
 useEffect(()=>{try{setHidden(force?false:setupHidden(window.localStorage,user,org.id));if(force)saveSetupHidden(window.localStorage,user,org.id,false);}catch{setHidden(false);}setReady(true);},[user,org.id,force]);
 useEffect(()=>{
  if(!data||!progress.complete||!ready||force||hidden)return;
  let show=false;try{show=setupCompletion(window.localStorage,user,org.id);}catch{/* Keep visible when storage is unavailable. */}
  if(!show)return;
  toast.success("You're set up");
  try{if(saveSetupHidden(window.localStorage,user,org.id,true)){setHidden(true);setCompleteHidden(true);}}catch{/* Keep showing on storage failure. */}
 },[data,progress.complete,ready,force,hidden,user,org.id]);
 function hide(){try{if(saveSetupHidden(window.localStorage,user,org.id,true))setHidden(true);else toast.error('Could not save your preference. The checklist will stay visible.');}catch{toast.error('Could not save your preference. The checklist will stay visible.');}}
 if(!ready||hidden||completeHidden)return null;
 return <section aria-labelledby="setup-title" className="mb-6 min-w-0 rounded-lg border bg-card p-4 sm:p-5">
  <div className="flex flex-wrap items-center justify-between gap-2"><h2 id="setup-title" className="text-lg font-semibold">Get started</h2><Button variant="ghost" size="sm" onClick={hide}>Hide checklist</Button></div>
  {isPending?<p role="status" className="mt-3 text-sm text-muted-foreground">Checking setup progress…</p>:isError?<p role="status" className="mt-3 text-sm text-destructive">Could not check setup progress. <Button variant="link" onClick={()=>void qc.invalidateQueries({queryKey:['setup-progress',org.id]})}>Retry</Button></p>:<>
   <p role="status" aria-live="polite" className="mt-2 text-sm tabular">{progress.done} of {progress.total} done{readOnly?' · Read-only progress':''}</p>
   <progress aria-label="Setup progress" value={progress.done} max={progress.total} className="mt-2 h-2 w-full accent-primary"/>
   <ol className="mt-4 divide-y">{steps.map(step=><li key={step.id} aria-current={progress.next===step.id?'step':undefined} className={`flex min-w-0 flex-col gap-3 py-3 sm:flex-row sm:items-center ${progress.next===step.id?'border-l-2 border-primary pl-3':''}`}>
    <div className="flex min-w-0 flex-1 items-start gap-2">{step.done?<Check aria-label="Done" className="mt-0.5 h-4 w-4 shrink-0 text-success"/>:<Circle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"/>}<div className="min-w-0"><p className="break-words text-sm font-medium">{step.label}{step.optional?' (optional)':''}</p><p className="mt-1 text-xs text-muted-foreground">{step.why}</p>{step.unknown&&<p className="mt-1 text-xs text-warning">Not available with your current access, or could not be checked.</p>}{step.date&&<p className="mt-1 text-xs text-muted-foreground">Detected {firmDate(step.date,org.time_zone)}</p>}</div></div>
    {!readOnly&&<Button asChild variant={progress.next===step.id?'default':'outline'} size="sm" className="max-w-full whitespace-normal"><Link to={step.to} {...(step.id==='complaint'?{search:{test:true}}:{})}>{step.id==='complaint'?'Log a test complaint':step.id==='form'?'Share link / embed snippet':step.done?'Review':'Open'}</Link></Button>}
   </li>)}</ol>
   <p className="mt-3 text-xs text-muted-foreground">Template language follows the firm’s home country (English where no supported local language applies). QA review is optional unless a changed approval or sampling setting is recorded.</p>
  </>}
 </section>;
}