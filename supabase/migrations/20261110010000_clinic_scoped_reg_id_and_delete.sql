-- 1. Make Patient Registration ID generation strictly clinic-scoped
-- Previously get_next_registration_id() had no clinic filter, causing new clinics to inherit
-- the previous clinic's sequential patient counter (e.g. starting at 2605803 instead of 2600001).

-- Drop any global unique constraints/indexes on registration_id so each clinic starts from 00001 independently
ALTER TABLE public.patients DROP CONSTRAINT IF EXISTS patients_registration_id_key;
ALTER TABLE public.patients DROP CONSTRAINT IF EXISTS unique_registration_id;
DROP INDEX IF EXISTS public.patients_registration_id_key;
DROP INDEX IF EXISTS public.idx_patients_reg_id_unique;

-- Ensure clinic-scoped non-unique lookup index & per-clinic uniqueness (for non-null registration IDs)
CREATE INDEX IF NOT EXISTS idx_patients_clinic_reg_id ON public.patients(clinic_id, registration_id);

DROP FUNCTION IF EXISTS public.get_next_registration_id();
DROP FUNCTION IF EXISTS public.get_next_registration_id(UUID);

-- Primary clinic-aware registration ID generator (YY + 5-digit sequence per clinic per year)
CREATE OR REPLACE FUNCTION public.get_next_registration_id(p_clinic_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year_prefix TEXT;
  v_max_seq BIGINT;
  v_next_seq BIGINT;
BEGIN
  IF p_clinic_id IS NULL THEN
    RAISE EXCEPTION 'p_clinic_id is required to generate a clinic-scoped Registration ID';
  END IF;

  -- Prevent race conditions when two staff register patients simultaneously in the same clinic
  PERFORM pg_advisory_xact_lock(hashtext('reg_id_' || p_clinic_id::TEXT));

  v_year_prefix := to_char(NOW() AT TIME ZONE 'Asia/Kolkata', 'YY');

  SELECT COALESCE(MAX(substring(registration_id FROM 3)::BIGINT), 0)
  INTO v_max_seq
  FROM public.patients
  WHERE clinic_id = p_clinic_id
    AND registration_id ~ ('^' || v_year_prefix || '[0-9]{1,7}$');

  v_next_seq := COALESCE(v_max_seq, 0) + 1;

  RETURN v_year_prefix || lpad(v_next_seq::TEXT, 5, '0');
END;
$$;

-- Backward-compatible 0-arg overload (scopes automatically to caller's profile clinic_id)
CREATE OR REPLACE FUNCTION public.get_next_registration_id()
RETURNS TEXT
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clinic_id UUID;
BEGIN
  SELECT clinic_id INTO v_clinic_id FROM public.profiles WHERE user_id = auth.uid();
  IF v_clinic_id IS NULL THEN
    SELECT id INTO v_clinic_id FROM public.clinics WHERE owner_id = auth.uid() LIMIT 1;
  END IF;

  RETURN public.get_next_registration_id(v_clinic_id);
END;
$$;

-- 2. Allow clinic owners, doctors, and superadmins to delete patients, visits, and prescriptions
-- within their own clinic (previously restricted strictly to 'doctor' role without clinic scoping).

DROP POLICY IF EXISTS "Doctors can delete visits" ON public.visits;
DROP POLICY IF EXISTS "Clinic Scoped Delete Visits" ON public.visits;
CREATE POLICY "Clinic Scoped Delete Visits"
  ON public.visits
  FOR DELETE TO authenticated
  USING (
    (
      public.has_role(auth.uid(), 'doctor')
      OR public.has_role(auth.uid(), 'owner')
      OR EXISTS (SELECT 1 FROM public.clinics c WHERE c.id = visits.clinic_id AND c.owner_id = auth.uid())
    )
    AND (
      clinic_id = (SELECT p.clinic_id FROM public.profiles p WHERE p.user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.clinics c WHERE c.id = visits.clinic_id AND c.owner_id = auth.uid())
    )
    OR EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND is_superadmin = true)
  );

DROP POLICY IF EXISTS "Doctors can delete prescriptions" ON public.prescriptions;
DROP POLICY IF EXISTS "Clinic Scoped Delete Prescriptions" ON public.prescriptions;
CREATE POLICY "Clinic Scoped Delete Prescriptions"
  ON public.prescriptions
  FOR DELETE TO authenticated
  USING (
    (
      public.has_role(auth.uid(), 'doctor')
      OR public.has_role(auth.uid(), 'owner')
      OR EXISTS (SELECT 1 FROM public.clinics c WHERE c.id = prescriptions.clinic_id AND c.owner_id = auth.uid())
    )
    AND (
      clinic_id = (SELECT p.clinic_id FROM public.profiles p WHERE p.user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.clinics c WHERE c.id = prescriptions.clinic_id AND c.owner_id = auth.uid())
    )
    OR EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND is_superadmin = true)
  );

DROP POLICY IF EXISTS "Doctors Can Delete Patients" ON public.patients;
DROP POLICY IF EXISTS "Clinic Scoped Delete Patients" ON public.patients;
CREATE POLICY "Clinic Scoped Delete Patients"
  ON public.patients
  FOR DELETE TO authenticated
  USING (
    (
      public.has_role(auth.uid(), 'doctor')
      OR public.has_role(auth.uid(), 'owner')
      OR EXISTS (SELECT 1 FROM public.clinics c WHERE c.id = patients.clinic_id AND c.owner_id = auth.uid())
    )
    AND (
      clinic_id = (SELECT p.clinic_id FROM public.profiles p WHERE p.user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.clinics c WHERE c.id = patients.clinic_id AND c.owner_id = auth.uid())
    )
    OR EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND is_superadmin = true)
  );
