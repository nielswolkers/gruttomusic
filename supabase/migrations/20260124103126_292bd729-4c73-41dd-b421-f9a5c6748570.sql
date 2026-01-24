-- Create security definer function to check group membership without recursion
CREATE OR REPLACE FUNCTION public.is_group_member(_user_id uuid, _group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_members
    WHERE user_id = _user_id
      AND group_id = _group_id
      AND status = 'accepted'
  )
$$;

-- Create function to check if user is group owner
CREATE OR REPLACE FUNCTION public.is_group_owner(_user_id uuid, _group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.study_groups
    WHERE id = _group_id
      AND owner_id = _user_id
  )
$$;

-- Drop existing policies on study_groups
DROP POLICY IF EXISTS "Users can view groups they own or are members of" ON public.study_groups;
DROP POLICY IF EXISTS "Users can create their own groups" ON public.study_groups;
DROP POLICY IF EXISTS "Owners can update their groups" ON public.study_groups;
DROP POLICY IF EXISTS "Owners can delete their groups" ON public.study_groups;

-- Recreate policies using security definer functions
CREATE POLICY "Users can view groups they own or are members of" 
ON public.study_groups 
FOR SELECT 
USING (
  auth.uid() = owner_id 
  OR public.is_group_member(auth.uid(), id)
);

CREATE POLICY "Users can create their own groups" 
ON public.study_groups 
FOR INSERT 
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners can update their groups" 
ON public.study_groups 
FOR UPDATE 
USING (auth.uid() = owner_id);

CREATE POLICY "Owners can delete their groups" 
ON public.study_groups 
FOR DELETE 
USING (auth.uid() = owner_id);

-- Add study_sessions table for study timer feature
CREATE TABLE IF NOT EXISTS public.study_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ended_at TIMESTAMP WITH TIME ZONE,
  duration_minutes INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on study_sessions
ALTER TABLE public.study_sessions ENABLE ROW LEVEL SECURITY;

-- Policies for study_sessions
CREATE POLICY "Users can view their own sessions" 
ON public.study_sessions 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own sessions" 
ON public.study_sessions 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sessions" 
ON public.study_sessions 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Policy to view group members' active sessions (for study timer visibility)
CREATE POLICY "Users can view group members active sessions" 
ON public.study_sessions 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.group_members gm1
    JOIN public.group_members gm2 ON gm1.group_id = gm2.group_id
    WHERE gm1.user_id = auth.uid()
      AND gm1.status = 'accepted'
      AND gm2.user_id = public.study_sessions.user_id
      AND gm2.status = 'accepted'
  )
  OR EXISTS (
    SELECT 1 FROM public.study_groups sg
    JOIN public.group_members gm ON sg.id = gm.group_id
    WHERE sg.owner_id = auth.uid()
      AND gm.user_id = public.study_sessions.user_id
      AND gm.status = 'accepted'
  )
);

-- Enable realtime for study_sessions
ALTER PUBLICATION supabase_realtime ADD TABLE public.study_sessions;