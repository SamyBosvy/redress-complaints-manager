import type { QueueSearch } from './queue';
import { auditDateBoundary } from './audit';
import { firmDate } from './reopening';
import type { Holiday, PeriodRange, ReportRow } from './reports';

export type ResponseLetter = { complaint_id: string; kind: string; sent_at: string | null };
export type ResponseEvent = { complaint_id: string; created_at: string; detail: unknown };
export const RESPONSE_METHODOLOGY = [
  'Acknowledged at is the earliest sent acknowledgement letter, otherwise the first status event into acknowledged; missing evidence stays unknown. All response dates use the firm time zone.',
  'Acknowledged on time: among cases with an acknowledgement deadline due in the period OR acknowledged in the period, the percentage with a known acknowledgement on or before that deadline and by period end. Missing acknowledgements remain in the denominator. Median business days uses acknowledgements in the period, from local receipt date (exclusive) to acknowledgement (inclusive), excluding weekends and case-country holidays.',
  'Acknowledgement overdue now uses current evidence: no acknowledgement and ack_due before the firm local date today, regardless of the selected period. It is a live measure, not a historical comparison.',
  'Holding responses sent counts sent holding letters in the period (not distinct cases). Cases needing a holding response uses received-in-period cases with holding_sent_at by period end divided by all received-in-period cases; it measures recorded use, not inferred need.',
  'Resolved after holding response within extended deadline uses cases resolved in the period after their holding timestamp and with an extended deadline; numerator resolves by the extended local date. Missing extended deadlines are excluded; zero denominators are n/a. Agent grouping uses current assignment.',
];
export function acknowledgedAt(id: string, letters: ResponseLetter[], events: ResponseEvent[]): string | null {
  const sent = letters.filter(l => l.complaint_id === id && l.kind === 'acknowledgement' && l.sent_at).map(l => String(l.sent_at)).sort((a,b) => Date.parse(a)-Date.parse(b));
  if (sent[0]) return sent[0];
  return events.filter(e => e.complaint_id === id && e.detail && typeof e.detail === 'object' && 'after' in e.detail && e.detail.after === 'acknowledged').map(e => e.created_at).sort((a,b) => Date.parse(a)-Date.parse(b))[0] ?? null;
}
export const responseDate = (timestamp: string, zone: string) => timestamp.length === 10 ? timestamp : firmDate(new Date(timestamp), zone);
const pct = (n: number, d: number) => d ? Math.round(n / d * 1000) / 10 : null;
export function responseMetrics(rows: ReportRow[], range: PeriodRange, holidays: Holiday[] = [], zone = 'Europe/Dublin', now = new Date()) {
  const inPeriod = (v: string | null | undefined) => !!v && responseDate(v,zone) >= range.from && responseDate(v,zone) <= range.to;
  const ackCohort = rows.filter(r => r.ack_due && (inPeriod(r.ack_due) || inPeriod(r.acknowledged_at)));
  const onTime = ackCohort.filter(r => r.acknowledged_at && r.ack_due && responseDate(r.acknowledged_at,zone) <= r.ack_due && responseDate(r.acknowledged_at,zone) <= range.to);
  const acknowledged = rows.filter(r => inPeriod(r.acknowledged_at));
  const days = acknowledged.map(r => {
    const excluded = new Set(holidays.filter(h=>h.country_code===r.country_code).map(h=>h.holiday_date));
    let count = 0;
    for(let t=Date.parse(responseDate(r.received_at,zone))+86400000;t<=Date.parse(responseDate(String(r.acknowledged_at),zone));t+=86400000){const d=new Date(t);if(d.getUTCDay()!==0&&d.getUTCDay()!==6&&!excluded.has(d.toISOString().slice(0,10)))count++;}
    return count;
  }).sort((a,b)=>a-b);
  const mid = Math.floor(days.length/2);
  const received = rows.filter(r=>inPeriod(r.received_at));
  const holding = received.filter(r=>r.holding_sent_at && responseDate(r.holding_sent_at,zone)<=range.to);
  const resolvedHolding = rows.filter(r=>inPeriod(r.closed_at) && r.holding_sent_at && r.closed_at && Date.parse(r.closed_at)>=Date.parse(r.holding_sent_at) && r.extended_due);
  const within = resolvedHolding.filter(r=>r.closed_at && r.extended_due && responseDate(r.closed_at,zone)<=r.extended_due);
  const overdue = rows.filter(r=>r.ack_due && r.ack_due<firmDate(now,zone) && !r.acknowledged_at);
  const holdingLetters = rows.flatMap(r=>(r.holding_letters ?? []).filter(inPeriod));
  return { ackCohort, onTime, acknowledged, received, holding, resolvedHolding, within, overdue, holdingLetters,
    onTimePct:pct(onTime.length,ackCohort.length), median:days.length ? days.length%2 ? days[mid] ?? null : ((days[mid-1] ?? 0)+(days[mid] ?? 0))/2 : null,
    holdingPct:pct(holding.length,received.length), extendedPct:pct(within.length,resolvedHolding.length) };
}
/** Filter-only links: acknowledgement deadline cohort, never a receipt cohort. */
export function acknowledgementSearch(metric: 'on_time' | 'late' | 'overdue', range: PeriodRange, zone: string, today: string): QueueSearch {
  return { tab: 'all', ack_metric: metric, ack_from: metric === 'overdue' ? undefined : range.from, ack_to: metric === 'overdue' ? undefined : range.to, ack_zone: zone, ack_today: metric === 'overdue' ? today : undefined };
}
export function acknowledgementFilter(from: string, to: string, zone: string) {
  const start = auditDateBoundary(from, zone), end = auditDateBoundary(to, zone, true);
  return `and(ack_due.gte.${from},ack_due.lte.${to}),and(acknowledged_at.gte.${start},acknowledged_at.lt.${end})`;
}
export function matchesAcknowledgement(r: Pick<ReportRow, 'ack_due' | 'acknowledged_at'>, s: QueueSearch) {
  if (!s.ack_metric) return true;
  if (s.ack_metric === 'overdue') return !!r.ack_due && !!s.ack_today && r.ack_due < s.ack_today && !r.acknowledged_at;
  if (!s.ack_from || !s.ack_to || !s.ack_zone || !r.ack_due || !r.acknowledged_at) return false;
  const date = responseDate(r.acknowledged_at, s.ack_zone);
  const cohort = (r.ack_due >= s.ack_from && r.ack_due <= s.ack_to) || (date >= s.ack_from && date <= s.ack_to);
  return cohort && date <= s.ack_to && (date <= r.ack_due) === (s.ack_metric === 'on_time');
}
