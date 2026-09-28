import { useAuth } from '@/lib/auth';
import { useNavigate, useParams, useOutletContext, Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  ClipboardPlus, Stethoscope, Printer, Users, Activity,
  ArrowUpRight, UserPlus, CheckCircle2, Tv, Sparkles, Clock, CalendarX,
  Edit, Eye, Plus, ChevronRight, Loader2, CheckCircle
} from 'lucide-react';
import { useState, useEffect, useMemo, useRef } from 'react';
import { startOfDay, endOfDay } from 'date-fns';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import type { Clinic } from '@/types/clinic';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import PrescriptionTemplate from '@/components/PrescriptionTemplate';
import { printPrescription } from '@/lib/printPrescription';
import { formatAge, getPatientCurrentAge, calculateDobFromAge } from '@/lib/utils';
import { validateNumericRange } from '@/lib/security-sanitize';

interface VitalsForm {
  weight: string;
  blood_pressure: string;
  pulse_rate: string;
  spo2: string;
  temperature: string;
  cbg: string;
}

const initialVitals: VitalsForm = { weight: '', blood_pressure: '', pulse_rate: '', spo2: '', temperature: '', cbg: '' };

// Mini circular arc gauge matching Skynex sub-cards
function MiniArcGauge({ percent, color }: { percent: number; color: string }) {
  const radius = 15;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (Math.min(100, Math.max(10, percent)) / 100) * circumference;

  return (
    <div className="relative w-11 h-11 flex items-center justify-center shrink-0">
      <svg className="w-11 h-11 -rotate-90" viewBox="0 0 36 36">
        <circle
          cx="18"
          cy="18"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="3.5"
          className="text-slate-100 dark:text-slate-800"
        />
        <circle
          cx="18"
          cy="18"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="3.5"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-700 ease-out"
        />
      </svg>
    </div>
  );
}

export default function Dashboard() {
  const { user, profile, roles, hasRole } = useAuth();
  const { slug } = useParams();
  const { clinic } = useOutletContext<{ clinic: Clinic }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Patient detail & action states
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [patientVisits, setPatientVisits] = useState<any[]>([]);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    title: '',
    name: '',
    age: '',
    ageUnit: 'years',
    sex: 'Male',
    phone: '',
    address: ''
  });

  // Revisit / Add Visit modal states
  const [addVisitOpen, setAddVisitOpen] = useState(false);
  const [addVisitVitals, setAddVisitVitals] = useState<VitalsForm>(initialVitals);
  const [addVisitDoctorId, setAddVisitDoctorId] = useState<string>('general');
  const [submittingVisit, setSubmittingVisit] = useState(false);

  // Vitals input refs for Enter key navigation
  const weightRef = useRef<HTMLInputElement>(null);
  const bpRef = useRef<HTMLInputElement>(null);
  const pulseRef = useRef<HTMLInputElement>(null);
  const spo2Ref = useRef<HTMLInputElement>(null);
  const tempRef = useRef<HTMLInputElement>(null);
  const cbgRef = useRef<HTMLInputElement>(null);

  // Edit form input refs
  const editNameRef = useRef<HTMLInputElement>(null);
  const editAgeRef = useRef<HTMLInputElement>(null);
  const editPhoneRef = useRef<HTMLInputElement>(null);
  const editAddressRef = useRef<HTMLInputElement>(null);

  const handleVitalsKeyDown = (e: React.KeyboardEvent, nextRef?: React.RefObject<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (nextRef && nextRef.current) {
        nextRef.current.focus();
      } else if (!nextRef) {
        handleAddVisit();
      }
    }
  };

  const handleEditKeyDown = (e: React.KeyboardEvent, nextRef?: React.RefObject<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (nextRef && nextRef.current) {
        nextRef.current.focus();
      } else if (!nextRef) {
        savePatientEdit();
      }
    }
  };

  // Auto-focus first field when Add Visit modal opens
  useEffect(() => {
    if (addVisitOpen) {
      const timer = setTimeout(() => {
        weightRef.current?.focus();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [addVisitOpen]);

  // Auto-focus first field when Edit mode is activated
  useEffect(() => {
    if (editing) {
      const timer = setTimeout(() => {
        editNameRef.current?.focus();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [editing]);

  // Prescription preview states
  const [viewingRx, setViewingRx] = useState<any>(null);
  const [currentRx, setCurrentRx] = useState<any>(null);
  const [loadingRx, setLoadingRx] = useState(false);

  // Doctors in clinic for visit assignment
  const { data: doctors } = useQuery({
    queryKey: ['doctors_v2', clinic?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, user_id, full_name, role, email')
        .in('role', ['doctor', 'owner'])
        .eq('clinic_id', clinic?.id)
        .neq('is_superadmin', true);
      return data || [];
    },
    enabled: !!clinic?.id
  });

  const doctorOptions = useMemo(() => {
    const seen = new Set<string>();
    return (doctors || [])
      .map((doctor: any) => {
        const assignId = doctor?.id || doctor?.user_id || '';
        return { ...doctor, assignId: String(assignId) };
      })
      .filter((doctor: any) => {
        if (!doctor.assignId || seen.has(doctor.assignId)) return false;
        seen.add(doctor.assignId);
        return true;
      });
  }, [doctors]);

  // Auto-default doctor assignment to current doctor if applicable
  useEffect(() => {
    if (addVisitOpen) {
      if (profile?.role === 'doctor' || profile?.role === 'owner') {
        const myDoc = doctorOptions.find(d => d.user_id === user?.id || d.id === profile?.id);
        if (myDoc) {
          setAddVisitDoctorId(myDoc.assignId);
        } else {
          setAddVisitDoctorId('general');
        }
      } else {
        setAddVisitDoctorId('general');
      }
    }
  }, [addVisitOpen, profile, user, doctorOptions]);

  // Dynamic page title
  useEffect(() => {
    document.title = `Dashboard${clinic?.name ? ` — ${clinic.name}` : ''} | Prescripto`;
    return () => { document.title = 'Prescripto'; };
  }, [clinic?.name]);

  useEffect(() => {
    const isSuperAdmin = roles.includes('superadmin') || hasRole('superadmin') || profile?.is_superadmin;
    const isOwner = Boolean(clinic?.owner_id && user?.id && clinic.owner_id === user.id);

    // Superadmins and clinic owners have full multi-clinic authority
    if (!isSuperAdmin && !isOwner && profile && profile.clinic_id && clinic?.id && profile.clinic_id !== clinic.id) {
      toast.error("Account Mismatch: You are viewing " + clinic.name + " but your account is assigned to another clinic.");
    }
  }, [profile, clinic?.id, clinic?.name, clinic?.owner_id, user?.id, roles, hasRole]);

  const { data: dashboardData = { stats: { total: 0, today: 0, completed: 0, waiting: 0, inCabin: 0 }, completedList: [] } } = useQuery({
    queryKey: ['dashboardData', clinic?.id],
    queryFn: async () => {
      if (!clinic?.id) return { stats: { total: 0, today: 0, completed: 0, waiting: 0, inCabin: 0 }, completedList: [] };
      const todayStart = startOfDay(new Date()).toISOString();
      const todayEnd = endOfDay(new Date()).toISOString();

      const [totalPatients, totalVisitsToday, completedToday, waitingToday, inCabinToday, completedListData] = await Promise.all([
        supabase.from('patients').select('*', { count: 'exact', head: true }).eq('clinic_id', clinic.id),
        supabase.from('visits').select('*', { count: 'exact', head: true }).eq('clinic_id', clinic.id).gte('created_at', todayStart).lte('created_at', todayEnd),
        supabase.from('visits').select('*', { count: 'exact', head: true }).eq('clinic_id', clinic.id).gte('created_at', todayStart).lte('created_at', todayEnd).eq('status', 'completed'),
        supabase.from('visits').select('*', { count: 'exact', head: true }).eq('clinic_id', clinic.id).gte('created_at', todayStart).lte('created_at', todayEnd).eq('status', 'waiting'),
        supabase.from('visits').select('*', { count: 'exact', head: true }).eq('clinic_id', clinic.id).gte('created_at', todayStart).lte('created_at', todayEnd).eq('status', 'in_consultation'),
        supabase.from('visits').select('id, token_number, patient_id, patients(id, title, name, age, dob, sex, phone, address, created_at, registration_id)').eq('clinic_id', clinic.id).gte('created_at', todayStart).lte('created_at', todayEnd).eq('status', 'completed').order('updated_at', { ascending: false }).limit(4)
      ]);

      return {
        stats: {
          total: totalPatients.count || 0,
          today: totalVisitsToday.count || 0,
          completed: completedToday.count || 0,
          waiting: waitingToday.count || 0,
          inCabin: inCabinToday.count || 0
        },
        completedList: completedListData.data || []
      };
    },
    staleTime: 5000,
  });

  const handleOpenPatient = async (p: any) => {
    if (!p) return;
    let fullPatient = p;
    if (p.id) {
      const { data: ptData } = await supabase.from('patients').select('*').eq('id', p.id).maybeSingle();
      if (ptData) fullPatient = ptData;
    }
    setSelectedPatient(fullPatient);
    setEditing(false);
    const currentAge = getPatientCurrentAge(fullPatient);
    setEditForm({
      title: fullPatient.title || '',
      name: fullPatient.name || '',
      age: currentAge !== null ? String(currentAge) : String(fullPatient.age || ''),
      ageUnit: 'years',
      sex: fullPatient.sex || 'Male',
      phone: fullPatient.phone || '',
      address: fullPatient.address || ''
    });

    const { data: vData } = await supabase
      .from('visits')
      .select('*, prescriptions(*)')
      .eq('patient_id', fullPatient.id)
      .order('created_at', { ascending: false });
    setPatientVisits(vData || []);
  };

  const savePatientEdit = async () => {
    if (!selectedPatient) return;
    let ageInYears = parseFloat(editForm.age);
    if (editForm.ageUnit === 'months') ageInYears = ageInYears / 12;
    if (editForm.ageUnit === 'days') ageInYears = ageInYears / 365;
    const calculatedDob = calculateDobFromAge(parseFloat(editForm.age), editForm.ageUnit);

    const updatePayload: any = {
      title: editForm.title,
      name: editForm.name,
      age: ageInYears,
      created_at: new Date().toISOString(),
      sex: editForm.sex,
      phone: editForm.phone,
      address: editForm.address || null,
    };

    let { error } = await supabase.from('patients').update({
      ...updatePayload,
      dob: calculatedDob,
    }).eq('id', selectedPatient.id);

    if (error && (error.message?.includes('dob') || error.message?.includes('schema cache'))) {
      const { error: retryError } = await supabase.from('patients').update(updatePayload).eq('id', selectedPatient.id);
      error = retryError;
    }

    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Patient updated successfully');
      setEditing(false);
      setSelectedPatient((prev: any) => ({
        ...prev,
        ...updatePayload,
        dob: calculatedDob
      }));
      queryClient.invalidateQueries({ queryKey: ['dashboardData', clinic?.id] });
    }
  };

  const handleAddVisit = async () => {
    if (!selectedPatient || !clinic?.id) return;

    if (addVisitVitals.weight && !validateNumericRange(addVisitVitals.weight, 0, 500)) {
      toast.error("Invalid weight value (0-500 kg)");
      return;
    }
    if (addVisitVitals.pulse_rate && !validateNumericRange(addVisitVitals.pulse_rate, 0, 300)) {
      toast.error("Invalid pulse rate (0-300 bpm)");
      return;
    }

    setSubmittingVisit(true);
    const loadingToast = toast.loading("Generating token and creating visit...");

    try {
      let token = 1;
      const { data: tokenData, error: tokenError } = await (supabase.rpc as any)('get_next_token', { p_clinic_id: clinic?.id });
      if (tokenError) {
        console.error('[Dashboard] RPC get_next_token error:', tokenError);
        token = 1;
      } else {
        token = tokenData || 1;
      }

      const normalizedAssignedDoctorId =
        addVisitDoctorId !== 'general' && addVisitDoctorId ? addVisitDoctorId : null;

      const { data: newVisit, error: visitError } = await supabase.from('visits').insert({
        patient_id: selectedPatient.id,
        token_number: token,
        weight: addVisitVitals.weight ? parseFloat(addVisitVitals.weight) : null,
        blood_pressure: addVisitVitals.blood_pressure.trim() || null,
        pulse_rate: addVisitVitals.pulse_rate ? parseInt(addVisitVitals.pulse_rate) : null,
        spo2: addVisitVitals.spo2 ? parseFloat(addVisitVitals.spo2) : null,
        temperature: addVisitVitals.temperature ? parseFloat(addVisitVitals.temperature) : null,
        cbg: addVisitVitals.cbg ? parseFloat(addVisitVitals.cbg) : null,
        assigned_doctor_id: normalizedAssignedDoctorId,
        clinic_id: clinic.id,
        created_by: user?.id,
        status: 'waiting'
      }).select('*, prescriptions(*)').single();

      if (visitError) throw visitError;

      // Update patient's last_opened_at
      await supabase.from('patients').update({
        last_opened_at: new Date().toISOString()
      }).eq('id', selectedPatient.id);

      if (newVisit) {
        setPatientVisits(prev => [newVisit, ...prev]);
      } else {
        const { data: refreshed } = await supabase
          .from('visits')
          .select('*, prescriptions(*)')
          .eq('patient_id', selectedPatient.id)
          .order('created_at', { ascending: false });
        setPatientVisits(refreshed || []);
      }

      toast.dismiss(loadingToast);
      toast.success(`Visit created for ${selectedPatient.title ? selectedPatient.title + ' ' : ''}${selectedPatient.name} — Token #${token}`);
      setAddVisitOpen(false);
      setAddVisitVitals(initialVitals);
      queryClient.invalidateQueries({ queryKey: ['dashboardData', clinic?.id] });
      queryClient.invalidateQueries({ queryKey: ['todayQueue', clinic?.id] });
      queryClient.invalidateQueries({ queryKey: ['queue', clinic?.id] });
    } catch (err: any) {
      toast.dismiss(loadingToast);
      console.error('[Dashboard] Add visit failed:', err);
      toast.error(err?.message || 'Failed to create visit');
    } finally {
      setSubmittingVisit(false);
    }
  };

  const handleViewPrescription = async (v: any) => {
    setViewingRx(v);
    setLoadingRx(true);
    setCurrentRx(null);
    
    try {
      if (Array.isArray(v.prescriptions) && v.prescriptions.length > 0) {
        setCurrentRx(v.prescriptions[0]);
      } else {
        const { data } = await supabase
          .from('prescriptions')
          .select('*')
          .eq('visit_id', v.id)
          .maybeSingle();
          
        if (data) setCurrentRx(data);
      }
    } catch (err) {
      console.error("Error fetching prescription:", err);
    } finally {
      setLoadingRx(false);
    }
  };

  const stats = dashboardData.stats;
  const completedList = dashboardData.completedList;

  // Realtime updates
  useEffect(() => {
    if (!clinic?.id) return;

    let debounceTimer: any;
    const channel = supabase
      .channel(`dashboard-realtime-${clinic.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'visits'
      }, () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ['dashboardData', clinic.id] });
        }, 500);
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'patients'
      }, () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ['dashboardData', clinic.id] });
        }, 500);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [queryClient, clinic?.id]);

  // Operational Modules
  const operations = [
    { label: 'Patient Entry', desc: 'Register & vitals', icon: ClipboardPlus, path: '../nurse', roles: ['staff', 'doctor'] as const, color: 'text-blue-500 bg-blue-500/10' },
    { label: 'Consultation', desc: 'Active queue & Rx', icon: Stethoscope, path: '../consultation', roles: ['doctor'] as const, color: 'text-indigo-500 bg-indigo-500/10' },
    { label: 'Print Queue', desc: 'Instant printouts', icon: Printer, path: '../print', roles: ['staff', 'doctor'] as const, color: 'text-amber-500 bg-amber-500/10' },
    { label: 'TV Display', desc: 'Waiting room screen', icon: Tv, path: '../display', roles: ['doctor', 'staff'] as const, color: 'text-emerald-500 bg-emerald-500/10' },
  ];

  const visibleOps = operations.filter(m => m.roles.some(r => hasRole(r)));

  // Calculate metrics
  const todayVisits = stats.today;
  const completedVisits = stats.completed;
  const waitingVisits = stats.waiting;
  const inCabinVisits = stats.inCabin;

  const completionPercent = todayVisits > 0
    ? Math.round((completedVisits / todayVisits) * 100)
    : 0;

  const progressRatio = todayVisits > 0
    ? (completedVisits / todayVisits)
    : (completionPercent / 100);

  const totalSegments = 34;
  const activeSegments = Math.round(progressRatio * totalSegments);

  return (
    <div className="space-y-6 max-w-4xl mx-auto font-jakarta-sans">
      {/* ── Greeting Header (Matches Skynex Typography) ── */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400">
            Hey, Hi! {(profile?.full_name ?? 'Doctor')} 🩺
          </p>
          <div className="mt-1">
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-[1.1]">
              Healthy <span className="font-serif italic font-normal text-primary">Clinic</span>
            </h1>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-[1.1]">
              Starts
            </h2>
          </div>
        </div>

        {/* Live Indicator Pill */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/60 dark:border-slate-800 shadow-xs">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
          <span className="text-[10px] font-extrabold tracking-wider uppercase text-slate-600 dark:text-slate-300">Live Practice</span>
        </div>
      </div>

      {/* ── Primary Hero Glass Card (Matches Skynex Main Card) ── */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative rounded-[2rem] p-5 sm:p-6 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/80 dark:border-slate-800/80 shadow-xl shadow-primary/5 space-y-5"
      >
        {/* Card Header Row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-primary shadow-xs">
              <Activity className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base leading-tight">Your Clinic Flow</h3>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">Live Queue • Today</p>
            </div>
          </div>

          <button
            onClick={() => navigate('../consultation')}
            className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-primary/10 hover:text-primary flex items-center justify-center text-slate-600 dark:text-slate-300 transition-all active:scale-90"
            title="Open Consultation"
          >
            <ArrowUpRight className="w-4 h-4" />
          </button>
        </div>

        {/* Big Stat & Status Row — or Empty State when no visits today */}
        {todayVisits === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-6 gap-3 text-center"
          >
            <div className="w-16 h-16 rounded-3xl bg-primary/10 flex items-center justify-center">
              <CalendarX className="w-8 h-8 text-primary/60" />
            </div>
            <div>
              <p className="font-black text-slate-900 dark:text-white text-base">No visits yet today</p>
              <p className="text-[12px] text-slate-400 dark:text-slate-500 mt-1 font-medium">Register the first patient to start the clinic flow</p>
            </div>
            <button
              onClick={() => navigate('../nurse')}
              className="flex items-center gap-2 px-5 py-2 rounded-2xl bg-primary text-white font-bold text-xs shadow-md shadow-primary/30 hover:scale-105 active:scale-95 transition-all mt-1"
            >
              <UserPlus className="w-4 h-4" />
              Register First Patient
            </button>
          </motion.div>
        ) : (
          <>
        <div className="flex items-end justify-between pt-1">
          <div>
            <div className="text-4xl sm:text-5xl font-black text-slate-900 dark:text-white tracking-tight leading-none">
              {completionPercent}%
            </div>
            <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 mt-1 uppercase tracking-wider">Completion Rate</p>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60 text-xs font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>{waitingVisits > 0 ? 'Active Flow' : 'Optimal'}</span>
          </div>
        </div>

        {/* Segmented Track Bar (Thin vertical pill bars like Skynex) */}
        <div className="flex items-center justify-between gap-1 sm:gap-1.5 pt-1 overflow-hidden">
          {Array.from({ length: totalSegments }).map((_, idx) => {
            const isActive = idx < activeSegments;
            return (
              <div
                key={idx}
                className={cn(
                  "flex-1 h-6 sm:h-7 rounded-full transition-all duration-500",
                  isActive
                    ? "bg-primary shadow-[0_0_8px_var(--accent-glow)]"
                    : "bg-slate-200/80 dark:bg-slate-800/80"
                )}
              />
            );
          })}
        </div>

        {/* ── 2x2 Compact Metric Grid (Sub-cards like Skynex) ── */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          {/* Waiting */}
          <div className="bg-white/90 dark:bg-slate-800/90 rounded-2xl p-3.5 border border-slate-100 dark:border-slate-700/60 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider">Waiting</p>
              <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-0.5">{waitingVisits}</p>
              <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 mt-0.5">In Queue</p>
            </div>
            <MiniArcGauge
              percent={todayVisits > 0 ? (waitingVisits / todayVisits) * 100 : 35}
              color="hsl(var(--primary))"
            />
          </div>

          {/* In Cabin */}
          <div className="bg-white/90 dark:bg-slate-800/90 rounded-2xl p-3.5 border border-slate-100 dark:border-slate-700/60 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider">In Cabin</p>
              <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-0.5">{inCabinVisits}</p>
              <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 mt-0.5">Active</p>
            </div>
            <MiniArcGauge
              percent={inCabinVisits > 0 ? 100 : 20}
              color="#f43f5e"
            />
          </div>

          {/* Completed */}
          <div className="bg-white/90 dark:bg-slate-800/90 rounded-2xl p-3.5 border border-slate-100 dark:border-slate-700/60 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider">Completed</p>
              <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-0.5">{completedVisits}</p>
              <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 mt-0.5">Prescribed</p>
            </div>
            <MiniArcGauge
              percent={completionPercent}
              color="#8b5cf6"
            />
          </div>

          {/* Total Today */}
          <div className="bg-white/90 dark:bg-slate-800/90 rounded-2xl p-3.5 border border-slate-100 dark:border-slate-700/60 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider">Registered</p>
              <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-0.5">{todayVisits}</p>
              <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 mt-0.5">Total Visits</p>
            </div>
            <MiniArcGauge
              percent={todayVisits > 0 ? 80 : 25}
              color="#10b981"
            />
          </div>
        </div>

        {/* Floating Quick Entry Button (Bottom Right) */}
        <button
          onClick={() => navigate('../nurse')}
          className="absolute -bottom-3 right-5 sm:right-6 flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-primary to-purple-600 text-white font-bold text-xs shadow-lg shadow-primary/30 hover:scale-105 active:scale-95 transition-all"
        >
          <UserPlus className="w-4 h-4" />
          <span>New Patient</span>
        </button>
          </>
        )}
      </motion.div>

      {/* ── Compact Core Operations ── */}
      <div className="pt-2 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Quick Actions</h3>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {visibleOps.map((op) => (
            <Link
              key={op.label}
              to={op.path}
              className="flex flex-col p-4 rounded-2xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-md border border-white/80 dark:border-slate-800/60 hover:border-primary/40 shadow-xs hover:shadow-md transition-all active:scale-95 group"
            >
              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mb-3 transition-transform group-hover:scale-110", op.color)}>
                <op.icon className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-slate-900 dark:text-white text-sm group-hover:text-primary transition-colors">
                {op.label}
              </h4>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 font-medium line-clamp-1">
                {op.desc}
              </p>
            </Link>
          ))}
        </div>
      </div>

      {/* ── Recently Completed Patients (Compact) ── */}
      {completedList.length > 0 && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Recently Consulted</h3>
            <span className="text-[11px] font-bold text-primary">{completedList.length} Finished</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {completedList.map((visit: any) => (
              <div
                key={visit.id}
                role="button"
                tabIndex={0}
                onClick={() => handleOpenPatient(visit.patients || { id: visit.patient_id })}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleOpenPatient(visit.patients || { id: visit.patient_id }); }}
                className="flex items-center justify-between p-3 rounded-2xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-md border border-white/80 dark:border-slate-800/60 shadow-xs cursor-pointer hover:border-primary/40 hover:shadow-md hover:scale-[1.01] active:scale-[0.99] transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary font-black text-xs flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors">
                    #{visit.token_number}
                  </div>
                  <div>
                    <h5 className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm group-hover:text-primary transition-colors">
                      {(visit.patients?.title ? visit.patients.title + ' ' : '') + (visit.patients?.name || 'Patient')}
                    </h5>
                    <p className="text-[10px] text-slate-400 font-medium">Consultation Finished · Click to view/edit</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-primary opacity-0 group-hover:opacity-100 transition-opacity hidden sm:flex items-center gap-0.5">
                    Details <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Patient Detail Dialog ── */}
      <Dialog open={!!selectedPatient} onOpenChange={open => !open && setSelectedPatient(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between pr-8">
              <DialogTitle className="text-xl font-bold font-heading truncate">
                {(selectedPatient?.title ? selectedPatient.title + ' ' : '') + (selectedPatient?.name || 'Patient')}
              </DialogTitle>
              <Button size="sm" variant="outline" onClick={() => setEditing(!editing)} className="h-8 gap-1.5 shrink-0 ml-3">
                <Edit className="w-3.5 h-3.5" />
                {editing ? 'Cancel' : 'Edit Details'}
              </Button>
            </div>
          </DialogHeader>

          {editing ? (
            <div className="space-y-3 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 grid grid-cols-4 gap-3">
                  <div className="col-span-1">
                    <Label className="text-xs font-semibold">Title</Label>
                    <Select value={editForm.title} onValueChange={v => setEditForm(f => ({ ...f, title: v }))}>
                      <SelectTrigger className="border-border bg-card focus:ring-primary/10"><SelectValue placeholder="Title" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Mr.">Mr.</SelectItem>
                        <SelectItem value="Mast.">Mast.</SelectItem>
                        <SelectItem value="Miss">Miss</SelectItem>
                        <SelectItem value="Mrs.">Mrs.</SelectItem>
                        <SelectItem value="Baby">Baby</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-3">
                    <Label className="text-xs font-semibold text-muted-foreground">Name</Label>
                    <Input 
                      ref={editNameRef}
                      className="border-border bg-card focus:ring-primary/10" 
                      value={editForm.name} 
                      onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} 
                      onKeyDown={e => handleEditKeyDown(e, editAgeRef)}
                    />
                  </div>
                </div>
                <div className="col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs font-semibold">Age</Label>
                    <div className="flex gap-2">
                      <Input 
                        ref={editAgeRef}
                        type="number" 
                        step="0.1"
                        value={editForm.age} 
                        onChange={e => {
                          const val = parseFloat(e.target.value);
                          if (val > 1000) return;
                          setEditForm(f => ({ ...f, age: e.target.value }));
                        }} 
                        onKeyDown={e => handleEditKeyDown(e, editPhoneRef)}
                        className="flex-1"
                      />
                      <Select value={editForm.ageUnit} onValueChange={v => setEditForm(f => ({ ...f, ageUnit: v }))}>
                        <SelectTrigger className="w-[80px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="years">Yrs</SelectItem>
                          <SelectItem value="months">Mnt</SelectItem>
                          <SelectItem value="days">Day</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs font-semibold">Gender</Label>
                    <Select value={editForm.sex} onValueChange={v => setEditForm(f => ({ ...f, sex: v }))}>
                      <SelectTrigger className="border-border bg-card"><SelectValue placeholder="Gender" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Male">Male</SelectItem>
                        <SelectItem value="Female">Female</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground">Phone</Label>
                    <Input 
                      ref={editPhoneRef}
                      className="border-border bg-card focus:ring-primary/10"
                      value={editForm.phone} 
                      onChange={e => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                        setEditForm(f => ({ ...f, phone: val }));
                      }} 
                      onKeyDown={e => handleEditKeyDown(e, editAddressRef)}
                    />
                  </div>
                </div>
                <div className="col-span-2">
                  <Label className="text-xs font-semibold text-muted-foreground">Address</Label>
                  <Input 
                    ref={editAddressRef}
                    className="border-border bg-card focus:ring-primary/10" 
                    value={editForm.address} 
                    onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))} 
                    onKeyDown={e => handleEditKeyDown(e)}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
                <Button size="sm" onClick={savePatientEdit}>Save Changes</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4 pt-1">
              <div className="grid grid-cols-2 gap-2 text-sm p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/50">
                <div><span className="text-muted-foreground font-medium">Title:</span> {selectedPatient?.title || '—'}</div>
                <div><span className="text-muted-foreground font-medium">Age:</span> {formatAge(selectedPatient)}</div>
                <div><span className="text-muted-foreground font-medium">Sex:</span> {selectedPatient?.sex || '—'}</div>
                <div><span className="text-muted-foreground font-medium">Phone:</span> {selectedPatient?.phone || '—'}</div>
                <div className="col-span-2"><span className="text-muted-foreground font-medium">Address:</span> {selectedPatient?.address || '—'}</div>
              </div>

              <div className="flex items-center justify-between mt-4">
                <h3 className="font-heading font-bold text-sm">Visit History ({patientVisits.length})</h3>
                <Button 
                  size="sm" 
                  onClick={() => setAddVisitOpen(true)}
                  className="gap-1.5 font-bold shadow-sm bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <Plus className="w-4 h-4" /> Add Visit
                </Button>
              </div>

              <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
                {patientVisits.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">No visits recorded yet</p>
                ) : (
                  patientVisits.map(v => (
                    <Card key={v.id} className="border-border/60 shadow-xs">
                      <CardContent className="p-3">
                        <div className="flex justify-between items-start text-xs">
                          <div>
                            <span className="font-bold text-foreground">{new Date(v.created_at).toLocaleDateString()}</span>
                            <span className="text-primary font-bold ml-2">Token #{v.token_number}</span>
                            <span className={cn(
                              "ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase",
                              v.status === 'completed' ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400" :
                              v.status === 'in_consultation' ? "bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-400" :
                              "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400"
                            )}>
                              {v.status || 'waiting'}
                            </span>
                          </div>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="h-7 text-xs text-primary hover:text-primary hover:bg-primary/5 px-2"
                            onClick={() => handleViewPrescription(v)}
                          >
                            <Eye className="w-3.5 h-3.5 mr-1" />
                            Prescription
                          </Button>
                        </div>
                        {v.diagnosis && <p className="text-xs text-slate-600 dark:text-slate-300 mt-1.5 font-medium">Dx: {v.diagnosis}</p>}
                        <div className="grid grid-cols-3 gap-2 mt-1.5 text-[11px] text-muted-foreground">
                          {v.weight && <span>Wt: {v.weight}kg</span>}
                          {v.blood_pressure && <span>BP: {v.blood_pressure}</span>}
                          {v.pulse_rate && <span>PR: {v.pulse_rate}bpm</span>}
                          {v.spo2 && <span>SpO2: {v.spo2}%</span>}
                          {v.temperature && <span>Temp: {v.temperature}°F</span>}
                          {v.cbg && <span>CBG: {v.cbg}</span>}
                        </div>
                        {Array.isArray(v.prescriptions) && v.prescriptions.map((rx: any) => (
                          <div key={rx.id} className="mt-2 p-2 rounded bg-muted/60 text-xs">
                            {Array.isArray(rx.medicines) && rx.medicines.map((m: any, i: number) => (
                              <div key={i} className="text-slate-600 dark:text-slate-300">{m.name} — {m.dosage} — {m.frequency} — {m.duration}</div>
                            ))}
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Add Visit Dialog (New Token) ── */}
      <Dialog open={addVisitOpen} onOpenChange={open => { if (!submittingVisit) setAddVisitOpen(open); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader className="pr-8">
            <DialogTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              <span>Add Visit — {selectedPatient?.title ? selectedPatient.title + ' ' : ''}{selectedPatient?.name}</span>
            </DialogTitle>
            <DialogDescription>
              Record patient vitals and generate a queue token for today's visit.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="p-3 rounded-lg bg-muted/60 border border-border flex items-center justify-between text-xs">
              <div>
                <span className="font-bold text-foreground">{formatAge(selectedPatient)}</span>
                <span className="text-muted-foreground ml-1.5">· {selectedPatient?.sex}</span>
                {selectedPatient?.phone && <span className="text-muted-foreground ml-1.5">· {selectedPatient.phone}</span>}
              </div>
              {selectedPatient?.registration_id && (
                <span className="font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded text-[10px]">
                  {selectedPatient.registration_id}
                </span>
              )}
            </div>

            <div>
              <Label className="text-xs font-semibold text-muted-foreground">Assign Doctor</Label>
              <Select value={addVisitDoctorId} onValueChange={setAddVisitDoctorId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select doctor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General Queue (Any Doctor)</SelectItem>
                  {doctorOptions.map((doc: any) => (
                    <SelectItem key={doc.assignId} value={doc.assignId}>
                      {doc.full_name || doc.email} ({doc.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground">Vitals (Optional)</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                <div>
                  <Label className="text-[11px] text-muted-foreground">Weight (kg)</Label>
                  <Input 
                    ref={weightRef}
                    type="number"
                    step="0.1"
                    placeholder="e.g. 65"
                    value={addVisitVitals.weight}
                    onChange={e => setAddVisitVitals(v => ({ ...v, weight: e.target.value }))}
                    onKeyDown={e => handleVitalsKeyDown(e, bpRef)}
                    className="h-9 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground">BP (mmHg)</Label>
                  <Input 
                    ref={bpRef}
                    placeholder="120/80"
                    value={addVisitVitals.blood_pressure}
                    onChange={e => setAddVisitVitals(v => ({ ...v, blood_pressure: e.target.value }))}
                    onKeyDown={e => handleVitalsKeyDown(e, pulseRef)}
                    className="h-9 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground">Pulse (bpm)</Label>
                  <Input 
                    ref={pulseRef}
                    type="number"
                    placeholder="e.g. 72"
                    value={addVisitVitals.pulse_rate}
                    onChange={e => setAddVisitVitals(v => ({ ...v, pulse_rate: e.target.value }))}
                    onKeyDown={e => handleVitalsKeyDown(e, spo2Ref)}
                    className="h-9 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground">SpO2 (%)</Label>
                  <Input 
                    ref={spo2Ref}
                    type="number"
                    placeholder="e.g. 98"
                    value={addVisitVitals.spo2}
                    onChange={e => setAddVisitVitals(v => ({ ...v, spo2: e.target.value }))}
                    onKeyDown={e => handleVitalsKeyDown(e, tempRef)}
                    className="h-9 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground">Temp (°F)</Label>
                  <Input 
                    ref={tempRef}
                    type="number"
                    step="0.1"
                    placeholder="98.6"
                    value={addVisitVitals.temperature}
                    onChange={e => setAddVisitVitals(v => ({ ...v, temperature: e.target.value }))}
                    onKeyDown={e => handleVitalsKeyDown(e, cbgRef)}
                    className="h-9 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground">CBG (mg/dL)</Label>
                  <Input 
                    ref={cbgRef}
                    type="number"
                    placeholder="e.g. 110"
                    value={addVisitVitals.cbg}
                    onChange={e => setAddVisitVitals(v => ({ ...v, cbg: e.target.value }))}
                    onKeyDown={e => handleVitalsKeyDown(e)}
                    className="h-9 text-sm"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3">
              <Button 
                variant="outline" 
                onClick={() => setAddVisitOpen(false)} 
                disabled={submittingVisit}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleAddVisit} 
                disabled={submittingVisit}
                className="gap-2 font-bold"
              >
                {submittingVisit ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating Token...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Generate Token & Add
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Prescription Preview Dialog ── */}
      <Dialog open={!!viewingRx} onOpenChange={open => !open && setViewingRx(null)}>
        <DialogContent className="max-w-[800px] p-0 overflow-hidden bg-muted">
          <div className="bg-card p-4 pr-12 border-b border-border flex items-center justify-between sticky top-0 z-20">
            <h3 className="font-bold text-foreground">Prescription History</h3>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={() => printPrescription('.print-container')} className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
                <Printer className="w-4 h-4" /> <span className="hidden sm:inline">Print</span>
              </Button>
              <Button size="sm" variant="outline" onClick={() => setViewingRx(null)} className="gap-1 border-muted-foreground/20 text-muted-foreground hover:bg-red-50 hover:text-red-600 hover:border-red-200">
                <span className="hidden sm:inline">Close</span>
              </Button>
            </div>
          </div>
          <div className="p-4 md:p-8 overflow-y-auto max-h-[85vh] scrollbar-thin scrollbar-thumb-muted-foreground/20 min-h-[500px]">
            {viewingRx && (
              <div className="relative min-h-[400px]">
                {loadingRx ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/50 z-50">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : (
                  <PrescriptionTemplate
                    patient={selectedPatient}
                    visit={viewingRx}
                    handwrittenImage={currentRx?.advice_image}
                    clinicalNotes={currentRx?.clinical_notes}
                    diagnosis={currentRx?.diagnosis || viewingRx.diagnosis}
                    medicines={currentRx?.medicines}
                    advice={currentRx?.advice_image} 
                    isWritingMode={currentRx?.is_writing_mode ?? (!!currentRx?.advice_image && String(currentRx.advice_image).startsWith('data:image'))}
                    doctorId={currentRx?.doctor_id || viewingRx.assigned_doctor_id}
                    prescriptionCreatedAt={currentRx?.created_at}
                  />
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}