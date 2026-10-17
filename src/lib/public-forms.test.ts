import { describe, expect, it } from 'vitest';
import { formShareLinks, publicComplaintSchema } from './public-forms';
const valid = { form_id: '10000000-0000-4000-8000-000000000001', submission_id: '20000000-0000-4000-8000-000000000002', complainant_name: 'Test Customer', complainant_email: 'test@example.com', complainant_phone: '', customer_ref: '', country_code: 'IE', language: 'en', product: 'card', category: 'fees_and_charges', summary: 'I dispute this fee.', desired_outcome: '', vulnerable: false, vulnerable_note: '', privacy_acknowledged: true, privacy_notice: 'Test privacy notice.', website: '' };
describe('Public complaint intake', () => {
  it('requires a privacy acknowledgement', () => { expect(publicComplaintSchema.safeParse({ ...valid, privacy_acknowledged: false }).success).toBe(false); });
  it('accepts valid public complaint details', () => { expect(publicComplaintSchema.parse(valid).summary).toBe('I dispute this fee.'); });
  it('rejects oversized complaint descriptions', () => { expect(publicComplaintSchema.safeParse({ ...valid, summary: 'x'.repeat(10001) }).success).toBe(false); });
  it('rejects filled spam trap fields', () => { expect(publicComplaintSchema.safeParse({ ...valid, website: 'spam' }).success).toBe(false); });
  it('strips customer-supplied status so callers cannot set the handling state', () => { expect(publicComplaintSchema.parse({ ...valid, status: 'closed' })).not.toHaveProperty('status'); });
  it('uses the same firm identifier for public and embedded forms and escapes names', () => { const links = formShareLinks('https://example.com', valid.form_id, 'Firm "A" <B>'); expect(links.url).toBe('https://example.com/complain/10000000-0000-4000-8000-000000000001'); expect(links.embed).toContain(`${links.url}?embed=1`); expect(links.embed).toContain('Firm &quot;A&quot; &lt;B&gt;'); });
});
