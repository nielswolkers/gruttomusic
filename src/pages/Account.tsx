import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { User, Mail, AtSign, Save } from "lucide-react";

const Account = () => {
  const { user, signOut } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<{ full_name: string; username: string; display_name: string | null } | null>(null);
  const [formData, setFormData] = useState({ full_name: "", username: "", display_name: "" });

  useEffect(() => {
    if (user) loadProfile();
  }, [user]);

  const loadProfile = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase.from('profiles').select('*').eq('user_id', user.id).single();
      if (error) throw error;
      setProfile(data);
      setFormData({ full_name: data.full_name || "", username: data.username || "", display_name: data.display_name || "" });
    } catch (error) {
      console.error("Failed to load profile:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user || !formData.username.trim() || !formData.full_name.trim()) {
      toast.error("Vul alle verplichte velden in");
      return;
    }

    setSaving(true);
    try {
      const { data: existingUser } = await supabase.from('profiles').select('id').eq('username', formData.username).neq('user_id', user.id).single();
      if (existingUser) {
        toast.error("Deze gebruikersnaam is al in gebruik");
        setSaving(false);
        return;
      }

      const { error } = await supabase.from('profiles').update({
        full_name: formData.full_name.trim(),
        username: formData.username.trim(),
        display_name: formData.display_name.trim() || null,
      }).eq('user_id', user.id);

      if (error) throw error;
      toast.success("Profiel bijgewerkt");
      loadProfile();
    } catch (error) {
      toast.error("Kon profiel niet bijwerken");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
  }

  return (
    <div className="w-full max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold">Account</h1>

      <Card>
        <CardHeader>
          <CardTitle>Profiel Informatie</CardTitle>
          <CardDescription>Beheer je account gegevens</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">E-mailadres</Label>
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-muted-foreground" />
              <Input id="email" value={user?.email || ""} disabled className="bg-muted" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="full_name">Volledige naam *</Label>
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-muted-foreground" />
              <Input id="full_name" value={formData.full_name} onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))} placeholder="Jan de Vries" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="username">Gebruikersnaam *</Label>
            <div className="flex items-center gap-2">
              <AtSign className="w-4 h-4 text-muted-foreground" />
              <Input id="username" value={formData.username} onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value.toLowerCase().replace(/\s/g, '') }))} placeholder="jandevries" />
            </div>
            <p className="text-xs text-muted-foreground">Anderen kunnen je vinden met deze gebruikersnaam</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="display_name">Weergavenaam</Label>
            <Input id="display_name" value={formData.display_name} onChange={(e) => setFormData(prev => ({ ...prev, display_name: e.target.value }))} placeholder="Optionele weergavenaam" />
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full">
            <Save className="w-4 h-4 mr-2" />
            {saving ? "Opslaan..." : "Opslaan"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Account Acties</CardTitle>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={signOut}>Uitloggen</Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Account;
