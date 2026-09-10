-- Safe migration: Add photo_url to clinics and clinic_photo to profiles
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS clinic_photo TEXT;
