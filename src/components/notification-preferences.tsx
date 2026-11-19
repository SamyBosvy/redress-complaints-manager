import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { NOTIFICATION_KINDS, alwaysOn, notificationPreferencesQuery, type NotificationKind } from '@/lib/notifications';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
export function NotificationPreferences({user,org}:{user:string;org:string}){
  const qc=useQueryClient(),q=useQuery(notificationPreferencesQuery(user,org));const [busy,setBusy]=useState(false);
  async function change(kind:NotificationKind,in_app:boolean){setBusy(true);try{const {error}=await supabase.from('notification_preferences').upsert({user_id:user,org_id:org,kind,in_app});if(error)throw error;await qc.invalidateQueries({queryKey:['notification-preferences',user,org]});}catch{toast.error('Could not save notification preferences.');}finally{setBusy(false);}}
  return <section className="space-y-3 border-t pt-6"><h2 className="font-semibold">Notifications</h2>{q.isError?<p role="alert" className="text-destructive">Could not load preferences.</p>:Object.entries(NOTIFICATION_KINDS).map(([kind,label])=><div key={kind} className="flex items-center justify-between gap-4"><Label htmlFor={`notify-${kind}`}>{label}{alwaysOn(kind)&&<span className="ml-2 text-xs text-muted-foreground">Always on</span>}</Label><Switch id={`notify-${kind}`} checked={alwaysOn(kind)||q.data?.find(p=>p.kind===kind)?.in_app!==false} disabled={alwaysOn(kind)||busy||q.isPending} onCheckedChange={value=>void change(kind as NotificationKind,value)}/></div>)}</section>;
}