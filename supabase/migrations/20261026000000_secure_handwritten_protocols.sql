-- Security Hardening: Scope handwritten_protocols to user's clinic to prevent cross-tenant data leaks

-- 1. Ensure RLS is enabled
ALTER TABLE IF EXISTS public.handwritten_protocols ENABLE ROW LEVEL SECURITY;

-- 2. Drop overly permissive legacy policies
DROP POLICY IF EXISTS "Allow users to read handwritten protocols" ON public.handwritten_protocols;
DROP POLICY IF EXISTS "Allow users to insert handwritten protocols" ON public.handwritten_protocols;
DROP POLICY IF EXISTS "Allow users to update handwritten protocols" ON public.handwritten_protocols;
DROP POLICY IF EXISTS "Allow users to delete handwritten protocols" ON public.handwritten_protocols;
DROP POLICY IF EXISTS "Clinic Scoped View Handwritten Protocols" ON public.handwritten_protocols;
DROP POLICY IF EXISTS "Clinic Scoped Insert Handwritten Protocols" ON public.handwritten_protocols;
DROP POLICY IF EXISTS "Clinic Scoped Update Handwritten Protocols" ON public.handwritten_protocols;
DROP POLICY IF EXISTS "Clinic Scoped Delete Handwritten Protocols" ON public.handwritten_protocols;

-- 3. Create strictly clinic-scoped policies
CREATE POLICY "Clinic Scoped View Handwritten Protocols" 
ON public.handwritten_protocols 
FOR SELECT TO authenticated
USING (
  clinic_id IN (
    SELECT p.clinic_id FROM public.profiles p WHERE p.user_id = auth.uid()
  )
  OR EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND is_superadmin = true)
);

CREATE POLICY "Clinic Scoped Insert Handwritten Protocols" 
ON public.handwritten_protocols 
FOR INSERT TO authenticated
WITH CHECK (
  clinic_id IN (
    SELECT p.clinic_id FROM public.profiles p WHERE p.user_id = auth.uid()
  )
  OR EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND is_superadmin = true)
);

CREATE POLICY "Clinic Scoped Update Handwritten Protocols" 
ON public.handwritten_protocols 
FOR UPDATE TO authenticated
USING (
  clinic_id IN (
    SELECT p.clinic_id FROM public.profiles p WHERE p.user_id = auth.uid()
  )
  OR EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND is_superadmin = true)
);

CREATE POLICY "Clinic Scoped Delete Handwritten Protocols" 
ON public.handwritten_protocols 
FOR DELETE TO authenticated
USING (
  clinic_id IN (
    SELECT p.clinic_id FROM public.profiles p WHERE p.user_id = auth.uid()
  )
  OR EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND is_superadmin = true)
);
