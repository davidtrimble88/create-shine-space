ALTER TABLE public.instructor_certifications
  ADD COLUMN IF NOT EXISTS cmsp_not_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS irc_not_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS arc_not_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cpr_not_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS teach_alone_not_required boolean NOT NULL DEFAULT false;