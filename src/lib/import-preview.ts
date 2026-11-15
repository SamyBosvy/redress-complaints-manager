import { PRODUCTS } from './complaints';
import { COUNTRIES } from './countries';
export function importPreviewLabel(field: 'product' | 'country_code', mapped: string | null | undefined, raw: string) {
  const labels: Record<string,string> = field === 'product' ? PRODUCTS : COUNTRIES;
  return mapped && labels[mapped] ? labels[mapped] : raw;
}