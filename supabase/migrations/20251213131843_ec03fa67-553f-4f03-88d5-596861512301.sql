-- Drop the existing SELECT policy that filters out deleted files
DROP POLICY IF EXISTS "Users can view their own files" ON public.files;

-- Create a new policy that allows users to view their own files including deleted ones
CREATE POLICY "Users can view their own files"
ON public.files
FOR SELECT
USING (auth.uid() = owner_id);

-- Update the shared files policy to still exclude deleted files for shared users
DROP POLICY IF EXISTS "Users can view shared files" ON public.files;

CREATE POLICY "Users can view shared files"
ON public.files
FOR SELECT
USING (
  (EXISTS (
    SELECT 1 FROM file_shares
    WHERE file_shares.file_id = files.id
    AND file_shares.shared_with_user_id = auth.uid()
  )) AND deleted_at IS NULL
);