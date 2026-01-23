import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { getGoogleRedirectUri } from "@/auth/googleAuth";

const GoogleCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [processing, setProcessing] = useState(true);

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get("code");
      const state = searchParams.get("state");
      const savedState = localStorage.getItem("google_state");

      if (!code) {
        toast.error("Geen autorisatiecode ontvangen");
        navigate("/account");
        return;
      }

      if (state !== savedState) {
        toast.error("Ongeldige state parameter");
        navigate("/account");
        return;
      }

      if (!user) {
        toast.error("Je moet ingelogd zijn");
        navigate("/auth");
        return;
      }

      try {
        // Exchange code for tokens via edge function
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-calendar-callback`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
            body: JSON.stringify({
              code,
              redirect_uri: getGoogleRedirectUri(),
            }),
          }
        );

        if (!response.ok) {
          throw new Error("Kon tokens niet ophalen");
        }

        const data = await response.json();

        // Check if this is a first-time connection
        const { data: existingConnection } = await supabase
          .from("google_calendar_connections")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();

        const isFirstConnection = !existingConnection;

        // Save or update the connection
        if (existingConnection) {
          await supabase
            .from("google_calendar_connections")
            .update({
              google_email: data.user.email,
              google_name: data.user.name,
              access_token: data.access_token,
              refresh_token: data.refresh_token,
              token_expiry: new Date(Date.now() + data.expires_in * 1000).toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", user.id);
        } else {
          await supabase.from("google_calendar_connections").insert({
            user_id: user.id,
            google_email: data.user.email,
            google_name: data.user.name,
            access_token: data.access_token,
            refresh_token: data.refresh_token,
            token_expiry: new Date(Date.now() + data.expires_in * 1000).toISOString(),
          });
        }

        // Send notification for first-time connection
        if (isFirstConnection) {
          await supabase.from("notifications").insert({
            recipient_id: user.id,
            sender_id: user.id,
            type: "calendar_connected",
            message: "Google Agenda is succesvol gekoppeld",
          });
        }

        localStorage.removeItem("google_state");
        toast.success("Google Agenda gekoppeld!");
        navigate("/account");
      } catch (error) {
        console.error("Google callback error:", error);
        toast.error("Kon Google Agenda niet koppelen");
        navigate("/account");
      }
    };

    handleCallback();
  }, [searchParams, navigate, user]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-muted-foreground">Google Agenda koppelen...</p>
      </div>
    </div>
  );
};

export default GoogleCallback;
