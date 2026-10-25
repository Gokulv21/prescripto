-- Create table to log user searches in Nova AI
CREATE TABLE IF NOT EXISTS public.nova_queries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID REFERENCES public.clinics(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    user_name TEXT NOT NULL DEFAULT 'Clinic Staff',
    user_role TEXT DEFAULT 'staff',
    query TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.nova_queries ENABLE ROW LEVEL SECURITY;

-- 1. Allow all users/sessions to log queries
DROP POLICY IF EXISTS "Allow authenticated users to log nova queries" ON public.nova_queries;
DROP POLICY IF EXISTS "Allow anyone to log nova queries" ON public.nova_queries;
CREATE POLICY "Allow anyone to log nova queries"
ON public.nova_queries
FOR INSERT
WITH CHECK (true);

-- 2. Allow ONLY platform SuperAdmin to view queries
-- (Using is_superadmin boolean column and email; avoid enum cast error)
DROP POLICY IF EXISTS "Superadmin only view nova queries" ON public.nova_queries;
CREATE POLICY "Superadmin only view nova queries"
ON public.nova_queries
FOR SELECT TO authenticated
USING (
  (auth.jwt() ->> 'email') IN ('doctor@clinic.com')
  OR EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
      AND (is_superadmin = true OR email = 'doctor@clinic.com')
  )
);

-- 3. Allow Superadmin to delete queries
DROP POLICY IF EXISTS "Superadmin only delete nova queries" ON public.nova_queries;
CREATE POLICY "Superadmin only delete nova queries"
ON public.nova_queries
FOR DELETE TO authenticated
USING (
  (auth.jwt() ->> 'email') IN ('doctor@clinic.com', 'gokie.v21@gmail.com')
  OR EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
      AND (is_superadmin = true OR email = 'doctor@clinic.com')
  )
);
