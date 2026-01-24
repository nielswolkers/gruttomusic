-- Allow invitees to see events they are invited to
CREATE POLICY "Users can view events they are invited to"
ON public.calendar_events
FOR SELECT
USING (
  auth.uid() = user_id OR
  EXISTS (
    SELECT 1 FROM public.event_invitations
    WHERE event_invitations.event_id = calendar_events.id
    AND event_invitations.invitee_id = auth.uid()
  )
);