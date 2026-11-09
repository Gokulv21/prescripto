-- Allow clinic owners to update their own clinic's basic info (name, address, phone)
-- Previously only superadmins could update clinics; this was blocking settings saves for clinic owners.

DROP POLICY IF EXISTS "Owners can update their clinic" ON public.clinics;

CREATE POLICY "Owners can update their clinic"
  ON public.clinics
  FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

