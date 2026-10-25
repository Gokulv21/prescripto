import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Mail, 
  Copy, 
  Check, 
  Building2, 
  ShieldCheck, 
  Clock, 
  Sparkles, 
  ArrowLeft, 
  ExternalLink,
  Globe,
  Headphones,
  CheckCircle2,
  Send,
  HelpCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

export default function Contact() {
  const navigate = useNavigate();
  const { slug } = useParams();
  const [isCopied, setIsCopied] = useState(false);

  const officialEmail = 'contact.zevox@gmail.com';
  const zevoxWebsiteUrl = 'https://zevox-website.vercel.app/#contact';

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(officialEmail);
    setIsCopied(true);
    toast.success('Official Email copied to clipboard: ' + officialEmail);
    setTimeout(() => setIsCopied(false), 2500);
  };

  const handleOpenMailClient = () => {
    const subject = encodeURIComponent('PreScripto Support / Upgrade Inquiry');
    const body = encodeURIComponent(
      'Hello Zevox Team,\n\n' +
      'Project: PreScripto Clinical Intelligence\n' +
      'Clinic Name: \n' +
      'Contact Person / Doctor: \n' +
      'Phone Number: \n\n' +
      'Issue / Custom Requirement Details:\n' +
      '- Describe what you are experiencing or what plan/feature you need here...\n\n' +
      'Thank you!'
    );
    window.location.href = `mailto:${officialEmail}?subject=${subject}&body=${body}`;
  };

  return (
    <div className="min-h-screen bg-slate-50/60 dark:bg-slate-950/80 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Navigation & Breadcrumb */}
        <div className="flex items-center justify-between">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => slug ? navigate(`/${slug}/dashboard`) : navigate(-1)}
            className="flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Button>

          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              Support Desks Online
            </span>
          </div>
        </div>

        {/* Hero Section */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-3"
        >
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 text-xs font-bold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            Official Zevox Enterprise Support
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Connect with <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">ZEVOX</span>
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
            PreScripto is proudly engineered by <strong className="text-slate-800 dark:text-slate-200">Zevox</strong>. For technical support, bug reports, custom clinic deployments, or plan upgrades, reach out through our official channels below.
          </p>
        </motion.div>

        {/* Primary Contact Channels Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
          
          {/* Card 1: Official Zevox Web Portal */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="h-full border-blue-200 dark:border-blue-900/50 shadow-lg shadow-blue-500/5 bg-gradient-to-b from-white to-blue-50/20 dark:from-slate-900 dark:to-slate-900/60 relative overflow-hidden flex flex-col justify-between">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />
              
              <CardHeader className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-600/30">
                    <Globe className="w-6 h-6" />
                  </div>
                  <Badge variant="outline" className="border-blue-500/30 text-blue-600 dark:text-blue-400 font-bold text-[11px] uppercase tracking-wide">
                    Recommended
                  </Badge>
                </div>
                <div>
                  <CardTitle className="text-xl font-bold text-slate-900 dark:text-white">
                    Zevox Official Portal
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1">
                    Fill out our official project inquiry & issue resolution form online.
                  </CardDescription>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="p-3.5 rounded-xl bg-blue-500/5 dark:bg-blue-950/20 border border-blue-500/15 text-xs text-slate-700 dark:text-slate-300 space-y-2">
                  <div className="font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                    <HelpCircle className="w-4 h-4" />
                    Portal Instructions:
                  </div>
                  <p className="leading-relaxed">
                    1. ZEVOX வலைத்தளத்திற்கு செல்லுங்கள்.<br />
                    2. Contact / Project Form-ல் திட்டத்தின் பெயரை <strong className="text-blue-600 dark:text-blue-400 font-bold">"PreScripto"</strong> என்று குறிப்பிடவும்.<br />
                    3. உங்களுக்கு தேவையான உதவி அல்லது எதிர்கொள்ளும் சிக்கலை விவரித்து சப்மிட் செய்யவும்.
                  </p>
                </div>

                <div className="pt-2">
                  <Button 
                    className="w-full h-11 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold shadow-md shadow-blue-600/25 flex items-center justify-center gap-2"
                    asChild
                  >
                    <a href={zevoxWebsiteUrl} target="_blank" rel="noopener noreferrer">
                      <span>Go to ZEVOX Contact Form</span>
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Card 2: Direct Priority Email */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="h-full border-slate-200 dark:border-slate-800 shadow-lg bg-white dark:bg-slate-900 relative overflow-hidden flex flex-col justify-between">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

              <CardHeader className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/30">
                    <Mail className="w-6 h-6" />
                  </div>
                  <Badge variant="outline" className="border-indigo-500/30 text-indigo-600 dark:text-indigo-400 font-bold text-[11px] uppercase tracking-wide">
                    Fast Response
                  </Badge>
                </div>
                <div>
                  <CardTitle className="text-xl font-bold text-slate-900 dark:text-white">
                    Direct Email Support
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1">
                    Send an email directly from your Gmail, Outlook, or mail client.
                  </CardDescription>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="p-3.5 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2">
                  <div className="truncate">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Official Support Email</span>
                    <span className="text-xs sm:text-sm font-mono font-bold text-slate-900 dark:text-white truncate">
                      {officialEmail}
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyEmail}
                    className="shrink-0 h-8 px-2.5 flex items-center gap-1.5 text-xs font-semibold"
                  >
                    {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    {isCopied ? 'Copied' : 'Copy'}
                  </Button>
                </div>

                <div className="pt-2">
                  <Button 
                    variant="default"
                    onClick={handleOpenMailClient}
                    className="w-full h-11 bg-slate-900 hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-700 text-white font-bold shadow-md flex items-center justify-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                    <span>Open Email App Now</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>

        </div>

        {/* Support Highlights / Trust Info */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4"
        >
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-center space-y-1.5 shadow-sm">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 mx-auto flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
            <h4 className="text-xs font-bold text-slate-900 dark:text-white">Rapid Response</h4>
            <p className="text-[11px] text-slate-500">Inquiries answered within 2–4 business hours</p>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-center space-y-1.5 shadow-sm">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 mx-auto flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <h4 className="text-xs font-bold text-slate-900 dark:text-white">HIPAA & Data Privacy</h4>
            <p className="text-[11px] text-slate-500">Encrypted multi-tenant data architecture</p>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-center space-y-1.5 shadow-sm">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
            <h4 className="text-xs font-bold text-slate-900 dark:text-white">Clinic Customizations</h4>
            <p className="text-[11px] text-slate-500">Dedicated doctor and multi-branch rollouts</p>
          </div>
        </motion.div>

        {/* Footer Note */}
        <div className="text-center pt-4 border-t border-slate-200 dark:border-slate-800">
          <p className="text-xs text-slate-500">
            PreScripto Medical Intelligence Platform • Engineered & Maintained by{' '}
            <a 
              href={zevoxWebsiteUrl} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="font-bold text-blue-600 hover:underline inline-flex items-center gap-0.5"
            >
              ZEVOX
              <ExternalLink className="w-3 h-3" />
            </a>
          </p>
        </div>

      </div>
    </div>
  );
}
