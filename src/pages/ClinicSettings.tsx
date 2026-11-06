import { useState, useEffect, useRef, useDeferredValue } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useParams, useOutletContext, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  Building2, Camera, Trash2, Loader2, Sparkles, Sliders, Stamp, 
  FileText, Check, Palette, Eye, ArrowRight, ShieldCheck, Lock, Info, LayoutTemplate,
  CheckCircle2, Stethoscope, ExternalLink, Settings, Shield, ChevronRight, Sun, Moon, Monitor, Wrench
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import type { Clinic } from '@/types/clinic';
import PrescriptionTemplate from '@/components/PrescriptionTemplate';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter
} from '@/components/ui/dialog';
import settingsImg from '@/assets/Settings.png';
import { useTheme, ACCENT_OPTIONS, AccentColor } from '@/components/ThemeProvider';

const TEMPLATE_PRESETS = [
  {
    id: 'classic',
    name: 'Classic Clinical',
    description: 'Clean medical layout with split doctor/clinic header and right-hand vital stats bar',
    badge: 'Standard Default'
  },
  {
    id: 'modern',
    name: 'Modern Hospital',
    description: 'Vibrant branding header with prominent colored accents and streamlined layout',
    badge: 'Popular'
  },
  {
    id: 'minimal',
    name: 'Compact Minimal',
    description: 'Minimalist whitespace with maximum writing and medicine prescription area',
    badge: 'Paper Saver'
  }
];

const PRESET_COLORS = [
  { name: 'Royal Purple', hex: '#7d326c' },
  { name: 'Clinical Blue', hex: '#2563eb' },
  { name: 'Emerald Health', hex: '#059669' },
  { name: 'Indigo Dark', hex: '#4f46e5' },
  { name: 'Crimson Rose', hex: '#e11d48' },
  { name: 'Slate Onyx', hex: '#0f172a' }
];

export default function ClinicSettings() {
  const { user, profile, refresh: refreshAuth } = useAuth();
  const { slug } = useParams();
  const navigate = useNavigate();
  const { clinic } = useOutletContext<{ clinic: Clinic }>();

  // STRICT OWNER PERMISSION: Only the recorded owner of this specific clinic can edit clinic info & templates
  const isClinicOwner = Boolean(
    clinic?.id && user?.id && clinic.owner_id === user.id
  );

  // Device theme & appearance state
  const { theme, setTheme, accent, setAccent, customColor, setCustomColor } = useTheme();

  // Sub-Navigation Tabs: 4 dedicated clinic & device settings sections
  const [activeTab, setActiveTab] = useState<'clinic_info' | 'clinic_branding' | 'prescriptions' | 'themes'>('clinic_info');

  // Clinic Form States
  const [clinicName, setClinicName] = useState(clinic?.name || '');
  const [clinicAddress, setClinicAddress] = useState(clinic?.address || '');
  const [clinicPhone, setClinicPhone] = useState(clinic?.phone || '');
  const [clinicCaption, setClinicCaption] = useState('24/7 Emergency · ECG · Lab');
  const [headerMode, setHeaderMode] = useState<'name' | 'logo' | 'both'>('both');
  const [brandingOption, setBrandingOption] = useState<'both' | 'logo_only' | 'watermark_only' | 'none'>('both');
  const [templateId, setTemplateId] = useState<'classic' | 'modern' | 'minimal'>('classic');
  const [primaryColor, setPrimaryColor] = useState('#7d326c');
  const [showVitalsSidebar, setShowVitalsSidebar] = useState(true);

  // Defer live preview bindings so typing in inputs is 100% instantaneous and lag-free
  const deferredClinicName = useDeferredValue(clinicName);
  const deferredClinicAddress = useDeferredValue(clinicAddress);
  const deferredClinicPhone = useDeferredValue(clinicPhone);
  const deferredClinicCaption = useDeferredValue(clinicCaption);

  // Branding Image States
  const [clinicPhotoUrl, setClinicPhotoUrl] = useState<string | null>(null);
  const [watermarkUrl, setWatermarkUrl] = useState<string | null>(null);
  const [clinicUploading, setClinicUploading] = useState(false);
  const [watermarkUploading, setWatermarkUploading] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  // Guided Onboarding Tour Dialog (First Login for new clinic owner)
  const [showOnboardingTour, setShowOnboardingTour] = useState(false);
  const [tourStep, setTourStep] = useState<1 | 2>(1);

  const clinicFileInputRef = useRef<HTMLInputElement>(null);
  const watermarkFileInputRef = useRef<HTMLInputElement>(null);

  // Dynamic Page Title
  useEffect(() => {
    document.title = `Settings — ${clinic?.name || 'Clinic'} | Prescripto`;
    return () => { document.title = 'Prescripto'; };
  }, [clinic?.name]);

  // Check if first-time onboarding tour is required for owner
  useEffect(() => {
    if (isClinicOwner && clinic?.id) {
      const tourKey = `prescripto_onboarded_tour_${clinic.id}`;
      const hasCompletedTour = localStorage.getItem(tourKey);
      const isMissingCritical = !clinic.address || !clinic.phone;
      if (!hasCompletedTour && isMissingCritical) {
        setShowOnboardingTour(true);
      }
    }
  }, [isClinicOwner, clinic?.id, clinic?.address, clinic?.phone]);

  // Load existing clinic preferences
  useEffect(() => {
    if (!clinic?.id) return;

    setClinicName(clinic.name || '');
    setClinicAddress(clinic.address || '');
    setClinicPhone(clinic.phone || '');

    // Check localStorage cache
    const cachedMode = localStorage.getItem(`prescripto_clinic_header_mode_${clinic.id}`);
    if (cachedMode && ['name', 'logo', 'both'].includes(cachedMode)) setHeaderMode(cachedMode as any);

    const cachedBranding = localStorage.getItem(`prescripto_clinic_branding_option_${clinic.id}`);
    if (cachedBranding && ['both', 'logo_only', 'watermark_only', 'none'].includes(cachedBranding)) {
      setBrandingOption(cachedBranding as any);
    }

    const cachedCaption = localStorage.getItem(`prescripto_clinic_caption_${clinic.id}`);
    if (cachedCaption !== null) setClinicCaption(cachedCaption);

    const cachedTemplate = localStorage.getItem(`prescripto_clinic_template_${clinic.id}`);
    if (cachedTemplate && ['classic', 'modern', 'minimal'].includes(cachedTemplate)) setTemplateId(cachedTemplate as any);

    const cachedColor = localStorage.getItem(`prescripto_clinic_color_${clinic.id}`);
    if (cachedColor) setPrimaryColor(cachedColor);

    const cachedVitals = localStorage.getItem(`prescripto_clinic_vitals_${clinic.id}`);
    if (cachedVitals !== null) setShowVitalsSidebar(cachedVitals === 'true');

    // Storage assets check
    (async () => {
      try {
        const { data: list } = await supabase.storage.from('avatars').list(clinic.id);
        const brandingFile = list?.find(f => f.name.startsWith('clinic-branding'));
        if (brandingFile) {
          const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(`${clinic.id}/${brandingFile.name}`);
          setClinicPhotoUrl(`${publicUrl}?t=${Date.now()}`);
        }
        const watermarkFile = list?.find(f => f.name.startsWith('clinic-watermark'));
        if (watermarkFile) {
          const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(`${clinic.id}/${watermarkFile.name}`);
          setWatermarkUrl(`${publicUrl}?t=${Date.now()}`);
        }
      } catch (err) {
        console.warn('Storage check notice:', err);
      }
    })();
  }, [clinic?.id]);

  // Handle Logo Upload
  const handleClinicPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isClinicOwner) {
      toast.error('Only the Clinic Owner can update clinic branding.');
      return;
    }
    const file = e.target.files?.[0];
    if (!file || !clinic?.id) return;

    setClinicUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'png';
      const filePath = `${clinic.id}/clinic-branding.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { contentType: file.type, upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);
      const finalUrl = `${publicUrl}?t=${Date.now()}`;
      setClinicPhotoUrl(finalUrl);
      localStorage.setItem(`prescripto_clinic_logo_${clinic.id}`, finalUrl);
      toast.success('Clinic logo updated successfully!');
      refreshAuth().catch(() => {});
    } catch (err: any) {
      toast.error(err.message || 'Failed to upload clinic photo');
    } finally {
      setClinicUploading(false);
      if (clinicFileInputRef.current) clinicFileInputRef.current.value = '';
    }
  };

  // Handle Watermark Upload
  const handleWatermarkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isClinicOwner) {
      toast.error('Only the Clinic Owner can update watermark.');
      return;
    }
    const file = e.target.files?.[0];
    if (!file || !clinic?.id) return;

    setWatermarkUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'png';
      const filePath = `${clinic.id}/clinic-watermark.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { contentType: file.type, upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);
      const finalUrl = `${publicUrl}?t=${Date.now()}`;
      setWatermarkUrl(finalUrl);
      localStorage.setItem(`prescripto_clinic_watermark_${clinic.id}`, finalUrl);
      toast.success('Watermark uploaded successfully!');
      refreshAuth().catch(() => {});
    } catch (err: any) {
      toast.error(err.message || 'Failed to upload watermark');
    } finally {
      setWatermarkUploading(false);
      if (watermarkFileInputRef.current) watermarkFileInputRef.current.value = '';
    }
  };

  // Save Clinic & Prescription Settings (Owner Only)
  const handleSaveAllSettings = async () => {
    if (!isClinicOwner) {
      toast.error('Access Denied: Only the Clinic Owner can modify clinic information and prescription designs.');
      return;
    }

    if (!clinicName.trim()) {
      toast.error('Clinic Name is mandatory.');
      return;
    }
    if (!clinicAddress.trim()) {
      toast.error('Clinic Address is mandatory for prescriptions.');
      return;
    }
    if (!clinicPhone.trim()) {
      toast.error('Clinic Contact Phone is mandatory.');
      return;
    }
    if (!clinicCaption.trim()) {
      toast.error('Emergency / Specialty Caption is mandatory.');
      return;
    }

    setSavingSettings(true);
    try {
      // 1. Update clinics table in database
      const { error: clinicErr } = await (supabase.from as any)('clinics')
        .update({
          name: clinicName.trim(),
          address: clinicAddress.trim(),
          phone: clinicPhone.trim()
        })
        .eq('id', clinic.id);

      if (clinicErr) throw clinicErr;

      // 2. Persist template preferences in LocalStorage
      localStorage.setItem(`prescripto_clinic_header_mode_${clinic.id}`, headerMode);
      localStorage.setItem(`prescripto_clinic_branding_option_${clinic.id}`, brandingOption);
      localStorage.setItem(`prescripto_clinic_caption_${clinic.id}`, clinicCaption);
      localStorage.setItem(`prescripto_clinic_template_${clinic.id}`, templateId);
      localStorage.setItem(`prescripto_clinic_color_${clinic.id}`, primaryColor);
      localStorage.setItem(`prescripto_clinic_vitals_${clinic.id}`, String(showVitalsSidebar));
      localStorage.setItem(`prescripto_onboarded_tour_${clinic.id}`, 'true');

      toast.success('Clinic settings and prescription template saved successfully!');
      await refreshAuth().catch(() => {});
    } catch (err: any) {
      toast.error(err.message || 'Failed to update settings');
    } finally {
      setSavingSettings(false);
    }
  };

  // Dynamic preview doctor values pulled directly from duty doctor's profile
  const doctorDisplayName = profile?.full_name 
    ? (profile.full_name.toLowerCase().startsWith('dr') ? profile.full_name : `Dr. ${profile.full_name}`)
    : (clinic?.name ? `Dr. In-Charge (${clinic.name})` : 'Dr. In-Charge');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-8 font-jakarta-sans">
      {/* ── First-Time Clinic Owner Onboarding Tour Dialog ── */}
      <Dialog open={showOnboardingTour} onOpenChange={setShowOnboardingTour}>
        <DialogContent className="max-w-[560px] w-[95vw] p-0 overflow-hidden rounded-[2.5rem] border-none shadow-2xl bg-card">
          <div className="bg-gradient-to-br from-blue-600 via-indigo-650 to-purple-650 text-white p-8 relative overflow-hidden">
            <div className="absolute -right-6 -bottom-6 w-36 h-36 bg-white/10 rounded-full blur-2xl pointer-events-none" />
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 text-white text-[10px] font-black uppercase tracking-widest backdrop-blur-md mb-4 border border-white/20">
              <Sparkles className="w-3 h-3" /> Welcome to PreScripto
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight leading-tight mb-2">
              Welcome, Clinic Owner!
            </h2>
            <p className="text-white/80 text-xs sm:text-sm font-medium leading-relaxed max-w-md">
              A high-precision Clinical Suite engineered by <b>Zevox</b>. Let's configure your clinic's official prescription identity before your staff starts registering patients.
            </p>
          </div>

          <div className="p-6 sm:p-8 space-y-6 bg-white dark:bg-slate-900">
            {tourStep === 1 ? (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                <div className="p-4 rounded-2xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 space-y-2">
                  <h3 className="font-black text-sm text-blue-900 dark:text-blue-200 flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-blue-600" /> Mandatory Setup Steps
                  </h3>
                  <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-1.5 font-medium">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span>Confirm official Clinic Name, Address, and Contact Number</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span>Pick your default prescription layout and brand color</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span>Watch the Live Preview transform instantaneously!</span>
                    </li>
                  </ul>
                </div>

                <Button
                  onClick={() => setTourStep(2)}
                  className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-wider gap-2 shadow-lg"
                >
                  Configure Identity & Prescriptions <ArrowRight className="w-4 h-4" />
                </Button>
              </motion.div>
            ) : (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 text-center">
                <div className="w-16 h-16 rounded-3xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
                  <Check className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">You're in Complete Control</h3>
                <p className="text-xs text-slate-500 leading-relaxed max-w-sm mx-auto font-medium">
                  Once you fill in the required fields and hit <b>Save Clinic Settings</b>, your clinic environment will be fully unlocked for daily consultation!
                </p>
                <Button
                  onClick={() => setShowOnboardingTour(false)}
                  className="w-full h-12 rounded-xl bg-slate-900 dark:bg-white dark:text-slate-900 text-white font-black text-xs uppercase tracking-wider shadow-lg"
                >
                  Start Customizing Now
                </Button>
              </motion.div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Minimal Header Section (Settings Image Common at Top across all tabs) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-200/80 dark:border-slate-800">
        <div className="space-y-2 max-w-xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[10px] font-black uppercase tracking-widest border border-blue-100 dark:border-blue-800">
            <LayoutTemplate className="w-3.5 h-3.5" /> Clinic Management
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-800 dark:text-slate-100">
            Prescription & Clinic Settings
          </h1>
          <p className="text-muted-foreground text-xs sm:text-sm font-medium leading-relaxed">
            Configure clinic information, official branding assets, prescription templates, and display themes for {clinic?.name || 'your clinic'}.
          </p>
          <div className="pt-2">
            <Button
              onClick={handleSaveAllSettings}
              disabled={savingSettings || !isClinicOwner}
              className={cn(
                "h-11 px-6 rounded-xl font-black text-xs uppercase tracking-wider transition-all gap-2",
                isClinicOwner
                ? "bg-blue-600 hover:bg-blue-700 text-white shadow-sm hover:shadow"
                : "bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed border border-slate-200 dark:border-slate-700"
              )}
            >
              {savingSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {isClinicOwner ? 'Save Clinic Settings' : 'Owner Only (Locked)'}
            </Button>
          </div>
        </div>

        {/* Transparent Settings Image Common at Top */}
        <div className="flex justify-center md:justify-end shrink-0">
          <img 
            src={settingsImg} 
            alt="Clinic Settings" 
            className="h-24 sm:h-32 md:h-36 lg:h-40 w-auto object-contain select-none pointer-events-none drop-shadow-sm" 
          />
        </div>
      </div>

      {!isClinicOwner && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center gap-3 text-amber-800 dark:text-amber-300">
          <Lock className="w-5 h-5 shrink-0 text-amber-600" />
          <div className="text-xs font-semibold leading-relaxed">
            <b>Clinic Owner Permissions Required:</b> Clinic information, address, phone, branding assets, and prescription templates can only be modified by the registered clinic owner. Doctors manage their individual credentials & digital signatures under their <button type="button" onClick={() => navigate(slug ? `/${slug}/profile` : '/profile')} className="underline font-bold text-blue-600 dark:text-blue-400">Doctor Profile</button>.
          </div>
        </div>
      )}

      {/* ── TOP HORIZONTAL SETTINGS TAB BAR ── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-1.5 shadow-xs flex items-center gap-1.5 overflow-x-auto scrollbar-none">
        {[
          { 
            id: 'clinic_info', 
            label: 'Clinic Information', 
            desc: 'Name, address & phone', 
            icon: Building2,
            ownerOnly: true
          },
          { 
            id: 'clinic_branding', 
            label: 'Clinic Branding', 
            desc: 'Logo, watermark & header', 
            icon: Stamp,
            ownerOnly: true
          },
          { 
            id: 'prescriptions', 
            label: 'Prescription Layout', 
            desc: 'Template presets & style', 
            icon: FileText,
            ownerOnly: true
          },
          { 
            id: 'themes', 
            label: 'Themes & Appearance', 
            desc: 'Dark mode & brand accents', 
            icon: Palette,
            ownerOnly: false
          },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "flex-1 min-w-[160px] sm:min-w-[190px] flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl transition-all group shrink-0",
                isActive
                  ? "bg-blue-600 text-white shadow-sm font-bold"
                  : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 font-medium"
              )}
            >
              <div className={cn(
                "p-2 rounded-lg transition-colors shrink-0",
                isActive 
                  ? "bg-white/20 text-white" 
                  : "bg-slate-100 dark:bg-slate-800 text-slate-500 group-hover:text-blue-600 dark:group-hover:text-blue-400 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/30"
              )}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="text-left min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs sm:text-sm tracking-tight whitespace-nowrap">{tab.label}</span>
                  {tab.ownerOnly && !isClinicOwner && (
                    <Lock className={cn("w-3 h-3 shrink-0", isActive ? "text-white/70" : "text-amber-500")} />
                  )}
                </div>
                <p className={cn(
                  "text-[10px] truncate hidden sm:block",
                  isActive ? "text-blue-100" : "text-slate-400"
                )}>
                  {tab.desc}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Main Settings Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* ── ACTIVE FORM / CONFIGURATION COLUMN ── */}
        <div className={activeTab === 'themes' ? "lg:col-span-12 space-y-6" : "lg:col-span-7 space-y-6"}>
          
          {/* ── SUBSECTION 1: CLINIC INFORMATION (Owner Only) ── */}
          {activeTab === 'clinic_info' && (
            <Card className="rounded-[2rem] border-slate-200/80 dark:border-slate-800 p-6 space-y-6 bg-white dark:bg-slate-900 shadow-sm animate-in fade-in duration-300">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-blue-50 dark:bg-blue-950/40 text-blue-600 rounded-xl">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black tracking-tight text-slate-900 dark:text-white">Clinic Information</h3>
                    <p className="text-xs text-slate-400 font-medium">All fields marked with <span className="text-red-500 font-bold">*</span> are mandatory for prescription legality</p>
                  </div>
                </div>
                {isClinicOwner ? (
                  <Badge className="bg-emerald-50 text-emerald-600 border border-emerald-200 text-[10px] uppercase font-black px-2.5 py-0.5 rounded-full">
                    Owner Active
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 gap-1 rounded-full font-bold">
                    <Lock className="w-3 h-3" /> Managed by Owner
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2 sm:col-span-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                    <span>Clinic Name</span>
                    <span className="text-red-500 font-black">*</span>
                  </Label>
                  <Input
                    value={clinicName}
                    onChange={e => setClinicName(e.target.value)}
                    disabled={!isClinicOwner}
                    required
                    placeholder="e.g. GV Clinic"
                    className={cn("h-11 rounded-xl font-bold", !isClinicOwner && "bg-slate-50 dark:bg-slate-800/40 cursor-not-allowed")}
                  />
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                    <span>Address / Location</span>
                    <span className="text-red-500 font-black">*</span>
                  </Label>
                  <Input
                    value={clinicAddress}
                    onChange={e => setClinicAddress(e.target.value)}
                    disabled={!isClinicOwner}
                    required
                    placeholder="e.g. 742, SSR Complex, Sathanur - 606706"
                    className={cn("h-11 rounded-xl font-medium", !isClinicOwner && "bg-slate-50 dark:bg-slate-800/40 cursor-not-allowed")}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                    <span>Contact Phone</span>
                    <span className="text-red-500 font-black">*</span>
                  </Label>
                  <Input
                    value={clinicPhone}
                    onChange={e => setClinicPhone(e.target.value)}
                    disabled={!isClinicOwner}
                    required
                    placeholder="e.g. +91 9488017636"
                    className={cn("h-11 rounded-xl font-medium", !isClinicOwner && "bg-slate-50 dark:bg-slate-800/40 cursor-not-allowed")}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                    <span>Emergency / Specialty Caption</span>
                    <span className="text-red-500 font-black">*</span>
                  </Label>
                  <Input
                    value={clinicCaption}
                    onChange={e => setClinicCaption(e.target.value)}
                    disabled={!isClinicOwner}
                    required
                    placeholder="e.g. 24/7 Emergency · ECG · Lab"
                    className={cn("h-11 rounded-xl font-medium", !isClinicOwner && "bg-slate-50 dark:bg-slate-800/40 cursor-not-allowed")}
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
                <Button
                  onClick={handleSaveAllSettings}
                  disabled={savingSettings || !isClinicOwner}
                  className="rounded-xl px-6 font-bold text-xs bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {savingSettings ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Check className="w-3.5 h-3.5 mr-1" />}
                  Save Clinic Information
                </Button>
              </div>
            </Card>
          )}

          {/* ── SUBSECTION 2: CLINIC BRANDING (Owner Only) ── */}
          {activeTab === 'clinic_branding' && (
            <Card className="rounded-[2rem] border-slate-200/80 dark:border-slate-800 p-6 space-y-6 bg-white dark:bg-slate-900 shadow-sm animate-in fade-in duration-300">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 rounded-xl">
                    <Stamp className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black tracking-tight text-slate-900 dark:text-white">Clinic Branding & Assets</h3>
                    <p className="text-xs text-slate-400 font-medium">Configure whether to display both, logo only, watermark only, or neither on prescriptions.</p>
                  </div>
                </div>
                {isClinicOwner ? (
                  <Badge className="bg-emerald-50 text-emerald-600 border border-emerald-200 text-[10px] uppercase font-black px-2.5 py-0.5 rounded-full">
                    Owner Active
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 gap-1 rounded-full font-bold">
                    <Lock className="w-3 h-3" /> Managed by Owner
                  </Badge>
                )}
              </div>

              {/* Branding Display Mode Radio Group */}
              <div className="space-y-3">
                <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Prescription Branding Choice
                </Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    {
                      id: 'both',
                      title: 'Both Logo & Watermark',
                      desc: 'Display clinic header logo and center watermark on pad'
                    },
                    {
                      id: 'logo_only',
                      title: 'Clinic Logo Only',
                      desc: 'Display header logo; suppress background watermark'
                    },
                    {
                      id: 'watermark_only',
                      title: 'Watermark Only',
                      desc: 'Display center background watermark; suppress header logo'
                    },
                    {
                      id: 'none',
                      title: 'Neither (Text Only)',
                      desc: 'Clean text-only header without logo or watermark'
                    }
                  ].map(opt => (
                    <label
                      key={opt.id}
                      className={cn(
                        "p-3.5 rounded-2xl border-2 transition-all flex items-start gap-3 cursor-pointer select-none",
                        brandingOption === opt.id
                          ? "border-blue-600 bg-blue-50/50 dark:bg-blue-950/20 ring-2 ring-blue-500/10 shadow-sm"
                          : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-800/20",
                        !isClinicOwner && "cursor-not-allowed opacity-60"
                      )}
                    >
                      <input
                        type="radio"
                        name="brandingOption"
                        value={opt.id}
                        checked={brandingOption === opt.id}
                        onChange={() => isClinicOwner && setBrandingOption(opt.id as any)}
                        disabled={!isClinicOwner}
                        className="mt-1 w-4 h-4 text-blue-600 cursor-pointer"
                      />
                      <div className="space-y-0.5">
                        <p className="text-xs font-black text-slate-800 dark:text-slate-100">{opt.title}</p>
                        <p className="text-[11px] text-slate-500 font-medium leading-relaxed">{opt.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
                {/* Clinic Logo */}
                <div className={cn("p-4 rounded-2xl border space-y-4 flex flex-col justify-between transition-opacity", (brandingOption === 'watermark_only' || brandingOption === 'none') ? "border-slate-150 dark:border-slate-800/60 opacity-60 bg-slate-50/40 dark:bg-slate-900/40" : "border-slate-200 dark:border-slate-800")}>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Clinic Logo (Optional)</Label>
                      <span className="text-[10px] text-slate-400">PNG / JPG</span>
                    </div>
                    <div className="h-28 rounded-xl bg-slate-50 dark:bg-slate-800/50 flex items-center justify-center p-3 border border-dashed border-slate-200 dark:border-slate-700">
                      {clinicPhotoUrl ? (
                        <img src={clinicPhotoUrl} alt="Logo" className="max-h-full max-w-full object-contain" />
                      ) : (
                        <div className="text-center text-slate-400 text-xs">No Logo Uploaded</div>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <input
                      ref={clinicFileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleClinicPhotoUpload}
                      disabled={!isClinicOwner || clinicUploading}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!isClinicOwner || clinicUploading}
                      onClick={() => clinicFileInputRef.current?.click()}
                      className="w-full h-9 rounded-xl text-xs font-bold gap-1.5"
                    >
                      {clinicUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
                      Upload Logo
                    </Button>
                    {clinicPhotoUrl && isClinicOwner && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setClinicPhotoUrl(null);
                          if (clinic?.id) localStorage.removeItem(`prescripto_clinic_logo_${clinic.id}`);
                        }}
                        className="h-9 w-9 text-red-500 hover:text-red-600 rounded-xl"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Clinic Watermark */}
                <div className={cn("p-4 rounded-2xl border space-y-4 flex flex-col justify-between transition-opacity", (brandingOption === 'logo_only' || brandingOption === 'none') ? "border-slate-150 dark:border-slate-800/60 opacity-60 bg-slate-50/40 dark:bg-slate-900/40" : "border-slate-200 dark:border-slate-800")}>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Watermark Crest (Optional)</Label>
                      <span className="text-[10px] text-slate-400">Light PNG</span>
                    </div>
                    <div className="h-28 rounded-xl bg-slate-50 dark:bg-slate-800/50 flex items-center justify-center p-3 border border-dashed border-slate-200 dark:border-slate-700">
                      {watermarkUrl ? (
                        <img src={watermarkUrl} alt="Watermark" className="max-h-full max-w-full object-contain opacity-40" />
                      ) : (
                        <div className="text-center text-slate-400 text-xs">No Watermark Uploaded</div>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <input
                      ref={watermarkFileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleWatermarkUpload}
                      disabled={!isClinicOwner || watermarkUploading}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!isClinicOwner || watermarkUploading}
                      onClick={() => watermarkFileInputRef.current?.click()}
                      className="w-full h-9 rounded-xl text-xs font-bold gap-1.5"
                    >
                      {watermarkUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
                      Upload Crest
                    </Button>
                    {watermarkUrl && isClinicOwner && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setWatermarkUrl(null);
                          if (clinic?.id) localStorage.removeItem(`prescripto_clinic_watermark_${clinic.id}`);
                        }}
                        className="h-9 w-9 text-red-500 hover:text-red-600 rounded-xl"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
                <Button
                  onClick={handleSaveAllSettings}
                  disabled={savingSettings || !isClinicOwner}
                  className="rounded-xl px-6 font-bold text-xs bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {savingSettings ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Check className="w-3.5 h-3.5 mr-1" />}
                  Save Branding Assets
                </Button>
              </div>
            </Card>
          )}

          {/* ── SUBSECTION 3: PRESCRIPTIONS TEMPLATE (Owner Only) ── */}
          {activeTab === 'prescriptions' && (
            <Card className="rounded-[2rem] border-slate-200/80 dark:border-slate-800 p-6 space-y-6 bg-white dark:bg-slate-900 shadow-sm animate-in fade-in duration-300">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-purple-50 dark:bg-purple-950/40 text-purple-600 rounded-xl">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black tracking-tight text-slate-900 dark:text-white">Prescription Layout & Styling</h3>
                    <p className="text-xs text-slate-400 font-medium">Select a default template preset and brand theme color for all doctors in this clinic.</p>
                  </div>
                </div>
                {isClinicOwner ? (
                  <Badge className="bg-emerald-50 text-emerald-600 border border-emerald-200 text-[10px] uppercase font-black px-2.5 py-0.5 rounded-full">
                    Owner Active
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 gap-1 rounded-full font-bold">
                    <Lock className="w-3 h-3" /> Managed by Owner
                  </Badge>
                )}
              </div>

              {/* Layout Presets Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {TEMPLATE_PRESETS.map((t) => (
                  <div
                    key={t.id}
                    onClick={() => isClinicOwner && setTemplateId(t.id as any)}
                    className={cn(
                      "p-4 rounded-2xl border-2 transition-all flex flex-col justify-between gap-3 text-left",
                      templateId === t.id
                        ? "border-blue-600 bg-blue-50/50 dark:bg-blue-950/30 shadow-md ring-2 ring-blue-500/20"
                        : "border-slate-150 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30",
                      isClinicOwner ? "cursor-pointer" : "cursor-not-allowed opacity-60"
                    )}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <h4 className="font-black text-sm text-slate-900 dark:text-white">{t.name}</h4>
                        {templateId === t.id && (
                          <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0">
                            <Check className="w-3 h-3" />
                          </div>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 font-medium leading-relaxed">{t.description}</p>
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 w-fit border border-slate-200/60 dark:border-slate-700">
                      {t.badge}
                    </span>
                  </div>
                ))}
              </div>

              {/* Accent Color Chooser */}
              <div className="pt-2 space-y-3">
                <Label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                  <Palette className="w-4 h-4 text-slate-400" /> Clinic Brand Primary Color
                </Label>
                <div className="flex flex-wrap items-center gap-3">
                  {PRESET_COLORS.map(c => (
                    <button
                      key={c.hex}
                      type="button"
                      disabled={!isClinicOwner}
                      onClick={() => setPrimaryColor(c.hex)}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold transition-all",
                        primaryColor === c.hex
                          ? "border-slate-900 dark:border-white shadow-sm ring-2 ring-slate-400/20"
                          : "border-slate-200 dark:border-slate-800 hover:border-slate-300",
                        !isClinicOwner && "cursor-not-allowed opacity-60"
                      )}
                    >
                      <span className="w-4 h-4 rounded-full border border-black/10 shrink-0" style={{ backgroundColor: c.hex }} />
                      <span className="text-slate-800 dark:text-slate-200">{c.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Toggle Vitals Bar */}
              <div className="pt-2 flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Include Clinical Vitals Sidebar</p>
                  <p className="text-[11px] text-slate-400">Display Weight, BP, Pulse, SpO2, Temp, and CBG column on right margin</p>
                </div>
                <input
                  type="checkbox"
                  checked={showVitalsSidebar}
                  disabled={!isClinicOwner}
                  onChange={e => setShowVitalsSidebar(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                />
              </div>

              <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
                <Button
                  onClick={handleSaveAllSettings}
                  disabled={savingSettings || !isClinicOwner}
                  className="rounded-xl px-6 font-bold text-xs bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {savingSettings ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Check className="w-3.5 h-3.5 mr-1" />}
                  Save Prescription Design
                </Button>
              </div>
            </Card>
          )}

          {/* ── SUBSECTION 4: THEMES & APP APPEARANCE (Accessible to EVERYONE) ── */}
          {activeTab === 'themes' && (
            <div className="space-y-6 animate-in fade-in duration-300 max-w-4xl">
              <Card className="rounded-[2rem] border-slate-200/80 dark:border-slate-800 p-6 sm:p-7 space-y-6 bg-white dark:bg-slate-900 shadow-sm">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-purple-50 dark:bg-purple-950/40 text-purple-600 rounded-xl">
                      <Palette className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black tracking-tight text-slate-900 dark:text-white">App Themes & Personalization</h3>
                      <p className="text-xs text-slate-400 font-medium">Personal device preferences · Applied instantly to your browser</p>
                    </div>
                  </div>
                  <Badge className="bg-blue-50 text-blue-600 border border-blue-200 text-[10px] uppercase font-black px-2.5 py-0.5 rounded-full">
                    Every Device Independent
                  </Badge>
                </div>

                {/* Theme Mode Toggle (Light / Dark / System) */}
                <div className="space-y-3">
                  <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Interface Display Mode</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      { id: 'light', label: 'Light Mode', icon: Sun, desc: 'Clean high-contrast clinical white' },
                      { id: 'dark', label: 'Dark Mode', icon: Moon, desc: 'Deep slate night charting' },
                      { id: 'system', label: 'Auto System', icon: Monitor, desc: 'Synchronizes with OS schedule' },
                    ].map((m) => {
                      const Icon = m.icon;
                      const isSelected = theme === m.id;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setTheme(m.id as any)}
                          className={cn(
                            "p-4 rounded-2xl border text-left transition-all flex flex-col justify-between gap-3",
                            isSelected
                              ? "border-blue-600 bg-blue-50/40 dark:bg-blue-950/20 ring-2 ring-blue-500/20 shadow-xs"
                              : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900"
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <div className={cn("p-2 rounded-xl", isSelected ? "bg-blue-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500")}>
                              <Icon className="w-4 h-4" />
                            </div>
                            {isSelected && <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />}
                          </div>
                          <div>
                            <p className="font-bold text-xs text-slate-900 dark:text-white">{m.label}</p>
                            <p className="text-[10px] text-slate-400 font-medium mt-0.5">{m.desc}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Accent Brand Palette */}
                <div className="space-y-3 pt-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">System Brand Accent Color</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {ACCENT_OPTIONS.map((acc) => {
                      const isSelected = accent === acc.id;
                      return (
                        <button
                          key={acc.id}
                          type="button"
                          onClick={() => setAccent(acc.id as any)}
                          className={cn(
                            "p-3 rounded-2xl border flex items-center gap-2.5 transition-all text-left",
                            isSelected
                              ? "border-slate-900 dark:border-white shadow-sm ring-2 ring-slate-400/20"
                              : "border-slate-200 dark:border-slate-800 hover:border-slate-300 bg-white dark:bg-slate-900"
                          )}
                        >
                          <span className="w-5 h-5 rounded-full shrink-0 shadow-xs border border-black/10 flex items-center justify-center" style={{ backgroundColor: acc.color }}>
                            {isSelected && <Check className="w-3 h-3 text-white" />}
                          </span>
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{acc.name}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Custom Color Wheel & Hex Picker */}
                  <div className="pt-2">
                    <div className={cn(
                      "p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4",
                      accent === 'custom'
                        ? "border-primary/50 bg-primary/5 dark:bg-primary/10 ring-2 ring-primary/20"
                        : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                    )}>
                      <div className="flex items-center gap-3.5">
                        <div 
                          className="relative w-12 h-12 rounded-2xl shadow-md border-2 border-white dark:border-slate-800 overflow-hidden cursor-pointer shrink-0 transition-transform hover:scale-105 active:scale-95 group" 
                          style={{ backgroundColor: customColor || '#2563eb' }}
                          title="Click to open color palette"
                        >
                          <input
                            type="color"
                            value={customColor || '#2563eb'}
                            onChange={(e) => {
                              setCustomColor(e.target.value);
                              setAccent('custom');
                            }}
                            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer scale-150"
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                            <Palette className="w-4 h-4 text-white drop-shadow" />
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">
                              Custom Color Picker
                            </h4>
                            {accent === 'custom' && (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-primary text-white">Active</span>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground font-medium">Click the swatch to choose any color with the color wheel, or enter HEX code</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-start sm:self-auto">
                        <div className="relative flex items-center">
                          <span className="absolute left-2.5 text-xs font-mono font-bold text-slate-400">#</span>
                          <input
                            type="text"
                            value={(customColor || '').replace('#', '')}
                            maxLength={6}
                            onChange={(e) => {
                              const hex = `#${e.target.value.replace(/[^0-9A-Fa-f]/g, '')}`;
                              setCustomColor(hex);
                              if (hex.length === 7) {
                                setAccent('custom');
                              }
                            }}
                            placeholder="2563eb"
                            className="w-24 pl-6 pr-2.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 font-mono text-xs font-bold bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary uppercase"
                          />
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => setAccent('custom')}
                          className={cn(
                            "h-9 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all",
                            accent === 'custom'
                              ? "bg-primary text-white shadow-sm"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                          )}
                        >
                          {accent === 'custom' ? 'Applied' : 'Apply'}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Live Feedback Preview Card */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-primary text-white shrink-0 shadow-xs">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
                    Your chosen theme is active! Navigation icons, buttons, badges, and illuminated focus rings now glow with your personal preference on this device.
                  </div>
                </div>
              </Card>
            </div>
          )}
        </div>

        {/* ── RIGHT COLUMN: DYNAMIC LIVE PRESCRIPTION PREVIEW ── */}
        {activeTab !== 'themes' && (
          <div className="lg:col-span-5 sticky top-24 space-y-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <Eye className="w-4 h-4 text-blue-600" /> Live Prescription Preview
            </h3>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              A4 Scale Layout
            </span>
          </div>

          <div className="rounded-[2.5rem] p-3 sm:p-5 bg-slate-900/90 shadow-2xl border border-slate-800 overflow-hidden flex justify-center">
            <div className="w-full bg-white rounded-2xl shadow-lg overflow-hidden transition-all duration-300">
              <PrescriptionTemplate
                clinicName={deferredClinicName || 'Clinic Name'}
                clinicAddress={deferredClinicAddress || 'Clinic Address'}
                clinicPhone={deferredClinicPhone || '+91 00000 00000'}
                clinicCaption={deferredClinicCaption}
                clinicLogo={clinicPhotoUrl || undefined}
                clinicWatermark={watermarkUrl || undefined}
                headerMode={headerMode}
                brandingOption={brandingOption}
                templateId={templateId}
                primaryColor={primaryColor}
                showVitalsSidebar={showVitalsSidebar}
                doctorName={doctorDisplayName}
                doctorQualifications={profile?.qualifications || "MBBS., MD."}
                doctorRegId={profile?.registration_id || "152590"}
                doctorSignature={(profile as any)?.signature_data}
                patient={{
                  title: 'Mr.',
                  name: 'Kumar',
                  sex: 'Male',
                  age: 32,
                  registration_id: 'REG-202611'
                }}
                visit={{
                  weight: 68,
                  blood_pressure: '120/80',
                  pulse_rate: 74,
                  spo2: 99,
                  temperature: 98.4,
                  cbg: 110,
                  diagnosis: 'Acute Upper Respiratory Infection'
                }}
                medicines={[
                  { type: 'Tab.', name: 'Paracetamol 650', route: 'Oral', dosage: '1', frequency: '1-0-1', duration: '3 days', notes: 'After food' },
                  { type: 'Tab.', name: 'Amoxicillin 500mg', route: 'Oral', dosage: '1', frequency: '1-0-1', duration: '5 days', notes: 'After food' }
                ]}
                advice="Drink warm water, take rest, and review after 5 days if fever persists."
                isPrint={false}
              />
            </div>
          </div>
        </div>
        )}

      </div>
    </div>
  );
}
