ALTER TABLE public.signed_waivers ALTER COLUMN signature_typed DROP NOT NULL;
ALTER TABLE public.signed_waivers ALTER COLUMN signature_drawn DROP NOT NULL;