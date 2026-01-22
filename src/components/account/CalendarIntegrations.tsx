import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Calendar, Link, Trash2 } from "lucide-react";

interface CalendarConnection {
  id: string;
  provider: string;
  ics_url: string;
  display_name: string | null;
  connected_at: string;
}

const CalendarIntegrations = () => {
  const { user } = useAuth();
  const [connections, setConnections] = useState<CalendarConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<'zermelo' | 'outlook' | null>(null);
  const [icsUrl, setIcsUrl] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) loadConnections();
  }, [user]);

  const loadConnections = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('calendar_connections')
        .select('*')
        .eq('user_id', user.id)
        .order('connected_at', { ascending: false });

      if (error) throw error;
      setConnections(data || []);
    } catch (error) {
      console.error('Failed to load calendar connections:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    if (!user || !selectedProvider || !icsUrl.trim()) {
      toast.error("Voer een geldige ICS URL in");
      return;
    }

    setSaving(true);
    try {
      // Validate the ICS URL by trying to fetch it
      const response = await fetch(icsUrl.trim());
      if (!response.ok) {
        throw new Error("Kon de kalender niet ophalen. Controleer de URL.");
      }
      
      const content = await response.text();
      if (!content.includes('BEGIN:VCALENDAR')) {
        throw new Error("Dit is geen geldige ICS kalender URL.");
      }

      const { error } = await supabase
        .from('calendar_connections')
        .insert({
          user_id: user.id,
          provider: selectedProvider,
          ics_url: icsUrl.trim(),
          display_name: displayName.trim() || null,
        });

      if (error) throw error;

      // Create notification
      await supabase.from('notifications').insert({
        recipient_id: user.id,
        sender_id: user.id,
        type: 'calendar_connected',
        message: `${selectedProvider === 'zermelo' ? 'Zermelo' : 'Outlook'} kalender is succesvol gekoppeld`,
      });

      toast.success(`${selectedProvider === 'zermelo' ? 'Zermelo' : 'Outlook'} kalender gekoppeld`);
      setDialogOpen(false);
      setSelectedProvider(null);
      setIcsUrl("");
      setDisplayName("");
      loadConnections();
    } catch (error: any) {
      toast.error(error.message || "Kon kalender niet koppelen");
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async (connection: CalendarConnection) => {
    if (!user) return;
    try {
      await supabase.from('calendar_connections').delete().eq('id', connection.id);
      toast.success("Kalender ontkoppeld");
      loadConnections();
    } catch (error) {
      toast.error("Kon kalender niet ontkoppelen");
    }
  };

  const openConnectDialog = (provider: 'zermelo' | 'outlook') => {
    setSelectedProvider(provider);
    setDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-20 bg-muted rounded-xl" />
        <div className="h-20 bg-muted rounded-xl" />
      </div>
    );
  }

  const zermeloConnection = connections.find(c => c.provider === 'zermelo');
  const outlookConnection = connections.find(c => c.provider === 'outlook');

  return (
    <div className="space-y-4">
      {/* Zermelo */}
      <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#3B82F6]/10 flex items-center justify-center">
            <Calendar className="w-5 h-5 text-[#3B82F6]" />
          </div>
          <div>
            <p className="font-medium">Zermelo</p>
            <p className="text-sm text-muted-foreground">
              {zermeloConnection 
                ? zermeloConnection.display_name || 'Verbonden' 
                : 'Schoolrooster synchronisatie'}
            </p>
          </div>
        </div>
        
        {zermeloConnection ? (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-primary">
              <div className="w-2 h-2 bg-primary rounded-full"></div>
              <span className="text-sm">Actief</span>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => handleDisconnect(zermeloConnection)} 
              className="rounded-full"
            >
              Ontkoppelen
            </Button>
          </div>
        ) : (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => openConnectDialog('zermelo')} 
            className="rounded-full"
          >
            Verbinden
          </Button>
        )}
      </div>

      {/* Outlook */}
      <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#8B5CF6]/10 flex items-center justify-center">
            <Calendar className="w-5 h-5 text-[#8B5CF6]" />
          </div>
          <div>
            <p className="font-medium">Outlook</p>
            <p className="text-sm text-muted-foreground">
              {outlookConnection 
                ? outlookConnection.display_name || 'Verbonden' 
                : 'Microsoft 365 kalender'}
            </p>
          </div>
        </div>
        
        {outlookConnection ? (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-primary">
              <div className="w-2 h-2 bg-primary rounded-full"></div>
              <span className="text-sm">Actief</span>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => handleDisconnect(outlookConnection)} 
              className="rounded-full"
            >
              Ontkoppelen
            </Button>
          </div>
        ) : (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => openConnectDialog('outlook')} 
            className="rounded-full"
          >
            Verbinden
          </Button>
        )}
      </div>

      {/* Connect Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedProvider === 'zermelo' ? 'Zermelo' : 'Outlook'} koppelen
            </DialogTitle>
            <DialogDescription>
              Voer de ICS kalender link in om je {selectedProvider === 'zermelo' ? 'schoolrooster' : 'Outlook kalender'} te synchroniseren.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="icsUrl">ICS Kalender URL</Label>
              <div className="relative">
                <Link className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="icsUrl"
                  value={icsUrl}
                  onChange={(e) => setIcsUrl(e.target.value)}
                  placeholder="https://..."
                  className="pl-10"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {selectedProvider === 'zermelo' 
                  ? "Je vindt deze link in Zermelo onder Instellingen → Koppeling → ICS"
                  : "Ga naar Outlook → Kalender → Instellingen → Gedeelde kalenders → Publiceren"}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="displayName">Weergavenaam (optioneel)</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={selectedProvider === 'zermelo' ? "Mijn rooster" : "Werk kalender"}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="rounded-full">
              Annuleren
            </Button>
            <Button onClick={handleConnect} disabled={saving || !icsUrl.trim()} className="rounded-full">
              {saving ? "Koppelen..." : "Koppelen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CalendarIntegrations;
