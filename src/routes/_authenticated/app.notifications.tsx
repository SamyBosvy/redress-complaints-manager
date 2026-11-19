import { createFileRoute } from '@tanstack/react-router';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useMembership, membershipQuery } from '@/lib/org';
import { membersQuery } from '@/lib/complaints';
import { pageHead } from '@/lib/settings';
import { notificationListQuery, parseNotificationSearch, setNotificationRead, NOTIFICATION_KINDS } from '@/lib/notifications';
import { NotificationItem } from '@/components/notification-item';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TableSkeleton } from '@/components/table-skeleton';
export const Route=createFileRoute('/_authenticated/app/notifications')({validateSearch:parseNotificationSearch,loaderDeps:({search})=>({search}),loader:async({context,deps})=>{const m=await context.queryClient.ensureQueryData(membershipQuery);if(m?.org)await context.queryClient.ensureQueryData(notificationListQuery(m.user.id,m.org.id,deps.search));},head:()=>pageHead('Notifications','Your personal in-app case notifications.'),component:Notifications});
function Notifications(){const m=useMembership();if(!m?.org)return null;return <NotificationPage user={m.user.id} org={m.org.id}/>;}
function NotificationPage({user,org}:{user:string;org:string}){
  const search=Route.useSearch(),navigate=Route.useNavigate(),qc=useQueryClient();
  const q=useQuery({...notificationListQuery(user,org,search),placeholderData:keepPreviousData}),members=useQuery(membersQuery(org));
  async function mark(id:string|null,read=true){try{await setNotificationRead(user,org,id,read);await qc.invalidateQueries({queryKey:['notifications']});}catch{toast.error('Could not update read status.');}}
  return <div className="mx-auto max-w-3xl space-y-5"><h1 className="text-2xl font-semibold">Notifications</h1><div className="flex flex-wrap items-center gap-4"><Select value={search.kind??'all'} onValueChange={kind=>void navigate({search:prev=>({...prev,kind:parseNotificationSearch({kind}).kind,page:1})})}><SelectTrigger aria-label="Notification kind" className="w-52"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">All kinds</SelectItem>{Object.entries(NOTIFICATION_KINDS).map(([k,l])=><SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent></Select><Label className="flex items-center gap-2"><Checkbox checked={!!search.unread} onCheckedChange={v=>void navigate({search:prev=>({...prev,unread:v===true?true:undefined,page:1})})}/>Unread only</Label><Button variant="outline" onClick={()=>void mark(null)}>Mark all read</Button></div>{q.isPending?<TableSkeleton columns={2}/>:q.isError?<p role="alert" className="text-destructive">Could not load notifications.</p>:<><ul className="divide-y">{q.data.rows.map(n=><li key={n.id} className="flex flex-col gap-2 py-2 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><NotificationItem note={n} actor={n.actor?members.data?.find(x=>x.user_id===n.actor)?.name??'Firm member':'System'} onOpen={()=>void mark(n.id)}/></div><Button variant="ghost" size="sm" onClick={()=>void mark(n.id,!!n.read_at)}>{n.read_at?'Mark unread':'Mark read'}</Button></li>)}</ul>{!q.data.rows.length&&<p className="py-8 text-muted-foreground">No notifications match this view.</p>}<div className="flex items-center justify-between gap-3"><Button variant="outline" disabled={(search.page??1)<=1||q.isPlaceholderData} onClick={()=>void navigate({search:prev=>({...prev,page:(search.page??1)-1})})}>Previous</Button><span className="text-sm">Page {search.page??1} · {q.data.total} notifications</span><Button variant="outline" disabled={(search.page??1)*50>=q.data.total||q.isPlaceholderData} onClick={()=>void navigate({search:prev=>({...prev,page:(search.page??1)+1})})}>Next</Button></div></>}</div>;
}