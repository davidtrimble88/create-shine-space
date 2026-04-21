-- Create referral_sources table for admin-managed referral options
CREATE TABLE public.referral_sources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.referral_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active referral sources"
ON public.referral_sources
FOR SELECT
USING (true);

CREATE POLICY "Admins can insert referral sources"
ON public.referral_sources
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update referral sources"
ON public.referral_sources
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete referral sources"
ON public.referral_sources
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_referral_sources_updated_at
BEFORE UPDATE ON public.referral_sources
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Seed with existing hardcoded list
INSERT INTO public.referral_sources (name, sort_order) VALUES
  ('Google', 10),
  ('Learn To Ride VC Website', 20),
  ('Yelp', 30),
  ('Facebook', 40),
  ('Instagram', 50),
  ('Chopperfest', 60),
  ('Cal Coast Motorsports', 70),
  ('Word of Mouth / Friend', 80),
  ('DMV', 90),
  ('CHP', 100),
  ('Cycle Gear', 110),
  ('Ventura Fair', 120),
  ('Ventura Harley Davidson', 130),
  ('Thousand Oaks Powersports', 140),
  ('Santa Barbara Motorsports', 150),
  ('My Garage Ventura', 160),
  ('The Shop Ventura', 170),
  ('BBB (Better Business Bureau)', 180),
  ('Overland Outdoor Expo', 190),
  ('Phone Call', 200),
  ('Walk-in', 210),
  ('Other', 220);