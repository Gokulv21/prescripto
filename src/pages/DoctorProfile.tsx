import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { sanitizeText, validatePhone, validateNumericRange } from '@/lib/security-sanitize';
import { useNavigate, useParams, useOutletContext } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
    Users, Calendar, Activity, Clock, ShieldCheck, User, Loader2,
    UserCheck, BarChart3, PieChart, Settings, Mail, Phone, MapPin,
    Medal, FileSignature, Save, RefreshCw, Plus, Stethoscope, Printer,
    ArrowRight, CheckCircle2, Circle, PanelLeft, LayoutDashboard,
    Group, Info, Moon, Sun, HeartPulse, TrendingUp, Search, UserPlus, Camera, Trash2, Eye, X, Pencil, ChevronDown,
    Lock, Building2, Upload, Palette, Sparkles, Check, Pipette, Sliders, Stamp, FileText
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { startOfDay, endOfDay, subDays, format, isSameDay, parseISO } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from 'sonner';
import { getPatientCurrentAge, formatAge } from '@/lib/utils';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart as RePieChart, Pie, Cell, LineChart, Line, AreaChart, Area, Legend
} from 'recharts';
import SignaturePad from '@/components/SignaturePad';
import { useTheme, ACCENT_OPTIONS, AccentColor, hexToRgb, rgbToHex } from '@/components/ThemeProvider';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
    DialogDescription, DialogFooter
} from '@/components/ui/dialog';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from '@/lib/utils';
import type { Clinic } from '@/types/clinic';

type ProfileData = {
    full_name: string;
    email?: string;
    qualifications?: string;
    registration_id?: string;
    clinic_name?: string;
    clinic_address?: string;
    clinic_phone?: string;
    clinic_photo?: string;
    signature_data?: string;
    avatar_url?: string;
    theme?: string;
};

const AVATAR_OPTIONS = [
    { name: 'Dr. Male (Blue)', url: '/prescripto/avatars/doctor_male_1.png' },
    { name: 'Dr. Female (Pink)', url: '/prescripto/avatars/doctor_female_1.png' },
    { name: 'Dr. Male (Emerald)', url: '/prescripto/avatars/doctor_male_2.png' },
    { name: 'Dr. Female (Purple)', url: '/prescripto/avatars/doctor_female_2.png' },
];

const getAvatarUrl = (url?: string | null) => {
    if (!url || typeof url !== 'string' || url.trim() === '') return AVATAR_OPTIONS[2].url;
    const clean = url.trim();
    if (clean.startsWith('data:') || clean.startsWith('http://') || clean.startsWith('https://')) return clean;
    if (clean.startsWith('/prescripto/')) return clean;
    if (clean.startsWith('/avatars/')) return `/prescripto${clean}`;
    return `/prescripto/${clean.replace(/^\//, '')}`;
};

// Converts image file to an optimized binary Blob preserving PNG transparency
const fileToOptimizedBlob = (
    file: File,
    maxWidth = 1200,
    quality = 0.88
): Promise<{ blob: Blob; mime: string; ext: string }> => {
    return new Promise((resolve, reject) => {
        const isPng = file.type === 'image/png' || file.name.toLowerCase().endsWith('.png');
        const isWebp = file.type === 'image/webp' || file.name.toLowerCase().endsWith('.webp');
        const targetMime = isPng ? 'image/png' : isWebp ? 'image/webp' : 'image/jpeg';
        const targetExt = isPng ? 'png' : isWebp ? 'webp' : 'jpg';

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                let width = img.width;
                let height = img.height;
                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    resolve({ blob: file, mime: file.type || targetMime, ext: targetExt });
                    return;
                }
                ctx.drawImage(img, 0, 0, width, height);
                canvas.toBlob(
                    (blob) => {
                        if (blob) resolve({ blob, mime: targetMime, ext: targetExt });
                        else resolve({ blob: file, mime: file.type || targetMime, ext: targetExt });
                    },
                    targetMime,
                    targetMime === 'image/png' ? undefined : quality
                );
            };
            img.onerror = () => resolve({ blob: file, mime: file.type || targetMime, ext: targetExt });
            img.src = e.target?.result as string;
        };
        reader.onerror = () => reject(new Error('Failed to read image file'));
        reader.readAsDataURL(file);
    });
};

const COMMON_FREQUENCIES = [
    '1-0-1', '1-1-1', '0-0-1', '1-0-0', '0-1-0', '1-1-0', '0-1-1', 
    'Stat', 'SOS', 'Twice daily', 'Thrice daily', 'Four times daily', 'Before food', 'After food'
];

export default function DoctorProfile() {
    const { user, roles, hasRole, refresh: refreshAuth } = useAuth();
    const { theme, setTheme, accent, setAccent, customColor, setCustomColor } = useTheme();
    const { slug } = useParams();
    const { clinic } = useOutletContext<{ clinic: Clinic }>();
    const navigate = useNavigate();

    // Local RGB Picker state
    const [colorPickerOpen, setColorPickerOpen] = useState(false);
    const [rgbVals, setRgbVals] = useState(() => hexToRgb(customColor || '#2563eb'));
    const [hexInput, setHexInput] = useState(customColor || '#2563eb');

    useEffect(() => {
        if (customColor) {
            setRgbVals(hexToRgb(customColor));
            setHexInput(customColor.toUpperCase());
        }
    }, [customColor]);

    const handleRgbChange = (channel: 'r' | 'g' | 'b', val: number) => {
        const clamped = Math.max(0, Math.min(255, isNaN(val) ? 0 : val));
        const updated = { ...rgbVals, [channel]: clamped };
        setRgbVals(updated);
        const hex = rgbToHex(updated.r, updated.g, updated.b).toUpperCase();
        setHexInput(hex);
        setCustomColor(hex);
    };

    const handleHexChange = (val: string) => {
        let clean = val.trim();
        if (!clean.startsWith('#')) clean = '#' + clean;
        setHexInput(clean);
        if (/^#[0-9A-F]{6}$/i.test(clean)) {
            const rgb = hexToRgb(clean);
            setRgbVals(rgb);
            setCustomColor(clean);
        }
    };
    const isClinicOwner = Boolean(
        clinic?.id && user?.id && (
            clinic.owner_id === user.id ||
            (roles?.includes('owner') && (!clinic.owner_id || clinic.owner_id === user.id))
        )
    );

    // Dynamic page title
    useEffect(() => {
        document.title = `Profile${clinic?.name ? ` — ${clinic.name}` : ''} | Prescripto`;
        return () => { document.title = 'Prescripto'; };
    }, [clinic?.name]);
    const [profile, setProfile] = useState<ProfileData | null>(null);
    const [ownerProfile, setOwnerProfile] = useState<any>(null);
    const [activeTab, setActiveTab] = useState(() => {
        return localStorage.getItem('profileActiveTab') || 'overview';
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [clinicUploading, setClinicUploading] = useState(false);
    const [watermarkUrl, setWatermarkUrl] = useState<string | null>(null);
    const [watermarkUploading, setWatermarkUploading] = useState(false);
    const [headerMode, setHeaderMode] = useState<'name' | 'logo' | 'both'>('both');
    const [clinicCaption, setClinicCaption] = useState<string>('24/7 Emergency · ECG · Lab');
    const [settingsSection, setSettingsSection] = useState<'template' | 'identity' | 'appearance'>('template');
    const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const clinicFileInputRef = useRef<HTMLInputElement>(null);
    const watermarkFileInputRef = useRef<HTMLInputElement>(null);

    // Stats & Analytics State
    const [stats, setStats] = useState({
        totalPatients: 0,
        todayPatients: 0,
        weeklyData: [] as any[],
        demographics: [] as any[],
        recentActivity: [] as any[]
    });

    const [protocols, setProtocols] = useState<any[]>([]);
    const [showAddProtocolDialog, setShowAddProtocolDialog] = useState(false);
    const [isSavingProtocol, setIsSavingProtocol] = useState(false);
    const [newProtocolName, setNewProtocolName] = useState('');
    const [newProtocolMedicines, setNewProtocolMedicines] = useState<any[]>([]);
    const [editingProtocolId, setEditingProtocolId] = useState<string | null>(null);
    const [openFreqPopoverIndex, setOpenFreqPopoverIndex] = useState<number | null>(null);

    useEffect(() => {
        fetchData();
    }, [user?.id]);

    async function fetchData() {
        if (!user?.id) return;
        setLoading(true);
        try {
            // 1. Fetch Profile
            const { data: profData } = await supabase
                .from('profiles')
                .select('*')
                .eq('user_id', user.id)
                .single();

            if (profData) {
                setProfile({
                    ...profData,
                    email: user.email
                });
            }

            // Fetch Clinic branding & Watermark from Supabase Storage avatars bucket & profile metadata
            let clinicPhotoUrl = '';
            let clinicWatermarkUrl = '';
            let clinicHeaderMode: 'name' | 'logo' | 'both' = 'both';
            let clinicCaptionVal = '24/7 Emergency · ECG · Lab';

            if (profData?.bio) {
                try {
                    const parsed = JSON.parse(profData.bio);
                    if (parsed?.clinic_photo) clinicPhotoUrl = parsed.clinic_photo;
                    if (parsed?.clinic_watermark) clinicWatermarkUrl = parsed.clinic_watermark;
                    if (parsed?.prescription_header_mode) clinicHeaderMode = parsed.prescription_header_mode;
                    if (parsed?.clinic_caption !== undefined) clinicCaptionVal = parsed.clinic_caption;
                } catch (e) {}
            }

            if (clinic?.id) {
                // Check localStorage cache for instant responsiveness
                const cachedMode = localStorage.getItem(`prescripto_clinic_header_mode_${clinic.id}`);
                if (cachedMode && ['name', 'logo', 'both'].includes(cachedMode)) {
                    clinicHeaderMode = cachedMode as any;
                }
                const cachedCaption = localStorage.getItem(`prescripto_clinic_caption_${clinic.id}`);
                if (cachedCaption !== null) {
                    clinicCaptionVal = cachedCaption;
                }

                try {
                    const { data: list } = await supabase.storage.from('avatars').list(clinic.id);
                    const brandingFile = list?.find(f => f.name.startsWith('clinic-branding'));
                    if (brandingFile) {
                        const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(`${clinic.id}/${brandingFile.name}`);
                        clinicPhotoUrl = `${publicUrl}?t=${new Date(brandingFile.updated_at || Date.now()).getTime()}`;
                    }
                    const watermarkFile = list?.find(f => f.name.startsWith('clinic-watermark'));
                    if (watermarkFile) {
                        const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(`${clinic.id}/${watermarkFile.name}`);
                        clinicWatermarkUrl = `${publicUrl}?t=${new Date(watermarkFile.updated_at || Date.now()).getTime()}`;
                    }
                } catch (storageErr) {
                    console.warn('Avatars storage check warning:', storageErr);
                }

                const { data: clinicData } = await supabase
                    .from('clinics')
                    .select('name, address, phone, owner_id')
                    .eq('id', clinic.id)
                    .single();
                
                if (clinicData) {
                    // Update profile state with clinic specific data if needed
                    const isOwnerUser = Boolean(
                        clinicData.owner_id === user.id ||
                        (roles?.includes('owner') && (!clinicData.owner_id || clinicData.owner_id === user.id))
                    );

                    setWatermarkUrl(clinicWatermarkUrl);
                    setHeaderMode(clinicHeaderMode);
                    setClinicCaption(clinicCaptionVal);

                    if (isOwnerUser) {
                        setProfile(prev => ({
                            ...prev!,
                            clinic_name: clinicData.name,
                            clinic_address: clinicData.address || '',
                            clinic_phone: clinicData.phone || '',
                            clinic_photo: clinicPhotoUrl || prev?.clinic_photo || ''
                        }));
                    } else {
                        // For non-owners (including superadmin/staff), fetch owner profile to read owner preferences if not cached
                        if (clinicData.owner_id) {
                            try {
                                const { data: ownerProf } = await supabase
                                    .from('profiles')
                                    .select('bio')
                                    .eq('user_id', clinicData.owner_id)
                                    .maybeSingle();
                                if (ownerProf?.bio) {
                                    const parsed = JSON.parse(ownerProf.bio);
                                    if (parsed?.prescription_header_mode && !cachedMode) {
                                        clinicHeaderMode = parsed.prescription_header_mode;
                                        setHeaderMode(parsed.prescription_header_mode);
                                    }
                                    if (parsed?.clinic_watermark && !clinicWatermarkUrl) {
                                        clinicWatermarkUrl = parsed.clinic_watermark;
                                        setWatermarkUrl(parsed.clinic_watermark);
                                    }
                                    if (parsed?.clinic_photo && !clinicPhotoUrl) {
                                        clinicPhotoUrl = parsed.clinic_photo;
                                    }
                                    if (parsed?.clinic_caption !== undefined && !cachedCaption) {
                                        clinicCaptionVal = parsed.clinic_caption;
                                        setClinicCaption(parsed.clinic_caption);
                                    }
                                }
                            } catch (e) {}
                        }

                        // For non-owners, show clinic branding in read-only
                        setOwnerProfile({
                            clinic_name: clinicData.name,
                            clinic_address: clinicData.address,
                            clinic_phone: clinicData.phone,
                            clinic_photo: clinicPhotoUrl,
                            clinic_watermark: clinicWatermarkUrl,
                            header_mode: clinicHeaderMode,
                            clinic_caption: clinicCaptionVal
                        });
                    }
                }
            }

            // 2. Fetch Stats
            const todayStart = startOfDay(new Date()).toISOString();
            const { count: totalCount } = await supabase.from('patients').select('*', { count: 'exact', head: true }).eq('clinic_id', clinic?.id);
            const { count: todayCount } = await supabase.from('visits').select('*', { count: 'exact', head: true }).eq('clinic_id', clinic?.id).gte('created_at', todayStart);

            // 3. Weekly Traffic (Last 7 days) & Stats for specific doctor (from prescriptions)
            const last7Days = Array.from({ length: 7 }, (_, i) => {
                const date = subDays(new Date(), 6 - i);
                return {
                    date: format(date, 'EEE'),
                    fullDate: format(date, 'yyyy-MM-dd'),
                    count: 0
                };
            });

            const { data: doctorPrescriptions } = await supabase
                .from('prescriptions')
                .select('created_at, patient_id')
                .eq('clinic_id', clinic?.id)
                .eq('doctor_id', user.id);

            const uniquePatients = new Set<string>();
            let todayRxCount = 0;

            if (doctorPrescriptions) {
                doctorPrescriptions.forEach(p => {
                    if (p.patient_id) uniquePatients.add(p.patient_id);
                    
                    const pDate = new Date(p.created_at);
                    if (pDate >= startOfDay(new Date())) {
                        todayRxCount++;
                    }

                    const day = format(pDate, 'yyyy-MM-dd');
                    const dayData = last7Days.find(d => d.fullDate === day);
                    if (dayData) dayData.count++;
                });
            }

            // 4. Demographics (Age + Gender) - filtered for this doctor's patients
            const patientIds = Array.from(uniquePatients);
            let demoData: any[] = [];
            
            if (patientIds.length > 0) {
                // Supabase doesn't easily support WHERE id IN (array of 1000s), so we'll just fetch all and filter client side
                const { data: patients } = await supabase.from('patients').select('id, sex, age, dob, created_at').eq('clinic_id', clinic?.id);
                const docPatients = patients?.filter(p => patientIds.includes(p.id)) || [];
                
                const ageThreshold = 18;
                demoData = [
                    { name: 'Men (>= 18)', value: docPatients.filter(p => p.sex === 'Male' && (getPatientCurrentAge(p) ?? p.age ?? 0) >= ageThreshold).length, color: '#2563eb' },
                    { name: 'Women (>= 18)', value: docPatients.filter(p => p.sex === 'Female' && (getPatientCurrentAge(p) ?? p.age ?? 0) >= ageThreshold).length, color: '#db2777' },
                    { name: 'Boys (< 18)', value: docPatients.filter(p => p.sex === 'Male' && (getPatientCurrentAge(p) ?? p.age ?? 0) < ageThreshold).length, color: '#60a5fa' },
                    { name: 'Girls (< 18)', value: docPatients.filter(p => p.sex === 'Female' && (getPatientCurrentAge(p) ?? p.age ?? 0) < ageThreshold).length, color: '#f472b6' },
                    { name: 'Other', value: docPatients.filter(p => p.sex === 'Other').length, color: '#94a3b8' }
                ].filter(d => d.value > 0);
            }

            // 5. Recent Activity
            const { data: recent } = await supabase
                .from('visits')
                .select('id, created_at, status, patients(name, age, dob, created_at, sex)')
                .eq('clinic_id', clinic?.id)
                .order('created_at', { ascending: false })
                .limit(8);

            // 6. Protocols List
            const { data: protocolData } = await supabase
                .from('medicine_protocols')
                .select('*')
                .eq('clinic_id', clinic?.id)
                .order('name');
            setProtocols(protocolData || []);

            setStats({
                totalPatients: uniquePatients.size,
                todayPatients: todayRxCount,
                weeklyData: last7Days,
                demographics: demoData,
                recentActivity: recent || []
            });

        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user?.id || !profile) return;
        setSaving(true);
        try {
            // 1. Sanitize Inputs
            const sData = {
                full_name: sanitizeText(profile.full_name, 100),
                qualifications: sanitizeText(profile.qualifications || '', 200),
                registration_id: sanitizeText(profile.registration_id || '', 50),
                clinic_name: sanitizeText(profile.clinic_name || '', 100),
                clinic_address: sanitizeText(profile.clinic_address || '', 500),
                clinic_phone: profile.clinic_phone ? profile.clinic_phone.trim() : '',
            };

            if (sData.clinic_phone && !validatePhone(sData.clinic_phone)) {
                toast.error("Invalid clinic phone format");
                setSaving(false);
                return;
            }

            // Update profiles table (only columns that actually exist in DB)
            const profilePayload: any = {
                full_name: sData.full_name,
                qualifications: sData.qualifications,
                registration_id: sData.registration_id,
                signature_data: profile.signature_data,
                // @ts-ignore
                avatar_url: profile.avatar_url,
                theme: theme
            };

            // Only update clinic branding columns in profiles if current user is the owner
            if (isClinicOwner) {
                profilePayload.clinic_name = sData.clinic_name;
                profilePayload.clinic_address = sData.clinic_address;
                profilePayload.clinic_phone = sData.clinic_phone;
                try {
                    let curBio: any = {};
                    if (profile.bio) {
                        try { curBio = JSON.parse(profile.bio); } catch(e) {}
                    }
                    if (profile.clinic_photo) curBio.clinic_photo = profile.clinic_photo;
                    if (watermarkUrl) curBio.clinic_watermark = watermarkUrl;
                    curBio.prescription_header_mode = headerMode;
                    curBio.clinic_caption = clinicCaption;
                    profilePayload.bio = JSON.stringify(curBio);
                } catch (e) {}
            }

            const { error } = await supabase
                .from('profiles')
                .update(profilePayload)
                .eq('user_id', user.id);

            if (error) throw error;

            // 2. Update Clinic Branding (ONLY if true owner of this clinic and only existing columns)
            if (isClinicOwner && clinic?.id) {
                const { error: clinicError } = await supabase
                    .from('clinics')
                    .update({
                        name: sData.clinic_name,
                        address: sData.clinic_address,
                        phone: sData.clinic_phone
                    })
                    .eq('id', clinic.id);
                if (clinicError) {
                    console.warn('Clinic info update warning:', clinicError);
                }
            }

            toast.success('Profile and settings updated successfully');
            await refreshAuth().catch(() => {});
        } catch (err: any) {
            console.error(err);
            toast.error(err.message || 'Failed to update profile');
        } finally {
            setSaving(false);
        }
    };

    const handleClinicPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!isClinicOwner) {
            toast.error('Only the Clinic Owner can change the clinic branding photo.');
            return;
        }
        const file = e.target.files?.[0];
        if (!file || !user?.id || !clinic?.id) return;

        if (!file.type.startsWith('image/')) {
            toast.error('Please upload an image file');
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            toast.error('Image size must be less than 10MB');
            return;
        }

        setClinicUploading(true);
        try {
            // 1. Client-side compress / optimize image while preserving PNG transparency
            const { blob, mime, ext } = await fileToOptimizedBlob(file, 1200, 0.9);

            // 2. Clear previous clinic-branding files from storage to prevent stale collisions
            try {
                const { data: list } = await supabase.storage.from('avatars').list(clinic.id);
                const oldBrandFiles = list?.filter(f => f.name.startsWith('clinic-branding')) || [];
                if (oldBrandFiles.length > 0) {
                    await supabase.storage.from('avatars').remove(oldBrandFiles.map(f => `${clinic.id}/${f.name}`));
                }
            } catch (cleanupErr) {
                console.warn('Old branding cleanup warning:', cleanupErr);
            }

            // 3. Upload directly to Supabase Storage bucket 'avatars' with clinic ID prefix for RLS compliance
            const filePath = `${clinic.id}/clinic-branding.${ext}`;
            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, blob, {
                    contentType: mime,
                    upsert: true
                });

            if (uploadError) throw uploadError;

            // 4. Obtain public URL from Supabase Storage
            const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(filePath);

            const finalUrl = `${publicUrl}?t=${Date.now()}`;

            // 5. Save metadata reference in profiles.bio as clean JSON
            try {
                let currentMeta: any = {};
                if (profile?.bio) {
                    try { currentMeta = JSON.parse(profile.bio); } catch (e) {}
                }
                const updatedMeta = { ...currentMeta, clinic_photo: finalUrl };
                await supabase.from('profiles').update({ bio: JSON.stringify(updatedMeta) }).eq('user_id', user.id);
            } catch (bioErr) {
                console.warn('Bio update warning:', bioErr);
            }

            // 6. Update local state so it displays immediately
            setProfile(prev => prev ? { ...prev, clinic_photo: finalUrl } : null);
            setOwnerProfile(prev => prev ? { ...prev, clinic_photo: finalUrl } : null);

            toast.success('Clinic logo stored in Supabase Storage successfully');
            refreshAuth().catch(() => {});
        } catch (err: any) {
            console.error(err);
            toast.error(err.message || 'Failed to upload clinic photo');
        } finally {
            setClinicUploading(false);
            if (clinicFileInputRef.current) clinicFileInputRef.current.value = '';
        }
    };

    const handleDeleteClinicPhoto = async () => {
        if (!isClinicOwner) {
            toast.error('Only the Clinic Owner can delete the clinic photo.');
            return;
        }
        if (!clinic?.id) return;

        const confirmDelete = window.confirm('Are you sure you want to delete the clinic photo?');
        if (!confirmDelete) return;

        setClinicUploading(true);
        try {
            // 1. Remove all clinic-branding files from Supabase Storage avatars bucket
            const { data: list } = await supabase.storage.from('avatars').list(clinic.id);
            const oldBrandFiles = list?.filter(f => f.name.startsWith('clinic-branding')) || [];
            if (oldBrandFiles.length > 0) {
                await supabase.storage.from('avatars').remove(oldBrandFiles.map(f => `${clinic.id}/${f.name}`));
            }

            // 2. Clear clinic_photo metadata in profiles.bio
            try {
                let currentMeta: any = {};
                if (profile?.bio) {
                    try { currentMeta = JSON.parse(profile.bio); } catch (e) {}
                }
                delete currentMeta.clinic_photo;
                await supabase.from('profiles').update({ bio: JSON.stringify(currentMeta) }).eq('user_id', user?.id);
            } catch (e) {}

            // 3. Update local state
            setProfile(prev => prev ? { ...prev, clinic_photo: undefined } : null);
            setOwnerProfile(prev => prev ? { ...prev, clinic_photo: null } : null);
            toast.success('Clinic photo removed');
            refreshAuth().catch(() => {});
        } catch (err: any) {
            console.error(err);
            toast.error(err.message || 'Failed to delete clinic photo');
        } finally {
            setClinicUploading(false);
        }
    };

    const handleWatermarkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!isClinicOwner) {
            toast.error('Only the Clinic Owner can change the clinic watermark.');
            return;
        }
        const file = e.target.files?.[0];
        if (!file || !user?.id || !clinic?.id) return;

        if (!file.type.startsWith('image/')) {
            toast.error('Please upload an image file (PNG recommended for transparent background)');
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            toast.error('Image size must be less than 10MB');
            return;
        }

        setWatermarkUploading(true);
        try {
            // 1. Optimize image (preserving PNG transparency for watermark!)
            const { blob, mime, ext } = await fileToOptimizedBlob(file, 1600, 0.9);

            // 2. Clear previous watermark files from storage to prevent collisions
            try {
                const { data: list } = await supabase.storage.from('avatars').list(clinic.id);
                const oldWmFiles = list?.filter(f => f.name.startsWith('clinic-watermark')) || [];
                if (oldWmFiles.length > 0) {
                    await supabase.storage.from('avatars').remove(oldWmFiles.map(f => `${clinic.id}/${f.name}`));
                }
            } catch (cleanupErr) {
                console.warn('Old watermark cleanup warning:', cleanupErr);
            }

            // 3. Upload to Supabase Storage
            const filePath = `${clinic.id}/clinic-watermark.${ext}`;
            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, blob, {
                    contentType: mime,
                    upsert: true
                });

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(filePath);

            const finalUrl = `${publicUrl}?t=${Date.now()}`;

            // 4. Save in profiles.bio JSON
            try {
                let currentMeta: any = {};
                if (profile?.bio) {
                    try { currentMeta = JSON.parse(profile.bio); } catch (e) {}
                }
                const updatedMeta = {
                    ...currentMeta,
                    clinic_watermark: finalUrl,
                    prescription_header_mode: headerMode
                };
                await supabase.from('profiles').update({ bio: JSON.stringify(updatedMeta) }).eq('user_id', user.id);
            } catch (bioErr) {
                console.warn('Bio watermark update warning:', bioErr);
            }

            setWatermarkUrl(finalUrl);
            setOwnerProfile((prev: any) => prev ? { ...prev, clinic_watermark: finalUrl } : null);
            localStorage.setItem(`prescripto_clinic_watermark_${clinic.id}`, finalUrl);

            toast.success('Prescription watermark saved successfully!');
            refreshAuth().catch(() => {});
        } catch (err: any) {
            console.error(err);
            toast.error(err.message || 'Failed to upload watermark');
        } finally {
            setWatermarkUploading(false);
            if (watermarkFileInputRef.current) watermarkFileInputRef.current.value = '';
        }
    };

    const handleDeleteWatermark = async () => {
        if (!isClinicOwner) {
            toast.error('Only the Clinic Owner can delete the clinic watermark.');
            return;
        }
        if (!clinic?.id) return;

        const confirmDelete = window.confirm('Are you sure you want to remove the watermark for all prescriptions in this clinic?');
        if (!confirmDelete) return;

        setWatermarkUploading(true);
        try {
            const { data: list } = await supabase.storage.from('avatars').list(clinic.id);
            const wmFiles = list?.filter(f => f.name.startsWith('clinic-watermark')) || [];
            if (wmFiles.length > 0) {
                await supabase.storage.from('avatars').remove(wmFiles.map(f => `${clinic.id}/${f.name}`));
            }

            try {
                let currentMeta: any = {};
                if (profile?.bio) {
                    try { currentMeta = JSON.parse(profile.bio); } catch (e) {}
                }
                delete currentMeta.clinic_watermark;
                await supabase.from('profiles').update({ bio: JSON.stringify(currentMeta) }).eq('user_id', user?.id);
            } catch (e) {}

            setWatermarkUrl(null);
            setOwnerProfile((prev: any) => prev ? { ...prev, clinic_watermark: null } : null);
            localStorage.removeItem(`prescripto_clinic_watermark_${clinic.id}`);

            toast.success('Prescription watermark removed');
            refreshAuth().catch(() => {});
        } catch (err: any) {
            console.error(err);
            toast.error(err.message || 'Failed to remove watermark');
        } finally {
            setWatermarkUploading(false);
        }
    };

    const handleHeaderModeChange = async (mode: 'name' | 'logo' | 'both') => {
        if (!isClinicOwner) {
            toast.error('Only the Clinic Owner can change the prescription header style.');
            return;
        }
        setHeaderMode(mode);
        if (clinic?.id) {
            localStorage.setItem(`prescripto_clinic_header_mode_${clinic.id}`, mode);
        }

        try {
            let currentMeta: any = {};
            if (profile?.bio) {
                try { currentMeta = JSON.parse(profile.bio); } catch (e) {}
            }
            const updatedMeta = {
                ...currentMeta,
                prescription_header_mode: mode
            };
            if (watermarkUrl) updatedMeta.clinic_watermark = watermarkUrl;
            await supabase.from('profiles').update({ bio: JSON.stringify(updatedMeta) }).eq('user_id', user?.id);
            const modeLabel = mode === 'name' ? 'Clinic Name (Text)' : mode === 'logo' ? 'Clinic Logo (Display Photo)' : 'Both (Logo & Name)';
            toast.success(`Prescription header style updated: ${modeLabel}`);
        } catch (e: any) {
            console.warn('Failed to save header mode preference:', e);
        }
    };

    const handleCaptionChange = (val: string) => {
        setClinicCaption(val);
        if (clinic?.id) {
            localStorage.setItem(`prescripto_clinic_caption_${clinic.id}`, val);
        }
    };

    const handleSaveCaption = async (val?: string) => {
        const toSave = val !== undefined ? val : clinicCaption;
        if (!isClinicOwner) {
            toast.error('Only the Clinic Owner can change the prescription tagline/caption.');
            return;
        }
        if (clinic?.id) {
            localStorage.setItem(`prescripto_clinic_caption_${clinic.id}`, toSave);
        }
        try {
            let currentMeta: any = {};
            if (profile?.bio) {
                try { currentMeta = JSON.parse(profile.bio); } catch (e) {}
            }
            const updatedMeta = {
                ...currentMeta,
                clinic_caption: toSave
            };
            if (watermarkUrl) updatedMeta.clinic_watermark = watermarkUrl;
            if (headerMode) updatedMeta.prescription_header_mode = headerMode;
            await supabase.from('profiles').update({ bio: JSON.stringify(updatedMeta) }).eq('user_id', user?.id);
            toast.success(toSave ? `Tagline updated: "${toSave}"` : 'Tagline cleared (hidden from prescription)');
        } catch (e: any) {
            console.warn('Failed to save caption preference:', e);
            toast.error('Failed to save caption');
        }
    };

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !user?.id) return;

        if (!file.type.startsWith('image/')) {
            toast.error('Please upload an image file');
            return;
        }

        setUploading(true);
        try {
            // 1. Compress image to clean JPEG Blob
            const compressedBlob = await fileToOptimizedBlob(file, 600, 0.85);

            // 2. Supabase Storage upload inside clinic folder for strict RLS compliance
            const clinicFolder = clinic?.id || profile?.clinic_id;
            const filePath = `${clinicFolder}/avatar-${user.id}.jpg`;

            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, compressedBlob, {
                    contentType: 'image/jpeg',
                    upsert: true
                });

            if (uploadError) throw uploadError;

            // 3. Get Public URL
            const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(filePath);

            const finalUrl = `${publicUrl}?t=${Date.now()}`;

            // 4. Update Profile in database (avatar_url exists on profiles)
            const { error: updateError } = await supabase
                .from('profiles')
                .update({ avatar_url: finalUrl })
                .eq('user_id', user.id);

            if (updateError) throw updateError;

            setProfile(prev => prev ? { ...prev, avatar_url: finalUrl } : null);
            toast.success('Profile photo updated in Supabase Storage successfully');
            refreshAuth().catch(() => {});
        } catch (err: any) {
            console.error(err);
            toast.error(err.message || 'Failed to upload photo');
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleDeletePhoto = async () => {
        if (!profile?.avatar_url || !user?.id) return;

        const confirmDelete = window.confirm('Are you sure you want to delete your profile photo?');
        if (!confirmDelete) return;

        setUploading(true);
        try {
            const clinicFolder = clinic?.id || profile?.clinic_id;
            if (clinicFolder) {
                await supabase.storage.from('avatars').remove([`${clinicFolder}/avatar-${user.id}.jpg`]);
            }

            // Update Profile to null
            const { error: updateError } = await supabase
                .from('profiles')
                .update({ avatar_url: null })
                .eq('user_id', user.id);

            if (updateError) throw updateError;

            setProfile(prev => prev ? { ...prev, avatar_url: undefined } : null);
            toast.success('Profile photo removed');
            refreshAuth().catch(() => {});
        } catch (err: any) {
            console.error(err);
            toast.error(err.message || 'Failed to delete photo');
        } finally {
            setUploading(false);
        }
    };

    async function fetchProtocols() {
        if (!clinic?.id) return;
        const { data } = await supabase
            .from('medicine_protocols')
            .select('*')
            .eq('clinic_id', clinic.id)
            .order('name');
        setProtocols(data || []);
    }

    const handleSaveProtocol = async () => {
        if (!newProtocolName || newProtocolMedicines.length === 0 || !clinic?.id) return;
        setIsSavingProtocol(true);
        try {
            if (editingProtocolId) {
                const { error } = await supabase
                    .from('medicine_protocols')
                    .update({
                        name: newProtocolName,
                        medicines: newProtocolMedicines
                    })
                    .eq('id', editingProtocolId);
                if (error) throw error;
                toast.success('Protocol updated successfully');
            } else {
                const { error } = await supabase.from('medicine_protocols').insert({
                    name: newProtocolName,
                    clinic_id: clinic.id,
                    medicines: newProtocolMedicines
                });
                if (error) throw error;
                toast.success('Protocol saved successfully');
            }
            
            setNewProtocolName('');
            setNewProtocolMedicines([]);
            setEditingProtocolId(null);
            setShowAddProtocolDialog(false);
            fetchProtocols();
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setIsSavingProtocol(false);
        }
    };

    const handleEditProtocol = (protocol: any) => {
        setEditingProtocolId(protocol.id);
        setNewProtocolName(protocol.name);
        setNewProtocolMedicines(protocol.medicines || []);
        setShowAddProtocolDialog(true);
    };

    const handleAddNewProtocol = () => {
        setEditingProtocolId(null);
        setNewProtocolName('');
        setNewProtocolMedicines([{ type: 'Tab.', name: '', dosage: '', frequency: '', duration: '', route: '', instructions: '' }]);
        setShowAddProtocolDialog(true);
    };

    const handleDeleteProtocol = async (id: string) => {
        if (!window.confirm('Are you sure you want to delete this protocol?')) return;
        try {
            const { error } = await supabase.from('medicine_protocols').delete().eq('id', id);
            if (error) throw error;
            toast.success('Protocol deleted');
            fetchProtocols();
        } catch (err: any) {
            toast.error(err.message);
        }
    };

    const handleTabChange = (value: string) => {
        setActiveTab(value);
        localStorage.setItem('profileActiveTab', value);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
            </div>
        );
    }

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-10 animate-in fade-in duration-700 font-jakarta-sans pb-24">

            {/* Header Section */}
            <div className="flex flex-col lg:flex-row items-center lg:items-start justify-between gap-6 p-5 sm:p-8 rounded-3xl sm:rounded-[2.5rem] bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 sm:gap-6 text-center sm:text-left w-full lg:w-auto">
                    {/* Profile Photo Card */}
                    <div className="relative group perspective-1000 shrink-0">
                        <div className="w-28 h-36 sm:w-36 sm:h-44 rounded-2xl sm:rounded-[2rem] bg-slate-100 dark:bg-slate-800 shadow-lg overflow-hidden flex items-center justify-center transform transition-all duration-500 group-hover:scale-105 border-4 border-white dark:border-slate-800 relative">
                            <img
                                src={getAvatarUrl(profile?.avatar_url)}
                                className="w-full h-full object-cover"
                                alt="Profile"
                                onError={(e) => {
                                    e.currentTarget.onerror = null;
                                    e.currentTarget.src = AVATAR_OPTIONS[2].url;
                                }}
                            />
                            <div className="absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />

                            {/* Upload Overlay */}
                            <div className="absolute inset-0 z-20 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white gap-2 cursor-pointer p-2 backdrop-blur-xs">
                                <div className="grid grid-cols-2 gap-1.5 w-full px-2">
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setImagePreviewUrl(getAvatarUrl(profile?.avatar_url));
                                        }}
                                        className="flex flex-col items-center gap-1 hover:scale-105 transition-transform bg-white/20 hover:bg-white/30 p-2 rounded-xl text-white"
                                    >
                                        <Eye className="w-4 h-4" />
                                        <span className="text-[9px] font-black uppercase tracking-wider">Open</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            fileInputRef.current?.click();
                                        }}
                                        disabled={uploading}
                                        className="flex flex-col items-center gap-1 hover:scale-105 transition-transform bg-white/20 hover:bg-white/30 p-2 rounded-xl text-white"
                                    >
                                        {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                                        <span className="text-[9px] font-black uppercase tracking-wider text-center">Browse</span>
                                    </button>
                                </div>

                                {profile?.avatar_url?.startsWith('http') && (
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeletePhoto();
                                        }}
                                        disabled={uploading}
                                        className="flex items-center justify-center gap-1 text-red-200 hover:text-white bg-red-500/40 hover:bg-red-500/60 py-1.5 px-2 rounded-xl w-full mx-2 text-[9px] font-black uppercase tracking-wider transition-all"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" /> Remove
                                    </button>
                                )}
                            </div>
                        </div>
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handlePhotoUpload}
                            className="hidden"
                            accept="image/*"
                        />
                        <div className="absolute -bottom-2 -right-2 bg-emerald-500 text-white p-1.5 sm:p-2 rounded-2xl border-4 border-white dark:border-slate-800 shadow-xl z-20">
                            <CheckCircle2 className="w-4 h-4" />
                        </div>
                    </div>

                    <div className="space-y-2 max-w-xl">
                        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                            <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-slate-900 dark:text-slate-50">
                                {profile?.full_name || 'Dr. Doctor'}
                            </h1>
                            {roles.map(role => (
                                <span key={role} className="bg-slate-900 dark:bg-slate-50 dark:text-slate-900 text-white text-[10px] px-3 py-0.5 rounded-full font-black uppercase tracking-widest">
                                    {role}
                                </span>
                            ))}
                        </div>
                        <p className="text-primary font-bold text-sm sm:text-base tracking-tight">
                            {profile?.qualifications || "Update your credentials"}
                        </p>
                        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 text-slate-500 dark:text-slate-400 text-xs font-medium pt-1">
                            <div className="flex items-center gap-1.5 bg-slate-100/80 dark:bg-slate-800/80 px-2.5 py-1 rounded-xl">
                                <Mail className="w-3.5 h-3.5 text-primary" />
                                <span className="truncate max-w-[190px]">{user?.email}</span>
                            </div>
                            {profile?.registration_id && (
                                <div className="flex items-center gap-1.5 bg-slate-100/80 dark:bg-slate-800/80 px-2.5 py-1 rounded-xl font-bold text-slate-700 dark:text-slate-300">
                                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                                    <span>Reg: {profile.registration_id}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 sm:flex sm:items-center gap-2.5 w-full lg:w-auto justify-center lg:justify-end shrink-0 pt-2 lg:pt-0">
                    <Button
                        variant="outline"
                        size="sm"
                        className="rounded-2xl border-slate-200 dark:border-slate-800 gap-2 font-bold h-11 px-5 shadow-xs hover:bg-slate-50 dark:hover:bg-slate-800"
                        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                    >
                        {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                        Theme
                    </Button>
                    <Button
                        onClick={() => {
                            fetchData();
                            toast.success('Medical records synchronized');
                        }}
                        className="rounded-2xl bg-blue-600 hover:bg-blue-700 gap-2 font-bold h-11 px-5 shadow-lg shadow-blue-500/20 text-white border-none"
                    >
                        <RefreshCw className="w-4 h-4" /> Sync Records
                    </Button>
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full space-y-6 sm:space-y-8">
                <TabsList className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-md p-1.5 rounded-2xl sm:rounded-full border border-slate-200/80 dark:border-slate-800/80 w-full sm:w-auto h-auto grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-2 shadow-xs">
                    <TabsTrigger value="overview" className="rounded-xl sm:rounded-full px-3 sm:px-6 py-2 sm:py-2.5 data-[state=active]:bg-slate-900 data-[state=active]:text-white dark:data-[state=active]:bg-slate-100 dark:data-[state=active]:text-slate-900 font-extrabold text-[11px] sm:text-xs uppercase tracking-wider gap-1.5 shadow-2xs">
                        <LayoutDashboard className="w-3.5 h-3.5" /> Overview
                    </TabsTrigger>
                    <TabsTrigger value="analytics" className="rounded-xl sm:rounded-full px-3 sm:px-6 py-2 sm:py-2.5 data-[state=active]:bg-slate-900 data-[state=active]:text-white dark:data-[state=active]:bg-slate-100 dark:data-[state=active]:text-slate-900 font-extrabold text-[11px] sm:text-xs uppercase tracking-wider gap-1.5 shadow-2xs">
                        <BarChart3 className="w-3.5 h-3.5" /> Analytics
                    </TabsTrigger>
                    <TabsTrigger value="protocols" className="rounded-xl sm:rounded-full px-3 sm:px-6 py-2 sm:py-2.5 data-[state=active]:bg-slate-900 data-[state=active]:text-white dark:data-[state=active]:bg-slate-100 dark:data-[state=active]:text-slate-900 font-extrabold text-[11px] sm:text-xs uppercase tracking-wider gap-1.5 shadow-2xs">
                        <Stethoscope className="w-3.5 h-3.5" /> Protocols
                    </TabsTrigger>
                    <TabsTrigger value="settings" className="rounded-xl sm:rounded-full px-3 sm:px-6 py-2 sm:py-2.5 data-[state=active]:bg-slate-900 data-[state=active]:text-white dark:data-[state=active]:bg-slate-100 dark:data-[state=active]:text-slate-900 font-extrabold text-[11px] sm:text-xs uppercase tracking-wider gap-1.5 shadow-2xs">
                        <Settings className="w-3.5 h-3.5" /> Settings
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-6 focus-visible:outline-none">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <Card className="border-none shadow-sm bg-blue-600 text-white overflow-hidden relative group">
                            <CardContent className="p-8 space-y-2">
                                <Users className="w-10 h-10 opacity-20 absolute -right-2 -top-2 group-hover:scale-150 transition-transform duration-700" />
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">Total Patients Treated</p>
                                <h3 className="text-5xl font-black tracking-tighter">{stats.totalPatients}</h3>
                                <p className="text-xs font-bold bg-white/20 inline-block px-3 py-1 rounded-full">Unique Lifetime</p>
                            </CardContent>
                        </Card>
                        <Card className="border-none shadow-sm bg-purple-500 text-white overflow-hidden relative group">
                            <CardContent className="p-8 space-y-2">
                                <FileSignature className="w-10 h-10 opacity-20 absolute -right-2 -top-2 group-hover:scale-150 transition-transform duration-700" />
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">Saved Protocols</p>
                                <h3 className="text-5xl font-black tracking-tighter">{protocols.length}</h3>
                                <div className="flex items-center gap-2 pt-2">
                                    <span className="text-[10px] font-bold">Fast Prescription Templates</span>
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="border-none shadow-sm bg-white dark:bg-slate-900 overflow-hidden p-6 flex flex-col justify-center gap-4">
                            <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Quick Actions</h4>
                            <div className="grid grid-cols-3 gap-2">
                                {[
                                    { icon: <Plus className="w-5 h-5" />, label: "Entry", color: "bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400", path: slug ? `/${slug}/nurse` : "/nurse" },
                                    { icon: <Stethoscope className="w-5 h-5" />, label: "Queue", color: "bg-purple-50 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400", path: slug ? `/${slug}/consultation` : "/consultation" },
                                    { icon: <Printer className="w-5 h-5" />, label: "Print", color: "bg-emerald-50 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400", path: slug ? `/${slug}/print` : "/print" }
                                ].map(a => (
                                    <button
                                        key={a.label}
                                        onClick={() => navigate(a.path)}
                                        className="flex flex-col items-center gap-1 hover:scale-105 transition-transform"
                                    >
                                        <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center transition-all", a.color)}>
                                            {a.icon}
                                        </div>
                                        <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase">{a.label}</span>
                                    </button>
                                ))}
                            </div>
                        </Card>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-4">
                        {/* Activity Timeline */}
                        <Card className="border-slate-100 dark:border-slate-800 rounded-[2rem] shadow-sm bg-white dark:bg-slate-900 overflow-hidden">
                            <CardHeader className="border-b border-slate-50 dark:border-slate-800 px-8 py-6">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-blue-500" />
                                        <CardTitle className="text-sm font-black uppercase tracking-widest dark:text-slate-100">Clinic Timeline</CardTitle>
                                    </div>
                                    <Activity className="w-4 h-4 text-slate-200 dark:text-slate-800" />
                                </div>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="divide-y divide-slate-50 dark:divide-slate-800">
                                    {stats.recentActivity.map((visit, i) => (
                                        <div key={visit.id} className="p-6 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors flex items-center justify-between group">
                                            <div className="flex items-center gap-4">
                                                <div className="relative">
                                                    <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-black text-slate-400 dark:text-slate-500 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/40 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-all">
                                                        {visit.patients?.name?.charAt(0)}
                                                    </div>
                                                    <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-white dark:bg-slate-900 flex items-center justify-center shadow-sm">
                                                        {visit.status === 'completed' ? <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500" /> : <Clock className="w-2.5 h-2.5 text-amber-500" />}
                                                    </div>
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-900 dark:text-slate-100 leading-tight">{visit.patients?.name}</p>
                                                    <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5">
                                                        {visit.status === 'completed' ? 'Consultation Finished' : 'Waiting in Queue'}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs font-black text-slate-900 dark:text-slate-100">
                                                    {new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: 'numeric' }).format(new Date(visit.created_at))}
                                                </p>
                                                <p className="text-[10px] font-bold text-slate-300 dark:text-slate-600">Just now</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <Button
                                    variant="ghost"
                                    className="w-full h-14 rounded-none text-blue-600 dark:text-blue-400 font-bold text-xs uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-800 border-t border-slate-50 dark:border-slate-800"
                                    onClick={() => handleTabChange('analytics')}
                                >
                                    See All Activity <ArrowRight className="w-4 h-4 ml-2" />
                                </Button>
                            </CardContent>
                        </Card>

                        {/* Mini Analytics */}
                        <Card className="border-border dark:border-slate-800 rounded-[2rem] shadow-sm bg-card overflow-hidden p-8 flex flex-col">
                            <div className="flex items-center justify-between mb-8">
                                <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground">Weekly Performance</h3>
                                <TrendingUp className="w-5 h-5 text-emerald-500" />
                            </div>
                            <div className="h-64 mt-auto">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={stats.weeklyData}>
                                        <defs>
                                            <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis
                                            dataKey="date"
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 800 }}
                                        />
                                        <Tooltip
                                            contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', fontWeight: 'bold' }}
                                        />
                                        <Area type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={4} fillOpacity={1} fill="url(#colorCount)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="analytics" className="space-y-8 focus-visible:outline-none">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <Card className="border-slate-100 dark:border-slate-800 rounded-[2rem] p-4 md:p-8 space-y-8 bg-white dark:bg-slate-900 shadow-sm transition-all duration-300">
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="text-2xl font-black tracking-tight mb-1 dark:text-slate-100">Patient Volume Trend</CardTitle>
                                    <CardDescription className="dark:text-slate-400">Visualizing your clinic flow over the last 7 days.</CardDescription>
                                </div>
                                <div className="bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 p-3 rounded-2xl">
                                    <Activity className="w-6 h-6" />
                                </div>
                            </div>
                            <div className="h-[300px] md:h-[400px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={stats.weeklyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f8fafc" />
                                        <XAxis
                                            dataKey="date"
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fill: '#64748b', fontSize: 12, fontWeight: 700 }}
                                        />
                                        <YAxis
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fill: '#94a3b8', fontSize: 10 }}
                                        />
                                        <Tooltip
                                            cursor={{ fill: '#f1f5f9', radius: 8 }}
                                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}
                                            labelStyle={{ fontWeight: 800 }}
                                        />
                                        <Bar dataKey="count" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={40} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </Card>

                        <Card className="border-slate-100 dark:border-slate-800 rounded-[2rem] p-4 md:p-8 space-y-8 bg-white dark:bg-slate-900 shadow-sm flex flex-col transition-all duration-300">
                            <div>
                                <CardTitle className="text-2xl font-black tracking-tight mb-1 dark:text-slate-100">Demographics</CardTitle>
                                <CardDescription className="dark:text-slate-400">Patient age and gender distribution.</CardDescription>
                            </div>
                            <div className="h-[300px] md:h-[450px] relative flex-1">
                                <ResponsiveContainer width="100%" height="100%">
                                    <RePieChart>
                                        <Pie
                                            data={stats.demographics}
                                            innerRadius="65%"
                                            outerRadius="90%"
                                            paddingAngle={2}
                                            dataKey="value"
                                            stroke="none"
                                        >
                                            {stats.demographics.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                            itemStyle={{ fontWeight: 'bold' }}
                                        />
                                    </RePieChart>
                                </ResponsiveContainer>
                                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                    <p className="text-3xl md:text-5xl font-black dark:text-slate-100 leading-none">{stats.totalPatients}</p>
                                    <p className="text-[8px] md:text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1 text-center">Patients</p>
                                </div>
                            </div>

                            <div className="space-y-3">
                                {stats.demographics.map(d => (
                                    <div key={d.name} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                                        <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-full" style={{ background: d.color }} />
                                            <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{d.name}</span>
                                        </div>
                                        <span className="text-sm font-black text-slate-900 dark:text-white">{stats.totalPatients > 0 ? Math.round((d.value / stats.totalPatients) * 100) : 0}%</span>
                                    </div>
                                ))}
                            </div>
                        </Card>
                    </div>
                </TabsContent>


                <TabsContent value="protocols" className="space-y-6 focus-visible:outline-none">
                    <Card className="border-slate-100 dark:border-slate-800 rounded-[2rem] p-8 bg-white dark:bg-slate-900 shadow-sm">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                            <div>
                                <CardTitle className="text-3xl font-black tracking-tighter mb-1 dark:text-slate-100">Medicine Protocols</CardTitle>
                                <CardDescription className="dark:text-slate-400">Save common medicine combinations as reusable favorites.</CardDescription>
                            </div>
                            <Button
                                onClick={handleAddNewProtocol}
                                className="bg-slate-900 dark:bg-slate-50 dark:text-slate-900 text-white font-black uppercase text-[10px] tracking-widest px-8 rounded-full h-auto py-3 shadow-lg"
                            >
                                <Plus className="w-3.5 h-3.5 mr-2" /> Create New Protocol
                            </Button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {protocols.map((p, i) => (
                                <Card key={p.id} className="group relative border-slate-100 dark:border-slate-800 rounded-3xl hover:border-blue-200 dark:hover:border-blue-700 transition-all hover:shadow-xl hover:-translate-y-1 bg-white dark:bg-slate-800/50 overflow-hidden">
                                    <div className="absolute top-0 left-0 w-full h-1 bg-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    <CardContent className="p-6 space-y-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-blue-50 dark:bg-blue-900/40 rounded-xl">
                                                    <HeartPulse className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                                </div>
                                                <h4 className="font-black text-slate-900 dark:text-slate-100 leading-tight">{p.name}</h4>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    onClick={() => handleEditProtocol(p)}
                                                    className="h-8 w-8 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded-full"
                                                    title="Edit Protocol"
                                                >
                                                    <Pencil className="w-4 h-4" />
                                                </Button>
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    onClick={() => handleDeleteProtocol(p.id)}
                                                    className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-full"
                                                    title="Delete Protocol"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            {p.medicines.slice(0, 3).map((m: any, idx: number) => (
                                                <div key={idx} className="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400">
                                                    <div className="w-1 h-1 rounded-full bg-slate-300" />
                                                    {m.name} {m.dosage && <span className="text-[10px] opacity-60">({m.dosage})</span>}
                                                </div>
                                            ))}
                                            {p.medicines.length > 3 && (
                                                <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest pt-1">
                                                    + {p.medicines.length - 3} more medicines
                                                </p>
                                            )}
                                        </div>
                                    </CardContent>
                                    <div className="border-t border-slate-50 dark:border-slate-700 p-4 flex items-center justify-between text-[11px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                                        <span>Ready to use</span>
                                        <span className="text-blue-500">{p.medicines.length} items</span>
                                    </div>
                                </Card>
                            ))}
                            {protocols.length === 0 && (
                                <div className="col-span-full py-20 text-center space-y-4">
                                    <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto">
                                        <Stethoscope className="w-8 h-8 text-muted-foreground/30" />
                                    </div>
                                    <p className="text-muted-foreground font-bold uppercase tracking-widest text-xs">No protocols saved yet</p>
                                    <Button variant="outline" size="sm" onClick={handleAddNewProtocol} className="rounded-full">Create Your First</Button>
                                </div>
                            )}
                        </div>
                    </Card>
                </TabsContent>

                <TabsContent value="settings" className="focus-visible:outline-none space-y-6">
                    {/* Modern Sub-navigation Pills for Settings */}
                    <div className="flex flex-wrap items-center justify-between gap-3 p-1.5 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200/80 dark:border-slate-700/80">
                        <div className="flex flex-wrap items-center gap-1.5">
                            <button
                                type="button"
                                onClick={() => setSettingsSection('template')}
                                className={cn(
                                    "flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all",
                                    settingsSection === 'template'
                                        ? "bg-white dark:bg-slate-900 text-primary shadow-sm ring-1 ring-slate-200/50 dark:ring-slate-700/50"
                                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-white/50 dark:hover:bg-slate-800/50"
                                )}
                            >
                                <FileText className="w-4 h-4" />
                                <span>Prescription Template</span>
                                <Badge className="ml-1 bg-primary/10 text-primary hover:bg-primary/20 text-[9px] px-1.5 py-0 h-4 border-none">
                                    Branding & Live Preview
                                </Badge>
                            </button>
                            <button
                                type="button"
                                onClick={() => setSettingsSection('identity')}
                                className={cn(
                                    "flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all",
                                    settingsSection === 'identity'
                                        ? "bg-white dark:bg-slate-900 text-primary shadow-sm ring-1 ring-slate-200/50 dark:ring-slate-700/50"
                                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-white/50 dark:hover:bg-slate-800/50"
                                )}
                            >
                                <User className="w-4 h-4" />
                                <span>Doctor & Clinic Profile</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setSettingsSection('appearance')}
                                className={cn(
                                    "flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all",
                                    settingsSection === 'appearance'
                                        ? "bg-white dark:bg-slate-900 text-primary shadow-sm ring-1 ring-slate-200/50 dark:ring-slate-700/50"
                                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-white/50 dark:hover:bg-slate-800/50"
                                )}
                            >
                                <Palette className="w-4 h-4" />
                                <span>Appearance & Themes</span>
                            </button>
                        </div>
                    </div>

                    <form onSubmit={handleUpdateProfile} className="space-y-6">
                        {/* ================= SECTION 1: PRESCRIPTION TEMPLATE & BRANDING ================= */}
                        {settingsSection === 'template' && (
                            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
                                {/* Left Controls Column */}
                                <div className="xl:col-span-7 space-y-6">
                                    <Card className="border-slate-200/80 dark:border-slate-800/80 rounded-[2rem] p-6 sm:p-7 space-y-6 bg-white/80 dark:bg-slate-900/80 shadow-xs backdrop-blur-sm">
                                        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2.5 bg-primary/10 rounded-xl">
                                                    <FileText className="w-5 h-5 text-primary" />
                                                </div>
                                                <div>
                                                    <h3 className="text-xl font-black tracking-tight dark:text-slate-100">Prescription Header & Watermark</h3>
                                                    <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">Configure clinic logo, watermark stamp, header style, and custom tagline</p>
                                                </div>
                                            </div>
                                            {isClinicOwner ? (
                                                <Badge className="bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 text-[9px] uppercase font-black tracking-wider px-2.5 py-0.5 rounded-full">
                                                    Owner Control
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline" className="bg-slate-100 dark:bg-slate-800 border-none text-[9px] uppercase tracking-wider text-slate-500 gap-1 px-2.5 py-0.5 rounded-full">
                                                    <Lock className="w-3 h-3" /> Managed by Owner
                                                </Badge>
                                            )}
                                        </div>

                                        {/* 1. Clinic Logo / Header Branding Section */}
                                        <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center sm:items-start gap-4">
                                            <div className="relative group/clinicphoto shrink-0">
                                                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex items-center justify-center p-1.5">
                                                    {(profile?.clinic_photo || ownerProfile?.clinic_photo) ? (
                                                        <img
                                                            src={profile?.clinic_photo || ownerProfile?.clinic_photo}
                                                            alt="Clinic Logo"
                                                            className="w-full h-full object-contain"
                                                        />
                                                    ) : (
                                                        <Building2 className="w-8 h-8 text-slate-400 dark:text-slate-500" />
                                                    )}
                                                </div>

                                                {isClinicOwner && (
                                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/clinicphoto:opacity-100 transition-opacity rounded-2xl flex items-center justify-center gap-1.5 p-1 backdrop-blur-xs">
                                                        <button
                                                            type="button"
                                                            onClick={() => clinicFileInputRef.current?.click()}
                                                            disabled={clinicUploading}
                                                            className="p-1.5 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-transform hover:scale-110"
                                                            title="Upload Clinic Photo"
                                                        >
                                                            {clinicUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
                                                        </button>
                                                        {profile?.clinic_photo && (
                                                            <button
                                                                type="button"
                                                                onClick={handleDeleteClinicPhoto}
                                                                disabled={clinicUploading}
                                                                className="p-1.5 bg-red-500/50 hover:bg-red-500/70 text-white rounded-lg transition-transform hover:scale-110"
                                                                title="Delete Clinic Photo"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            <input
                                                type="file"
                                                ref={clinicFileInputRef}
                                                onChange={handleClinicPhotoUpload}
                                                className="hidden"
                                                accept="image/*"
                                            />

                                            <div className="space-y-1.5 text-center sm:text-left flex-1 min-w-0">
                                                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                                                    <h4 className="font-extrabold text-sm text-slate-900 dark:text-slate-100">Clinic Logo / Header Branding</h4>
                                                    {(profile?.clinic_photo || ownerProfile?.clinic_photo) && (
                                                        <span className="text-[9px] font-black uppercase tracking-wider text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 dark:text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">Active</span>
                                                    )}
                                                    <span className="text-[10px] font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-md border border-blue-200/80 dark:border-blue-800/80">
                                                        Recommended: 500 × 500 px (1:1) or 600 × 400 px (3:2)
                                                    </span>
                                                </div>
                                                <p className="text-xs text-slate-400 dark:text-slate-500 leading-relaxed">
                                                    {isClinicOwner
                                                        ? "Official clinic logo placed right before your clinic name in all prescriptions, and shown on Waiting Room TV screen. Any size uploaded is automatically scaled and fitted without distortion."
                                                        : "Displayed in the prescription header and Waiting Room TV screen. Managed by Clinic Owner."}
                                                </p>
                                                {isClinicOwner && (
                                                    <div className="pt-2 flex flex-wrap items-center gap-2 justify-center sm:justify-start">
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            disabled={clinicUploading}
                                                            onClick={() => clinicFileInputRef.current?.click()}
                                                            className="rounded-xl h-8 px-3 text-xs font-bold gap-1.5 border-slate-200 dark:border-slate-700 shadow-2xs"
                                                        >
                                                            {clinicUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                                                            {profile?.clinic_photo ? 'Change Logo' : 'Upload Logo'}
                                                        </Button>
                                                        {profile?.clinic_photo && (
                                                            <>
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => setImagePreviewUrl(profile?.clinic_photo || null)}
                                                                    className="rounded-xl h-8 px-2.5 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                                                                >
                                                                    <Eye className="w-3.5 h-3.5 mr-1" /> View
                                                                </Button>
                                                                <Button
                                                                    type="button"
                                                                    variant="outline"
                                                                    size="sm"
                                                                    disabled={clinicUploading}
                                                                    onClick={handleDeleteClinicPhoto}
                                                                    className="rounded-xl h-8 px-2.5 text-xs font-bold gap-1 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 border-red-200 dark:border-red-900/50"
                                                                >
                                                                    <Trash2 className="w-3.5 h-3.5" /> Remove
                                                                </Button>
                                                            </>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* 2. Prescription Watermark Section */}
                                        <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center sm:items-start gap-4">
                                            <div className="relative group/watermark shrink-0">
                                                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex items-center justify-center relative p-2">
                                                    <div className="absolute inset-0 opacity-[0.04] bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:8px_8px]" />
                                                    {(watermarkUrl || ownerProfile?.clinic_watermark) ? (
                                                        <img
                                                            src={watermarkUrl || ownerProfile?.clinic_watermark}
                                                            alt="Prescription Watermark"
                                                            className="w-full h-full object-contain drop-shadow-xs"
                                                        />
                                                    ) : (
                                                        <div className="flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
                                                            <Stamp className="w-8 h-8 opacity-60" />
                                                        </div>
                                                    )}
                                                </div>

                                                {isClinicOwner && (
                                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/watermark:opacity-100 transition-opacity rounded-2xl flex items-center justify-center gap-1.5 p-1 backdrop-blur-xs">
                                                        <button
                                                            type="button"
                                                            onClick={() => watermarkFileInputRef.current?.click()}
                                                            disabled={watermarkUploading}
                                                            className="p-1.5 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-transform hover:scale-110"
                                                            title="Upload Watermark"
                                                        >
                                                            {watermarkUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                                                        </button>
                                                        {(watermarkUrl || ownerProfile?.clinic_watermark) && (
                                                            <button
                                                                type="button"
                                                                onClick={handleDeleteWatermark}
                                                                disabled={watermarkUploading}
                                                                className="p-1.5 bg-red-500/50 hover:bg-red-500/70 text-white rounded-lg transition-transform hover:scale-110"
                                                                title="Delete Watermark"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            <input
                                                type="file"
                                                ref={watermarkFileInputRef}
                                                onChange={handleWatermarkUpload}
                                                className="hidden"
                                                accept="image/png,image/jpeg,image/webp"
                                            />

                                            <div className="space-y-1.5 text-center sm:text-left flex-1 min-w-0">
                                                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                                                    <h4 className="font-extrabold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                                                        <Stamp className="w-4 h-4 text-primary" />
                                                        Prescription Watermark
                                                    </h4>
                                                    {(watermarkUrl || ownerProfile?.clinic_watermark) ? (
                                                        <span className="text-[9px] font-black uppercase tracking-wider text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 dark:text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">Active</span>
                                                    ) : (
                                                        <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">None Set (Clean Sheet)</span>
                                                    )}
                                                    <span className="text-[10px] font-semibold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/60 px-2 py-0.5 rounded-md border border-purple-200/80 dark:border-purple-800/80">
                                                        Recommended: 800 × 800 px • Transparent PNG
                                                    </span>
                                                </div>
                                                <p className="text-xs text-slate-400 dark:text-slate-500 leading-relaxed">
                                                    {isClinicOwner
                                                        ? "Subtly watermarked in the center of all prescription pages for this clinic. Transparent PNG strongly recommended. If none is set, prescription sheets remain clean without background text."
                                                        : "Watermark applied to all prescriptions in this clinic. Managed by Clinic Owner."}
                                                </p>
                                                {isClinicOwner && (
                                                    <div className="pt-2 flex flex-wrap items-center gap-2 justify-center sm:justify-start">
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            disabled={watermarkUploading}
                                                            onClick={() => watermarkFileInputRef.current?.click()}
                                                            className="rounded-xl h-8 px-3 text-xs font-bold gap-1.5 border-slate-200 dark:border-slate-700 shadow-2xs"
                                                        >
                                                            {watermarkUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                                                            {(watermarkUrl || ownerProfile?.clinic_watermark) ? 'Change Watermark' : 'Upload Watermark'}
                                                        </Button>
                                                        {(watermarkUrl || ownerProfile?.clinic_watermark) && (
                                                            <>
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => setImagePreviewUrl(watermarkUrl || ownerProfile?.clinic_watermark || null)}
                                                                    className="rounded-xl h-8 px-2.5 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                                                                >
                                                                    <Eye className="w-3.5 h-3.5 mr-1" /> View
                                                                </Button>
                                                                <Button
                                                                    type="button"
                                                                    variant="outline"
                                                                    size="sm"
                                                                    disabled={watermarkUploading}
                                                                    onClick={handleDeleteWatermark}
                                                                    className="rounded-xl h-8 px-2.5 text-xs font-bold gap-1 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 border-red-200 dark:border-red-900/50"
                                                                >
                                                                    <Trash2 className="w-3.5 h-3.5" /> Remove
                                                                </Button>
                                                            </>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* 3. Prescription Header Display Mode Selector */}
                                        <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-3">
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                                                <div>
                                                    <h4 className="font-extrabold text-sm text-slate-900 dark:text-slate-100">Prescription Header Style</h4>
                                                    <p className="text-xs text-slate-400 dark:text-slate-500">Clinic Name is always displayed. Choose whether to show the clinic logo alongside it.</p>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                                                {[
                                                    {
                                                        id: 'both',
                                                        label: 'Logo & Clinic Name (Standard)',
                                                        desc: 'Dedicated logo slot placed right before your clinic name',
                                                        icon: Sliders
                                                    },
                                                    {
                                                        id: 'name',
                                                        label: 'Clinic Name Only',
                                                        desc: 'Displays clinic name typography without header logo',
                                                        icon: Building2
                                                    }
                                                ].map((opt) => {
                                                    const isSelected = ((headerMode || 'both') === opt.id) || (opt.id === 'both' && headerMode === 'logo');
                                                    return (
                                                        <button
                                                            key={opt.id}
                                                            type="button"
                                                            disabled={!isClinicOwner}
                                                            onClick={() => handleHeaderModeChange(opt.id as any)}
                                                            className={cn(
                                                                "relative p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between gap-1.5",
                                                                isSelected
                                                                    ? "bg-white dark:bg-slate-800 border-primary ring-2 ring-primary/20 shadow-xs"
                                                                    : "bg-white/60 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700/80 hover:border-slate-300 dark:hover:border-slate-600",
                                                                !isClinicOwner && "cursor-not-allowed opacity-80"
                                                            )}
                                                        >
                                                            <div className="flex items-center justify-between w-full">
                                                                <div className="flex items-center gap-2">
                                                                    <opt.icon className={cn("w-4 h-4", isSelected ? "text-primary font-bold" : "text-slate-400")} />
                                                                    <span className={cn("text-xs font-bold", isSelected ? "text-slate-900 dark:text-slate-100" : "text-slate-600 dark:text-slate-400")}>
                                                                        {opt.label}
                                                                    </span>
                                                                </div>
                                                                {isSelected && (
                                                                    <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                                                                )}
                                                            </div>
                                                            <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-snug">
                                                                {opt.desc}
                                                            </p>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {/* 4. Custom Clinic Header Tagline / Caption Input */}
                                        <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-3">
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                                                <div>
                                                    <h4 className="font-extrabold text-sm text-slate-900 dark:text-slate-100">Prescription Header Caption / Tagline</h4>
                                                    <p className="text-xs text-slate-400 dark:text-slate-500">Custom clinic services or sub-title displayed under your clinic name (e.g. 24/7 Emergency · ECG · Lab)</p>
                                                </div>
                                            </div>

                                            <div className="space-y-3 pt-1">
                                                <div className="flex flex-col sm:flex-row gap-2">
                                                    <Input
                                                        value={clinicCaption}
                                                        onChange={(e) => handleCaptionChange(e.target.value)}
                                                        disabled={!isClinicOwner}
                                                        placeholder="e.g. 24/7 Emergency · ECG · Lab (or leave empty)"
                                                        className="h-10 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl px-4 font-bold text-xs"
                                                    />
                                                    {isClinicOwner && (
                                                        <Button
                                                            type="button"
                                                            onClick={() => handleSaveCaption()}
                                                            className="h-10 px-4 text-xs font-black rounded-xl bg-primary hover:bg-primary/90 text-white shrink-0"
                                                        >
                                                            Save Tagline
                                                        </Button>
                                                    )}
                                                </div>

                                                {/* Preset choices */}
                                                {isClinicOwner && (
                                                    <div className="space-y-1.5">
                                                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Quick Presets:</span>
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {[
                                                                '24/7 Emergency · ECG · Lab',
                                                                'Multi-Speciality Clinic & Diagnostic Centre',
                                                                'General & Family Medicine',
                                                                'Consultant Physician & Diabetologist',
                                                            ].map((preset) => (
                                                                <button
                                                                    key={preset}
                                                                    type="button"
                                                                    onClick={() => {
                                                                        handleCaptionChange(preset);
                                                                        handleSaveCaption(preset);
                                                                    }}
                                                                    className={cn(
                                                                        "text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-all",
                                                                        clinicCaption === preset
                                                                            ? "bg-primary/10 border-primary/30 text-primary"
                                                                            : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-primary/40"
                                                                    )}
                                                                >
                                                                    {preset}
                                                                </button>
                                                            ))}
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    handleCaptionChange('');
                                                                    handleSaveCaption('');
                                                                }}
                                                                className={cn(
                                                                    "text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-all text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 border-red-200 dark:border-red-900/50",
                                                                    clinicCaption === '' ? "bg-red-50 dark:bg-red-950/40" : "bg-white dark:bg-slate-800"
                                                                )}
                                                            >
                                                                Clear (Hide from Header)
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </Card>
                                </div>

                                {/* Right Live Preview Column */}
                                <div className="xl:col-span-5 sticky top-6 space-y-4">
                                    <Card className="border-slate-200/80 dark:border-slate-800/80 rounded-[2rem] p-5 sm:p-6 bg-white dark:bg-slate-900 shadow-lg space-y-4">
                                        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                                            <div className="flex items-center gap-2">
                                                <div className="p-1.5 bg-blue-500/10 text-blue-600 rounded-lg">
                                                    <Eye className="w-4 h-4" />
                                                </div>
                                                <h4 className="text-sm font-black text-slate-900 dark:text-slate-100">Live Prescription Preview</h4>
                                            </div>
                                            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full">
                                                Real-time
                                            </span>
                                        </div>

                                        {/* A4 Sheet Simulation */}
                                        <div className="relative bg-white text-slate-900 rounded-xl border border-slate-200 shadow-sm p-4 sm:p-5 overflow-hidden select-none min-h-[360px] flex flex-col justify-between">
                                            {/* Watermark in background */}
                                            {(watermarkUrl || ownerProfile?.clinic_watermark) ? (
                                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none p-8 z-0">
                                                    <img
                                                        src={watermarkUrl || ownerProfile?.clinic_watermark}
                                                        alt="Watermark"
                                                        className="max-w-[180px] max-h-[180px] object-contain opacity-15 filter grayscale contrast-125 select-none"
                                                    />
                                                </div>
                                            ) : (
                                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
                                                    <span className="text-[11px] font-black uppercase tracking-widest text-slate-200 dark:text-slate-200/40">Clean Sheet (No Watermark)</span>
                                                </div>
                                            )}

                                            {/* Prescription Header Content */}
                                            <div className="relative z-10 space-y-3 pb-3 border-b-2 border-slate-900">
                                                <div className="flex items-start justify-between gap-3">
                                                    {/* Left: Doctor Credentials */}
                                                    <div className="space-y-0.5 max-w-[50%]">
                                                        <h5 className="font-black text-sm text-slate-900 uppercase tracking-tight">
                                                            {profile?.full_name ? `Dr. ${profile.full_name}` : 'Doctor Name'}
                                                        </h5>
                                                        <p className="text-[10px] font-bold text-slate-600 leading-tight">
                                                            {profile?.qualifications || 'MBBS, MD'}
                                                        </p>
                                                        <p className="text-[9px] font-semibold text-slate-500">
                                                            Reg No: {profile?.registration_id || '152590'}
                                                        </p>
                                                    </div>

                                                    {/* Right: Clinic Branding & Info */}
                                                    <div className="text-right flex flex-col items-end max-w-[50%]">
                                                        <div className="flex items-center gap-2 justify-end mb-0.5">
                                                            {headerMode !== 'name' && (profile?.clinic_photo || ownerProfile?.clinic_photo) && (
                                                                <img
                                                                    src={profile?.clinic_photo || ownerProfile?.clinic_photo}
                                                                    alt="Logo"
                                                                    className="w-7 h-7 sm:w-8 sm:h-8 object-contain rounded-md border border-slate-200 bg-white shrink-0 p-0.5"
                                                                />
                                                            )}
                                                            <span className="font-black text-sm text-slate-900 uppercase tracking-tight leading-tight">
                                                                {(isClinicOwner ? profile?.clinic_name : ownerProfile?.clinic_name) || clinic?.name || 'Clinic Name'}
                                                            </span>
                                                        </div>
                                                        {clinicCaption && (
                                                            <span className="text-[8px] font-black uppercase tracking-wider text-primary bg-primary/10 px-1.5 py-0.2 rounded mb-0.5">
                                                                {clinicCaption}
                                                            </span>
                                                        )}
                                                        <p className="text-[9px] font-medium text-slate-600 leading-tight">
                                                            {(isClinicOwner ? profile?.clinic_address : ownerProfile?.clinic_address) || clinic?.address || 'Clinic Address'}
                                                        </p>
                                                        <p className="text-[9px] font-bold text-slate-700">
                                                            Ph: {(isClinicOwner ? profile?.clinic_phone : ownerProfile?.clinic_phone) || clinic?.phone || '+91 00000 00000'}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Patient Mock Details Bar */}
                                            <div className="relative z-10 py-2 border-b border-dashed border-slate-300 text-[9px] grid grid-cols-4 gap-1 text-slate-600 font-medium">
                                                <div><span className="font-bold text-slate-800">Pt:</span> Sample Patient</div>
                                                <div><span className="font-bold text-slate-800">Age/Sex:</span> 34Y / Male</div>
                                                <div><span className="font-bold text-slate-800">Date:</span> {format(new Date(), 'dd/MM/yyyy')}</div>
                                                <div className="text-right"><span className="font-bold text-slate-800">Rx ID:</span> #PR-1082</div>
                                            </div>

                                            {/* Rx Symbol Mock Area */}
                                            <div className="relative z-10 my-4 space-y-2 flex-1">
                                                <span className="font-serif italic font-black text-xl text-slate-800">℞</span>
                                                <div className="space-y-1.5 opacity-30">
                                                    <div className="h-2 bg-slate-400 rounded w-3/4" />
                                                    <div className="h-2 bg-slate-300 rounded w-1/2" />
                                                    <div className="h-2 bg-slate-200 rounded w-2/3" />
                                                </div>
                                            </div>

                                            {/* Bottom signature preview in mock */}
                                            <div className="relative z-10 pt-2 border-t border-slate-200 flex items-end justify-between text-[9px]">
                                                <span className="text-[8px] text-slate-400 font-mono">Generated via Prescripto</span>
                                                <div className="text-right flex flex-col items-center">
                                                    {profile?.signature_data ? (
                                                        <img src={profile.signature_data} alt="Signature" className="max-h-8 mb-0.5 contrast-125" />
                                                    ) : (
                                                        <div className="h-6 w-20 border-b border-dashed border-slate-400 mb-0.5" />
                                                    )}
                                                    <span className="font-bold text-slate-700">Doctor Signature</span>
                                                </div>
                                            </div>
                                        </div>
                                    </Card>
                                </div>
                            </div>
                        )}

                        {/* ================= SECTION 3: APP APPEARANCE & THEMES ================= */}
                        {settingsSection === 'appearance' && (
                            <Card className="border-slate-100 dark:border-slate-800 rounded-2xl p-6 space-y-6 bg-white dark:bg-slate-900 shadow-sm transition-all">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 bg-primary/10 rounded-xl">
                                        <Palette className="w-5 h-5 text-primary" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">App Appearance & Colors</h3>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">Personalize display theme and accent color</p>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Theme Mode */}
                                <div className="space-y-2.5">
                                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Interface Display Mode</Label>
                                    <div className="grid grid-cols-3 gap-2 p-1.5 bg-slate-100 dark:bg-slate-800/60 rounded-2xl border border-slate-200/60 dark:border-slate-700/60">
                                        {[
                                            { id: 'light', label: 'Light', icon: <Sun className="w-4 h-4" /> },
                                            { id: 'dark', label: 'Dark', icon: <Moon className="w-4 h-4" /> },
                                            { id: 'system', label: 'Auto', icon: <Sparkles className="w-4 h-4" /> }
                                        ].map(t => (
                                            <button
                                                key={t.id}
                                                type="button"
                                                onClick={() => setTheme(t.id as any)}
                                                className={cn(
                                                    "flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-bold text-xs transition-all active:scale-95",
                                                    theme === t.id
                                                        ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                                                        : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                                                )}
                                            >
                                                {t.icon}
                                                <span>{t.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Color Swatches & RGB Picker */}
                                <div className="space-y-2.5">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Theme Color</Label>
                                        <span className="text-xs font-bold text-primary capitalize flex items-center gap-1.5">
                                            {accent === 'custom' ? (
                                                <>
                                                    <span className="w-2.5 h-2.5 rounded-full inline-block shadow-xs" style={{ backgroundColor: customColor }} />
                                                    <span>RGB {customColor}</span>
                                                </>
                                            ) : (
                                                ACCENT_OPTIONS.find(a => a.id === accent)?.name
                                            )}
                                        </span>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2.5 p-2 bg-slate-100 dark:bg-slate-800/60 rounded-2xl border border-slate-200/60 dark:border-slate-700/60">
                                        {ACCENT_OPTIONS.map((opt) => {
                                            const isSelected = accent === opt.id;
                                            return (
                                                <button
                                                    key={opt.id}
                                                    type="button"
                                                    onClick={() => setAccent(opt.id)}
                                                    className={cn(
                                                        "relative group/swatch flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200 active:scale-90",
                                                        isSelected ? "ring-2 ring-offset-2 ring-primary dark:ring-offset-slate-900 scale-105 shadow-md" : "hover:scale-105 opacity-85 hover:opacity-100"
                                                    )}
                                                    style={{
                                                        backgroundColor: opt.color,
                                                        boxShadow: isSelected ? `0 6px 16px ${opt.glow}` : undefined
                                                    }}
                                                    title={opt.name}
                                                >
                                                    {isSelected && (
                                                        <Check className="w-4 h-4 text-white stroke-[3] drop-shadow-sm" />
                                                    )}
                                                    <span className="sr-only">{opt.name}</span>
                                                </button>
                                            );
                                        })}

                                        {/* Divider */}
                                        <div className="h-6 w-[1px] bg-slate-300 dark:bg-slate-700 mx-0.5" />

                                        {/* Custom RGB Color Picker Popover */}
                                        <Popover open={colorPickerOpen} onOpenChange={setColorPickerOpen}>
                                            <PopoverTrigger asChild>
                                                <button
                                                    type="button"
                                                    className={cn(
                                                        "relative flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200 active:scale-90",
                                                        accent === 'custom'
                                                            ? "ring-2 ring-offset-2 ring-primary dark:ring-offset-slate-900 scale-105 shadow-md"
                                                            : "hover:scale-105 opacity-85 hover:opacity-100"
                                                    )}
                                                    style={{
                                                        backgroundColor: accent === 'custom' ? customColor : undefined,
                                                        background: accent !== 'custom' ? 'conic-gradient(from 180deg at 50% 50%, #f43f5e 0deg, #f59e0b 60deg, #10b981 120deg, #06b6d4 180deg, #3b82f6 240deg, #8b5cf6 300deg, #f43f5e 360deg)' : undefined,
                                                        boxShadow: accent === 'custom' ? `0 6px 16px ${customColor}55` : undefined
                                                    }}
                                                    title="Custom RGB Color Picker"
                                                >
                                                    {accent === 'custom' ? (
                                                        <Check className="w-4 h-4 text-white stroke-[3] drop-shadow-sm" />
                                                    ) : (
                                                        <Pipette className="w-4 h-4 text-white drop-shadow-sm" />
                                                    )}
                                                </button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-80 p-4 rounded-2xl shadow-2xl border-slate-200 dark:border-slate-800" align="end">
                                                <div className="space-y-4">
                                                    <div className="flex items-center justify-between pb-2 border-b border-border/60">
                                                        <div className="flex items-center gap-2">
                                                            <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                                                                <Pipette className="w-3.5 h-3.5" />
                                                            </div>
                                                            <h4 className="text-xs font-black uppercase tracking-wider text-foreground">Custom RGB Picker</h4>
                                                        </div>
                                                        <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-primary/10 text-primary font-mono">
                                                            {hexInput}
                                                        </span>
                                                    </div>

                                                    {/* Color preview & native eye-dropper / wheel */}
                                                    <div className="flex items-center gap-3">
                                                        <div
                                                            className="w-14 h-14 rounded-2xl border-2 border-white dark:border-slate-800 shadow-md shrink-0 flex items-center justify-center transition-all"
                                                            style={{ backgroundColor: customColor }}
                                                        >
                                                            <Sparkles className="w-5 h-5 text-white drop-shadow-md" />
                                                        </div>
                                                        <div className="flex-1 space-y-1">
                                                            <Label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Pick from Wheel</Label>
                                                            <div className="relative">
                                                                <input
                                                                    type="color"
                                                                    value={customColor}
                                                                    onChange={(e) => {
                                                                        const val = e.target.value.toUpperCase();
                                                                        setCustomColor(val);
                                                                        setHexInput(val);
                                                                        setRgbVals(hexToRgb(val));
                                                                    }}
                                                                    className="w-full h-8 rounded-xl cursor-pointer border border-border/80 p-0.5 bg-background shadow-2xs"
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* HEX Input */}
                                                    <div className="space-y-1">
                                                        <Label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Hex Color Code</Label>
                                                        <Input
                                                            value={hexInput}
                                                            onChange={(e) => handleHexChange(e.target.value)}
                                                            placeholder="#2563EB"
                                                            maxLength={7}
                                                            className="h-8 text-xs font-mono font-bold rounded-xl uppercase"
                                                        />
                                                    </div>

                                                    {/* RGB Sliders */}
                                                    <div className="space-y-2.5 pt-1 border-t border-border/50">
                                                        <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">RGB Color Channels</p>
                                                        
                                                        {/* R Channel */}
                                                        <div className="flex items-center gap-2.5">
                                                            <span className="w-4 text-xs font-black text-rose-500">R</span>
                                                            <input
                                                                type="range"
                                                                min="0"
                                                                max="255"
                                                                value={rgbVals.r}
                                                                onChange={(e) => handleRgbChange('r', parseInt(e.target.value))}
                                                                className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-rose-500"
                                                            />
                                                            <span className="w-8 text-right text-xs font-mono font-bold text-foreground tabular-nums">
                                                                {rgbVals.r}
                                                            </span>
                                                        </div>

                                                        {/* G Channel */}
                                                        <div className="flex items-center gap-2.5">
                                                            <span className="w-4 text-xs font-black text-emerald-500">G</span>
                                                            <input
                                                                type="range"
                                                                min="0"
                                                                max="255"
                                                                value={rgbVals.g}
                                                                onChange={(e) => handleRgbChange('g', parseInt(e.target.value))}
                                                                className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                                                            />
                                                            <span className="w-8 text-right text-xs font-mono font-bold text-foreground tabular-nums">
                                                                {rgbVals.g}
                                                            </span>
                                                        </div>

                                                        {/* B Channel */}
                                                        <div className="flex items-center gap-2.5">
                                                            <span className="w-4 text-xs font-black text-blue-500">B</span>
                                                            <input
                                                                type="range"
                                                                min="0"
                                                                max="255"
                                                                value={rgbVals.b}
                                                                onChange={(e) => handleRgbChange('b', parseInt(e.target.value))}
                                                                className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                                            />
                                                            <span className="w-8 text-right text-xs font-mono font-bold text-foreground tabular-nums">
                                                                {rgbVals.b}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {/* Quick Curated Palettes */}
                                                    <div className="pt-2 border-t border-border/50">
                                                        <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-1.5">Vivid Tones</p>
                                                        <div className="grid grid-cols-6 gap-1.5">
                                                            {['#6366F1', '#EC4899', '#14B8A6', '#F97316', '#84CC16', '#A855F7'].map((c) => (
                                                                <button
                                                                    key={c}
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setCustomColor(c);
                                                                        setHexInput(c);
                                                                        setRgbVals(hexToRgb(c));
                                                                    }}
                                                                    className="h-6 rounded-lg transition-transform hover:scale-110 active:scale-95 border border-white/20 shadow-xs"
                                                                    style={{ backgroundColor: c }}
                                                                    title={c}
                                                                />
                                                            ))}
                                                        </div>
                                                    </div>

                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        onClick={() => {
                                                            setCustomColor(hexInput);
                                                            setColorPickerOpen(false);
                                                            toast.success(`Custom theme color applied: ${hexInput}`);
                                                        }}
                                                        className="w-full h-8 text-xs font-extrabold rounded-xl bg-primary text-white shadow-sm"
                                                    >
                                                        Apply Color
                                                    </Button>
                                                </div>
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                </div>
                            </div>
                        </Card>
                        )}

                        {/* ================= SECTION 2: DOCTOR & CLINIC PROFILE ================= */}
                        {settingsSection === 'identity' && (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 items-start">
                                {/* Left Column: Doctor Identity & Digital Signature */}
                                <div className="space-y-6">
                                    {/* Professional Identity Card */}
                                    <Card className="border-slate-200/80 dark:border-slate-800/80 rounded-[2rem] p-6 sm:p-8 space-y-6 bg-white/80 dark:bg-slate-900/80 shadow-xs backdrop-blur-sm">
                                        <div className="flex items-center gap-3 pb-2 border-b border-slate-100 dark:border-slate-800">
                                            <div className="p-2.5 bg-primary/10 rounded-xl">
                                                <User className="w-5 h-5 text-primary" />
                                            </div>
                                            <div>
                                                <h3 className="text-xl font-black tracking-tight dark:text-slate-100">Professional Identity</h3>
                                                <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">Doctor credentials shown on Prescriptions & Reports</p>
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            <div className="space-y-1.5">
                                                <Label className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Display Name</Label>
                                                <Input
                                                    value={profile?.full_name}
                                                    onChange={e => setProfile(p => ({ ...p!, full_name: e.target.value }))}
                                                    className="h-11 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 rounded-xl px-4 font-bold focus:ring-primary text-sm"
                                                />
                                            </div>

                                            <div className="space-y-4">
                                                <div className="space-y-1.5">
                                                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Primary Qualifications</Label>
                                                    <Input
                                                        value={profile?.qualifications}
                                                        onChange={e => setProfile(p => ({ ...p!, qualifications: e.target.value }))}
                                                        placeholder="e.g. MBBS, MD (Cardiology), CCEBDM"
                                                        className="h-11 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 rounded-xl px-4 font-bold text-sm"
                                                    />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Medical Registration ID</Label>
                                                    <Input
                                                        value={profile?.registration_id}
                                                        onChange={e => setProfile(p => ({ ...p!, registration_id: e.target.value }))}
                                                        placeholder="e.g. 152590"
                                                        className="h-11 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 rounded-xl px-4 font-bold text-sm"
                                                    />
                                                </div>
                                            </div>

                                            <div className="space-y-2 pt-2">
                                                <Label className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Select Passport Vector Avatar</Label>
                                                <div className="grid grid-cols-4 gap-2.5 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                                                    {AVATAR_OPTIONS.map((opt) => (
                                                        <button
                                                            key={opt.url}
                                                            type="button"
                                                            onClick={() => setProfile(p => ({ ...p!, avatar_url: opt.url }))}
                                                            className={cn(
                                                                "relative aspect-square rounded-xl overflow-hidden border-2 transition-all hover:scale-105 bg-white dark:bg-slate-800 shadow-xs",
                                                                profile?.avatar_url === opt.url ? "border-primary ring-2 ring-primary/30 scale-105" : "border-slate-200 dark:border-slate-700 opacity-75 hover:opacity-100"
                                                            )}
                                                            title={opt.name}
                                                        >
                                                            <img src={opt.url} className="w-full h-full object-cover" alt={opt.name} />
                                                            {profile?.avatar_url === opt.url && (
                                                                <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                                                                    <CheckCircle2 className="w-5 h-5 text-primary drop-shadow-sm" />
                                                                </div>
                                                            )}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </Card>

                                    {/* Digital Signature Card */}
                                    <Card className="border-slate-200/80 dark:border-slate-800/80 rounded-[2rem] p-6 sm:p-8 space-y-6 bg-white/80 dark:bg-slate-900/80 shadow-xs backdrop-blur-sm">
                                        <div className="flex items-center gap-3 pb-2 border-b border-slate-100 dark:border-slate-800">
                                            <div className="p-2.5 bg-amber-50 dark:bg-amber-900/40 rounded-xl">
                                                <FileSignature className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                                            </div>
                                            <div>
                                                <h3 className="text-xl font-black tracking-tight dark:text-slate-100">Digital Signature</h3>
                                                <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">Used for validating digital prescriptions</p>
                                            </div>
                                        </div>
                                        <div className="space-y-4">
                                            <SignaturePad
                                                initialSignature={profile?.signature_data}
                                                onSave={(data) => setProfile(p => ({ ...p!, signature_data: data }))}
                                            />
                                            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border-2 border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center min-h-[120px]">
                                                {profile?.signature_data ? (
                                                    <div className="space-y-2 text-center w-full">
                                                        <div className="relative group/sig mx-auto w-fit">
                                                            <img src={profile.signature_data} className="max-h-16 mx-auto contrast-125 dark:invert" alt="Preview" />
                                                            <div className="absolute -top-2 -right-2 opacity-0 group-hover/sig:opacity-100 transition-opacity">
                                                                <Button
                                                                    variant="destructive"
                                                                    size="icon"
                                                                    onClick={(e) => {
                                                                        e.preventDefault();
                                                                        setProfile(p => ({ ...p!, signature_data: undefined }));
                                                                    }}
                                                                    className="h-7 w-7 rounded-full shadow-lg"
                                                                    title="Delete Signature"
                                                                >
                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                </Button>
                                                            </div>
                                                        </div>
                                                        <div className="flex flex-col items-center gap-0.5">
                                                            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Live Signature Active</p>
                                                            <button
                                                                type="button"
                                                                onClick={() => setProfile(p => ({ ...p!, signature_data: undefined }))}
                                                                className="text-[9px] font-bold text-red-500 hover:underline uppercase tracking-tighter"
                                                            >
                                                                Clear ❌
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="text-center space-y-1.5 opacity-30">
                                                        <FileSignature className="w-8 h-8 mx-auto" />
                                                        <p className="text-xs font-black uppercase tracking-widest">No signature saved</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </Card>
                                </div>

                                {/* Right Column: Clinic Information Card */}
                                <div className="space-y-6">
                                    <Card className="border-slate-200/80 dark:border-slate-800/80 rounded-[2rem] p-6 sm:p-8 space-y-6 bg-white/80 dark:bg-slate-900/80 shadow-xs backdrop-blur-sm">
                                        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2.5 bg-emerald-50 dark:bg-emerald-900/40 rounded-xl">
                                                    <Building2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                                                </div>
                                                <div>
                                                    <h3 className="text-xl font-black tracking-tight dark:text-slate-100">Clinic Information</h3>
                                                    <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">Registered clinic contact & location details</p>
                                                </div>
                                            </div>
                                            {isClinicOwner ? (
                                                <Badge className="bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 text-[9px] uppercase font-black tracking-wider px-2.5 py-0.5 rounded-full">
                                                    Owner Control
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline" className="bg-slate-100 dark:bg-slate-800 border-none text-[9px] uppercase tracking-wider text-slate-500 gap-1 px-2.5 py-0.5 rounded-full">
                                                    <Lock className="w-3 h-3" /> Managed by Owner
                                                </Badge>
                                            )}
                                        </div>

                                        <div className="space-y-4">
                                            {!isClinicOwner && (
                                                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center gap-2.5 text-xs font-bold text-amber-700 dark:text-amber-400">
                                                    <Lock className="w-4 h-4 shrink-0 text-amber-500" />
                                                    <span>Clinic details can only be modified by the registered Clinic Owner.</span>
                                                </div>
                                            )}
                                            <div className="space-y-1.5">
                                                <div className="flex items-center justify-between">
                                                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Clinic Name</Label>
                                                    {!isClinicOwner && <Lock className="w-3 h-3 text-slate-400" />}
                                                </div>
                                                <Input
                                                    value={(isClinicOwner ? profile?.clinic_name : ownerProfile?.clinic_name) || ''}
                                                    onChange={isClinicOwner ? e => setProfile(p => ({ ...p!, clinic_name: e.target.value })) : undefined}
                                                    placeholder="e.g. GV Clinic"
                                                    className={cn(
                                                        "h-11 border-slate-200 dark:border-slate-800 rounded-xl px-4 font-bold text-sm",
                                                        isClinicOwner ? "bg-white dark:bg-slate-800" : "bg-slate-100/70 dark:bg-slate-800/40 text-slate-500 cursor-not-allowed select-none"
                                                    )}
                                                    readOnly={!isClinicOwner}
                                                    disabled={!isClinicOwner}
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <div className="flex items-center justify-between">
                                                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Contact Number</Label>
                                                    {!isClinicOwner && <Lock className="w-3 h-3 text-slate-400" />}
                                                </div>
                                                <Input
                                                    value={(isClinicOwner ? profile?.clinic_phone : ownerProfile?.clinic_phone) || ''}
                                                    onChange={isClinicOwner ? e => setProfile(p => ({ ...p!, clinic_phone: e.target.value })) : undefined}
                                                    placeholder="+91 00000 00000"
                                                    className={cn(
                                                        "h-11 border-slate-200 dark:border-slate-800 rounded-xl px-4 font-bold text-sm",
                                                        isClinicOwner ? "bg-white dark:bg-slate-800" : "bg-slate-100/70 dark:bg-slate-800/40 text-slate-500 cursor-not-allowed select-none"
                                                    )}
                                                    readOnly={!isClinicOwner}
                                                    disabled={!isClinicOwner}
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <div className="flex items-center justify-between">
                                                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Full Address</Label>
                                                    {!isClinicOwner && <Lock className="w-3 h-3 text-slate-400" />}
                                                </div>
                                                <Input
                                                    value={(isClinicOwner ? profile?.clinic_address : ownerProfile?.clinic_address) || ''}
                                                    onChange={isClinicOwner ? e => setProfile(p => ({ ...p!, clinic_address: e.target.value })) : undefined}
                                                    placeholder="Complete street address with pincode"
                                                    className={cn(
                                                        "h-11 border-slate-200 dark:border-slate-800 rounded-xl px-4 font-bold text-sm",
                                                        isClinicOwner ? "bg-white dark:bg-slate-800" : "bg-slate-100/70 dark:bg-slate-800/40 text-slate-500 cursor-not-allowed select-none"
                                                    )}
                                                    readOnly={!isClinicOwner}
                                                    disabled={!isClinicOwner}
                                                />
                                            </div>
                                        </div>

                                        <div className="p-4 rounded-2xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 flex items-start gap-3">
                                            <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                                            <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed font-medium">
                                                Prescription logo, watermark, header style, and tagline are managed under the <button type="button" onClick={() => setSettingsSection('template')} className="font-bold underline hover:text-blue-900 dark:hover:text-white">Prescription Template</button> tab.
                                            </p>
                                        </div>
                                    </Card>
                                </div>
                            </div>
                        )}

                        <div className="flex items-center justify-end pt-4">
                            <Button
                                type="submit"
                                disabled={saving}
                                className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-white font-extrabold text-xs uppercase tracking-wider px-8 sm:px-12 h-12 sm:h-14 rounded-2xl shadow-xl shadow-primary/20 transition-all active:scale-95"
                            >
                                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                                Save Complete Profile
                            </Button>
                        </div>
                    </form>
                </TabsContent>
            </Tabs>

            {/* Add Protocol Dialog */}
            <Dialog open={showAddProtocolDialog} onOpenChange={setShowAddProtocolDialog}>
                <DialogContent className="max-w-4xl w-[95vw] p-0 overflow-hidden border-none bg-slate-50 dark:bg-slate-900 rounded-[2.5rem] shadow-2xl">
                    <DialogHeader className="p-8 bg-white dark:bg-slate-800 border-b dark:border-slate-700">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-blue-50 dark:bg-blue-900/40 rounded-2xl">
                                <Plus className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                                <DialogTitle className="text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100">
                                    {editingProtocolId ? 'Edit Medicine Protocol' : 'Create Medicine Protocol'}
                                </DialogTitle>
                                <DialogDescription className="font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest text-[10px] mt-1">Design a reusable set of medicines for common consults</DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>

                    <div className="p-8 space-y-8 max-h-[60vh] overflow-y-auto">
                        <div className="space-y-3">
                            <Label className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 ml-1">Protocol Name</Label>
                            <Input
                                placeholder="e.g. Standard Viral Fever, Post-Op Care"
                                value={newProtocolName}
                                onChange={e => setNewProtocolName(e.target.value)}
                                className="h-14 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-2xl font-black text-lg shadow-sm focus:ring-blue-500"
                            />
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between ml-1">
                                <Label className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Medicines in Protocol</Label>
                            </div>

                            <div className="space-y-4">
                                {newProtocolMedicines.map((m, idx) => (
                                    <div key={idx} className="p-5 bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-100 dark:border-slate-700 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300 relative group/row">
                                        <div className="space-y-4">
                                            {/* Row 1: Type + Name + Trash */}
                                            <div className="grid grid-cols-12 gap-3 items-end">
                                                <div className="col-span-12 md:col-span-2 space-y-1.5">
                                                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 ml-1">Type</Label>
                                                    <select
                                                        value={m.type || 'Tab.'}
                                                        onChange={e => {
                                                            const updated = [...newProtocolMedicines];
                                                            updated[idx].type = e.target.value;
                                                            setNewProtocolMedicines(updated);
                                                        }}
                                                        className="w-full h-11 rounded-xl bg-slate-50 dark:bg-slate-900 border-none font-bold text-xs px-3 focus:ring-2 focus:ring-blue-500 appearance-none shadow-sm cursor-pointer"
                                                    >
                                                        {['Tab.', 'Syr.', 'Inj.', 'Cap.', 'Sac.', 'Oin.', 'cr.', 'drops.', 'Lot.', 'Susp.', 'Pdr.'].map(t => (
                                                            <option key={t} value={t}>{t}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div className="col-span-12 md:col-span-9 space-y-1.5">
                                                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 ml-1">Medicine Name</Label>
                                                    <Input
                                                        value={m.name}
                                                        onChange={e => {
                                                            const updated = [...newProtocolMedicines];
                                                            updated[idx].name = e.target.value;
                                                            setNewProtocolMedicines(updated);
                                                        }}
                                                        placeholder="e.g. Paracetamol 650mg"
                                                        className="h-11 rounded-xl bg-slate-50 dark:bg-slate-900 border-none font-bold shadow-sm"
                                                    />
                                                </div>
                                                <div className="col-span-12 md:col-span-1 pb-0.5 flex justify-end">
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => setNewProtocolMedicines(newProtocolMedicines.filter((_, i) => i !== idx))}
                                                        className="text-red-400 hover:text-red-600 hover:bg-red-50 rounded-full h-11 w-11 transition-colors shrink-0"
                                                    >
                                                        <Trash2 className="w-5 h-5" />
                                                    </Button>
                                                </div>
                                            </div>

                                            {/* Row 2: Dosage + Route + Frequency + Remarks */}
                                            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 pt-4 border-t border-slate-50 dark:border-slate-800">
                                                <div className="col-span-6 md:col-span-2 space-y-1.5">
                                                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 ml-1">
                                                        {(m.type === 'Oin.' || m.type === 'cr.' || m.type === 'drops.' || m.type === 'Sac.') ? 'Count' : 'Dosage'}
                                                    </Label>
                                                    <Input
                                                        value={m.dosage || m['count'] || ''}
                                                        onChange={e => {
                                                            const updated = [...newProtocolMedicines];
                                                            if (m.type === 'Oin.' || m.type === 'cr.' || m.type === 'drops.' || m.type === 'Sac.') {
                                                                updated[idx].count = e.target.value;
                                                            } else {
                                                                updated[idx].dosage = e.target.value;
                                                            }
                                                            setNewProtocolMedicines(updated);
                                                        }}
                                                        placeholder={(m.type === 'Oin.' || m.type === 'cr.' || m.type === 'drops.' || m.type === 'Sac.') ? "1 Tube" : "500mg"}
                                                        className="h-11 rounded-xl bg-slate-50 dark:bg-slate-900 border-none font-bold shadow-sm"
                                                    />
                                                </div>

                                                <div className="col-span-6 md:col-span-2 space-y-1.5">
                                                    <Label className="text-[10px] font-black uppercase tracking-widest text-blue-400 dark:text-blue-500 ml-1">Route</Label>
                                                    <Input
                                                        value={m.route || ''}
                                                        onChange={e => {
                                                            const updated = [...newProtocolMedicines];
                                                            updated[idx].route = e.target.value;
                                                            setNewProtocolMedicines(updated);
                                                        }}
                                                        placeholder="Oral / I.M"
                                                        className="h-11 rounded-xl bg-blue-50/50 dark:bg-blue-900/10 border-none font-bold text-blue-600 dark:text-blue-400 shadow-sm"
                                                    />
                                                </div>

                                                <div className="col-span-6 md:col-span-3 space-y-1.5">
                                                    <Label className="text-[10px] font-black uppercase tracking-widest text-purple-400 dark:text-purple-500 ml-1">Frequency</Label>
                                                    <div className="relative group/freq overflow-visible">
                                                        <Input
                                                            value={m.frequency}
                                                            onChange={e => {
                                                                const updated = [...newProtocolMedicines];
                                                                updated[idx].frequency = e.target.value;
                                                                setNewProtocolMedicines(updated);
                                                            }}
                                                            placeholder="1-0-1"
                                                            className="h-11 rounded-xl bg-purple-50/50 dark:bg-purple-900/10 border-none font-bold text-xs pr-10 shadow-sm text-purple-700 dark:text-purple-400"
                                                        />
                                                        <Popover open={openFreqPopoverIndex === idx} onOpenChange={(open) => setOpenFreqPopoverIndex(open ? idx : null)}>
                                                            <PopoverTrigger asChild>
                                                                <Button 
                                                                    variant="ghost" 
                                                                    size="icon" 
                                                                    className="absolute right-0 top-0 h-11 w-10 hover:bg-purple-100 dark:hover:bg-purple-900/40 rounded-r-xl transition-colors"
                                                                >
                                                                    <ChevronDown className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                                                                </Button>
                                                            </PopoverTrigger>
                                                            <PopoverContent className="w-[180px] p-0 shadow-2xl border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden" align="end">
                                                                <div className="p-1.5 bg-white dark:bg-slate-900 max-h-60 overflow-y-auto">
                                                                    {(m.type === 'Inj.' ? ['Stat', 'SOS', 'Once daily', 'Twice daily'] : ['1-0-1', '1-1-1', '0-0-1', '1-0-0', '0-1-0', 'Before food', 'After food']).map(freq => (
                                                                        <button
                                                                            key={freq}
                                                                            type="button"
                                                                            className="w-full text-left px-3 py-2.5 text-xs font-bold hover:bg-purple-50 dark:hover:bg-purple-900/30 text-slate-700 dark:text-slate-300 rounded-lg transition-colors"
                                                                            onClick={() => {
                                                                                const updated = [...newProtocolMedicines];
                                                                                updated[idx].frequency = freq;
                                                                                setNewProtocolMedicines(updated);
                                                                                setOpenFreqPopoverIndex(null);
                                                                            }}
                                                                        >
                                                                            {freq}
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            </PopoverContent>
                                                        </Popover>
                                                    </div>
                                                </div>

                                                <div className="col-span-6 md:col-span-2 space-y-1.5">
                                                    <Label className="text-[10px] font-black uppercase tracking-widest text-orange-400 dark:text-orange-500 ml-1">Duration</Label>
                                                    <Input
                                                        value={m.duration || ''}
                                                        onChange={e => {
                                                            const updated = [...newProtocolMedicines];
                                                            updated[idx].duration = e.target.value;
                                                            setNewProtocolMedicines(updated);
                                                        }}
                                                        placeholder="5 Days"
                                                        className="h-11 rounded-xl bg-orange-50/50 dark:bg-orange-900/10 border-none font-bold text-orange-700 dark:text-orange-400 shadow-sm"
                                                    />
                                                </div>

                                                <div className="col-span-6 md:col-span-3 space-y-1.5">
                                                    <Label className="text-[10px] font-black uppercase tracking-widest text-emerald-400 dark:text-emerald-500 ml-1">Remarks</Label>
                                                    <Input
                                                        value={m.instructions || m.notes || ''}
                                                        onChange={e => {
                                                            const updated = [...newProtocolMedicines];
                                                            updated[idx].instructions = e.target.value;
                                                            updated[idx].notes = e.target.value;
                                                            setNewProtocolMedicines(updated);
                                                        }}
                                                        placeholder="After Food"
                                                        className="h-11 rounded-xl bg-emerald-50/50 dark:bg-emerald-900/10 border-none font-bold text-emerald-700 dark:text-emerald-400 shadow-sm"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {newProtocolMedicines.length === 0 ? (
                                    <div className="p-8 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-2xl text-center text-slate-400 font-bold text-xs uppercase tracking-widest bg-white/30">
                                        No medicines added yet
                                    </div>
                                ) : (
                                    <div className="pt-2 flex justify-center">
                                        <Button 
                                            type="button" 
                                            variant="outline" 
                                            onClick={() => setNewProtocolMedicines([...newProtocolMedicines, { type: 'Tab.', name: '', dosage: '', frequency: '', duration: '', route: '', instructions: '' }])}
                                            className="rounded-full h-11 px-8 text-[11px] font-black uppercase tracking-widest border-2 border-dashed border-blue-200 text-blue-600 hover:bg-blue-50 transition-all hover:scale-105 active:scale-95 group"
                                        >
                                            <Plus className="w-4 h-4 mr-2 group-hover:rotate-90 transition-transform" /> Add Another Medicine
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="p-8 bg-white dark:bg-slate-800 border-t dark:border-slate-700 flex items-center justify-between">
                        <Button variant="ghost" onClick={() => setShowAddProtocolDialog(false)} className="rounded-full font-bold h-12 px-8 uppercase text-[10px] tracking-widest dark:text-slate-300">Cancel</Button>
                        <Button 
                            onClick={handleSaveProtocol} 
                            disabled={isSavingProtocol || !newProtocolName || newProtocolMedicines.length === 0}
                            className="rounded-full bg-blue-600 hover:bg-blue-700 text-white font-black h-12 px-10 uppercase text-[10px] tracking-widest shadow-xl shadow-blue-200"
                        >
                            {isSavingProtocol ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                            Save Protocol
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            {/* Full-Screen Image Preview */}
            <Dialog open={!!imagePreviewUrl} onOpenChange={open => !open && setImagePreviewUrl(null)}>
                <DialogContent className="max-w-3xl p-0 overflow-hidden border-none bg-black/90 rounded-[2.5rem] shadow-2xl backdrop-blur-xl">
                    <div className="relative aspect-auto flex items-center justify-center p-4">
                        <img
                            src={imagePreviewUrl || ''}
                            className="max-w-full max-h-[85vh] rounded-2xl object-contain shadow-2xl"
                            alt="Full Preview"
                        />
                        <button
                            onClick={() => setImagePreviewUrl(null)}
                            className="absolute top-6 right-6 bg-white/10 hover:bg-white/20 p-3 rounded-full text-white transition-all backdrop-blur-md border border-white/20 group"
                        >
                            <X className="w-6 h-6 group-hover:rotate-90 transition-transform duration-300" />
                        </button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
