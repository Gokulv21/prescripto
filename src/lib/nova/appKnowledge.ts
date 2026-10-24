/**
 * Prescripto Application Knowledge Base (Procedural & Semantic Memory)
 * Contains modules, routing, v1.4 release features, and clinical workflows.
 */

export interface AppModuleInfo {
  id: string;
  name: string;
  path: string;
  roles: string[];
  description: string;
  keywords: string[];
}

export const APP_MODULES: AppModuleInfo[] = [
  {
    id: 'dashboard',
    name: 'Dashboard',
    path: '/',
    roles: ['doctor', 'owner', 'superadmin'],
    description: 'Clinical command center with daily patient counts, live queue status, quick actions, and revenue metrics.',
    keywords: ['dashboard', 'home', 'main', 'summary', 'overview', 'today count']
  },
  {
    id: 'nurse',
    name: 'Patient Entry (Nurse/Reception)',
    path: '/nurse',
    roles: ['staff', 'nurse', 'doctor', 'owner', 'superadmin'],
    description: 'Register new patients, record baseline vitals (BP, Pulse, SpO2, Temp, CBG, Weight), and assign queue tokens.',
    keywords: ['patient entry', 'nurse entry', 'new patient', 'registration', 'token', 'queue', 'vitals']
  },
  {
    id: 'consultation',
    name: 'Doctor Consultation',
    path: '/consultation',
    roles: ['doctor', 'owner', 'superadmin'],
    description: 'Primary clinical workspace for doctors to examine patients, review past history, type or draw prescriptions, and order tests.',
    keywords: ['consultation', 'doctor consultation', 'prescription', 'rx', 'canvas', 'drawing mode', 'medicines', 'doctor desk']
  },
  {
    id: 'print',
    name: 'Print Queue',
    path: '/print',
    roles: ['staff', 'doctor', 'owner', 'superadmin', 'printer'],
    description: 'Centralized queue for pharmacy/reception to print prescriptions with one-click thermal or A4 formatting and status tracking.',
    keywords: ['print queue', 'print', 'reprint', 'printer', 'prescription print', 'pending print']
  },
  {
    id: 'patients',
    name: 'Patients Directory',
    path: '/patients',
    roles: ['doctor', 'staff', 'owner', 'superadmin'],
    description: 'Complete patient archive with search by name, phone, or registration ID. View past visit timelines and prescription records.',
    keywords: ['patients', 'patient list', 'search patient', 'history', 'patient records', 'archive']
  },
  {
    id: 'analytics',
    name: 'Analytics & Reports',
    path: '/analytics',
    roles: ['doctor', 'owner', 'superadmin'],
    description: 'Clinical and business intelligence reports including patient visit trends, peak hours, top diagnoses, and medicine statistics.',
    keywords: ['analytics', 'reports', 'charts', 'revenue', 'trends', 'statistics', 'metrics']
  },
  {
    id: 'display',
    name: 'TV Queue Display',
    path: '/display',
    roles: ['staff', 'doctor', 'owner', 'superadmin'],
    description: 'High-visibility waiting room display for TVs and tablets with live token calling, audio chime, and clinic branding.',
    keywords: ['tv display', 'waiting room', 'token display', 'screen', 'audio chime', 'bell sound']
  },
  {
    id: 'users',
    name: 'User Management',
    path: '/users',
    roles: ['owner', 'superadmin'],
    description: 'Manage clinic staff, doctors, assign roles (staff, doctor, printer), and perform secure password resets.',
    keywords: ['users', 'user management', 'staff management', 'roles', 'add doctor', 'reset password']
  },
  {
    id: 'profile',
    name: 'Doctor Profile & Clinic Settings',
    path: '/profile',
    roles: ['doctor', 'owner', 'superadmin'],
    description: 'Customize clinic branding, logo, letterhead headers, consultation fee, qualification, and signature.',
    keywords: ['profile', 'clinic settings', 'letterhead', 'logo', 'branding', 'signature', 'doctor profile']
  },
  {
    id: 'about',
    name: 'About & Changelog',
    path: '/about',
    roles: ['staff', 'doctor', 'owner', 'superadmin'],
    description: 'View Prescripto system version details, latest v1.4 changelog, and clinical safety information.',
    keywords: ['about', 'version', 'changelog', 'updates', 'v1.4', 'features']
  }
];

export const V14_FEATURES = [
  {
    title: 'VisionOS-Inspired Floating Glass Dock',
    description: 'Freely draggable bottom dock on mobile that saves its coordinates in localStorage. Double-tap the handle to reset to center.',
  },
  {
    title: 'Zero-Lag Micro Navigation',
    description: 'Instantaneous tab switching without layout stutter, with illuminated glowing indicator for the active module.',
  },
  {
    title: 'Ultra-Compact All Modules Launcher',
    description: 'Zero-scroll 4-column matrix sheet to access any clinic tool in one tap without scrolling.',
  },
  {
    title: 'Mobile Header Ergonomics',
    description: 'Doctor avatar & settings moved to the sticky top header, keeping the dock exclusively for high-frequency clinical actions.',
  },
  {
    title: 'TV Queue Display Default Audio Chime',
    description: 'Automatic Web Audio API token calling chime is now enabled by default with responsive multi-device layouts for widescreen TVs and tablets.',
  },
  {
    title: 'Superadmin & Clinic Branding Isolation',
    description: 'Strict clinic data isolation ensuring only clinic owners and doctors can modify their clinic identity and photos.',
  }
];

export const HOW_TO_GUIDES: Record<string, { title: string; steps: string[]; targetPath: string; actionLabel: string }> = {
  'print_prescription': {
    title: 'How to Print or Reprint a Prescription',
    steps: [
      'Open the "Print Queue" from the side menu or mobile launcher.',
      'Locate the patient in the queue list using name or token number.',
      'Click the "Print" button. Prescripto generates a formatted PDF with your clinic letterhead and digital signature.',
      'Once printed, the status will automatically update to "Printed".'
    ],
    targetPath: '/print',
    actionLabel: 'Open Print Queue'
  },
  'add_patient': {
    title: 'How to Register a New Patient',
    steps: [
      'Go to "Patient Entry" from the navigation dock or menu.',
      'Enter patient details (Title, Name, Age, Sex, Phone number).',
      'Optionally enter vitals (BP, Pulse, Weight, Temperature, SpO2, CBG).',
      'Click "Create Visit / Token". A queue token will be assigned and the patient will appear in the doctor consultation list.'
    ],
    targetPath: '/nurse',
    actionLabel: 'Go to Patient Entry'
  },
  'tv_chime': {
    title: 'How to Enable or Check TV Display Audio Chime',
    steps: [
      'Navigate to the "TV Display" page (/display).',
      'In v1.4, audio chime is enabled by default.',
      'Ensure your TV / tablet browser allows sound (click anywhere on the screen once to unlock browser Web Audio Context).',
      'Whenever the doctor marks a patient "Calling" or advances the queue, the chime rings.'
    ],
    targetPath: '/display',
    actionLabel: 'Open TV Display'
  },
  'consultation_workflow': {
    title: 'How to Conduct a Doctor Consultation',
    steps: [
      'Open "Consultation" from the main menu.',
      'Select a patient from today’s active queue on the left side.',
      'Review their registered vitals and past medical history.',
      'Add clinical notes, diagnosis, and select medicines from the prescription master.',
      'Click "Save & Send to Print Queue" to complete the visit.'
    ],
    targetPath: '/consultation',
    actionLabel: 'Go to Consultation'
  },
  'analytics_overview': {
    title: 'Analytics & Clinical Intelligence Guide',
    steps: [
      'Navigate to "Analytics" from the navigation menu (/analytics).',
      'Patient Volume Dynamics: Analyze daily, weekly, or monthly patient footfall with interactive charts and zoom.',
      'Peak Consultation Hours: Inspect clinic rush periods by hour (Morning, Afternoon, Evening, Night) to balance load.',
      'Diagnosis Trends & Seasonality: Filter prescriptions by diagnosis (e.g. Fever, Diabetes, Hypertension).',
      'Demographics: View patient distribution by gender and age brackets.',
      'Patient Retention: Monitor returning vs new patient rates over 30, 60, and 90 days.',
      'Protocol Analytics: Review medicine prescription adherence and frequency.'
    ],
    targetPath: '/analytics',
    actionLabel: 'Open Analytics Page'
  },
  'dashboard_overview': {
    title: 'Dashboard Clinical Command Center',
    steps: [
      'View real-time waiting room count, in-cabin active consultation, and completed visits for today.',
      'Inspect recent completed visits and quickly review or reprint past prescriptions.',
      'Click "New Patient" or "Add Visit" to register a patient or assign revisits directly.'
    ],
    targetPath: '/',
    actionLabel: 'Go to Dashboard'
  }
};

/**
 * Searches the procedural knowledge base for matching app questions.
 */
export function searchAppKnowledge(userQuery: string): {
  matchedModule?: AppModuleInfo;
  matchedGuide?: { title: string; steps: string[]; targetPath: string; actionLabel: string };
  isChangelogQuery: boolean;
  explanation: string;
} {
  const q = userQuery.toLowerCase().trim();

  const isChangelogQuery = q.includes('v1.4') || q.includes('new feature') || q.includes('what is new') || q.includes('update') || q.includes('pudhu feature');

  // Check how-to guides
  if (q.includes('analytic') || q.includes('chart') || q.includes('graph') || q.includes('peak hour') || q.includes('volume dynamics') || q.includes('demographic') || q.includes('retention') || q.includes('seasonality')) {
    return {
      matchedGuide: HOW_TO_GUIDES['analytics_overview'],
      isChangelogQuery,
      explanation: 'The Analytics module (/analytics) delivers clinical business intelligence, peak hour analysis, diagnosis trends, and volume dynamics.'
    };
  }

  if (q.includes('print') || q.includes('reprint')) {
    return {
      matchedGuide: HOW_TO_GUIDES['print_prescription'],
      isChangelogQuery,
      explanation: 'You can print and manage all pending prescriptions in the Print Queue module (/print).'
    };
  }

  if (q.includes('tv') || q.includes('sound') || q.includes('chime') || q.includes('bell') || q.includes('display')) {
    return {
      matchedGuide: HOW_TO_GUIDES['tv_chime'],
      isChangelogQuery,
      explanation: 'The TV Display module (/display) broadcasts live token calls with an audible chime for waiting patients.'
    };
  }

  if (q.includes('add patient') || q.includes('new patient') || q.includes('register') || q.includes('token') || q.includes('vitals')) {
    return {
      matchedGuide: HOW_TO_GUIDES['add_patient'],
      isChangelogQuery,
      explanation: 'New patients and triage vitals are registered in the Patient Entry module (/nurse).'
    };
  }

  if (q.includes('consult') || q.includes('prescribe') || q.includes('rx') || q.includes('drawing')) {
    return {
      matchedGuide: HOW_TO_GUIDES['consultation_workflow'],
      isChangelogQuery,
      explanation: 'Doctor Consultation (/consultation) is where doctors examine patients and generate digital prescriptions.'
    };
  }

  if (q.includes('dashboard') || q.includes('command center') || q.includes('queue status')) {
    return {
      matchedGuide: HOW_TO_GUIDES['dashboard_overview'],
      isChangelogQuery,
      explanation: 'The Dashboard is the command center displaying today\'s live queue flow, completion rate, and quick actions.'
    };
  }

  // Check module matching
  const matchedModule = APP_MODULES.find(m => 
    m.keywords.some(k => q.includes(k)) || m.name.toLowerCase().includes(q)
  );

  return {
    matchedModule,
    isChangelogQuery,
    explanation: matchedModule 
      ? `The "${matchedModule.name}" module is available at ${matchedModule.path}. ${matchedModule.description}`
      : 'Prescripto offers comprehensive clinic operations including Patient Entry, Consultation, Print Queue, TV Display, and Analytics.'
  };
}
