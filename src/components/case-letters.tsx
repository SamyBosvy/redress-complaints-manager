import { useEffect, useState } from 'react';
import { ChevronDown, Copy, FileDown, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/empty-state';
import { TableSkeleton } from '@/components/table-skeleton';
import { TEMPLATE_KINDS, formatDate } from '@/lib/letters';
import { LANGUAGES } from '@/lib/complaints';
import { letterFilename, letterSender, type CaseLetter } from '@/lib/case-letters';
import { loadPdfFont } from '@/lib/pdf-font';

export function CaseLetters({ letters, loading, error, anonymised, members, reference, firm, address, expanded, onToggle, revealId, onGenerate }: {
  letters: CaseLetter[]; loading: boolean; error: boolean; anonymised: boolean;
  members: { user_id: string; name: string }[]; reference: string; firm: string; address?: string | null | undefined;
  expanded: ReadonlySet<string>; onToggle: (id: string) => void; revealId: string | null; onGenerate?: (() => void) | undefined;
}) {
  const [downloading, setDownloading] = useState<string | null>(null);
  useEffect(() => {
    if (!revealId) return;
    const trigger = document.getElementById(`letter-${revealId}`);
    trigger?.scrollIntoView({ block: 'center' });
    trigger?.focus({ preventScroll: true });
  }, [revealId]);

  async function copy(letter: CaseLetter) {
    try { await navigator.clipboard.writeText(`${letter.subject}\n\n${letter.body}`); toast.success('Copied.'); }
    catch { toast.error("Couldn't copy letter."); }
  }
  async function pdf(letter: CaseLetter) {
    setDownloading(letter.id);
    try {
      const { letterPdf } = await import('@/lib/letter-pdf');
      const font = await loadPdfFont();
      letterPdf({ firm, address: address ?? null, date: formatDate(letter.sent_at), subject: letter.subject, body: letter.body }, font)
        .save(letterFilename(reference, letter.kind, letter.sent_at));
    } catch { toast.error("Couldn't download letter PDF."); }
    finally { setDownloading(null); }
  }

  return <section id="case-letters" className="min-w-0 rounded-lg border bg-card p-5" aria-labelledby="case-letters-title">
    <h2 id="case-letters-title" className="mb-4 text-sm font-semibold">Letters{!anonymised && !loading && !error && ` (${letters.length})`}</h2>
    {anonymised ? <p className="text-sm text-muted-foreground">Letters removed by working-record erasure.</p>
      : loading ? <TableSkeleton columns={3} rows={3} />
      : error ? <p role="status" className="text-sm text-muted-foreground">Couldn't load letters.</p>
      : !letters.length ? <EmptyState icon={Mail} title="No letters sent yet" description="No correspondence has been recorded for this complaint." primaryAction={onGenerate && <Button onClick={onGenerate}>Generate letter</Button>} />
      : <ul className="divide-y">{letters.map(letter => <li key={letter.id} className="min-w-0 py-3 first:pt-0 last:pb-0">
        <Button id={`letter-${letter.id}`} variant="ghost" className="h-auto w-full items-start justify-between gap-3 whitespace-normal px-0 text-left hover:bg-transparent" aria-expanded={expanded.has(letter.id)} aria-controls={`letter-body-${letter.id}`} onClick={() => onToggle(letter.id)}>
          <span className="min-w-0 space-y-1">
            <span className="block text-sm font-medium">{TEMPLATE_KINDS[letter.kind]} · {LANGUAGES[letter.language as keyof typeof LANGUAGES] ?? letter.language}</span>
            <span className="block break-words text-sm [overflow-wrap:anywhere]">{letter.subject || 'No subject'}</span>
            <span className="block text-xs font-normal text-muted-foreground">Sent {formatDate(letter.sent_at)} · {letterSender(letter.sent_by, members)}</span>
          </span>
          <ChevronDown aria-hidden="true" className={`mt-1 h-4 w-4 shrink-0 ${expanded.has(letter.id) ? 'rotate-180' : ''}`} />
        </Button>
        <div id={`letter-body-${letter.id}`} hidden={!expanded.has(letter.id)} className="mt-3 whitespace-pre-wrap break-words text-sm [overflow-wrap:anywhere]">{letter.body}</div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" variant="outline" aria-label={`Copy ${letter.subject || TEMPLATE_KINDS[letter.kind]}`} onClick={() => void copy(letter)}><Copy aria-hidden="true" className="h-4 w-4" />Copy</Button>
          <Button size="sm" variant="outline" disabled={downloading !== null} aria-label={`Download PDF: ${letter.subject || TEMPLATE_KINDS[letter.kind]}`} onClick={() => void pdf(letter)}><FileDown aria-hidden="true" className="h-4 w-4" />Download PDF</Button>
        </div>
      </li>)}</ul>}
  </section>;
}