/**
 * Medical Safety Advisory System (Pediatric & Age-Based Contraindications)
 * Zero external dependencies, fast in-memory validation rules.
 */

export interface SafetyWarning {
  type: 'pediatric' | 'geriatric' | 'dosage' | 'caution';
  severity: 'warning' | 'critical' | 'info';
  medicineName: string;
  title: string;
  message: string;
  recommendation?: string;
}

interface SafetyRule {
  pattern: RegExp;
  minAge?: number;
  maxAge?: number;
  type: 'pediatric' | 'geriatric' | 'dosage' | 'caution';
  severity: 'warning' | 'critical' | 'info';
  title: string;
  message: string;
  recommendation?: string;
}

const SAFETY_RULES: SafetyRule[] = [
  // Aspirin / Salicylates in children
  {
    pattern: /\b(aspirin|ecosprin|disprin|salicylate)\b/i,
    maxAge: 12,
    type: 'pediatric',
    severity: 'critical',
    title: 'Reye Syndrome Risk',
    message: 'Aspirin is contraindicated in children under 12 years due to high risk of Reye\'s Syndrome.',
    recommendation: 'Use Paracetamol or Ibuprofen instead for analgesia/fever.'
  },
  // Fluoroquinolones in children
  {
    pattern: /\b(ciprofloxacin|cipro|levofloxacin|ofloxacin|norfloxacin)\b/i,
    maxAge: 16,
    type: 'pediatric',
    severity: 'warning',
    title: 'Pediatric Cartilage/Joint Caution',
    message: 'Fluoroquinolones may cause cartilage toxicity and arthropathy in growing children.',
    recommendation: 'Consider Amoxicillin-Clavulanate, Azithromycin, or Cephalosporins.'
  },
  // Tetracyclines in young children (< 8 years)
  {
    pattern: /\b(doxycycline|tetracycline|minocycline)\b/i,
    maxAge: 8,
    type: 'pediatric',
    severity: 'critical',
    title: 'Tooth Discoloration & Bone Growth Caution',
    message: 'Tetracyclines can cause permanent teeth discoloration and enamel hypoplasia in children under 8.',
    recommendation: 'Use Macrolides or Beta-lactams as safe alternatives.'
  },
  // Form factor guidance for infants and toddlers
  {
    pattern: /\b(tab|tablet|capsule|cap)\b/i,
    maxAge: 4,
    type: 'dosage',
    severity: 'info',
    title: 'Choking Hazard / Form Factor Guidance',
    message: 'Solid tablets/capsules present a choking hazard for toddlers and infants under 4 years.',
    recommendation: 'Prescribe in Syrup (Syp.), Drops, or Suspension form.'
  },
  // High-dose NSAIDs in Geriatric (> 65 years)
  {
    pattern: /\b(diclofenac|aceclofenac|piroxicam|indomethacin|ketorolac)\b/i,
    minAge: 65,
    type: 'geriatric',
    severity: 'warning',
    title: 'GI Bleed & Renal Risk in Geriatric Patients',
    message: 'Strong NSAIDs carry elevated risk of GI ulceration and acute kidney injury in elderly patients (65+).',
    recommendation: 'Co-prescribe a PPI (Pantoprazole) and monitor renal function.'
  },
  // Sedative / Benzodiazepine fall risk in elderly
  {
    pattern: /\b(alprazolam|clonazepam|diazepam|lorazepam|zolpidem)\b/i,
    minAge: 65,
    type: 'geriatric',
    severity: 'warning',
    title: 'Fall & Cognitive Impairment Risk',
    message: 'Sedatives & Benzodiazepines increase fall risk, ataxia, and confusion in elderly patients.',
    recommendation: 'Use lowest effective dose for minimal duration.'
  }
];

/**
 * Checks a medicine name and its form against patient age and returns safety warnings if any.
 */
export function evaluateMedicineSafety(
  medicineName: string,
  medicineType?: string,
  patientAge?: number | null
): SafetyWarning[] {
  if (patientAge === undefined || patientAge === null || isNaN(patientAge) || !medicineName) {
    return [];
  }

  const warnings: SafetyWarning[] = [];
  const fullText = `${medicineType || ''} ${medicineName}`.trim();

  for (const rule of SAFETY_RULES) {
    // Check age limits
    if (rule.maxAge !== undefined && patientAge > rule.maxAge) continue;
    if (rule.minAge !== undefined && patientAge < rule.minAge) continue;

    // Check pattern match
    if (rule.pattern.test(fullText)) {
      warnings.push({
        type: rule.type,
        severity: rule.severity,
        medicineName,
        title: rule.title,
        message: rule.message,
        recommendation: rule.recommendation
      });
    }
  }

  return warnings;
}
