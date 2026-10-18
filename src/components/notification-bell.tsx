import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { notificationsQuery } from "@/lib/qa";

export function NotificationBell() {
  const qc = useQueryClient();
  const { data: notes = [] } = useQuery(notificationsQuery);
  const unread = notes.filter((n) => !n.read_at);

  async function markAllRead() {
    const ids = unread.map((n) => n.id);
    if (!ids.length) return;
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).in("id", ids);
    qc.invalidateQueries({ queryKey: ["notifications"] });
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Notifications" className="relative">
          <Bell className="h-4 w-4" />
          {unread.length > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground tabular">
              {unread.length > 9 ? "9+" : unread.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-4 py-2.5">
          <p className="text-sm font-medium">Notifications</p>
          {unread.length > 0 && <button className="text-xs text-primary hover:underline" onClick={markAllRead}>Mark all read</button>}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {notes.length === 0 && <p className="px-4 py-8 text-center text-sm text-muted-foreground">No notifications.</p>}
          {notes.map((n) => (
            <div key={n.id} className={`border-b px-4 py-3 text-sm last:border-0 ${n.read_at ? "text-muted-foreground" : ""}`}>
              {n.complaint_id ? (
                <Link to="/app/c/$id" params={{ id: n.complaint_id }} className="hover:underline">{n.title}</Link>
              ) : n.title}
              <p className="mt-0.5 text-xs text-muted-foreground tabular">{new Date(n.created_at).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
