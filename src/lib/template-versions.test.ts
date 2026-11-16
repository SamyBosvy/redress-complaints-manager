import {expect,it} from 'vitest';
import {lineDiff,restoreTemplate} from './template-versions';
import {caseMergeValues,mergeTemplate} from './letters';
it('diff distinguishes added and removed lines with stable context',()=>expect(lineDiff('Header\nOld\nFooter','Header\nNew\nFooter')).toEqual([{kind:'same',text:'Header'},{kind:'removed',text:'Old'},{kind:'added',text:'New'},{kind:'same',text:'Footer'}]));
it('identical text has no changes',()=>expect(lineDiff('Same','Same')).toEqual([{kind:'same',text:'Same'}]));
it('restore provides unsaved text and source for a subsequent save',()=>expect(restoreTemplate({id:'version-id',subject:'Old subject',body:'Old body'})).toEqual({subject:'Old subject',body:'Old body',restored_from:'version-id'}));
it('fills firm email from organisation context',()=>expect(mergeTemplate('{firm_complaints_email}',caseMergeValues({},{firm:'Firm',firmEmail:'complaints@example.test'}))).toBe('complaints@example.test'));