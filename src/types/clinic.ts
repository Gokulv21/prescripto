// Shared Clinic type matching the Supabase 'clinics' table schema.
// Use this everywhere instead of `clinic: any` for full type safety.
export interface PrescriptionSettings {
  template_id?: 'classic' | 'modern' | 'minimal';
  primary_color?: string;
  show_vitals_sidebar?: boolean;
  header_mode?: 'name' | 'logo' | 'both';
  clinic_caption?: string;
  watermark_opacity?: number;
}

export interface Clinic {
  id: string;
  name: string;
  slug: string;
  owner_id: string | null;
  address: string | null;
  phone: string | null;
  photo_url: string | null;
  is_blocked: boolean;
  block_reason: string | null;
  created_at: string;
  updated_at?: string | null;
  prescription_settings?: PrescriptionSettings | null;
}
