
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- 1) Hash existing plaintext answers, replace column
ALTER TABLE public.security_questions ADD COLUMN IF NOT EXISTS answer_hash text;

UPDATE public.security_questions
SET answer_hash = extensions.crypt(lower(btrim(answer)), extensions.gen_salt('bf'))
WHERE answer_hash IS NULL AND answer IS NOT NULL;

ALTER TABLE public.security_questions DROP COLUMN IF EXISTS answer;
ALTER TABLE public.security_questions ALTER COLUMN answer_hash SET NOT NULL;

-- 2) Drop admin visibility of security questions (answers should never be admin-readable)
DROP POLICY IF EXISTS "Admins can view security questions" ON public.security_questions;

-- 3) RPC for authenticated user to save their own three security questions.
CREATE OR REPLACE FUNCTION public.set_security_questions(_questions jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _uid uuid := auth.uid();
  _q jsonb;
  _n int;
  _text text;
  _ans text;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF jsonb_typeof(_questions) <> 'array' OR jsonb_array_length(_questions) <> 3 THEN
    RAISE EXCEPTION 'exactly 3 questions required';
  END IF;

  DELETE FROM public.security_questions WHERE user_id = _uid;

  FOR _q IN SELECT * FROM jsonb_array_elements(_questions)
  LOOP
    _n    := (_q->>'question_number')::int;
    _text := btrim(_q->>'question');
    _ans  := lower(btrim(_q->>'answer'));
    IF _n IS NULL OR _n < 1 OR _n > 3 THEN RAISE EXCEPTION 'invalid question_number'; END IF;
    IF _text IS NULL OR _text = '' THEN RAISE EXCEPTION 'question required'; END IF;
    IF _ans  IS NULL OR _ans  = '' THEN RAISE EXCEPTION 'answer required'; END IF;

    INSERT INTO public.security_questions (user_id, question_number, question, answer_hash)
    VALUES (_uid, _n, _text, extensions.crypt(_ans, extensions.gen_salt('bf')));
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.set_security_questions(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_security_questions(jsonb) TO authenticated;

-- 4) RPC used only by the self-reset edge function (service role) to verify answers.
CREATE OR REPLACE FUNCTION public.verify_security_answers(_user_id uuid, _answers text[])
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _cnt int;
  _match int;
BEGIN
  IF _user_id IS NULL OR _answers IS NULL OR array_length(_answers, 1) <> 3 THEN
    RETURN false;
  END IF;

  SELECT COUNT(*) INTO _cnt FROM public.security_questions WHERE user_id = _user_id;
  IF _cnt < 3 THEN RETURN false; END IF;

  SELECT COUNT(*) INTO _match
  FROM public.security_questions sq
  WHERE sq.user_id = _user_id
    AND sq.answer_hash = extensions.crypt(
      lower(btrim(_answers[sq.question_number])),
      sq.answer_hash
    );

  RETURN _match = 3;
END;
$$;

REVOKE ALL ON FUNCTION public.verify_security_answers(uuid, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_security_answers(uuid, text[]) TO service_role;

-- 5) Server-enforced author_role on ticket_comments — prevents client spoofing.
CREATE OR REPLACE FUNCTION public.enforce_ticket_comment_author_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(NEW.user_id, 'admin'::app_role)
     OR public.has_role(NEW.user_id, 'owner'::app_role) THEN
    NEW.author_role := 'staff';
  ELSE
    NEW.author_role := 'creator';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_ticket_comment_author_role ON public.ticket_comments;
CREATE TRIGGER trg_enforce_ticket_comment_author_role
BEFORE INSERT OR UPDATE OF author_role ON public.ticket_comments
FOR EACH ROW EXECUTE FUNCTION public.enforce_ticket_comment_author_role();
