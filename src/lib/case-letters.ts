import type { Database } from '@/integrations/supabase/types';

export type CaseLetter = Database['public']['Tables']['letters']['Row'];

export function newestLetters<T extends Pick<CaseLetter, 'id' | 'sent_at'>>(letters: readonly T[]): T[] {
  return [...letters].sort((a, b) => Date.parse(b.sent_at) - Date.parse(a.sent_at) || a.id.localeCompare(b.id));
}

export function letterSender(userId: string, members: readonly { user_id: string; name: string }[]): string {
  const name = members.find(member => member.user_id === userId)?.name.trim();
  return name && name !== 'Unknown' ? name : 'Former user';
}

export function letterFilename(reference: string, kind: string, sentAt: string): string {
  const date = new Date(sentAt);
  if (!Number.isFinite(date.getTime())) throw new Error('Letter sent date unavailable.');
  return `${reference}-${kind}-${date.toISOString().slice(0, 10)}.pdf`;
}

/** The existing letters table has sent_at (no created_at); compare it to the event's created_at. */
export function matchLetterEvent(event: { kind: string; created_at: string; detail: unknown }, letters: readonly CaseLetter[]): string | undefined {
  if (!['letter_sent','letter_drafted'].includes(event.kind) || !event.detail || typeof event.detail !== 'object') return;
  if ('letter_id' in event.detail && typeof event.detail.letter_id === 'string') {
    const id = event.detail.letter_id;
    return letters.find(l=>l.id===id)?.id;
  }
  const kind = ('template' in event.detail ? event.detail.template : undefined);
  const timestamp = Date.parse(event.created_at);
  if (typeof kind !== 'string' || !Number.isFinite(timestamp)) return;
  return letters.filter(letter => letter.kind === kind && Number.isFinite(Date.parse(letter.sent_at)))
    .sort((a, b) => Math.abs(Date.parse(a.sent_at) - timestamp) - Math.abs(Date.parse(b.sent_at) - timestamp) || a.id.localeCompare(b.id))[0]?.id;
}