import { importPreviewLabel } from '@/lib/import-preview';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, Pick } from '@/components/settings/controls';
import { toast } from 'sonner';
import { readImportFile } from '@/lib/import-file';
import { IMPORT_FIELDS, REQUIRED_FIELDS, VALUE_OPTIONS, suggestColumns, matchImportValue, validateImport, batchImport, importProblemsCsv, type ColumnMap, type ValueMap, type DateFormat, type ImportMember, type ImportResult } from '@/lib/import';
import { downloadFile } from '@/lib/csv';
import type { Database } from '@/integrations/supabase/types';

type Insert = Database['public']['Tables']['complaints']['Insert'];
export function ComplaintImport({ orgId, userId, members, insert, onComplete }: { orgId: string; userId: string; members: ImportMember[] | null; insert: (rows: Insert[]) => PromiseLike<{ error: { message: string } | null }>; onComplete: () => void }) {
  const [file, setFile] = useState<Awaited<ReturnType<typeof readImportFile>> | null>(null);
  const [name, setName] = useState('');
  const [columns, setColumns] = useState<ColumnMap>({});
  const [values, setValues] = useState<ValueMap>({});
  const [format, setFormat] = useState<DateFormat>('DD/MM/YYYY');
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [report, setReport] = useState('');
  const [completed, setCompleted] = useState<Set<number>>(new Set());
  const [now] = useState(() => new Date().toISOString());
  const results = useMemo(() => file ? validateImport(file.rows, columns, values, format, members, orgId, userId, now) : [], [file, columns, values, format, members, orgId, userId, now]);
  const pending = results.filter(row => row.data && !completed.has(row.row));
  const visible = results.filter(row => filter === 'all' || row.state === filter);
  const pages = Math.max(1, Math.ceil(visible.length / 50));
  const currentPage = Math.min(page, pages);
  async function load(input: File | undefined) {
    if (!input || busy) return;
    setBusy(true); setError('');
    try { const parsed = await readImportFile(input); setFile(parsed); setName(input.name); setColumns(suggestColumns(parsed.headers)); setValues({}); setCompleted(new Set()); setReport(''); setPage(1); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not read this file.'); }
    finally { setBusy(false); }
  }
  async function runImport() {
    if (busy || !pending.length) return;
    setBusy(true); setReport('');
    let count = 0;
    try {
      for (const batch of batchImport(pending)) {
        const rows = batch.flatMap(row => row.data ? [row.data] : []);
        const result = await insert(rows);
        if (result.error) throw new Error(result.error.message);
        count += rows.length;
        setCompleted(previous => new Set([...previous, ...batch.map(row => row.row)]));
        setReport(`Imported ${count} of ${pending.length} complaints.`);
      }
      setReport(`Import complete: ${count} complaints imported; ${results.filter(row => row.state === 'blocked').length} blocked rows not imported.`);
      toast.success(`${count} complaints imported.`); onComplete();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Could not import complaints.';
      toast.error(message);
      setError(message);
      setReport(`Import stopped: ${count} confirmed imported, ${pending.length - count} not confirmed. Preview retained. If the connection failed after sending, check the queue before retrying to avoid duplicates.`);
    } finally { setBusy(false); }
  }
  const changeable = !busy && completed.size === 0;
  const rowCell = (row: ImportResult, field: keyof typeof IMPORT_FIELDS) => file?.rows[row.row - 2]?.[columns[field] ?? ''] ?? '';
  return <div className="min-w-0 space-y-8">
    <header><h2 className="text-xl font-semibold">Import complaints</h2><p className="mt-2 text-sm text-muted-foreground">CSV or Excel · up to 10 MB and 5,000 rows. Files stay on this device until you choose Import.</p></header>
    <section className="border border-dashed p-5" aria-label="Upload file" onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); void load(event.dataTransfer.files[0]); }}>
      <Field label="Choose a CSV or Excel file"><Input type="file" accept=".csv,.xlsx" disabled={busy} onChange={event => void load(event.target.files?.[0])} /></Field>
      <p className="mt-2 text-sm text-muted-foreground">Or drop your file here.</p>
      {file && <p className="mt-3 break-all text-sm">{name} · {file.rows.length} rows · {file.detail}</p>}
    </section>
    {error && <p role="alert" className="break-words text-sm text-destructive">{error}</p>}
    {file && <>
      <section aria-labelledby="column-mapping"><h3 id="column-mapping" className="mb-4 font-semibold">Column mapping</h3>
        <div className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Date format"><Pick disabled={!changeable} value={format} onChange={value => { setFormat(value as DateFormat); setPage(1); }} options={{ 'DD/MM/YYYY': 'DD/MM/YYYY', 'DD.MM.YYYY': 'DD.MM.YYYY', 'MM/DD/YYYY': 'MM/DD/YYYY (US)', ISO: 'ISO (YYYY-MM-DD)' }} /></Field>
          {Object.entries(IMPORT_FIELDS).map(([field, label]) => <Field key={field} label={`${label}${REQUIRED_FIELDS.includes(field as keyof typeof IMPORT_FIELDS) ? ' *' : ''}`}><Pick disabled={!changeable} value={columns[field as keyof typeof IMPORT_FIELDS] ?? '__none'} onChange={value => { setColumns(previous => ({ ...previous, [field]: value === '__none' ? '' : value })); setValues({}); setPage(1); }} options={{ __none: 'Not mapped', ...Object.fromEntries(file.headers.map(header => [header, header])) }} /></Field>)}
        </div>
      </section>
      <section aria-labelledby="value-mapping"><h3 id="value-mapping" className="mb-4 font-semibold">Value mapping</h3>
        {Object.entries(VALUE_OPTIONS).map(([field, options]) => {
          const column = columns[field as keyof typeof IMPORT_FIELDS];
          const distinct = column ? [...new Set(file.rows.map(row => (row[column] ?? '').trim()).filter(Boolean))] : [];
          return distinct.length ? <details key={field} className="mb-3 border-b pb-3"><summary className="cursor-pointer font-medium">{IMPORT_FIELDS[field as keyof typeof IMPORT_FIELDS]} · {distinct.length} values</summary><div className="mt-3 grid max-h-96 gap-3 overflow-y-auto sm:grid-cols-2">{distinct.map(raw => <Field key={raw} label={raw}><Pick disabled={!changeable} value={values[field]?.[raw] ?? (matchImportValue(field, raw) || '__none')} onChange={value => setValues(previous => ({ ...previous, [field]: { ...previous[field], [raw]: value === '__none' ? '' : value } }))} options={{ __none: 'Not mapped', ...options }} /></Field>)}</div></details> : null;
        })}
      </section>
      <section aria-labelledby="import-preview" className="min-w-0"><h3 id="import-preview" className="font-semibold">Preview</h3>
        <p className="my-3 text-sm">{results.filter(row => row.state === 'ready').length} ready · {results.filter(row => row.state === 'warnings').length} with warnings · {results.filter(row => row.state === 'blocked').length} blocked</p>
        <p className="mb-4 text-sm text-muted-foreground">Original received dates are preserved. Deadlines will be calculated from those dates. External references are retained in the summary; Redress generates its own references.</p>
        <div className="mb-4 flex flex-wrap items-end gap-3"><Field label="Row status"><Pick value={filter} onChange={value => { setFilter(value); setPage(1); }} options={{ all: 'All rows', ready: 'Ready', warnings: 'With warnings', blocked: 'Blocked' }} /></Field><Button variant="outline" disabled={busy || !results.some(row => row.problems.length)} onClick={() => downloadFile('import-problems.csv', importProblemsCsv(results, file.rows, file.headers))}>Download problems as CSV</Button></div>
        <div className="max-w-full overflow-x-auto" tabIndex={0} role="region" aria-label="Complaint import preview"><table className="w-full min-w-[760px] text-left text-sm"><thead><tr className="border-b">{['Row','Received','Customer','Country','Product','State','Problems'].map(label => <th scope="col" key={label} className="p-3">{label}</th>)}</tr></thead><tbody>{visible.slice((currentPage - 1) * 50, currentPage * 50).map(row => <tr key={row.row} className="border-b align-top"><td className="p-3">{row.row}</td><td className="p-3">{rowCell(row, 'received_at')}</td><td className="max-w-48 break-words p-3">{rowCell(row, 'complainant_name')}</td><td className="p-3">{importPreviewLabel('country_code', row.data?.country_code, rowCell(row, 'country_code'))}</td><td className="p-3">{importPreviewLabel('product', row.data?.product, rowCell(row, 'product'))}</td><td className="p-3">{completed.has(row.row) ? 'Imported' : row.state}</td><td className="min-w-60 max-w-96 break-words p-3">{row.problems.join(' ') || '—'}</td></tr>)}</tbody></table></div>
        <div className="mt-4 flex flex-wrap items-center gap-3"><Button variant="outline" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>Previous</Button><span className="text-sm">Page {currentPage} of {pages}</span><Button variant="outline" disabled={currentPage >= pages} onClick={() => setPage(currentPage + 1)}>Next</Button></div>
      </section>
      <div className="border-t pt-5"><Button disabled={busy || !pending.length} onClick={() => void runImport()}>{busy ? 'Importing…' : `Import ${pending.length} complaints`}</Button><p role="status" className="mt-3 text-sm">{report}</p></div>
    </>}
  </div>;
}