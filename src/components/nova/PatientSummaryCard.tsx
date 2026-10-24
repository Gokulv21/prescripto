import React from 'react';
import { Activity, Pill, Calendar, ArrowRight } from 'lucide-react';
import { PatientDetailedProfile } from '@/lib/nova/novaTools';
import { useNavigate } from 'react-router-dom';

interface PatientSummaryCardProps {
  detail: PatientDetailedProfile;
  slug?: string;
  onClose?: () => void;
}

export const PatientSummaryCard: React.FC<PatientSummaryCardProps> = ({ detail, slug, onClose }) => {
  const navigate = useNavigate();
  const p = detail.patient;
  const displayName = `${p.title ? p.title + ' ' : ''}${p.name}`;
  const lastVisit = detail.lastVisit;
  const recentRx = detail.recentPrescriptions[0];

  const handleOpenConsultation = () => {
    if (onClose) onClose();
    const targetPath = slug ? `/${slug}/consultation` : '/consultation';
    navigate(targetPath);
  };

  return (
    <div className="w-full rounded-2xl bg-gradient-to-b from-white to-slate-50 dark:from-slate-900 dark:to-slate-950 border border-slate-200/90 dark:border-slate-800/90 p-3.5 shadow-sm space-y-3">
      {/* Patient Header */}
      <div className="flex items-start justify-between border-b border-slate-200/60 dark:border-slate-800/60 pb-2.5">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-black text-slate-900 dark:text-white">
              {displayName}
            </h4>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border border-slate-200 dark:border-slate-700">
              {p.age} yrs • {p.sex}
            </span>
          </div>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
            Phone: {p.phone || 'N/A'} • {p.registration_id || `Reg #${p.reg_no || 'N/A'}`}
          </p>
        </div>

        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/40 dark:border-emerald-800/40">
          {detail.totalVisits} Total Visits
        </span>
      </div>

      {/* Last Visit Vitals & Diagnosis */}
      {lastVisit ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 dark:text-slate-300">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3 h-3 text-slate-500" />
              Last Visit: {lastVisit.date}
            </span>
            <span className="text-[10px] text-slate-400 font-normal">
              Token #{lastVisit.token_number}
            </span>
          </div>

          {/* Vitals Grid */}
          <div className="grid grid-cols-3 gap-1.5 text-center">
            {lastVisit.vitals.bp && (
              <div className="p-1.5 rounded-xl bg-slate-100/70 dark:bg-slate-800/60 border border-slate-200/40 dark:border-slate-700/40">
                <span className="text-[9px] uppercase font-bold text-slate-400 block">BP</span>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{lastVisit.vitals.bp}</span>
              </div>
            )}
            {lastVisit.vitals.pulse && (
              <div className="p-1.5 rounded-xl bg-slate-100/70 dark:bg-slate-800/60 border border-slate-200/40 dark:border-slate-700/40">
                <span className="text-[9px] uppercase font-bold text-slate-400 block">Pulse</span>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{lastVisit.vitals.pulse} bpm</span>
              </div>
            )}
            {lastVisit.vitals.weight && (
              <div className="p-1.5 rounded-xl bg-slate-100/70 dark:bg-slate-800/60 border border-slate-200/40 dark:border-slate-700/40">
                <span className="text-[9px] uppercase font-bold text-slate-400 block">Weight</span>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{lastVisit.vitals.weight} kg</span>
              </div>
            )}
          </div>

          {/* Diagnosis */}
          {lastVisit.diagnosis && (
            <div className="text-[11px] bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 p-2 rounded-xl flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span className="font-semibold">{lastVisit.diagnosis}</span>
            </div>
          )}
        </div>
      ) : (
        <div className="text-xs text-slate-500 italic py-1">
          No past clinical visits recorded for this patient yet.
        </div>
      )}

      {/* Recent Medications */}
      {recentRx && recentRx.medicinesSummary.length > 0 && (
        <div className="space-y-1 pt-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <Pill className="w-2.5 h-2.5" /> Recent Medicines ({recentRx.date})
          </span>
          <div className="flex wrap gap-1">
            {recentRx.medicinesSummary.map((med, idx) => (
              <span 
                key={idx}
                className="text-[10px] font-semibold px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 truncate max-w-full"
              >
                {med}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Action CTA */}
      <button
        onClick={handleOpenConsultation}
        className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold shadow-sm hover:brightness-110 active:scale-[0.98] transition-all"
      >
        <span>Open in Consultation Desk</span>
        <ArrowRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
