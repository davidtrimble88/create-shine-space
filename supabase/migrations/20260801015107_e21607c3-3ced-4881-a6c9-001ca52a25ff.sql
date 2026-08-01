INSERT INTO public.user_roles (user_id, role)
VALUES ('12130ca1-87d6-49a9-b7a1-6119f43aa986', 'owner')
ON CONFLICT (user_id, role) DO NOTHING;