import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Paperclip, ExternalLink, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AccessibleField } from '@/components/accessible-field';
import { TableSkeleton } from '@/components/table-skeleton';
import { attachmentsQuery } from '@/lib/attachments-query';
import { ATTACHMENT_CATEGORIES, ATTACHMENT_TYPES, attachmentError, attachmentMime, canRemoveAttachment, fileSha256, type AttachmentCategory } from '@/lib/attachments';
import type { Database } from '@/integrations/supabase/types';
type Attachment = Database['public']['Tables']['complaint_attachments']['Row'];
export function CaseAttachments({ org, id, user, role, assigned, anonymised, processing, legalHold, members, onSaved }: {
  org: string; id: string; user: string; role: string | null; assigned: string | null; anonymised: boolean; processing: boolean; legalHold: boolean;
  members: { user_id: string; name: string }[]; onSaved: () => Promise<unknown>;
}) {
  const result = useQuery(attachmentsQuery(org, id));
  const qc = useQueryClient();
  const picker = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [category, setCategory] = useState<AttachmentCategory>('customer_evidence');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<Attachment | null>(null);
  const [reason, setReason] = useState('');
  const manager = ['org_admin', 'complaints_manager'].includes(role ?? '');
  const canUpload = !anonymised && !processing && (manager || role === 'qa_reviewer' || (role === 'agent' && assigned === user));
  const refresh = async () => { await Promise.all([qc.invalidateQueries({ queryKey: ['case-attachments', org, id] }), onSaved()]); };
  function choose(selected: File[]) {
    const valid: File[] = [];
    for (const file of selected) { const error = attachmentError(file); if (error) toast.error(`${file.name}: ${error}`); else valid.push(file); }
    setFiles(current => [...current, ...valid]);
  }
  async function upload() {
    setBusy(true);
    const failed: File[] = [];
    for (const file of files) {
      try {
        const error = attachmentError(file); if (error) throw new Error(error);
        const mime = attachmentMime(file.name); if (!mime) throw new Error('Unsupported file type.');
        const sha256 = await fileSha256(file);
        const path = `${org}/${id}/${crypto.randomUUID()}-${file.name.replace(/[^\w.\-]/g, '_')}`;
        const stored = await supabase.storage.from('attachments').upload(path, file, { contentType: mime, upsert: false });
        if (stored.error) throw stored.error;
        const saved = await supabase.from('complaint_attachments').insert({ org_id: org, complaint_id: id, storage_path: path, file_name: file.name, mime_type: mime, size_bytes: file.size, sha256, category, description: description.trim() || null, uploaded_by: user });
        if (saved.error) throw new Error(`File stored but evidence registration failed: ${saved.error.message}. Contact your Org Admin before retrying.`);
        toast.success(`${file.name}: attachment added.`);
      } catch (error) { failed.push(file); toast.error(error instanceof Error ? error.message : `Couldn't upload ${file.name}.`); }
    }
    setFiles(failed); if (!failed.length) setDescription('');
    await refresh(); setBusy(false);
  }
  async function open(row: Attachment) {
    const { data, error } = await supabase.storage.from('attachments').createSignedUrl(row.storage_path, 60);
    if (error || !data) { toast.error("Couldn't open this attachment."); return; }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  }
  async function remove() {
    if (!removing) return;
    setBusy(true);
    try {
      const { error } = await supabase.rpc('remove_complaint_attachment', { _org: org, _attachment: removing.id, _reason: reason.trim() });
      if (error) throw error;
      setRemoving(null); await refresh(); toast.success('Attachment removed from access.');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not remove attachment.'); }
    finally { setBusy(false); }
  }
  return <section className="min-w-0 rounded-lg border bg-card p-5" aria-labelledby="attachments-title">
    <h2 id="attachments-title" className="mb-4 text-sm font-semibold">Attachments</h2>
    {result.isPending ? <TableSkeleton columns={3} rows={2} /> : result.isError ? <p role="status" className="text-sm text-muted-foreground">Couldn't load attachments.</p> : <ul className="divide-y">{(result.data ?? []).filter(row => !row.removed_at || manager).map(row => <li key={row.id} className={`min-w-0 py-3 ${row.removed_at ? 'text-muted-foreground' : ''}`}>
      <div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0 flex-1"><p className={`break-words [overflow-wrap:anywhere] ${row.removed_at ? 'line-through' : 'font-medium'}`}>{row.file_name}</p><p className="text-xs text-muted-foreground">{ATTACHMENT_CATEGORIES[row.category]} · {(row.size_bytes / 1024).toLocaleString('en-GB', { maximumFractionDigits: 1 })} KB · {members.find(member => member.user_id === row.uploaded_by)?.name ?? 'Unknown user'} · {new Date(row.uploaded_at).toLocaleString('en-GB')}</p>{row.description && <p className="mt-1 break-words text-sm [overflow-wrap:anywhere]">{row.description}</p>}{row.removed_at && manager && <p className="mt-1 break-words text-sm [overflow-wrap:anywhere]">Removed: {row.removal_reason}</p>}</div><div className="flex gap-1">{!row.removed_at && !anonymised && !processing && <Button size="icon" variant="ghost" title="Open attachment" aria-label={`Open ${row.file_name}`} onClick={() => void open(row)}><ExternalLink aria-hidden="true" className="h-4 w-4" /></Button>}{canRemoveAttachment(role, user, row, anonymised || processing || legalHold) && <Button size="icon" variant="ghost" title="Remove attachment" aria-label={`Remove ${row.file_name}`} onClick={() => { setRemoving(row); setReason(''); }}><Trash2 aria-hidden="true" className="h-4 w-4" /></Button>}</div></div>
    </li>)}</ul>}
    {!result.isPending && !result.isError && !result.data?.length && <p className="text-sm text-muted-foreground">No attachments.</p>}
    {canUpload && <div className="mt-4 space-y-3 border-t pt-4" onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); if (!busy) choose(Array.from(event.dataTransfer.files)); }}>
      <input ref={picker} type="file" multiple accept={Object.keys(ATTACHMENT_TYPES).map(ext => `.${ext}`).join(',')} className="hidden" onChange={event => { choose(Array.from(event.target.files ?? [])); event.target.value = ''; }} />
      <Button variant="outline" disabled={busy} onClick={() => picker.current?.click()}><Paperclip aria-hidden="true" className="h-4 w-4" />Choose files</Button>
      <AccessibleField label="Attachment category"><Select value={category} disabled={busy} onValueChange={value => setCategory(value as AttachmentCategory)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(ATTACHMENT_CATEGORIES).map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}</SelectContent></Select></AccessibleField>
      <AccessibleField label="Description (optional)"><Textarea value={description} maxLength={500} disabled={busy} onChange={event => setDescription(event.target.value)} /></AccessibleField>
      {!!files.length && <ul className="space-y-1 text-sm">{files.map((file, index) => <li key={`${file.name}-${index}`} className="flex min-w-0 items-center justify-between gap-2"><span className="break-words [overflow-wrap:anywhere]">{file.name}</span><Button size="icon" variant="ghost" disabled={busy} aria-label={`Remove ${file.name} from upload`} onClick={() => setFiles(current => current.filter((_, i) => i !== index))}><Trash2 aria-hidden="true" className="h-4 w-4" /></Button></li>)}</ul>}
      <Button disabled={busy || !files.length} onClick={() => void upload()}>{busy ? 'Uploading…' : `Upload${files.length ? ` (${files.length})` : ''}`}</Button>
    </div>}
    <Dialog open={Boolean(removing)} onOpenChange={open => { if (!open && !busy) setRemoving(null); }}><DialogContent className="flex max-h-[90dvh] flex-col"><DialogHeader><DialogTitle>Remove attachment</DialogTitle></DialogHeader><div className="min-h-0 overflow-y-auto"><p className="mb-3 break-words text-sm [overflow-wrap:anywhere]">{removing?.file_name}</p><AccessibleField label="Reason for removal (5–500 characters)"><Textarea value={reason} maxLength={500} onChange={event => setReason(event.target.value)} /></AccessibleField></div><DialogFooter className="shrink-0"><Button variant="outline" className="min-h-12" disabled={busy} onClick={() => setRemoving(null)}>Cancel</Button><Button variant="destructive" className="min-h-12" disabled={busy || reason.trim().length < 5} onClick={() => void remove()}>Remove attachment</Button></DialogFooter></DialogContent></Dialog>
  </section>;
}