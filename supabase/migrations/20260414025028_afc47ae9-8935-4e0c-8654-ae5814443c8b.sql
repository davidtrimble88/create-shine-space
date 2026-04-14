
-- Table for storing user security question/answer pairs
CREATE TABLE public.security_questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  question_number INTEGER NOT NULL CHECK (question_number BETWEEN 1 AND 3),
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, question_number)
);

-- Enable RLS
ALTER TABLE public.security_questions ENABLE ROW LEVEL SECURITY;

-- Users can view their own questions
CREATE POLICY "Users can view own security questions"
ON public.security_questions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Users can insert their own questions
CREATE POLICY "Users can insert own security questions"
ON public.security_questions
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can update their own questions
CREATE POLICY "Users can update own security questions"
ON public.security_questions
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- Admins can view security questions for verification
CREATE POLICY "Admins can view security questions"
ON public.security_questions
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_security_questions_updated_at
BEFORE UPDATE ON public.security_questions
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();
