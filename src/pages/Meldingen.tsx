import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { FileText, FileIcon, Undo2, Trash2, Calendar } from "lucide-react";
import { toast } from "sonner";
import { formatRelativeDate } from "@/lib/dateUtils";
import { useAuth } from "@/hooks/useAuth";

interface Notification {
  id: string;
  message: string;
  type: string;
  read_status: boolean;
  created_at: string;
  sender_id: string;
  file_id: string | null;
  profiles?: { username: string; display_name: string | null };
  files?: { filename: string; file_size: number };
}

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
};

const Meldingen = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) loadNotifications();
  }, [user]);

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
      const { data: profiles } = await supabase.from('profiles').select('id, username, display_name').in('id', senderIds);

      const fileIds = [...new Set(notifData?.filter(n => n.file_id).map(n => n.file_id!) || [])];
      let fileMap = new Map();
      if (fileIds.length > 0) {
        const { data: files } = await supabase.from('files').select('id, filename, file_size').in('id', fileIds);
        fileMap = new Map(files?.map(f => [f.id, f]) || []);
      }

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
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

  if (!user) return null;

  return (
    <div className="w-full max-w-4xl">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-semibold">Meldingen</h1>
        <Button 
          size="sm" 
          variant="secondary" 
          onClick={markAllAsRead}
          className="rounded-full px-4 h-9 bg-muted hover:bg-muted/80"
        >
          Wis alles
        </Button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      )}

      {!loading && notifications.length === 0 && (
        <div className="text-center py-12">
          <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Geen meldingen</p>
        </div>
      )}

      {!loading && (
        <div className="space-y-4">
          {notifications.map((notification) => {
            const isDeleteNotification = notification.type === 'file_deleted' || notification.type === 'folder_deleted';
            const isShareNotification = notification.type === 'file_shared';
            const isReminderNotification = notification.type === 'reminder';

            return (
              <div 
                key={notification.id} 
                className={`rounded-2xl border p-5 ${
                  isReminderNotification 
                    ? 'border-destructive/30 bg-destructive/5' 
                    : 'bg-card border-border'
                }`}
              >
                {/* Header with message and dismiss button */}
                <div className="flex items-start justify-between gap-4 mb-3">
                  <p className="text-[15px] flex-1">
                    {isDeleteNotification ? (
                      notification.type === 'folder_deleted' 
                        ? 'U heeft een map naar de prullenbak verplaatst.' 
                        : 'U heeft een bestand naar de prullenbak verplaatst.'
                    ) : isShareNotification ? (
                      <>
                        <span className="font-semibold">
                          {notification.profiles?.display_name || notification.profiles?.username}
                        </span>
                        {' '}heeft een bestand met u gedeeld.
                      </>
                    ) : isReminderNotification ? (
                      notification.message
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

                {/* File/Reminder info card */}
                {(notification.files || isReminderNotification) && (
                  <div className="bg-secondary/50 rounded-xl p-4 mb-3">
                    <div className="flex items-center gap-3">
                      {isReminderNotification ? (
                        <Calendar className="w-5 h-5 text-muted-foreground shrink-0" />
                      ) : (
                        <FileIcon className="w-5 h-5 text-muted-foreground shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">
                          {isReminderNotification ? 'SO H9 (2x)' : notification.files?.filename}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {isReminderNotification ? 'Woensdag 10 December' : formatFileSize(notification.files?.file_size || 0)}
                        </p>
                      </div>
                    </div>
                    {isReminderNotification && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Advies door <span className="text-primary">Grutto Reminders</span>
                      </p>
                    )}
                  </div>
                )}

                {/* Action buttons for delete notifications */}
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

                {/* Timestamp */}
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
