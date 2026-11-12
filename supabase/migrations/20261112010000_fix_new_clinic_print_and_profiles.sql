-- Fix Print Queue UPDATE RLS for all clinics + backfill any profiles whose clinic_id/role was missed on signup

-- 1. Backfill clinic_id and role on profiles for clinic owners and staff created after handle_new_user()
UPDATE public.profiles p
SET
  clinic_id = COALESCE(p.clinic_id, c.id),
  role = COALESCE(p.role, 'owner')
FROM public.clinics c
WHERE c.owner_id = p.user_id
  AND (p.clinic_id IS NULL OR p.role IS NULL);

UPDATE public.profiles p
SET role = ur.role::text
FROM public.user_roles ur
WHERE ur.user_id = p.user_id
  AND p.role IS NULL;

-- 2. Ensure Prescriptions SELECT policy allows clinic owners and printer role in addition to nurses/staff/doctors
DROP POLICY IF EXISTS "production_prescriptions_isolation_v4" ON public.prescriptions;

CREATE POLICY "production_prescriptions_isolation_v4" ON public.prescriptions
  FOR SELECT TO authenticated
  USING (
    public.is_auth_superadmin()
    OR EXISTS (
      SELECT 1 FROM public.clinics c
      WHERE c.id = prescriptions.clinic_id AND c.owner_id = auth.uid()
    )
    OR (
      clinic_id = public.get_auth_clinic_id()
      AND (
        public.get_auth_role() IN ('nurse', 'staff', 'printer', 'owner')
        OR doctor_id = auth.uid()
        OR visit_id IN (
          SELECT id FROM public.visits
          WHERE assigned_doctor_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
             OR assigned_doctor_id = auth.uid()
        )
      )
    )
  );

-- 3. Ensure Prescriptions UPDATE policy works for ALL clinics (clinic staff, doctors, printers, clinic owners, and superadmins)
DROP POLICY IF EXISTS "Clinic Scoped Update Prescriptions" ON public.prescriptions;

CREATE POLICY "Clinic Scoped Update Prescriptions" ON public.prescriptions
  FOR UPDATE TO authenticated
  USING (
    public.is_auth_superadmin()
    OR clinic_id = public.get_auth_clinic_id()
    OR EXISTS (
      SELECT 1 FROM public.clinics c
      WHERE c.id = prescriptions.clinic_id AND c.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    public.is_auth_superadmin()
    OR clinic_id = public.get_auth_clinic_id()
    OR EXISTS (
      SELECT 1 FROM public.clinics c
      WHERE c.id = prescriptions.clinic_id AND c.owner_id = auth.uid()
    )
  );

