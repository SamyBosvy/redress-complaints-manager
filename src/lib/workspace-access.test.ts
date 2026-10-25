import {describe,expect,it} from 'vitest';
import {canRecalculate,canViewSettings,securityDestination,validRecalculationReason} from './workspace-access';
describe('workspace access rules',()=>{
  it('sends unverified users to email verification before 2FA',()=>expect(securityDestination({needsVerification:true,needs2fa:true})).toBe('/verify-email'));
  it('sends users needing 2FA to the two-factor screen',()=>expect(securityDestination({needsVerification:false,needs2fa:true})).toBe('/two-factor'));
  it('shows Settings only to Org Admins and Complaints Managers',()=>{expect(canViewSettings('org_admin')).toBe(true);expect(canViewSettings('complaints_manager')).toBe(true);expect(canViewSettings('agent')).toBe(false);});
  it('allows deadline recalculation only for Org Admins on available cases',()=>{expect(canRecalculate('org_admin',false,false)).toBe(true);expect(canRecalculate('complaints_manager',false,false)).toBe(false);expect(canRecalculate('org_admin',true,false)).toBe(false);});
  it('requires a 10 character recalculation reason',()=>{expect(validRecalculationReason('too short')).toBe(false);expect(validRecalculationReason('Calendar corrected')).toBe(true);});
});
