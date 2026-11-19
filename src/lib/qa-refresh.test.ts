import {QueryClient} from '@tanstack/react-query';
import {it,expect} from 'vitest';
import {refreshQaDecision} from './qa-refresh';
it('invalidates both case and all filtered timeline pages after a QA decision, preserving another org timeline',async()=>{
 const client=new QueryClient();const keys=[['case','case-a'],['timeline','org-a','case-a','user',{tl:'qa'}],['timeline','org-a','case-a','user',{tl:'letters'}],['timeline','org-b','case-b']];
 for(const key of keys)client.setQueryData(key,{events:[]});
 await refreshQaDecision(client,'org-a');
 expect(client.getQueryState(keys[0]??[])?.isInvalidated).toBe(true);
 expect(client.getQueryState(keys[1]??[])?.isInvalidated).toBe(true);
 expect(client.getQueryState(keys[2]??[])?.isInvalidated).toBe(true);
 expect(client.getQueryState(keys[3]??[])?.isInvalidated).toBe(false);
 client.clear();
});