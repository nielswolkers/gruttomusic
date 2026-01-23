import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CLIENT_ID = "551498588751-aiuojj5bprqmhi3g4545mu2d3mri7v5r.apps.googleusercontent.com";
const CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET") || "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";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { access_token, refresh_token, time_min, time_max } = await req.json();

    let token = access_token;

    // Try to refresh token if access token doesn't work
    const testResponse = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=1`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!testResponse.ok && refresh_token) {
      // Refresh the token
      const refreshResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          refresh_token: refresh_token,
          grant_type: "refresh_token",
        }),
      });

      if (refreshResponse.ok) {
        const refreshData = await refreshResponse.json();
        token = refreshData.access_token;
      }
    }

    // Get calendar list
    const calendarsResponse = await fetch(
      "https://www.googleapis.com/calendar/v3/users/me/calendarList",
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!calendarsResponse.ok) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch calendars", new_token: token }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const calendars = await calendarsResponse.json();
    const allEvents: any[] = [];

    // Fetch events from all calendars
    for (const calendar of calendars.items || []) {
      try {
        const eventsUrl = new URL(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendar.id)}/events`
        );
        eventsUrl.searchParams.set("maxResults", "250");
        eventsUrl.searchParams.set("singleEvents", "true");
        eventsUrl.searchParams.set("orderBy", "startTime");
        
        if (time_min) eventsUrl.searchParams.set("timeMin", time_min);
        if (time_max) eventsUrl.searchParams.set("timeMax", time_max);

        const eventsResponse = await fetch(eventsUrl.toString(), {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (eventsResponse.ok) {
          const eventsData = await eventsResponse.json();
          for (const event of eventsData.items || []) {
            if (event.status !== "cancelled") {
              allEvents.push({
                id: event.id,
                title: event.summary || "(Geen titel)",
                start: event.start?.dateTime || event.start?.date,
                end: event.end?.dateTime || event.end?.date,
                allDay: !event.start?.dateTime,
                calendarName: calendar.summary,
                calendarColor: calendar.backgroundColor,
              });
            }
          }
        }
      } catch (e) {
        console.error(`Failed to fetch events for calendar ${calendar.id}:`, e);
      }
    }

    return new Response(
      JSON.stringify({ events: allEvents, new_token: token !== access_token ? token : null }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error fetching Google Calendar events:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
