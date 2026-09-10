import { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate, useOutletContext } from "react-router-dom";
import { useAuth } from '@/lib/auth';

import PageBanner from "@/components/PageBanner";
import patientEntryBanner from "@/assets/patient_entry_banner.png";
import { formatAge, calculateDobFromAge, getPatientCurrentAge } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Search, UserPlus, History, CheckCircle, ArrowRight, User, Phone, MapPin, X, AlertCircle, ChevronDown, Loader2 } from 'lucide-react';
import { sanitizeText, validatePhone, validateNumericRange } from '@/lib/security-sanitize';

interface PatientForm {
  title: string;
  name: string;
  age: string;
  sex: string;
  phone: string;
  address: string;
}

interface VitalsForm {
  weight: string;
  blood_pressure: string;
  pulse_rate: string;
  spo2: string;
  temperature: string;
  cbg: string;
}

const initialPatient: PatientForm = { title: '', name: '', age: '', sex: '', phone: '', address: '' };
const initialVitals: VitalsForm = { weight: '', blood_pressure: '', pulse_rate: '', spo2: '', temperature: '', cbg: '' };

export default function NurseEntry() {
  const [tab, setTab] = useState('new');
  const [step, setStep] = useState<'patient' | 'confirm' | 'vitals' | 'done'>('patient');
  const [patient, setPatient] = useState<PatientForm>(initialPatient);
  const [vitals, setVitals] = useState<VitalsForm>(initialVitals);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [selectedPatientFull, setSelectedPatientFull] = useState<any>(null); // To show full details in confirmation
  const [ageUnit, setAgeUnit] = useState<'years' | 'months' | 'days'>('years');
  const [tokenNumber, setTokenNumber] = useState<number | null>(null);
  const [assignedDoctorId, setAssignedDoctorId] = useState<string>("general");
  const { clinic } = useOutletContext<{ clinic: any }>();
  const { profile, user, roles, hasRole } = useAuth();
  const [showSearch, setShowSearch] = useState(false);
  
  useEffect(() => {
    const isSuperAdmin = roles.includes('superadmin') || hasRole('superadmin') || (profile as any)?.is_superadmin;
    const isOwner = Boolean(clinic?.owner_id && user?.id && clinic.owner_id === user.id);
    
    if (!isSuperAdmin && !isOwner && profile && (profile as any).clinic_id && clinic?.id && (profile as any).clinic_id !== clinic.id) {
       console.warn("Clinic ID mismatch:", (profile as any).clinic_id, clinic.id);
       toast.error("Security Warning: Your account is assigned to a different clinic than current view. Entries may not be visible.");
    }
  }, [profile, clinic?.id, clinic?.owner_id, user?.id, roles, hasRole]);

  const searchContainerRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const ageRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const addressRef = useRef<HTMLInputElement>(null);
  const weightRef = useRef<HTMLInputElement>(null);
  const sbpRef = useRef<HTMLInputElement>(null);
  const dbpRef = useRef<HTMLInputElement>(null);
  const pulseRef = useRef<HTMLInputElement>(null);
  const spo2Ref = useRef<HTMLInputElement>(null);
  const tempRef = useRef<HTMLInputElement>(null);
  const cbgRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowSearch(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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

  const searchPatients = async (query: string = searchQuery) => {
    if (!query.trim() || query.trim().length < 3) {
        setSearchResults([]);
        return;
    }
    
    // Simple debounce to prevent overwhelming the DB during rapid typing
    const { data } = await supabase
      .from('patients')
      .select('*')
      .eq('clinic_id', clinic?.id)
      .or(`phone.ilike.%${query}%,name.ilike.%${query}%,registration_id.ilike.%${query}%`)
      .limit(10);
    setSearchResults(data || []);
  };

  // Add a dedicated effect for debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim() && searchQuery.trim().length >= 3) {
        searchPatients(searchQuery);
      } else {
        setSearchResults([]);
      }
    }, 800); // 800ms debounce and 3 char minimum to reduce DB load
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const selectOldPatient = (p: any) => {
    setSelectedPatientId(p.id);
    setSelectedPatientFull(p);
    const dynamicAge = getPatientCurrentAge(p);
    setPatient({
      title: p.title || '',
      name: p.name,
      age: dynamicAge !== null ? String(dynamicAge) : String(p.age || ''),
      sex: p.sex,
      phone: p.phone,
      address: p.address || ''
    });
    setStep('confirm'); // Move to confirmation step first
  };

  const handleNewPatientNext = async () => {
    if (!patient.name || !patient.age || !patient.sex || !patient.phone || !patient.title) {
      toast.error('Please fill all required fields');
      return;
    }
    // We move to vitals first, but submitVisit will now handle both
    setStep('vitals');
  };

  const getNextRegId = async () => {
    const { data, error } = await (supabase.rpc as any)('get_next_registration_id');
    if (error) {
        console.error('Error generating Reg ID, falling back:', error);
        // Fallback to random if RPC fails
        const timestamp = Date.now().toString().slice(-6);
        const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        const yy = new Date().getFullYear().toString().slice(-2);
        return `${yy}${timestamp}${random}`;
    }
    return data;
  };

  const submitVisit = async () => {
    if (!clinic?.id) {
      toast.error('Clinic is not loaded yet. Please wait a moment and try again.');
      return;
    }

    const isSuperAdmin = roles.includes('superadmin') || hasRole('superadmin') || (profile as any)?.is_superadmin;
    const isOwner = Boolean(clinic?.owner_id && user?.id && clinic.owner_id === user.id);

    if (!isSuperAdmin && !isOwner && profile && (profile as any).clinic_id && (profile as any).clinic_id !== clinic.id) {
      toast.error('Your account clinic does not match the selected clinic. Please switch clinic or contact admin.');
      return;
    }

    // 1. INPUT SANITIZATION & VALIDATION
    const sanitizedName = sanitizeText(patient.name, 100);
    const sanitizedAddress = sanitizeText(patient.address, 500);
    const sanitizedPhone = patient.phone.trim();

    if (sanitizedName.length < 2) {
        toast.error("Valid patient name is required (min 2 chars)");
        return;
    }

    if (patient.phone && !validatePhone(patient.phone)) {
        toast.error("Invalid phone number format. Use standard digits and spaces.");
        return;
    }

    // Vitals range validation (Sanity checks)
    if (vitals.weight && !validateNumericRange(vitals.weight, 0, 500)) {
        toast.error("Invalid weight value"); return;
    }
    if (vitals.pulse_rate && !validateNumericRange(vitals.pulse_rate, 0, 300)) {
        toast.error("Invalid pulse rate"); return;
    }

    const normalizedAssignedDoctorId =
      assignedDoctorId !== "general" && assignedDoctorId
        ? assignedDoctorId
        : null;

    console.log('[NurseEntry] Submitting visit details:', {
      assignedDoctorId,
      normalizedAssignedDoctorId
    });

    setLoading(true);
    const loadingToast = toast.loading('Registering patient...');
    try {
      let patientId = selectedPatientId;
      let token: number;

      // Parallelize identifying the patient and getting the next token for speed
      if (!patientId) {
        // Parallelize identifying the patient and getting the next token for speed
        const [regIdResult, nextTokenResult] = await Promise.allSettled([
          getNextRegId(),
          supabase.rpc('get_next_token', { p_clinic_id: clinic?.id })
        ]);
        
        const regId = regIdResult.status === 'fulfilled' ? regIdResult.value : `REG-${Date.now().toString().slice(-4)}`;
        
        // Robust token fallback
        if (nextTokenResult.status === 'fulfilled' && nextTokenResult.value.data) {
          token = nextTokenResult.value.data;
          console.log('[NurseEntry] Token received from RPC:', token);
        } else {
          console.error('[NurseEntry] RPC get_next_token failed, falling back to 1:', nextTokenResult.status === 'rejected' ? nextTokenResult.reason : nextTokenResult.value?.error);
          token = 1; // Fallback
        }
        
        let ageInYearsRaw = parseFloat(patient.age);
        if (ageUnit === 'months') ageInYearsRaw = ageInYearsRaw / 12;
        if (ageUnit === 'days') ageInYearsRaw = ageInYearsRaw / 365;
        const ageInYears = ageInYearsRaw;
        const calculatedDob = calculateDobFromAge(parseFloat(patient.age), ageUnit);

        console.log('[NurseEntry] Creating new patient with Reg ID:', regId);
        const insertPayload: any = {
          title: patient.title,
          name: sanitizedName,
          age: ageInYears,
          sex: patient.sex,
          phone: sanitizedPhone,
          address: sanitizedAddress || null,
          registration_id: String(regId),
          last_opened_at: new Date().toISOString(),
          clinic_id: clinic?.id
        };

        let newPatient: any = null;
        const { data: pData, error: pError } = await supabase
          .from('patients')
          .insert({ ...insertPayload, dob: calculatedDob })
          .select()
          .single();

        if (pError) {
          if (pError.message?.includes('dob') || pError.message?.includes('schema cache')) {
            console.warn('[NurseEntry] dob column not in schema, retrying standard insert');
            const { data: retryData, error: retryError } = await supabase
              .from('patients')
              .insert(insertPayload)
              .select()
              .single();
            if (retryError) throw retryError;
            newPatient = retryData;
          } else {
            console.error('[NurseEntry] Patient insert error:', pError);
            throw pError;
          }
        } else {
          newPatient = pData;
        }

        patientId = newPatient.id;
        console.log('[NurseEntry] Patient created successfully:', patientId);
      } else {
        // EXISTING PATIENT PATH: Just get token
        const { data: tokenData, error: tokenError } = await supabase.rpc('get_next_token', { p_clinic_id: clinic?.id });
        if (tokenError) {
          console.error('[NurseEntry] RPC get_next_token failed for existing patient:', tokenError);
          token = 1;
        } else {
          token = tokenData || 1;
        }
      }

      // Now insert the visit
      console.log('[NurseEntry] Creating visit for patient:', patientId, 'with token:', token);
      const { error: visitError } = await supabase.from('visits').insert({
        patient_id: patientId!,
        token_number: token,
        weight: vitals.weight ? parseFloat(vitals.weight) : null,
        blood_pressure: vitals.blood_pressure || null,
        pulse_rate: vitals.pulse_rate ? parseInt(vitals.pulse_rate) : null,
        spo2: vitals.spo2 ? parseFloat(vitals.spo2) : null,
        temperature: vitals.temperature ? parseFloat(vitals.temperature) : null,
        cbg: vitals.cbg ? parseFloat(vitals.cbg) : null,
        assigned_doctor_id: normalizedAssignedDoctorId,
        clinic_id: clinic?.id,
        created_by: user?.id
      });
      console.log('[NurseEntry] Visit insert result:', visitError ? 'Error: ' + visitError.message : 'Success');

      if (visitError) throw visitError;

      setTokenNumber(token);
      setStep('done');
      toast.dismiss(loadingToast);
      toast.success(`Patient added to queue — Token #${token}`);
    } catch (err: any) {
      toast.dismiss(loadingToast);
      toast.error(err.message || 'Failed to submit');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setPatient(initialPatient);
    setVitals(initialVitals);
    setStep('patient');
    setSelectedPatientId(null);
    setSelectedPatientFull(null);
    setTokenNumber(null);
    setSearchQuery('');
    setSearchResults([]);
    setAgeUnit('years');
    setAssignedDoctorId('general');
    setTab('new'); // Keep for internal logic if needed
  };
  
  const handleKeyDown = (e: React.KeyboardEvent, nextRef?: React.RefObject<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (nextRef && nextRef.current) {
        nextRef.current.focus();
      } else if (!nextRef) {
        // Last field of the current step
        if (step === 'patient') handleNewPatientNext();
        else if (step === 'vitals') submitVisit();
      }
    }
  };


  if (step === 'done') {
    return (
      <div className="p-6 flex items-center justify-center min-h-[80vh]">
        <Card className="w-full max-w-md text-center animate-fade-in shadow-2xl border-primary/20 bg-card/80 backdrop-blur-sm">
          <CardContent className="pt-10 pb-10 space-y-6">
            <div className="relative inline-block">
                <CheckCircle className="w-20 h-20 text-success mx-auto drop-shadow-lg" />
                <div className="absolute -top-1 -right-1 w-6 h-6 bg-primary rounded-full animate-ping opacity-20" />
            </div>
            
            <div className="space-y-2">
                <h2 className="text-3xl font-heading font-bold text-foreground">Registration Successful!</h2>
                <p className="text-muted-foreground font-medium">{patient.title} {patient.name} </p>
            </div>

            <div className="py-6 bg-muted rounded-2xl border border-border shadow-inner">
                <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">Queue Ticket</div>
                <div className="text-7xl font-heading font-bold text-primary drop-shadow-sm">#{tokenNumber}</div>
            </div>
            
            <div className="grid grid-cols-1 gap-3">
                <Button onClick={reset} className="w-full h-12 text-lg font-bold shadow-lg shadow-primary/25 hover:scale-[1.02] transition-transform">
                    Next Patient
                </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto animate-in fade-in duration-500 pb-32">
      <PageBanner
        title="Patient Registration"
        description="Search for existing patients or register new ones with vitals and history."
        imageSrc={patientEntryBanner}
      />

      <div className="px-4 md:px-8 max-w-5xl mx-auto">
        {step === 'confirm' && selectedPatientFull && (
            <div className="max-w-2xl mx-auto space-y-6">
                <Card className="animate-in slide-in-from-bottom-5 duration-500 overflow-hidden shadow-2xl border-primary/20">
                    <CardHeader className="bg-primary/5 py-8 border-b border-primary/10">
                        <div className="text-center space-y-2">
                            <CardDescription className="text-primary font-bold uppercase tracking-widest text-xs">Verify Patient Information</CardDescription>
                            <CardTitle className="text-3xl font-heading font-black text-foreground">Is this the correct patient?</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-10 pb-10 space-y-8 px-6 md:px-10">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6 md:gap-y-8">
                            <div className="space-y-1">
                                <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Full Name</Label>
                                <div className="text-xl font-bold text-foreground">{selectedPatientFull.title} {selectedPatientFull.name}</div>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Registration ID</Label>
                                <div className="text-xl font-mono font-bold text-primary">{selectedPatientFull.registration_id || 'N/A'}</div>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Age / Gender</Label>
                                <div className="text-xl font-bold text-foreground">{formatAge(selectedPatientFull)} / {selectedPatientFull.sex}</div>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Phone Number</Label>
                                <div className="text-xl font-bold text-foreground">{selectedPatientFull.phone || '—'}</div>
                            </div>
                            <div className="md:col-span-2 space-y-1">
                                <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Full Address</Label>
                                <div className="text-lg md:text-xl font-medium text-foreground leading-relaxed italic bg-muted p-4 md:p-6 rounded-xl border border-dashed border-border">
                                    "{selectedPatientFull.address || 'No address on record'}"
                                </div>
                            </div>
                        </div>

                        <div className="pt-8 flex flex-col md:flex-row gap-4">
                            <Button variant="ghost" className="order-2 md:order-1 flex-1 h-14 text-muted-foreground font-bold text-lg hover:bg-muted" onClick={() => setStep('patient')}>
                                <X className="w-5 h-5 mr-2" /> No, Search Again
                            </Button>
                            <Button className="order-1 md:order-2 flex-[2] h-14 text-lg font-black shadow-xl shadow-primary/30" onClick={() => setStep('vitals')}>
                                <CheckCircle className="w-6 h-6 mr-2" /> Yes, Proceed to Vitals
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        )}

        {step === 'patient' && (
            <div className="space-y-8">
                {/* Search Header Interface */}
                <div className="relative group" ref={searchContainerRef}>
                    <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-sky-400/20 rounded-2xl blur opacity-25 group-hover:opacity-100 transition duration-1000 group-hover:duration-200"></div>
                    <Card className="relative border-primary/10 shadow-xl overflow-visible">
                        <CardContent className="pt-6">
                            <div className="flex flex-col md:flex-row gap-4 items-center">
                                <div className="relative flex-1 w-full">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground transition-colors group-focus-within:text-primary" />
                                    <Input
                                        className="h-14 pl-12 text-lg border-border focus:border-primary focus:ring-primary/20 transition-all rounded-xl shadow-sm bg-background dark:bg-slate-900"
                                        placeholder="Search by Name, Phone, or Reg ID..."
                                        value={searchQuery}
                                        onFocus={() => setShowSearch(true)}
                                        onChange={(e) => {
                                            setSearchQuery(e.target.value);
                                            setShowSearch(true);
                                        }}
                                    />
                                    {showSearch && searchQuery && (
                                        <div className="absolute z-50 top-full left-0 right-0 mt-3 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden max-h-[400px] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
                                            <div className="p-2 space-y-1">
                                                {searchResults.map(p => (
                                                    <button
                                                        key={p.id}
                                                        onClick={() => selectOldPatient(p)}
                                                        className="w-full flex items-center justify-between p-4 hover:bg-primary/5 transition-all text-left rounded-xl group/item"
                                                    >
                                                        <div className="flex-1">
                                                            <div className="font-heading font-bold text-foreground flex items-center gap-2">
                                                                {p.title} {p.name}
                                                                {p.registration_id && (
                                                                    <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full uppercase tracking-widest font-black">
                                                                        {p.registration_id}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="text-sm text-muted-foreground font-medium flex items-center gap-2">
                                                                <span>{p.phone || 'No Phone'}</span>
                                                                <span>·</span>
                                                                <span>{formatAge(p)}</span>
                                                                <span>·</span>
                                                                <span>{p.sex}</span>
                                                            </div>
                                                            {p.address && (
                                                                <div className="text-[11px] text-muted-foreground/60 italic mt-0.5 line-clamp-1 flex items-center gap-1">
                                                                    <MapPin className="w-3 h-3" /> {p.address}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="text-right hidden md:flex flex-col items-end">
                                                            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-0.5">Reg ID</div>
                                                            <div className="text-sm font-mono font-bold text-primary/80">{p.registration_id || 'N/A'}</div>
                                                        </div>
                                                    </button>
                                                ))}
                                                {searchResults.length === 0 && (
                                                    <div className="p-8 text-center space-y-3">
                                                        <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto">
                                                            <Search className="w-6 h-6 text-muted-foreground/40" />
                                                        </div>
                                                        <p className="text-sm text-muted-foreground font-medium">No patients found for "{searchQuery}"</p>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="bg-muted/50 p-3 border-t border-border flex justify-center">
                                                <Button 
                                                    variant="ghost" 
                                                    size="sm" 
                                                    className="text-xs font-bold text-primary gap-2"
                                                    onClick={() => {
                                                        setPatient(prev => ({ ...prev, name: searchQuery, phone: /^\d+$/.test(searchQuery) ? searchQuery : '' }));
                                                        setSearchResults([]);
                                                        setSearchQuery('');
                                                    }}
                                                >
                                                    <UserPlus className="w-3.5 h-3.5" /> Register This as New Patient
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="h-6 w-px bg-border hidden md:block" />
                                <div className="flex gap-2 w-full md:w-auto">
                                    <Button 
                                        onClick={() => { reset(); setSearchQuery(''); }}
                                        variant="outline" 
                                        className="h-14 rounded-xl px-6 border-border font-bold text-muted-foreground flex-1 hover:bg-muted"
                                    >
                                        Clear
                                    </Button>
                                    <Button 
                                        variant="default" 
                                        className="h-14 rounded-xl px-8 font-bold shadow-lg shadow-primary/20 flex-1 hover:scale-[1.02] transition-transform"
                                        onClick={() => {
                                            setSearchResults([]);
                                            setSearchQuery('');
                                        }}
                                    >
                                        <UserPlus className="w-5 h-5 mr-2" /> New Patient
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Registration Form */}
                <Card className="border-border shadow-lg animate-in slide-in-from-bottom-4 duration-500 overflow-hidden bg-background dark:bg-slate-900/50">
                    <CardHeader className="bg-muted/30 border-b border-border py-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-xl font-heading font-bold text-foreground">Patient Details</CardTitle>
                                <CardDescription className="font-medium text-muted-foreground">Complete information for the new registration</CardDescription>
                            </div>
                            <div className="hidden sm:block">
                                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1 text-right">System ID</div>
                                <div className="text-xs font-mono font-bold bg-background py-1 px-3 rounded-lg border border-border text-muted-foreground">
                                    PENDING GENERATION
                                </div>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-8 space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-6">
                                <div className="space-y-3">
                                    <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 bg-primary rounded-full"></div> Patient Identity
                                    </Label>
                                    <div className="grid grid-cols-4 gap-3">
                                        <div className="col-span-1">
                                            <Select value={patient.title} onValueChange={v => setPatient(p => ({ ...p, title: v }))}>
                                                <SelectTrigger className="h-12 rounded-xl focus:ring-primary/10 border-border bg-card"><SelectValue placeholder="Ti" /></SelectTrigger>
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
                                            <Input 
                                                ref={nameRef}
                                                className="h-12 rounded-xl focus:ring-primary/10 border-border bg-card placeholder:text-muted-foreground/30 font-medium" 
                                                value={patient.name} 
                                                onChange={e => setPatient(p => ({ ...p, name: e.target.value }))} 
                                                onKeyDown={(e) => handleKeyDown(e, ageRef)}
                                                placeholder="Full Name" 
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 bg-primary rounded-full"></div> Medical Profile
                                    </Label>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="flex flex-col gap-2">
                                            <div className="flex gap-2">
                                                <Input
                                                    ref={ageRef}
                                                    type="number"
                                                    step="0.1"
                                                    value={patient.age}
                                                    onChange={e => {
                                                        const val = parseFloat(e.target.value);
                                                        if (val > 1000) return;
                                                        setPatient(p => ({ ...p, age: e.target.value }));
                                                    }}
                                                    onKeyDown={(e) => handleKeyDown(e, phoneRef)}
                                                    placeholder="Age"
                                                    className="h-12 rounded-xl focus:ring-primary/10 border-border bg-card font-medium flex-1"
                                                />
                                                <Select value={ageUnit} onValueChange={(v: any) => {
                                                    setAgeUnit(v);
                                                }}>
                                                    <SelectTrigger className="h-12 w-[85px] rounded-xl focus:ring-primary/10 border-border bg-card"><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="years">Yrs</SelectItem>
                                                        <SelectItem value="months">Mo</SelectItem>
                                                        <SelectItem value="days">Day</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                        <Select
                                            value={patient.sex}
                                            onValueChange={v => {
                                                setPatient(p => ({ ...p, sex: v }));
                                            }}
                                        >
                                            <SelectTrigger className="h-12 rounded-xl focus:ring-primary/10 border-border bg-card font-medium">
                                                <SelectValue placeholder="Gender" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Male">Male</SelectItem>
                                                <SelectItem value="Female">Female</SelectItem>
                                                <SelectItem value="Other">Other</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div className="space-y-3">
                                    <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 bg-primary rounded-full"></div> Contact Information
                                    </Label>
                                    <Input
                                        ref={phoneRef}
                                        type="tel"
                                        inputMode="tel"
                                        className="h-12 rounded-xl focus:ring-primary/10 border-border bg-card font-medium placeholder:text-muted-foreground/30"
                                        value={patient.phone}
                                        onChange={e => {
                                            const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                                            setPatient(p => ({ ...p, phone: val }));
                                        }}
                                        onKeyDown={(e) => handleKeyDown(e, addressRef)}
                                        placeholder="Phone Number (10 digits)"
                                    />
                                </div>

                                <div className="space-y-3">
                                    <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 bg-primary rounded-full"></div> Location
                                    </Label>
                                    <Input 
                                        ref={addressRef}
                                        className="h-12 rounded-xl focus:ring-primary/10 border-border bg-card font-medium placeholder:text-muted-foreground/30" 
                                        value={patient.address} 
                                        onChange={e => setPatient(p => ({ ...p, address: e.target.value }))} 
                                        onKeyDown={(e) => handleKeyDown(e)}
                                        placeholder="Full Address" 
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="pt-4 border-t border-border -mx-6 px-6 bg-muted/20 flex justify-center md:justify-end pb-8">
                            <Button onClick={handleNewPatientNext} size="lg" className="w-full md:w-auto h-14 px-10 rounded-xl font-bold text-lg shadow-xl shadow-primary/20 hover:translate-y-[-2px] hover:shadow-primary/30 active:translate-y-[0px] transition-all">
                                Continue — Record Vitals <ChevronDown className="w-5 h-5 ml-2" />
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        )}

        {step === 'vitals' && (
          <Card className="animate-fade-in shadow-2xl border-primary/20 max-w-4xl mx-auto overflow-hidden bg-card">
            <CardHeader className="bg-primary/5 py-8 border-b border-primary/10">
                <div className="flex items-center justify-between">
                    <div className="space-y-1">
                        <CardDescription className="text-primary font-bold uppercase tracking-widest text-[10px]">Vitals Pre-Consultation</CardDescription>
                        <CardTitle className="text-2xl font-heading font-black text-foreground">Recording Vitals: {patient.title} {patient.name}</CardTitle>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="pt-10 space-y-10 pb-10">
              <div className="bg-primary/5 p-4 rounded-xl border border-primary/10">
                 <Label className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2 mb-3">Route to Specific Doctor (Optional)</Label>
                 <Select value={assignedDoctorId} onValueChange={setAssignedDoctorId}>
                     <SelectTrigger className="h-14 rounded-2xl border-border bg-card font-bold text-lg focus:ring-primary/10">
                         <SelectValue placeholder="General Queue" />
                     </SelectTrigger>
                     <SelectContent>
                         <SelectItem key="general" value="general" className="font-bold">General Queue (Any Doctor)</SelectItem>
                         {doctorOptions.map(doc => (
                             <SelectItem key={doc.assignId} value={doc.assignId}>
                               <div className="flex flex-col">
                                 <span className="font-bold">Dr. {doc.full_name}</span>
                                 <span className="text-[10px] text-muted-foreground uppercase tracking-tight">
                                   {doc.role === 'owner' ? 'Clinic Owner' : 'Doctor'} {doc.email ? `(${doc.email})` : ''}
                                 </span>
                               </div>
                             </SelectItem>
                         ))}
                     </SelectContent>
                 </Select>
                 <p className="text-[10px] text-muted-foreground mt-2 font-medium">If left unassigned, this visit will appear in the general waiting list for all active doctors.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                <div className="space-y-3">
                  <Label className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">Weight <span className="text-muted-foreground/40">(kg)</span></Label>
                  <Input
                    ref={weightRef}
                    className="h-14 rounded-2xl text-xl font-bold border-border bg-card focus:ring-primary/10"
                    type="number"
                    step="0.1"
                    min="0"
                    max="300"
                    value={vitals.weight}
                    onChange={e => {
                        const val = parseFloat(e.target.value);
                        if (val > 300) return;
                        setVitals(v => ({ ...v, weight: e.target.value }));
                    }}
                    onKeyDown={(e) => handleKeyDown(e, sbpRef)}
                  />
                </div>
                <div className="space-y-3">
                  <Label className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">Blood Pressure <span className="text-muted-foreground/40">(mmHg)</span></Label>
                  <div className="flex items-center gap-3">
                    <Input
                      ref={sbpRef}
                      placeholder="Sys"
                      inputMode="numeric"
                      value={vitals.blood_pressure.split('/')[0] || ''}
                      onChange={e => {
                        const sbp = e.target.value.replace(/\D/g, '').slice(0, 3);
                        if (parseInt(sbp) > 300) return;
                        const dbp = vitals.blood_pressure.split('/')[1] || '';
                        setVitals(v => ({ ...v, blood_pressure: `${sbp}/${dbp}`.replace(/^\/|\/$/g, '') }));
                        if (sbp.length >= 3) {
                          dbpRef.current?.focus();
                        }
                      }}
                      onKeyDown={(e) => handleKeyDown(e, dbpRef)}
                      className="h-14 rounded-2xl text-xl font-bold text-center border-border bg-card focus:ring-primary/10"
                    />
                    <span className="text-primary font-black text-2xl">/</span>
                    <Input
                      ref={dbpRef}
                      id="dbp-input"
                      placeholder="Dia"
                      inputMode="numeric"
                      value={vitals.blood_pressure.split('/')[1] || ''}
                      onChange={e => {
                        const sbp = vitals.blood_pressure.split('/')[0] || '';
                        const dbp = e.target.value.replace(/\D/g, '').slice(0, 3);
                        if (parseInt(dbp) > 300) return;
                        setVitals(v => ({ ...v, blood_pressure: `${sbp}/${dbp}`.replace(/^\/|\/$/g, '') }));
                        if (dbp.length >= 3) {
                          pulseRef.current?.focus();
                        }
                      }}
                      onKeyDown={(e) => handleKeyDown(e, pulseRef)}
                      className="h-14 rounded-2xl text-xl font-bold text-center border-border bg-card focus:ring-primary/10"
                    />
                  </div>
                </div>
                <div className="space-y-3">
                  <Label className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">Pulse Rate <span className="text-muted-foreground/40">(bpm)</span></Label>
                  <Input
                    ref={pulseRef}
                    id="pulse-input"
                    className="h-14 rounded-2xl text-xl font-bold border-border bg-card focus:ring-primary/10"
                    type="number"
                    min="0"
                    max="250"
                    value={vitals.pulse_rate}
                    onChange={e => {
                        const val = parseInt(e.target.value);
                        if (val > 250) return;
                        setVitals(v => ({ ...v, pulse_rate: e.target.value }));
                    }}
                    onKeyDown={(e) => handleKeyDown(e, spo2Ref)}
                  />
                </div>
                <div className="space-y-3">
                  <Label className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">SpO2 <span className="text-muted-foreground/40">(%)</span></Label>
                  <Input
                    ref={spo2Ref}
                    className="h-14 rounded-2xl text-xl font-bold border-border bg-card focus:ring-primary/10"
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={vitals.spo2}
                    onChange={e => {
                        const val = parseFloat(e.target.value);
                        if (val > 100) return;
                        setVitals(v => ({ ...v, spo2: e.target.value }));
                    }}
                    onKeyDown={(e) => handleKeyDown(e, tempRef)}
                  />
                </div>
                <div className="space-y-3">
                  <Label className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">Temperature <span className="text-muted-foreground/40">(°F)</span></Label>
                  <Input
                    ref={tempRef}
                    className="h-14 rounded-2xl text-xl font-bold border-border bg-card focus:ring-primary/10"
                    type="number"
                    step="0.1"
                    min="90"
                    max="110"
                    value={vitals.temperature}
                    onChange={e => {
                        const val = parseFloat(e.target.value);
                        if (val > 110) return;
                        setVitals(v => ({ ...v, temperature: e.target.value }));
                    }}
                    onKeyDown={(e) => handleKeyDown(e, cbgRef)}
                  />
                </div>
                <div className="space-y-3">
                  <Label className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">CBG <span className="text-muted-foreground/40">(mg/dL)</span></Label>
                  <Input
                    ref={cbgRef}
                    className="h-14 rounded-2xl text-xl font-bold border-border bg-card focus:ring-primary/10"
                    type="number"
                    min="0"
                    max="600"
                    value={vitals.cbg}
                    onChange={e => {
                        const val = parseInt(e.target.value);
                        if (val > 600) return;
                        setVitals(v => ({ ...v, cbg: e.target.value }));
                    }}
                    onKeyDown={(e) => handleKeyDown(e)}
                  />
                </div>
              </div>
              
              <div className="flex flex-col md:flex-row gap-4 pt-4">
                <Button variant="outline" size="lg" onClick={() => setStep('patient')} className="order-2 md:order-1 flex-1 h-14 rounded-2xl font-bold text-muted-foreground group border-border hover:bg-muted">
                    <ChevronDown className="w-5 h-5 mr-2 rotate-90 group-hover:-translate-x-1 transition-transform" /> Go Back
                </Button>
                <Button onClick={submitVisit} disabled={loading} size="lg" className="order-1 md:order-2 flex-[2] h-14 rounded-2xl font-black text-xl shadow-2xl shadow-primary/30">
                  {loading ? <Loader2 className="w-6 h-6 animate-spin mr-3 font-bold" /> : <CheckCircle className="w-6 h-6 mr-3" />}
                  Submit & Queue Patient
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}