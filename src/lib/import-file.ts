import { checkImportSize } from './import';

export async function readImportFile(file: File) {
  checkImportSize(file.size, 0);
  let grid: unknown[][];
  let detail: string;
  if (/\.csv$/i.test(file.name)) {
    const { default: Papa } = await import('papaparse');
    const bytes = new Uint8Array(await file.arrayBuffer());
    const bom = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
    let text: string;
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { throw new Error('Save the CSV as UTF-8 and try again.'); }
    const parsed = Papa.parse<string[]>(text.replace(/^\uFEFF/, ''), { skipEmptyLines: 'greedy', preview: 5002 });
    if (parsed.errors.length) throw new Error(`CSV could not be read: ${parsed.errors[0]?.message}`);
    grid = parsed.data;
    detail = `UTF-8${bom ? ' with BOM' : ''} · delimiter ${parsed.meta.delimiter === '\t' ? 'tab' : parsed.meta.delimiter}`;
  } else if (/\.xlsx$/i.test(file.name)) {
    const XLSX = await import('xlsx');
    const book = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true, sheetRows: 5002 });
    const name = book.SheetNames[0];
    const sheet = name ? book.Sheets[name] : undefined;
    if (!sheet) throw new Error('The workbook has no first sheet.');
    const range = sheet['!fullref'] ?? sheet['!ref'];
    if (range) checkImportSize(file.size, XLSX.utils.decode_range(range).e.r);
    grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '', blankrows: false, raw: true });
    detail = `First sheet: ${name}`;
  } else throw new Error('Choose a .csv or .xlsx file.');
  checkImportSize(file.size, Math.max(0, grid.length - 1));
  const cell = (value: unknown) => value instanceof Date ? value.toISOString().slice(0, 10) : String(value ?? '');
  const headers = (grid[0] ?? []).map((value, i) => cell(value).trim() || `Column ${i + 1}`);
  if (!headers.length || grid.length < 2) throw new Error('The file needs a header and at least one data row.');
  if (new Set(headers).size !== headers.length) throw new Error('Column headers must be unique. Rename duplicate headers and try again.');
  const rows = grid.slice(1).map(row => Object.fromEntries(headers.map((header, i) => [header, cell(row[i])])));
  return { headers, rows, detail };
}