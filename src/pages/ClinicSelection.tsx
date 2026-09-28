import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { registerClient } from "@/lib/supabase-auth-admin";
import {
  Building2, Plus, LogOut, ArrowRight, Loader2,
  ShieldCheck, User, Mail, Lock, Globe, Sparkles, Trash2,
  ShieldX, History, AlertCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogTrigger, DialogDescription, DialogFooter
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { format } from "date-fns";

export default function ClinicSelection() {
  const { user, roles, signOut } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isAddClinicOpen, setIsAddClinicOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [blockDialogOpen, setBlockDialogOpen] = useState<{ open: boolean, clinic: any | null }>({ open: false, clinic: null });
  const [blockReason, setBlockReason] = useState("");
  const [historyOpen, setHistoryOpen] = useState<{ open: boolean, clinic: any | null }>({ open: false, clinic: null });


  // Form State
  const [formData, setFormData] = useState({
    clinicName: "",
    ownerName: "",
    ownerEmail: "",
    password: ""
  });

  const isSuperAdmin = roles.includes('superadmin');

  // Fetch block history
  const { data: blockHistory, isLoading: isLoadingHistory } = useQuery({
    queryKey: ['clinic-block-history', historyOpen.clinic?.id],
    queryFn: async () => {
      if (!historyOpen.clinic?.id) return [];
      const { data, error } = await supabase
        .from('clinic_block_history')
        .select(`
          *,
          actor:profiles(full_name)
        `)
        .eq('clinic_id', historyOpen.clinic.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: historyOpen.open && !!historyOpen.clinic?.id
  });

  const toggleBlockMutation = useMutation({
    mutationFn: async ({ clinicId, isBlocked, reason }: { clinicId: string, isBlocked: boolean, reason?: string }) => {
      const { error: clinicError } = await supabase
        .from('clinics')
        .update({ 
          is_blocked: isBlocked,
          block_reason: reason,
          blocked_at: isBlocked ? new Date().toISOString() : null
        })
        .eq('id', clinicId);

      if (clinicError) throw clinicError;

      const { error: historyError } = await supabase
        .from('clinic_block_history')
        .insert({
          clinic_id: clinicId,
          status: isBlocked ? 'blocked' : 'unblocked',
          reason: reason,
          action_by: user?.id
        });

      if (historyError) throw historyError;

      // Create notifications
      const notifications = [];
      
      // Notify Owner
      const { data: clinicData } = await supabase.from('clinics').select('owner_id, name').eq('id', clinicId).single();
      if (clinicData?.owner_id) {
        notifications.push({
          user_id: clinicData.owner_id,
          clinic_id: clinicId,
          title: isBlocked ? "Clinic Suspended" : "Access Restored",
          message: isBlocked 
            ? `Your clinic "${clinicData.name}" has been suspended. Reason: ${reason}` 
            : `Your clinic "${clinicData.name}" has been unblocked. You can now access the dashboard.`,
          type: isBlocked ? 'error' : 'success'
        });
      }

      // Notify Super Admin (Action taken confirmation)
      notifications.push({
        user_id: user?.id,
        clinic_id: clinicId,
        title: isBlocked ? "Clinic Blocked" : "Clinic Unblocked",
        message: `Successfully ${isBlocked ? 'blocked' : 'unblocked'} "${clinicData?.name || 'clinic'}".`,
        type: 'info'
      });

      const { error: notifError } = await supabase.from('notifications').insert(notifications);
      if (notifError) console.error("Failed to create notifications:", notifError);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['available-clinics'] });
      queryClient.invalidateQueries({ queryKey: ['clinic-block-history'] });
      setBlockDialogOpen({ open: false, clinic: null });
      setBlockReason("");
      toast.success("Clinic status updated successfully");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update clinic status");
    }
  });


  // Fetch clinics based on role
  const { data: clinics, isLoading } = useQuery({
    queryKey: ['available-clinics', user?.id],
    queryFn: async () => {
      console.log("[ClinicSelection] Fetching clinics. User:", user?.id, "isSuperAdmin:", isSuperAdmin);

      if (isSuperAdmin) {
        const { data, error } = await supabase.from('clinics').select('*').order('name');
        console.log("[ClinicSelection] SuperAdmin query results:", data, "Error:", error);
        return data || [];
      } else {
        // Fetch clinics where the user is an owner OR has a profile association
        const [ownedRes, profileRes] = await Promise.all([
          supabase.from('clinics').select('*').eq('owner_id', user?.id),
          supabase.from('profiles').select('clinic_id, clinics(*)').eq('user_id', user?.id)
        ]);

        console.log("[ClinicSelection] Owned Clinics:", ownedRes.data);
        console.log("[ClinicSelection] Profile Associations:", profileRes.data);

        const ownedClinics = ownedRes.data || [];
        const profileClinics = (profileRes.data || [])
          .map(p => p.clinics)
          .filter(Boolean);

        // Merge and unique by ID
        const allClinics = [...ownedClinics, ...profileClinics];
        const uniqueIds = new Set();
        const finalClinics = allClinics.filter(c => {
          if (uniqueIds.has(c.id)) return false;
          uniqueIds.add(c.id);
          return true;
        });

        console.log("[ClinicSelection] Final unique clinics:", finalClinics);
        return finalClinics;
      }
    },
    enabled: !!user
  });

  // Auto-redirect for normal users with only 1 clinic
  useEffect(() => {
    if (!isLoading && clinics && clinics.length === 1 && !isSuperAdmin) {
      const singleClinic = clinics[0];
      if (singleClinic.is_blocked) {
        console.log("[ClinicSelection] Auto-redirect blocked: Clinic is suspended.");
        return;
      }
      navigate(`/${singleClinic.slug}/dashboard`);
    }
  }, [clinics, isLoading, isSuperAdmin, navigate]);

  const handleAddClinic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.clinicName || !formData.ownerName || !formData.ownerEmail || !formData.password) {
      toast.error("Please fill all fields");
      return;
    }

    setIsCreating(true);
    const loadingToast = toast.loading("Provisioning new clinic environment...");

    try {
      // 1. Generate Slug
      const slug = formData.clinicName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

      // Check if slug exists
      const { data: existing } = await supabase.from('clinics').select('id').eq('slug', slug).maybeSingle();
      if (existing) {
        throw new Error("A clinic with a similar name already exists. Please choose a different name.");
      }

      // 2. Create Auth User for Owner
      const { data: authData, error: authError } = await registerClient.auth.signUp({
        email: formData.ownerEmail,
        password: formData.password,
        options: {
          data: { full_name: formData.ownerName }
        }
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("Failed to create owner account.");

      // 3. Create Clinic
      const { data: newClinic, error: clinicError } = await supabase
        .from('clinics')
        .insert({
          name: formData.clinicName,
          slug: slug,
          owner_id: authData.user.id
        })
        .select()
        .single();

      if (clinicError) throw clinicError;

      // 4. Create Profile for Owner
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: authData.user.id,
          user_id: authData.user.id,
          full_name: formData.ownerName,
          email: formData.ownerEmail,
          clinic_id: newClinic.id,
          role: 'owner'
        });

      if (profileError) throw profileError;

      // 5. Assign Role
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: authData.user.id,
          role: 'owner'
        });

      if (roleError) throw roleError;

      // 6. Notify Super Admin & New Owner
      try {
        const notifs = [
          {
            user_id: authData.user.id,
            clinic_id: newClinic.id,
            title: "Welcome to Prescripto",
            message: `Your clinic "${newClinic.name}" has been registered. You can now configure branding, add staff, and start taking patients.`,
            type: "info",
            is_read: false
          }
        ];
        if (user?.id) {
          notifs.push({
            user_id: user.id,
            clinic_id: newClinic.id,
            title: "New Clinic Created",
            message: `Clinic "${newClinic.name}" was onboarded successfully with owner ${formData.ownerEmail}.`,
            type: "success",
            is_read: false
          });
        }
        await supabase.from('notifications').insert(notifs);
      } catch (notifErr) {
        console.error("Non-fatal: failed to create clinic onboarding notifications", notifErr);
      }

      toast.success("Clinic created successfully!");
      setIsAddClinicOpen(false);
      setFormData({ clinicName: "", ownerName: "", ownerEmail: "", password: "" });
      queryClient.invalidateQueries({ queryKey: ['available-clinics'] });

    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to create clinic");
    } finally {
      setIsCreating(false);
      toast.dismiss(loadingToast);
    }
  };

  const handleDeleteClinic = async (clinicId: string, clinicName: string) => {
    const confirmDelete = window.confirm(`⚠️ ARE YOU ABSOLUTELY SURE? This will permanently delete the clinic "${clinicName}" and ALL associated patient data, prescriptions, and visits. This cannot be undone.`);

    if (!confirmDelete) return;

    const loadingToast = toast.loading(`Deleting ${clinicName}...`);
    try {
      // 1. Delete linked data first (due to foreign keys)
      const tables = ['prescriptions', 'visits', 'patients', 'profiles'];

      for (const table of tables) {
        const { error: delError } = await supabase
          .from(table)
          .delete()
          .eq('clinic_id', clinicId);

        if (delError) console.warn(`Note: Deletion from ${table} returned: ${delError.message}`);
      }

      // 2. Finally delete the clinic
      const { error: clinicError } = await supabase
        .from('clinics')
        .delete()
        .eq('id', clinicId);

      if (clinicError) throw clinicError;

      toast.success("Clinic and all data deleted successfully");
      queryClient.invalidateQueries({ queryKey: ['available-clinics'] });
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to delete clinic");
    } finally {
      toast.dismiss(loadingToast);
    }
  };

  const handleToggleBlock = (clinic: any) => {
    if (clinic.is_blocked) {
      // Unblock directly
      if (window.confirm(`Unblock ${clinic.name}? All users will regain access immediately.`)) {
        toggleBlockMutation.mutate({ clinicId: clinic.id, isBlocked: false, reason: "Payment received / Manual unblock" });
      }
    } else {
      // Open block dialog
      setBlockDialogOpen({ open: true, clinic });
    }
  };


  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-slate-50 dark:bg-slate-950">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600 mb-4" />
        <p className="text-slate-500 font-bold animate-pulse">Loading Clinical Network...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-jakarta-sans">
      {/* Header */}
      <header className="border-b bg-white/50 dark:bg-slate-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tighter text-slate-900 dark:text-white">PreScripto</h1>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Clinical Network</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex flex-col items-end mr-2">
              <p className="text-xs font-black text-slate-900 dark:text-white">{user?.email}</p>
              <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">{isSuperAdmin ? 'Global Admin' : 'Clinic Staff'}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => signOut()}
              className="rounded-xl border-slate-200 dark:border-slate-800 gap-2 font-bold hover:bg-red-50 hover:text-red-600 transition-all"
            >
              <LogOut className="w-4 h-4" /> Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12 md:py-20 space-y-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row md:items-end justify-between gap-6"
        >
          <div className="space-y-2">
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[10px] font-black uppercase tracking-widest border border-blue-100 dark:border-blue-800"
            >
              <Sparkles className="w-3 h-3" /> Welcome Back
            </motion.div>
            <h2 className="text-3xl md:text-5xl font-black tracking-tighter text-slate-900 dark:text-white leading-tight">
              Select Your <span className="text-blue-600">Clinic</span>
            </h2>
            <p className="text-slate-500 font-medium max-w-lg">
              Choose a clinic from the list below to enter its clinical environment and manage patients.
            </p>
          </div>

          {isSuperAdmin && (
            <Dialog open={isAddClinicOpen} onOpenChange={setIsAddClinicOpen}>
              <DialogTrigger asChild>
                <Button className="h-14 px-8 rounded-2xl bg-slate-900 dark:bg-white dark:text-slate-900 text-white font-black uppercase text-xs tracking-widest gap-3 shadow-2xl hover:scale-105 transition-all active:scale-95">
                  <Plus className="w-5 h-5" /> Add New Clinic
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md rounded-[2rem] p-8">
                <DialogHeader>
                  <DialogTitle className="text-2xl font-black tracking-tight">Onboard New Clinic</DialogTitle>
                  <DialogDescription>
                    Fill in the details to provision a new clinical environment and create a doctor account.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleAddClinic} className="space-y-6 pt-4">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Clinic Name</Label>
                      <div className="relative">
                        <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                          placeholder="e.g. Sunrise Wellness"
                          className="pl-12 h-12 rounded-xl border-slate-200"
                          value={formData.clinicName}
                          onChange={e => setFormData({ ...formData, clinicName: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Owner Name (Doctor)</Label>
                      <div className="relative">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                          placeholder="Dr. John Doe"
                          className="pl-12 h-12 rounded-xl border-slate-200"
                          value={formData.ownerName}
                          onChange={e => setFormData({ ...formData, ownerName: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Login Email (Owner ID)</Label>
                      <div className="relative">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                          type="email"
                          placeholder="doctor@example.com"
                          className="pl-12 h-12 rounded-xl border-slate-200"
                          value={formData.ownerEmail}
                          onChange={e => setFormData({ ...formData, ownerEmail: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Owner Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                          type="password"
                          placeholder="••••••••"
                          className="pl-12 h-12 rounded-xl border-slate-200"
                          value={formData.password}
                          onChange={e => setFormData({ ...formData, password: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                  <Button
                    type="submit"
                    disabled={isCreating}
                    className="w-full h-14 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black uppercase text-xs tracking-widest gap-2 shadow-lg shadow-blue-500/20 transition-all active:scale-[0.98]"
                  >
                    {isCreating ? <Loader2 className="w-5 h-5 animate-spin" /> : "Verify & Launch Clinic"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </motion.div>

        {clinics && clinics.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <AnimatePresence mode="popLayout">
              {clinics.map((clinic: any, i: number) => (
                <motion.div
                  key={clinic.id}
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                >
                  <Card
                    className={cn(
                      "group relative border-none shadow-sm hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 bg-white dark:bg-slate-900 overflow-hidden cursor-pointer",
                      clinic.is_blocked && "ring-2 ring-red-500/50"
                    )}
                    onClick={() => {
                      if (clinic.is_blocked && !isSuperAdmin) {
                        toast.error("This clinic is currently blocked due to pending payments. Please contact administration.");
                        return;
                      }
                      navigate(`/${clinic.slug}/dashboard`);
                    }}
                  >
                    {clinic.is_blocked && (
                      <div className="absolute inset-0 bg-red-500/5 pointer-events-none z-10" />
                    )}

                    <div className="absolute top-0 right-0 p-6 opacity-0 group-hover:opacity-100 transition-opacity translate-x-4 group-hover:translate-x-0 duration-500 z-20">
                      <div className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center text-white",
                        clinic.is_blocked ? "bg-red-600" : "bg-blue-600"
                      )}>
                        {clinic.is_blocked ? <ShieldX className="w-5 h-5" /> : <ArrowRight className="w-5 h-5" />}
                      </div>
                    </div>


                    <CardContent className="p-10 space-y-6">
                      <div className="w-16 h-16 rounded-[2rem] bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center transition-transform group-hover:scale-110 group-hover:rotate-6 duration-500">
                        <Building2 className="w-8 h-8" />
                      </div>

                      <div className="space-y-1">
                        <h3 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">{clinic.name}</h3>
                        <div className="flex items-center gap-1.5 text-slate-400 font-bold text-xs uppercase tracking-widest">
                          <Globe className="w-3 h-3" /> prescripto/{clinic.slug}
                        </div>
                      </div>
                      <div className="pt-4 flex items-center justify-between border-t border-slate-50 dark:border-slate-800">
                        <div className="flex items-center gap-3 w-full justify-between">
                          <div className="flex items-center gap-2">
                            <div className={cn(
                              "w-2 h-2 rounded-full",
                              clinic.is_blocked ? "bg-red-500" : "bg-emerald-500 animate-pulse"
                            )} />
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                              {clinic.is_blocked ? "Access Blocked" : "Environment Active"}
                            </span>
                          </div>

                          {isSuperAdmin && (
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all z-20"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setHistoryOpen({ open: true, clinic });
                                }}
                              >
                                <History className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className={cn(
                                  "h-8 w-8 rounded-lg transition-all z-20",
                                  clinic.is_blocked 
                                    ? "text-emerald-600 hover:bg-emerald-50" 
                                    : "text-red-400 hover:text-red-600 hover:bg-red-50"
                                )}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleBlock(clinic);
                                }}
                              >
                                {clinic.is_blocked ? <ShieldCheck className="w-4 h-4" /> : <ShieldX className="w-4 h-4" />}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all z-20"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteClinic(clinic.id, clinic.name);
                                }}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {clinic.is_blocked && (
                        <div className="mt-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/50">
                           <div className="flex items-start gap-2">
                              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                              <div className="space-y-1">
                                 <p className="text-[10px] font-black uppercase text-red-600 tracking-wider">Reason for Suspension</p>
                                 <p className="text-xs font-medium text-red-900 dark:text-red-200 leading-tight">
                                    {clinic.block_reason || "Violation of service terms or pending payment."}
                                 </p>
                                 {clinic.blocked_at && (
                                   <p className="text-[9px] font-bold text-red-500/70">
                                      Blocked on: {format(new Date(clinic.blocked_at), 'PPP')}
                                   </p>
                                 )}
                              </div>
                           </div>
                        </div>
                      )}

                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <div className="py-20 text-center space-y-6 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-[3rem] bg-white/50 dark:bg-slate-900/50">
            <div className="w-24 h-24 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto text-slate-400">
              <Building2 className="w-12 h-12" />
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-black text-slate-900 dark:text-white">No clinics found</h3>
              <p className="text-slate-500 font-medium max-w-xs mx-auto">
                {isSuperAdmin
                  ? "Welcome to the Clinical Network! Start by creating your first clinic environment."
                  : "You haven't been assigned to any clinics yet. Please contact your administrator."}
              </p>
            </div>
            {isSuperAdmin && (
              <Button
                onClick={() => setIsAddClinicOpen(true)}
                className="rounded-2xl h-12 px-8 font-bold"
              >
                Create Initial Clinic
              </Button>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="py-12 border-t border-slate-100 dark:border-slate-900 text-center">
        <p className="text-[10px] font-black text-slate-300 dark:text-slate-700 uppercase tracking-[0.5em]">
          Prescripto Multi-Tenant clinical OS
        </p>
      </footer>

      {/* Block Dialog */}
      <Dialog open={blockDialogOpen.open} onOpenChange={(open) => !open && setBlockDialogOpen({ open: false, clinic: null })}>
        <DialogContent className="max-w-md rounded-[2rem] p-8">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black tracking-tight text-red-600 flex items-center gap-2">
               <ShieldX className="w-6 h-6" /> Block Clinic
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to block <b>{blockDialogOpen.clinic?.name}</b>? All staff and doctors will lose access to the system immediately.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
             <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Reason for Blocking</Label>
                <Input 
                   placeholder="e.g. Subscription payment overdue"
                   className="h-12 rounded-xl border-slate-200"
                   value={blockReason}
                   onChange={e => setBlockReason(e.target.value)}
                />
             </div>
             <div className="flex gap-3 pt-2">
                <Button 
                   variant="ghost" 
                   className="flex-1 h-12 rounded-xl font-bold"
                   onClick={() => setBlockDialogOpen({ open: false, clinic: null })}
                >
                   Cancel
                </Button>
                <Button 
                   className="flex-1 h-12 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black uppercase text-xs tracking-widest shadow-lg shadow-red-500/20"
                   disabled={toggleBlockMutation.isPending || !blockReason}
                   onClick={() => toggleBlockMutation.mutate({ 
                      clinicId: blockDialogOpen.clinic.id, 
                      isBlocked: true, 
                      reason: blockReason 
                   })}
                >
                   {toggleBlockMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirm Block"}
                </Button>
             </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={historyOpen.open} onOpenChange={(open) => !open && setHistoryOpen({ open: false, clinic: null })}>
        <DialogContent className="max-w-lg rounded-[2rem] p-0 overflow-hidden">
          <div className="p-8 border-b bg-slate-50/50">
            <DialogHeader>
              <DialogTitle className="text-2xl font-black tracking-tight flex items-center gap-2">
                 <History className="w-6 h-6 text-blue-600" /> Status History
              </DialogTitle>
              <DialogDescription>
                Timeline of access changes for {historyOpen.clinic?.name}
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="p-8 max-h-[400px] overflow-y-auto no-scrollbar space-y-6">
            {isLoadingHistory ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              </div>
            ) : blockHistory && blockHistory.length > 0 ? (
              <div className="relative border-l-2 border-slate-100 ml-3 space-y-8 pb-4">
                {blockHistory.map((item: any, idx: number) => (
                  <div key={item.id} className="relative pl-8">
                    <div className={cn(
                      "absolute -left-[9px] top-0 w-4 h-4 rounded-full border-4 border-white shadow-sm",
                      item.status === 'blocked' ? "bg-red-500" : "bg-emerald-500"
                    )} />
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                         <span className={cn(
                           "text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md",
                           item.status === 'blocked' ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"
                         )}>
                           {item.status}
                         </span>
                         <span className="text-[10px] font-bold text-slate-400">
                           {format(new Date(item.created_at), 'MMM d, yyyy HH:mm')}
                         </span>
                      </div>
                      <p className="text-sm font-bold text-slate-900 dark:text-white">{item.reason || "No reason provided"}</p>
                      <p className="text-[10px] font-medium text-slate-500 italic">
                        Action by: {item.actor?.full_name || "System"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-slate-400 italic">
                No status changes recorded for this clinic.
              </div>
            )}
          </div>
          <div className="p-6 border-t bg-slate-50/50 flex justify-end">
             <Button 
                variant="outline" 
                className="rounded-xl font-bold"
                onClick={() => setHistoryOpen({ open: false, clinic: null })}
             >
                Close History
             </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

