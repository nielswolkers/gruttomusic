import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { FileIcon, Undo2, Trash2, Bell, Calendar, Users, Check, X } from "lucide-react";
import { toast } from "sonner";
import { formatRelativeDate } from "@/lib/dateUtils";
import { useAuth } from "@/hooks/useAuth";
import { format, parseISO } from "date-fns";
import { nl } from "date-fns/locale";

interface Notification {
  id: string;
  message: string;
  type: string;
  read_status: boolean;
  created_at: string;
  sender_id: string;
  file_id: string | null;
  profiles?: { username: string; display_name: string | null; full_name: string };
  files?: { id: string; filename: string; file_size: number; deleted_at: string | null };
}

interface EventInvitation {
  id: string;
  event_id: string;
  status: string;
  event?: {
    id: string;
    title: string;
    start_time: string;
    end_time: string;
  };
  inviter?: {
    full_name: string;
    display_name: string | null;
  };
}

interface GroupInvitation {
  id: string;
  group_id: string;
  status: string;
  group?: {
    id: string;
    name: string;
  };
  inviter?: {
    full_name: string;
    display_name: string | null;
  };
}

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
};

const Meldingen = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [eventInvitations, setEventInvitations] = useState<EventInvitation[]>([]);
  const [groupInvitations, setGroupInvitations] = useState<GroupInvitation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadNotifications();
      loadEventInvitations();
      loadGroupInvitations();
      markAllAsReadOnOpen();
    }
  }, [user]);

  const markAllAsReadOnOpen = async () => {
    if (!user) return;
    
    await supabase
      .from('notifications')
      .update({ read_status: true })
      .eq('recipient_id', user.id)
      .eq('read_status', false);
  };

  const loadEventInvitations = async () => {
    if (!user) return;

    try {
      const { data: invitations } = await supabase
        .from("event_invitations")
        .select("id, event_id, status")
        .eq("invitee_id", user.id)
        .eq("status", "pending");

      if (!invitations || invitations.length === 0) {
        setEventInvitations([]);
        return;
      }

      // Load event details
      const eventIds = invitations.map(i => i.event_id);
      const { data: events } = await supabase
        .from("calendar_events")
        .select("id, title, start_time, end_time, user_id")
        .in("id", eventIds);

      // Load inviter profiles
      const inviterIds = events?.map(e => e.user_id) || [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, display_name")
        .in("user_id", inviterIds);

      const enrichedInvitations = invitations.map(inv => ({
        ...inv,
        event: events?.find(e => e.id === inv.event_id),
        inviter: profiles?.find(p => p.user_id === events?.find(e => e.id === inv.event_id)?.user_id)
      }));

      setEventInvitations(enrichedInvitations);
    } catch (error) {
      console.error("Failed to load event invitations:", error);
    }
  };

  const loadGroupInvitations = async () => {
    if (!user) return;

    try {
      const { data: invitations } = await supabase
        .from("group_members")
        .select("id, group_id, status, invited_by")
        .eq("user_id", user.id)
        .eq("status", "pending");

      if (!invitations || invitations.length === 0) {
        setGroupInvitations([]);
        return;
      }

      // Load group details
      const groupIds = invitations.map(i => i.group_id);
      const { data: groups } = await supabase
        .from("study_groups")
        .select("id, name")
        .in("id", groupIds);

      // Load inviter profiles
      const inviterIds = invitations.map(i => i.invited_by);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, display_name")
        .in("user_id", inviterIds);

      const enrichedInvitations = invitations.map(inv => ({
        ...inv,
        group: groups?.find(g => g.id === inv.group_id),
        inviter: profiles?.find(p => p.user_id === inv.invited_by)
      }));

      setGroupInvitations(enrichedInvitations);
    } catch (error) {
      console.error("Failed to load group invitations:", error);
    }
  };

  const loadNotifications = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      await supabase.from('notifications').delete().eq('recipient_id', user.id).lt('created_at', thirtyDaysAgo.toISOString());

      const { data: notifData, error } = await supabase.from('notifications').select('*').eq('recipient_id', user.id).order('created_at', { ascending: false });
      if (error) throw error;

      const senderIds = [...new Set(notifData?.map(n => n.sender_id) || [])];
      const { data: profiles } = await supabase.from('profiles').select('user_id, username, display_name, full_name').in('user_id', senderIds);

      const fileIds = [...new Set(notifData?.filter(n => n.file_id).map(n => n.file_id!) || [])];
      let fileMap = new Map();
      if (fileIds.length > 0) {
        const { data: files } = await supabase
          .from('files')
          .select('id, filename, file_size, deleted_at')
          .in('id', fileIds);
        fileMap = new Map(files?.map(f => [f.id, f]) || []);
      }

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
      const enrichedNotifications = notifData?.map(n => ({
        ...n,
        profiles: profileMap.get(n.sender_id),
        files: n.file_id ? fileMap.get(n.file_id) : undefined,
      })) || [];

      setNotifications(enrichedNotifications as Notification[]);
    } catch (error) {
      toast.error("Kon meldingen niet laden");
    } finally {
      setLoading(false);
    }
  };

  const respondToEventInvitation = async (invitationId: string, accept: boolean) => {
    try {
      await supabase
        .from("event_invitations")
        .update({ 
          status: accept ? "accepted" : "declined",
          responded_at: new Date().toISOString()
        })
        .eq("id", invitationId);

      toast.success(accept ? "Uitnodiging geaccepteerd" : "Uitnodiging afgewezen");
      loadEventInvitations();
    } catch (error) {
      toast.error("Kon niet reageren op uitnodiging");
    }
  };

  const respondToGroupInvitation = async (invitationId: string, accept: boolean) => {
    try {
      await supabase
        .from("group_members")
        .update({ 
          status: accept ? "accepted" : "declined",
          responded_at: new Date().toISOString()
        })
        .eq("id", invitationId);

      toast.success(accept ? "Uitnodiging geaccepteerd" : "Uitnodiging afgewezen");
      loadGroupInvitations();
    } catch (error) {
      toast.error("Kon niet reageren op uitnodiging");
    }
  };

  const markAsRead = async (notificationId: string) => {
    await supabase.from('notifications').delete().eq('id', notificationId);
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
    toast.success("Melding verwijderd");
  };

  const markAllAsRead = async () => {
    if (notifications.length === 0) return;
    await supabase.from('notifications').delete().eq('recipient_id', user?.id);
    setNotifications([]);
    toast.success("Alle meldingen verwijderd");
  };

  const handleRecoverFile = async (notification: Notification) => {
    if (!notification.file_id) return;
    try {
      await supabase.from('files').update({ deleted_at: null, deleted_by: null }).eq('id', notification.file_id);
      await supabase.from('notifications').delete().eq('id', notification.id);
      toast.success('Bestand hersteld');
      loadNotifications();
    } catch (error) {
      toast.error('Kon bestand niet herstellen');
    }
  };

  const handlePermanentDelete = async (notification: Notification) => {
    if (!notification.file_id) return;
    try {
      const { data: file } = await supabase.from('files').select('storage_url').eq('id', notification.file_id).maybeSingle();
      if (file) await supabase.storage.from('user-files').remove([file.storage_url]);
      await supabase.from('files').delete().eq('id', notification.file_id);
      await supabase.from('notifications').delete().eq('id', notification.id);
      toast.success('Bestand permanent verwijderd');
      loadNotifications();
    } catch (error) {
      toast.error('Kon bestand niet verwijderen');
    }
  };

  const handleFileClick = (notification: Notification) => {
    if (notification.file_id && notification.files && !notification.files.deleted_at) {
      navigate(`/bestanden/preview/${notification.file_id}`);
    }
  };

  if (!user) return null;

  const hasAnyContent = notifications.length > 0 || eventInvitations.length > 0 || groupInvitations.length > 0;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-4xl font-bold text-foreground">Meldingen</h1>
        {notifications.length > 0 && (
          <Button 
            size="sm" 
            variant="secondary" 
            onClick={markAllAsRead}
            className="rounded-full px-4 h-9 bg-muted hover:bg-muted/80"
          >
            Wis alles
          </Button>
        )}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      )}

      {!loading && !hasAnyContent && (
        <div className="text-center py-12">
          <Bell className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Geen meldingen</p>
        </div>
      )}

      {!loading && (
        <div className="space-y-4">
          {/* Event Invitations */}
          {eventInvitations.map((invitation) => (
            <div key={invitation.id} className="rounded-2xl border bg-card border-border p-5">
              <div className="flex items-start justify-between gap-4 mb-3">
                <p className="text-[15px] flex-1">
                  <span className="font-semibold">
                    {invitation.inviter?.display_name || invitation.inviter?.full_name}
                  </span>
                  {' '}heeft u uitgenodigd voor een agenda activiteit.
                </p>
                <Button 
                  size="sm" 
                  variant="secondary" 
                  className="rounded-full px-4 h-8 text-xs bg-muted hover:bg-muted/80 shrink-0"
                >
                  Wis
                </Button>
              </div>

              {invitation.event && (
                <div className="bg-secondary/50 rounded-xl p-4 mb-3">
                  <div className="flex items-center gap-3">
                    <Calendar className="w-5 h-5 text-muted-foreground shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm">{invitation.event.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(parseISO(invitation.event.start_time), "d MMMM HH:mm", { locale: nl })}
                        {" - "}
                        {format(parseISO(invitation.event.end_time), "HH:mm", { locale: nl })}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-2 mb-3">
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="rounded-full h-9"
                  onClick={() => respondToEventInvitation(invitation.id, true)}
                >
                  <Check className="w-4 h-4 mr-2" />
                  Bevestig
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="rounded-full h-9 text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/10"
                  onClick={() => respondToEventInvitation(invitation.id, false)}
                >
                  <X className="w-4 h-4 mr-2" />
                  Wijger
                </Button>
              </div>
            </div>
          ))}

          {/* Group Invitations */}
          {groupInvitations.map((invitation) => (
            <div key={invitation.id} className="rounded-2xl border bg-card border-border p-5">
              <div className="flex items-start justify-between gap-4 mb-3">
                <p className="text-[15px] flex-1">
                  <span className="font-semibold">
                    {invitation.inviter?.display_name || invitation.inviter?.full_name}
                  </span>
                  {' '}heeft u uitgenodigd voor de studiegroep "{invitation.group?.name}".
                </p>
              </div>

              <div className="bg-secondary/50 rounded-xl p-4 mb-3">
                <div className="flex items-center gap-3">
                  <Users className="w-5 h-5 text-muted-foreground shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm">{invitation.group?.name}</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 mb-3">
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="rounded-full h-9"
                  onClick={() => respondToGroupInvitation(invitation.id, true)}
                >
                  <Check className="w-4 h-4 mr-2" />
                  Accepteren
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="rounded-full h-9 text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/10"
                  onClick={() => respondToGroupInvitation(invitation.id, false)}
                >
                  <X className="w-4 h-4 mr-2" />
                  Afwijzen
                </Button>
              </div>
            </div>
          ))}

          {/* Regular Notifications */}
          {notifications.map((notification) => {
            const isDeleteNotification = notification.type === 'file_deleted' || notification.type === 'folder_deleted';
            const isShareNotification = notification.type === 'file_shared';
            const canOpenFile = notification.file_id && notification.files && !notification.files.deleted_at;

            return (
              <div 
                key={notification.id} 
                className="rounded-2xl border bg-card border-border p-5"
              >
                <div className="flex items-start justify-between gap-4 mb-3">
                  <p className="text-[15px] flex-1">
                    {isShareNotification ? (
                      <>
                        <span className="font-semibold">
                          {notification.profiles?.full_name || notification.profiles?.display_name || notification.profiles?.username}
                        </span>
                        {' '}heeft een bestand met u gedeeld.
                      </>
                    ) : (
                      notification.message
                    )}
                  </p>
                  <Button 
                    size="sm" 
                    variant="secondary" 
                    className="rounded-full px-4 h-8 text-xs bg-muted hover:bg-muted/80 shrink-0" 
                    onClick={() => markAsRead(notification.id)}
                  >
                    Wis
                  </Button>
                </div>

                {notification.files && (
                  <div 
                    className={`bg-secondary/50 rounded-xl p-4 mb-3 ${canOpenFile ? 'cursor-pointer hover:bg-secondary/70 transition-colors' : ''}`}
                    onClick={() => canOpenFile && handleFileClick(notification)}
                  >
                    <div className="flex items-center gap-3">
                      <FileIcon className="w-5 h-5 text-muted-foreground shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">
                          {notification.files?.filename}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(notification.files?.file_size || 0)}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {isDeleteNotification && notification.file_id && (
                  <div className="flex gap-2 mb-3">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="rounded-full h-9" 
                      onClick={() => handleRecoverFile(notification)}
                    >
                      <Undo2 className="w-4 h-4 mr-2" />
                      Zet terug
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="rounded-full h-9 text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/10" 
                      onClick={() => handlePermanentDelete(notification)}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Verwijder
                    </Button>
                  </div>
                )}

                <p className="text-sm text-muted-foreground text-right">
                  {formatRelativeDate(notification.created_at)}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Meldingen;
