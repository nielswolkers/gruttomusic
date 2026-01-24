-- Create study_groups table FIRST (without the complex policy)
CREATE TABLE public.study_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  owner_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.study_groups ENABLE ROW LEVEL SECURITY;

-- Create group_members table
CREATE TABLE public.group_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.study_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  invited_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  responded_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(group_id, user_id)
);

-- Enable RLS
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

-- Now create the policies for study_groups (group_members exists now)
CREATE POLICY "Users can view groups they own or are members of" 
ON public.study_groups 
FOR SELECT 
USING (
  auth.uid() = owner_id OR 
  EXISTS (SELECT 1 FROM public.group_members WHERE group_id = study_groups.id AND user_id = auth.uid() AND status = 'accepted')
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

-- RLS policies for group_members
CREATE POLICY "Users can view members of groups they belong to" 
ON public.group_members 
FOR SELECT 
USING (
  auth.uid() = user_id OR 
  auth.uid() = invited_by OR
  EXISTS (SELECT 1 FROM public.study_groups WHERE id = group_members.group_id AND owner_id = auth.uid())
);

CREATE POLICY "Group owners can invite members" 
ON public.group_members 
FOR INSERT 
WITH CHECK (auth.uid() = invited_by);

CREATE POLICY "Invitees can update their membership status" 
ON public.group_members 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Group owners can remove members" 
ON public.group_members 
FOR DELETE 
USING (
  EXISTS (SELECT 1 FROM public.study_groups WHERE id = group_members.group_id AND owner_id = auth.uid()) OR
  auth.uid() = user_id
);

-- Add trigger for updated_at
CREATE TRIGGER update_study_groups_updated_at
BEFORE UPDATE ON public.study_groups
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();