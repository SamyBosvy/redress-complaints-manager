import { Select,SelectContent,SelectItem,SelectTrigger,SelectValue } from './ui/select';
import { rootCauseLabel, type RootCause } from '@/lib/root-causes';
export function RootCauseSelect({value,legacy,causes,onChange,disabled=false}:{value:string;legacy?:string|null;causes:RootCause[];onChange:(value:string)=>void;disabled?:boolean}) {
  const options=causes.filter(c=>c.active || c.id===value);
  return <div className="space-y-1">{!value && legacy && <p className="text-sm text-muted-foreground">Legacy: {legacy}</p>}<Select value={value} disabled={disabled} onValueChange={onChange}><SelectTrigger><SelectValue placeholder="Choose root cause">{value ? rootCauseLabel(value,legacy,causes) : undefined}</SelectValue></SelectTrigger><SelectContent>{options.map(c=><SelectItem value={c.id} key={c.id}>{c.name}{!c.active?' (inactive)':''}</SelectItem>)}</SelectContent></Select></div>;
}