/**
 * Indian Medical Practitioner Registration ID Validation & Verification
 * Checks formats conforming to NMC (National Medical Commission) & State Medical Councils (TNMC, KMC, MMC, etc.)
 */

export interface VerificationResult {
  valid: boolean;
  council?: string;
  formattedId: string;
  error?: string;
}

// Known State Councils pattern dictionary
const STATE_COUNCIL_PATTERNS: { name: string; pattern: RegExp }[] = [
  { name: 'Tamil Nadu Medical Council (TNMC)', pattern: /^TN\/?\d{4,8}$/i },
  { name: 'Karnataka Medical Council (KMC)', pattern: /^KMC\/?\d{4,8}$/i },
  { name: 'Maharashtra Medical Council (MMC)', pattern: /^MMC\/?\d{4,8}$/i },
  { name: 'Delhi Medical Council (DMC)', pattern: /^DMC\/?\d{4,8}$/i },
  { name: 'National Medical Commission (MCI / NMC)', pattern: /^(MCI|NMC)\/?\d{4,8}$/i },
  { name: 'Andhra Pradesh Medical Council (APMC)', pattern: /^AP\/?\d{4,8}$/i },
  { name: 'Telangana State Medical Council (TSMC)', pattern: /^TS\/?\d{4,8}$/i },
  { name: 'Kerala Medical Council (TCMC)', pattern: /^TC\/?\d{4,8}$/i },
];

export async function verifyIndianDoctorRegId(rawId: string): Promise<VerificationResult> {
  const cleanId = rawId.trim().toUpperCase().replace(/\s+/g, '');

  if (!cleanId) {
    return { valid: false, formattedId: '', error: 'Medical Registration ID cannot be empty.' };
  }

  // 1. Length check (Indian Medical council IDs are between 4 and 16 characters)
  if (cleanId.length < 4 || cleanId.length > 16) {
    return {
      valid: false,
      formattedId: cleanId,
      error: 'Invalid length. Indian State Medical Council / NMC IDs are typically 4 to 12 digits.'
    };
  }

  // 2. Check pure numeric registration number (very common, e.g. "152590" in State councils)
  const isPureNumeric = /^\d{4,8}$/.test(cleanId);
  if (isPureNumeric) {
    // Verified local numeric state registration
    return {
      valid: true,
      council: 'State Medical Council (Verified Format)',
      formattedId: cleanId
    };
  }

  // 3. Check State prefix formats (e.g. TN/152590, KMC-45892, MCI-12345)
  for (const council of STATE_COUNCIL_PATTERNS) {
    if (council.pattern.test(cleanId)) {
      return {
        valid: true,
        council: council.name,
        formattedId: cleanId
      };
    }
  }

  // 4. General Alphanumeric format check (StateCode + Digits or standard ID)
  const isGeneralValidAlphanumeric = /^[A-Z0-9\/-]{4,14}$/.test(cleanId) && /\d/.test(cleanId);
  if (isGeneralValidAlphanumeric) {
    return {
      valid: true,
      council: 'Recognized Medical Council Format',
      formattedId: cleanId
    };
  }

  return {
    valid: false,
    formattedId: cleanId,
    error: 'Unrecognized Registration ID format. Please provide your legitimate State Medical Council or NMC Registration Number (e.g., 152590, TN/152590, or MCI-45892).'
  };
}

