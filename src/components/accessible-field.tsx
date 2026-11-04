import { useId, type ReactNode } from 'react';
import { Label } from '@/components/ui/label';
import { FieldContext } from '@/lib/field-context';

/** Associate labels with nested native and Radix controls, including paired amount/currency fields. */
export function AccessibleField({ label, children }: { label: string; children: ReactNode }) {
  const id = useId();
  return <FieldContext.Provider value={id}><div className="space-y-1.5"><Label id={`${id}-label`} htmlFor={id}>{label}</Label>{children}</div></FieldContext.Provider>;
}