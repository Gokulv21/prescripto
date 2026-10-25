import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreditCard, Activity, ShieldAlert, Wrench, Shield, Clock, User, Fingerprint, Bot, Search, MessageSquare } from "lucide-react";
import PageBanner from "@/components/PageBanner";
import userMgmtBanner from "@/assets/user_mgmt_banner.png";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { useState } from "react";

export default function SaaSManagement() {
  const [novaSearchTerm, setNovaSearchTerm] = useState("");

  const { data: logs, isLoading } = useQuery({
    queryKey: ['security_logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('security_audit_logs')
        .select(`
          *,
          actor:profiles!security_audit_logs_actor_id_fkey(full_name),
          clinic:clinics(name)
        `)
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data;
    }
  });

  const { data: novaQueries, isLoading: isNovaLoading } = useQuery({
    queryKey: ['nova_queries_log'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('nova_queries')
        .select(`
          *,
          clinic:clinics(name)
        `)
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (error) {
        console.warn('nova_queries notice:', error.message);
        return [];
      }
      return data || [];
    }
  });

  const filteredNova = (novaQueries || []).filter((q: any) => {
    if (!novaSearchTerm.trim()) return true;
    const term = novaSearchTerm.toLowerCase();
    return (
      q.query?.toLowerCase().includes(term) ||
      q.user_name?.toLowerCase().includes(term) ||
      q.clinic?.name?.toLowerCase().includes(term)
    );
  });

  return (
    <div className="max-w-[1200px] mx-auto animate-in fade-in duration-500 pb-12">
      <PageBanner
        title="SaaS Management"
        description="Manage your clinic's subscription tier, billing, API usage, and administrative audit trails."
        imageSrc={userMgmtBanner}
      >
        <div className="w-24 h-24 flex items-center justify-center bg-white/20 rounded-2xl backdrop-blur-sm -ml-4 border border-white/30 text-white shadow-xl">
           <Wrench className="w-10 h-10" />
        </div>
      </PageBanner>

      <div className="px-4 md:px-8 mt-8">
         <Tabs defaultValue="subscription" className="w-full">
            <TabsList className="bg-card w-full flex border-b border-border p-1 rounded-2xl shadow-sm mb-6 h-auto">
               <TabsTrigger value="subscription" className="flex-1 py-3 text-xs md:text-sm font-bold gap-2 data-[state=active]:bg-blue-500/10 data-[state=active]:text-blue-600 rounded-xl">
                 <CreditCard className="w-4 h-4" /> Subscription
               </TabsTrigger>
               <TabsTrigger value="usage" className="flex-1 py-3 text-xs md:text-sm font-bold gap-2 data-[state=active]:bg-purple-500/10 data-[state=active]:text-purple-600 rounded-xl">
                 <Activity className="w-4 h-4" /> Usage Limits
               </TabsTrigger>
               <TabsTrigger value="nova" className="flex-1 py-3 text-xs md:text-sm font-bold gap-2 data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-600 rounded-xl">
                 <Bot className="w-4 h-4" /> Nova AI Searches
               </TabsTrigger>
               <TabsTrigger value="audit" className="flex-1 py-3 text-xs md:text-sm font-bold gap-2 data-[state=active]:bg-amber-500/10 data-[state=active]:text-amber-600 rounded-xl">
                 <ShieldAlert className="w-4 h-4" /> Audit Logs
               </TabsTrigger>
            </TabsList>

            <TabsContent value="subscription" className="space-y-6">
                <DevelopmentPlaceholder title="Billing & Stripe Integration" />
            </TabsContent>

            <TabsContent value="usage" className="space-y-6">
                <DevelopmentPlaceholder title="API & Data Usage Analytics" />
            </TabsContent>

            <TabsContent value="nova" className="space-y-6">
                <Card className="border-border rounded-[2rem] overflow-hidden bg-card/30 backdrop-blur-md">
                    <CardHeader className="border-b border-border bg-muted/20">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div>
                                <CardTitle className="text-xl font-black flex items-center gap-2">
                                    <Bot className="w-5 h-5 text-emerald-500" /> Nova AI Search History
                                </CardTitle>
                                <CardDescription className="font-semibold text-xs mt-1">
                                    Real-time audit of questions, clinical searches, and queries asked by clinic doctors and staff.
                                </CardDescription>
                            </div>
                            <div className="relative w-full sm:w-64">
                                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    value={novaSearchTerm}
                                    onChange={(e) => setNovaSearchTerm(e.target.value)}
                                    placeholder="Filter searches..."
                                    className="pl-9 h-9 rounded-xl text-xs"
                                />
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/30 hover:bg-muted/30 border-none">
                                    <TableHead className="font-bold py-4 pl-6 text-[10px] uppercase tracking-widest w-[160px]">Time</TableHead>
                                    <TableHead className="font-bold py-4 text-[10px] uppercase tracking-widest w-[180px]">User & Role</TableHead>
                                    <TableHead className="font-bold py-4 text-[10px] uppercase tracking-widest w-[160px]">Clinic</TableHead>
                                    <TableHead className="font-bold py-4 text-[10px] uppercase tracking-widest">Query Asked</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isNovaLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="h-24 text-center font-bold text-muted-foreground">
                                            Loading Nova query logs...
                                        </TableCell>
                                    </TableRow>
                                ) : filteredNova.length > 0 ? (
                                    filteredNova.map((item: any) => (
                                        <TableRow key={item.id} className="hover:bg-muted/20 border-border/40">
                                            <TableCell className="pl-6 font-mono text-[11px] font-bold text-muted-foreground">
                                                {format(new Date(item.created_at), 'MMM dd, HH:mm:ss')}
                                            </TableCell>
                                            <TableCell>
                                                <div className="space-y-0.5">
                                                    <p className="text-xs font-bold text-foreground">{item.user_name || 'Staff'}</p>
                                                    <Badge variant="outline" className="text-[9px] uppercase font-black px-1.5 py-0">
                                                        {item.user_role || 'staff'}
                                                    </Badge>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-xs font-medium text-muted-foreground">
                                                {item.clinic?.name || 'Clinic'}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-start gap-2">
                                                    <MessageSquare className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                                                    <span className="text-xs font-semibold text-foreground/90 font-mono bg-muted/40 px-2 py-1 rounded-md border border-border/50">
                                                        "{item.query}"
                                                    </span>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={4} className="h-28 text-center font-medium text-muted-foreground">
                                            <Bot className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                                            {novaSearchTerm ? "No queries matched your search filter." : "No queries recorded yet. As users interact with Nova, their questions will show here live."}
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </TabsContent>

            <TabsContent value="audit" className="space-y-6">
                <Card className="border-border rounded-[2rem] overflow-hidden bg-card/30 backdrop-blur-md">
                    <CardHeader className="border-b border-border bg-muted/20">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-xl font-black flex items-center gap-2">
                                    <Shield className="w-5 h-5 text-amber-500" /> Platform Security Audit
                                </CardTitle>
                                <CardDescription className="font-semibold">
                                    Real-time monitoring of sensitive platform events and security anomalies.
                                </CardDescription>
                            </div>
                            <Badge variant="outline" className="font-black uppercase tracking-widest text-[10px]">
                                Live Logs
                            </Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/30 hover:bg-muted/30 border-none">
                                    <TableHead className="font-bold py-4 pl-6 text-[10px] uppercase tracking-widest">Time</TableHead>
                                    <TableHead className="font-bold py-4 text-[10px] uppercase tracking-widest">Event Type</TableHead>
                                    <TableHead className="font-bold py-4 text-[10px] uppercase tracking-widest">User / Clinic</TableHead>
                                    <TableHead className="font-bold py-4 text-[10px] uppercase tracking-widest">Details</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="h-48 text-center">
                                            <div className="flex flex-col items-center gap-2 text-muted-foreground font-bold">
                                                <Fingerprint className="w-8 h-8 animate-pulse" />
                                                Decrypting Security Logs...
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : logs && logs.length > 0 ? (
                                    logs.map((log) => (
                                        <TableRow key={log.id} className="group border-border hover:bg-muted/10 transition-colors">
                                            <TableCell className="pl-6 font-medium text-xs">
                                                <div className="flex items-center gap-2">
                                                    <Clock className="w-3 h-3 text-muted-foreground" />
                                                    {format(new Date(log.created_at), 'MMM d, HH:mm:ss')}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge className={getEventBadgeClass(log.event_type)}>
                                                    {log.event_type}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <div className="space-y-0.5">
                                                    <p className="text-xs font-bold flex items-center gap-1">
                                                        <User className="w-3 h-3" /> {log.actor?.full_name || 'System / Guest'}
                                                    </p>
                                                    <p className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                                                        <Activity className="w-2.5 h-2.5" /> {log.clinic?.name || 'Global'}
                                                    </p>
                                                </div>
                                            </TableCell>
                                            <TableCell className="max-w-[400px]">
                                                <div className="text-[10px] font-mono bg-muted/30 p-2 rounded-lg break-words text-muted-foreground group-hover:text-foreground group-hover:bg-muted/50 transition-all border border-transparent group-hover:border-border">
                                                    {JSON.stringify(log.metadata, null, 2)}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={4} className="h-24 text-center font-bold text-muted-foreground italic">
                                            No security events recorded.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </TabsContent>
         </Tabs>
      </div>
    </div>
  );
}

function getEventBadgeClass(type: string) {
    const base = "font-black uppercase tracking-widest text-[9px] px-2 py-0.5 border-none shadow-none ";
    switch(type) {
        case 'LOGIN_SUCCESS': return base + "bg-green-500/10 text-green-600";
        case 'LOGIN_FAILURE': return base + "bg-red-500/10 text-red-600 animate-pulse";
        case 'AUTH_ERROR': return base + "bg-orange-500/10 text-orange-600";
        case 'ROLE_CHANGE': return base + "bg-blue-500/10 text-blue-600";
        case 'DATA_DELETION': return base + "bg-purple-500/10 text-purple-600";
        case 'SUSPICIOUS_TRAFFIC': return base + "bg-red-500/10 text-red-600 animate-bounce";
        default: return base + "bg-muted text-muted-foreground";
    }
}

function DevelopmentPlaceholder({ title }: { title: string }) {
    return (
        <Card className="border-2 border-dashed border-muted shadow-none bg-muted/20 rounded-3xl">
            <CardHeader className="text-center pt-16">
               <div className="mx-auto w-16 h-16 bg-blue-500/10 text-blue-600 rounded-full flex items-center justify-center mb-4">
                  <Wrench className="w-8 h-8" />
               </div>
               <CardTitle className="text-2xl font-black">{title}</CardTitle>
               <CardDescription className="max-w-md mx-auto mt-2 font-medium">
                  We are actively building this feature. Future integration will allow you to control and scale your SaaS clinic operations seamlessly.
               </CardDescription>
            </CardHeader>
            <CardContent className="pb-16 flex justify-center">
                 <div className="bg-amber-400 text-amber-900 font-bold uppercase tracking-widest text-[10px] px-3 py-1 rounded-full flex items-center gap-2 shadow-sm">
                     <span className="w-2 h-2 rounded-full bg-amber-900 animate-pulse" />
                     Under Development
                 </div>
            </CardContent>
        </Card>
    );
}
