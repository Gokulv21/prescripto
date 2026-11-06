import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth, AppRole } from '@/lib/auth';
import { useOutletContext } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { 
  Users, UserPlus, Trash2, Eye, EyeOff, Loader2, Shield, RefreshCw, 
  Stethoscope, ClipboardList, Crown, CheckCircle2, Sparkles, ShieldCheck, HeartHandshake, Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { Clinic } from '@/types/clinic';
import userMgmtImg from '@/assets/UserMgmt.png';

interface ClinicUser {
  id: string;
  email: string;
  full_name: string;
  role: string;
  created_at?: string;
}

export default function UserManagement() {
  const { clinic } = useOutletContext<{ clinic: Clinic }>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<string>('staff');
  const [showPassword, setShowPassword] = useState(false);
  const [users, setUsers] = useState<ClinicUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<'all' | 'owner' | 'doctor' | 'staff'>('all');

  // Dynamic page title
  useEffect(() => {
    document.title = `Team Management${clinic?.name ? ` — ${clinic.name}` : ''} | Prescripto`;
    return () => { document.title = 'Prescripto'; };
  }, [clinic?.name]);

  const fetchUsers = async () => {
    try {
      const [{ data: profilesData, error: profError }] = await Promise.all([
        supabase.from('profiles').select('id, email, full_name, role, user_id').eq('clinic_id', clinic?.id)
      ]);

      if (profError) throw profError;

      const userIds = (profilesData || []).map(p => p.user_id || p.id).filter(Boolean);
      let roleMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: rolesData } = await supabase
          .from('user_roles')
          .select('user_id, role')
          .in('user_id', userIds);
        if (rolesData) {
          rolesData.forEach(r => { roleMap[r.user_id] = r.role; });
        }
      }

      const isSuperAdminAccount = (email?: string, role?: string) => {
        if (!email) return false;
        const clean = email.toLowerCase().trim();
        return clean === 'doctor@clinic.com' || role === 'superadmin';
      };

      const combined: ClinicUser[] = (profilesData || [])
        .map(p => ({
          id: p.user_id || p.id,
          email: p.email || '',
          full_name: p.full_name || '',
          role: roleMap[p.user_id || p.id] || p.role || '',
        }))
        .filter(u => !isSuperAdminAccount(u.email, u.role));

      setUsers(combined);
    } catch (err: any) {
      console.error(err);
      toast.error('Could not load team members');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (clinic?.id) {
      fetchUsers();
    }
  }, [clinic?.id]);

  const createUser = async () => {
    if (!email || !password || !fullName) {
      toast.error('Please fill all fields');
      return;
    }
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setCreating(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { full_name: fullName.trim() } }
      });
      if (error) throw error;
      if (!data.user) throw new Error('User creation failed');

      const { error: roleError } = await supabase.from('user_roles').insert({ user_id: data.user.id, role: role as AppRole });
      if (roleError) throw roleError;

      const { error: profileError } = await supabase.from('profiles').upsert({
        user_id: data.user.id,
        full_name: fullName.trim(),
        email: email.trim(),
        id: data.user.id,
        role: role as AppRole,
        clinic_id: clinic?.id
      });
      if (profileError) console.error("Profile Error:", profileError);

      toast.success(`${fullName} registered as ${role}`);
      setEmail(''); setPassword(''); setFullName('');
      fetchUsers();
    } catch (err: any) {
      if (err.message?.includes('already registered')) {
        toast.warning("User already exists. Check the list to Activate if they're missing a role.");
        fetchUsers();
      } else {
        toast.error(err.message);
      }
    } finally {
      setCreating(false);
    }
  };

  const assignMissingRole = async (userId: string, name: string) => {
    const t = toast.loading(`Assigning role to ${name}...`);
    try {
      const { error } = await supabase.from('user_roles').insert({ user_id: userId, role: 'staff' as AppRole });
      if (error) throw error;
      toast.success(`Role assigned to ${name}`);
      fetchUsers();
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
    } finally {
      toast.dismiss(t);
    }
  };

  const deleteUserAccount = async (userId: string, name: string) => {
    if (!window.confirm(`Remove ${name} from this clinic?`)) return;
    const t = toast.loading(`Removing ${name}...`);
    try {
      const { error: profileError } = await supabase.from('profiles').delete().eq('id', userId);
      if (profileError) throw profileError;
      const { error: roleError } = await supabase.from('user_roles').delete().eq('user_id', userId);
      if (roleError) throw roleError;
      toast.success(`${name} removed`);
      fetchUsers();
    } catch (err: any) {
      toast.error(`Failed: ${err.message}`);
    } finally {
      toast.dismiss(t);
    }
  };

  const roleConfig: Record<string, { label: string; icon: any; color: string; bg: string; border: string }> = {
    owner: { label: 'Owner', icon: Crown, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/30', border: 'border-amber-200 dark:border-amber-800/50' },
    doctor: { label: 'Doctor', icon: Stethoscope, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-950/30', border: 'border-blue-200 dark:border-blue-800/50' },
    staff: { label: 'Staff', icon: ClipboardList, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/30', border: 'border-emerald-200 dark:border-emerald-800/50' },
  };

  const getRoleConfig = (r: string) => roleConfig[r] || { label: r, icon: Users, color: 'text-slate-500', bg: 'bg-slate-50', border: 'border-slate-200' };

  const filteredUsers = selectedRoleFilter === 'all' 
    ? users 
    : users.filter(u => u.role === selectedRoleFilter);

  const ownerCount = users.filter(u => u.role === 'owner').length;
  const doctorCount = users.filter(u => u.role === 'doctor').length;
  const staffCount = users.filter(u => u.role === 'staff').length;

  return (
    <div className="max-w-7xl mx-auto py-6 sm:py-8 px-4 sm:px-6 space-y-8 font-jakarta-sans">
      
      {/* Page Header (Minimal & Professional matching Settings alignment) */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-200/80 dark:border-slate-800">
        <div className="space-y-2 max-w-xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[10px] font-black uppercase tracking-widest border border-blue-100 dark:border-blue-800">
            <Sparkles className="w-3.5 h-3.5" /> Clinic Administration
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-800 dark:text-slate-100">
              Team & Access Control
            </h1>
            <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground bg-white dark:bg-slate-900 px-3 py-1 rounded-full border border-slate-200/80 dark:border-slate-800 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Active Clinic: <b>{clinic?.name || 'Clinic'}</b></span>
            </div>
          </div>
          <p className="text-muted-foreground text-xs sm:text-sm font-medium leading-relaxed">
            Register practitioners, assign role-based clinical privileges, and manage authenticated team members for {clinic?.name || 'your clinic'}.
          </p>
        </div>

        {/* Transparent User Management Image Common at Top matching Settings */}
        <div className="flex justify-center md:justify-end shrink-0">
          <img 
            src={userMgmtImg} 
            alt="Team Management" 
            className="h-28 sm:h-36 md:h-44 lg:h-48 w-auto object-contain select-none pointer-events-none drop-shadow-sm" 
          />
        </div>
      </motion.div>

      {/* Main 2-Column Responsive Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column: Form & Staff List (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Create Form Card */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="relative overflow-hidden rounded-[2rem] border border-blue-200/80 dark:border-blue-800/40 bg-white dark:bg-slate-900 shadow-sm"
          >
            <div className="h-1.5 w-full bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600" />
            
            <div className="p-6 sm:p-7 space-y-5">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="font-black text-base text-slate-900 dark:text-white">Register Staff Account</h2>
                  <p className="text-xs text-slate-400 font-medium">New member receives immediate credentials to access this clinic</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Full Name */}
                <div className="sm:col-span-2 space-y-1.5">
                  <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Full Name</Label>
                  <Input
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    placeholder="e.g. Dr. John Doe or Nurse Mary"
                    className="h-11 rounded-xl font-bold bg-slate-50/50 dark:bg-slate-800/40"
                  />
                </div>

                {/* Email */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Username (Email)</Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="staff@clinic.com"
                    className="h-11 rounded-xl font-medium bg-slate-50/50 dark:bg-slate-800/40"
                  />
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Initial Password</Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Min 6 characters"
                      className="h-11 rounded-xl font-medium bg-slate-50/50 dark:bg-slate-800/40 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                      tabIndex={-1}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Role Selection */}
                <div className="sm:col-span-2 space-y-1.5">
                  <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Assigned Privilege Role</Label>
                  <Select value={role} onValueChange={setRole}>
                    <SelectTrigger className="h-11 rounded-xl font-bold bg-slate-50/50 dark:bg-slate-800/40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-border shadow-xl">
                      <SelectItem value="owner" className="rounded-lg">
                        <div className="flex items-center gap-2">
                          <Crown className="w-3.5 h-3.5 text-amber-500" />
                          <span>Clinic Owner <span className="text-muted-foreground font-normal text-xs">(Full Admin & Presets)</span></span>
                        </div>
                      </SelectItem>
                      <SelectItem value="doctor" className="rounded-lg">
                        <div className="flex items-center gap-2">
                          <Stethoscope className="w-3.5 h-3.5 text-blue-500" />
                          <span>Doctor <span className="text-muted-foreground font-normal text-xs">(Prescriptions & Consultation Pad)</span></span>
                        </div>
                      </SelectItem>
                      <SelectItem value="staff" className="rounded-lg">
                        <div className="flex items-center gap-2">
                          <ClipboardList className="w-3.5 h-3.5 text-emerald-500" />
                          <span>Clinic Staff <span className="text-muted-foreground font-normal text-xs">(Patient Entry, Vitals & Print Queue)</span></span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button
                onClick={createUser}
                disabled={creating}
                className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-wider shadow-sm transition-all"
              >
                {creating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <UserPlus className="w-4 h-4 mr-2" />}
                Register Team Member
              </Button>
            </div>
          </motion.div>

          {/* Staff List Card */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="rounded-[2rem] border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600">
                  <Shield className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="font-black text-sm text-slate-900 dark:text-white">Active Team Members</h2>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{users.length} registered account{users.length !== 1 ? 's' : ''}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Role quick filter pills */}
                <div className="flex items-center bg-white dark:bg-slate-900 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700 text-[10px] font-bold">
                  {(['all', 'owner', 'doctor', 'staff'] as const).map(tab => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setSelectedRoleFilter(tab)}
                      className={cn(
                        "px-2.5 py-1 rounded-lg uppercase tracking-wider transition-all",
                        selectedRoleFilter === tab 
                          ? "bg-blue-600 text-white font-black shadow-xs" 
                          : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                      )}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={fetchUsers}
                  className="h-8 w-8 p-0 rounded-xl text-slate-500 hover:text-slate-900"
                  title="Refresh List"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              <AnimatePresence>
                {filteredUsers.map((u, i) => {
                  const rc = getRoleConfig(u.role);
                  const RoleIcon = rc.icon;
                  return (
                    <motion.div
                      key={u.id || i}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 8 }}
                      transition={{ delay: i * 0.03 }}
                      className="flex items-center justify-between px-6 py-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors group"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        {/* Avatar */}
                        <div className={cn('w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border shadow-xs', rc.bg, rc.border)}>
                          <RoleIcon className={cn('w-4.5 h-4.5', rc.color)} />
                        </div>
                        <div className="min-w-0">
                          <p className="font-black text-sm text-slate-900 dark:text-white truncate">{u.full_name || 'Staff Member'}</p>
                          <p className="text-xs text-slate-400 font-medium truncate">{u.email || 'No email'}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 ml-3">
                        {u.role ? (
                          <span className={cn('text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border', rc.bg, rc.color, rc.border)}>
                            {rc.label}
                          </span>
                        ) : (
                          <Button
                            size="sm"
                            className="h-7 px-3 text-[10px] font-black uppercase tracking-wider bg-amber-500 hover:bg-amber-600 text-white rounded-full animate-pulse"
                            onClick={() => assignMissingRole(u.id, u.full_name)}
                          >
                            <CheckCircle2 className="w-3 h-3 mr-1" />Activate
                          </Button>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 opacity-0 group-hover:opacity-100 transition-all"
                          onClick={() => deleteUserAccount(u.id, u.full_name)}
                          title="Remove from clinic"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>

              {filteredUsers.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2">
                  <Users className="w-8 h-8 opacity-30" />
                  <p className="text-sm font-bold opacity-60">No members matching filter</p>
                  <p className="text-xs opacity-40">Register a new staff account or switch the role filter above.</p>
                </div>
              )}
            </div>
          </motion.div>
        </div>

        {/* Right Column: Role Privileges & Staff Governance Guide (5 cols) */}
        <div className="lg:col-span-5 sticky top-20 space-y-6">
          <div className="rounded-[2rem] border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-7 shadow-sm space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-black text-base text-slate-900 dark:text-white">
                    Access Control & Roles
                  </h3>
                  <p className="text-xs text-slate-400 font-medium">Granular permissions by staff role</p>
                </div>
              </div>
              <Badge variant="outline" className="text-[10px] uppercase font-black px-2.5 py-0.5 rounded-full text-indigo-600 border-indigo-200">
                RBAC Active
              </Badge>
            </div>

            {/* Role Explanations */}
            <div className="space-y-3">
                {/* Owner */}
                <div className="p-3.5 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-amber-500 text-white shrink-0 mt-0.5 shadow-xs">
                    <Crown className="w-3.5 h-3.5" />
                  </div>
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="font-black text-xs text-amber-900 dark:text-amber-200">Clinic Owner</span>
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 uppercase">Admin</span>
                    </div>
                    <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80 font-medium leading-relaxed">
                      Full control over Clinic Information, Official Branding, Prescription Presets, and Staff Invitations.
                    </p>
                  </div>
                </div>

                {/* Doctor */}
                <div className="p-3.5 rounded-2xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-900/40 flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-blue-600 text-white shrink-0 mt-0.5 shadow-xs">
                    <Stethoscope className="w-3.5 h-3.5" />
                  </div>
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="font-black text-xs text-blue-900 dark:text-blue-200">Doctor on Duty</span>
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 uppercase">Clinical</span>
                    </div>
                    <p className="text-[11px] text-blue-800/80 dark:text-blue-300/80 font-medium leading-relaxed">
                      Consultation pad, digital & stylus prescriptions, patient vitals review, and personal digital signature.
                    </p>
                  </div>
                </div>

                {/* Staff */}
                <div className="p-3.5 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40 flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-emerald-600 text-white shrink-0 mt-0.5 shadow-xs">
                    <ClipboardList className="w-3.5 h-3.5" />
                  </div>
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="font-black text-xs text-emerald-900 dark:text-emerald-200">Clinic Staff / Nurse</span>
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 uppercase">Operational</span>
                    </div>
                    <p className="text-[11px] text-emerald-800/80 dark:text-emerald-300/80 font-medium leading-relaxed">
                      Patient intake, token issuance, recording vital signs (BP, Pulse, SpO2, Temp), and print queue execution.
                    </p>
                  </div>
                </div>
              </div>

              {/* Quick Count Stats Bar */}
              <div className="pt-2 grid grid-cols-3 gap-2 text-center border-t border-slate-100 dark:border-slate-800">
                <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Owners</p>
                  <p className="text-base font-black text-slate-900 dark:text-white">{ownerCount}</p>
                </div>
                <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Doctors</p>
                  <p className="text-base font-black text-slate-900 dark:text-white">{doctorCount}</p>
                </div>
                <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Staff</p>
                  <p className="text-base font-black text-slate-900 dark:text-white">{staffCount}</p>
                </div>
              </div>
            </div>
        </div>

      </div>
    </div>
  );
}
