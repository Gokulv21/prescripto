import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { cn, formatAge } from '@/lib/utils';
import { 
  Plus, History, Stethoscope, User, Users, Trash2, Printer, 
  Phone, Pencil, ArrowLeft, Activity, Scale, Wind, 
  Thermometer, Droplet, MessageCircle, X, HeartPulse, Loader2, Info, GripVertical,
  ShieldCheck, Clock
} from 'lucide-react';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import DigitalPrescription from '@/components/DigitalPrescription';
import PrescriptionTemplate from '@/components/PrescriptionTemplate';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { printPrescription } from '@/lib/printPrescription';
import PageBanner from '@/components/PageBanner';
import consultationImg from '@/assets/Consultation.png';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { useConsultation } from '@/hooks/useConsultation';
import QueuePanel from '@/components/consultation/QueuePanel';
import HistoryViewer from '@/components/consultation/HistoryViewer';
import ConsultationForm from '@/components/consultation/ConsultationForm';
import type { Clinic } from '@/types/clinic';

export default function DoctorConsultation() {
  const queryClient = useQueryClient();
  const { user, hasRole, profile } = useAuth();
  const { slug } = useParams();
  const navigate = useNavigate();
  const { clinic } = useOutletContext<{ clinic: Clinic }>();

  // 1. Hook Extraction
  const {
    queue,
    isLoadingQueue,
    refetchQueue,
    selectedVisit,
    setSelectedVisit,
    selectVisit,
    patient,
    history,
    setHistory,
    diagnosis,
    setDiagnosis,
    diagnoses,
    setDiagnoses,
    clinicalNotes,
    setClinicalNotes,
    medicines,
    setMedicines,
    advice,
    setAdvice,
    saving,
    prescriptionImage,
    setPrescriptionImage,
    prescriptionPaths,
    setPrescriptionPaths,
    isWritingMode,
    setIsWritingMode,
    lastInputWay,
    setLastInputWay,
    saveError,
    protocols,
    diagnosisHistory,
    isDraftRestored,
    syncStatus,
    savePrescription,
    markAsNoShow,
    fetchDiagnosisHistory,
    addMedicine,
    removeMedicine,
    updateMedicine,
    handleMedicineKeyDown,
    addDiagnosisTag,
    removeDiagnosisTag,
    applyProtocol,
    handleCallPatient,
    myProfile,
  } = useConsultation(clinic);

  // Vitals Edit Modal State
  const [showVitalsEdit, setShowVitalsEdit] = useState(false);
  const [vitalsWeight, setVitalsWeight] = useState('');
  const [vitalsBP, setVitalsBP] = useState('');
  const [vitalsPulse, setVitalsPulse] = useState('');
  const [vitalsSpO2, setVitalsSpO2] = useState('');
  const [vitalsTemp, setVitalsTemp] = useState('');
  const [vitalsCBG, setVitalsCBG] = useState('');

  // Overlays / Preview States
  const [showDigitalRx, setShowDigitalRx] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [viewingHistoryRx, setViewingHistoryRx] = useState<any>(null);
  const [loadingHistoryRx, setLoadingHistoryRx] = useState(false);
  const [currentHistoryRx, setCurrentHistoryRx] = useState<any>(null);
  const [printOnStationery, setPrintOnStationery] = useState(false);



  // Initialize Vitals Edit values when modal opens
  useEffect(() => {
    if (selectedVisit && showVitalsEdit) {
      setVitalsWeight(selectedVisit.weight || '');
      setVitalsBP(selectedVisit.blood_pressure || '');
      setVitalsPulse(selectedVisit.pulse_rate || '');
      setVitalsSpO2(selectedVisit.spo2 || '');
      setVitalsTemp(selectedVisit.temperature || '');
      setVitalsCBG(selectedVisit.cbg || '');
    }
  }, [selectedVisit, showVitalsEdit]);

  // Keyboard shortcuts: Ctrl+S = Save, Ctrl+P = Print Preview / Print
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        if (selectedVisit && !saving) savePrescription();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        if (selectedVisit) {
          if (showPreview) {
            printPrescription('#consultation-print-preview');
          } else {
            setShowPreview(true);
          }
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedVisit, saving, savePrescription, showPreview]);

  // Dynamic page title
  useEffect(() => {
    document.title = `Consultation${clinic?.name ? ` — ${clinic.name}` : ''} | Prescripto`;
    return () => { document.title = 'Prescripto'; };
  }, [clinic?.name]);



  // Mandatory Credentials Validation
  const activeDocName = (myProfile?.full_name || profile?.full_name || user?.user_metadata?.full_name || '').trim();
  const activeDocReg = (myProfile?.registration_id || (profile as any)?.registration_id || '').trim();
  const activeDocQual = (myProfile?.qualifications || (profile as any)?.qualifications || '').trim();
  const activeClinicName = (clinic?.name || myProfile?.clinic_name || (profile as any)?.clinic_name || '').trim();
  const cachedClinicAddress = clinic?.id ? (localStorage.getItem(`prescripto_clinic_address_${clinic.id}`) || '') : '';
  const activeClinicAddress = (
    clinic?.address ||
    myProfile?.clinic_address ||
    (profile as any)?.clinic_address ||
    cachedClinicAddress ||
    ''
  ).trim();
  const cachedClinicPhone = clinic?.id ? (localStorage.getItem(`prescripto_clinic_phone_${clinic.id}`) || '') : '';
  const activeClinicPhone = (
    clinic?.phone ||
    myProfile?.clinic_phone ||
    (profile as any)?.clinic_phone ||
    cachedClinicPhone ||
    ''
  ).trim();

  // Guard against false blocking while initial profile or clinic is still resolving
  const isProfileLoading = !profile && !myProfile;
  const isClinicLoading = !clinic;
  const isClinicNameMissing = !isProfileLoading && !isClinicLoading && !activeClinicName;
  const isClinicAddressMissing = !isProfileLoading && !isClinicLoading && !activeClinicAddress;
  const isDoctorNameMissing = !isProfileLoading && !activeDocName;
  const isDoctorRegMissing = !isProfileLoading && !activeDocReg;

  const isConsultationBlocked = !isProfileLoading && !isClinicLoading && (isClinicNameMissing || isClinicAddressMissing || isDoctorNameMissing || isDoctorRegMissing);

  const [setupPromptOpen, setSetupPromptOpen] = useState(false);
  const [missingFieldsList, setMissingFieldsList] = useState<string[]>([]);

  // Show setup guidance popup on mount if profile details are incomplete
  useEffect(() => {
    if (!isProfileLoading && !isClinicLoading) {
      const missing: string[] = [];
      if (isClinicNameMissing) missing.push("Clinic Name");
      if (isClinicAddressMissing) missing.push("Clinic Address");
      if (isDoctorNameMissing) missing.push("Doctor Name");
      if (isDoctorRegMissing) missing.push("Doctor Medical Registration ID");

      if (missing.length > 0) {
        setMissingFieldsList(missing);
        setSetupPromptOpen(true);
      } else {
        setSetupPromptOpen(false);
      }
    }
  }, [isProfileLoading, isClinicLoading, isClinicNameMissing, isClinicAddressMissing, isDoctorNameMissing, isDoctorRegMissing]);

  const handleSelectVisit = (v: any) => {
    if (isConsultationBlocked) {
      setSetupPromptOpen(true);
      return;
    }
    selectVisit(v, true);
  };

  const handlePrescriptionSave = (data: string | string[] | null, pages: any[][]) => {
    setPrescriptionImage(Array.isArray(data) ? JSON.stringify(data) : data);
    setPrescriptionPaths(pages as any);
    setShowDigitalRx(false);
    setIsWritingMode(true);
    setLastInputWay('writing');
    setAdvice('');
  };

  const shareToWhatsApp = (visitData: any, patientData: any) => {
    if (!visitData || !patientData) return;
    const patientPhone = patientData.phone || '';
    let cleanPhone = patientPhone.replace(/\D/g, '');
    if (cleanPhone.length === 10) cleanPhone = '91' + cleanPhone;

    const patientName = (patientData.title ? patientData.title + ' ' : '') + (patientData.name ?? 'Patient');
    const resolvedDoctorName = activeDocName || user?.user_metadata?.full_name || 'Doctor';
    const resolvedClinicName = activeClinicName || 'Clinic';
    const publicLink = `${window.location.origin}/prescripto/rx/${visitData.id}`;

    const message = `Hello ${patientName},  

Your prescription 📝 from ${resolvedDoctorName} (${resolvedClinicName}) is ready.  
Access it here:  👇
 
🔗 ${publicLink}  

Wishing you a quick recovery!  

— ${resolvedClinicName}`;

    window.open(`https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`, '_blank');
  };

  const getVitalsTrendData = (key: string): number[] => {
    if (!history || history.length === 0) return [];
    
    const sortedHistory = [...history].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    
    const allVisits = [...sortedHistory];
    if (selectedVisit && !allVisits.some(v => v.id === selectedVisit.id)) {
      allVisits.push(selectedVisit);
    }
    
    const values: number[] = [];
    allVisits.forEach(v => {
      let val: number | null = null;
      if (key === 'blood_pressure') {
        if (v.blood_pressure) {
          const sys = parseInt(v.blood_pressure.split('/')[0]);
          if (!isNaN(sys)) val = sys;
        }
      } else {
        const num = parseFloat(v[key]);
        if (!isNaN(num) && num > 0) val = num;
      }
      if (val !== null) {
        values.push(val);
      }
    });
    return values;
  };

  const renderSparkline = (key: string, strokeColorClass: string) => {
    // Guard: don't render sparklines from a previous patient's history
    if (history.length > 0 && history[0]?.patient_id !== selectedVisit?.patient_id) return null;
    const trend = getVitalsTrendData(key);
    if (trend.length < 2) return null;

    const width = 45;
    const height = 14;
    const padding = 2;

    const min = Math.min(...trend);
    const max = Math.max(...trend);
    const range = max - min === 0 ? 1 : max - min;

    const points = trend.map((val, idx) => {
      const x = padding + (idx / (trend.length - 1)) * (width - padding * 2);
      const y = padding + (1 - (val - min) / range) * (height - padding * 2);
      return { x, y };
    });

    let pathD = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      pathD += ` L ${points[i].x} ${points[i].y}`;
    }

    const lastPoint = points[points.length - 1];

    return (
      <div className="flex items-center justify-center w-full mt-1.5 opacity-80" title={`Historical trend (Min: ${min}, Max: ${max})`}>
        <svg width={width} height={height} className={strokeColorClass}>
          <path
            d={pathD}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle
            cx={lastPoint.x}
            cy={lastPoint.y}
            r="1.5"
            fill="currentColor"
          />
        </svg>
      </div>
    );
  };

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-64px)] md:h-[calc(100vh-0px)] overflow-hidden bg-slate-50 dark:bg-slate-950">
      
      {/* ── Token Switcher Rail (Shows when patient is active) ── */}
      {selectedVisit && (
        <div className="hidden md:flex w-20 border-r border-border flex-col items-center py-6 gap-6 bg-muted/20 shrink-0">
          <div className="w-12 h-12 rounded-2xl bg-blue-600/10 flex items-center justify-center mb-2 shadow-inner border border-blue-600/5">
            <Users className="w-6 h-6 text-blue-600" />
          </div>
          <div className="flex-1 flex flex-col gap-4 overflow-y-auto no-scrollbar pb-24 px-2">
            {queue.map(v => (
              <Button
                key={v.id}
                variant={selectedVisit.id === v.id ? "default" : "ghost"}
                size="icon"
                onClick={() => handleSelectVisit(v)}
                className={cn(
                  "w-12 h-12 rounded-2xl font-black text-sm transition-all",
                  selectedVisit.id === v.id 
                    ? "bg-blue-600 text-white shadow-lg scale-110" 
                    : "text-muted-foreground hover:bg-white hover:text-blue-600 border border-transparent hover:border-blue-200"
                )}
              >
                {v.token_number}
              </Button>
            ))}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSelectedVisit(null)}
            className="w-12 h-12 rounded-2xl text-muted-foreground hover:text-red-500 hover:bg-red-50"
            title="Exit Consultation"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>
      )}

      {/* ── Queue Panel (Left Sidebar) ── */}
      <div className={cn("w-full md:w-80 border-r border-border shrink-0 h-full", selectedVisit ? "hidden" : "block")}>
        <QueuePanel
          queue={queue}
          isLoadingQueue={isLoadingQueue}
          refetchQueue={refetchQueue}
          selectedVisit={selectedVisit}
          selectVisit={handleSelectVisit}
          onCallPatient={handleCallPatient}
          onRemoveVisit={(v) => markAsNoShow(v)}
        />
      </div>

      {/* ── Active Consultation Area ── */}
      <div className={cn("flex-1 overflow-auto bg-muted/10 h-full", !selectedVisit ? "hidden md:block" : "block")}>
        {isConsultationBlocked ? (
          <div className="flex items-center justify-center h-full p-4 sm:p-6">
            <div className="max-w-xl w-full bg-card border-2 border-amber-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 text-center backdrop-blur-md">
              <div className="w-16 h-16 bg-amber-500/10 text-amber-500 rounded-2xl flex items-center justify-center mx-auto border border-amber-500/20 shadow-inner">
                <ShieldCheck className="w-8 h-8 text-amber-500" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
                  Consultation Blocked: Mandatory Identity Incomplete
                </h2>
                <p className="text-xs sm:text-sm text-muted-foreground font-medium">
                  By medical regulations, a doctor cannot start consultation or issue prescriptions in this clinic ID until all 4 core identity fields are completed.
                </p>
              </div>

              <div className="bg-muted/50 rounded-2xl p-4 sm:p-5 text-left space-y-3 border border-border/60 text-xs sm:text-sm font-semibold">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">1. Clinic Name:</span>
                  {activeClinicName ? <span className="text-emerald-600 dark:text-emerald-400 font-bold">✓ {activeClinicName}</span> : <span className="text-red-500 font-bold">✗ Incomplete</span>}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">2. Clinic Address:</span>
                  {activeClinicAddress ? <span className="text-emerald-600 dark:text-emerald-400 font-bold">✓ {activeClinicAddress}</span> : <span className="text-red-500 font-bold">✗ Incomplete</span>}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">3. Doctor Full Name:</span>
                  {activeDocName ? <span className="text-emerald-600 dark:text-emerald-400 font-bold">✓ Dr. {activeDocName}</span> : <span className="text-red-500 font-bold">✗ Incomplete</span>}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">4. Medical Reg. No:</span>
                  {activeDocReg ? <span className="text-emerald-600 dark:text-emerald-400 font-bold">✓ Reg. {activeDocReg}</span> : <span className="text-red-500 font-bold">✗ Incomplete</span>}
                </div>
              </div>

              <Button 
                onClick={() => navigate(slug ? `/${slug}/profile` : '/profile')}
                className="w-full py-6 rounded-2xl font-black text-sm bg-blue-600 hover:bg-blue-700 text-white shadow-xl shadow-blue-500/20 gap-2"
              >
                Complete Clinic & Doctor Profile Now
              </Button>
            </div>
          </div>
        ) : !selectedVisit ? (
          <div className="flex items-center justify-center h-full text-muted-foreground p-6 sm:p-10">
            {queue.length === 0 ? (
              <motion.div
                initial={{ scale: 0.6, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 350, damping: 22 }}
                className="text-center space-y-5 max-w-md mx-auto"
              >
                <div className="flex justify-center">
                  <img 
                    src={consultationImg} 
                    alt="Doctor Consultation" 
                    className="w-full max-w-[260px] sm:max-w-xs md:max-w-sm h-auto object-contain drop-shadow-sm select-none pointer-events-none" 
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 text-[11px] font-black uppercase tracking-wider border border-emerald-200 dark:border-emerald-800">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    Queue is Clear
                  </div>
                  <h3 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">
                    Boom! All Caught Up
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-400 font-medium leading-relaxed max-w-sm mx-auto">
                    No patients currently waiting in consultation queue. When reception admits a patient, their token will instantly appear on your left queue.
                  </p>
                </div>
              </motion.div>
            ) : (
              <div className="text-center space-y-4 max-w-sm mx-auto">
                <div className="flex justify-center">
                  <img 
                    src={consultationImg} 
                    alt="Doctor Consultation" 
                    className="w-full max-w-[240px] sm:max-w-[280px] h-auto opacity-90 object-contain drop-shadow-sm select-none pointer-events-none" 
                  />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 tracking-tight">
                    Select a Patient to Begin
                  </h3>
                  <p className="text-xs text-slate-400 font-medium leading-relaxed">
                    <b>{queue.length}</b> patient(s) waiting in your clinic queue. Tap any token on the left queue panel to open their clinical charting pad.
                  </p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6 animate-in fade-in slide-in-from-bottom-6 duration-300 pb-40">
            
            {/* Patient Header Card */}
            <Card className="border-none shadow-sm bg-card rounded-2xl">
              <CardHeader className="pb-3 px-4 sm:px-6">
                <CardTitle className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 flex-wrap sm:flex-nowrap">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => setSelectedVisit(null)} 
                      className="h-9 w-9 sm:h-10 sm:w-10 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-all active:scale-90 shrink-0"
                      title="Back to Queue"
                    >
                      <ArrowLeft className="w-5 h-5 sm:w-6 sm:h-6 text-slate-600 dark:text-slate-400" />
                    </Button>
                    <div className="p-2 bg-blue-50 dark:bg-blue-500/10 rounded-lg shrink-0">
                      <User className="w-5 h-5 text-blue-600" />
                    </div>
                    <span className="text-lg sm:text-xl font-extrabold tracking-tight text-foreground truncate max-w-full">
                      {(patient?.title ? patient.title + ' ' : '') + patient?.name}
                    </span>
                    {isDraftRestored && (
                      <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800/50 flex items-center gap-1.5 animate-pulse h-6 shrink-0">
                        <History className="w-3 h-3" />
                        <span className="text-[10px] font-bold uppercase tracking-wider">Draft Restored</span>
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0 flex-wrap justify-between sm:justify-end">
                    <Button variant="ghost" size="sm" onClick={markAsNoShow} disabled={saving} className="h-8 px-2 text-red-500 hover:text-red-700 hover:bg-red-50 gap-1 rounded-lg">
                      <Trash2 className="w-3.5 h-3.5" />
                      <span className="text-[11px] font-bold">No Show / Remove</span>
                    </Button>
                    <Badge variant="outline" className="text-[10px] font-bold px-2 py-0.5 border-slate-200">
                      TOKEN #{selectedVisit.token_number}
                    </Badge>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 sm:px-6 pb-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 text-sm">
                  <div className="bg-muted/30 p-3 rounded-xl border border-border min-w-0">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Age / Sex</p>
                    <p className="text-base font-bold text-foreground truncate">{formatAge(patient)}/{patient?.sex?.charAt(0) ?? '—'}</p>
                  </div>
                  <div className="bg-muted/30 p-3 rounded-xl border border-border min-w-0">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Phone</p>
                    <p className="text-base font-bold text-foreground truncate">{patient?.phone || '—'}</p>
                  </div>
                  <div className="bg-muted/30 p-3 rounded-xl border border-border min-w-0">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Entry Time</p>
                    <p className="text-base font-bold text-foreground truncate" title={selectedVisit.created_at ? new Date(selectedVisit.created_at).toLocaleString() : ''}>
                      {selectedVisit.created_at
                        ? new Date(selectedVisit.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) + ' (' + new Date(selectedVisit.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) + ')'
                        : '—'}
                    </p>
                  </div>
                </div>

                {/* Vitals Section */}
                <div className="mt-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-blue-500" />
                      <h4 className="text-[11px] font-extrabold text-muted-foreground uppercase tracking-widest">Clinical Vitals</h4>
                    </div>
                    <div className="flex items-center gap-1.5 ml-2 border-l pl-2">
                      <Button variant="ghost" size="sm" onClick={() => setShowVitalsEdit(true)} className="h-8 px-2 text-blue-600 hover:bg-blue-50 gap-1 rounded-lg">
                        <Pencil className="w-3.5 h-3.5" />
                        <span className="text-[11px] font-bold">Edit Vitals</span>
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3">
                    {[
                      { label: 'Weight', value: selectedVisit.weight, unit: 'kg', icon: Scale, color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-500/10', dbKey: 'weight' },
                      { label: 'BP', value: selectedVisit.blood_pressure, unit: 'mmHg', icon: HeartPulse, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-500/10', dbKey: 'blood_pressure' },
                      { label: 'Pulse', value: selectedVisit.pulse_rate, unit: 'bpm', icon: Activity, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-500/10', dbKey: 'pulse_rate' },
                      { label: 'SpO2', value: selectedVisit.spo2, unit: '%', icon: Wind, color: 'text-sky-500', bg: 'bg-sky-50 dark:bg-sky-500/10', dbKey: 'spo2' },
                      { label: 'Temp', value: selectedVisit.temperature, unit: '°F', icon: Thermometer, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-500/10', dbKey: 'temperature' },
                      { label: 'CBG', value: selectedVisit.cbg, unit: 'mg/dL', icon: Droplet, color: 'text-rose-500', bg: 'bg-rose-50 dark:bg-rose-500/10', dbKey: 'cbg' },
                    ].map(v => (
                      <div key={v.label} className="text-center p-2.5 sm:p-3 rounded-2xl bg-card border border-border shadow-sm flex flex-col items-center gap-1 sm:gap-1.5 hover:border-blue-500/30 transition-all min-w-0 overflow-hidden">
                        <div className={cn("p-1.5 sm:p-2 rounded-xl", v.bg)}>
                          <v.icon className={cn("w-3.5 h-3.5 sm:w-4 sm:h-4", v.color)} />
                        </div>
                        <p className="text-[10px] font-extrabold text-muted-foreground uppercase truncate w-full">{v.label}</p>
                        <p className="font-extrabold text-xs sm:text-sm text-foreground leading-tight text-center break-words w-full">
                          {v.value ?? '—'}<span className="text-[10px] font-medium ml-0.5 opacity-60">{v.value ? ` ${v.unit}` : ''}</span>
                        </p>
                        {renderSparkline(v.dbKey, v.color)}
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Visit History Sub-component */}
            <HistoryViewer
              history={history}
              onViewRx={async (h) => {
                setViewingHistoryRx(h);
                setLoadingHistoryRx(true);
                setCurrentHistoryRx(null);
                try {
                  if (Array.isArray(h.prescriptions) && h.prescriptions.length > 0) {
                    setCurrentHistoryRx(h.prescriptions[0]);
                  } else {
                    const { data } = await supabase.from('prescriptions').select('*').eq('visit_id', h.id).maybeSingle();
                    if (data) setCurrentHistoryRx(data);
                  }
                } finally {
                  setLoadingHistoryRx(false);
                }
              }}
            />

            {/* Consultation Main Form Sub-component */}
            <ConsultationForm
              selectedVisit={selectedVisit}
              patient={patient}
              diagnosis={diagnosis}
              setDiagnosis={setDiagnosis}
              diagnoses={diagnoses}
              setDiagnoses={setDiagnoses}
              clinicalNotes={clinicalNotes}
              setClinicalNotes={setClinicalNotes}
              medicines={medicines}
              setMedicines={setMedicines}
              advice={advice}
              setAdvice={setAdvice}
              saving={saving}
              prescriptionImage={prescriptionImage}
              setPrescriptionImage={setPrescriptionImage}
              prescriptionPaths={prescriptionPaths}
              setPrescriptionPaths={setPrescriptionPaths}
              isWritingMode={isWritingMode}
              setIsWritingMode={setIsWritingMode}
              lastInputWay={lastInputWay}
              setLastInputWay={setLastInputWay}
              saveError={saveError}
              protocols={protocols}
              diagnosisHistory={diagnosisHistory}
              isDraftRestored={isDraftRestored}
              savePrescription={savePrescription}
              markAsNoShow={markAsNoShow}
              addMedicine={addMedicine}
              removeMedicine={removeMedicine}
              updateMedicine={updateMedicine}
              handleMedicineKeyDown={handleMedicineKeyDown}
              addDiagnosisTag={addDiagnosisTag}
              removeDiagnosisTag={removeDiagnosisTag}
              applyProtocol={applyProtocol}
              onOpenDigitalRx={() => setShowDigitalRx(true)}
              onOpenPreview={() => setShowPreview(true)}
              syncStatus={syncStatus}
            />

          </div>
        )}
      </div>

      {/* ── OVERLAYS & MODALS ── */}

      {/* 1. Digital Prescription Pen Canvas */}
      {showDigitalRx && (
        <DigitalPrescription
          patient={patient}
          visit={selectedVisit}
          initialPaths={prescriptionPaths}
          onSave={handlePrescriptionSave}
          onPathsChange={(pages) => {
            setPrescriptionPaths(pages);
            setLastInputWay('writing');
          }}
          onClose={() => setShowDigitalRx(false)}
          doctorId={user?.id}
          clinicId={clinic?.id}
          doctorName={activeDocName}
          doctorQualifications={activeDocQual}
          doctorRegId={activeDocReg}
          clinicName={activeClinicName}
          clinicAddress={activeClinicAddress}
          clinicPhone={activeClinicPhone}
        />
      )}

      {/* 2. Prescription Preview Dialogue */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-[950px] w-[96vw] h-[92vh] max-h-[94vh] p-0 flex flex-col overflow-hidden bg-slate-900 border-none shadow-2xl">
          <DialogHeader className="bg-white dark:bg-slate-900 p-3 sm:p-4 px-5 border-b border-slate-200 dark:border-slate-800 relative flex flex-row items-center justify-between shrink-0 z-20">
            <div className="flex items-center gap-2 z-10 flex-wrap">
              <Button size="sm" onClick={() => printPrescription('#consultation-print-preview .print-container')} className="gap-2 h-9 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm">
                <Printer className="w-4 h-4" /> Print PDF
              </Button>
              <Button variant="outline" size="sm" onClick={() => shareToWhatsApp(selectedVisit, patient)} className="gap-2 border-emerald-500/30 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 h-9 text-xs font-bold rounded-xl">
                <MessageCircle className="w-4 h-4" /> WhatsApp
              </Button>
              
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer select-none flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-xl shadow-xs h-9">
                <input
                  type="checkbox"
                  checked={printOnStationery}
                  onChange={(e) => setPrintOnStationery(e.target.checked)}
                  className="h-3.5 w-3.5 text-blue-600 rounded cursor-pointer"
                />
                <span className="truncate">Print on letterhead</span>
              </label>
            </div>
            <DialogTitle className="hidden sm:block absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap text-xs font-black uppercase tracking-widest text-slate-400">
              Live Prescription Preview
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-6 md:p-8 bg-slate-100 dark:bg-slate-950/80 flex justify-center items-start" id="consultation-print-preview">
            <div className="w-full max-w-[850px] bg-white shadow-xl rounded-lg">
              <PrescriptionTemplate
                 patient={patient}
                 visit={selectedVisit}
                 handwrittenImage={prescriptionImage}
                 clinicalNotes={clinicalNotes}
                 diagnosis={diagnoses.length > 0 ? diagnoses.join(' / ') : diagnosis}
                 medicines={medicines.filter(m => m.name.trim())}
                 advice={advice}
                 isWritingMode={lastInputWay === 'writing'}
                 isPrint={false}
                 hideShare={true}
                 doctorId={user?.id}
                 prescriptionCreatedAt={selectedVisit?.created_at || new Date().toISOString()}
                 doctorName={activeDocName}
                 doctorQualifications={activeDocQual}
                 doctorRegId={activeDocReg}
                 doctorSignature={(profile as any)?.signature_data}
                 clinicName={activeClinicName}
                 clinicAddress={activeClinicAddress}
                 clinicPhone={activeClinicPhone}
                 hideBranding={printOnStationery}
               />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 3. Past Visit Rx Preview Dialogue */}
      <Dialog open={!!viewingHistoryRx} onOpenChange={open => !open && setViewingHistoryRx(null)}>
        <DialogContent className="max-w-[950px] w-[96vw] h-[92vh] max-h-[94vh] p-0 flex flex-col overflow-hidden bg-slate-900 border-none shadow-2xl">
          <DialogHeader className="p-4 px-5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-row items-center justify-between shrink-0 z-20">
            <DialogTitle className="text-sm font-bold text-slate-900 dark:text-white">
              Visit Details — {viewingHistoryRx && new Date(viewingHistoryRx.created_at).toLocaleDateString()}
            </DialogTitle>
            <DialogDescription className="sr-only">Past visit prescription preview</DialogDescription>
            <div className="flex items-center gap-2 pr-6">
              <Button size="sm" onClick={() => printPrescription('#history-rx-preview .print-container')} className="gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold h-9 px-4 rounded-xl shadow-sm">
                <Printer className="w-4 h-4" /> <span>Print</span>
              </Button>
            </div>
          </DialogHeader>
          <div id="history-rx-preview" className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-6 md:p-8 bg-slate-100 dark:bg-slate-950/80 flex justify-center items-start">
            {loadingHistoryRx ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              </div>
            ) : (
              currentHistoryRx && (
                <div className="w-full max-w-[850px] bg-white shadow-xl rounded-lg">
                  <PrescriptionTemplate
                    patient={patient}
                    visit={viewingHistoryRx}
                    handwrittenImage={currentHistoryRx.advice_image}
                    clinicalNotes={currentHistoryRx.clinical_notes}
                    diagnosis={currentHistoryRx.diagnosis || viewingHistoryRx.diagnosis}
                    medicines={currentHistoryRx.medicines || []}
                    advice={currentHistoryRx.advice_image && !String(currentHistoryRx.advice_image).startsWith('data:image') && !String(currentHistoryRx.advice_image).startsWith('[') ? currentHistoryRx.advice_image : ''}
                    isWritingMode={currentHistoryRx.is_writing_mode ?? (!!currentHistoryRx.advice_image && (String(currentHistoryRx.advice_image).startsWith('data:image') || String(currentHistoryRx.advice_image).startsWith('[')))}
                    isPrint={false}
                    hideShare={true}
                    doctorId={currentHistoryRx.doctor_id || viewingHistoryRx.assigned_doctor_id}
                    prescriptionCreatedAt={viewingHistoryRx?.created_at || currentHistoryRx.created_at}
                    doctorName={currentHistoryRx.doctor_id === user?.id ? activeDocName : undefined}
                    doctorQualifications={currentHistoryRx.doctor_id === user?.id ? activeDocQual : undefined}
                    doctorRegId={currentHistoryRx.doctor_id === user?.id ? activeDocReg : undefined}
                    doctorSignature={currentHistoryRx.doctor_id === user?.id ? (profile as any)?.signature_data : undefined}
                    clinicName={activeClinicName}
                    clinicAddress={activeClinicAddress}
                    clinicPhone={activeClinicPhone}
                    hideBranding={printOnStationery}
                  />
                </div>
              )
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* 4. Vitals Edit Dialogue */}
      <Dialog open={showVitalsEdit} onOpenChange={setShowVitalsEdit}>
        <DialogContent className="max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Edit Clinical Vitals</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label>Weight (kg)</Label>
              <Input 
                type="number" 
                step="0.1"
                min="0"
                max="300"
                value={vitalsWeight} 
                onChange={e => {
                  const val = parseFloat(e.target.value);
                  if (val > 300) return;
                  setVitalsWeight(e.target.value);
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>BP (mmHg)</Label>
              <Input 
                value={vitalsBP} 
                onChange={e => {
                  if (e.target.value.length > 7) return; 
                  setVitalsBP(e.target.value);
                }}
                placeholder="120/80"
              />
            </div>
            <div className="space-y-2">
              <Label>Pulse (bpm)</Label>
              <Input 
                type="number" 
                min="0"
                max="250"
                value={vitalsPulse} 
                onChange={e => {
                  const val = parseInt(e.target.value);
                  if (val > 250) return;
                  setVitalsPulse(e.target.value);
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>SpO2 (%)</Label>
              <Input 
                type="number" 
                step="0.1"
                min="0"
                max="100"
                value={vitalsSpO2} 
                onChange={e => {
                  const val = parseFloat(e.target.value);
                  if (val > 100) return;
                  setVitalsSpO2(e.target.value);
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>Temp (°F)</Label>
              <Input 
                type="number" 
                step="0.1"
                min="90"
                max="115"
                value={vitalsTemp} 
                onChange={e => {
                  const val = parseFloat(e.target.value);
                  if (val > 115) return;
                  setVitalsTemp(e.target.value);
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>CBG (mg/dL)</Label>
              <Input 
                type="number" 
                min="0"
                max="800"
                value={vitalsCBG} 
                onChange={e => {
                  const val = parseInt(e.target.value);
                  if (val > 800) return;
                  setVitalsCBG(e.target.value);
                }}
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <Button variant="outline" onClick={() => setShowVitalsEdit(false)}>Cancel</Button>
            <Button onClick={async () => {
              try {
                const { error } = await supabase.from('visits').update({
                  weight: vitalsWeight ? parseFloat(vitalsWeight) : null,
                  blood_pressure: vitalsBP || null,
                  pulse_rate: vitalsPulse ? parseInt(vitalsPulse) : null,
                  spo2: vitalsSpO2 ? parseFloat(vitalsSpO2) : null,
                  temperature: vitalsTemp ? parseFloat(vitalsTemp) : null,
                  cbg: vitalsCBG ? parseInt(vitalsCBG) : null
                }).eq('id', selectedVisit.id);
                
                if (error) throw error;
                
                // Update queue cache local state as well
                queryClient.setQueryData(['visitQueue', clinic?.id, user?.id, profile?.id || myProfile?.id], (oldQueue: any[]) => {
                  return (oldQueue || []).map(v => v.id === selectedVisit.id ? { 
                    ...v, 
                    weight: vitalsWeight ? parseFloat(vitalsWeight) : null,
                    blood_pressure: vitalsBP || null,
                    pulse_rate: vitalsPulse ? parseInt(vitalsPulse) : null,
                    spo2: vitalsSpO2 ? parseFloat(vitalsSpO2) : null,
                    temperature: vitalsTemp ? parseFloat(vitalsTemp) : null,
                    cbg: vitalsCBG ? parseInt(vitalsCBG) : null
                  } : v);
                });

                // Update selectedVisit
                setSelectedVisit(prev => ({
                  ...prev,
                  weight: vitalsWeight ? parseFloat(vitalsWeight) : null,
                  blood_pressure: vitalsBP || null,
                  pulse_rate: vitalsPulse ? parseInt(vitalsPulse) : null,
                  spo2: vitalsSpO2 ? parseFloat(vitalsSpO2) : null,
                  temperature: vitalsTemp ? parseFloat(vitalsTemp) : null,
                  cbg: vitalsCBG ? parseInt(vitalsCBG) : null
                }));

                toast.success('Clinical vitals updated successfully');
                setShowVitalsEdit(false);
              } catch (e: any) {
                toast.error(e.message);
              }
            }}>Save Changes</Button>
          </div>
        </DialogContent>
      </Dialog>





      {/* Setup Profile Prompt Dialog for New Clinics */}
      <Dialog open={setupPromptOpen} onOpenChange={setSetupPromptOpen}>
        <DialogContent className="max-w-[480px] w-[95vw] rounded-[2rem] p-6 border-none shadow-2xl bg-card">
          <DialogHeader className="space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <DialogTitle className="text-xl font-black text-slate-900 dark:text-white">
              Complete Prescription Setup
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 leading-relaxed font-medium">
              Medical regulations require verified doctor & clinic details on every prescription before starting patient consultations.
            </DialogDescription>
          </DialogHeader>

          <div className="my-4 p-4 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/40 space-y-2">
            <p className="text-[11px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-400">
              Required to Unlock Consultation:
            </p>
            <ul className="text-xs font-semibold text-slate-700 dark:text-slate-300 space-y-1.5 list-disc list-inside">
              {missingFieldsList.map((item, idx) => (
                <li key={idx} className="text-amber-900 dark:text-amber-200">{item}</li>
              ))}
            </ul>
          </div>

          <DialogFooter className="flex gap-2.5 pt-2">
            <Button
              variant="outline"
              onClick={() => setSetupPromptOpen(false)}
              className="flex-1 rounded-xl font-bold text-xs"
            >
              Remind Later
            </Button>
            <Button
              onClick={() => {
                setSetupPromptOpen(false);
                navigate(slug ? `/${slug}/settings` : '/settings');
              }}
              className="flex-1 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-wider shadow-md shadow-blue-500/20"
            >
              Go to Settings
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}