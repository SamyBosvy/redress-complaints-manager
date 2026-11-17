import { z } from 'zod';
import { CATEGORIES, PRODUCTS } from './complaints';
import { INTAKE_CORRESPONDENCE_LANGUAGES } from './public-form-i18n';

export const DEFAULT_PRIVACY_NOTICE = 'We use the information you provide to investigate and respond to your complaint. Please do not include passwords, PINs or full card numbers. Contact the firm for its full privacy notice and information about your data protection rights.';
export const publicComplaintSchema = z.object({
  form_id: z.string().uuid(), submission_id: z.string().uuid(),
  complainant_name: z.string().trim().min(1, 'Your name is required').max(200),
  complainant_email: z.string().trim().email('Enter a valid email address').max(255).or(z.literal('')),
  complainant_phone: z.string().trim().max(50), customer_ref: z.string().trim().max(100),
  country_code: z.string().regex(/^[A-Z]{2}$/, 'Select your country'),
  language: z.enum(INTAKE_CORRESPONDENCE_LANGUAGES),
  product: z.enum(Object.keys(PRODUCTS) as [keyof typeof PRODUCTS, ...Array<keyof typeof PRODUCTS>]),
  category: z.enum(Object.keys(CATEGORIES) as [keyof typeof CATEGORIES, ...Array<keyof typeof CATEGORIES>]),
  summary: z.string().trim().min(1, 'Tell us about your complaint').max(10000),
  desired_outcome: z.string().trim().max(5000), vulnerable: z.boolean(), vulnerable_note: z.string().trim().max(1000),
  privacy_acknowledged: z.literal(true, { errorMap: () => ({ message: 'Please acknowledge the privacy notice' }) }),
  privacy_notice: z.string().min(1).max(10000), website: z.string().max(0),
});
export type PublicComplaintInput = z.infer<typeof publicComplaintSchema>;
export type PublicFormDetails = { id: string; firm_name: string; privacy_notice: string; logo_url: string | null; countries: string[] };
const escapeAttribute = (s: string) => s.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
export function formShareLinks(origin: string, id: string, name: string) {
  const url = new URL(`/complain/${z.string().uuid().parse(id)}`, origin).href;
  return { url, embed: `<iframe src="${escapeAttribute(url)}?embed=1" title="${escapeAttribute(name)} complaint form" width="100%" height="1200" style="border:0" loading="lazy"></iframe>` };
}
