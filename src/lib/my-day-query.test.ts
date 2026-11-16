import { describe, expect, it, vi, beforeEach } from 'vitest';
const state=vi.hoisted(()=>({calls:[] as [string,unknown[]][],rows:[] as unknown[],count:0}));
vi.mock('@/integrations/supabase/client',()=>({supabase:{from:(table:string)=>{
 const q:Record<string,unknown>={};
 for(const method of ['select','eq','in','is','gte','lte','lt','not','order','range'])q[method]=(...args:unknown[])=>{state.calls.push([`${table}.${method}`,args]);return q;};
 q['then']=(resolve:(v:unknown)=>unknown)=>Promise.resolve({data:table==='complaint_queue'?state.rows:[],count:state.count,error:null}).then(resolve);
 return q;
}}}));
import { fetchDaySection, myDayQuery } from './my-day-query';
describe('bounded My day reads',()=>{
 beforeEach(()=>{state.calls=[];state.rows=[];state.count=0;});
 it('fetches only ten displayed rows with exact count and explicit organisation',async()=>{state.count=1000;const r=await fetchDaySection('org','user','overdue','2026-11-16','Europe/Paris');expect(r.total).toBe(1000);expect(state.calls).toContainEqual(['complaint_queue.range',[0,9]]);expect(state.calls).toContainEqual(['complaint_queue.eq',['org_id','org']]);expect(state.calls).toContainEqual(['complaint_queue.eq',['assigned_to','user']]);});
 it('caps acknowledgement candidates at 200 and exposes incompleteness',async()=>{state.count=201;const r=await fetchDaySection('org','user','ack','2026-11-16','Europe/Paris');expect(state.calls).toContainEqual(['complaint_queue.range',[0,199]]);expect(r.limited).toBe(true);});
 it('queue View all uses 50-row paging and the identical predicates',async()=>{await fetchDaySection('org','user','adr','2026-11-16','Europe/Paris',2,50);expect(state.calls).toContainEqual(['complaint_queue.range',[50,99]]);expect(state.calls).toContainEqual(['complaint_queue.is',['adr_cases.firm_response_sent_on',null]]);});
 it('refreshes every two minutes but not while backgrounded',()=>{const q=myDayQuery('org','user','2026-11-16','Europe/Paris');expect(q.refetchInterval).toBe(120000);expect(q.refetchIntervalInBackground).toBe(false);expect(q.placeholderData).toBeTypeOf('function');});
});