CREATE OR REPLACE TRIGGER on_auth_user_login_assign_role
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_admin_role_assignment();