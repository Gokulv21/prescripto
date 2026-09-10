import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { 
  ClipboardList, PenTool, Eye, Loader2, RefreshCw, Save, 
  Search, X, Trash2, HeartPulse, Plus, ChevronDown, UserX, CloudLightning, Check, Cloud,
  AlertTriangle, Sparkles
} from 'lucide-react';
import { Medicine } from '@/types/consultation';
import { evaluateMedicineSafety, SafetyWarning } from '@/lib/medicalSafety';

const COMMON_FREQUENCIES = [
  '1-0-1', '1-1-1', '0-0-1', '1-0-0', '0-1-0', '1-1-0', '0-1-1', 
  'Stat', 'SOS', 'Twice daily', 'Thrice daily', 'Four times daily', 'Before food', 'After food'
];

interface ConsultationFormProps {
  selectedVisit: any;
  patient: any;
  diagnosis: string;
  setDiagnosis: (v: string) => void;
  diagnoses: string[];
  setDiagnoses: (v: string[]) => void;
  clinicalNotes: string;
  setClinicalNotes: (v: string) => void;
  medicines: Medicine[];
  setMedicines: (v: Medicine[]) => void;
  advice: string;
  setAdvice: (v: string) => void;
  saving: boolean;
  prescriptionImage: string | null;
  setPrescriptionImage: (v: string | null) => void;
  prescriptionPaths: any[];
  setPrescriptionPaths: (v: any[]) => void;
  isWritingMode: boolean;
  setIsWritingMode: (v: boolean) => void;
  lastInputWay: 'typing' | 'writing';
  setLastInputWay: (v: 'typing' | 'writing') => void;
  saveError: any;
  protocols: any[];
  diagnosisHistory: string[];
  isDraftRestored: boolean;
  savePrescription: () => void;
  markAsNoShow: () => void;
  addMedicine: () => void;
  removeMedicine: (i: number) => void;
  updateMedicine: (i: number, field: keyof Medicine, value: string) => void;
  handleMedicineKeyDown: (e: React.KeyboardEvent, index: number, fieldName: string) => void;
  addDiagnosisTag: (tag: string) => void;
  removeDiagnosisTag: (index: number) => void;
  applyProtocol: (protocol: any) => void;
  onOpenDigitalRx: () => void;
  onOpenPreview: () => void;
  syncStatus: string;
}

export default function ConsultationForm({
  selectedVisit,
  patient,
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
  savePrescription,
  markAsNoShow,
  addMedicine,
  removeMedicine,
  updateMedicine,
  handleMedicineKeyDown,
  addDiagnosisTag,
  removeDiagnosisTag,
  applyProtocol,
  onOpenDigitalRx,
  onOpenPreview,
  syncStatus,
}: ConsultationFormProps) {
  const [showProtocolDialog, setShowProtocolDialog] = useState(false);
  const [showDiagnosisSuggestions, setShowDiagnosisSuggestions] = useState(false);
  const [suggestionIndex, setSuggestionIndex] = useState(-1);
  const [openFreqPopoverIndex, setOpenFreqPopoverIndex] = useState<number | null>(null);

  const getPillState = (frequency: string) => {
    const parts = (frequency || '').trim().split('-');
    if (parts.length === 3) {
      return {
        m: parseFloat(parts[0]) || 0,
        a: parseFloat(parts[1]) || 0,
        n: parseFloat(parts[2]) || 0
      };
    }
    return { m: 0, a: 0, n: 0 };
  };

  const handlePillToggle = (index: number, currentFreq: string, pill: 'm' | 'a' | 'n') => {
    const state = getPillState(currentFreq);
    state[pill] = state[pill] > 0 ? 0 : 1;
    const newFreq = `${state.m}-${state.a}-${state.n}`;
    updateMedicine(index, 'frequency', newFreq);
  };

  const getSyncBadge = () => {
    if (syncStatus === 'syncing') {
      return (
        <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200 flex items-center gap-1">
          <Loader2 className="w-3 h-3 animate-spin" /> Saving draft to cloud...
        </Badge>
      );
    }
    if (syncStatus === 'offline_saved') {
      return (
        <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200 flex items-center gap-1">
          <CloudLightning className="w-3 h-3 text-amber-500 animate-bounce" /> Offline (Saved locally)
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="bg-slate-50 text-slate-500 border-slate-200 flex items-center gap-1">
        <Cloud className="w-3 h-3" /> Cloud Synced
      </Badge>
    );
  };

  return (
    <Card className="border-none shadow-sm overflow-hidden bg-card">
      <CardHeader className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-4 px-6 bg-muted/50">
        <div className="flex items-center justify-between w-full xl:w-auto">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-500/10 rounded-md">
              <ClipboardList className="w-4 h-4 text-blue-600" />
            </div>
            <CardTitle className="text-lg font-bold text-foreground">Prescription Details</CardTitle>
          </div>
          <div className="xl:hidden ml-2">{getSyncBadge()}</div>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="hidden xl:block">{getSyncBadge()}</div>
          <div className="flex items-center gap-1 bg-muted p-1 rounded-lg shrink-0 border border-border">
            <Button
              variant={!isWritingMode ? "secondary" : "ghost"}
              size="sm"
              onClick={() => {
                setIsWritingMode(false);
                setLastInputWay('typing');
              }}
              className={cn("h-8 px-3 text-[11px] font-bold", !isWritingMode && "bg-background shadow-sm")}
            >
              Typing Mode
            </Button>
            <Button
              variant={isWritingMode ? "secondary" : "ghost"}
              size="sm"
              onClick={() => {
                setIsWritingMode(true);
                setLastInputWay('writing');
              }}
              className={cn("h-8 px-3 text-[11px] font-bold", isWritingMode && "bg-background shadow-sm")}
            >
              Writing Mode
            </Button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (!isWritingMode) {
                toast.error("Please switch to Writing Mode first", {
                  description: "The Pen template is only available in Writing Mode.",
                  duration: 3000
                });
                return;
              }
              onOpenDigitalRx();
            }}
            className={cn(
              "h-10 px-6 bg-blue-600 text-white hover:bg-blue-700 transition-all shadow-lg rounded-xl border-none",
              !isWritingMode && "opacity-40"
            )}
          >
            <PenTool className="w-4 h-4 mr-2" />
            <span className="text-xs font-black uppercase tracking-widest">Open Signature & Pen Template</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {isWritingMode && (
            <div className={cn(
                "flex flex-col items-center justify-center p-8 rounded-[2rem] border-2 border-dashed transition-all",
                prescriptionImage ? "border-emerald-500/30 bg-emerald-500/5" : "border-border bg-muted/50"
            )}>
                {prescriptionImage ? (
                    <div className="relative group w-full max-w-md aspect-[1/1.414] bg-white rounded-2xl shadow-xl border overflow-hidden">
                        <img 
                            src={Array.isArray(prescriptionImage) ? prescriptionImage[0] : (prescriptionImage?.startsWith('[') ? JSON.parse(prescriptionImage)[0] : prescriptionImage)} 
                            alt="Handwritten Rx" 
                            className="w-full h-full object-contain" 
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                            <Button size="sm" onClick={onOpenDigitalRx} className="bg-white text-slate-900 hover:bg-slate-100 font-bold">Edit</Button>
                            <Button variant="destructive" size="sm" onClick={() => setPrescriptionImage(null)} className="font-bold">Clear</Button>
                        </div>
                    </div>
                ) : (
                    <div className="text-center space-y-4">
                        <div className="w-20 h-20 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto text-blue-600">
                            <PenTool className="w-10 h-10" />
                        </div>
                        <div className="space-y-1">
                            <p className="text-base font-black text-foreground">
                              {prescriptionPaths.flat().length > 0 ? "Handwriting Draft Available" : "No Pen Content Yet"}
                            </p>
                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                              {prescriptionPaths.flat().length > 0 
                                ? "Open Template to continue or Save to finalize" 
                                : "Tap 'Open Template' above to start writing"}
                            </p>
                        </div>
                    </div>
                )}
            </div>
        )}

        <div className="space-y-3 relative">
          <div className="flex items-center justify-between ml-1">
            <Label className="text-[12px] font-extrabold text-muted-foreground uppercase tracking-widest">Diagnosis</Label>
            {isWritingMode && (
              <Badge variant="outline" className="text-[9px] font-bold text-blue-600 bg-blue-50 border-blue-200 uppercase tracking-tighter">
                Required for Analytics
              </Badge>
            )}
          </div>
          
          <div className="min-h-[56px] p-2 bg-muted/50 border border-border rounded-xl focus-within:ring-2 focus-within:ring-blue-500 transition-all flex flex-wrap gap-2 items-center">
            {diagnoses.map((tag, idx) => (
              <Badge key={idx} variant="secondary" className="pl-3 pr-1 py-1 h-8 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold flex items-center gap-1 border border-slate-200 dark:border-slate-700 shadow-sm animate-in zoom-in-50">
                {tag}
                <button 
                  onClick={() => removeDiagnosisTag(idx)}
                  className="w-5 h-5 rounded-md hover:bg-red-50 hover:text-red-500 transition-colors flex items-center justify-center"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
            <Input 
              value={diagnosis} 
              onChange={e => {
                const val = e.target.value.toUpperCase();
                setDiagnosis(val);
                setShowDiagnosisSuggestions(true);
                setSuggestionIndex(-1);
                if (!isWritingMode) setLastInputWay('typing');
              }} 
              onKeyDown={e => {
                const filteredSuggestions = diagnosisHistory
                  .filter(h => h.toLowerCase().includes(diagnosis.toLowerCase()) && !diagnoses.includes(h))
                  .slice(0, 10);

                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setSuggestionIndex(prev => (prev < filteredSuggestions.length - 1 ? prev + 1 : prev));
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setSuggestionIndex(prev => (prev > 0 ? prev - 1 : -1));
                } else if (e.key === 'Enter') {
                  e.preventDefault();
                  if (suggestionIndex >= 0 && suggestionIndex < filteredSuggestions.length) {
                    addDiagnosisTag(filteredSuggestions[suggestionIndex]);
                  } else if (diagnosis.trim()) {
                    addDiagnosisTag(diagnosis);
                  }
                } else if (e.key === 'Backspace' && !diagnosis && diagnoses.length > 0) {
                  removeDiagnosisTag(diagnoses.length - 1);
                } else if (e.key === 'Escape') {
                  setShowDiagnosisSuggestions(false);
                  setSuggestionIndex(-1);
                }
              }}
              onFocus={() => {
                setShowDiagnosisSuggestions(true);
                setSuggestionIndex(-1);
              }}
              placeholder={diagnoses.length === 0 ? "Type diagnosis & press Enter..." : ""} 
              className="flex-1 border-none shadow-none bg-transparent h-9 focus-visible:ring-0 text-base font-bold min-w-[120px]"
            />
          </div>

          {showDiagnosisSuggestions && diagnosis.trim() && (
            <div className="absolute top-full left-0 w-full mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
               <div className="max-h-60 overflow-y-auto p-1">
                  {diagnosisHistory
                    .filter(h => h.toLowerCase().includes(diagnosis.toLowerCase()) && !diagnoses.includes(h))
                    .slice(0, 10)
                    .map((h, i) => (
                      <button 
                        key={i}
                        onClick={() => addDiagnosisTag(h)}
                        onMouseEnter={() => setSuggestionIndex(i)}
                        className={cn(
                          "w-full text-left px-4 py-2.5 text-sm font-bold rounded-lg transition-colors flex items-center gap-2",
                          suggestionIndex === i 
                            ? "bg-blue-600 text-white" 
                            : "hover:bg-blue-50 dark:hover:bg-blue-500/10 text-slate-700 dark:text-slate-300"
                        )}
                      >
                        <Search className={cn("w-3.5 h-3.5", suggestionIndex === i ? "text-white/70" : "text-slate-400")} />
                        {h}
                      </button>
                    ))
                  }
                  {diagnosisHistory.filter(h => h.toLowerCase().includes(diagnosis.toLowerCase()) && !diagnoses.includes(h)).length === 0 && (
                    <div className="px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-widest text-center">
                       New Diagnosis
                    </div>
                  )}
               </div>
            </div>
          )}
        </div>

        {!isWritingMode && (
          <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="space-y-3">
              <Label className="text-[12px] font-extrabold text-muted-foreground uppercase tracking-widest ml-1">Clinical Notes</Label>
              <Textarea 
                value={clinicalNotes} 
                onChange={e => {
                  setClinicalNotes(e.target.value);
                  setLastInputWay('typing');
                }} 
                placeholder="Enter clinical examination notes, symptoms, etc." 
                className="min-h-[120px] text-base font-bold bg-muted/50 border-border focus:bg-card focus:ring-blue-500 transition-all rounded-xl resize-none shadow-inner"
              />
            </div>
          </div>
        )}

        {!isWritingMode && (
          <div className="space-y-6 animate-in fade-in slide-in-from-top-6 duration-700">
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between ml-1">
                <Label className="text-[12px] font-extrabold text-muted-foreground uppercase tracking-widest">Medicines</Label>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => setShowProtocolDialog(true)} className="h-8 pr-3 pl-2 text-[11px] font-bold border-amber-500/20 text-amber-600 hover:bg-amber-500/10 bg-card rounded-lg">
                    <HeartPulse className="w-3.5 h-3.5 mr-1" /> Protocol List
                  </Button>
                </div>
              </div>
              <div className="space-y-3">
                {medicines.map((med, i) => {
                  const safetyWarnings = evaluateMedicineSafety(med.name, med.type, patient?.age);
                  return (
                    <div key={i} className="medicine-row flex flex-col gap-2 bg-muted/30 p-3 rounded-2xl border border-border group relative transition-all">
                      <div className="flex gap-2 items-start">
                        <div className="flex flex-col md:flex-row gap-3 flex-1">
                          <div className="md:w-32 shrink-0">
                            <p className="text-[9px] font-bold text-muted-foreground uppercase ml-1 mb-1">Type</p>
                            <select 
                              value={med.type} 
                              onChange={e => updateMedicine(i, 'type', e.target.value)}
                              onKeyDown={e => handleMedicineKeyDown(e, i, 'type')}
                              className="w-full h-10 text-sm font-bold border border-border bg-card rounded-lg px-2 focus:ring-2 focus:ring-blue-500 outline-none text-foreground"
                            >
                              <option value="Inj.">Inj.</option>
                              <option value="Supp.">Supp.</option>
                              <option value="Syp.">Syp.</option>
                              <option value="Tab.">Tab.</option>
                              <option value="Cap.">Cap.</option>
                              <option value="Oin.">Oin.</option>
                              <option value="cr.">cr.</option>
                              <option value="drops.">drops.</option>
                              <option value="Sac">Sac</option>
                            </select>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 flex-1">
                            <div className="md:col-span-3 space-y-1">
                              <p className="text-[9px] font-bold text-muted-foreground uppercase ml-1">Name</p>
                              <Input 
                                placeholder="Medicine Name" 
                                value={med.name} 
                                onChange={e => {
                                  updateMedicine(i, 'name', e.target.value);
                                  setLastInputWay('typing');
                                }}
                                onKeyDown={e => handleMedicineKeyDown(e, i, 'name')}
                                className="h-10 text-sm font-bold border-border bg-card rounded-lg" 
                              />
                            </div>

                            <div className="md:col-span-2 space-y-1">
                              <p className="text-[9px] font-bold text-muted-foreground uppercase ml-1">
                                {(med.type === 'Oin.' || med.type === 'cr.' || med.type === 'drops.' || med.type === 'Sac') ? 'Count' : 'Dosage'}
                              </p>
                              <Input 
                                placeholder={(med.type === 'Oin.' || med.type === 'cr.' || med.type === 'drops.' || med.type === 'Sac') ? "1 Tube / 1 Unit" : "500mg / 5ml"} 
                                value={med.dosage || med.count || ''} 
                                onChange={e => {
                                  const key = (med.type === 'Oin.' || med.type === 'cr.' || med.type === 'drops.' || med.type === 'Sac') ? 'count' : 'dosage';
                                  updateMedicine(i, key, e.target.value);
                                }} 
                                onKeyDown={e => handleMedicineKeyDown(e, i, 'dosage')} 
                                className="h-10 text-sm font-bold border-border bg-card rounded-lg placeholder:opacity-50" 
                              />
                            </div>

                            <div className="md:col-span-1 space-y-1">
                              <p className="text-[9px] font-bold text-blue-600 uppercase ml-1">Route</p>
                              <Input 
                                placeholder={med.type === 'Inj.' ? "I.M / I.V" : (med.type === 'Oin.' || med.type === 'cr.' ? "External" : "Oral")} 
                                value={med.route || ''} 
                                onChange={e => updateMedicine(i, 'route', e.target.value)} 
                                onKeyDown={e => handleMedicineKeyDown(e, i, 'route')} 
                                className="h-10 text-sm font-bold border-blue-500/20 bg-blue-500/5 rounded-lg text-blue-600 dark:text-blue-400 placeholder:text-blue-200/50" 
                              />
                            </div>

                            <div className="md:col-span-2 space-y-1">
                              <p className="text-[9px] font-bold text-purple-600 uppercase ml-1">Frequency</p>
                              <div className="relative medicine-freq-container">
                                <Input 
                                  placeholder={med.type === 'Inj.' ? "Stat / SOS" : "1-0-1"} 
                                  value={med.frequency || ''} 
                                  onChange={e => updateMedicine(i, 'frequency', e.target.value)} 
                                  onKeyDown={e => handleMedicineKeyDown(e, i, 'frequency')} 
                                  className="h-10 pr-9 text-sm font-bold border-purple-500/20 bg-purple-500/5 rounded-lg text-purple-600 dark:text-purple-400 placeholder:text-purple-200/50" 
                                />
                                {med.type !== 'Inj.' && (
                                  <div className="flex items-center gap-2 mt-1.5 justify-center">
                                    {(['m', 'a', 'n'] as const).map(pill => {
                                      const label = pill === 'm' ? 'M' : pill === 'a' ? 'A' : 'N';
                                      const title = pill === 'm' ? 'Morning' : pill === 'a' ? 'Afternoon' : 'Night';
                                      const val = getPillState(med.frequency || '')[pill];
                                      
                                      const formatVal = (v: number) => {
                                        if (v === 0) return '0';
                                        const integer = Math.floor(v);
                                        const fraction = v - integer;
                                        if (fraction === 0.5) {
                                          return integer > 0 ? `${integer} ½` : '½';
                                        }
                                        return String(v);
                                      };

                                      const updatePillVal = (newVal: number) => {
                                        const state = getPillState(med.frequency || '');
                                        state[pill] = Math.max(0, newVal);
                                        const newFreq = `${state.m}-${state.a}-${state.n}`;
                                        updateMedicine(i, 'frequency', newFreq);
                                      };

                                      return (
                                        <div key={pill} className="flex flex-col items-center gap-1 bg-purple-500/5 dark:bg-purple-500/10 p-1.5 rounded-lg border border-purple-500/10 min-w-[3.5rem]">
                                          <button
                                            type="button"
                                            title={title}
                                            onClick={() => updatePillVal(val > 0 ? 0 : 1)}
                                            className={cn(
                                              "w-6 h-6 rounded-full text-[10px] font-extrabold flex items-center justify-center border transition-all select-none",
                                              val > 0 
                                                ? "bg-purple-650 text-white border-purple-650 shadow-sm"
                                                : "bg-white dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700 hover:border-purple-300"
                                            )}
                                          >
                                            {label}
                                          </button>
                                          <span className="text-[10px] font-bold text-purple-700 dark:text-purple-350 text-center min-h-[14px]">
                                            {formatVal(val)}
                                          </span>
                                          <div className="flex items-center gap-1">
                                            <button
                                              type="button"
                                              onClick={() => updatePillVal(val - 0.5)}
                                              className="w-4 h-4 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-650 dark:text-slate-300 hover:bg-purple-500/10 shadow-sm"
                                            >
                                              -
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => updatePillVal(val + 0.5)}
                                              className="w-4 h-4 rounded bg-white dark:bg-slate-800 border border-slate-250 dark:border-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-650 dark:text-slate-300 hover:bg-purple-500/10 shadow-sm"
                                            >
                                              +
                                            </button>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                                <Popover open={openFreqPopoverIndex === i} onOpenChange={(open) => setOpenFreqPopoverIndex(open ? i : null)}>
                                  <PopoverTrigger asChild>
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      className="absolute right-0 top-0 h-10 w-9 hover:bg-purple-500/10 rounded-r-lg"
                                      title="Select Frequency"
                                    >
                                      <ChevronDown className="h-4 w-4 text-purple-500" />
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-[180px] p-0 shadow-xl border-purple-500/20" align="end">
                                    <div className="max-h-60 overflow-auto p-1 bg-card rounded-lg touch-pan-y">
                                      {(med.type === 'Inj.' ? ['Stat', 'SOS', 'Once daily', 'Twice daily'] : COMMON_FREQUENCIES).map(freq => (
                                        <button
                                          key={freq}
                                          className="w-full text-left px-3 py-2 text-[13px] font-bold hover:bg-purple-500/10 text-foreground rounded-md transition-colors"
                                          onClick={() => {
                                            updateMedicine(i, 'frequency', freq);
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

                            <div className="md:col-span-2 space-y-1">
                              <p className="text-[9px] font-bold text-orange-600 uppercase ml-1">Duration</p>
                              <Input 
                                placeholder="5 Days / 1 Wk" 
                                value={med.duration || ''} 
                                onChange={e => updateMedicine(i, 'duration', e.target.value)} 
                                onKeyDown={e => handleMedicineKeyDown(e, i, 'duration')} 
                                className="h-10 text-sm font-bold border-orange-500/20 bg-orange-500/5 rounded-lg text-orange-600 dark:text-orange-400 placeholder:text-orange-200/50" 
                              />
                            </div>

                            <div className="md:col-span-2 space-y-1">
                              <p className="text-[9px] font-bold text-emerald-600 uppercase ml-1">Remarks</p>
                              <Input 
                                placeholder="After Food / Night" 
                                value={med.notes || ''} 
                                onChange={e => updateMedicine(i, 'notes', e.target.value)} 
                                onKeyDown={e => handleMedicineKeyDown(e, i, 'notes')} 
                                className="h-10 text-sm font-bold border-emerald-500/20 bg-emerald-500/5 rounded-lg text-emerald-600 dark:text-emerald-400 placeholder:text-emerald-200/50" 
                              />
                            </div>
                          </div>
                        </div>
                        <Button size="icon" variant="ghost" onClick={() => removeMedicine(i)} className="text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-lg h-10 w-10 mt-1 transition-colors self-end md:self-center">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>

                      {/* Pediatric / Geriatric Age Safety Advisory Alert */}
                      {safetyWarnings.length > 0 && (
                        <div className="mt-1 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 space-y-1 animate-in fade-in slide-in-from-top-1">
                          {safetyWarnings.map((warn, wIdx) => (
                            <div key={wIdx} className="flex items-start gap-2 text-xs font-bold">
                              <AlertTriangle className={cn("w-4 h-4 shrink-0 mt-0.5", warn.severity === 'critical' ? "text-red-500" : "text-amber-500")} />
                              <div>
                                <span className={cn("font-extrabold uppercase tracking-wide mr-1.5", warn.severity === 'critical' ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400")}>
                                  {warn.title}:
                                </span>
                                <span>{warn.message}</span>
                                {warn.recommendation && (
                                  <span className="block text-[11px] text-slate-600 dark:text-slate-400 font-normal mt-0.5">
                                    💡 <strong>Suggestion:</strong> {warn.recommendation}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
                <div className="pt-4 flex justify-center">
                  <Button 
                    variant="outline" 
                    onClick={addMedicine} 
                    className="h-11 px-8 text-sm font-bold border-dashed border-2 border-blue-500/30 text-blue-600 hover:bg-blue-500/5 bg-transparent rounded-2xl transition-all hover:scale-105 active:scale-95 group"
                  >
                    <Plus className="w-4 h-4 mr-2 group-hover:rotate-90 transition-transform" /> Add Another Medicine
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <Label className="text-[12px] font-extrabold text-muted-foreground uppercase tracking-widest ml-1">Advice</Label>
              <Input 
                value={advice} 
                onChange={e => setAdvice(e.target.value)} 
                placeholder="Drink plenty of water..." 
                className="h-12 text-base font-bold bg-muted/50 border-border focus:bg-card focus:ring-blue-500 transition-all rounded-xl shadow-inner"
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 pt-4">
          <Button
            type="button"
            variant="outline"
            className="h-11 rounded-xl"
            onClick={onOpenPreview}
          >
            <Eye className="w-4 h-4 mr-2" />
            Preview
          </Button>
          <Button 
            onClick={savePrescription} 
            disabled={saving} 
            className={cn(
              "h-11 shadow-lg transition-all rounded-xl text-white font-bold text-xs sm:text-sm w-full",
              saveError ? "bg-red-600 hover:bg-red-700 animate-pulse" : "bg-blue-600 hover:bg-blue-750"
            )}
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Saving...</span>
              </>
            ) : saveError ? (
              <>
                <RefreshCw className="w-4 h-4" />
                <span>Retry Save</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save & Complete</span>
              </>
            )}
          </Button>
        </div>
      </CardContent>

      {/* Protocol Selection Dialog (Inside ConsultationForm context) */}
      <Popover open={showProtocolDialog} onOpenChange={setShowProtocolDialog}>
        <PopoverContent className="w-[90vw] max-w-md p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-50">
          <div className="space-y-3">
            <h4 className="font-extrabold text-sm text-slate-800 dark:text-slate-200 uppercase tracking-wider">Select Protocol</h4>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {protocols.map(p => (
                <button
                  key={p.id}
                  onClick={() => {
                    applyProtocol(p);
                    setShowProtocolDialog(false);
                  }}
                  className="w-full flex items-center justify-between p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 group hover:border-blue-500 hover:bg-blue-50/10 transition-all text-left"
                >
                  <div className="truncate pr-2">
                    <p className="font-bold text-sm text-slate-900 dark:text-slate-100">{p.name}</p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">{p.medicines.map((m: any) => m.name).join(', ')}</p>
                  </div>
                  <ChevronDown className="w-4 h-4 -rotate-90 text-slate-300 group-hover:text-blue-500 transition-colors shrink-0" />
                </button>
              ))}
              {protocols.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">No protocols created yet.</p>
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </Card>
  );
}
