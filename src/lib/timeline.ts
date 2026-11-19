export const TIMELINE_GROUPS = { notes: 'Notes', letters: 'Letters', status: 'Status and deadlines', attachments: 'Attachments', qa: 'QA', adr: 'ADR', system: 'System' } as const;
export type TimelineGroup = keyof typeof TIMELINE_GROUPS;
export const EVENT_GROUPS: Record<string, TimelineGroup> = {
  note: 'notes', letter_sent: 'letters', letter_drafted: 'letters', status: 'status', deadline: 'status', deadline_recalculated: 'status', reopened: 'status', attachment: 'attachments', attachment_removed: 'attachments', qa_returned: 'qa', adr_escalated: 'adr', adr_decision: 'adr', created: 'system', reassigned: 'system', outcome: 'system', priority: 'system', details_edited: 'system',
};
export const eventGroup = (kind: string): TimelineGroup => EVENT_GROUPS[kind] ?? 'system';
export function eventGroups(kind: string, detail: unknown = null): TimelineGroup[] {
  const qa = detail !== null && typeof detail === 'object' && 'qa' in detail ? detail.qa : null;
  return kind === 'letter_sent' && qa !== null && qa !== undefined ? ['letters', 'qa'] : [eventGroup(kind)];
}
export type TimelineSearch = { tl?: string | undefined; q?: string | undefined; mentions?: boolean | undefined; oldest?: boolean | undefined };
export function parseTimelineSearch(value: Record<string, unknown>): TimelineSearch {
  const groups = typeof value['tl'] === 'string' ? [...new Set(value['tl'].split(',').filter(group => group in TIMELINE_GROUPS))] : [];
  const q = typeof value['q'] === 'string' ? value['q'].slice(0, 200) : '';
  return { ...(groups.length ? { tl: groups.join(',') } : {}), ...(q ? { q } : {}), ...(value['mentions'] === true || value['mentions'] === 'true' ? { mentions: true } : {}), ...(value['oldest'] === true || value['oldest'] === 'true' ? { oldest: true } : {}) };
}
export type TimelineEvent = { id: string; org_id: string; complaint_id: string; actor: string | null; kind: string; detail: unknown; created_at: string };
export type MentionMember = { user_id: string; name: string; role: string };
export function mentionSegments(text: string, mentions: readonly string[], members: readonly MentionMember[]) {
  const names = [...new Set(members.filter(member => mentions.includes(member.user_id)).map(member => member.name))].sort((a, b) => b.length - a.length);
  if (!names.length) return [{ text, highlighted: false }];
  const escaped = names.map(name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const regex = new RegExp(`(@(?:${escaped.join('|')}))(?=\\s|$|[.,!?:;])`, 'g');
  return text.split(regex).filter(Boolean).map(part => ({ text: part, highlighted: names.some(name => part === `@${name}`) }));
}
export function mentionAt(text: string, cursor: number) {
  const match = text.slice(0, cursor).match(/(?:^|\s)@([^@\n]*)$/);
  return match ? { start: cursor - (match[1]?.length ?? 0) - 1, query: match[1] ?? '' } : null;
}