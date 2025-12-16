-- Drop the overly permissive INSERT policy
DROP POLICY IF EXISTS "Service role can insert proactive questions" ON public.proactive_questions;

-- Create a more restrictive INSERT policy that validates user_id exists in auth.users
CREATE POLICY "Service role can insert proactive questions for valid users"
ON public.proactive_questions
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM auth.users WHERE id = user_id
  )
);