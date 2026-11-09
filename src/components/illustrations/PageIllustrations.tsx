import React from 'react';
import { motion } from 'framer-motion';

/**
 * High-End Google-Grade Vector Illustrations for PreScripto Clinical Suite.
 * Custom crafted in Prescripto's official palette:
 * - Brand Blue: #2563eb / #1d4ed8 / #38bdf8
 * - Clinical Emerald: #10b981 / #059669
 * - Executive Purple: #8b5cf6 / #7c3aed
 * - Amber / Gold: #f59e0b / #d97706
 * - Clean Slate: #0f172a / #1e293b / #64748b / #cbd5e1
 */

// ─────────────────────────────────────────────────────────────
// 1. DASHBOARD: Complete PreScripto Ecosystem Workflow Loop
// Visualizes: 1. Patient Intake & Vitals → 2. Doctor Consultation & Rx → 3. Print & Pharmacy
// ─────────────────────────────────────────────────────────────
export function DashboardEcosystemIllustration({ className = "w-full max-w-2xl h-auto" }: { className?: string }) {
  return (
    <div className={className}>
      <svg viewBox="0 0 760 360" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto">
        <defs>
          <linearGradient id="dbEcoLine1" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="50%" stopColor="#2563eb" />
            <stop offset="100%" stopColor="#8b5cf6" />
          </linearGradient>
          <filter id="ecoGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Background Ambient Cloud */}
        <path
          d="M120 180 C80 140 100 80 180 80 C240 40 340 50 400 80 C480 50 560 70 600 120 C680 140 700 220 640 270 C580 320 480 300 420 310 C340 330 240 310 180 280 C110 270 80 220 120 180 Z"
          fill="#f8fafc"
          className="dark:fill-slate-900/50"
        />

        {/* Connecting Curved Workflow Highway */}
        <path
          d="M160 180 C 220 100, 320 100, 380 180 C 440 260, 540 260, 600 180"
          stroke="url(#dbEcoLine1)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray="10 8"
          fill="none"
          opacity="0.8"
        />

        {/* ── STAGE 1: PATIENT INTAKE & VITALS (Left) ── */}
        <g transform="translate(60, 90)">
          {/* Node Background */}
          <rect x="0" y="0" width="180" height="180" rx="24" fill="#ffffff" stroke="#e2e8f0" strokeWidth="2" className="dark:fill-slate-800 dark:stroke-slate-700 shadow-lg" />
          <div className="p-3">
            {/* Step Pill */}
            <rect x="20" y="16" width="68" height="22" rx="11" fill="#ecfdf5" stroke="#a7f3d0" strokeWidth="1" className="dark:fill-emerald-950/40 dark:stroke-emerald-800" />
            <circle cx="32" cy="27" r="4" fill="#10b981" />
            <text x="44" y="31" fill="#059669" fontSize="10" fontWeight="900" fontFamily="sans-serif">STEP 01</text>
            
            {/* Stage Title */}
            <text x="20" y="58" fill="#0f172a" fontSize="13" fontWeight="900" fontFamily="sans-serif" className="dark:fill-white">Patient Intake</text>
            <text x="20" y="73" fill="#64748b" fontSize="10" fontWeight="600" fontFamily="sans-serif">Tokens & Vitals Check</text>

            {/* Vitals Mini Card */}
            <g transform="translate(20, 88)">
              <rect x="0" y="0" width="140" height="58" rx="12" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1" className="dark:fill-slate-900 dark:stroke-slate-700" />
              {/* BP & SpO2 indicators */}
              <text x="12" y="24" fill="#10b981" fontSize="11" fontWeight="800">BP: 120/80</text>
              <text x="80" y="24" fill="#2563eb" fontSize="11" fontWeight="800">SpO₂: 99%</text>
              <line x1="12" y1="36" x2="128" y2="36" stroke="#e2e8f0" strokeWidth="1" />
              {/* Heartbeat pulse animation line */}
              <path d="M12 46 L30 46 L35 38 L42 52 L48 40 L54 46 L128 46" stroke="#f43f5e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </g>
          </div>
        </g>

        {/* ── STAGE 2: DOCTOR CONSULTATION & RX (Center) ── */}
        <g transform="translate(290, 70)">
          {/* Node Background */}
          <rect x="0" y="0" width="180" height="200" rx="28" fill="#ffffff" stroke="#93c5fd" strokeWidth="2.5" className="dark:fill-slate-800 dark:stroke-blue-700 shadow-xl" />
          
          {/* Step Pill */}
          <rect x="20" y="18" width="68" height="22" rx="11" fill="#eff6ff" stroke="#bfdbfe" strokeWidth="1" className="dark:fill-blue-950/40 dark:stroke-blue-800" />
          <circle cx="32" cy="29" r="4" fill="#2563eb" />
          <text x="44" y="33" fill="#2563eb" fontSize="10" fontWeight="900" fontFamily="sans-serif">STEP 02</text>

          {/* Stage Title */}
          <text x="20" y="60" fill="#0f172a" fontSize="13" fontWeight="900" fontFamily="sans-serif" className="dark:fill-white">Consultation</text>
          <text x="20" y="75" fill="#64748b" fontSize="10" fontWeight="600" fontFamily="sans-serif">Digital & Stylus Rx</text>

          {/* Prescription Pad Mini Graphic */}
          <g transform="translate(20, 90)">
            <rect x="0" y="0" width="140" height="82" rx="12" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1" className="dark:fill-slate-900 dark:stroke-slate-700" />
            <text x="12" y="24" fill="#2563eb" fontSize="14" fontWeight="900" fontFamily="serif">℞</text>
            <line x1="32" y1="20" x2="128" y2="20" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" />
            <line x1="12" y1="36" x2="110" y2="36" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" />
            <line x1="12" y1="48" x2="90" y2="48" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" />
            {/* Signature flourish */}
            <path d="M12 68 Q30 58 50 66 T90 62" stroke="#2563eb" strokeWidth="2" fill="none" strokeLinecap="round" />
            <circle cx="118" cy="64" r="8" fill="#10b981" />
            <path d="M115 64 L117 66 L122 61" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </g>
        </g>

        {/* ── STAGE 3: PRINT QUEUE & DISPENSE (Right) ── */}
        <g transform="translate(520, 90)">
          {/* Node Background */}
          <rect x="0" y="0" width="180" height="180" rx="24" fill="#ffffff" stroke="#e2e8f0" strokeWidth="2" className="dark:fill-slate-800 dark:stroke-slate-700 shadow-lg" />
          
          {/* Step Pill */}
          <rect x="20" y="16" width="68" height="22" rx="11" fill="#f5f3ff" stroke="#ddd6fe" strokeWidth="1" className="dark:fill-purple-950/40 dark:stroke-purple-800" />
          <circle cx="32" cy="27" r="4" fill="#8b5cf6" />
          <text x="44" y="31" fill="#7c3aed" fontSize="10" fontWeight="900" fontFamily="sans-serif">STEP 03</text>

          {/* Stage Title */}
          <text x="20" y="58" fill="#0f172a" fontSize="13" fontWeight="900" fontFamily="sans-serif" className="dark:fill-white">Pharmacy Print</text>
          <text x="20" y="73" fill="#64748b" fontSize="10" fontWeight="600" fontFamily="sans-serif">Instant A4 & Thermal</text>

          {/* Printer Mini Graphic */}
          <g transform="translate(20, 88)">
            <rect x="0" y="0" width="140" height="58" rx="12" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1" className="dark:fill-slate-900 dark:stroke-slate-700" />
            {/* Printer machine body */}
            <rect x="25" y="14" width="90" height="32" rx="6" fill="#1e293b" />
            <rect x="35" y="6" width="70" height="14" rx="2" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1" className="dark:fill-slate-800" />
            <line x1="42" y1="12" x2="72" y2="12" stroke="#2563eb" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="102" cy="24" r="3" fill="#10b981" />
            <rect x="40" y="36" width="60" height="16" rx="2" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1" className="dark:fill-slate-800" />
            <line x1="46" y1="42" x2="80" y2="42" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" />
          </g>
        </g>

        {/* Pulse Navigation Dot Floating along the track */}
        <motion.circle
          cx="380"
          cy="180"
          r="9"
          fill="#2563eb"
          animate={{ scale: [1, 1.3, 1], opacity: [0.8, 1, 0.8] }}
          transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }}
        />
      </svg>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 2. PATIENT ENTRY: Nurse in Uniform holding Clipboard & Intake Pad
// ─────────────────────────────────────────────────────────────
export function NursePatientEntryIllustration({ className = "w-full max-w-sm h-auto" }: { className?: string }) {
  return (
    <svg viewBox="0 0 420 340" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      {/* Background Soft Aura */}
      <circle cx="210" cy="170" r="130" fill="#ecfdf5" className="dark:fill-emerald-950/20" />

      {/* Floating Vitals Badge Top Left */}
      <g transform="translate(40, 50)">
        <rect x="0" y="0" width="110" height="52" rx="14" fill="#ffffff" stroke="#a7f3d0" strokeWidth="2" className="dark:fill-slate-800 dark:stroke-emerald-800 shadow-md" />
        <circle cx="22" cy="26" r="12" fill="#10b981" />
        <path d="M17 26 L20 29 L27 22" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <text x="42" y="22" fill="#0f172a" fontSize="11" fontWeight="800" fontFamily="sans-serif" className="dark:fill-white">Vitals Intake</text>
        <text x="42" y="37" fill="#10b981" fontSize="9" fontWeight="700" fontFamily="sans-serif">Verified & Active</text>
      </g>

      {/* Floating Token Queue Badge Top Right */}
      <g transform="translate(280, 40)">
        <rect x="0" y="0" width="100" height="48" rx="14" fill="#ffffff" stroke="#bfdbfe" strokeWidth="2" className="dark:fill-slate-800 dark:stroke-blue-800 shadow-md" />
        <circle cx="22" cy="24" r="10" fill="#2563eb" />
        <text x="18" y="28" fill="#ffffff" fontSize="10" fontWeight="900" fontFamily="sans-serif">#</text>
        <text x="38" y="20" fill="#0f172a" fontSize="10" fontWeight="800" fontFamily="sans-serif" className="dark:fill-white">Token #42</text>
        <text x="38" y="34" fill="#2563eb" fontSize="9" fontWeight="700" fontFamily="sans-serif">Next In Queue</text>
      </g>

      {/* Nurse Character Center */}
      <g transform="translate(140, 45)">
        {/* Hair Bun & Head */}
        <circle cx="65" cy="40" r="30" fill="#0f172a" />
        <circle cx="65" cy="18" r="14" fill="#0f172a" />
        {/* Head */}
        <circle cx="65" cy="48" r="20" fill="#f43f5e" />
        
        {/* Face features */}
        <circle cx="58" cy="46" r="2" fill="#0f172a" />
        <circle cx="72" cy="46" r="2" fill="#0f172a" />
        <path d="M60 55 Q65 60 70 55" stroke="#0f172a" strokeWidth="1.5" strokeLinecap="round" fill="none" />

        {/* Clinical Teal Scrub Uniform */}
        <path d="M40 76 C40 68 52 64 65 64 C78 64 90 68 90 76 L100 230 L30 230 Z" fill="#0d9488" />
        <path d="M52 64 L65 84 L78 64 Z" fill="#ffffff" />
        {/* Nurse ID Badge on Chest */}
        <rect x="74" y="88" width="16" height="20" rx="3" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1" />
        <rect x="77" y="91" width="10" height="4" rx="1" fill="#0d9488" />
        <line x1="77" y1="99" x2="87" y2="99" stroke="#94a3b8" strokeWidth="1.5" />
        <line x1="77" y1="103" x2="84" y2="103" stroke="#94a3b8" strokeWidth="1.5" />

        {/* Arms holding Medical Clipboard Pad */}
        <path d="M42 85 L20 130 L45 150" stroke="#0d9488" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <path d="M88 85 L110 130 L85 150" stroke="#0d9488" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" fill="none" />

        {/* Medical Clipboard Pad */}
        <g transform="translate(32, 120)">
          {/* Clipboard base */}
          <rect x="0" y="0" width="72" height="96" rx="8" fill="#78350f" stroke="#451a03" strokeWidth="2" shadow-md />
          {/* Top Metallic Clip */}
          <rect x="22" y="-6" width="28" height="12" rx="3" fill="#cbd5e1" stroke="#64748b" strokeWidth="1.5" />
          <circle cx="36" cy="-1" r="3" fill="#475569" />
          {/* Paper on Pad */}
          <rect x="6" y="8" width="60" height="82" rx="4" fill="#ffffff" className="dark:fill-slate-900" />
          {/* Form Rows with checkmarks */}
          <circle cx="16" cy="22" r="4" fill="#10b981" />
          <line x1="26" y1="22" x2="56" y2="22" stroke="#0f172a" strokeWidth="2" strokeLinecap="round" className="dark:stroke-white" />
          <circle cx="16" cy="38" r="4" fill="#10b981" />
          <line x1="26" y1="38" x2="52" y2="38" stroke="#0f172a" strokeWidth="2" strokeLinecap="round" className="dark:stroke-white" />
          <circle cx="16" cy="54" r="4" fill="#10b981" />
          <line x1="26" y1="54" x2="58" y2="54" stroke="#0f172a" strokeWidth="2" strokeLinecap="round" className="dark:stroke-white" />
          <circle cx="16" cy="70" r="4" fill="#38bdf8" />
          <line x1="26" y1="70" x2="48" y2="70" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" />
        </g>

        {/* Pen in Hand */}
        <g transform="translate(98, 145) rotate(35)">
          <rect x="0" y="0" width="6" height="28" rx="2" fill="#2563eb" />
          <path d="M0 28 L3 34 L6 28 Z" fill="#0f172a" />
        </g>
      </g>
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────
// 3. CONSULTATION: Doctor Consulting with Stethoscope on Desk
// ─────────────────────────────────────────────────────────────
export function DoctorConsultationIllustration({ className = "w-full max-w-md h-auto" }: { className?: string }) {
  return (
    <svg viewBox="0 0 500 360" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      {/* Background Soft Office Atmosphere */}
      <circle cx="250" cy="180" r="140" fill="#eff6ff" className="dark:fill-slate-800/30" />

      {/* Floating Clinical Cross Badge */}
      <g transform="translate(60, 45)">
        <rect x="0" y="0" width="46" height="46" rx="14" fill="#ffffff" stroke="#93c5fd" strokeWidth="2" className="dark:fill-slate-800 shadow-md" />
        <rect x="19" y="10" width="8" height="26" rx="2" fill="#2563eb" />
        <rect x="10" y="19" width="26" height="8" rx="2" fill="#2563eb" />
      </g>

      {/* Floating Rx Badge */}
      <g transform="translate(390, 50)">
        <circle cx="24" cy="24" r="24" fill="#ffffff" stroke="#a7f3d0" strokeWidth="2" className="dark:fill-slate-800 shadow-md" />
        <text x="14" y="32" fill="#059669" fontSize="22" fontWeight="900" fontFamily="serif">℞</text>
      </g>

      {/* Consultation Desk */}
      <rect x="50" y="240" width="400" height="14" rx="7" fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="2" className="dark:fill-slate-800 dark:stroke-slate-700" />
      <line x1="80" y1="254" x2="75" y2="330" stroke="#cbd5e1" strokeWidth="6" strokeLinecap="round" className="dark:stroke-slate-700" />
      <line x1="420" y1="254" x2="425" y2="330" stroke="#cbd5e1" strokeWidth="6" strokeLinecap="round" className="dark:stroke-slate-700" />

      {/* Doctor (Left of desk) */}
      <g transform="translate(110, 70)">
        {/* Hair */}
        <circle cx="50" cy="38" r="28" fill="#0f172a" />
        <circle cx="50" cy="45" r="19" fill="#f43f5e" />
        <circle cx="44" cy="44" r="2" fill="#0f172a" />
        <circle cx="56" cy="44" r="2" fill="#0f172a" />
        <path d="M46 53 Q50 57 54 53" stroke="#0f172a" strokeWidth="1.5" strokeLinecap="round" fill="none" />

        {/* Doctor Coat with Stethoscope */}
        <path d="M25 78 C25 68 36 64 50 64 C64 64 75 68 75 78 L85 170 L15 170 Z" fill="#ffffff" stroke="#cbd5e1" strokeWidth="2" className="dark:fill-slate-800" />
        <path d="M42 64 L50 88 L58 64 Z" fill="#2563eb" />

        {/* Stethoscope around doctor neck */}
        <path d="M38 74 C36 100 45 116 50 116 C55 116 64 100 62 74" stroke="#334155" strokeWidth="3.5" fill="none" strokeLinecap="round" />
        <circle cx="50" cy="120" r="5" fill="#2563eb" stroke="#ffffff" strokeWidth="1.5" />

        {/* Arm reaching across desk to write Rx */}
        <path d="M72 90 L110 130 L145 168" stroke="#ffffff" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <ellipse cx="148" cy="170" rx="6" ry="5" fill="#f43f5e" />
      </g>

      {/* Rx Prescription Sheet on Desk */}
      <g transform="translate(240, 190) rotate(5)">
        <rect x="0" y="0" width="80" height="60" rx="6" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.5" className="dark:fill-slate-900 shadow-md" />
        <text x="10" y="20" fill="#2563eb" fontSize="14" fontWeight="bold" fontFamily="serif">℞</text>
        <line x1="28" y1="16" x2="70" y2="16" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" />
        <line x1="10" y1="28" x2="65" y2="28" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" />
        <line x1="10" y1="38" x2="55" y2="38" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" />
        <path d="M10 50 Q25 44 45 48" stroke="#2563eb" strokeWidth="1.5" fill="none" />
      </g>

      {/* Patient (Right of desk, listening attentively) */}
      <g transform="translate(320, 85)">
        <circle cx="45" cy="40" r="25" fill="#0f172a" />
        <circle cx="45" cy="46" r="18" fill="#f43f5e" />
        {/* Soft Smile */}
        <circle cx="40" cy="45" r="2" fill="#0f172a" />
        <circle cx="52" cy="45" r="2" fill="#0f172a" />
        <path d="M43 54 Q46 57 49 54" stroke="#0f172a" strokeWidth="1.5" strokeLinecap="round" fill="none" />
        {/* Patient Casual Sweater */}
        <path d="M22 76 C22 68 34 65 45 65 C56 65 68 68 68 76 L76 155 L14 155 Z" fill="#f59e0b" />
        {/* Arm on desk */}
        <path d="M24 88 L-5 130 L-25 155" stroke="#f59e0b" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <ellipse cx="-28" cy="157" rx="6" ry="5" fill="#f43f5e" />
      </g>
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────
// 4. PRINT QUEUE: Animated Prescription Printer with Yoyo Slide Motion
// Prescription paper animates sliding smoothly out and back into the tray
// ─────────────────────────────────────────────────────────────
export function PrinterPrescriptionAnimatedIllustration({ 
  className = "w-full max-w-sm h-auto",
  clinicName
}: { 
  className?: string;
  clinicName?: string;
}) {
  const displayTitle = (clinicName?.trim() || 'CLINIC').toUpperCase().slice(0, 14);
  return (
    <div className={className}>
      <svg viewBox="0 0 420 340" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto">

        {/* Floating Print Ready Badge */}
        <g transform="translate(45, 45)">
          <rect x="0" y="0" width="105" height="46" rx="14" fill="#ffffff" stroke="#ddd6fe" strokeWidth="2" className="dark:fill-slate-800 shadow-md" />
          <circle cx="22" cy="23" r="10" fill="#8b5cf6" />
          <path d="M17 23 L20 26 L27 19" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <text x="38" y="20" fill="#0f172a" fontSize="10" fontWeight="800" fontFamily="sans-serif" className="dark:fill-white">Auto Spooler</text>
          <text x="38" y="33" fill="#8b5cf6" fontSize="9" fontWeight="700" fontFamily="sans-serif">Ready to Print</text>
        </g>

        {/* Printer Stand / Table Base */}
        <rect x="60" y="270" width="300" height="12" rx="6" fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="2" className="dark:fill-slate-800 dark:stroke-slate-700" />
        <line x1="90" y1="282" x2="85" y2="330" stroke="#cbd5e1" strokeWidth="5" strokeLinecap="round" className="dark:stroke-slate-700" />
        <line x1="330" y1="282" x2="335" y2="330" stroke="#cbd5e1" strokeWidth="5" strokeLinecap="round" className="dark:stroke-slate-700" />

        {/* ── SMOOTH YOYO ANIMATED PRESCRIPTION PAPER ── */}
        <motion.g
          animate={{ y: [0, -32, 0] }}
          transition={{
            repeat: Infinity,
            duration: 3.4,
            ease: "easeInOut"
          }}
          transform="translate(135, 75)"
        >
          {/* A4 Sheet Frame */}
          <rect x="0" y="0" width="150" height="175" rx="10" fill="#ffffff" stroke="#93c5fd" strokeWidth="2" className="dark:fill-slate-900 shadow-xl" />
          {/* Header Banner */}
          <rect x="12" y="14" width="126" height="26" rx="6" fill="#eff6ff" className="dark:fill-slate-800" />
          <text x="20" y="31" fill="#2563eb" fontSize={displayTitle.length > 10 ? "10" : "11"} fontWeight="900" fontFamily="sans-serif">
            {displayTitle}
          </text>
          <text x="100" y="31" fill="#10b981" fontSize="9" fontWeight="800">Rx</text>
          
          {/* Rx Symbol */}
          <text x="18" y="62" fill="#2563eb" fontSize="16" fontWeight="bold" fontFamily="serif">℞</text>
          <line x1="38" y1="58" x2="132" y2="58" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" />
          
          {/* Medicine Lines */}
          <line x1="18" y1="78" x2="115" y2="78" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="18" y1="92" x2="95" y2="92" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" />
          <line x1="18" y1="106" x2="125" y2="106" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="18" y1="120" x2="85" y2="120" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" />

          {/* Doctor Signature Stamp */}
          <path d="M18 148 Q40 138 65 144 T110 140" stroke="#2563eb" strokeWidth="2" fill="none" strokeLinecap="round" />
          <text x="18" y="160" fill="#94a3b8" fontSize="8" fontWeight="700">VERIFIED CLINICAL RECORD</text>
        </motion.g>

        {/* ── PRINTER BODY FRONT & OUTPUT TRAY ── */}
        <g transform="translate(100, 160)">
          {/* Printer Main Chasis */}
          <rect x="0" y="30" width="220" height="85" rx="16" fill="#1e293b" stroke="#0f172a" strokeWidth="3" className="dark:fill-slate-900 shadow-2xl" />
          
          {/* Paper Output Slot Cover */}
          <rect x="25" y="18" width="170" height="24" rx="6" fill="#334155" stroke="#1e293b" strokeWidth="2" />
          <rect x="35" y="24" width="150" height="8" rx="4" fill="#0f172a" />

          {/* Front Output Receiving Tray */}
          <path d="M35 105 L185 105 L175 125 L45 125 Z" fill="#334155" stroke="#1e293b" strokeWidth="2" />

          {/* Control LCD Panel */}
          <rect x="25" y="55" width="65" height="32" rx="6" fill="#0f172a" stroke="#475569" strokeWidth="1.5" />
          <text x="32" y="70" fill="#38bdf8" fontSize="9" fontWeight="800" fontFamily="monospace">ONLINE</text>
          <text x="32" y="81" fill="#10b981" fontSize="8" fontWeight="700" fontFamily="monospace">A4 FEED</text>

          {/* Glowing Green LED Status */}
          <motion.circle
            cx="175"
            cy="70"
            r="6"
            fill="#10b981"
            animate={{ opacity: [0.6, 1, 0.6] }}
            transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
          />
          <circle cx="195" cy="70" r="5" fill="#38bdf8" />
        </g>
      </svg>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 5. PATIENT DIRECTORY: Doctor with Tablet & Live Patient Roster
// (Relocated from consultation empty state as requested)
// ─────────────────────────────────────────────────────────────
export function PatientDirectoryIllustration({ className = "w-full max-w-sm h-auto" }: { className?: string }) {
  return (
    <svg viewBox="0 0 420 320" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      {/* Background Phone / Tablet Dashboard Frame */}
      <g transform="translate(190, 20)">
        <rect x="0" y="0" width="180" height="270" rx="20" fill="#ffffff" stroke="#1e293b" strokeWidth="4" className="dark:fill-slate-900 shadow-lg" />
        {/* Top Header Banner on Screen */}
        <path d="M0 20 C0 9 9 0 20 0 L160 0 C171 0 180 9 180 20 L180 45 L0 45 Z" fill="#2563eb" />
        <text x="20" y="28" fill="#ffffff" fontSize="12" fontWeight="900">PATIENT ROSTER</text>
        
        {/* Mini Chart Lines on Screen */}
        <path d="M20 115 Q50 85 80 100 T140 75 L160 90" stroke="#2563eb" strokeWidth="3" strokeLinecap="round" fill="none" />
        <path d="M20 115 Q50 85 80 100 T140 75 L160 90 L160 135 L20 135 Z" fill="#dbeafe" opacity="0.4" />
        
        {/* Status Rows */}
        <rect x="20" y="155" width="140" height="20" rx="6" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1" className="dark:fill-slate-800 dark:stroke-slate-700" />
        <text x="30" y="169" fill="#0f172a" fontSize="9" fontWeight="800" className="dark:fill-white">#1 Mr. John</text>
        <circle cx="145" cy="165" r="4" fill="#10b981" />

        <rect x="20" y="185" width="140" height="20" rx="6" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1" className="dark:fill-slate-800 dark:stroke-slate-700" />
        <text x="30" y="199" fill="#0f172a" fontSize="9" fontWeight="800" className="dark:fill-white">#5 Mrs. Sarah</text>
        <circle cx="145" cy="195" r="4" fill="#10b981" />

        <rect x="20" y="215" width="140" height="20" rx="6" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1" className="dark:fill-slate-800 dark:stroke-slate-700" />
        <text x="30" y="229" fill="#0f172a" fontSize="9" fontWeight="800" className="dark:fill-white">#15 Mr. Robert</text>
        <circle cx="145" cy="225" r="4" fill="#38bdf8" />
      </g>

      {/* Floating Checkmark Speech Bubble */}
      <g transform="translate(140, 15)">
        <path
          d="M30 0 C46 0 60 12 60 28 C60 44 46 56 30 56 C24 56 18 54 14 51 L0 58 L5 44 C2 39 0 34 0 28 C0 12 14 0 30 0 Z"
          fill="#ffffff"
          stroke="#cbd5e1"
          strokeWidth="2"
          className="dark:fill-slate-800 dark:stroke-slate-700 shadow-md"
        />
        <path d="M18 28 L26 36 L42 18" stroke="#10b981" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
      </g>

      {/* Potted Plant (Bottom Right) */}
      <g transform="translate(340, 230)">
        <path d="M12 25 L38 25 L33 50 L17 50 Z" fill="#0f172a" />
        <path d="M25 25 C25 10 10 5 10 5 C10 5 15 20 25 25 Z" fill="#10b981" />
        <path d="M25 25 C25 8 38 2 38 2 C38 2 35 18 25 25 Z" fill="#059669" />
      </g>

      {/* Doctor Character (Holding Phone & Smiling) */}
      <g transform="translate(50, 45)">
        {/* Curly Hair */}
        <circle cx="65" cy="48" r="32" fill="#0f172a" />
        <circle cx="65" cy="55" r="22" fill="#f43f5e" />
        
        {/* Round Glasses */}
        <circle cx="56" cy="52" r="9" stroke="#0f172a" strokeWidth="2.5" fill="none" />
        <circle cx="74" cy="52" r="9" stroke="#0f172a" strokeWidth="2.5" fill="none" />
        <line x1="65" y1="52" x2="65" y2="52" stroke="#0f172a" strokeWidth="2.5" />
        <path d="M60 66 Q65 71 70 66" stroke="#0f172a" strokeWidth="2" strokeLinecap="round" fill="none" />

        {/* Doctor Blue Blazer / White Inner Coat */}
        <path d="M40 95 C40 85 52 82 65 82 C78 82 90 85 90 95 L100 210 L30 210 Z" fill="#2563eb" />
        <path d="M54 82 L65 110 L76 82 Z" fill="#ffffff" />
        
        {/* Hand holding device */}
        <path d="M42 105 L15 155 L40 185" stroke="#2563eb" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <path d="M36 175 L52 170" stroke="#f43f5e" strokeWidth="8" strokeLinecap="round" fill="none" />
        
        {/* Mobile Device in Hand */}
        <g transform="translate(48, 140) rotate(-15)">
          <rect x="0" y="0" width="44" height="65" rx="8" fill="#ffffff" stroke="#0f172a" strokeWidth="3" className="dark:fill-slate-900 shadow-md" />
          <circle cx="22" cy="22" r="10" stroke="#2563eb" strokeWidth="3" fill="none" />
          <line x1="8" y1="42" x2="36" y2="42" stroke="#10b981" strokeWidth="3" strokeLinecap="round" />
        </g>
      </g>
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────
// 6. ANALYTICS: Healthcare Data Analysts Seated & Analyzing Board
// ─────────────────────────────────────────────────────────────
export function AnalyticsAnalystsIllustration({ className = "w-full max-w-md h-auto" }: { className?: string }) {
  return (
    <svg viewBox="0 0 520 350" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      {/* Background Soft Cloud */}
      <circle cx="260" cy="170" r="135" fill="#eff6ff" className="dark:fill-slate-800/30" />

      {/* Large Analytics Presentation Board (Center-Left) */}
      <g transform="translate(60, 40)">
        {/* Board Outer Frame */}
        <rect x="0" y="0" width="260" height="175" rx="16" fill="#ffffff" stroke="#cbd5e1" strokeWidth="2.5" className="dark:fill-slate-900 dark:stroke-slate-700 shadow-xl" />
        {/* Top Header Strip */}
        <rect x="16" y="16" width="228" height="24" rx="6" fill="#f8fafc" className="dark:fill-slate-800" />
        <text x="26" y="32" fill="#2563eb" fontSize="11" fontWeight="900" fontFamily="sans-serif">CLINICAL PERFORMANCE</text>
        <circle cx="225" cy="28" r="4" fill="#10b981" />

        {/* Bar Charts */}
        <rect x="30" y="105" width="18" height="45" rx="4" fill="#93c5fd" />
        <rect x="58" y="80" width="18" height="70" rx="4" fill="#3b82f6" />
        <rect x="86" y="65" width="18" height="85" rx="4" fill="#2563eb" />
        <rect x="114" y="90" width="18" height="60" rx="4" fill="#60a5fa" />
        <rect x="142" y="55" width="18" height="95" rx="4" fill="#10b981" />

        {/* Growth Curve Line Overlay */}
        <path d="M35 110 Q85 85 115 70 T155 45" stroke="#f59e0b" strokeWidth="3" strokeLinecap="round" fill="none" />
        <circle cx="155" cy="45" r="4" fill="#f59e0b" />

        {/* Mini KPI Card */}
        <g transform="translate(175, 60)">
          <rect x="0" y="0" width="70" height="42" rx="8" fill="#f1f5f9" className="dark:fill-slate-800" />
          <text x="8" y="18" fill="#64748b" fontSize="8" fontWeight="700">PATIENT FLOW</text>
          <text x="8" y="34" fill="#10b981" fontSize="13" fontWeight="900">+28.4%</text>
        </g>
      </g>

      {/* Analyst 1 (Standing, Presenting to Board) */}
      <g transform="translate(300, 75)">
        <circle cx="35" cy="30" r="18" fill="#0f172a" />
        <circle cx="35" cy="36" r="13" fill="#f43f5e" />
        {/* Navy Blue Suit */}
        <path d="M18 58 C18 52 26 48 35 48 C44 48 52 52 52 58 L58 140 L12 140 Z" fill="#1e293b" />
        {/* Left Arm pointing at Analytics Board */}
        <path d="M22 65 L-20 75 L-40 65" stroke="#f43f5e" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        {/* Pointer stick in hand */}
        <line x1="-40" y1="65" x2="-80" y2="40" stroke="#f59e0b" strokeWidth="3" strokeLinecap="round" />
        {/* Right arm on waist */}
        <path d="M50 68 L68 90 L56 105" stroke="#f43f5e" strokeWidth="6" strokeLinecap="round" fill="none" />
        {/* Pants */}
        <path d="M15 140 L10 230 L26 230 L32 160 L38 230 L54 230 L52 140 Z" fill="#0f172a" />
      </g>

      {/* Analyst 2 (Seated at desk with laptop taking notes) */}
      <g transform="translate(380, 140)">
        <circle cx="28" cy="26" r="16" fill="#0f172a" />
        <circle cx="28" cy="32" r="12" fill="#f43f5e" />
        <path d="M12 52 C12 46 20 44 28 44 C36 44 44 46 44 52 L48 100 L8 100 Z" fill="#2563eb" />
        {/* Desk & Laptop */}
        <rect x="-35" y="95" width="100" height="8" rx="4" fill="#cbd5e1" />
        <path d="M-15 80 L15 80 L10 95 L-20 95 Z" fill="#64748b" />
      </g>
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────
// 7. DOCTOR PROFILE: Doctor Customizing Professional Credentials ID
// ─────────────────────────────────────────────────────────────
export function DoctorProfileSetupIllustration({ className = "w-full max-w-sm h-auto" }: { className?: string }) {
  return (
    <svg viewBox="0 0 420 330" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      {/* Background Soft Aura */}
      <circle cx="210" cy="165" r="125" fill="#eff6ff" className="dark:fill-slate-800/30" />

      {/* Large Official Physician ID Badge Frame (Center) */}
      <g transform="translate(140, 35)">
        <rect x="0" y="0" width="220" height="250" rx="20" fill="#ffffff" stroke="#93c5fd" strokeWidth="2.5" className="dark:fill-slate-900 shadow-xl" />
        
        {/* Lanyard Clip Top */}
        <rect x="85" y="-12" width="50" height="18" rx="6" fill="#1e293b" />
        <circle cx="110" cy="-3" r="5" fill="#ffffff" />

        {/* Doctor Photo Frame */}
        <circle cx="110" cy="55" r="34" fill="#eff6ff" stroke="#2563eb" strokeWidth="2" className="dark:fill-slate-800" />
        <circle cx="110" cy="48" r="16" fill="#0f172a" />
        <path d="M92 78 C92 68 100 66 110 66 C120 66 128 68 128 78 Z" fill="#2563eb" />

        {/* Doctor Identity Text Lines */}
        <text x="110" y="112" fill="#0f172a" fontSize="13" fontWeight="900" textAnchor="middle" className="dark:fill-white">Dr. Practitioner</text>
        <text x="110" y="128" fill="#2563eb" fontSize="10" fontWeight="700" textAnchor="middle">MBBS., MD. (General Med)</text>

        {/* NMC Reg Verified Pill */}
        <g transform="translate(35, 142)">
          <rect x="0" y="0" width="150" height="26" rx="13" fill="#ecfdf5" stroke="#a7f3d0" strokeWidth="1" className="dark:fill-emerald-950/40" />
          <circle cx="16" cy="13" r="5" fill="#10b981" />
          <text x="28" y="17" fill="#059669" fontSize="10" fontWeight="800">REG. NO: 152590 (NMC)</text>
        </g>

        {/* Digital Signature Area */}
        <g transform="translate(35, 180)">
          <rect x="0" y="0" width="150" height="42" rx="8" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1" strokeDasharray="4 4" className="dark:fill-slate-800" />
          <path d="M15 26 Q35 14 65 24 T130 18" stroke="#2563eb" strokeWidth="2" fill="none" strokeLinecap="round" />
          <text x="75" y="38" fill="#94a3b8" fontSize="8" fontWeight="700" textAnchor="middle">AUTHENTIC DIGITAL SIGNATURE</text>
        </g>
      </g>

      {/* Doctor (Left, holding verification seal) */}
      <g transform="translate(45, 80)">
        <circle cx="45" cy="36" r="22" fill="#0f172a" />
        <circle cx="45" cy="42" r="16" fill="#f43f5e" />
        {/* Doctor Coat */}
        <path d="M22 68 C22 60 32 56 45 56 C58 56 68 60 68 68 L76 170 L14 170 Z" fill="#ffffff" stroke="#cbd5e1" strokeWidth="2" className="dark:fill-slate-800" />
        <path d="M38 56 L45 78 L52 56 Z" fill="#2563eb" />
        {/* Arm pointing to verification badge */}
        <path d="M62 75 L95 90 L115 85" stroke="#f43f5e" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </g>
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────
// 8. SETTINGS: Big Gear / Cogwheel Being Repaired with Spanner
// Features smooth subtle rotational oscillation
// ─────────────────────────────────────────────────────────────
export function SettingsSpannerGearIllustration({ className = "w-full max-w-sm h-auto" }: { className?: string }) {
  return (
    <div className={className}>
      <svg viewBox="0 0 420 340" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto">
        {/* Background Soft Aura */}
        <circle cx="210" cy="170" r="130" fill="#eff6ff" className="dark:fill-slate-800/30" />

        {/* Small Companion Gears in Background */}
        <g opacity="0.3" stroke="#94a3b8" strokeWidth="2.5">
          <circle cx="340" cy="80" r="30" strokeDasharray="6 6" />
          <circle cx="340" cy="80" r="12" />
          <circle cx="90" cy="240" r="25" strokeDasharray="5 5" />
          <circle cx="90" cy="240" r="10" />
        </g>

        {/* ── ROTATING MASTER COGWHEEL ── */}
        <motion.g
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 25, ease: "linear" }}
          style={{ originX: "210px", originY: "170px" }}
        >
          {/* Main Gear Outer Teeth */}
          <path
            d="M210 70 L218 85 L232 82 L236 98 L250 99 L250 115 L264 120 L259 135 L271 144 L262 158 L271 170 L262 182 L271 196 L259 205 L264 220 L250 225 L250 241 L236 242 L232 258 L218 255 L210 270 L202 255 L188 258 L184 242 L170 241 L170 225 L156 220 L161 205 L149 196 L158 182 L149 170 L158 158 L149 144 L161 135 L156 120 L170 115 L170 99 L184 98 L188 82 L202 85 Z"
            fill="#2563eb"
            stroke="#1d4ed8"
            strokeWidth="3"
            className="shadow-xl"
          />
          {/* Inner Recess */}
          <circle cx="210" cy="170" r="62" fill="#ffffff" stroke="#93c5fd" strokeWidth="4" className="dark:fill-slate-900 dark:stroke-slate-700" />
          <circle cx="210" cy="170" r="28" fill="#1e293b" />
          {/* Gear Spokes */}
          <line x1="210" y1="110" x2="210" y2="142" stroke="#93c5fd" strokeWidth="8" strokeLinecap="round" />
          <line x1="210" y1="198" x2="210" y2="230" stroke="#93c5fd" strokeWidth="8" strokeLinecap="round" />
          <line x1="150" y1="170" x2="182" y2="170" stroke="#93c5fd" strokeWidth="8" strokeLinecap="round" />
          <line x1="238" y1="170" x2="270" y2="170" stroke="#93c5fd" strokeWidth="8" strokeLinecap="round" />
        </motion.g>

        {/* ── MECHANICAL SPANNER / WRENCH ADJUSTING GEAR ── */}
        <motion.g
          animate={{ rotate: [-6, 6, -6], y: [0, -4, 0] }}
          transition={{ repeat: Infinity, duration: 3.5, ease: "easeInOut" }}
          style={{ originX: "260px", originY: "140px" }}
        >
          {/* Metallic Spanner Handle */}
          <g transform="translate(240, 100) rotate(42)">
            <rect x="0" y="0" width="140" height="24" rx="10" fill="#64748b" stroke="#334155" strokeWidth="2.5" className="shadow-lg" />
            <rect x="25" y="6" width="90" height="12" rx="6" fill="#475569" />
            {/* Open-jaw Wrench Head Right */}
            <path d="M-12 -6 C-28 6 -28 32 -12 44 L5 30 L5 6 Z" fill="#475569" stroke="#334155" strokeWidth="2.5" />
            {/* Ring Spanner Head Left */}
            <circle cx="145" cy="12" r="20" fill="#64748b" stroke="#334155" strokeWidth="2.5" />
            <circle cx="145" cy="12" r="10" fill="#ffffff" className="dark:fill-slate-900" />
          </g>
        </motion.g>

        {/* Floating Sparks */}
        <circle cx="280" cy="130" r="4" fill="#facc15" />
        <circle cx="295" cy="115" r="3" fill="#facc15" />
        <circle cx="270" cy="145" r="2.5" fill="#f59e0b" />
      </svg>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 9. USER MANAGEMENT: Binary Organization Hierarchy Tree
// Root: Clinic Owner (Crown) → Children: Doctor on Duty & Staff Nurse
// Visualizes Role-Based Access Control (RBAC) clearly
// ─────────────────────────────────────────────────────────────
export function UserHierarchyTreeIllustration({ className = "w-full max-w-lg h-auto" }: { className?: string }) {
  return (
    <svg viewBox="0 0 560 380" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      {/* Background Soft Aura */}
      <circle cx="280" cy="190" r="160" fill="#eff6ff" className="dark:fill-slate-800/25" />

      {/* ── ROOT NODE: CLINIC OWNER (Top Center) ── */}
      <g transform="translate(190, 20)">
        <rect x="0" y="0" width="180" height="90" rx="20" fill="#ffffff" stroke="#f59e0b" strokeWidth="2.5" className="dark:fill-slate-900 shadow-xl" />
        {/* Crown Badge */}
        <circle cx="90" cy="-6" r="16" fill="#f59e0b" stroke="#ffffff" strokeWidth="2" />
        {/* Crown Icon */}
        <path d="M83 -3 L86 -11 L90 -7 L94 -11 L97 -3 Z" fill="#ffffff" />
        
        {/* Node Content */}
        <text x="90" y="32" fill="#0f172a" fontSize="13" fontWeight="900" textAnchor="middle" className="dark:fill-white">Clinic Owner</text>
        <rect x="25" y="42" width="130" height="20" rx="10" fill="#fef3c7" className="dark:fill-amber-950/40" />
        <text x="90" y="56" fill="#d97706" fontSize="9" fontWeight="900" textAnchor="middle">SUPERVISORY & ADMIN</text>
        <text x="90" y="78" fill="#64748b" fontSize="8" fontWeight="700" textAnchor="middle">Full App & Presets Access</text>
      </g>

      {/* ── BINARY TREE CONNECTING BRANCHES ── */}
      <g stroke="#cbd5e1" strokeWidth="3" fill="none" strokeLinecap="round" className="dark:stroke-slate-700">
        {/* Vertical trunk from owner */}
        <line x1="280" y1="110" x2="280" y2="155" />
        {/* Horizontal split crossbar */}
        <line x1="140" y1="155" x2="420" y2="155" />
        {/* Left branch down to Doctor */}
        <line x1="140" y1="155" x2="140" y2="200" />
        {/* Right branch down to Staff */}
        <line x1="420" y1="155" x2="420" y2="200" />
      </g>

      {/* Tree Junction Branch Nodes */}
      <circle cx="280" cy="155" r="5" fill="#f59e0b" />
      <circle cx="140" cy="155" r="5" fill="#2563eb" />
      <circle cx="420" cy="155" r="5" fill="#10b981" />

      {/* ── CHILD NODE 1: DOCTOR ON DUTY (Bottom Left) ── */}
      <g transform="translate(50, 200)">
        <rect x="0" y="0" width="180" height="110" rx="18" fill="#ffffff" stroke="#93c5fd" strokeWidth="2" className="dark:fill-slate-900 shadow-lg" />
        {/* Stethoscope Badge */}
        <circle cx="90" cy="-6" r="14" fill="#2563eb" stroke="#ffffff" strokeWidth="2" />
        <path d="M85 -8 C85 -3 88 0 90 0 C92 0 95 -3 95 -8" stroke="#ffffff" strokeWidth="2" fill="none" />
        
        {/* Content */}
        <text x="90" y="28" fill="#0f172a" fontSize="13" fontWeight="900" textAnchor="middle" className="dark:fill-white">Doctor on Duty</text>
        <rect x="25" y="38" width="130" height="20" rx="10" fill="#eff6ff" className="dark:fill-blue-950/40" />
        <text x="90" y="52" fill="#2563eb" fontSize="9" fontWeight="900" textAnchor="middle">CLINICAL PRIVILEGES</text>
        
        {/* Role Permissions List */}
        <text x="25" y="78" fill="#64748b" fontSize="9" fontWeight="600">• Write & Sign Prescriptions</text>
        <text x="25" y="94" fill="#64748b" fontSize="9" fontWeight="600">• Review Vitals & Consult Pad</text>
      </g>

      {/* ── CHILD NODE 2: CLINIC STAFF / NURSE (Bottom Right) ── */}
      <g transform="translate(330, 200)">
        <rect x="0" y="0" width="180" height="110" rx="18" fill="#ffffff" stroke="#a7f3d0" strokeWidth="2" className="dark:fill-slate-900 shadow-lg" />
        {/* Clipboard Badge */}
        <circle cx="90" cy="-6" r="14" fill="#10b981" stroke="#ffffff" strokeWidth="2" />
        <rect x="85" y="-10" width="10" height="10" rx="2" fill="#ffffff" />

        {/* Content */}
        <text x="90" y="28" fill="#0f172a" fontSize="13" fontWeight="900" textAnchor="middle" className="dark:fill-white">Clinic Staff / Nurse</text>
        <rect x="25" y="38" width="130" height="20" rx="10" fill="#ecfdf5" className="dark:fill-emerald-950/40" />
        <text x="90" y="52" fill="#059669" fontSize="9" fontWeight="900" textAnchor="middle">OPERATIONAL INTAKE</text>

        {/* Role Permissions List */}
        <text x="25" y="78" fill="#64748b" fontSize="9" fontWeight="600">• Patient Entry & Tokens</text>
        <text x="25" y="94" fill="#64748b" fontSize="9" fontWeight="600">• Record Vitals & Print Queue</text>
      </g>
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────
// Compatibility exports
// ─────────────────────────────────────────────────────────────
export const EmptyQueueBoomIllustration = PatientDirectoryIllustration;
export const ClinicBuilderIllustration = SettingsSpannerGearIllustration;
export const ClinicCustomizerIllustration = SettingsSpannerGearIllustration;
export const WavingDoctorIllustration = SettingsSpannerGearIllustration;
export const TeamBrainstormIllustration = UserHierarchyTreeIllustration;
export const TeamCollaborationIllustration = UserHierarchyTreeIllustration;
export const CustomerSupportIllustration = DoctorProfileSetupIllustration;
export const DoctorIdentityIllustration = DoctorProfileSetupIllustration;
