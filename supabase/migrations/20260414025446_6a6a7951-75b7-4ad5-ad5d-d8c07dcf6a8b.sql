CREATE POLICY "Users can delete own security questions"
ON public.security_questions
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);