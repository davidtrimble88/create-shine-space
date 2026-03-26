ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS photo_position_x integer NOT NULL DEFAULT 50;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS photo_position_y integer NOT NULL DEFAULT 50;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS photo_zoom integer NOT NULL DEFAULT 100;