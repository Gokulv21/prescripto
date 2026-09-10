import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { sanitizeText } from '@/lib/security-sanitize';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Medicine } from '@/types/consultation';
import { uploadPrescriptionImage } from '@/lib/prescriptionStorage';

export type SyncStatus = 'synced' | 'syncing' | 'offline_saved' | 'error';

export function useConsultation(clinic: any) {
  const queryClient = useQueryClient();
  const { user, hasRole, profile } = useAuth();
  
  const [selectedVisit, setSelectedVisit] = useState<any>(null);
  const [patient, setPatient] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [diagnosis, setDiagnosis] = useState('');
  const [diagnoses, setDiagnoses] = useState<string[]>([]);
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [medicines, setMedicines] = useState<Medicine[]>([{ type: 'Tab.', name: '', dosage: '', frequency: '', duration: '', route: '' }]);
  const [advice, setAdvice] = useState('');
  const [saving, setSaving] = useState(false);
  const [prescriptionImage, setPrescriptionImage] = useState<string | null>(null);
  const [prescriptionPaths, setPrescriptionPaths] = useState<any[]>([]);
  const [isWritingMode, setIsWritingMode] = useState(false);
  const [lastInputWay, setLastInputWay] = useState<'typing' | 'writing'>('typing');
  const [saveError, setSaveError] = useState<{ step: 'prescription' | 'visit', message: string } | null>(null);
  const [protocols, setProtocols] = useState<any[]>([]);
  const [diagnosisHistory, setDiagnosisHistory] = useState<string[]>([]);
  const [isDraftRestored, setIsDraftRestored] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced');
  
  const lastLoadedVisitId = useRef<string | null>(null);

  // Fetch my profile info
  const { data: myProfile } = useQuery({
    queryKey: ['myProfile', user?.id],
    queryFn: async () => {
       const { data } = await supabase.from('profiles').select('*').eq('user_id', user?.id).maybeSingle();
       return data;
    },
    enabled: !!user?.id
  });

  // Fetch Queue with dynamic cache isolation
  const { data: queue = [], isLoading: isLoadingQueue, refetch: refetchQueue } = useQuery({
    queryKey: ['visitQueue', clinic?.id, user?.id, profile?.id || myProfile?.id],
    queryFn: async () => {
      const activeProfile = profile || myProfile;
      if (!hasRole('superadmin') && activeProfile?.clinic_id && activeProfile.clinic_id !== clinic?.id) {
        return [];
      }

      let query = supabase
        .from('visits')
        .select('*, patients(*), prescriptions(*)')
        .eq('clinic_id', clinic?.id)
        .in('status', ['waiting', 'in_consultation']);
      
      const doctorScopes = ['assigned_doctor_id.is.null'];
      if (user?.id) doctorScopes.push(`assigned_doctor_id.eq.${user.id}`);
      if (profile?.id) doctorScopes.push(`assigned_doctor_id.eq.${profile.id}`);
      if (myProfile?.id) doctorScopes.push(`assigned_doctor_id.eq.${myProfile.id}`);
      query = query.or(doctorScopes.join(','));
      
      const { data, error } = await query.order('token_number', { ascending: true });
      if (error) throw error;
      return (data || []).filter(v => v.patients);
    },
    enabled: !!clinic?.id,
    staleTime: 5000,
    refetchOnWindowFocus: true,
  });

  // Protocols & Diagnosis Suggestion list loading
  const fetchProtocols = useCallback(async () => {
    if (!clinic?.id) return;
    const { data } = await supabase
      .from('medicine_protocols')
      .select('*')
      .eq('clinic_id', clinic?.id)
      .order('name');
    setProtocols(data || []);
  }, [clinic?.id]);

  const fetchDiagnosisHistory = useCallback(async () => {
    if (!clinic?.id) return;
    try {
      const [rxRes, visitRes] = await Promise.all([
        supabase.from('prescriptions').select('diagnosis').eq('clinic_id', clinic.id).order('created_at', { ascending: false }),
        supabase.from('visits').select('diagnosis').eq('clinic_id', clinic.id).not('diagnosis', 'is', null).order('created_at', { ascending: false })
      ]);
      const allEntries = [
        ...(rxRes.data || []).map(d => d.diagnosis),
        ...(visitRes.data || []).map(d => d.diagnosis)
      ].filter(Boolean);
      
      if (allEntries.length > 0) {
        const allIndividualTerms = allEntries
          .flatMap(d => (typeof d === 'string' ? d.split(/[/,\\,]+/) : []))
          .map(d => d.trim().toUpperCase())
          .filter(d => d.length > 1);
        setDiagnosisHistory([...new Set(allIndividualTerms)].sort());
      }
    } catch (e) {
      console.error("Error loading diagnosis suggestion library", e);
    }
  }, [clinic?.id]);

  useEffect(() => {
    if (clinic?.id) {
      fetchProtocols();
      fetchDiagnosisHistory();
    }
  }, [clinic?.id, fetchProtocols, fetchDiagnosisHistory]);

  // Draft Saving Helper
  const saveCurrentToDraft = useCallback(async (visitId: string) => {
    if (!visitId) return;
    if (visitId !== lastLoadedVisitId.current) return;

    const draftData = {
      diagnosis: diagnosis.trim().toUpperCase(),
      diagnoses,
      clinicalNotes,
      medicines,
      advice,
      prescriptionImage,
      prescriptionPaths,
      isWritingMode,
      lastInputWay,
      timestamp: Date.now()
    };

    const hasContent = diagnosis || clinicalNotes || medicines.some(m => m.name) || advice || prescriptionImage;
    if (!hasContent) return;

    // 1. Back up locally (contains full data including drawings)
    localStorage.setItem(`draft_${visitId}`, JSON.stringify(draftData));
    localStorage.setItem('active_consultation_id', visitId);

    // 2. Sync to Cloud (lightweight version excluding heavy base64 images and paths)
    if (navigator.onLine) {
      setSyncStatus('syncing');
      try {
        const cloudDraftData = {
          ...draftData,
          prescriptionImage: null,
          prescriptionPaths: []
        };
        const { error } = await supabase
          .from('visits')
          .update({ draft_data: cloudDraftData as any })
          .eq('id', visitId);
        
        if (error) throw error;
        setSyncStatus('synced');
      } catch (err) {
        console.error("Cloud draft sync failed", err);
        setSyncStatus('offline_saved');
      }
    } else {
      setSyncStatus('offline_saved');
    }
  }, [diagnosis, diagnoses, clinicalNotes, medicines, advice, prescriptionImage, prescriptionPaths, isWritingMode, lastInputWay]);

  // Debounced Auto-save
  useEffect(() => {
    if (selectedVisit?.id && selectedVisit.id === lastLoadedVisitId.current) {
      const timer = setTimeout(() => {
        saveCurrentToDraft(selectedVisit.id);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [selectedVisit?.id, diagnosis, diagnoses, clinicalNotes, medicines, advice, prescriptionImage, prescriptionPaths, isWritingMode, lastInputWay, saveCurrentToDraft]);

  // App / tab closed backup
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (selectedVisit?.id) {
        saveCurrentToDraft(selectedVisit.id);
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [selectedVisit?.id, saveCurrentToDraft]);

  // Select patient & load draft
  const selectVisit = async (visit: any, checkForDrafts = true) => {
    if (lastLoadedVisitId.current && lastLoadedVisitId.current !== visit.id) {
      await saveCurrentToDraft(lastLoadedVisitId.current);
    }

    setSelectedVisit(visit);
    setPatient(visit.patients);
    lastLoadedVisitId.current = visit.id;

    if (visit.patients?.id) {
      supabase.from('patients').update({ last_opened_at: new Date().toISOString() }).eq('id', visit.patients.id).then();
    }

    // Load History
    const { data: historyRes } = await supabase
      .from('visits')
      .select('*, prescriptions(*)')
      .eq('patient_id', visit.patient_id)
      .neq('id', visit.id)
      .order('created_at', { ascending: false })
      .limit(10);
    setHistory(historyRes || []);

    // Load draft
    let restoredDraft = null;
    const savedDraft = localStorage.getItem(`draft_${visit.id}`);
    let localDraft = null;
    if (savedDraft) {
      try { localDraft = JSON.parse(savedDraft); } catch {}
    }

    if (visit.draft_data) {
      // Merge cloud draft text with local draft drawings
      restoredDraft = {
        ...visit.draft_data,
        prescriptionImage: localDraft?.prescriptionImage || visit.draft_data.prescriptionImage || null,
        prescriptionPaths: localDraft?.prescriptionPaths || visit.draft_data.prescriptionPaths || []
      };
    } else if (localDraft) {
      restoredDraft = localDraft;
    }

    if (checkForDrafts && restoredDraft) {
      setDiagnosis('');
      setDiagnoses(restoredDraft.diagnoses || (restoredDraft.diagnosis ? restoredDraft.diagnosis.split(' / ') : []));
      setClinicalNotes(restoredDraft.clinicalNotes || '');
      setMedicines(restoredDraft.medicines || [{ type: 'Tab.', name: '', dosage: '', frequency: '', duration: '' }]);
      setAdvice(restoredDraft.advice || '');
      setPrescriptionImage(restoredDraft.prescriptionImage);
      setPrescriptionPaths(restoredDraft.prescriptionPaths || []);
      setIsWritingMode(restoredDraft.isWritingMode ?? false);
      setLastInputWay(restoredDraft.lastInputWay || (restoredDraft.isWritingMode ? 'writing' : 'typing'));
      setIsDraftRestored(true);
      toast.info(`Restored draft for ${visit.patients?.name || 'patient'}`, { duration: 3000 });
      return;
    }

    setIsDraftRestored(false);

    // If no draft, load existing prescription
    const rxData = visit.prescriptions?.[0];
    if (rxData) {
      setDiagnosis('');
      setDiagnoses(rxData.diagnosis ? rxData.diagnosis.split(' / ') : []);
      setClinicalNotes(rxData.clinical_notes || '');
      setMedicines(rxData.medicines || [{ type: 'Tab.', name: '', dosage: '', frequency: '', duration: '' }]);
      
      const rxImage = rxData.advice_image;
      if (rxImage && rxImage.startsWith('data:image')) {
        setPrescriptionImage(rxImage);
        setAdvice('');
      } else if (rxImage && rxImage.startsWith('[')) {
        try {
          setPrescriptionImage(JSON.parse(rxImage));
          setAdvice('');
        } catch {
          setPrescriptionImage(rxImage);
        }
      } else {
        setPrescriptionImage(null);
        setAdvice(rxImage || '');
      }
      setIsWritingMode(rxData.is_writing_mode);
      setLastInputWay(rxData.is_writing_mode ? 'writing' : 'typing');
      setPrescriptionPaths(rxData.raw_paths || []);
    } else {
      setDiagnosis('');
      setDiagnoses([]);
      setClinicalNotes('');
      setMedicines([{ type: 'Tab.', name: '', dosage: '', frequency: '', duration: '' }]);
      setAdvice('');
      setPrescriptionImage(null);
      setPrescriptionPaths([]);
      setIsWritingMode(false);
      setLastInputWay('typing');
    }

    // Optimistic status update Waiting -> Consultation
    if (visit.status === 'waiting') {
      const previousQueue = queryClient.getQueryData<any[]>(['visitQueue', clinic?.id, user?.id, profile?.id || myProfile?.id]);
      
      queryClient.setQueryData(['visitQueue', clinic?.id, user?.id, profile?.id || myProfile?.id], (oldQueue: any[]) => {
        return (oldQueue || []).map(v => v.id === visit.id ? { ...v, status: 'in_consultation' } : v);
      });

      try {
        const { error } = await supabase.from('visits').update({ status: 'in_consultation' }).eq('id', visit.id);
        if (error) throw error;
      } catch (err) {
        queryClient.setQueryData(['visitQueue', clinic?.id, user?.id, profile?.id || myProfile?.id], previousQueue);
        toast.error("Network issue. Status sync failed.");
      }
    }
  };

  // Medicine details manipulation helpers
  const addMedicine = () => setMedicines(m => [...m, { type: 'Tab.', name: '', dosage: '', frequency: '', duration: '', route: '' }]);
  const removeMedicine = (i: number) => setMedicines(m => m.filter((_, idx) => idx !== i));
  const updateMedicine = (i: number, field: keyof Medicine, value: string) =>
    setMedicines(m => m.map((med, idx) => idx === i ? { ...med, [field]: value } : med));

  const handleMedicineKeyDown = (e: React.KeyboardEvent, index: number, fieldName: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const form = (e.target as HTMLElement).closest('.medicine-row');
      if (!form) return;
      const inputs = Array.from(form.querySelectorAll('input, select')) as HTMLElement[];
      const currentIndex = inputs.indexOf(e.target as HTMLElement);
      if (currentIndex < inputs.length - 1) {
        inputs[currentIndex + 1].focus();
      } else if (index === medicines.length - 1) {
        addMedicine();
        setTimeout(() => {
          const nextRow = form.parentElement?.lastElementChild?.querySelector('input');
          if (nextRow) nextRow.focus();
        }, 0);
      }
    }
  };

  // Diagnosis tag manipulation
  const addDiagnosisTag = (tag: string) => {
    const tags = [tag.trim().toUpperCase()].filter(Boolean);
    if (tags.length > 0) {
      const newDiagnoses = [...diagnoses];
      tags.forEach(t => {
        if (!newDiagnoses.includes(t)) {
          newDiagnoses.push(t);
        }
      });
      setDiagnoses(newDiagnoses);
    }
    setDiagnosis('');
  };

  const removeDiagnosisTag = (index: number) => {
    setDiagnoses(diagnoses.filter((_, i) => i !== index));
  };

  const applyProtocol = (protocol: any) => {
    const newMedicines = protocol.medicines.map((m: any) => ({
      type: m.type || 'Tab.',
      name: m.name,
      dosage: m.dosage || '',
      frequency: m.frequency || '',
      duration: m.duration || '',
      route: m.route || '',
      notes: m.instructions || m.notes || ''
    }));
    const currentMedicines = medicines.length === 1 && !medicines[0].name ? [] : medicines;
    setMedicines([...currentMedicines, ...newMedicines]);
    setLastInputWay('typing');
    toast.success(`Applied ${protocol.name} protocol`);
  };

  // Call patient notify staff
  const handleCallPatient = async (visit: any) => {
    try {
      const patientName = (visit.patients?.title ? visit.patients.title + ' ' : '') + (visit.patients?.name || 'Patient');
      if (visit.created_by) {
        const { error } = await supabase.from('notifications').insert({
          user_id: visit.created_by,
          clinic_id: clinic?.id,
          title: 'CALLING PATIENT',
          message: `Please send Patient: ${patientName} (Token #${visit.token_number}) to the doctor's room immediately.`,
          type: 'info',
          is_read: false
        });
        if (error) throw error;
        toast.success(`Calling patient ${patientName} (Staff notified)`);
      } else {
        const { data: staffProfiles } = await supabase
          .from('profiles')
          .select('user_id')
          .eq('clinic_id', clinic?.id)
          .neq('role', 'doctor')
          .neq('is_superadmin', true);
          
        if (staffProfiles && staffProfiles.length > 0) {
          const notifs = staffProfiles.map(staff => ({
            user_id: staff.user_id,
            clinic_id: clinic?.id,
            title: 'CALLING PATIENT',
            message: `Please send Patient: ${patientName} (Token #${visit.token_number}) to the doctor's room immediately.`,
            type: 'info',
            is_read: false
          }));
          const { error } = await supabase.from('notifications').insert(notifs);
          if (error) throw error;
          toast.success(`Calling patient ${patientName} (Clinic staff notified)`);
        } else {
          toast.success(`Calling patient ${patientName}`);
        }
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to notify staff, but calling patient...");
    }
  };

  // Save Prescription
  const savePrescription = async () => {
    if (!selectedVisit || !patient) return;
    const isWriting = lastInputWay === 'writing';

    const pendingDiagnosis = diagnosis.trim().toUpperCase();
    let allDiagnoses = [...diagnoses];
    if (pendingDiagnosis && !allDiagnoses.includes(pendingDiagnosis)) {
      allDiagnoses.push(pendingDiagnosis);
    }
    const diagnosisStr = allDiagnoses.join(' / ').trim();
    const finalDiagnosis = diagnosisStr ? sanitizeText(diagnosisStr, 500) : null;
    const finalClinicalNotes = clinicalNotes ? sanitizeText(clinicalNotes, 2000) : null;
    const finalMedicines = medicines
        .filter(m => m.name.trim())
        .map(m => ({
            ...m,
            name: sanitizeText(m.name, 200),
            dosage: m.dosage ? sanitizeText(m.dosage, 100) : undefined,
            duration: m.duration ? sanitizeText(m.duration, 100) : undefined,
            instructions: m.notes ? sanitizeText(m.notes, 500) : undefined
        }));
    const finalAdviceImage = isWriting ? prescriptionImage : (advice ? sanitizeText(advice, 1000) : null);
    const finalPaths = isWriting ? prescriptionPaths : [];

    if (!isWriting && !finalDiagnosis && finalMedicines.length === 0 && !advice && !finalClinicalNotes) {
      toast.error('Please add diagnosis, notes, medicines or advice');
      return;
    }
    
    if (isWriting && !prescriptionImage) {
      toast.error('Please add handwriting using the template');
      return;
    }

    setSaving(true);
    setSaveError(null);

    if (!navigator.onLine) {
      toast.warning("Network connection lost. Saving prescription details locally.");
      setSyncStatus('offline_saved');
      setSaving(false);
      return;
    }

    try {
      // 1. Upload heavy canvas/handwriting drawing to Supabase Storage Bucket
      let storedAdviceImage = finalAdviceImage;
      if (isWriting && prescriptionImage) {
        storedAdviceImage = await uploadPrescriptionImage(
          prescriptionImage,
          clinic?.id || 'global',
          selectedVisit.id
        );
      }

      // 2. Insert lightweight URL & details into DB
      const { error: rxError } = await supabase.from('prescriptions').upsert({
        visit_id: selectedVisit.id,
        patient_id: patient.id,
        diagnosis: finalDiagnosis,
        clinical_notes: finalClinicalNotes,
        medicines: finalMedicines as any,
        advice_image: storedAdviceImage,
        raw_paths: finalPaths as any,
        is_writing_mode: isWritingMode,
        doctor_id: user?.id,
        clinic_id: clinic?.id
      }, { onConflict: 'visit_id' });
      
      if (rxError) {
        setSaveError({ step: 'prescription', message: rxError.message });
        throw rxError;
      }

      const { error: visitError } = await supabase.from('visits').update({ 
        status: 'completed', 
        diagnosis: finalDiagnosis,
        draft_data: null
      }).eq('id', selectedVisit.id);

      if (visitError) {
        setSaveError({ step: 'visit', message: visitError.message });
        throw visitError;
      }

      localStorage.removeItem(`draft_${selectedVisit.id}`);
      localStorage.removeItem('active_consultation_id');

      toast.success('Prescription saved & sent to print queue');
      
      setAdvice('');
      setSelectedVisit(null);
      setPatient(null);
      setHistory([]);
      setPrescriptionImage(null);
      setPrescriptionPaths([]);
      setDiagnosis('');
      setDiagnoses([]);
      setClinicalNotes('');
      setMedicines([{ type: 'Tab.', name: '', dosage: '', frequency: '', duration: '' }]);
      setSaveError(null);
      setSyncStatus('synced');

      queryClient.invalidateQueries({ queryKey: ['visitQueue'] });
      fetchDiagnosisHistory();
    } catch (err: any) {
      toast.error(`Save Failed: ${err.message || 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  const markAsNoShow = async () => {
    if (!selectedVisit) return;
    setSaving(true);
    try {
      const patientId = selectedVisit.patient_id;
      await supabase.from('visits').update({ status: 'no_show', draft_data: null }).eq('id', selectedVisit.id);
      await supabase.from('prescriptions').delete().eq('visit_id', selectedVisit.id);
      await supabase.from('visits').delete().eq('id', selectedVisit.id);
      
      const { data: otherVisits } = await supabase.from('visits').select('id').eq('patient_id', patientId).limit(1);
      if (!otherVisits || otherVisits.length === 0) {
        await supabase.from('patients').delete().eq('id', patientId);
      }

      toast.success('Visit cancelled');
      localStorage.removeItem(`draft_${selectedVisit.id}`);
      localStorage.removeItem('active_consultation_id');
      
      setSelectedVisit(null);
      setPatient(null);
      setHistory([]);
      setPrescriptionImage(null);
      setPrescriptionPaths([]);
      setDiagnosis('');
      setDiagnoses([]);
      setClinicalNotes('');
      setMedicines([{ type: 'Tab.', name: '', dosage: '', frequency: '', duration: '' }]);
      
      queryClient.invalidateQueries({ queryKey: ['visitQueue'] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return {
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
  };
}
