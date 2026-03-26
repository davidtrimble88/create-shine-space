
-- Bookings table to track all registrations
CREATE TABLE public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid REFERENCES public.schedules(id) ON DELETE SET NULL,
  course text NOT NULL,
  location text NOT NULL,
  location_label text NOT NULL,
  schedule_date date,
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  gender text,
  date_of_birth date,
  referral_source text,
  fee text,
  payment_status text NOT NULL DEFAULT 'pending',
  booking_status text NOT NULL DEFAULT 'submitted',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- Anyone can insert (public registration)
CREATE POLICY "Anyone can insert bookings" ON public.bookings
  FOR INSERT TO anon, authenticated WITH CHECK (true);

-- Only admin/owner can view all bookings
CREATE POLICY "Admins can view bookings" ON public.bookings
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Only admin/owner can update bookings
CREATE POLICY "Admins can update bookings" ON public.bookings
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Page views tracking
CREATE TABLE public.page_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_path text NOT NULL,
  page_name text,
  visitor_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;

-- Anyone can insert page views (anonymous tracking)
CREATE POLICY "Anyone can insert page views" ON public.page_views
  FOR INSERT TO anon, authenticated WITH CHECK (true);

-- Only admin/owner can view page analytics
CREATE POLICY "Admins can view page views" ON public.page_views
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Employee login log
CREATE TABLE public.employee_logins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.employee_logins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view login logs" ON public.employee_logins
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone authenticated can insert login" ON public.employee_logins
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Triggers
CREATE TRIGGER handle_bookings_updated_at
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
