import {queryOptions} from '@tanstack/react-query';
import {supabase} from '@/integrations/supabase/client';
export function deviceLabel(ua:string|null){
  if(!ua)return 'Unknown device';
  const device=/iPad/i.test(ua)?'iPad':/iPhone/i.test(ua)?'iPhone':/Android/i.test(ua)?'Android':/Windows/i.test(ua)?'Windows':/Macintosh|Mac OS/i.test(ua)?'Mac':/Linux/i.test(ua)?'Linux':'Device';
  const browser=/Edg\//i.test(ua)?'Edge':/Firefox|FxiOS/i.test(ua)?'Firefox':/Chrome|CriOS/i.test(ua)?'Chrome':/Safari/i.test(ua)?'Safari':'Browser';
  return `${browser} on ${device}`;
}
export function idleState(last:number,minutes:number,now:number){const expires=last+minutes*60000;return {warning:now>=expires,expired:now>=expires+60000,remaining:Math.max(0,Math.ceil((expires+60000-now)/1000))};}
export function createIdleTimer(minutes:number,onChange:(state:ReturnType<typeof idleState>)=>void,onExpire:()=>void,initial=Date.now()){
  let last=initial,expired=false;
  const tick=()=>{const state=idleState(last,minutes,Date.now());onChange(state);if(state.expired&&!expired){expired=true;onExpire();}};
  const timer=setInterval(tick,1000);
  return {activity:(at=Date.now())=>{if(!expired&&Number.isFinite(at)&&at<=Date.now()+1000){last=Math.max(last,at);tick();}},check:tick,stop:()=>clearInterval(timer)};
}
export const sessionLimitsQuery=(user:string)=>queryOptions({queryKey:['session-limits',user],queryFn:async()=>{const {data,error}=await supabase.rpc('my_session_limits');if(error)throw error;return data[0];},refetchInterval:60000});
export const sessionsQuery=(user:string)=>queryOptions({queryKey:['sessions',user],queryFn:async()=>{const {data,error}=await supabase.rpc('my_sessions');if(error)throw error;return data;},refetchInterval:60000});
export const orgSessionsQuery=(org:string)=>queryOptions({queryKey:['org-sessions',org],queryFn:async()=>{const {data,error}=await supabase.rpc('org_session_summary',{_org:org});if(error)throw error;return data;},refetchInterval:60000});