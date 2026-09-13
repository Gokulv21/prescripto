import { useState, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useOutletContext } from 'react-router-dom';
import PageBanner from "@/components/PageBanner";
import patientListBanner from "@/assets/patient_list_banner.png";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Search, User, History, Edit, Printer, Eye, X } from 'lucide-react';
import { toast } from 'sonner';
import PrescriptionTemplate from '@/components/PrescriptionTemplate';
import { printPrescription } from '@/lib/printPrescription';
import { formatAge, getPatientCurrentAge, calculateDobFromAge } from '@/lib/utils';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

import type { Clinic } from '@/types/clinic';

export default function PatientList() {
  const { clinic } = useOutletContext<{ clinic: Clinic }>();
  const [patients, setPatients] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [visits, setVisits] = useState<any[]>([]);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ title: '', name: '', age: '', ageUnit: 'years', sex: 'Male', phone: '', address: '' });
  const [viewingRx, setViewingRx] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [currentRx, setCurrentRx] = useState<any>(null);
  const [loadingRx, setLoadingRx] = useState(false);
  const pageSize = 25;

  const fetchPatients = async () => {
    const start = (page - 1) * pageSize;
    const end = start + pageSize - 1;

    let query = supabase.from('patients').select('*', { count: 'exact' }).eq('clinic_id', clinic?.id).order('last_opened_at', { ascending: false, nullsFirst: false }).range(start, end);
    if (search.trim()) {
      // Check if search looks like a UUID for ID search
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(search.trim());
      if (isUuid) {
        query = query.or(`id.eq.${search.trim()},name.ilike.%${search}%,phone.ilike.%${search}%,registration_id.ilike.%${search}%`);
      } else {
        query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%,registration_id.ilike.%${search}%`);
      }
    }
    const { data, count, error } = await query;
    if (error) {
      console.error('[PatientDirectory] Fetch Error:', error);
      toast.error('Failed to load patient directory. Check your connection.');
      return;
    }
    setPatients(data || []);
    setTotalCount(count || 0);
  };

  // Dynamic page title
  useEffect(() => {
    document.title = `Patients${clinic?.name ? ` — ${clinic.name}` : ''} | Prescripto`;
    return () => { document.title = 'Prescripto'; };
  }, [clinic?.name]);

  useEffect(() => { 
    setPage(1); // Reset page on search or clinic change
    fetchPatients(); 
  }, [search, clinic?.id]);

  useEffect(() => {
    fetchPatients();
  }, [page, clinic?.id]);

  // Realtime subscription — auto-refresh when patients are added/updated
  useEffect(() => {
    if (!clinic?.id) return;
    let debounceTimer: ReturnType<typeof setTimeout>;
    const channel = supabase
      .channel(`patientlist-realtime-${clinic.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'patients',
        filter: `clinic_id=eq.${clinic.id}`
      }, () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => fetchPatients(), 600);
      })
      .subscribe();
    return () => {
      clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, [clinic?.id]);

  const viewPatient = async (p: any) => {
    setSelectedPatient(p);
    // Update last_opened_at in background
    supabase.from('patients').update({ last_opened_at: new Date().toISOString() }).eq('id', p.id).then();

    const currentAge = getPatientCurrentAge(p);
    setEditForm({ 
      title: p.title || '', 
      name: p.name, 
      age: currentAge !== null ? String(currentAge) : String(p.age || ''), 
      ageUnit: 'years', // Default to years when viewing existing
      sex: p.sex || 'Male',
      phone: p.phone, 
      address: p.address || '' 
    });
    const { data } = await supabase
      .from('visits')
      .select('*, prescriptions(*)')
      .eq('patient_id', p.id)
      .order('created_at', { ascending: false });
    setVisits(data || []);
  };

  const handleViewPrescription = async (v: any) => {
    setViewingRx(v);
    setLoadingRx(true);
    setCurrentRx(null);
    
    try {
      // 1. First check the joined prescriptions from the visit (if any)
      if (Array.isArray(v.prescriptions) && v.prescriptions.length > 0) {
        setCurrentRx(v.prescriptions[0]);
      } else {
        // 2. Explicitly fetch from database for maximum reliability
        const { data, error } = await supabase
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

  const saveEdit = async () => {
    if (!selectedPatient) return;
    let ageInYears = parseFloat(editForm.age);
    if (editForm.ageUnit === 'months') ageInYears = ageInYears / 12;
    if (editForm.ageUnit === 'days') ageInYears = ageInYears / 365;
    const calculatedDob = calculateDobFromAge(parseFloat(editForm.age), editForm.ageUnit);

    const updatePayload: any = {
      title: editForm.title,
      name: editForm.name,
      age: ageInYears,
      created_at: new Date().toISOString(), // Anchors today as the base day for the new edited age
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

    if (error) toast.error(error.message);
    else {
      toast.success('Patient updated');
      setEditing(false);
      fetchPatients();
    }
  };

  return (
    <div className="max-w-[1600px] mx-auto animate-in fade-in duration-500 pb-12">
      <PageBanner
        title="Patient Directory"
        description="Manage patient records, access visit history, and review past digital prescriptions."
        imageSrc={patientListBanner}
      />

      <div className="px-4 md:px-8 space-y-6">
        <div className="relative">
          <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, phone or ID..." className="pl-10" />
        </div>

        <div className="grid gap-3">
        {patients.map(p => (
          <Card key={p.id} className="cursor-pointer hover:shadow-md transition-shadow bg-card border-border" onClick={() => viewPatient(p)}>
            <CardContent className="py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-muted rounded-full">
                  <User className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <div className="font-heading font-bold text-foreground flex items-center gap-2">
                    {p.title} {p.name}
                    {p.registration_id && (
                        <span className="text-[10px] items-center bg-primary/10 text-primary px-2 py-0.5 rounded-full uppercase tracking-widest font-black">
                            {p.registration_id}
                        </span>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground font-medium">
                    {p.phone} · {formatAge(p)} · {p.sex}
                  </div>
                </div>
              </div>
              <History className="w-4 h-4 text-muted-foreground" />
            </CardContent>
          </Card>
        ))}
      </div>

      {totalCount > pageSize && (
        <div className="flex justify-center mt-8 pb-4">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious 
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  className={page === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
              
              <div className="flex items-center gap-2 px-4 text-sm font-medium">
                Page {page} of {Math.ceil(totalCount / pageSize)}
              </div>

              <PaginationItem>
                <PaginationNext 
                  onClick={() => setPage(p => Math.min(Math.ceil(totalCount / pageSize), p + 1))}
                  className={page >= Math.ceil(totalCount / pageSize) ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}

      {/* Patient detail dialog */}
      <Dialog open={!!selectedPatient} onOpenChange={open => !open && setSelectedPatient(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>{(selectedPatient?.title ? selectedPatient.title + ' ' : '') + selectedPatient?.name}</span>
              <Button size="sm" variant="outline" onClick={() => setEditing(!editing)}>
                <Edit className="w-4 h-4 mr-1" />{editing ? 'Cancel' : 'Edit'}
              </Button>
            </DialogTitle>
          </DialogHeader>

          {editing ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 grid grid-cols-4 gap-3">
                  <div className="col-span-1">
                    <Label>Title</Label>
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
                    <Label className="text-muted-foreground">Name</Label>
                    <Input className="border-border bg-card focus:ring-primary/10" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
                  </div>
                </div>
                <div className="col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <Label>Age</Label>
                    <div className="flex gap-2">
                      <Input 
                        type="number" 
                        step="0.1"
                        value={editForm.age} 
                        onChange={e => {
                          const val = parseFloat(e.target.value);
                          if (val > 1000) return;
                          setEditForm(f => ({ ...f, age: e.target.value }));
                        }} 
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
                    <Label>Gender</Label>
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
                    <Label className="text-muted-foreground">Phone</Label>
                    <Input 
                      className="border-border bg-card focus:ring-primary/10"
                      value={editForm.phone} 
                      onChange={e => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                        setEditForm(f => ({ ...f, phone: val }));
                      }} 
                    />
                  </div>
                </div>
                <div className="col-span-2">
                  <Label className="text-muted-foreground">Address</Label>
                  <Input className="border-border bg-card focus:ring-primary/10" value={editForm.address} onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))} />
                </div>
              </div>
              <Button onClick={saveEdit}>Save Changes</Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-muted-foreground">Title:</span> {selectedPatient?.title || '—'}</div>
                <div><span className="text-muted-foreground">Age:</span> {formatAge(selectedPatient)}</div>
                <div><span className="text-muted-foreground">Sex:</span> {selectedPatient?.sex}</div>
                <div><span className="text-muted-foreground">Phone:</span> {selectedPatient?.phone}</div>
                <div className="col-span-2"><span className="text-muted-foreground">Address:</span> {selectedPatient?.address || '—'}</div>
              </div>

              <h3 className="font-heading font-bold mt-4">Visit History ({visits.length})</h3>
              <div className="space-y-3">
                {visits.map(v => (
                  <Card key={v.id}>
                    <CardContent className="py-3">
                      <div className="flex justify-between items-start text-sm">
                        <div>
                          <span className="font-medium">{new Date(v.created_at).toLocaleDateString()}</span>
                          <span className="text-muted-foreground ml-2">Token #{v.token_number}</span>
                        </div>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="h-8 text-primary hover:text-primary hover:bg-primary/5"
                          onClick={() => handleViewPrescription(v)}
                        >
                          <Eye className="w-3.5 h-3.5 mr-1.5" />
                          Prescription
                        </Button>
                      </div>
                      {v.diagnosis && <p className="text-sm mt-1">Dx: {v.diagnosis}</p>}
                      <div className="grid grid-cols-3 gap-2 mt-2 text-xs text-muted-foreground">
                        {v.weight && <span>Wt: {v.weight}kg</span>}
                        {v.blood_pressure && <span>BP: {v.blood_pressure}</span>}
                        {v.pulse_rate && <span>PR: {v.pulse_rate}bpm</span>}
                      </div>
                      {Array.isArray(v.prescriptions) && v.prescriptions.map((rx: any) => (
                        <div key={rx.id} className="mt-2 p-2 rounded bg-muted text-xs">
                          {Array.isArray(rx.medicines) && rx.medicines.map((m: any, i: number) => (
                            <div key={i}>{m.name} — {m.dosage} — {m.frequency} — {m.duration}</div>
                          ))}
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Prescription Preview Dialog */}
      <Dialog open={!!viewingRx} onOpenChange={open => !open && setViewingRx(null)}>
        <DialogContent className="max-w-[800px] p-0 overflow-hidden bg-muted">
          <div className="bg-card p-4 border-b border-border flex items-center justify-between sticky top-0 z-20">
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
    </div>
  );
}