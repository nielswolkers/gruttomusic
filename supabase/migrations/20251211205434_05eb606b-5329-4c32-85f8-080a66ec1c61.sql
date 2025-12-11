-- Add display_name column to profiles if it doesn't exist
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS display_name text;

-- Create folders table
CREATE TABLE public.folders (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#6BC497',
  owner_id uuid NOT NULL,
  parent_folder_id uuid REFERENCES public.folders(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone,
  deleted_by uuid
);

-- Create files table
CREATE TABLE public.files (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  filename text NOT NULL,
  file_type text NOT NULL,
  file_size bigint NOT NULL,
  storage_url text NOT NULL,
  owner_id uuid NOT NULL,
  folder_id uuid REFERENCES public.folders(id) ON DELETE SET NULL,
  is_favorite boolean DEFAULT false,
  upload_date timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone,
  deleted_by uuid
);

-- Create file_shares table
CREATE TABLE public.file_shares (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  file_id uuid NOT NULL REFERENCES public.files(id) ON DELETE CASCADE,
  shared_with_user_id uuid NOT NULL,
  shared_by_user_id uuid NOT NULL,
  shared_date timestamp with time zone NOT NULL DEFAULT now()
);

-- Create notifications table
CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  recipient_id uuid NOT NULL,
  sender_id uuid NOT NULL,
  type text NOT NULL,
  message text NOT NULL,
  file_id uuid REFERENCES public.files(id) ON DELETE SET NULL,
  read_status boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.file_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS policies for folders
CREATE POLICY "Users can view their own folders"
ON public.folders FOR SELECT
USING (auth.uid() = owner_id AND deleted_at IS NULL);

CREATE POLICY "Users can create their own folders"
ON public.folders FOR INSERT
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update their own folders"
ON public.folders FOR UPDATE
USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete their own folders"
ON public.folders FOR DELETE
USING (auth.uid() = owner_id);

-- RLS policies for files
CREATE POLICY "Users can view their own files"
ON public.files FOR SELECT
USING (auth.uid() = owner_id AND deleted_at IS NULL);

CREATE POLICY "Users can view shared files"
ON public.files FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.file_shares
    WHERE file_shares.file_id = files.id
    AND file_shares.shared_with_user_id = auth.uid()
  )
  AND deleted_at IS NULL
);

CREATE POLICY "Users can create their own files"
ON public.files FOR INSERT
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update their own files"
ON public.files FOR UPDATE
USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete their own files"
ON public.files FOR DELETE
USING (auth.uid() = owner_id);

-- RLS policies for file_shares
CREATE POLICY "Users can view shares for their files"
ON public.file_shares FOR SELECT
USING (
  auth.uid() = shared_by_user_id OR 
  auth.uid() = shared_with_user_id
);

CREATE POLICY "Users can create shares for their files"
ON public.file_shares FOR INSERT
WITH CHECK (auth.uid() = shared_by_user_id);

CREATE POLICY "Users can delete shares they created"
ON public.file_shares FOR DELETE
USING (auth.uid() = shared_by_user_id);

-- RLS policies for notifications
CREATE POLICY "Users can view their own notifications"
ON public.notifications FOR SELECT
USING (auth.uid() = recipient_id);

CREATE POLICY "Users can create notifications"
ON public.notifications FOR INSERT
WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can update their own notifications"
ON public.notifications FOR UPDATE
USING (auth.uid() = recipient_id);

CREATE POLICY "Users can delete their own notifications"
ON public.notifications FOR DELETE
USING (auth.uid() = recipient_id);

-- Create triggers for updated_at
CREATE TRIGGER update_folders_updated_at
BEFORE UPDATE ON public.folders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_files_updated_at
BEFORE UPDATE ON public.files
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for user files
INSERT INTO storage.buckets (id, name, public) VALUES ('user-files', 'user-files', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for user-files bucket
CREATE POLICY "Users can upload their own files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'user-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view all files in bucket"
ON storage.objects FOR SELECT
USING (bucket_id = 'user-files');

CREATE POLICY "Users can update their own files"
ON storage.objects FOR UPDATE
USING (bucket_id = 'user-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own files"
ON storage.objects FOR DELETE
USING (bucket_id = 'user-files' AND auth.uid()::text = (storage.foldername(name))[1]);