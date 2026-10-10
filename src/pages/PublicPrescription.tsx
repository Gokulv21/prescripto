import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import PrescriptionTemplate from '@/components/PrescriptionTemplate';
import { Loader2, FileWarning, Printer, HelpCircle } from 'lucide-react';

const PublicPrescription = () => {
    const { visitId } = useParams();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchPrescription = async () => {
            if (!visitId) return;
            
            try {
                const { data: visitData, error: visitError } = await supabase
                    .from('visits')
                    .select('*, patients(*), prescriptions(*)')
                    .eq('id', visitId)
                    .maybeSingle();

                if (visitError) throw visitError;
                if (!visitData) {
                    setError("Prescription not found.");
                } else {
                    setData(visitData);
                }
            } catch (err: any) {
                console.error("Error fetching public prescription:", err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchPrescription();
    }, [visitId]);

    if (loading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
                <Loader2 className="w-10 h-10 animate-spin text-blue-600 mb-4" />
                <p className="text-slate-500 font-bold animate-pulse">Loading Prescription...</p>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6 text-center">
                <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-6">
                    <FileWarning className="w-10 h-10" />
                </div>
                <h1 className="text-2xl font-black text-slate-900 mb-2">Notice</h1>
                <p className="text-slate-500 font-medium mb-8 max-w-sm">
                    {error || "We couldn't find the prescription record you're looking for."}
                </p>
                <button 
                    onClick={() => window.location.reload()}
                    className="px-8 py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg hover:bg-blue-700 transition-all"
                >
                    Retry Loading
                </button>
            </div>
        );
    }

    const prescription = data.prescriptions?.[0];

    return (
        <div className="min-h-screen bg-slate-100 overflow-auto py-4 sm:py-8 px-2 sm:px-4 print-wrapper">
            <div className="max-w-4xl mx-auto mb-6 flex flex-col items-center gap-3 no-print">
               <div className="bg-blue-600 text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-md">
                   Official Digital Prescription
               </div>
               <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col items-center gap-1 text-center shadow-sm max-w-md">
                   <p className="text-amber-800 text-[13px] font-black uppercase tracking-tight">⚠️ Link Expires in 24 Hours</p>
                   <p className="text-amber-700 text-xs font-bold">Kindly save this as a PDF or Print it for your future records.</p>
               </div>
            </div>

            <PrescriptionTemplate 
                patient={data.patients}
                visit={data}
                doctorName={prescription?.doctor_name}
                doctorQualifications={prescription?.doctor_qualifications}
                doctorRegId={prescription?.doctor_reg_id}
                clinicName={prescription?.clinic_name}
                clinicAddress={prescription?.clinic_address}
                clinicPhone={prescription?.clinic_phone}
                diagnosis={prescription?.diagnosis}
                clinicalNotes={prescription?.clinical_notes}
                medicines={prescription?.medicines || []}
                advice={prescription?.advice_image}
                handwrittenImage={prescription?.advice_image}
                isWritingMode={prescription?.is_writing_mode}
                doctorId={prescription?.doctor_id}
                prescriptionCreatedAt={visit?.created_at || prescription?.created_at}
                isPrint={false}
                hideShare={true}
            />

            <div className="max-w-4xl mx-auto mt-12 flex flex-col items-center gap-6 pb-20 no-print">
                <button 
                    onClick={() => window.print()}
                    className="flex items-center gap-3 px-10 py-4 bg-slate-900 text-white font-black uppercase tracking-widest text-xs rounded-2xl shadow-2xl hover:bg-slate-800 transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                    <Printer className="w-5 h-5" />
                    Save as PDF / Print
                </button>

                <div className="flex flex-col items-center gap-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Generated via GV Clinic Portal</p>
                    <div className="flex items-center gap-4 text-[11px] font-bold text-slate-500">
                        <a href="mailto:support@gvclinic.com" className="flex items-center gap-1.5 hover:text-blue-600 transition-colors">
                            <HelpCircle className="w-4 h-4" />
                            Contact Support
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PublicPrescription;
