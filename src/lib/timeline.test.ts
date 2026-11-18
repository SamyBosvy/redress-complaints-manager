import { describe, it, expect } from 'vitest';
import { EVENT_GROUPS, eventGroup, parseTimelineSearch, mentionAt, mentionSegments } from './timeline';
describe('timeline filters', () => {
  it('maps every known event once and future kinds to System', () => {
    for (const [kind, group] of Object.entries(EVENT_GROUPS)) expect(eventGroup(kind)).toBe(group);
    expect(eventGroup('future_event')).toBe('system');
    expect(eventGroup('note')).toBe('notes');
    expect(eventGroup('letter_drafted')).toBe('letters');
    expect(eventGroup('deadline_recalculated')).toBe('status');
    expect(eventGroup('attachment_removed')).toBe('attachments');
    expect(eventGroup('qa_returned')).toBe('qa');
    expect(eventGroup('adr_decision')).toBe('adr');
  });
  it('parses shareable multiselect and strips invalid values', () => {
    expect(parseTimelineSearch({ tl:'notes,letters,notes,invalid', q:'evidence', mentions:'true', oldest:true })).toEqual({tl:'notes,letters',q:'evidence',mentions:true,oldest:true});
    expect(parseTimelineSearch({ tl:[],q:4,mentions:'false',oldest:'no' })).toEqual({});
    expect(parseTimelineSearch({q:'x'.repeat(300)}).q?.length).toBe(200);
  });
  it('roundtrips a shared URL without IDs', () => {
    const params = new URLSearchParams('tl=notes,letters&q=refund&mentions=true');
    expect(parseTimelineSearch(Object.fromEntries(params))).toEqual({tl:'notes,letters',q:'refund',mentions:true});
  });
  it('picker recognises @ at cursor but not email addresses', () => {
    expect(mentionAt('Hello @Sam',10)).toEqual({start:6,query:'Sam'});
    expect(mentionAt('a@example.com',13)).toBeNull();
  });
  it('renders structured mentions as highlighted names, not IDs', () => {
    expect(mentionSegments('Ask @Sam Bosvy, please',['id'],[{user_id:'id',name:'Sam Bosvy',role:'agent'}])).toEqual([{text:'Ask ',highlighted:false},{text:'@Sam Bosvy',highlighted:true},{text:', please',highlighted:false}]);
  });
});