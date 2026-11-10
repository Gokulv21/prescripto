/**
 * Prescripto Application Knowledge Base (Procedural & Semantic Memory)
 * Contains modules, routing, v1.5 release features, and clinical workflows.
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
    description: 'View Prescripto system version details, latest v1.5 changelog, and clinical safety information.',
    keywords: ['about', 'version', 'changelog', 'updates', 'v1.5', 'features']
  }
];

export const V14_FEATURES = [
  {
    title: 'Nova Clinical AI Copilot',
    description: 'Built-in clinical & operational assistant across the platform for quick records lookup, guidance, and analytics.',
  },
  {
    title: 'Themes & Custom HEX Color Wheel Picker',
    description: 'Brand personalization engine with Light/Dark/System themes and custom accent color selection.',
  },
  {
    title: 'VisionOS-Inspired Floating Glass Dock',
    description: 'Freely draggable bottom dock on mobile that saves its coordinates in localStorage. Double-tap the handle to reset to center.',
  },
  {
    title: 'Zero-Lag Micro Navigation & All Modules Launcher',
    description: 'Instantaneous tab switching without layout stutter, plus a zero-scroll 4-column matrix launcher for all clinic tools.',
  },
  {
    title: 'TV Queue Display Default Audio Chime',
    description: 'Automatic Web Audio API token calling chime is enabled by default with responsive multi-device layouts for widescreen TVs and tablets.',
  },
  {
    title: 'Strict Multi-Clinic RBAC & Data Isolation',
    description: 'Complete clinic data, registration ID, snippet, and branding isolation ensuring each clinic operates independently and securely.',
  }
];

export interface HowToGuide {
  title: string;
  steps: string[];
  titleTa?: string;
  stepsTa?: string[];
  targetPath: string;
  actionLabel: string;
  actionLabelTa?: string;
}

export const HOW_TO_GUIDES: Record<string, HowToGuide> = {
  'forgot_password': {
    title: 'How to Reset a Forgotten Password (Staff / Doctor / Owner)',
    titleTa: 'கடவுச்சொல்லை (Password) மீட்டமைப்பது எப்படி?',
    steps: [
      'Clinic Owner Reset (Fastest): The registered Clinic Owner can open "Team Management" (/users). Locate the team member in the Active Team Members list, remove the account, and re-register them with a new temporary password.',
      'Self-Service Password Reset: On the PreScripto login screen, click "Forgot Password" and enter the registered email address to receive an official password reset link.',
      'Clinic Owner Password: If the Clinic Owner forgets their password, they can use the "Forgot Password" link on the login screen or contact system administration at contact.zevox@gmail.com.'
    ],
    stepsTa: [
      'கிளினிக் உரிமையாளர் மூலம் மாற்றுதல் (Owner Reset): கிளினிக் உரிமையாளர் "Team Management" (/users) பக்கத்திற்குச் சென்று, சம்பந்தப்பட்ட பணியாளரின் கணக்கை நீக்கிவிட்டு, புதிய ஆரம்ப கடவுச்சொல்லுடன் (Initial Password) உடனடியாக மீண்டும் பதிவு செய்யலாம்.',
      'சுய-மீட்டமைப்பு (Self-Service Reset): லாகின் திரையில் உள்ள "Forgot Password" விருப்பத்தை அழுத்தி, பதிவு செய்யப்பட்ட ஈமெயில் முகவரியை உள்ளிட்டு பாஸ்வேர்ட் மீட்டமைப்பு இணைப்பு பெறலாம்.',
      'கிளினிக் உரிமையாளர் பாஸ்வேர்ட்: உரிமையாளரே பாஸ்வேர்டை மறந்துவிட்டால் லாகின் திரையில் "Forgot Password" பயன்படுத்தலாம் அல்லது contact.zevox@gmail.com-ஐ தொடர்பு கொள்ளலாம்.'
    ],
    targetPath: '/users',
    actionLabel: 'Open Team Management',
    actionLabelTa: 'பணியாளர் மேலாண்மைக்கு செல்'
  },
  'user_management': {
    title: 'User Roles & Access Control Guide (RBAC)',
    titleTa: 'பயனர் பாத்திரங்கள் மற்றும் அனுமதிகள் வழிகாட்டி',
    steps: [
      'Clinic Owner: Full control over Clinic Information, Official Letterhead & Branding, Prescription Templates, Doctor & Staff Account Invitations.',
      'Doctor on Duty: Clinical consultation pad, digital & stylus prescriptions, patient vitals review, and personal digital signature.',
      'Clinic Staff / Nurse: Patient intake, token issuance, recording baseline vitals (BP, Pulse, Temp, SpO2, CBG), and print queue management.'
    ],
    stepsTa: [
      'கிளினிக் உரிமையாளர் (Owner): கிளினிக் தகவல், லெட்டர்ஹெட் பிராண்டிங், மருந்துச் சீட்டு டெம்ப்ளேட்கள் மற்றும் பணியாளர் கணக்குகளை நிர்வகிக்கும் முழு அதிகாரம்.',
      'டாக்டர் (Doctor): ஆலோசனை மேஜை, கைப்பட வரையும் மருந்துச் சீட்டு, நோயாளி பழைய வரலாறு மற்றும் டிஜிட்டல் கையொப்பம்.',
      'பணியாளர் / நர்ஸ் (Staff): நோயாளி பதிவு, டோக்கன் வழங்குதல், வைட்டல்ஸ் அளவுகள் (BP, பல்ஸ், சுகர்) பதிவு செய்தல் மற்றும் பிரிண்ட் எடுத்தல்.'
    ],
    targetPath: '/users',
    actionLabel: 'Open Team Management',
    actionLabelTa: 'பணியாளர் மேலாண்மைக்கு செல்'
  },
  'theme_appearance': {
    title: 'How to Customize Themes, Colors & Dark Mode',
    titleTa: 'தீம்கள், வண்ணங்கள் மற்றும் தோற்றத்தை மாற்றுவது எப்படி?',
    steps: [
      'Go to "Prescription & Clinic Settings" (/settings) and click the "Themes & Appearance" tab.',
      'Per-Device Preference: Every device (mobile, reception desktop, doctor tablet) can independently choose its own light/dark mode and color accent.',
      'Color Palette & Custom Picker: Select from modern clinical colors (Cobalt Blue, Emerald, Royal Violet, Rose, Amber) or use the custom color picker to match any clinical branding hex code.'
    ],
    stepsTa: [
      'கிளினிக் அமைப்புகளில் ("Settings" /settings) உள்ள "Themes & Appearance" டேப்பைத் திறக்கவும்.',
      'தனித்தனி சாதனம்: ஒவ்வொரு மொபைல் அல்லது கம்ப்யூட்டரிலும் அவரவர் விருப்பப்படி லைட்/டார்க் மோட் மற்றும் வண்ணங்களை தனித்தனியாக மாற்றிக்கொள்ளலாம்.',
      'கலர் பிக்கர்: நீலம், பச்சை, ஊதா போன்ற நிறங்களைத் தேர்ந்தெடுக்கலாம் அல்லது உங்கள் கிளினிக் பிராண்டிங்கிற்கு ஏற்ற எந்த நிறத்தையும் கலர் பிக்கர் மூலம் அமைக்கலாம்.'
    ],
    targetPath: '/settings',
    actionLabel: 'Open Themes & Appearance',
    actionLabelTa: 'தீம்கள் அமைப்பை திறக்க'
  },
  'clinic_settings': {
    title: 'How to Update Clinic Info, Address & Official Letterhead',
    titleTa: 'கிளினிக் பெயர், முகவரி மற்றும் லெட்டர்ஹெட் மாற்றுவது எப்படி?',
    steps: [
      'Navigate to "Clinic Settings" (/settings) as the Clinic Owner.',
      'Clinic Information: Update clinic name, address, emergency phone, and specialty caption.',
      'Clinic Branding: Upload official clinic logo, background watermark, prescription header, and footer.',
      'Doctor Profile: Update medical degrees (MBBS, MD), registration ID, and digital signature from Doctor Profile (/profile).'
    ],
    stepsTa: [
      'கிளினிக் உரிமையாளர் கணக்கில் "Clinic Settings" (/settings) பக்கத்திற்குச் செல்லவும்.',
      'கிளினிக் தகவல்: கிளினிக் பெயர், முகவரி, தொடர்பு எண் மற்றும் சிறப்பு சேவைகளை மாற்றலாம்.',
      'பிராண்டிங்: அதிகாரப்பூர்வ லோகோ, வாட்டர்மார்க், லெட்டர்ஹெட் தலைப்பு மற்றும் அடிக்குறிப்பை பதிவேற்றலாம்.'
    ],
    targetPath: '/settings',
    actionLabel: 'Open Clinic Settings',
    actionLabelTa: 'கிளினிக் அமைப்புகளை திறக்க'
  },
  'vitals_triage': {
    title: 'Clinical Vitals Normal Reference Ranges & Triage',
    titleTa: 'நோயாளி வைட்டல்ஸ் (Vitals) இயல்பு நிலைகள் வழிகாட்டி',
    steps: [
      'Blood Pressure (BP): Normal is ~120/80 mmHg. Elevated: 120-129/<80. Stage 1 HTN: 130-139/80-89. Stage 2 HTN: >= 140/90. Crisis: >= 180/120 mmHg.',
      'Oxygen Saturation (SpO2): Normal: >= 95%. Hypoxemia alert: < 92% requires prompt clinical attention and oxygen.',
      'Pulse Rate: Normal adult resting: 60 - 100 bpm. Bradycardia: < 60 bpm. Tachycardia: > 100 bpm.',
      'Body Temperature: Normal: 98.6°F (37.0°C). Low fever: 99.5°F - 100.4°F. Significant fever: > 101°F.',
      'Blood Glucose (CBG): Normal fasting: 70 - 99 mg/dL. Random normal: < 140 mg/dL. Hypoglycemia warning: < 70 mg/dL.'
    ],
    stepsTa: [
      'இரத்த அழுத்தம் (BP): இயல்பானது ~120/80 mmHg. உயர் இரத்த அழுத்தம்: >= 140/90 mmHg.',
      'ஆக்ஸிஜன் அளவு (SpO2): இயல்பானது >= 95%. 92%-க்கு கீழ் குறைந்தால் உடனடி கவனம் தேவை.',
      'நாடித்துடிப்பு (Pulse): இயல்பானது நிமிடத்திற்கு 60 - 100 துடிப்புகள்.',
      'உடல் வெப்பநிலை (Temp): இயல்பானது 98.6°F (37.0°C). காய்ச்சல்: >= 100.4°F.',
      'இரத்த சர்க்கரை (Sugar/CBG): இயல்பானது < 140 mg/dL. 70 mg/dL-க்கு கீழ் குறைந்தால் சர்க்கரை குறைவு (Hypoglycemia).'
    ],
    targetPath: '/nurse',
    actionLabel: 'Go to Patient Entry',
    actionLabelTa: 'நோயாளி பதிவுக்கு செல்'
  },
  'print_prescription': {
    title: 'How to Print or Reprint a Prescription',
    titleTa: 'மருந்துச் சீட்டை பிரிண்ட் எடுப்பது எப்படி?',
    steps: [
      'Open the "Print Queue" from the side menu or mobile launcher.',
      'Locate the patient in the queue list using name or token number.',
      'Click the "Print" button. Prescripto generates a formatted PDF with your clinic letterhead and digital signature.',
      'Once printed, the status will automatically update to "Printed".'
    ],
    stepsTa: [
      '"Print Queue" (/print) பக்கத்தைத் திறக்கவும்.',
      'டோக்கன் எண் அல்லது பெயர் மூலம் நோயாளியைக் கண்டறியவும்.',
      '"Print" பொத்தானை அழுத்தினால் கிளினிக் லெட்டர்ஹெட்டுடன் கூடிய PDF தயாராகும்.',
      'பிரிண்ட் எடுத்ததும் நிலை தானாக "Printed" என மாறும்.'
    ],
    targetPath: '/print',
    actionLabel: 'Open Print Queue',
    actionLabelTa: 'பிரிண்ட் வரிசைக்கு செல்'
  },
  'add_patient': {
    title: 'How to Register a New Patient',
    titleTa: 'புதிய நோயாளியை பதிவு செய்வது எப்படி?',
    steps: [
      'Go to "Patient Entry" from the navigation dock or menu.',
      'Enter patient details (Title, Name, Age, Sex, Phone number).',
      'Optionally enter vitals (BP, Pulse, Weight, Temperature, SpO2, CBG).',
      'Click "Create Visit / Token". A queue token will be assigned and the patient will appear in the doctor consultation list.'
    ],
    stepsTa: [
      '"Patient Entry" (/nurse) பக்கத்திற்குச் செல்லவும்.',
      'நோயாளியின் பெயர், வயது, பாலினம், தொலைபேசி எண்ணை உள்ளிடவும்.',
      'அவசியமானால் வைட்டல்ஸ் அளவுகளை (BP, Pulse, Temp) பதிவு செய்யவும்.',
      '"Create Visit / Token" அழுத்தினால் டோக்கன் எண் ஒதுக்கப்பட்டு டாக்டர் ஆலோசனைப் பட்டியலில் சேரும்.'
    ],
    targetPath: '/nurse',
    actionLabel: 'Go to Patient Entry',
    actionLabelTa: 'நோயாளி பதிவுக்கு செல்'
  },
  'tv_chime': {
    title: 'How to Enable or Check TV Display Audio Chime',
    titleTa: 'டிவி டிஸ்ப்ளே டோக்கன் அழைப்பு மற்றும் ஆடியோ மணி வழிகாட்டி',
    steps: [
      'Navigate to the "TV Display" page (/display).',
      'Audio chime is enabled by default in Prescripto.',
      'Ensure your TV / tablet browser allows sound (click anywhere on the screen once to unlock browser Web Audio Context).',
      'Whenever the doctor marks a patient "Calling" or advances the queue, the chime rings.'
    ],
    stepsTa: [
      '"TV Display" (/display) பக்கத்தைத் திறக்கவும்.',
      'ஆடியோ மணி ஒலி தானாகவே இயக்கத்தில் இருக்கும்.',
      'டிவி அல்லது டேப்லெட் திரையில் ஒருமுறை தொட்டு/கிளிக் செய்து ஆடியோவை அன்லாக் செய்யவும்.',
      'டாக்டர் நோயாளியை அழைக்கும் போது இயல்பாகவே மணி ஒலிக்கும்.'
    ],
    targetPath: '/display',
    actionLabel: 'Open TV Display',
    actionLabelTa: 'டிவி காட்சியை திறக்க'
  },
  'consultation_workflow': {
    title: 'How to Conduct a Doctor Consultation',
    titleTa: 'டாக்டர் ஆலோசனை மேஜை மற்றும் பிரஸ்கிரிப்ஷன் வழிகாட்டி',
    steps: [
      'Open "Consultation" from the main menu.',
      'Select a patient from today’s active queue on the left side.',
      'Review their registered vitals and past medical history.',
      'Add clinical notes, diagnosis, and select medicines from the prescription master or use stylus drawing mode.',
      'Click "Save & Send to Print Queue" to complete the visit.'
    ],
    stepsTa: [
      '"Consultation" (/consultation) பக்கத்தைத் திறக்கவும்.',
      'இன்றைய காத்திருப்பு வரிசையிலிருந்து நோயாளியைத் தேர்ந்தெடுக்கவும்.',
      'அவர்களின் வைட்டல்ஸ் மற்றும் முந்தைய மருத்துவ வரலாற்றை சரிபார்க்கவும்.',
      'மருந்துகளைத் தேர்வு செய்து அல்லது ஸ்டைலஸ் மூலம் வரைந்து "Save & Send to Print Queue" அழுத்தவும்.'
    ],
    targetPath: '/consultation',
    actionLabel: 'Go to Consultation',
    actionLabelTa: 'ஆலோசனைக்கு செல்'
  },
  'analytics_overview': {
    title: 'Analytics & Clinical Intelligence Guide',
    titleTa: 'அனலிட்டிக்ஸ் மற்றும் கிளினிக் புள்ளிவிவரங்கள் வழிகாட்டி',
    steps: [
      'Navigate to "Analytics" from the navigation menu (/analytics).',
      'Patient Volume Dynamics: Analyze daily, weekly, or monthly patient footfall with interactive charts and zoom.',
      'Peak Consultation Hours: Inspect clinic rush periods by hour (Morning, Afternoon, Evening, Night) to balance load.',
      'Diagnosis Trends & Seasonality: Filter prescriptions by diagnosis (e.g. Fever, Diabetes, Hypertension).',
      'Demographics: View patient distribution by gender and age brackets.',
      'Patient Retention: Monitor returning vs new patient rates over 30, 60, and 90 days.'
    ],
    stepsTa: [
      '"Analytics" (/analytics) பக்கத்தைத் திறக்கவும்.',
      'நோயாளி வருகை வரைபடம் (Volume Dynamics): தினசரி, வாராந்திர, மாதாந்திர நோயாளி வருகையை அறியலாம்.',
      'அதிக തിരக்குள்ள நேரங்கள் (Peak Hours): காலை, மதியம், மாலை எந்த நேரத்தில் கூட்டம் அதிகம் என அறியலாம்.',
      'நோயறிதல் போக்குகள் (Diagnosis Trends): காய்ச்சல், நீரிழிவு, இரத்த அழுத்தம் போன்ற நோய்களின் நிலவரத்தை அறியலாம்.'
    ],
    targetPath: '/analytics',
    actionLabel: 'Open Analytics Page',
    actionLabelTa: 'அனலிட்டிக்ஸ் திறக்க'
  },
  'dashboard_overview': {
    title: 'Dashboard Clinical Command Center',
    titleTa: 'டாஷ்போர்டு கிளினிக் கமாண்ட் சென்டர் வழிகாட்டி',
    steps: [
      'View real-time waiting room count, in-cabin active consultation, and completed visits for today.',
      'Inspect recent completed visits and quickly review or reprint past prescriptions.',
      'Click "New Patient" or "Add Visit" to register a patient or assign revisits directly.'
    ],
    stepsTa: [
      'இன்றைய காத்திருப்போர், ஆலோசனையில் உள்ளோர் மற்றும் முடிக்கப்பட்ட வருகைகளை நிகழ்நேரத்தில் அறியலாம்.',
      'சமீபத்திய வருகைகள் மற்றும் முந்தைய மருந்துச் சீட்டுகளை உடனே பார்க்கலாம்.',
      '"New Patient" அழுத்தி புதிய நோயாளியை விரைவாக பதிவு செய்யலாம்.'
    ],
    targetPath: '/',
    actionLabel: 'Go to Dashboard',
    actionLabelTa: 'டாஷ்போர்டுக்கு செல்'
  }
};

/**
 * Searches the procedural knowledge base for matching app questions.
 */
export function searchAppKnowledge(userQuery: string): {
  matchedModule?: AppModuleInfo;
  matchedGuide?: HowToGuide;
  isChangelogQuery: boolean;
  explanation: string;
} {
  const q = userQuery.toLowerCase().trim();

  const isChangelogQuery = q.includes('v1.4') || q.includes('v1.5') || q.includes('new feature') || q.includes('what is new') || q.includes('update') || q.includes('pudhu feature');

  // 1. Password reset & forgot password queries
  if (
    q.includes('password') || 
    q.includes('forgot') || 
    q.includes('reset') || 
    q.includes('marandhu') || 
    q.includes('maranthu') || 
    q.includes('login') || 
    q.includes('sign in') || 
    q.includes('credential') ||
    q.includes('passcode')
  ) {
    return {
      matchedGuide: HOW_TO_GUIDES['forgot_password'],
      isChangelogQuery,
      explanation: 'To reset a staff password, the Clinic Owner can remove and re-register the user in Team Management (/users), or the staff member can use the "Forgot Password" link on the login screen.'
    };
  }

  // 2. User management & access control queries
  if (
    q.includes('staff') || 
    q.includes('doctor') || 
    q.includes('role') || 
    q.includes('privilege') || 
    q.includes('rbac') || 
    q.includes('permission') || 
    q.includes('owner') || 
    q.includes('user mgmt') ||
    q.includes('add user') ||
    q.includes('add staff')
  ) {
    return {
      matchedGuide: HOW_TO_GUIDES['user_management'],
      isChangelogQuery,
      explanation: 'Clinic user accounts and role permissions (Owner, Doctor, Staff) are configured under Team Management (/users).'
    };
  }

  // 3. Themes & appearance queries
  if (
    q.includes('theme') || 
    q.includes('appearance') || 
    q.includes('color') || 
    q.includes('colour') || 
    q.includes('dark mode') || 
    q.includes('light mode') || 
    q.includes('vannam') || 
    q.includes('niram') || 
    q.includes('accent')
  ) {
    return {
      matchedGuide: HOW_TO_GUIDES['theme_appearance'],
      isChangelogQuery,
      explanation: 'App themes, dark/light mode, and custom color accents can be configured per-device in Settings -> Themes & Appearance (/settings).'
    };
  }

  // 4. Clinical Vitals & Triage Queries
  if (
    q.includes('vital') || 
    q.includes('bp') || 
    q.includes('blood pressure') || 
    q.includes('pulse') || 
    q.includes('spo2') || 
    q.includes('oxygen') || 
    q.includes('sugar') || 
    q.includes('cbg') || 
    q.includes('glucose') || 
    q.includes('temp') || 
    q.includes('fever') || 
    q.includes('kaichal')
  ) {
    return {
      matchedGuide: HOW_TO_GUIDES['vitals_triage'],
      isChangelogQuery,
      explanation: 'Patient baseline vitals (BP, Pulse, SpO2, Temperature, CBG) are registered in Patient Entry (/nurse) and reviewed during doctor consultation.'
    };
  }

  // 5. Clinic Settings & Branding Queries
  if (
    q.includes('branding') || 
    q.includes('logo') || 
    q.includes('letterhead') || 
    q.includes('watermark') || 
    q.includes('clinic name') || 
    q.includes('address') || 
    q.includes('qualification') || 
    q.includes('signature') || 
    q.includes('kaiyoppam')
  ) {
    return {
      matchedGuide: HOW_TO_GUIDES['clinic_settings'],
      isChangelogQuery,
      explanation: 'Clinic letterhead, address, emergency phone, and logos can be customized in Clinic Settings (/settings).'
    };
  }

  // 6. Analytics queries
  if (
    q.includes('analytic') || 
    q.includes('chart') || 
    q.includes('graph') || 
    q.includes('peak hour') || 
    q.includes('volume dynamics') || 
    q.includes('demographic') || 
    q.includes('retention') || 
    q.includes('seasonality')
  ) {
    return {
      matchedGuide: HOW_TO_GUIDES['analytics_overview'],
      isChangelogQuery,
      explanation: 'The Analytics module (/analytics) delivers clinical business intelligence, peak hour analysis, diagnosis trends, and volume dynamics.'
    };
  }

  // 7. Print queue queries
  if (q.includes('print') || q.includes('reprint')) {
    return {
      matchedGuide: HOW_TO_GUIDES['print_prescription'],
      isChangelogQuery,
      explanation: 'You can print and manage all pending prescriptions in the Print Queue module (/print).'
    };
  }

  // 8. TV Display & Chime
  if (q.includes('tv') || q.includes('sound') || q.includes('chime') || q.includes('bell') || q.includes('display')) {
    return {
      matchedGuide: HOW_TO_GUIDES['tv_chime'],
      isChangelogQuery,
      explanation: 'The TV Display module (/display) broadcasts live token calls with an audible chime for waiting patients.'
    };
  }

  // 9. Patient Entry
  if (q.includes('add patient') || q.includes('new patient') || q.includes('register') || q.includes('token') || q.includes('intake')) {
    return {
      matchedGuide: HOW_TO_GUIDES['add_patient'],
      isChangelogQuery,
      explanation: 'New patients and triage vitals are registered in the Patient Entry module (/nurse).'
    };
  }

  // 10. Consultation
  if (q.includes('consult') || q.includes('prescribe') || q.includes('rx') || q.includes('drawing') || q.includes('stylus')) {
    return {
      matchedGuide: HOW_TO_GUIDES['consultation_workflow'],
      isChangelogQuery,
      explanation: 'Doctor Consultation (/consultation) is where doctors examine patients and generate digital prescriptions.'
    };
  }

  // 11. Dashboard
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
