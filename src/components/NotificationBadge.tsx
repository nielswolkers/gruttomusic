import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface NotificationBadgeProps {
  collapsed?: boolean;
}

export function NotificationBadge({ collapsed = false }: NotificationBadgeProps) {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (user) {
      loadUnreadCount();
      
      // Subscribe to changes for immediate updates
      const channel = supabase
        .channel('notifications-count-realtime')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `recipient_id=eq.${user.id}`,
          },
          () => {
            loadUnreadCount();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const loadUnreadCount = async () => {
    if (!user) return;

    const { count, error } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("recipient_id", user.id)
      .eq("read_status", false);

    if (!error && count !== null) {
      setUnreadCount(count);
    }
  };

  if (unreadCount === 0) return null;

  // Collapsed state: show just a red dot
  if (collapsed) {
    return (
      <span className="absolute -top-0.5 -right-0.5 bg-destructive rounded-full w-2.5 h-2.5" />
    );
  }

  // Expanded state: show the count
  return (
    <span className="ml-auto bg-destructive text-destructive-foreground text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0">
      {unreadCount > 99 ? "99+" : unreadCount}
    </span>
  );
}
