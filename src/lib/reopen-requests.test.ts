import { expect, it } from 'vitest';
import { canDecideRequests, requestHistorySince } from './reopen-requests';
import { alwaysOn } from './notifications';
it('only manager and admin may decide',()=>{for(const role of ['org_admin','complaints_manager','agent','qa_reviewer','read_only'])expect(canDecideRequests(role)).toBe(['org_admin','complaints_manager'].includes(role));});
it('history is precisely the last 30 days across host zones',()=>expect(requestHistorySince(new Date('2026-11-19T21:30:00Z'))).toBe('2026-10-20T21:30:00.000Z'));
it('decision alerts are mandatory but requests are optional',()=>{expect(alwaysOn('reopen_approved')).toBe(true);expect(alwaysOn('reopen_rejected')).toBe(true);expect(alwaysOn('reopen_requested')).toBe(false);});