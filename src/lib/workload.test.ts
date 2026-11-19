import {describe,it,expect} from 'vitest';
import {WORKLOAD_METRICS,workloadLink,workloadOps,workloadVisible,capacityEditable} from './workload';
import {parseQueueSearch} from './queue';
describe('workload links',()=>{
  for(const metric of Object.keys(WORKLOAD_METRICS) as (keyof typeof WORKLOAD_METRICS)[])it(`roundtrips ${metric} with agent and firm-local date`,()=>{
    const link=workloadLink('agent',metric,'2026-11-19');expect(parseQueueSearch({...link})).toMatchObject({tab:'all',agent:'agent',workload:metric,workload_date:'2026-11-19'});
    expect(workloadLink(null,metric,'2026-11-19').agent).toBe('none');
  });
  it('matches open, final-overdue, acknowledgement, vulnerability and high-priority rules',()=>{
    expect(workloadOps('open','2026-11-19')).toEqual([{column:'status',op:'neq',value:'closed'}]);
    expect(workloadOps('overdue','2026-11-19')).toContainEqual({column:'final_due',op:'lt',value:'2026-11-19'});
    expect(workloadOps('ack','2026-11-19')).toContainEqual({column:'status',op:'eq',value:'received'});
    expect(workloadOps('vulnerable','2026-11-19')).toContainEqual({column:'vulnerable',op:'eq',value:true});
    expect(workloadOps('high','2026-11-19')).toContainEqual({column:'priority',op:'eq',value:'high'});
    expect(workloadOps('recent','2026-11-19')).toEqual([]);
  });
  it('rejects unknown metrics and impossible dates',()=>{expect(parseQueueSearch({workload:'bad',workload_date:'2026-02-30'}).workload).toBeUndefined();expect(parseQueueSearch({workload:'toString'}).workload).toBeUndefined();expect(parseQueueSearch({workload_date:'2026-02-30'}).workload_date).toBeUndefined();});
  it('limits workload visibility and capacity management by role',()=>{expect(workloadVisible('agent')).toBe(false);for(const role of ['org_admin','complaints_manager','qa_reviewer','read_only'] as const)expect(workloadVisible(role)).toBe(true);expect(capacityEditable('complaints_manager')).toBe(true);expect(capacityEditable('read_only')).toBe(false);});
});