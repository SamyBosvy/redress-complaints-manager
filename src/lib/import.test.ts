import { describe, expect, it } from 'vitest';
import { batchImport, canImport, checkImportSize, importProblemsCsv, matchImportValue, parseImportDate, suggestColumns, validateImport, type ColumnMap, type ImportMember } from './import';
import { PUBLIC_FORM_I18N } from './public-form-i18n';

const columns: ColumnMap = { received_at: 'date', complainant_name: 'name', country_code: 'country', product: 'product', category: 'category', summary: 'summary', channel: 'channel', complainant_email: 'email', complainant_phone: 'phone', customer_ref: 'id', desired_outcome: 'outcome', external_reference: 'ref', agent_email: 'agent', vulnerable: 'vulnerable', priority: 'priority', status: 'status', language: 'language' };
const base = { date: '13/11/2026', name: 'Alex', country: 'France', product: 'Card', category: 'Customer service', summary: 'Complaint', channel: 'Email' };
const members: ImportMember[] = [{ user_id: 'handler', email: 'agent@example.com', active: true, role: 'agent' }];
const validate = (changes: Record<string, string> = {}, available: ImportMember[] | null = members) => validateImport([{ ...base, ...changes }], columns, {}, 'DD/MM/YYYY', available, 'org', 'creator', '2026-11-14')[0];
describe('complaint import', () => {
  it.each([
    ['Date received', 'Customer name', 'Country', 'Product', 'Category', 'Summary'],
    ['Date de réception', 'Nom du client', 'Pays', 'Produit', 'Catégorie', 'Résumé'],
    ['Fecha de recepción', 'Nombre del cliente', 'País', 'Producto', 'Categoría', 'Resumen'],
    ['Data de receção', 'Nome do cliente', 'País', 'Produto', 'Categoria', 'Resumo'],
    ['Data otrzymania', 'Imię i nazwisko', 'Kraj', 'Produkt', 'Kategoria', 'Opis'],
    ['Ontvangstdatum', 'Klantnaam', 'Land', 'Product', 'Categorie', 'Samenvatting'],
  ])('suggests required headers in six languages: %s', (...headers) => {
    expect(suggestColumns(headers)).toEqual({ received_at: headers[0], complainant_name: headers[1], country_code: headers[2], product: headers[3], category: headers[4], summary: headers[5] });
  });
  it('parses ISO and explicit regional formats without guessing US', () => {
    expect(parseImportDate('2026-11-13', 'DD/MM/YYYY')).toBe('2026-11-13T00:00:00.000Z');
    expect(parseImportDate('02/03/2026', 'DD/MM/YYYY')).toBe('2026-03-02T00:00:00.000Z');
    expect(parseImportDate('02/03/2026', 'MM/DD/YYYY')).toBe('2026-02-03T00:00:00.000Z');
    expect(parseImportDate('13.11.2026', 'DD.MM.YYYY')).toBe('2026-11-13T00:00:00.000Z');
    expect(parseImportDate('12/31/2026', 'DD/MM/YYYY')).toBeNull();
    expect(parseImportDate('31/02/2026', 'DD/MM/YYYY')).toBeNull();
    expect(parseImportDate('13/11/2026', 'ISO')).toBeNull();
  });
  it('rejects future dates and accepts today', () => {
    expect(validate({ date: '15/11/2026' })?.problems).toContain('Received date is in the future.');
    expect(validate({ date: '14/11/2026' })?.state).toBe('ready');
  });
  it('matches keys, English labels and all public translations', () => {
    expect(matchImportValue('product', 'CARD')).toBe('card');
    for (const dictionary of Object.values(PUBLIC_FORM_I18N)) {
      expect(matchImportValue('product', dictionary.products.card)).toBe('card');
      expect(matchImportValue('category', dictionary.categories.customer_service)).toBe('customer_service');
      expect(matchImportValue('country_code', dictionary.countries.FR)).toBe('FR');
      expect(matchImportValue('language', dictionary.languages.fr)).toBe('fr');
    }
    expect(matchImportValue('status', 'Under investigation')).toBe('under_investigation');
    expect(matchImportValue('channel', 'PHONE')).toBe('phone');
  });
  it.each(['date','name','country','product','category','summary'])('blocks missing required %s', field => { expect(validate({ [field]: '' })?.state).toBe('blocked'); });
  it.each(['country','product','category','channel','language','status'])('blocks unknown %s', field => { expect(validate({ [field]: 'unknown' })?.state).toBe('blocked'); });
  it('honours explicit mapping and explicit unmapped values', () => {
    const row = { ...base, product: 'Local card' };
    expect(validateImport([row], columns, { product: { 'Local card': 'card' } }, 'DD/MM/YYYY', members, 'org', 'creator', '2026-11-14')[0]?.data?.product).toBe('card');
    expect(validateImport([base], columns, { product: { Card: '' } }, 'DD/MM/YYYY', members, 'org', 'creator', '2026-11-14')[0]?.state).toBe('blocked');
  });
  it('validates optional email', () => { expect(validate({ email: 'bad' })?.state).toBe('blocked'); expect(validate({ email: '' })?.state).toBe('ready'); });
  it.each([['name',200],['email',255],['phone',50],['id',100],['summary',10000],['outcome',5000]] as const)('enforces %s length', (field, limit) => { expect(validate({ [field]: 'x'.repeat(limit + 1) })?.state).toBe('blocked'); });
  it('detects duplicate external references and ignores blanks', () => {
    const results = validateImport([{ ...base, ref: 'ABC' }, { ...base, ref: ' abc ' }], columns, {}, 'DD/MM/YYYY', members, 'org', 'creator', '2026-11-14');
    expect(results.every(row => row.problems.includes('Duplicate external reference within this file.'))).toBe(true);
    expect(validate()?.state).toBe('ready');
  });
  it('retains external references without replacing generated reference or customer ID', () => { const row = validate({ ref: 'OLD-1', id: 'CUSTOMER' }); expect(row?.data?.summary).toContain('External reference: OLD-1'); expect(row?.data?.customer_ref).toBe('CUSTOMER'); expect(row?.data?.reference).toBeUndefined(); });
  it('assigns only active handlers and warns on unavailable members', () => {
    expect(validate({ agent: ' AGENT@example.com ' })?.data?.assigned_to).toBe('handler');
    for (const member of [{ ...members[0], user_id: 'handler', email: 'agent@example.com', active: false, role: 'agent' as const }, { user_id: 'handler', email: 'agent@example.com', active: true, role: 'read_only' as const }]) expect(validate({ agent: 'agent@example.com' }, [member])?.data?.assigned_to).toBeNull();
    expect(validate({ agent: 'agent@example.com' }, null)?.problems).toContain('Members unavailable; will be unassigned.');
  });
  it('validates priority and vulnerable, and sets org/creator', () => { expect(validate({ priority: 'urgent' })?.state).toBe('blocked'); expect(validate({ vulnerable: 'maybe' })?.state).toBe('blocked'); expect(validate({ vulnerable: 'oui', priority: 'high' })?.data).toMatchObject({ org_id: 'org', created_by: 'creator', vulnerable: true, priority: 'high' }); });
  it('enforces 10 MB and 5000 rows', () => { expect(() => checkImportSize(10 * 1024 * 1024, 5000)).not.toThrow(); expect(() => checkImportSize(10 * 1024 * 1024 + 1, 1)).toThrow(); expect(() => checkImportSize(1, 5001)).toThrow(); });
  it('batches into 100s', () => { expect(batchImport(Array.from({ length: 250 }, (_, i) => i)).map(batch => batch.length)).toEqual([100,100,50]); expect(batchImport([])).toEqual([]); });
  it('exports source problems safely for spreadsheets', () => { const rows = [{ ...base, name: '=EVIL', email: 'bad' }]; const results = validateImport(rows, columns, {}, 'DD/MM/YYYY', members, 'org', 'creator', '2026-11-14'); const csv = importProblemsCsv(results, rows, ['name','email']); expect(csv).toContain('Row,Status,Problems,name,email'); expect(csv).toContain('Email is invalid.'); expect(csv).toContain("'=EVIL"); });
  it('allows only admin and manager import', () => { expect(canImport('org_admin')).toBe(true); expect(canImport('complaints_manager')).toBe(true); for (const role of ['agent','qa_reviewer','read_only',null]) expect(canImport(role)).toBe(false); });
});