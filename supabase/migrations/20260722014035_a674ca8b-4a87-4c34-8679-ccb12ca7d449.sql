CREATE TABLE IF NOT EXISTS public.instructor_public_profiles (
  id uuid PRIMARY KEY,
  full_name text NOT NULL,
  bio text,
  photo_url text,
  "position" text,
  show_on_website boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  source_created_at timestamptz NOT NULL DEFAULT now(),
  photo_position_x integer DEFAULT 50,
  photo_position_y integer DEFAULT 50,
  photo_zoom integer DEFAULT 100,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.instructor_public_profiles TO anon;
GRANT SELECT ON public.instructor_public_profiles TO authenticated;
GRANT ALL ON public.instructor_public_profiles TO service_role;

ALTER TABLE public.instructor_public_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view instructor profiles" ON public.instructor_public_profiles;
CREATE POLICY "Public can view instructor profiles"
ON public.instructor_public_profiles
FOR SELECT
TO anon, authenticated
USING (show_on_website = true AND is_active = true);

DROP VIEW IF EXISTS public.public_instructors;

CREATE VIEW public.public_instructors
WITH (security_invoker = true) AS
SELECT
  id,
  full_name,
  bio,
  photo_url,
  "position",
  show_on_website,
  is_active,
  source_created_at AS created_at,
  photo_position_x,
  photo_position_y,
  photo_zoom
FROM public.instructor_public_profiles
WHERE show_on_website = true
  AND is_active = true;

GRANT SELECT ON public.public_instructors TO anon;
GRANT SELECT ON public.public_instructors TO authenticated;
GRANT ALL ON public.public_instructors TO service_role;

CREATE OR REPLACE FUNCTION public.sync_instructor_public_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.show_on_website = true AND NEW.is_active = true THEN
    INSERT INTO public.instructor_public_profiles (
      id,
      full_name,
      bio,
      photo_url,
      "position",
      show_on_website,
      is_active,
      source_created_at,
      photo_position_x,
      photo_position_y,
      photo_zoom,
      updated_at
    ) VALUES (
      NEW.id,
      NEW.full_name,
      NEW.bio,
      NEW.photo_url,
      NEW."position",
      NEW.show_on_website,
      NEW.is_active,
      COALESCE(NEW.created_at, now()),
      COALESCE(NEW.photo_position_x, 50),
      COALESCE(NEW.photo_position_y, 50),
      COALESCE(NEW.photo_zoom, 100),
      now()
    )
    ON CONFLICT (id) DO UPDATE SET
      full_name = EXCLUDED.full_name,
      bio = EXCLUDED.bio,
      photo_url = EXCLUDED.photo_url,
      "position" = EXCLUDED."position",
      show_on_website = EXCLUDED.show_on_website,
      is_active = EXCLUDED.is_active,
      source_created_at = EXCLUDED.source_created_at,
      photo_position_x = EXCLUDED.photo_position_x,
      photo_position_y = EXCLUDED.photo_position_y,
      photo_zoom = EXCLUDED.photo_zoom,
      updated_at = now();
  ELSE
    DELETE FROM public.instructor_public_profiles WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_instructor_public_profile_trigger ON public.employees;
CREATE TRIGGER sync_instructor_public_profile_trigger
AFTER INSERT OR UPDATE OF full_name, bio, photo_url, "position", show_on_website, is_active, created_at, photo_position_x, photo_position_y, photo_zoom
ON public.employees
FOR EACH ROW
EXECUTE FUNCTION public.sync_instructor_public_profile();

INSERT INTO public.instructor_public_profiles (
  id,
  full_name,
  bio,
  photo_url,
  "position",
  show_on_website,
  is_active,
  source_created_at,
  photo_position_x,
  photo_position_y,
  photo_zoom,
  updated_at
)
SELECT
  id,
  full_name,
  bio,
  photo_url,
  "position",
  show_on_website,
  is_active,
  COALESCE(created_at, now()),
  COALESCE(photo_position_x, 50),
  COALESCE(photo_position_y, 50),
  COALESCE(photo_zoom, 100),
  now()
FROM public.employees
WHERE show_on_website = true
  AND is_active = true
ON CONFLICT (id) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  bio = EXCLUDED.bio,
  photo_url = EXCLUDED.photo_url,
  "position" = EXCLUDED."position",
  show_on_website = EXCLUDED.show_on_website,
  is_active = EXCLUDED.is_active,
  source_created_at = EXCLUDED.source_created_at,
  photo_position_x = EXCLUDED.photo_position_x,
  photo_position_y = EXCLUDED.photo_position_y,
  photo_zoom = EXCLUDED.photo_zoom,
  updated_at = now();