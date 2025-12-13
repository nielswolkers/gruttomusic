-- Allow users to search other profiles by username/display_name for file sharing
CREATE POLICY "Users can search other profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- Drop the old restrictive policy
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;