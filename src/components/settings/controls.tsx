import { AccessibleField } from '@/components/accessible-field';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
export function Field({label,children}: {label:string;children:React.ReactNode}) { return <AccessibleField label={label}>{children}</AccessibleField>; }
export function Pick({value,onChange,options,disabled=false,label}: {value:string;onChange:(v:string)=>void;options:Record<string,string>;disabled?:boolean;label?:string}) { return <Select value={value} onValueChange={onChange} disabled={disabled}><SelectTrigger aria-label={label}><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{Object.entries(options).map(([v,l])=><SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select>; }
