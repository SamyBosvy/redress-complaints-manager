import { Link } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import { toast } from 'sonner';
import { useMembership } from '@/lib/org';
import { membersQuery } from '@/lib/complaints';
import { notificationListQuery, notificationCountQuery, setNotificationRead } from '@/lib/notifications';
import { NotificationItem } from '@/components/notification-item';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
export function NotificationBell(){const m=useMembership();if(!m?.org)return null;return <BellContent user={m.user.id} org={m.org.id}/>;}
function BellContent({user,org}:{user:string;org:string}){
 const qc=useQueryClient(),q=useQuery(notificationListQuery(user,org,{},20)),count=useQuery(notificationCountQuery(user,org)),members=useQuery(membersQuery(org));
 async function mark(id:string|null){try{await setNotificationRead(user,org,id);await qc.invalidateQueries({queryKey:['notifications']});}catch{toast.error('Could not mark notifications read.');}}
 return <Popover><PopoverTrigger asChild><Button variant="ghost" size="icon" aria-label={`Notifications${count.data?`, ${count.data} unread`:''}`} className="relative"><Bell aria-hidden="true" className="h-4 w-4"/>{!!count.data&&<span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground">{count.data>99?'99+':count.data}</span>}</Button></PopoverTrigger><PopoverContent align="end" className="w-80 max-w-[calc(100vw-2rem)] p-0"><div className="flex items-center justify-between border-b px-4 py-2"><p className="font-medium text-sm">Notifications</p><Button variant="link" size="sm" disabled={!count.data} onClick={()=>void mark(null)}>Mark all read</Button></div><ul className="max-h-96 divide-y overflow-y-auto px-4">{q.data?.rows.map(n=><li key={n.id}><NotificationItem note={n} actor={n.actor?members.data?.find(x=>x.user_id===n.actor)?.name??'Firm member':'System'} onOpen={()=>void mark(n.id)}/></li>)}</ul>{q.isError||count.isError?<p role="alert" className="p-4 text-sm text-destructive">Could not load notifications.</p>:q.isPending?<p className="p-4 text-sm text-muted-foreground">Loading…</p>:!q.data?.rows.length?<p className="p-4 text-sm text-muted-foreground">No notifications.</p>:null}<div className="border-t px-4 py-2"><Button variant="link" asChild><Link to="/app/notifications">See all</Link></Button></div></PopoverContent></Popover>;
}
