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
    Lock, Building2, Upload, Palette, Sparkles, Check
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
import { useTheme, ACCENT_OPTIONS, AccentColor } from '@/components/ThemeProvider';
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

const getAvatarUrl = (url?: string) => {
    if (!url) return AVATAR_OPTIONS[0].url;
    // If it's a full URL (Supabase or external)
    if (url.startsWith('http')) return url;
    // If it's a local relative path starting with /avatars/
    if (url.startsWith('/avatars/')) return `/prescripto${url}`;
    // Fallback
    return url;
};

const COMMON_FREQUENCIES = [
    '1-0-1', '1-1-1', '0-0-1', '1-0-0', '0-1-0', '1-1-0', '0-1-1', 
    'Stat', 'SOS', 'Twice daily', 'Thrice daily', 'Four times daily', 'Before food', 'After food'
];

export default function DoctorProfile() {
    const { user, roles, hasRole } = useAuth();
    const { theme, setTheme, accent, setAccent } = useTheme();
    const { slug } = useParams();
    const { clinic } = useOutletContext<{ clinic: any }>();
    const navigate = useNavigate();
    const isClinicOwner = Boolean(clinic?.id && clinic?.owner_id === user?.id);
    const [profile, setProfile] = useState<ProfileData | null>(null);
    const [ownerProfile, setOwnerProfile] = useState<any>(null);
    const [activeTab, setActiveTab] = useState(() => {
        return localStorage.getItem('profileActiveTab') || 'overview';
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [clinicUploading, setClinicUploading] = useState(false);
    const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const clinicFileInputRef = useRef<HTMLInputElement>(null);

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

            // Fetch Clinic branding (prioritize clinics table, fallback to owner profile)
            if (clinic?.id) {
                const { data: clinicData } = await supabase
                    .from('clinics')
                    .select('name, address, phone, owner_id, photo_url')
                    .eq('id', clinic.id)
                    .single();
                
                if (clinicData) {
                    // Update profile state with clinic specific data if needed
                    // ONLY the clinic's true owner can edit this specific clinic's branding
                    if (clinicData.owner_id === user.id) {
                        setProfile(prev => ({
                            ...prev!,
                            clinic_name: clinicData.name,
                            clinic_address: clinicData.address || '',
                            clinic_phone: clinicData.phone || '',
                            clinic_photo: clinicData.photo_url || prev?.clinic_photo || ''
                        }));
                    } else {
                        // For non-owners (including superadmin), show clinic branding in read-only
                        setOwnerProfile({
                            clinic_name: clinicData.name,
                            clinic_address: clinicData.address,
                            clinic_phone: clinicData.phone,
                            clinic_photo: clinicData.photo_url
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

            const { error } = await supabase
                .from('profiles')
                .update({
                    full_name: sData.full_name,
                    qualifications: sData.qualifications,
                    registration_id: sData.registration_id,
                    clinic_name: sData.clinic_name,
                    clinic_address: sData.clinic_address,
                    clinic_phone: sData.clinic_phone,
                    clinic_photo: profile.clinic_photo,
                    signature_data: profile.signature_data,
                    // @ts-ignore
                    avatar_url: profile.avatar_url,
                    theme: theme
                })
                .eq('user_id', user.id);

            if (error) throw error;

            // 2. Update Clinic Branding (ONLY if true owner of this clinic)
            if (isClinicOwner) {
                const { error: clinicError } = await supabase
                    .from('clinics')
                    .update({
                        name: sData.clinic_name,
                        address: sData.clinic_address,
                        phone: sData.clinic_phone,
                        photo_url: profile.clinic_photo || null
                    })
                    .eq('id', clinic?.id);
                if (clinicError) throw clinicError;
            }

            toast.success('Profile and settings updated');
            
            // 3. Navigate to Consultation Page as requested
            setTimeout(() => {
                navigate(slug ? `/${slug}/consultation` : '/consultation');
            }, 1000);
        } catch (err: any) {
            toast.error(err.message);
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
        if (!file || !user?.id) return;

        if (!file.type.startsWith('image/')) {
            toast.error('Please upload an image file');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            toast.error('Image size must be less than 5MB');
            return;
        }

        setClinicUploading(true);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `clinic-${clinic?.id || user.id}-${Date.now()}.${fileExt}`;
            const filePath = `${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, file);

            if (uploadError) {
                if (uploadError.message.includes('bucket not found')) {
                    throw new Error('Please create a storage bucket named "avatars" in your Supabase dashboard.');
                }
                throw uploadError;
            }

            const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(filePath);

            if (clinic?.id) {
                await supabase
                    .from('clinics')
                    .update({ photo_url: publicUrl })
                    .eq('id', clinic.id);
            }

            await supabase
                .from('profiles')
                .update({ clinic_photo: publicUrl })
                .eq('user_id', user.id);

            setProfile(prev => prev ? { ...prev, clinic_photo: publicUrl } : null);
            toast.success('Clinic photo uploaded successfully');
        } catch (err: any) {
            console.error(err);
            toast.error(err.message || 'Failed to upload clinic photo');
        } finally {
            setClinicUploading(false);
        }
    };

    const handleDeleteClinicPhoto = async () => {
        if (!isClinicOwner) {
            toast.error('Only the Clinic Owner can delete the clinic photo.');
            return;
        }
        const currentPhoto = profile?.clinic_photo;
        if (!currentPhoto) return;

        const confirmDelete = window.confirm('Are you sure you want to delete the clinic photo?');
        if (!confirmDelete) return;

        setClinicUploading(true);
        try {
            if (currentPhoto.includes('/storage/v1/object/public/avatars/')) {
                const urlParts = currentPhoto.split('/');
                const fileName = urlParts[urlParts.length - 1].split('?')[0];
                await supabase.storage.from('avatars').remove([fileName]);
            }

            if (clinic?.id) {
                await supabase.from('clinics').update({ photo_url: null }).eq('id', clinic.id);
            }

            await supabase.from('profiles').update({ clinic_photo: null }).eq('user_id', user?.id);

            setProfile(prev => prev ? { ...prev, clinic_photo: undefined } : null);
            toast.success('Clinic photo removed');
        } catch (err: any) {
            console.error(err);
            toast.error(err.message || 'Failed to delete clinic photo');
        } finally {
            setClinicUploading(false);
        }
    };

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !user?.id) return;

        // Validate file type and size (5MB max)
        if (!file.type.startsWith('image/')) {
            toast.error('Please upload an image file');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            toast.error('Image size must be less than 5MB');
            return;
        }

        setUploading(true);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${user.id}-${Math.random()}.${fileExt}`;
            const filePath = `${fileName}`;

            // Upload to Supabase Storage (Assumes 'avatars' bucket exists)
            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, file);

            if (uploadError) {
                // If bucket doesn't exist, this might fail. Let's provide a helpful error.
                if (uploadError.message.includes('bucket not found')) {
                    throw new Error('Please create a storage bucket named "avatars" in your Supabase dashboard.');
                }
                throw uploadError;
            }

            // Get Public URL
            const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(filePath);

            // Update Profile
            const { error: updateError } = await supabase
                .from('profiles')
                .update({ avatar_url: publicUrl })
                .eq('user_id', user.id);

            if (updateError) throw updateError;

            setProfile(prev => prev ? { ...prev, avatar_url: publicUrl } : null);
            toast.success('Profile photo updated');
        } catch (err: any) {
            console.error(err);
            toast.error(err.message || 'Failed to upload photo');
        } finally {
            setUploading(false);
        }
    };

    const handleDeletePhoto = async () => {
        if (!profile?.avatar_url || !user?.id) return;

        // Only delete if it's a custom uploaded photo (contains Supabase storage path)
        const isCustomPhoto = profile.avatar_url.includes('/storage/v1/object/public/avatars/');

        if (!isCustomPhoto) {
            // If it's just a default avatar, just reset it
            setProfile(prev => prev ? { ...prev, avatar_url: undefined } : null);
            return;
        }

        const confirmDelete = window.confirm('Are you sure you want to delete your profile photo?');
        if (!confirmDelete) return;

        setUploading(true);
        try {
            // Extract filename from URL
            const urlParts = profile.avatar_url.split('/');
            const fileName = urlParts[urlParts.length - 1].split('?')[0];

            // 1. Delete from Supabase Storage
            const { error: storageError } = await supabase.storage
                .from('avatars')
                .remove([fileName]);

            if (storageError) console.error('Storage deletion error:', storageError);

            // 2. Update Profile to null/default
            const { error: updateError } = await supabase
                .from('profiles')
                .update({ avatar_url: null })
                .eq('user_id', user.id);

            if (updateError) throw updateError;

            setProfile(prev => prev ? { ...prev, avatar_url: undefined } : null);
            toast.success('Profile photo removed');
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
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="flex items-center gap-6">
                    <div className="relative group perspective-1000">
                        <div className="w-28 h-36 md:w-32 md:h-44 rounded-[2rem] bg-gradient-to-b from-blue-500 to-blue-700 shadow-2xl overflow-hidden flex items-center justify-center transform transition-all duration-500 group-hover:rotate-y-12 group-hover:scale-105 border-4 border-white dark:border-slate-800">
                            <img
                                src={getAvatarUrl(profile?.avatar_url)}
                                className="w-full h-full object-cover"
                                alt="Profile"
                                onError={(e) => {
                                    e.currentTarget.src = AVATAR_OPTIONS[0].url;
                                }}
                            />
                            <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/20 to-transparent" />

                            {/* Upload Overlay */}
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white gap-3 cursor-pointer p-2 backdrop-blur-sm">
                                <div className="grid grid-cols-2 gap-2 w-full px-4">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setImagePreviewUrl(getAvatarUrl(profile?.avatar_url));
                                        }}
                                        className="flex flex-col items-center gap-1 hover:scale-110 transition-transform bg-white/10 hover:bg-white/20 p-2 rounded-xl"
                                    >
                                        <Eye className="w-6 h-6" />
                                        <span className="text-[9px] font-black uppercase tracking-widest">Open</span>
                                    </button>

                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            fileInputRef.current?.click();
                                        }}
                                        disabled={uploading}
                                        className="flex flex-col items-center gap-1 hover:scale-110 transition-transform bg-white/10 hover:bg-white/20 p-2 rounded-xl"
                                    >
                                        {uploading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Camera className="w-6 h-6" />}
                                        <span className="text-[9px] font-black uppercase tracking-widest text-center">Browse</span>
                                    </button>
                                </div>

                                {profile?.avatar_url?.includes('http') && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeletePhoto();
                                        }}
                                        disabled={uploading}
                                        className="flex flex-col items-center gap-1 text-red-100 hover:text-white bg-red-500/20 hover:bg-red-500/40 p-2 rounded-xl w-full mx-4 transition-all"
                                    >
                                        <div className="flex items-center gap-2">
                                            <Trash2 className="w-4 h-4" />
                                            <span className="text-[9px] font-black uppercase tracking-widest">Remove Photo</span>
                                        </div>
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
                        <div className="absolute -bottom-3 -right-3 bg-emerald-500 text-white p-2 rounded-2xl border-4 border-white dark:border-slate-800 shadow-xl">
                            <CheckCircle2 className="w-5 h-5" />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <h1 className="text-3xl md:text-5xl font-black tracking-tighter text-slate-900 dark:text-slate-50 group">
                                {profile?.full_name}
                            </h1>
                            {roles.map(role => (
                                <span key={role} className="bg-slate-900 dark:bg-slate-50 dark:text-slate-900 text-white text-[10px] px-3 py-1 rounded-full font-black uppercase tracking-widest">
                                    {role}
                                </span>
                            ))}
                        </div>
                        <p className="text-blue-600 font-bold text-lg md:text-xl tracking-tight">
                            {profile?.qualifications || "Update your credentials"}
                        </p>
                        <div className="flex items-center gap-4 text-slate-400 text-sm font-medium pt-2">
                            <div className="flex items-center gap-1.5"><Mail className="w-4 h-4" /> {user?.email}</div>
                            {profile?.registration_id && <div className="flex items-center gap-1.5"><ShieldCheck className="w-4 h-4" /> Reg: {profile.registration_id}</div>}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <Button
                        variant="outline"
                        size="sm"
                        className="rounded-2xl border-slate-200 dark:border-slate-800 gap-2 font-bold h-11 px-6 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800"
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
                        className="rounded-2xl bg-blue-600 hover:bg-blue-700 gap-2 font-bold h-11 px-6 shadow-lg shadow-blue-200 text-white border-none"
                    >
                        <RefreshCw className="w-4 h-4" /> Sync Records
                    </Button>
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full space-y-8">
                <TabsList className="bg-white/50 dark:bg-slate-900/50 backdrop-blur p-1.5 rounded-[2rem] border border-slate-200 dark:border-slate-800 w-full md:w-auto h-auto grid grid-cols-2 md:grid-cols-4 gap-2">
                    <TabsTrigger value="overview" className="rounded-full px-8 py-3 data-[state=active]:bg-slate-900 data-[state=active]:text-white dark:data-[state=active]:bg-slate-50 dark:data-[state=active]:text-slate-900 font-black text-xs uppercase tracking-widest gap-2">
                        <LayoutDashboard className="w-4 h-4" /> Overview
                    </TabsTrigger>
                    <TabsTrigger value="analytics" className="rounded-full px-8 py-3 data-[state=active]:bg-slate-900 data-[state=active]:text-white font-black text-xs uppercase tracking-widest gap-2">
                        <BarChart3 className="w-4 h-4" /> Analytics
                    </TabsTrigger>
                    <TabsTrigger value="protocols" className="rounded-full px-8 py-3 data-[state=active]:bg-slate-900 data-[state=active]:text-white font-black text-xs uppercase tracking-widest gap-2">
                        <Stethoscope className="w-4 h-4" /> Protocols
                    </TabsTrigger>
                    <TabsTrigger value="settings" className="rounded-full px-8 py-3 data-[state=active]:bg-slate-900 data-[state=active]:text-white font-black text-xs uppercase tracking-widest gap-2">
                        <Settings className="w-4 h-4" /> Settings
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

                <TabsContent value="settings" className="focus-visible:outline-none space-y-8">
                    <form onSubmit={handleUpdateProfile} className="space-y-8">
                        {/* 1. App Appearance & Themes Customizer Card */}
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

                                {/* Color Swatches */}
                                <div className="space-y-2.5">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Theme Color</Label>
                                        <span className="text-xs font-bold text-primary capitalize">
                                            {ACCENT_OPTIONS.find(a => a.id === accent)?.name}
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
                                    </div>
                                </div>
                            </div>
                        </Card>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {/* Identity Card */}
                            <Card className="border-slate-100 dark:border-slate-800 rounded-2xl p-6 space-y-6 bg-white dark:bg-slate-900 shadow-sm">
                                <div className="flex items-center gap-3">
                                    <div className="p-3 bg-primary/10 rounded-2xl">
                                        <User className="w-6 h-6 text-primary" />
                                    </div>
                                    <h3 className="text-xl font-bold tracking-tight dark:text-slate-100">Professional Identity</h3>
                                </div>

                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Display Name</Label>
                                        <Input
                                            value={profile?.full_name}
                                            onChange={e => setProfile(p => ({ ...p!, full_name: e.target.value }))}
                                            className="h-11 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 rounded-xl px-4 font-bold focus:ring-primary"
                                        />
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Primary Qualifications</Label>
                                            <Input
                                                value={profile?.qualifications}
                                                onChange={e => setProfile(p => ({ ...p!, qualifications: e.target.value }))}
                                                placeholder="MBBS, MD (Cardiology)"
                                                className="h-12 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 rounded-xl px-4 font-bold"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Medical Registration ID</Label>
                                            <Input
                                                value={profile?.registration_id}
                                                onChange={e => setProfile(p => ({ ...p!, registration_id: e.target.value }))}
                                                placeholder="Reg #12345"
                                                className="h-12 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 rounded-xl px-4 font-bold"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-4">
                                        <Label className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Select Passport Vector Avatar</Label>
                                        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-inner max-h-48 overflow-y-auto">
                                            {AVATAR_OPTIONS.map((opt) => (
                                                <button
                                                    key={opt.url}
                                                    type="button"
                                                    onClick={() => setProfile(p => ({ ...p!, avatar_url: opt.url }))}
                                                    className={cn(
                                                        "relative aspect-square rounded-xl overflow-hidden border-4 transition-all hover:scale-105",
                                                        profile?.avatar_url === opt.url ? "border-blue-600 ring-4 ring-blue-100 dark:ring-blue-900/40" : "border-white dark:border-slate-700"
                                                    )}
                                                >
                                                    <img src={opt.url} className="w-full h-full object-cover" alt={opt.name} />
                                                    {profile?.avatar_url === opt.url && (
                                                        <div className="absolute inset-0 bg-blue-600/10 flex items-center justify-center">
                                                            <CheckCircle2 className="w-6 h-6 text-blue-600" />
                                                        </div>
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </Card>

                            {/* Clinic Branding */}
                            <Card className="border-slate-100 dark:border-slate-800 rounded-[2rem] p-8 space-y-8 bg-white dark:bg-slate-900 shadow-sm transition-all duration-300">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="p-3 bg-emerald-50 dark:bg-emerald-900/40 rounded-2xl">
                                            <Building2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                                        </div>
                                        <div>
                                            <h3 className="text-2xl font-black tracking-tight dark:text-slate-100">Clinic Branding</h3>
                                            <p className="text-xs font-bold text-slate-400 dark:text-slate-500">Live details displayed across Prescriptions & TV Screen</p>
                                        </div>
                                    </div>
                                    {isClinicOwner ? (
                                        <Badge className="bg-emerald-50 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 text-[10px] uppercase font-black tracking-widest px-3 py-1 rounded-full">
                                            Clinic Owner Control
                                        </Badge>
                                    ) : (
                                        <Badge variant="outline" className="bg-slate-100 dark:bg-slate-800 border-none text-[10px] uppercase tracking-widest text-slate-500 gap-1 px-3 py-1 rounded-full">
                                            <Lock className="w-3 h-3" /> Managed by Clinic Owner (View Only)
                                        </Badge>
                                    )}
                                </div>

                                {/* Clinic Photo Upload / Display Section */}
                                <div className="p-5 rounded-3xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center gap-5">
                                    <div className="relative group/clinicphoto shrink-0">
                                        <div className="w-24 h-24 rounded-[1.75rem] bg-gradient-to-tr from-slate-200 to-slate-100 dark:from-slate-800 dark:to-slate-700 border-2 border-white dark:border-slate-600 shadow-md overflow-hidden flex items-center justify-center">
                                            {(isClinicOwner ? profile?.clinic_photo : ownerProfile?.clinic_photo) ? (
                                                <img
                                                    src={isClinicOwner ? profile?.clinic_photo : ownerProfile?.clinic_photo}
                                                    alt="Clinic"
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <Building2 className="w-10 h-10 text-slate-400 dark:text-slate-500" />
                                            )}
                                        </div>

                                        {isClinicOwner && (
                                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/clinicphoto:opacity-100 transition-opacity rounded-[1.75rem] flex items-center justify-center gap-2 p-1 backdrop-blur-xs">
                                                <button
                                                    type="button"
                                                    onClick={() => clinicFileInputRef.current?.click()}
                                                    disabled={clinicUploading}
                                                    className="p-2 bg-white/20 hover:bg-white/30 text-white rounded-xl transition-transform hover:scale-110"
                                                    title="Upload Clinic Photo"
                                                >
                                                    {clinicUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                                                </button>
                                                {profile?.clinic_photo && (
                                                    <button
                                                        type="button"
                                                        onClick={handleDeleteClinicPhoto}
                                                        disabled={clinicUploading}
                                                        className="p-2 bg-red-500/40 hover:bg-red-500/60 text-white rounded-xl transition-transform hover:scale-110"
                                                        title="Delete Clinic Photo"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
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

                                    <div className="space-y-1 text-center sm:text-left flex-1">
                                        <div className="flex items-center justify-center sm:justify-start gap-2">
                                            <h4 className="font-extrabold text-sm text-slate-900 dark:text-slate-100">Clinic Display Photo</h4>
                                            {((isClinicOwner ? profile?.clinic_photo : ownerProfile?.clinic_photo)) && (
                                                <span className="text-[9px] font-black uppercase tracking-wider text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full">Active</span>
                                            )}
                                        </div>
                                        <p className="text-xs text-slate-400 dark:text-slate-500">
                                            {isClinicOwner
                                                ? "Upload high-res clinic exterior/reception photo to feature on Waiting Room TV screen & branding."
                                                : "Displayed on the Waiting Room TV screen. Managed by Clinic Owner."}
                                        </p>
                                        {isClinicOwner && (
                                            <div className="pt-2 flex items-center gap-2 justify-center sm:justify-start">
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    disabled={clinicUploading}
                                                    onClick={() => clinicFileInputRef.current?.click()}
                                                    className="rounded-xl h-8 px-3 text-xs font-bold gap-1.5 border-slate-200 dark:border-slate-700"
                                                >
                                                    {clinicUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                                                    {profile?.clinic_photo ? 'Change Photo' : 'Upload Photo'}
                                                </Button>
                                                {profile?.clinic_photo && (
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => setImagePreviewUrl(profile?.clinic_photo || null)}
                                                        className="rounded-xl h-8 px-2.5 text-xs text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
                                                    >
                                                        <Eye className="w-3.5 h-3.5 mr-1" /> View
                                                    </Button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <Label className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Clinic Name</Label>
                                            <Input
                                                value={(isClinicOwner ? profile?.clinic_name : ownerProfile?.clinic_name) || ''}
                                                onChange={e => setProfile(p => ({ ...p!, clinic_name: e.target.value }))}
                                                placeholder="e.g. GV Clinic"
                                                className="h-12 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 rounded-xl px-4 font-bold"
                                                readOnly={!isClinicOwner}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Contact Number</Label>
                                            <Input
                                                value={(isClinicOwner ? profile?.clinic_phone : ownerProfile?.clinic_phone) || ''}
                                                onChange={e => setProfile(p => ({ ...p!, clinic_phone: e.target.value }))}
                                                placeholder="+91 00000 00000"
                                                className="h-12 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 rounded-xl px-4 font-bold"
                                                readOnly={!isClinicOwner}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Full Address</Label>
                                        <Input
                                            value={(isClinicOwner ? profile?.clinic_address : ownerProfile?.clinic_address) || ''}
                                            onChange={e => setProfile(p => ({ ...p!, clinic_address: e.target.value }))}
                                            placeholder="Complete street address with pincode"
                                            className="h-12 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 rounded-xl px-4 font-bold"
                                            readOnly={!isClinicOwner}
                                        />
                                    </div>
                                </div>
                            </Card>

                            {/* Digital Signature */}
                            <Card className="border-slate-100 dark:border-slate-800 rounded-[2rem] p-8 space-y-6 bg-white dark:bg-slate-900 shadow-sm lg:col-span-2">
                                <div className="flex items-center gap-3">
                                    <div className="p-3 bg-amber-50 dark:bg-amber-900/40 rounded-2xl">
                                        <FileSignature className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                                    </div>
                                    <div>
                                        <h3 className="text-2xl font-black tracking-tight dark:text-slate-100">Digital Signature</h3>
                                        <p className="text-xs font-bold text-slate-400 dark:text-slate-500">Used for validating digital prescriptions</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                                    <SignaturePad
                                        initialSignature={profile?.signature_data}
                                        onSave={(data) => setProfile(p => ({ ...p!, signature_data: data }))}
                                    />
                                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-3xl p-8 border-2 border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center min-h-[150px]">
                                        {profile?.signature_data ? (
                                            <div className="space-y-4 text-center w-full">
                                                <div className="relative group/sig mx-auto w-fit">
                                                    <img src={profile.signature_data} className="max-h-24 mx-auto contrast-125 dark:invert" alt="Preview" />
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
                                                <div className="flex flex-col items-center gap-1">
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
                                            <div className="text-center space-y-2 opacity-30">
                                                <FileSignature className="w-12 h-12 mx-auto" />
                                                <p className="text-xs font-black uppercase tracking-widest">No signature saved</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </Card>
                        </div>

                        <div className="flex justify-end pt-6">
                            <Button
                                type="submit"
                                disabled={saving}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-black uppercase text-[12px] tracking-widest px-12 h-16 rounded-[2rem] shadow-2xl shadow-blue-200"
                            >
                                {saving ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />}
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
