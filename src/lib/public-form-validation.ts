import type { ZodIssue } from 'zod';
import { publicFormIssueMessage, type PublicFormLanguage } from './public-form-i18n';

const FIELD_IDS: Record<string, string> = {
  complainant_name: 'name', customer_ref: 'customer-ref', complainant_email: 'email',
  complainant_phone: 'phone', country_code: 'country', language: 'language', product: 'product',
  category: 'category', summary: 'summary', desired_outcome: 'outcome', adjustments: 'support-needs',
  adjustments_note: 'support', customer_consented: 'support-consent', privacy_acknowledged: 'privacy-acknowledged',
};

export function formValidationSummary(issues: readonly ZodIssue[], language: PublicFormLanguage) {
  const seen = new Set<string>();
  return issues.flatMap(issue => {
    const id = FIELD_IDS[String(issue.path[0])];
    if (!id || seen.has(id)) return [];
    seen.add(id);
    return [{ id, message: publicFormIssueMessage(issue, language) }];
  });
}