ALTER TABLE public.bookings DISABLE TRIGGER USER;
UPDATE public.bookings SET dl389_completed = false, dl389_completed_at = NULL, dl389_completed_by = NULL WHERE id = 'e5a5e77a-1e87-4600-8532-b0d3f820a571';
ALTER TABLE public.bookings ENABLE TRIGGER USER;