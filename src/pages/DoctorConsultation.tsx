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
  Thermometer, Droplet, MessageCircle, X, HeartPulse, Loader2, Sparkles, Info, GripVertical,
  Move, LayoutGrid, Zap, Volume2, ShieldCheck
} from 'lucide-react';
import { motion } from 'framer-motion';
import DigitalPrescription from '@/components/DigitalPrescription';
import PrescriptionTemplate from '@/components/PrescriptionTemplate';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { printPrescription } from '@/lib/printPrescription';
import PageBanner from '@/components/PageBanner';
import consultationBanner from '@/assets/consultation_banner.png';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { useConsultation } from '@/hooks/useConsultation';
import QueuePanel from '@/components/consultation/QueuePanel';
import HistoryViewer from '@/components/consultation/HistoryViewer';
import ConsultationForm from '@/components/consultation/ConsultationForm';

export default function DoctorConsultation() {
  const queryClient = useQueryClient();
  const { user, hasRole, profile } = useAuth();
  const { slug } = useParams();
  const navigate = useNavigate();
  const { clinic } = useOutletContext<{ clinic: any }>();

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
  const [showChangelog, setShowChangelog] = useState(false);

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

  useEffect(() => {
    const acknowledged = localStorage.getItem('prescripto_version_1_4_acknowledged');
    if (!acknowledged) {
      setShowChangelog(true);
    }
  }, []);

  const handleAcknowledgeChangelog = () => {
    localStorage.setItem('prescripto_version_1_4_acknowledged', 'true');
    setShowChangelog(false);
  };

  // Doctor Qualification Enforcement Redirect
  useEffect(() => {
    if (myProfile && hasRole('doctor')) {
      if (!myProfile.qualifications || !myProfile.registration_id) {
        toast.error('Please complete your professional identity to start consultations.', { duration: 5000 });
        navigate(slug ? `/${slug}/profile?tab=settings` : '/profile?tab=settings');
      }
    }
  }, [myProfile, hasRole, navigate, slug]);

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
    const resolvedDoctorName = user?.user_metadata?.full_name || 'Dr. V Aravind';
    const resolvedClinicName = clinic?.name || 'GV Clinic';
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
                onClick={() => selectVisit(v, true)}
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
          selectVisit={selectVisit}
          onCallPatient={handleCallPatient}
        />
      </div>

      {/* ── Active Consultation Area ── */}
      <div className={cn("flex-1 overflow-auto bg-muted/10 h-full", !selectedVisit ? "hidden md:block" : "block")}>
        {!selectedVisit ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center p-6 space-y-4">
              <Stethoscope className="w-16 h-16 mx-auto mb-4 opacity-10 animate-pulse text-primary" />
              <p className="text-lg font-medium opacity-50">Select a patient from the queue to start consultation</p>
            </div>
          </div>
        ) : (
          <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6 animate-in fade-in slide-in-from-bottom-6 duration-300 pb-40">
            
            {/* Patient Header Card */}
            <Card className="border-none shadow-sm bg-card rounded-2xl">
              <CardHeader className="pb-3 px-6">
                <CardTitle className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => setSelectedVisit(null)} 
                      className="h-10 w-10 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-all active:scale-90"
                      title="Back to Queue"
                    >
                      <ArrowLeft className="w-6 h-6 text-slate-600 dark:text-slate-400" />
                    </Button>
                    <div className="p-2 bg-blue-50 dark:bg-blue-500/10 rounded-lg">
                      <User className="w-5 h-5 text-blue-600" />
                    </div>
                    <span className="text-xl font-extrabold tracking-tight text-foreground">
                      {(patient?.title ? patient.title + ' ' : '') + patient?.name}
                    </span>
                    {isDraftRestored && (
                      <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800/50 flex items-center gap-1.5 animate-pulse h-6">
                        <History className="w-3 h-3" />
                        <span className="text-[10px] font-bold uppercase tracking-wider">Draft Restored</span>
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
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
              <CardContent className="px-6 pb-6">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                  <div className="bg-muted/30 p-3 rounded-xl border border-border">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Age / Sex</p>
                    <p className="text-base font-bold text-foreground">{formatAge(patient)}/{patient?.sex?.charAt(0) ?? '—'}</p>
                  </div>
                  <div className="bg-muted/30 p-3 rounded-xl border border-border">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Phone</p>
                    <p className="text-base font-bold text-foreground">{patient?.phone}</p>
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

                  <div className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    {[
                      { label: 'Weight', value: selectedVisit.weight, unit: 'kg', icon: Scale, color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-500/10', dbKey: 'weight' },
                      { label: 'BP', value: selectedVisit.blood_pressure, unit: 'mmHg', icon: HeartPulse, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-500/10', dbKey: 'blood_pressure' },
                      { label: 'Pulse', value: selectedVisit.pulse_rate, unit: 'bpm', icon: Activity, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-500/10', dbKey: 'pulse_rate' },
                      { label: 'SpO2', value: selectedVisit.spo2, unit: '%', icon: Wind, color: 'text-sky-500', bg: 'bg-sky-50 dark:bg-sky-500/10', dbKey: 'spo2' },
                      { label: 'Temp', value: selectedVisit.temperature, unit: '°F', icon: Thermometer, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-500/10', dbKey: 'temperature' },
                      { label: 'CBG', value: selectedVisit.cbg, unit: 'mg/dL', icon: Droplet, color: 'text-rose-500', bg: 'bg-rose-50 dark:bg-rose-500/10', dbKey: 'cbg' },
                    ].map(v => (
                      <div key={v.label} className="text-center p-3 rounded-2xl bg-card border border-border shadow-sm flex flex-col items-center gap-1.5 hover:border-blue-500/30 transition-all">
                        <div className={cn("p-2 rounded-xl", v.bg)}>
                          <v.icon className={cn("w-4 h-4", v.color)} />
                        </div>
                        <p className="text-[10px] font-extrabold text-muted-foreground uppercase">{v.label}</p>
                        <p className="font-extrabold text-sm text-foreground leading-none">{v.value ?? '—'}<span className="text-[10px] font-medium ml-0.5 opacity-60">{v.value ? ` ${v.unit}` : ''}</span></p>
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
        />
      )}

      {/* 2. Prescription Preview Dialogue */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-[900px] w-[95vw] p-0 overflow-hidden bg-background">
          <DialogHeader className="bg-muted/50 p-4 pr-12 border-b relative flex flex-row items-center justify-between">
            <div className="flex items-center gap-2 z-10">
              <Button variant="outline" size="sm" onClick={() => printPrescription('#consultation-print-preview')} className="gap-2">
                <Printer className="w-4 h-4" /> Print PDF
              </Button>
              <Button variant="outline" size="sm" onClick={() => shareToWhatsApp(selectedVisit, patient)} className="gap-2 border-green-500/30 text-green-600 hover:bg-green-50">
                <MessageCircle className="w-4 h-4" /> WhatsApp
              </Button>
              
              <label className="text-xs font-bold text-slate-500 cursor-pointer select-none flex items-center gap-1.5 bg-background border border-border px-2.5 py-1.5 rounded-lg shadow-sm">
                <input
                  type="checkbox"
                  checked={printOnStationery}
                  onChange={(e) => setPrintOnStationery(e.target.checked)}
                  className="h-3.5 w-3.5 text-blue-600 rounded cursor-pointer animate-none"
                />
                Print on letterhead
              </label>
            </div>
            <DialogTitle className="hidden sm:block absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap text-sm font-black uppercase tracking-widest text-slate-400">
              Prescription Preview
            </DialogTitle>
          </DialogHeader>
          <div className="p-4 md:p-8 overflow-auto max-h-[85vh] bg-muted min-h-[500px]" id="consultation-print-preview">
            <PrescriptionTemplate
               patient={patient}
               visit={selectedVisit}
               handwrittenImage={prescriptionImage}
               clinicalNotes={clinicalNotes}
               diagnosis={diagnoses.length > 0 ? diagnoses.join(' / ') : diagnosis}
               medicines={medicines.filter(m => m.name.trim())}
               advice={advice}
               isWritingMode={lastInputWay === 'writing'}
               isPrint={true}
               doctorId={user?.id}
               prescriptionCreatedAt={new Date().toISOString()}
               doctorName={myProfile?.full_name}
               doctorQualifications={myProfile?.qualifications}
               doctorRegId={myProfile?.registration_id}
               clinicName={myProfile?.clinic_name}
               clinicAddress={myProfile?.clinic_address}
               clinicPhone={myProfile?.clinic_phone}
               hideBranding={printOnStationery}
             />
          </div>
        </DialogContent>
      </Dialog>

      {/* 3. Past Visit Rx Preview Dialogue */}
      <Dialog open={!!viewingHistoryRx} onOpenChange={open => !open && setViewingHistoryRx(null)}>
        <DialogContent className="max-w-[800px] w-[95vw] p-0 overflow-hidden bg-background">
          <DialogHeader className="p-4 border-b bg-muted/30">
            <DialogTitle className="text-sm font-bold text-center">
              Visit Details — {viewingHistoryRx && new Date(viewingHistoryRx.created_at).toLocaleDateString()}
            </DialogTitle>
          </DialogHeader>
          <div className="p-4 md:p-8 overflow-auto max-h-[75vh] bg-slate-100">
            {loadingHistoryRx ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : (
              currentHistoryRx && (
                <PrescriptionTemplate
                  patient={patient}
                  visit={viewingHistoryRx}
                  handwrittenImage={currentHistoryRx.advice_image}
                  clinicalNotes={currentHistoryRx.clinical_notes}
                  diagnosis={currentHistoryRx.diagnosis}
                  medicines={currentHistoryRx.medicines || []}
                  advice={currentHistoryRx.advice_image && !currentHistoryRx.advice_image.startsWith('data:image') && !currentHistoryRx.advice_image.startsWith('[') ? currentHistoryRx.advice_image : ''}
                  isWritingMode={currentHistoryRx.is_writing_mode}
                  isPrint={true}
                  doctorId={currentHistoryRx.doctor_id}
                  prescriptionCreatedAt={currentHistoryRx.created_at}
                  doctorName={myProfile?.full_name}
                  doctorQualifications={myProfile?.qualifications}
                  doctorRegId={myProfile?.registration_id}
                  clinicName={myProfile?.clinic_name}
                  clinicAddress={myProfile?.clinic_address}
                  clinicPhone={myProfile?.clinic_phone}
                  hideBranding={printOnStationery}
                />
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

      {/* What's New Floating Trigger Button */}
      <div className="fixed bottom-4 left-4 z-[40] hidden md:block">
        <Button
          onClick={() => setShowChangelog(true)}
          className="bg-indigo-650 hover:bg-indigo-700 text-white font-extrabold text-[10px] rounded-full shadow-lg h-9 px-4 flex items-center gap-1.5 uppercase tracking-wider transition-all hover:scale-105 active:scale-95"
        >
          <Sparkles className="w-3.5 h-3.5 text-yellow-300 animate-pulse" /> What's New (v2.2)
        </Button>
      </div>

      {/* 5. What's New / Changelog Dialogue */}
      <Dialog open={showChangelog} onOpenChange={setShowChangelog}>
        <DialogContent className="max-w-[600px] w-[95vw] rounded-[2rem] p-0 overflow-hidden border-none shadow-2xl bg-card">
          <DialogHeader className="p-6 bg-gradient-to-r from-blue-650 to-indigo-650 text-white relative">
            <DialogTitle className="text-xl font-black flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-yellow-300 animate-pulse" />
              IN THIS VERSION (v1.4)
            </DialogTitle>
            <DialogDescription className="text-blue-100 font-bold text-xs mt-1">
              Major mobile navigation upgrades, performance refinements, and clinic branding security.
            </DialogDescription>
          </DialogHeader>
          
          <div className="p-6 overflow-y-auto max-h-[60vh] space-y-4">
            <div className="space-y-3.5">
              {[
                {
                  icon: Move,
                  color: 'text-blue-500 bg-blue-50 dark:bg-blue-950/30',
                  title: 'VisionOS Floating Glass Dock (Draggable)',
                  desc: 'Freely drag the mobile navigation bar anywhere on screen. Your custom position is saved automatically across browser reloads.'
                },
                {
                  icon: Zap,
                  color: 'text-amber-500 bg-amber-50 dark:bg-amber-950/30',
                  title: 'Zero-Lag Navigation & Borderless Design',
                  desc: 'Removed box outlines and heavy animations for instant, fluid tab transitions with subtle glowing active indicators.'
                },
                {
                  icon: LayoutGrid,
                  color: 'text-purple-500 bg-purple-50 dark:bg-purple-950/30',
                  title: 'Ultra-Compact "All Modules" Launcher',
                  desc: 'Compact 4-column quick module grid that fits completely on screen with zero scrolling required.'
                },
                {
                  icon: Volume2,
                  color: 'text-rose-500 bg-rose-50 dark:bg-rose-950/30',
                  title: 'TV Queue Display Default Audio Chime',
                  desc: 'Audible token call chime active by default with Web Audio context unlock and multi-device responsive layout.'
                },
                {
                  icon: ShieldCheck,
                  color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/30',
                  title: 'Clinic Branding Lockdown',
                  desc: 'Clinic branding, name customization, and photo uploads secured exclusively to clinic owners and doctors.'
                }
              ].map((item, index) => (
                <div key={index} className="flex gap-3.5 items-start p-3 bg-muted/30 dark:bg-slate-900/10 border border-border/50 rounded-2xl">
                  <div className={cn("p-2 rounded-xl shrink-0 mt-0.5", item.color)}>
                    <item.icon className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="font-extrabold text-[13px] text-slate-800 dark:text-slate-200">{item.title}</h5>
                    <p className="text-[11px] font-bold text-muted-foreground mt-0.5 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <DialogFooter className="p-4 border-t bg-muted/10 flex justify-end">
            <div className="flex gap-3">
              <Button 
                variant="outline"
                onClick={() => { setShowChangelog(false); navigate(slug ? `/${slug}/about` : '/about'); }}
                className="font-extrabold text-xs uppercase tracking-widest px-5 py-4 rounded-xl"
              >
                Full Version History
              </Button>
              <Button 
                onClick={handleAcknowledgeChangelog} 
                className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs uppercase tracking-widest px-8 py-4 rounded-xl shadow-lg"
              >
                Got It!
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}