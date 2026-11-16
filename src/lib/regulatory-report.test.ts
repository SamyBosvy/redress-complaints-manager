// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { periodRange, previousPeriod, comparison, regulatoryReport, regulatoryCsvRows, type ReportRow } from './reports';
import { regulatoryPackPdf } from './regulatory-pdf';
const row = (over: Partial<ReportRow> = {}): ReportRow => ({ id:'1', reference:'RDR-1', status:'closed', category:'fees_and_charges', product:'card', country_code:'PL', channel:'email', assigned_to:null, vulnerable:false, outcome:'upheld', redress_amount:10, redress_currency:'EUR', goodwill_amount:null, goodwill_currency:null, root_cause_category:'Legacy wording', received_at:'2024-02-01', closed_at:'2024-02-05', final_due:'2024-02-22', extended_due:null, holding_sent_at:null, ...over });
const range = { from:'2024-02-01', to:'2024-02-29' };
describe('period presets', () => {
  const cases = [ ['this_month','2024-02-01','2024-02-29'], ['last_month','2024-01-01','2024-01-31'], ['this_quarter','2024-01-01','2024-03-31'], ['last_quarter','2023-10-01','2023-12-31'], ['h1','2024-01-01','2024-06-30'], ['h2','2024-07-01','2024-12-31'], ['this_year','2024-01-01','2024-12-31'], ['last_year','2023-01-01','2023-12-31'], ['custom','2024-01-01','2024-02-15'] ] as const;
  it.each(cases)('%s has inclusive UTC boundaries', (preset,from,to) => expect(periodRange(preset,'2024-02-15')).toMatchObject({from,to}));
  it('last month crosses the year', () => expect(periodRange('last_month','2026-01-12')).toEqual({from:'2025-12-01',to:'2025-12-31'}));
  it('custom previous interval has equal inclusive length', () => expect(previousPeriod(range)).toEqual({from:'2024-01-03',to:'2024-01-31'}));
  it('previous year uses calendar year not 366 days', () => expect(previousPeriod(periodRange('this_year','2024-02-15'))).toEqual({from:'2023-01-01',to:'2023-12-31',unit:'year'}));
  it('previous quarter crosses year', () => expect(previousPeriod(periodRange('this_quarter','2024-02-15'))).toEqual({from:'2023-10-01',to:'2023-12-31',unit:'quarter'}));
});
describe('changes', () => {
  it('zero has no percent', () => expect(comparison(10,0)).toEqual({value:10,previous:0,absolute:10,percent:null}));
  it('negative values do not reverse the direction', () => expect(comparison(-5,-10)).toEqual({value:-5,previous:-10,absolute:5,percent:50}));
  it('calculates decreases', () => expect(comparison(5,10).percent).toBe(-50));
  it('missing values stay unavailable', () => expect(comparison(null,10).absolute).toBeNull());
});
describe('regulatory calculations', () => {
  it('keeps currencies and payment types independent', () => {
    const report = regulatoryReport([row(), row({redress_currency:'PLN',redress_amount:100,goodwill_amount:5,goodwill_currency:'GBP'})],range);
    expect(report.summary.filter(s=>s.label.includes('paid')).map(s=>[s.label,s.value])).toEqual([['Redress paid — EUR',10],['Redress paid — PLN',100],['Goodwill paid — GBP',5]]);
  });
  it('median/average subtract country holidays', () => {
    const report = regulatoryReport([row(),row({closed_at:'2024-02-09'})],range,[{country_code:'PL',holiday_date:'2024-02-02'}]);
    expect(report.summary.find(s=>s.label==='Median days to resolve')?.value).toBe(3);
    expect(report.summary.find(s=>s.label==='Average days to resolve')?.value).toBe(3);
  });
  it('groups managed names and legacy text without merging unrelated groups', () => {
    const report = regulatoryReport([row(),row({root_cause_category:'System error'}),row({root_cause_category:'System error'})],range);
    expect(report.tables.find(t=>t.title==='By root cause')?.rows.map(r=>[r.label,r.count])).toEqual([['System error',2],['Legacy wording',1]]);
    expect(regulatoryCsvRows(report).flat()).toContain('By channel');
  });
  it('open at end includes earlier cases and excludes later closure', () => {
    const report=regulatoryReport([row({received_at:'2024-01-01',closed_at:null,status:'received'}),row({closed_at:'2024-03-01'})],range);
    expect(report.summary.find(s=>s.label==='Open at period end')?.value).toBe(2);
    expect(report.summary.find(s=>s.label==='Resolved')?.value).toBe(0);
  });
});
describe('real PDF output', () => {
  it('contains all sections and correct page X of Y text in generated Unicode output', () => {
    const fonts={normal:readFileSync('public/fonts/privacy-sans.ttf').toString('base64'),bold:readFileSync('public/fonts/privacy-sans-bold.ttf').toString('base64')};
    const report=regulatoryReport([row()],range);
    const doc=regulatoryPackPdf({name:'Firma Łódź',address:'Réclamation',licence:'payment_institution',generatedBy:'Owner',generatedAt:'2024-03-01T12:00:00Z'},report,fonts);
    const pdf=doc.output();
    // DejaVu encodes text as glyph IDs. Encode expected strings using the actual font cmap.
    const encode=(text:string,style:'normal'|'bold'='normal') => {doc.setFont('RedressSans',style);const font=doc.getFont() as unknown as {metadata:{characterToGlyph:(c:number)=>number}};return [...text].map(c=>font.metadata.characterToGlyph(c.codePointAt(0)??0).toString(16).padStart(4,'0')).join('');};
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(8);
    for(const text of ['Regulatory reporting pack','Summary',...report.tables.map(t=>t.title),'Methodology'])expect(pdf.toLowerCase()).toContain(encode(text,'bold'));
    for(let i=1;i<=doc.getNumberOfPages();i++)expect(pdf.toLowerCase()).toContain(encode(`Page ${i} of ${doc.getNumberOfPages()}`));
  });
});
