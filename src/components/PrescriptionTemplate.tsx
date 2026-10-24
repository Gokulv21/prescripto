import React, { useRef, useEffect, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { supabase } from "@/integrations/supabase/client";
import { format, formatDistanceToNow } from "date-fns";
import { formatAge, formatPrescriptionAge } from '@/lib/utils';
import prescriptionLogo from '@/assets/prescriptionLogo.png';

const EXPORT_W = 1240;
const EXPORT_H = 1754;

const renderFrequencyForPrescription = (freq: string) => {
  if (!freq) return '—';
  const parts = freq.trim().split('-');
  if (parts.length === 3) {
    return (
      <span style={{ display: 'inline-flex', gap: '4px', alignItems: 'center', fontWeight: 800 }}>
        {parts.map((part, index) => {
          const val = parseFloat(part);
          if (isNaN(val)) return <span key={index}>{part}</span>;
          if (val === 0) return <span key={index} style={{ color: '#cbd5e1' }}>0</span>;
          
          const integer = Math.floor(val);
          const fraction = val - integer;
          
          return (
            <span key={index} style={{ display: 'inline-flex', alignItems: 'baseline' }}>
              {integer > 0 && <span style={{ marginRight: '3px' }}>{integer}</span>}
              {fraction === 0.5 && (
                <span style={{ fontSize: '0.85em', fontWeight: 700, position: 'relative', top: '-0.05em' }}>
                  ½
                </span>
              )}
            </span>
          );
        }).reduce<React.ReactNode[]>((acc, elem, idx) => {
          if (idx === 0) return [elem];
          return [...acc, <span key={`dash-${idx}`} style={{ color: '#94a3b8', margin: '0 4px' }}>-</span>, elem];
        }, [])}
      </span>
    );
  }
  return freq;
};

interface VitalSign {
    label: string;
    value: any;
    unit: string;
}

interface PrescriptionTemplateProps {
    patient?: any;
    visit?: any;
    handwrittenImage?: string | string[] | null;
    diagnosis?: string;
    clinicalNotes?: string;
    medicines?: any[];
    advice?: string;
    isPrint?: boolean;
    isWritingMode?: boolean;
    // Audit data
    doctorId?: string;
    prescriptionCreatedAt?: string;
    hideShare?: boolean;
    // Overrides for doctor/clinic info
    doctorName?: string;
    doctorQualifications?: string;
    doctorRegId?: string;
    clinicName?: string;
    clinicAddress?: string;
    clinicPhone?: string;
    clinicLogo?: string;
    clinicWatermark?: string;
    clinicCaption?: string | null;
    headerMode?: 'name' | 'logo' | 'both';
    hideBranding?: boolean;
}

// Filter out invalid image data to prevent broken image icons
const isValidImage = (src: any): src is string =>
    typeof src === 'string' && src.length > 5 && (src.startsWith('data:image') || src.startsWith('http'));

const PrescriptionTemplate = React.memo(({
    patient, visit, handwrittenImage,
    diagnosis, clinicalNotes, medicines = [], advice, isPrint = false,
    isWritingMode = false,
    doctorId, prescriptionCreatedAt, hideShare = false,
    doctorName, doctorQualifications, doctorRegId,
    clinicName, clinicAddress, clinicPhone,
    clinicLogo: propClinicLogo,
    clinicWatermark: propClinicWatermark,
    clinicCaption: propClinicCaption,
    headerMode: propHeaderMode,
    hideBranding = false
}: PrescriptionTemplateProps) => {

    const { user: authUser } = useAuth();
    const [doctorProfile, setDoctorProfile] = useState<any>(null);
    const [ownerProfile, setOwnerProfile] = useState<any>(null);
    const [watermarkUrl, setWatermarkUrl] = useState<string | null>(propClinicWatermark || null);
    const [clinicLogoUrl, setClinicLogoUrl] = useState<string | null>(propClinicLogo || null);
    const [clinicCaption, setClinicCaption] = useState<string | null>(propClinicCaption ?? null);
    const [headerMode, setHeaderMode] = useState<'name' | 'logo' | 'both'>(propHeaderMode || 'name');

    useEffect(() => {
        const fetchProfiles = async () => {
            const targetClinicId = visit?.clinic_id || patient?.clinic_id;

            // 1. Fetch Clinic Branding & Watermark from clinics table, owner bio & storage
            if (targetClinicId) {
                try {
                    const { data: clinicData } = await supabase
                        .from('clinics')
                        .select('id, name, address, phone, owner_id')
                        .eq('id', targetClinicId)
                        .maybeSingle();
                    
                    if (clinicData) {
                        setOwnerProfile({
                            clinic_name: clinicData.name,
                            clinic_address: clinicData.address,
                            clinic_phone: clinicData.phone
                        });

                        // Check localStorage cache for instant updates
                        const cachedMode = localStorage.getItem(`prescripto_clinic_header_mode_${clinicData.id}`) as any;
                        if (cachedMode && ['name', 'logo', 'both'].includes(cachedMode) && !propHeaderMode) {
                            setHeaderMode(cachedMode);
                        }
                        const cachedWm = localStorage.getItem(`prescripto_clinic_watermark_${clinicData.id}`);
                        if (cachedWm && !propClinicWatermark) {
                            setWatermarkUrl(cachedWm);
                        }
                        const cachedCaption = localStorage.getItem(`prescripto_clinic_caption_${clinicData.id}`);
                        if (cachedCaption !== null && propClinicCaption === undefined) {
                            setClinicCaption(cachedCaption);
                        }

                        // Fetch owner bio if available
                        if (clinicData.owner_id) {
                            try {
                                const { data: ownerProf } = await supabase
                                    .from('profiles')
                                    .select('bio')
                                    .eq('user_id', clinicData.owner_id)
                                    .maybeSingle();
                                if (ownerProf?.bio) {
                                    const parsed = JSON.parse(ownerProf.bio);
                                    if (parsed.prescription_header_mode && !propHeaderMode && !cachedMode) {
                                        setHeaderMode(parsed.prescription_header_mode);
                                    }
                                    if (parsed.clinic_watermark && !propClinicWatermark && !cachedWm) {
                                        setWatermarkUrl(parsed.clinic_watermark);
                                    }
                                    if (parsed.clinic_photo && !propClinicLogo) {
                                        setClinicLogoUrl(parsed.clinic_photo);
                                    }
                                    if (parsed.clinic_caption !== undefined && propClinicCaption === undefined && cachedCaption === null) {
                                        setClinicCaption(parsed.clinic_caption);
                                    }
                                }
                            } catch (e) {}
                        }

                        // Fetch fresh files directly from Supabase Storage avatars bucket
                        try {
                            const { data: list } = await supabase.storage.from('avatars').list(clinicData.id);
                            const wmFile = list?.find(f => f.name.startsWith('clinic-watermark'));
                            if (wmFile && !propClinicWatermark) {
                                const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(`${clinicData.id}/${wmFile.name}`);
                                setWatermarkUrl(`${publicUrl}?t=${new Date(wmFile.updated_at || Date.now()).getTime()}`);
                            }
                            const brandFile = list?.find(f => f.name.startsWith('clinic-branding'));
                            if (brandFile && !propClinicLogo) {
                                const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(`${clinicData.id}/${brandFile.name}`);
                                setClinicLogoUrl(`${publicUrl}?t=${new Date(brandFile.updated_at || Date.now()).getTime()}`);
                            }
                        } catch (storageErr) {
                            console.warn("Avatars storage check warning:", storageErr);
                        }
                    }
                } catch (err) {
                    console.error("Error fetching clinic branding:", err);
                }
            }

            // 2. Fetch Doctor Profile for Identity
            let targetId = doctorId || visit?.doctor_id;
            const isSavedRecord = !!(prescriptionCreatedAt || visit?.created_at);

            if (!targetId && !isSavedRecord) {
                targetId = authUser?.id;
            }

            if (targetId) {
                try {
                    // Fetch the specific profile
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('*')
                        .eq('user_id', targetId)
                        .maybeSingle();

                    if (profile) {
                        setDoctorProfile(profile);
                        return;
                    }
                } catch (err) {
                    console.error("Error fetching specific doctor profile:", err);
                }
            }

            // Fallback: Fetch the primary/first doctor for historical records with no ID
            try {
                const { data: doctorRoles } = await supabase
                    .from('user_roles')
                    .select('user_id')
                    .in('role', ['doctor', 'owner'])
                    .order('created_at', { ascending: true });

                if (doctorRoles && doctorRoles.length > 0) {
                    const { data: profiles } = await supabase
                        .from('profiles')
                        .select('*')
                        .in('user_id', doctorRoles.map(r => r.user_id));

                    if (profiles && profiles.length > 0) {
                        setDoctorProfile(profiles[0]);
                    }
                }
            } catch (err) {
                console.error("Error fetching fallback doctor profile:", err);
            }
        };
        fetchProfiles();
    }, [authUser, doctorId, prescriptionCreatedAt, visit?.clinic_id]);


    // Always prioritize the patient's entry registration time (visit.created_at) over the save time
    const displayDate = visit?.created_at
        ? new Date(visit.created_at)
        : (prescriptionCreatedAt ? new Date(prescriptionCreatedAt) : new Date());
    const today = displayDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const time = displayDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

    const shareToWhatsApp = () => {
        const patientPhone = patient?.phone || '';

        // Format phone number: remove non-digits
        let cleanPhone = patientPhone.replace(/\D/g, '');
        // If it's a 10-digit number, assume India (+91)
        if (cleanPhone.length === 10) {
            cleanPhone = '91' + cleanPhone;
        }

        const patientName = (patient?.title ? patient.title + ' ' : '') + (patient?.name ?? 'Patient');
        const resolvedDoctorName = doctorName || doctorProfile?.full_name || 'Dr. Gokul';
        const resolvedClinicName = clinicName || ownerProfile?.clinic_name || doctorProfile?.clinic_name || 'GV Clinic';
        const publicLink = visit?.id ? `${window.location.origin}/prescripto/rx/${visit.id}` : '';
        if (!publicLink) {
            toast.error("Visit data missing, cannot share.");
            return;
        }

        const message = `Hello ${patientName},  

Your prescription 📝 from ${resolvedDoctorName} (${resolvedClinicName}) is ready.  
Access it here:  👇🏻 

🔗 ${publicLink}  

Follow the instructions carefully.  
💖 Wishing you a quick recovery!  

— ${resolvedClinicName}`;

        const encodedMsg = encodeURIComponent(message);
        const whatsappUrl = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedMsg}`;

        window.open(whatsappUrl, '_blank');
    };

    const vitals = [
        { label: 'Weight', value: visit?.weight, unit: ' kg' },
        { label: 'BP', value: visit?.blood_pressure, unit: ' mmHg' },
        { label: 'Pulse', value: visit?.pulse_rate, unit: ' /min' },
        { label: 'SpO₂', value: visit?.spo2, unit: ' %' },
        { label: 'Temp', value: visit?.temperature, unit: ' °F' },
        { label: 'CBG', value: visit?.cbg, unit: ' mg/dL' },
    ];

    // 1. Data Normalization
    const rawMedicines = Array.isArray(medicines) ? medicines : (() => {
        if (typeof medicines === 'string' && medicines.trim().startsWith('[')) {
            try { return JSON.parse(medicines); } catch (e) { return []; }
        }
        return [];
    })();
    const safeMedicines = Array.isArray(rawMedicines) ? rawMedicines : [];

    // 2. Multi-page parsing logic for handwriting
    let rawImages: (string | null)[] = [];
    if (Array.isArray(handwrittenImage)) {
        rawImages = handwrittenImage;
    } else if (typeof handwrittenImage === 'string' && handwrittenImage.startsWith('[')) {
        try { rawImages = JSON.parse(handwrittenImage); } catch (e) { rawImages = [handwrittenImage]; }
    } else {
        rawImages = [handwrittenImage as string | null];
    }

    const images = rawImages.filter(isValidImage);
    const hasHandwritingInThisComponent = images.length > 0;
    
    // Normalize text content
    const safeDiagnosis = (diagnosis || (typeof visit?.diagnosis === 'string' ? visit.diagnosis : '') || '').trim();
    const safeNotes = (clinicalNotes || '').trim();
    const safeAdvice = (advice || '').trim();

    // Visibility logic - be inclusive, don't hide data!
    const hasTyped = !!(safeDiagnosis || safeNotes || (safeMedicines && safeMedicines.length > 0) || (safeAdvice && !isValidImage(safeAdvice)));
    
    // We only hide typed diagnosis if we are in Writing Mode AND we actually have images to show.
    const hideTypedDiagnosis = isWritingMode && hasHandwritingInThisComponent;

    // Determine what to show
    const showHandwritten = hasHandwritingInThisComponent;

    // Use images as pages if they exist, otherwise just one page for typed content
    const pagesToShow = (showHandwritten) ? images : [null];

    return (
        <div className="flex flex-col items-center gap-8 w-full print-container print:gap-0">
            {pagesToShow.map((img, idx) => (
                <div
                    key={idx}
                    id={idx === 0 ? "prescription-template" : undefined}
                    className="single-page-prescription"
                    style={{
                        width: isPrint ? '210mm' : '100%',
                        maxWidth: isPrint ? undefined : '100%',
                        height: isPrint ? '296mm' : undefined,
                        minHeight: isPrint ? undefined : '500px',
                        margin: '0 auto',
                        aspectRatio: isPrint ? undefined : '1 / 1.414',
                        containerType: 'inline-size' as any,
                        position: 'relative',
                        overflow: isPrint ? 'hidden' : 'visible',
                        background: '#ffffff',
                        backgroundColor: '#ffffff',
                        boxSizing: 'border-box',
                        boxShadow: isPrint ? 'none' : '0 10px 40px rgba(0,0,0,0.12)',
                        flexShrink: 0,
                        pageBreakAfter: (isPrint && idx < pagesToShow.length - 1) ? 'always' : undefined,
                    }}
                >
                    {idx === 0 ? (
                        <PageOne
                            patient={patient}
                            visit={visit}
                            today={today}
                            time={time}
                            displayDate={displayDate}
                            clinicalNotes={safeNotes}
                            diagnosis={safeDiagnosis}
                            medicines={safeMedicines}
                            hasTyped={hasTyped}
                            vitals={vitals}
                            doctorProfile={doctorProfile}
                            isWritingMode={!!isWritingMode}
                            hideTypedDiagnosis={hideTypedDiagnosis}
                            safeDiagnosis={safeDiagnosis}
                            safeNotes={safeNotes}
                            safeAdvice={safeAdvice}
                            hasHandwritingInThisComponent={hasHandwritingInThisComponent}
                            // Props overrides
                            doctorName={doctorName}
                            doctorQualifications={doctorQualifications}
                            doctorRegId={doctorRegId}
                            clinicName={clinicName || ownerProfile?.clinic_name}
                            clinicAddress={clinicAddress || ownerProfile?.clinic_address}
                            clinicPhone={clinicPhone || ownerProfile?.clinic_phone}
                            clinicLogoUrl={clinicLogoUrl}
                            clinicCaption={clinicCaption}
                            headerMode={headerMode}
                            hideBranding={hideBranding}
                        />
                    ) : (
                        <div style={{ position: 'absolute', inset: 0, background: '#fff' }}>
                            <div style={{
                                position: 'absolute', top: '2em', right: '3em',
                                color: '#b0cde8', fontSize: '1.4cqw', fontWeight: 800
                            }}>
                                {!hideBranding && `${clinicName || ownerProfile?.clinic_name || 'Clinic'} — `}Continuation Page {idx + 1}
                            </div>
                        </div>
                    )}

                    {/* Clinic Watermark Overlay */}
                    {watermarkUrl && !hideBranding && (
                        <div
                            className="clinic-watermark-container"
                            style={{
                                position: 'absolute',
                                top: idx === 0 ? '18%' : '8%',
                                bottom: idx === 0 ? '8%' : '8%',
                                left: '8%',
                                right: '8%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                pointerEvents: 'none',
                                zIndex: 15,
                                overflow: 'hidden',
                                userSelect: 'none',
                            }}
                        >
                            <img
                                src={watermarkUrl}
                                alt="Prescription Watermark"
                                draggable={false}
                                style={{
                                    maxWidth: '65%',
                                    maxHeight: '65%',
                                    objectFit: 'contain',
                                    opacity: 0.08,
                                    filter: 'grayscale(40%)',
                                    pointerEvents: 'none',
                                    WebkitPrintColorAdjust: 'exact',
                                    printColorAdjust: 'exact',
                                }}
                            />
                        </div>
                    )}

                    {showHandwritten && isValidImage(img) && (
                        <img
                            src={img}
                            alt=""
                            draggable={false}
                            style={{
                                position: 'absolute', top: 0, left: 0,
                                width: '100%', height: '100%',
                                objectFit: 'contain', // Change back to contain for better quality
                                zIndex: 100, // Ensure it's on top of everything
                                pointerEvents: 'none',
                            }}
                        />
                    )}
                </div>
            ))}

            {/* WhatsApp Share Button - Screen Only */}
            {!isPrint && !hideShare && (
                <div className="mt-4 mb-8 print:hidden">
                    <button
                        onClick={shareToWhatsApp}
                        className="flex items-center gap-2 px-8 py-3 bg-[#25D366] hover:bg-[#20ba59] text-white font-black uppercase tracking-widest text-[10px] rounded-full shadow-xl transition-all hover:scale-105 active:scale-95"
                    >
                        <MessageCircle className="w-4 h-4" />
                        Share to WhatsApp
                    </button>
                </div>
            )}
        </div>
    );
});

interface PageOneProps {
    patient: any;
    visit: any;
    today: string;
    time: string;
    displayDate?: Date;
    clinicalNotes?: string;
    diagnosis?: string;
    medicines: any[];
    advice?: string;
    hasTyped: boolean;
    doctorProfile: any;
    vitals: { label: string; value: any; unit: string }[];
    isWritingMode: boolean;
    hideTypedDiagnosis: boolean;
    safeDiagnosis: string;
    safeNotes: string;
    safeAdvice: string;
    hasHandwritingInThisComponent: boolean;
    // Overrides
    doctorName?: string;
    doctorQualifications?: string;
    doctorRegId?: string;
    clinicName?: string;
    clinicAddress?: string;
    clinicPhone?: string;
    clinicLogoUrl?: string | null;
    clinicCaption?: string | null;
    headerMode?: 'name' | 'logo' | 'both';
    hideBranding?: boolean;
}

function PageOne({
    patient, visit, today, time, displayDate, clinicalNotes, diagnosis, medicines, advice,
    hasTyped, vitals, doctorProfile, isWritingMode,
    hideTypedDiagnosis, safeDiagnosis, safeNotes, safeAdvice, hasHandwritingInThisComponent,
    doctorName, doctorQualifications, doctorRegId,
    clinicName, clinicAddress, clinicPhone,
    clinicLogoUrl,
    clinicCaption,
    headerMode = 'name',
    hideBranding = false
}: PageOneProps) {

    // Resolve display values with priority: Prop Override > Fetched Profile > Hardcoded Default
    const dispDoctorName = doctorName || doctorProfile?.full_name || 'Dr V Aravind';
    const dispQualifications = doctorQualifications || doctorProfile?.qualifications || 'MBBS., CCEBDM., (PHFI)';
    const dispRegId = doctorRegId || doctorProfile?.registration_id || '152590';
    const dispClinicName = clinicName || doctorProfile?.clinic_name || 'GV Clinic';
    const dispClinicAddress = clinicAddress || doctorProfile?.clinic_address || '742, SSR Complex, Saththanur – 606 706';
    const dispClinicPhone = clinicPhone || doctorProfile?.clinic_phone || '+91-9488017536';
    const dispClinicCaption = clinicCaption !== null && clinicCaption !== undefined ? clinicCaption : '24/7 Emergency · ECG · Lab';

    return (
        <div
            id="rx-inner"
            style={{
                position: 'absolute', inset: 0,
                display: 'flex', flexDirection: 'column',
                fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
                fontSize: '1.8cqw', // Further increased base font size
                color: '#0f172a',
                overflow: 'visible',
            }}
        >
            <div className="margin-line margin-line-left" />
            <div className="margin-line margin-line-right" />

            {/* ── HEADER ─────────────────────────────────────── */}
            {hideBranding ? (
                <div style={{ height: '72mm', flexShrink: 0, background: '#fff', borderBottom: '1px solid #e2e8f0' }} />
            ) : (
                <div style={{
                    background: '#fff',
                    padding: '1.4em 2em',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    position: 'relative', overflow: 'hidden', flexShrink: 0,
                    borderBottom: '1px solid #e2e8f0',
                }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6em' }}>
                        <div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
                            <img
                                src={prescriptionLogo}
                                alt="Clinic Logo"
                                style={{
                                    height: '5.2em', // Precisely tuned to match text block height
                                    width: 'auto',
                                    objectFit: 'contain',
                                    flexShrink: 0,
                                    display: 'block',
                                    // This filter approximates #0f172a (Slate 900) for a black logo
                                    filter: 'brightness(0) saturate(100%) invert(8%) sepia(21%) saturate(2853%) hue-rotate(191deg) brightness(91%) contrast(94%)'
                                }}
                            />
                        </div>

                        <div>
                            <div style={{ fontWeight: 800, color: '#334155', fontSize: '2em', lineHeight: 1, letterSpacing: '0.01em' }}>
                                {dispDoctorName}
                            </div>
                            <div style={{ color: '#475569', fontSize: '0.9em', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: '0.3em' }}>
                                {dispQualifications}
                            </div>
                            <div style={{ color: '#475569', fontSize: '0.85em', fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                                {dispRegId ? `Reg. No: ${dispRegId}` : 'Reg. No: 152590'}
                            </div>
                            <div style={{ color: '#64748b', fontSize: '0.8em', fontWeight: 600, marginTop: '0.1em' }}>
                                பொதுநலம் மற்றும் சர்க்கரை நோய் நிபுணர்
                            </div>
                        </div>
                    </div>
                    {/* RIGHT — Clinic Branding & Info (Clinic Name is ALWAYS ON; Dedicated slot for Logo before Name) */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '1.2em' }}>
                        {clinicLogoUrl && headerMode !== 'name' && (
                            <div style={{
                                height: '5.2em',
                                maxWidth: '7em',
                                minWidth: '4.2em',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0
                            }}>
                                <img
                                    src={clinicLogoUrl}
                                    alt={dispClinicName || 'Clinic Logo'}
                                    style={{
                                        maxHeight: '100%',
                                        maxWidth: '100%',
                                        width: 'auto',
                                        height: 'auto',
                                        objectFit: 'contain',
                                        display: 'block'
                                    }}
                                />
                            </div>
                        )}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center' }}>
                            <div style={{ fontWeight: 900, color: '#7d326cff', fontSize: '3.2em', letterSpacing: '0.04em', lineHeight: 1, textAlign: 'right' }}>
                                {dispClinicName}
                            </div>
                            {dispClinicCaption ? (
                                <div style={{ color: '#475569', fontSize: '0.8em', marginTop: '0.4em', letterSpacing: '0.15em', fontWeight: 800, textAlign: 'right' }}>
                                    {dispClinicCaption}
                                </div>
                            ) : null}
                            <div style={{ color: '#64748b', fontSize: '0.75em', marginTop: '0.2em', letterSpacing: '0.02em', fontWeight: 500, textAlign: 'right' }}>
                                {dispClinicAddress}
                            </div>
                            <div style={{ color: '#64748b', fontSize: '0.75em', marginTop: '0.2em', letterSpacing: '0.02em', fontWeight: 500, textAlign: 'right' }}>
                                {dispClinicPhone}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {!hideBranding && <div style={{ height: '2px', flexShrink: 0, backgroundColor: '#0f172a' }} />}

            {/* ── PATIENT BAR ─────────────────────────────────── */}
            <div style={{
                background: '#fff',
                borderBottom: '2px solid #e2e8f0',
                display: 'grid', gridTemplateColumns: '1.8fr 1fr 1fr 0.8fr 0.8fr',
                padding: '0.8em 2em', gap: '1.2em', flexShrink: 0,
            }}>
                {[
                    { label: 'Patient Name', value: (patient?.title ? patient.title + ' ' : '') + (patient?.name ?? '—'), color: '#0f172a' },
                    { label: 'Age / Sex', value: patient ? `${formatPrescriptionAge(patient, displayDate)}/${patient.sex?.charAt(0) ?? '—'}` : '—' },
                    { label: 'Date', value: today },
                    { label: 'Time', value: time },
                    { label: 'Reg. ID', value: patient?.registration_id || (patient?.reg_no ? `REG-${patient.reg_no}` : '—') },
                ].map(({ label, value, color }) => (
                    <div key={label} style={{ overflow: 'hidden', minWidth: 0 }}>
                        <div style={{ fontSize: '0.75em', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
                        <div style={{ fontSize: '1.15em', fontWeight: 800, color: color || '#0f172a', marginTop: '0.2em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {value}
                        </div>
                    </div>
                ))}
            </div>

            {/* ── BODY (Rx left + Vitals right) ───────────────── */}
            <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
                {/* LEFT — Rx writing area */}
                <div style={{ flex: 1, position: 'relative', borderRight: '2px solid #e2e8f0', padding: '1.2em 1.5em', display: 'flex', flexDirection: 'column', background: '#fff', overflow: 'hidden' }}>
                    <div style={{ height: '0.1em', flexShrink: 0 }} />
                    {hasTyped && (
                        <div style={{ lineHeight: 1.6, fontSize: '1.1em', overflow: 'hidden', zIndex: 30, position: 'relative' }}>
                            {safeNotes && (
                                <div style={{ marginBottom: '1.2em', color: '#334155' }}>
                                    <div style={{ fontWeight: 800, fontSize: '0.8em', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.05em', marginBottom: '0.4em' }}>Clinical Notes & History:</div>
                                    <div style={{ whiteSpace: 'pre-wrap', fontWeight: 500, borderLeft: '3px solid #e2e8f0', paddingLeft: '0.8em', fontStyle: 'italic' }}>{safeNotes}</div>
                                </div>
                            )}

                            {/* Diagnosis: Show it if it exists, hide only if redundant in writing mode */}
                            {!hideTypedDiagnosis && safeDiagnosis && (
                                <div style={{ marginBottom: '1.2em', color: '#1e293b' }}>
                                    <div style={{ fontWeight: 800, fontSize: '0.8em', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.05em', marginBottom: '0.4em' }}>Diagnosis:</div>
                                    <div style={{ fontWeight: 800, fontSize: '1.2em', color: '#0f172a' }}>{safeDiagnosis}</div>
                                </div>
                            )}

                            {(medicines && medicines.length > 0) && (
                                <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '0.8em', fontSize: '1.05em', border: '1px solid #e2e8f0', borderRadius: '0.5em', overflow: 'hidden' }}>
                                    <thead>
                                        <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #334155', textAlign: 'left' }}>
                                            <th style={{ padding: '0.8em 0.4em', fontSize: '0.7em', fontWeight: 900, color: '#334155', textTransform: 'uppercase', width: '2.5em', letterSpacing: '0.05em' }}>#</th>
                                            <th style={{ padding: '0.8em 0.4em', fontSize: '0.7em', fontWeight: 900, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Medicine Name</th>
                                            <th style={{ padding: '0.8em 0.4em', fontSize: '0.7em', fontWeight: 900, color: '#334155', textTransform: 'uppercase', width: '7em', letterSpacing: '0.05em' }}>Route</th>
                                            <th style={{ padding: '0.8em 0.4em', fontSize: '0.7em', fontWeight: 900, color: '#334155', textTransform: 'uppercase', width: '6.5em', letterSpacing: '0.05em' }}>Dosage</th>
                                            <th style={{ padding: '0.8em 0.4em', fontSize: '0.7em', fontWeight: 900, color: '#334155', textTransform: 'uppercase', width: '5.5em', letterSpacing: '0.05em' }}>Freq.</th>
                                            <th style={{ padding: '0.8em 0.4em', fontSize: '0.7em', fontWeight: 900, color: '#334155', textTransform: 'uppercase', width: '4.5em', letterSpacing: '0.05em' }}>Dur.</th>
                                            <th style={{ padding: '0.8em 0.4em', fontSize: '0.7em', fontWeight: 900, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Instructions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {Array.isArray(medicines) && medicines.map((m, i) => (
                                            <tr key={i} style={{ 
                                                borderBottom: '1px solid #f1f5f9',
                                                backgroundColor: i % 2 === 0 ? '#ffffff' : '#f8fafc'
                                            }}>
                                                <td style={{ padding: '0.8em 0.4em', fontWeight: 700, verticalAlign: 'top', color: '#64748b' }}>{i + 1}</td>
                                                <td style={{ padding: '0.8em 0.4em', fontWeight: 800, verticalAlign: 'top' }}>
                                                    <div style={{ color: '#0f172a', fontSize: '1.05em' }}>{m?.type} {m?.name}</div>
                                                </td>
                                                <td style={{ padding: '0.8em 0.4em', fontWeight: 800, color: '#2563eb', verticalAlign: 'top', textTransform: 'uppercase', fontSize: '0.85em' }}>{m?.route || '—'}</td>
                                                <td style={{ padding: '0.8em 0.4em', fontWeight: 700, color: '#334155', verticalAlign: 'top' }}>{m?.dosage || m?.count || '—'}</td>
                                                <td style={{ padding: '0.8em 0.4em', fontWeight: 800, color: '#0f172a', verticalAlign: 'top' }}>{renderFrequencyForPrescription(m?.frequency)}</td>
                                                <td style={{ padding: '0.8em 0.4em', fontWeight: 700, color: '#475569', verticalAlign: 'top' }}>{m?.duration || '—'}</td>
                                                <td style={{ padding: '0.8em 0.4em', borderLeft: '1px solid #f1f5f9', verticalAlign: 'top' }}>
                                                    <div style={{ fontSize: '0.85em', fontWeight: 700, color: '#475569', fontStyle: 'italic', lineHeight: 1.4, opacity: 0.9 }}>{m?.notes || '—'}</div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                            {safeAdvice && !isValidImage(safeAdvice) && (
                                <div style={{ marginTop: '1.2em', borderTop: '1px dashed #e2e8f0', pt: '1em' }}>
                                    <div style={{ fontWeight: 800, fontSize: '0.8em', textTransform: 'uppercase', color: '#64748b', mb: '0.4em' }}>Advice / Instructions:</div>
                                    <div style={{ fontStyle: 'italic', color: '#475569', fontSize: '1em', fontWeight: 500 }}>{safeAdvice}</div>
                                </div>
                            )}
                            
                            {!hasTyped && !hasHandwritingInThisComponent && (
                                <div style={{ 
                                    marginTop: '4em', 
                                    padding: '2em', 
                                    border: '2px dashed #e2e8f0', 
                                    borderRadius: '1em',
                                    textAlign: 'center',
                                    color: '#94a3b8'
                                }}>
                                    <div style={{ fontWeight: 800, fontSize: '0.8em', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.5em' }}>Prescription Information</div>
                                    <div style={{ fontSize: '0.9em', fontWeight: 500 }}>No typed medications or handwriting found for this visit.</div>
                                </div>
                            )}
                        </div>
                    )}
                    {/* Prescription background is clean unless uploaded watermark exists */}

                    {/* Writing Grid */}
                    <div className="no-print" style={{ position: 'absolute', top: '5em', left: '1.5em', right: '1.5em', bottom: 0, backgroundImage: 'radial-gradient(circle, #cbd5e1 0.8px, transparent 0.8px)', backgroundSize: '1.8em 1.8em', pointerEvents: 'none', zIndex: 0, opacity: 0.4 }} />
                </div>

                {/* RIGHT — Vitals sidebar (Compact/Opulent) */}
                <div style={{ width: '24%', flexShrink: 0, backgroundColor: '#fff', display: 'flex', flexDirection: 'column', overflow: 'hidden', borderLeft: '1px solid #e2e8f0' }}>
                    <div style={{ color: '#0f172a', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', fontSize: '0.85em', textAlign: 'center', padding: '1em 0', borderBottom: '2px solid #0f172a', flexShrink: 0 }}>Clinical Vitals</div>
                    {vitals.map(({ label, value, unit }, i) => (
                        <div key={label} style={{ display: 'flex', alignItems: 'stretch', height: '3.2em', flexShrink: 0, borderBottom: `1px solid #f1f5f9` }}>
                            <div style={{ width: '50%', padding: '0 1em', fontWeight: 700, color: '#64748b', fontSize: '0.8em', borderRight: '1px solid #f1f5f9', display: 'flex', alignItems: 'center' }}>{label}</div>
                            <div style={{ flex: 1, padding: '0 0.8em', fontSize: '1.05em', fontWeight: 800, color: value != null && value !== '' ? '#0f172a' : '#cbd5e1', display: 'flex', alignItems: 'center' }}>
                                {value != null && value !== '' ? `${value}${unit}` : '–'}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── FOOTER ──────────────────────────────────────── */}
            {hideBranding ? (
                <div style={{ height: '22mm', flexShrink: 0, background: '#fff' }} />
            ) : (
                <div style={{ background: '#fff', borderTop: '2px solid #0f172a', padding: '1em 2em', display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, position: 'relative' }}>
                    {doctorProfile?.signature_data && !isWritingMode && (
                        <div style={{ position: 'absolute', right: '3.5em', bottom: '4.5em', textAlign: 'center' }}>
                            <img src={doctorProfile.signature_data} alt="Signature" style={{ maxHeight: '10em', width: 'auto', marginBottom: '0.3em', mixBlendMode: 'multiply' }} />
                            <div style={{ fontSize: '0.75em', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Digital Signature</div>
                        </div>
                    )}
                    <span style={{ color: '#475569', fontSize: '1em', fontWeight: 700, letterSpacing: '0.02em', textAlign: 'center' }}>
                        அடுத்த முறை வரும்போது இந்த மருந்துச்சீட்டை கொண்டு வரவும்
                    </span>
                    <span style={{ color: '#94a3b8', fontSize: '0.6em', fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase', alignSelf: 'flex-end', marginTop: '0.3em' }}>
                        Developed by Prescripto
                    </span>
                </div>
            )}
        </div>
    );
}

export default PrescriptionTemplate;
