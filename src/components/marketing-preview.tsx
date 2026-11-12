import { Check, Clock3, FileText, ListFilter } from 'lucide-react';
import { StatusPill } from '@/components/status-pill';
import type { Status } from '@/lib/complaints';

const samples: { reference: string; customer: string; country: string; status: Status; days: number }[] = [
  { reference: 'RDR-2026-000042', customer: 'Alex Martin', country: 'France', status: 'under_investigation', days: 3 },
  { reference: 'RDR-2026-000043', customer: 'Robin Kowalski', country: 'Poland', status: 'acknowledged', days: 8 },
  { reference: 'RDR-2026-000044', customer: 'Charlie de Vries', country: 'Netherlands', status: 'received', days: 12 },
];

function SampleClock({ days }: { days: number }) {
  return <span className={`inline-flex items-center gap-1.5 text-sm font-medium tabular ${days <= 5 ? 'text-warning' : 'text-success'}`}>
    <Clock3 aria-hidden="true" className="size-4 shrink-0" />{days} days left
  </span>;
}

export function MarketingPreview() {
  return <section aria-labelledby="preview-heading" className="border-y bg-muted/40 px-4 py-12 sm:px-6 md:py-16">
    <div className="mx-auto max-w-6xl">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <h2 id="preview-heading" className="font-display text-3xl font-semibold">From the queue to the full story.</h2>
        <p className="text-sm text-muted-foreground">Illustrative sample data</p>
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-[1.3fr_1fr]">
        <article aria-label="Illustrative complaint queue" className="min-w-0 overflow-hidden rounded-lg border bg-card">
          <div className="flex items-center justify-between gap-2 border-b px-4 py-4 sm:px-5">
            <h3 className="font-semibold">Complaint queue</h3><ListFilter aria-hidden="true" className="size-4 text-muted-foreground" />
          </div>
          <div className="hidden grid-cols-[1fr_1.1fr_1fr] gap-3 border-b bg-muted/40 px-5 py-3 text-xs font-medium text-muted-foreground sm:grid" aria-hidden="true">
            <span>Customer / reference</span><span>Status</span><span>Time left</span>
          </div>
          <ul className="divide-y">
            {samples.map(row => <li key={row.reference} className="grid gap-3 px-4 py-5 sm:grid-cols-[1fr_1.1fr_1fr] sm:items-center sm:px-5">
              <div className="min-w-0"><p className="text-sm font-medium">{row.customer}</p><p className="mt-1 text-xs text-muted-foreground">{row.country} · {row.reference}</p></div>
              <StatusPill status={row.status} /><SampleClock days={row.days} />
            </li>)}
          </ul>
          <p className="border-t px-5 py-3 text-xs text-muted-foreground">Business-day clocks · Country calendars</p>
        </article>
        <article aria-label="Illustrative complaint case" className="min-w-0 overflow-hidden rounded-lg border bg-card">
          <div className="border-b px-4 py-4 sm:px-5">
            <p className="text-xs text-muted-foreground">RDR-2026-000042 · Alex Martin</p>
            <h3 className="mt-2 font-semibold">Payment not received</h3>
            <div className="mt-3 flex flex-wrap gap-3"><StatusPill status="under_investigation" /><SampleClock days={3} /></div>
          </div>
          <div className="px-4 py-5 sm:px-5">
            <p className="text-sm font-medium">Case timeline</p>
            <ol className="mt-4 space-y-5">
              {[
                { icon: FileText, title: 'Investigation note added', detail: 'Agent · 11 Nov 2026' },
                { icon: Check, title: 'Acknowledgement letter sent', detail: 'Agent · 10 Nov 2026' },
                { icon: Clock3, title: 'Complaint received', detail: 'Web form · 9 Nov 2026' },
              ].map(({ icon: Icon, title, detail }) => <li key={title} className="flex gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground"><Icon aria-hidden="true" className="size-4" /></span>
                <div className="min-w-0"><p className="text-sm">{title}</p><p className="mt-1 text-xs text-muted-foreground">{detail}</p></div>
              </li>)}
            </ol>
          </div>
        </article>
      </div>
    </div>
  </section>;
}