-- Add bio and banner_url to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS bio text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS banner_url text DEFAULT NULL;

-- Add avatar_url to study_groups
ALTER TABLE public.study_groups
ADD COLUMN IF NOT EXISTS avatar_url text DEFAULT NULL;

-- Create group_materials table for course material sharing
CREATE TABLE public.group_materials (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id uuid NOT NULL REFERENCES public.study_groups(id) ON DELETE CASCADE,
  uploaded_by uuid NOT NULL,
  filename text NOT NULL,
  file_type text NOT NULL,
  file_size bigint NOT NULL,
  storage_url text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.group_materials ENABLE ROW LEVEL SECURITY;

-- RLS policies for group_materials
CREATE POLICY "Members can view group materials"
ON public.group_materials
FOR SELECT
USING (
  is_group_member(auth.uid(), group_id) OR 
  is_group_owner(auth.uid(), group_id)
);

CREATE POLICY "Members can upload group materials"
ON public.group_materials
FOR INSERT
WITH CHECK (
  auth.uid() = uploaded_by AND
  (is_group_member(auth.uid(), group_id) OR is_group_owner(auth.uid(), group_id))
);

CREATE POLICY "Uploader can delete their materials"
ON public.group_materials
FOR DELETE
USING (auth.uid() = uploaded_by);

-- Enable realtime for group_materials
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_materials;