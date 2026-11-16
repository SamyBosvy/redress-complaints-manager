import {it,expect} from 'vitest';
import {canEditDetails,detailReasonValid} from './complaint-details';
import {rootCauseLabel} from './root-causes';
for(const role of ['org_admin','complaints_manager','agent','qa_reviewer','read_only'] as const)it(`detail permission ${role}`,()=>expect(canEditDetails(role,'u',{assigned_to:'u',status:'received'})).toBe(['org_admin','complaints_manager','agent'].includes(role)));
it('unassigned and other-assigned agents cannot edit',()=>{expect(canEditDetails('agent','u',{assigned_to:null})).toBe(false);expect(canEditDetails('agent','u',{assigned_to:'other'})).toBe(false);});
for(const lock of [{privacy_processing:true},{legal_hold:true},{anonymised_at:'2026-01-01'},{status:'closed'}])it(`lock ${JSON.stringify(lock)}`,()=>expect(canEditDetails('org_admin','u',lock)).toBe(false));
it('requires ten characters after trim',()=>{expect(detailReasonValid('123456789')).toBe(false);expect(detailReasonValid(' 1234567890 ')).toBe(true);});
it('managed names supersede legacy, legacy remains readable',()=>{expect(rootCauseLabel('a','Old',[{id:'a',name:'Renamed'}])).toBe('Renamed');expect(rootCauseLabel(null,'Old',[])).toBe('Legacy: Old');expect(rootCauseLabel(null,'Old',[],false)).toBe('Old');});