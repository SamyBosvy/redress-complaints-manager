import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { mentionMembersQuery } from '@/lib/timeline-query';
import { mentionAt, type MentionMember } from '@/lib/timeline';
export function NoteComposer({ org, id, onSaved }: { org: string; id: string; onSaved: () => Promise<unknown> }) {
  const [text, setText] = useState('');
  const [selected, setSelected] = useState<MentionMember[]>([]);
  const [cursor, setCursor] = useState(0);
  const [index, setIndex] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);
  const field = useRef<HTMLTextAreaElement>(null);
  const qc = useQueryClient();
  const members = useQuery(mentionMembersQuery(org, id));
  const at = mentionAt(text, cursor);
  const options = at && !dismissed ? (members.data ?? []).filter(member => member.name.toLocaleLowerCase().includes(at.query.toLocaleLowerCase())) : [];
  const highlighted = Math.min(index, Math.max(0, options.length - 1));
  function choose(member: MentionMember) {
    if (!at) return;
    const next = text.slice(0, at.start) + `@${member.name} ` + text.slice(cursor);
    const position = at.start + member.name.length + 2;
    setText(next); setCursor(position); setSelected(current => [...current.filter(row => row.user_id !== member.user_id), member]); setDismissed(true);
    requestAnimationFrame(() => { field.current?.focus(); field.current?.setSelectionRange(position, position); });
  }
  async function save() {
    if (!text.trim() || busy) return;
    setBusy(true);
    try {
      const mentions = selected.filter(member => text.includes(`@${member.name}`)).map(member => member.user_id);
      const { error } = await supabase.rpc('add_note_with_mentions', { _complaint_id: id, _text: text.trim(), _mentions: mentions });
      if (error) throw error;
      setText(''); setSelected([]);
      await Promise.all([onSaved(), qc.invalidateQueries({ queryKey: ['timeline', org, id] }), qc.invalidateQueries({ queryKey: ['unread-mentions'] }), qc.invalidateQueries({ queryKey: ['my-mentions'] })]);
      toast.success('Note added.');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not add note.'); }
    finally { setBusy(false); }
  }
  return <div className="space-y-2">
    <Textarea ref={field} aria-label="Internal note" aria-autocomplete="list" aria-controls={options.length ? 'note-member-picker' : undefined} aria-expanded={Boolean(options.length)} aria-activedescendant={options[highlighted] ? `note-member-${highlighted}` : undefined} rows={3} maxLength={5000} disabled={busy} value={text} onChange={event => { setText(event.target.value); setCursor(event.target.selectionStart); setIndex(0); setDismissed(false); }} onSelect={event => setCursor(event.currentTarget.selectionStart)} onKeyDown={event => {
      if (!options.length) return;
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setIndex((highlighted + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length); }
      if (event.key === 'Enter') { event.preventDefault(); const member = options[highlighted]; if (member) choose(member); }
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setDismissed(true); }
    }} />
    {!!options.length && <ul id="note-member-picker" role="listbox" aria-label="Mention a firm member" className="max-h-48 overflow-y-auto rounded-md border bg-popover p-1">{options.map((member, i) => <li key={member.user_id} id={`note-member-${i}`} role="option" aria-selected={i === highlighted}><Button variant="ghost" className={`h-auto min-h-11 w-full justify-start whitespace-normal text-left ${i === highlighted ? 'bg-accent text-accent-foreground' : ''}`} onMouseDown={event => event.preventDefault()} onClick={() => choose(member)}>{member.name}</Button></li>)}</ul>}
    {at && members.isError && <p role="status" className="text-sm text-muted-foreground">Couldn't load mention recipients.</p>}
    <Button size="sm" disabled={!text.trim() || busy} onClick={() => void save()}>{busy ? 'Saving…' : 'Add note'}</Button>
  </div>;
}