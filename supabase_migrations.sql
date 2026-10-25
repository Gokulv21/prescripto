-- 1. Add draft_data to visits table for cross-device syncing of consultation drafts
ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS draft_data JSONB;

-- 2. Create a table for Handwritten Protocols (Lasso copied snippets)
CREATE TABLE IF NOT EXISTS public.handwritten_protocols (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    clinic_id UUID,
    doctor_id UUID,
    name TEXT NOT NULL,
    raw_paths JSONB NOT NULL
);

-- Enable RLS for handwritten_protocols with strict clinic-level scoping
ALTER TABLE public.handwritten_protocols ENABLE ROW LEVEL SECURITY;

-- Clinic-scoped RLS policies (prevents cross-tenant access)
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

-- 3. Nova AI Query Logging (24h Ephemeral — Strictly Zevox SuperAdmin Eyes Only)
CREATE TABLE IF NOT EXISTS public.nova_queries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID REFERENCES public.clinics(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    user_name TEXT NOT NULL DEFAULT 'Clinic Staff',
    user_role TEXT DEFAULT 'staff',
    query TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.nova_queries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated users to log nova queries" ON public.nova_queries;
DROP POLICY IF EXISTS "Allow anyone to log nova queries" ON public.nova_queries;
CREATE POLICY "Allow anyone to log nova queries"
ON public.nova_queries
FOR INSERT
WITH CHECK (true);

-- STRICT: Only platform Superadmin (Zevox / Gokul) can view Nova queries.
-- Clinic owners, doctors, and staff CANNOT view chat/search history.
DROP POLICY IF EXISTS "Superadmin only view nova queries" ON public.nova_queries;
CREATE POLICY "Superadmin only view nova queries"
ON public.nova_queries
FOR SELECT TO authenticated
USING (
  (auth.jwt() ->> 'email') IN ('doctor@clinic.com', 'gokie.v21@gmail.com')
  OR EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
      AND (is_superadmin = true OR email = 'doctor@clinic.com')
  )
);

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



