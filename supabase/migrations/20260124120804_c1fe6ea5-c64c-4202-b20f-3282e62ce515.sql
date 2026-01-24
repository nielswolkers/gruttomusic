-- Add profile pictures and study goal to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS avatar_url text,
ADD COLUMN IF NOT EXISTS study_goal_minutes integer NOT NULL DEFAULT 120;

-- Add toets as a valid event type (for documentation - types are stored as text)

-- Create group_messages table for study group chat
CREATE TABLE public.group_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id uuid NOT NULL REFERENCES public.study_groups(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  content text,
  file_id uuid REFERENCES public.files(id) ON DELETE SET NULL,
  task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on group_messages
ALTER TABLE public.group_messages ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view messages in groups they belong to
CREATE POLICY "Users can view messages in their groups"
ON public.group_messages
FOR SELECT
USING (
  is_group_member(auth.uid(), group_id) OR is_group_owner(auth.uid(), group_id)
);

-- Policy: Users can send messages in groups they belong to
CREATE POLICY "Users can send messages in their groups"
ON public.group_messages
FOR INSERT
WITH CHECK (
  auth.uid() = sender_id AND 
  (is_group_member(auth.uid(), group_id) OR is_group_owner(auth.uid(), group_id))
);

-- Policy: Users can delete their own messages
CREATE POLICY "Users can delete their own messages"
ON public.group_messages
FOR DELETE
USING (auth.uid() = sender_id);

-- Enable realtime for group_messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_messages;