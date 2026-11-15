import { describe, expect, it } from 'vitest';
import { bulkBatches, bulkPermissions, resultSummary, selectAllMatching, selectRange, splitClosed } from './bulk-actions';

describe('queue bulk actions', () => {
  it('selects a forward and backward inclusive range', () => {
    expect(selectRange(['z'], ['a','b','c','d'], 1, 3, true)).toEqual(['z','b','c','d']);
    expect(selectRange([], ['a','b','c','d'], 3, 1, true)).toEqual(['b','c','d']);
  });
  it('deselects a range and handles a missing anchor', () => {
    expect(selectRange(['a','b','c'], ['a','b','c'], 0, 1, false)).toEqual(['c']);
    expect(selectRange([], ['a','b'], -1, 1, true)).toEqual(['b']);
  });
  it('selects every matching row across pages without duplicate or missing IDs', () => {
    const rows = Array.from({length: 120}, (_, i) => ({id:String(i),reference:String(i),status:'received'}));
    expect(selectAllMatching([...rows,{id:'0',reference:'0',status:'received'},{id:null,reference:null,status:null}])).toHaveLength(120);
  });
  it('skips closed cases, not final-response cases', () => {
    const rows = [{id:'a',reference:'A',status:'closed'},{id:'b',reference:'B',status:'final_response_sent'}];
    expect(splitClosed(rows)).toEqual({eligible:[rows[1]],skipped:[rows[0]]});
  });
  it('batches updates into exactly 50s', () => {
    expect(bulkBatches(Array.from({length:121},(_,i)=>i)).map(b=>b.length)).toEqual([50,50,21]);
    expect(bulkBatches([])).toEqual([]);
  });
  it('summarises actual results', () => expect(resultSummary({updated:48,failed:['A','B'],skipped:['C']})).toBe('48 updated, 2 failed, 1 closed cases skipped'));
  it.each(['org_admin','complaints_manager'] as const)('allows %s reassignment', role => expect(bulkPermissions(role)).toEqual({reassign:true,priority:true}));
  it.each(['agent','qa_reviewer'] as const)('does not allow %s reassignment', role => expect(bulkPermissions(role)).toEqual({reassign:false,priority:true}));
  it.each(['read_only',null,undefined] as const)('does not allow %s mutations', role => expect(bulkPermissions(role)).toEqual({reassign:false,priority:false}));
});