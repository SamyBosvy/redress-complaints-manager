import {useEffect,useRef,useState} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {useNavigate} from '@tanstack/react-router';
import {supabase} from '@/integrations/supabase/client';
import {clearAndSignOut} from '@/lib/sign-out';
import {createIdleTimer,sessionLimitsQuery} from '@/lib/session-security';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {Button} from '@/components/ui/button';
export function IdleSession({user}:{user:string}){
 const limits=useQuery(sessionLimitsQuery(user)),qc=useQueryClient(),navigate=useNavigate();
 const [state,setState]=useState({warning:false,expired:false,remaining:60});const stay=useRef<()=>void>(()=>{});
 useEffect(()=>{
  const key=`redress-activity:${user}`;let channel:BroadcastChannel|null=null;let sent=0;let warning=false;
  let initial=Date.now();try{const n=Number(localStorage.getItem(key));if(n>0&&n<=initial)initial=n;}catch{}
  const timer=createIdleTimer(limits.data?.idle_timeout_minutes??60,next=>{warning=next.warning;setState(next);},()=>{void (async()=>{try{await clearAndSignOut(qc,'local');}catch{await supabase.auth.signOut({scope:'local'});qc.clear();}finally{await navigate({to:'/auth',search:{reason:'idle'},replace:true,ignoreBlocker:true});}})();},initial);
  const publish=(force=false)=>{const now=Date.now();timer.activity(now);if(!force&&now-sent<1000)return;sent=now;try{localStorage.setItem(key,String(now));}catch{}try{channel?.postMessage(now);}catch{}};
  try{channel=new BroadcastChannel(key);channel.onmessage=e=>{if(typeof e.data==='number')timer.activity(e.data);};}catch{}
  const activity=()=>{if(!warning)publish();};
  const visibility=()=>{timer.check();if(document.visibilityState==='visible'&&!warning)publish();};
  const storage=(e:StorageEvent)=>{if(e.key===key)timer.activity(Number(e.newValue));};
  stay.current=()=>{initial=Date.now();publish(true);};
  for(const event of ['pointerdown','pointermove','keydown','scroll'])window.addEventListener(event,activity,{passive:true});
  document.addEventListener('visibilitychange',visibility);window.addEventListener('storage',storage);
  timer.check();return ()=>{timer.stop();try{channel?.close();}catch{}for(const event of ['pointerdown','pointermove','keydown','scroll'])window.removeEventListener(event,activity);document.removeEventListener('visibilitychange',visibility);window.removeEventListener('storage',storage);};
 },[user,limits.data?.idle_timeout_minutes,qc,navigate]);
 return <Dialog open={state.warning&&!state.expired}><DialogContent onEscapeKeyDown={e=>e.preventDefault()} onPointerDownOutside={e=>e.preventDefault()} className="max-h-[90dvh] max-w-[calc(100vw-2rem)] sm:max-w-md [&>button:last-child]:hidden"><DialogTitle>You will be signed out</DialogTitle><DialogDescription>Your session has been inactive. Unsaved changes will be lost.</DialogDescription><p role="status" className="text-sm">Signing out in {state.remaining} seconds.</p><Button className="min-h-12 w-full" onClick={()=>stay.current()}>Stay signed in</Button></DialogContent></Dialog>;
}