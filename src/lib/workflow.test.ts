import { describe,it,expect } from 'vitest';
import { TRANSITIONS,nextStatuses,closeComplete,fourEyes,workflowError,FOUR_EYES,transitionRequirement,type CloseChecklist } from './workflow';
import { importPreviewLabel } from './import-preview';
const complete:CloseChecklist={outcome:'upheld',rootCause:'10000000-0000-4000-8000-000000000001',withdrawalReason:'',finalSent:true,adr:true,redressNone:true,goodwillNone:true,redress:'',goodwill:'',redressCurrency:'EUR',goodwillCurrency:'PLN'};
describe('Workflow decisions',()=>{
  for(const [status,targets] of Object.entries(TRANSITIONS))for(const role of ['org_admin','complaints_manager','agent','qa_reviewer','read_only'] as const)it(`${status} / ${role}`,()=>{expect(nextStatuses(status as keyof typeof TRANSITIONS,role,true)).toEqual(role==='read_only'?[]:targets.filter(t=>t!=='reopened').filter(t=>t!=='final_response_sent'||status==='pending_qa'));});
  it('agent cannot edit another assigned case',()=>expect(nextStatuses('received','agent',true,false)).toEqual([]));
  it('QA disabled excludes pending QA',()=>expect(nextStatuses('acknowledged','agent',false)).not.toContain('pending_qa'));
  it('acknowledgement requirement',()=>expect(transitionRequirement('acknowledged','received',[],null)).toBe('Send the acknowledgement letter first'));
  it('waiting for QA cannot manually mark sent',()=>expect(transitionRequirement('final_response_sent','pending_qa',[],null)).toBe('Waiting for QA approval'));
  it('legacy text cannot close',()=>expect(closeComplete({...complete,rootCause:'Processing error'})).toBe(false));
  it('complete close checklist',()=>expect(closeComplete(complete)).toBe(true));
  for(const patch of [{rootCause:''},{adr:false},{finalSent:false},{outcome:''},{redressNone:false},{goodwillNone:false},{redress:'1'},{goodwill:'1'}])it(`incomplete ${JSON.stringify(patch)}`,()=>expect(closeComplete({...complete,...patch})).toBe(false));
  it('withdrawal requires reason instead of final',()=>{expect(closeComplete({...complete,outcome:'withdrawn',finalSent:false,withdrawalReason:'Customer withdrew'})).toBe(true);expect(closeComplete({...complete,outcome:'withdrawn',finalSent:false})).toBe(false);});
  it('payments require valid ISO currencies',()=>{expect(closeComplete({...complete,redressNone:false,redress:'20',redressCurrency:'PLN'})).toBe(true);expect(closeComplete({...complete,redressNone:false,redress:'20',redressCurrency:'XXX'})).toBe(false);});
  it('four eyes forbids author and handler',()=>{expect(fourEyes('a','a','b')).toBe(true);expect(fourEyes('a','b','a')).toBe(true);expect(fourEyes('a','b','c')).toBe(false);});
  it('plain English errors with safe fallback',()=>{expect(workflowError('You cannot approve a letter you wrote')).toBe(FOUR_EYES);expect(workflowError('Invalid status change: received to closed')).not.toContain('received');expect(workflowError('SQLSTATE 23514 check constraint')).not.toContain('SQL');});
  it('mapped import labels and raw fallback',()=>{expect(importPreviewLabel('product','credit_transfer','Virement')).toBe('Credit transfer');expect(importPreviewLabel('country_code','FR','France raw')).toBe('France');expect(importPreviewLabel('product',null,'Unmapped')).toBe('Unmapped');});
});