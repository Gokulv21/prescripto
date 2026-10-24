import React from 'react';
import { User, Phone, Hash, ChevronRight } from 'lucide-react';
import { CandidatePatient } from '@/lib/nova/novaTools';

interface PatientSelectCardProps {
  patient: CandidatePatient;
  onSelect: (patientId: string) => void;
  disabled?: boolean;
}

export const PatientSelectCard: React.FC<PatientSelectCardProps> = ({ patient, onSelect, disabled }) => {
  const displayName = `${patient.title ? patient.title + ' ' : ''}${patient.name}`;

  return (
    <div 
      onClick={() => !disabled && onSelect(patient.id)}
      className="group relative flex items-center justify-between p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 hover:border-slate-400 dark:hover:border-slate-600 hover:shadow-md transition-all cursor-pointer active:scale-[0.98]"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 flex items-center justify-center shrink-0 font-bold border border-slate-200/60 dark:border-slate-700/60">
          {displayName.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
              {displayName}
            </h4>
            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold shrink-0">
              {patient.age}y / {patient.sex}
            </span>
          </div>
          <div className="flex items-center gap-3 text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
            {patient.phone && (
              <span className="flex items-center gap-1">
                <Phone className="w-2.5 h-2.5" />
                {patient.phone}
              </span>
            )}
            {(patient.registration_id || patient.reg_no) && (
              <span className="flex items-center gap-1">
                <Hash className="w-2.5 h-2.5" />
                {patient.registration_id || `Reg #${patient.reg_no}`}
              </span>
            )}
          </div>
        </div>
      </div>

      <button 
        disabled={disabled}
        className="shrink-0 flex items-center gap-1 text-[11px] font-bold text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 px-2.5 py-1.5 rounded-xl transition-colors ml-2 border border-slate-200 dark:border-slate-700"
      >
        <span>Select</span>
        <ChevronRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
