import { z } from 'zod';
import { CATEGORIES, CHANNELS, LANGUAGES, PRODUCTS, STATUSES } from './complaints';
import { COUNTRIES } from './countries';
import { PUBLIC_FORM_I18N } from './public-form-i18n';
import { toCsv } from './csv';
import type { Database } from '@/integrations/supabase/types';
import type { AppRole } from './org';

export const MAX_IMPORT_BYTES = 10 * 1024 * 1024;
export const MAX_IMPORT_ROWS = 5000;
export const IMPORT_FIELDS = {
  received_at: 'Received date', complainant_name: 'Customer name', country_code: 'Country', product: 'Product', category: 'Category', summary: 'Summary',
  channel: 'Channel', language: 'Language', complainant_email: 'Email', complainant_phone: 'Phone', customer_ref: 'Customer ID', desired_outcome: 'Desired outcome', vulnerable: 'Vulnerable', status: 'Status', agent_email: 'Assigned agent email', priority: 'Priority', external_reference: 'External reference',
} as const;
export type ImportField = keyof typeof IMPORT_FIELDS;
export const REQUIRED_FIELDS: ImportField[] = ['received_at', 'complainant_name', 'country_code', 'product', 'category', 'summary'];
export const VALUE_OPTIONS: Record<string, Record<string, string>> = { product: PRODUCTS, category: CATEGORIES, country_code: COUNTRIES, channel: CHANNELS, language: LANGUAGES, status: STATUSES };
export type ColumnMap = Partial<Record<ImportField, string>>;
export type ValueMap = Record<string, Record<string, string>>;
export type DateFormat = 'DD/MM/YYYY' | 'DD.MM.YYYY' | 'MM/DD/YYYY' | 'ISO';
export type ImportMember = { user_id: string; email: string | null; active: boolean; role: AppRole };
type Insert = Database['public']['Tables']['complaints']['Insert'];
export type ImportResult = { row: number; state: 'ready' | 'warnings' | 'blocked'; problems: string[]; data: Insert | null; externalReference: string };
export function canImport(role: string | null | undefined) { return role === 'org_admin' || role === 'complaints_manager'; }
export const normaliseImport = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const headerAliases: Partial<Record<ImportField, string[]>> = {
  received_at: ['Date received','Date de réception','Fecha de recepción','Data de receção','Data otrzymania','Ontvangstdatum'],
  complainant_name: ['Customer name','Nom du client','Nombre del cliente','Nome do cliente','Imię i nazwisko','Klantnaam'],
  country_code: ['Country','Pays','País','Kraj','Land'], product: ['Product','Produit','Producto','Produto','Produkt'], category: ['Category','Catégorie','Categoría','Categoria','Kategoria','Categorie'],
  summary: ['Summary','Résumé','Resumen','Resumo','Opis','Samenvatting','Description','Description de la réclamation','Descripción','Descrição','Omschrijving','Beschrijving','Details','Complaint details','Complaint description'], channel: ['Channel','Canal','Kanał','Kanaal'], language: ['Language','Langue','Idioma','Język','Taal'],
  complainant_email: ['Email','E-mail','Correo electrónico'], complainant_phone: ['Phone','Téléphone','Teléfono','Telefone','Telefon','Telefoon'],
  customer_ref: ['Customer ID','Identifiant client','ID cliente','Identificador cliente','Identyfikator klienta','Klantnummer'], desired_outcome: ['Desired outcome','Résultat souhaité','Resultado deseado','Resultado pretendido','Oczekiwany wynik','Gewenste uitkomst'],
  vulnerable: ['Vulnerable','Vulnérable','Vulnerável','Wrażliwy','Kwetsbaar'], status: ['Status','Statut','Estado'], agent_email: ['Assigned agent email','Email agent','Correo del agente','Email do agente','Email agenta','E-mail behandelaar'], priority: ['Priority','Priorité','Prioridad','Prioridade','Priorytet','Prioriteit'], external_reference: ['External reference','Référence externe','Referencia externa','Referência externa','Zewnętrzny numer referencyjny','Externe referentie'],
};
export function suggestColumns(headers: string[]): ColumnMap {
  const result: ColumnMap = {};
  for (const field of Object.keys(IMPORT_FIELDS) as ImportField[]) {
    const aliases = [field, IMPORT_FIELDS[field], ...(headerAliases[field] ?? [])].map(normaliseImport);
    const found = headers.find(header => aliases.includes(normaliseImport(header)));
    if (found !== undefined) result[field] = found;
  }
  return result;
}
/** Translated status labels (FR/ES/PT/PL/NL) accepted during import, keyed by status. */
export const STATUS_TRANSLATIONS: Record<string, string[]> = {
  received: ['Reçue','Reçu','Recibida','Recibido','Recebida','Recebido','Otrzymana','Otrzymany','Ontvangen'],
  acknowledged: ['Accusée de réception','Accusé de réception','Acusada','Confirmada','Reconhecida','Potwierdzona','Bevestigd'],
  under_investigation: ["En cours d'instruction","À l'étude",'En investigación','Em investigação','W trakcie badania','W trakcie wyjaśniania','In onderzoek'],
  closed: ['Clôturée','Fermée','Cerrada','Encerrada','Fechada','Zamknięta','Gesloten','Afgesloten'],
};
export function matchImportValue(field: string, value: string): string {
  const options = VALUE_OPTIONS[field];
  if (!options || !value.trim()) return '';
  const translatedField = field === 'country_code' ? 'countries' : field === 'product' ? 'products' : field === 'category' ? 'categories' : field === 'language' ? 'languages' : null;
  for (const [key, label] of Object.entries(options)) {
    const labels = [key, label];
    if (translatedField) for (const dictionary of Object.values(PUBLIC_FORM_I18N)) labels.push((dictionary[translatedField] as Record<string, string>)[key] ?? '');
    if (field === 'status') labels.push(...(STATUS_TRANSLATIONS[key] ?? []));
    if (labels.some(label => normaliseImport(label) === normaliseImport(value))) return key;
  }
  return '';
}
export function parseImportDate(raw: string, format: DateFormat): string | null {
  const value = raw.trim();
  let year: number, month: number, day: number;
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (iso) { year = Number(iso[1]); month = Number(iso[2]); day = Number(iso[3]); }
  else {
    const match = (format === 'DD.MM.YYYY' ? /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/ : /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/).exec(value);
    if (!match || format === 'ISO') return null;
    year = Number(match[3]); month = Number(match[format === 'MM/DD/YYYY' ? 1 : 2]); day = Number(match[format === 'MM/DD/YYYY' ? 2 : 1]);
  }
  if (year < 1000 || year > 9999 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date.toISOString();
}
export function checkImportSize(bytes: number, rows: number) {
  if (bytes > MAX_IMPORT_BYTES) throw new Error('Files must be 10 MB or smaller.');
  if (rows > MAX_IMPORT_ROWS) throw new Error('Files must contain no more than 5,000 data rows.');
}
export function batchImport<T>(rows: T[]): T[][] { const result: T[][] = []; for (let i = 0; i < rows.length; i += 100) result.push(rows.slice(i, i + 100)); return result; }
export function validateImport(rows: Record<string, string>[], columns: ColumnMap, values: ValueMap, format: DateFormat, members: ImportMember[] | null, orgId: string, userId: string, now: string): ImportResult[] {
  const refs = new Map<string, number>();
  for (const row of rows) { const ref = (row[columns.external_reference ?? ''] ?? '').trim().toLowerCase(); if (ref) refs.set(ref, (refs.get(ref) ?? 0) + 1); }
  return rows.map((row, index) => {
    const get = (field: ImportField) => (row[columns[field] ?? ''] ?? '').trim();
    const errors: string[] = [], warnings: string[] = [];
    for (const field of REQUIRED_FIELDS) if (!get(field)) errors.push(`${IMPORT_FIELDS[field]} is required.`);
    const date = parseImportDate(get('received_at'), format);
    if (!date) errors.push('Received date is invalid for the selected format.');
    else if (date.slice(0, 10) > now.slice(0, 10)) errors.push('Received date is in the future.');
    const mapped = (field: ImportField, fallback = '') => {
      const raw = get(field);
      if (!raw) return fallback;
      const choice = values[field]?.[raw] ?? matchImportValue(field, raw);
      if (!choice || !Object.hasOwn(VALUE_OPTIONS[field] ?? {}, choice)) { errors.push(`${IMPORT_FIELDS[field]} value “${raw}” is not mapped.`); return ''; }
      return choice;
    };
    const country = mapped('country_code'), product = mapped('product'), category = mapped('category');
    const channel = mapped('channel', 'email'), language = mapped('language', 'en'), status = mapped('status', 'received');
    if (get('complainant_email') && !z.string().email().safeParse(get('complainant_email')).success) errors.push('Email is invalid.');
    const limits: Partial<Record<ImportField, number>> = { complainant_name: 200, complainant_email: 255, complainant_phone: 50, customer_ref: 100, summary: 10000, desired_outcome: 5000 };
    for (const [field, limit] of Object.entries(limits)) if (get(field as ImportField).length > limit) errors.push(`${IMPORT_FIELDS[field as ImportField]} exceeds ${limit} characters.`);
    const externalReference = get('external_reference');
    if (externalReference && (refs.get(externalReference.toLowerCase()) ?? 0) > 1) errors.push('Duplicate external reference within this file.');
    // No external-reference column exists. Preserve it explicitly in the summary, never overwrite the generated reference/customer ID.
    const summary = get('summary') + (externalReference ? `\n\nExternal reference: ${externalReference}` : '');
    if (externalReference) warnings.push('External reference will be retained in the summary.');
    if (summary.length > 10000 && get('summary').length <= 10000) errors.push('Summary including external reference exceeds 10000 characters.');
    const email = get('agent_email').toLowerCase();
    const agent = email ? members?.find(member => member.active && member.role !== 'read_only' && member.email?.trim().toLowerCase() === email) : undefined;
    if (email && !agent) warnings.push(members === null ? 'Members unavailable; will be unassigned.' : 'Agent is not an active handler; will be unassigned.');
    const vulnerable = normaliseImport(get('vulnerable'));
    const truth = ['true','yes','1','oui','si','sim','tak','ja'], falsity = ['','false','no','0','non','nao','nie','nee'];
    if (!truth.includes(vulnerable) && !falsity.includes(vulnerable)) errors.push('Vulnerable must be yes/no or true/false.');
    const priority = get('priority').toLowerCase() || 'standard';
    if (!['standard', 'high'].includes(priority)) errors.push('Priority must be standard or high.');
    if (!get('channel')) warnings.push('Missing channel defaults to Email.');
    const data: Insert | null = errors.length || !date ? null : {
      org_id: orgId, created_by: userId, received_at: date, complainant_name: get('complainant_name'), country_code: country,
      product: product as Insert['product'], category: category as Insert['category'], channel: channel as Insert['channel'], language, status: status as NonNullable<Insert['status']>,
      summary, complainant_email: get('complainant_email') || null, complainant_phone: get('complainant_phone') || null, customer_ref: get('customer_ref') || null,
      desired_outcome: get('desired_outcome') || null, vulnerable: truth.includes(vulnerable), assigned_to: agent?.user_id ?? null, priority: priority === 'high' ? 'high' : 'standard',
    };
    return { row: index + 2, state: errors.length ? 'blocked' : warnings.length ? 'warnings' : 'ready', problems: [...errors, ...warnings], data, externalReference };
  });
}
export function importProblemsCsv(results: ImportResult[], rows: Record<string, string>[], headers: string[]) {
  return toCsv([['Row', 'Status', 'Problems', ...headers], ...results.filter(row => row.problems.length).map(row => [row.row, row.state, row.problems.join(' '), ...headers.map(header => rows[row.row - 2]?.[header] ?? '')])]);
}