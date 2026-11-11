import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function calculateDobFromAge(
  age: number | string,
  ageUnit: 'years' | 'months' | 'days' = 'years',
  referenceDate: string | Date = new Date()
): string {
  const ref = new Date(referenceDate);
  const numAge = typeof age === 'string' ? parseFloat(age) : age;
  if (isNaN(numAge) || numAge < 0) {
    return ref.toISOString().split('T')[0];
  }

  const dob = new Date(ref.getTime());
  if (ageUnit === 'years') {
    const wholeYears = Math.floor(numAge);
    const fraction = numAge - wholeYears;
    dob.setFullYear(dob.getFullYear() - wholeYears);
    if (fraction > 0) {
      dob.setDate(dob.getDate() - Math.round(fraction * 365.25));
    }
  } else if (ageUnit === 'months') {
    dob.setMonth(dob.getMonth() - Math.round(numAge));
  } else if (ageUnit === 'days') {
    dob.setDate(dob.getDate() - Math.round(numAge));
  }

  return dob.toISOString().split('T')[0];
}

export function calculateAgeFromDob(
  dob: string | Date,
  referenceDate: string | Date = new Date()
): number {
  const birthDate = new Date(dob);
  const targetDate = new Date(referenceDate);
  if (isNaN(birthDate.getTime()) || isNaN(targetDate.getTime())) return 0;

  let years = targetDate.getFullYear() - birthDate.getFullYear();
  const monthDiff = targetDate.getMonth() - birthDate.getMonth();
  const dayDiff = targetDate.getDate() - birthDate.getDate();

  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    years--;
  }

  // For infants under 1 year: calculate exact fractional years
  if (years < 1) {
    const diffMs = targetDate.getTime() - birthDate.getTime();
    const diffDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
    return diffDays / 365.25;
  }

  return Math.max(0, years);
}

export function getPatientDetailedAge(
  patient: any,
  referenceDate: string | Date = new Date()
): { years: number; months: number; days: number } | null {
  if (patient === null || patient === undefined) return null;

  const targetDate = new Date(referenceDate);

  let birthDate: Date | null = null;

  if (typeof patient === 'object') {
    if (patient.dob) {
      birthDate = new Date(patient.dob);
    } else if (patient.created_at && patient.age !== null && patient.age !== undefined && patient.age !== '') {
      // Auto derive birth date from created_at and initial age
      const numAge = typeof patient.age === 'string' ? parseFloat(patient.age) : patient.age;
      if (!isNaN(numAge)) {
        if (numAge < 1) {
          const daysFromAge = Math.round(numAge * 365.25);
          if (daysFromAge < 32) {
            birthDate = new Date(calculateDobFromAge(daysFromAge, 'days', patient.created_at));
          } else {
            const monthsFromAge = Math.round(numAge * 12);
            birthDate = new Date(calculateDobFromAge(monthsFromAge, 'months', patient.created_at));
          }
        } else {
          birthDate = new Date(calculateDobFromAge(numAge, 'years', patient.created_at));
        }
      }
    }
  } else if (typeof patient === 'string' && /^\d{4}-\d{2}-\d{2}/.test(patient)) {
    birthDate = new Date(patient);
  } else if (typeof patient === 'number' || (typeof patient === 'string' && !isNaN(parseFloat(patient)))) {
    const num = typeof patient === 'string' ? parseFloat(patient) : patient;
    const y = Math.floor(num);
    const remMonths = Math.round((num - y) * 12);
    return { years: y, months: remMonths, days: 0 };
  }

  if (!birthDate || isNaN(birthDate.getTime()) || isNaN(targetDate.getTime())) {
    const fallbackAge = typeof patient === 'object' ? patient?.age : patient;
    if (fallbackAge !== null && fallbackAge !== undefined && fallbackAge !== '' && !isNaN(parseFloat(fallbackAge))) {
      const num = parseFloat(fallbackAge);
      const y = Math.floor(num);
      const remMonths = Math.round((num - y) * 12);
      return { years: y, months: remMonths, days: 0 };
    }
    return null;
  }

  let years = targetDate.getFullYear() - birthDate.getFullYear();
  let months = targetDate.getMonth() - birthDate.getMonth();
  let days = targetDate.getDate() - birthDate.getDate();

  if (days < 0) {
    // Borrow days from previous month
    months--;
    const prevMonthLastDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), 0).getDate();
    days += prevMonthLastDay;
  }

  if (months < 0) {
    years--;
    months += 12;
  }

  if (years < 0) {
    return { years: 0, months: 0, days: 0 };
  }

  return { years, months, days };
}

export function getPatientCurrentAge(
  patient: any,
  referenceDate: string | Date = new Date()
): number | null {
  if (patient === null || patient === undefined) return null;

  const detailed = getPatientDetailedAge(patient, referenceDate);
  if (!detailed) return null;

  // Return fractional years for accurate comparisons and dosage logic
  return detailed.years + (detailed.months / 12) + (detailed.days / 365.25);
}

export function formatAge(
  input: any,
  referenceDate: string | Date = new Date()
): string {
  if (input === null || input === undefined || input === '') return '—';

  const detailed = getPatientDetailedAge(input, referenceDate);
  if (!detailed) return '—';

  const { years, months, days } = detailed;

  // 1. If 1 year or older
  if (years >= 1) {
    if (months > 0) {
      return `${years}y ${months}m`;
    }
    return `${years}y`;
  }

  // 2. Under 1 year (infants / babies)
  if (months >= 1) {
    if (days > 0) {
      return `${months}m ${days}d`;
    }
    return `${months}m`;
  }

  // 3. Under 1 month (newborns)
  return `${days}d`;
}

/**
 * Formats age specifically for Prescriptions (Rx) where adults display
 * clean whole integer years (e.g. "42y" or "42") and infants display months/days.
 * As soon as age crosses 30/31 days (1 month), it formats as "1m", "2m", etc.
 */
export function formatPrescriptionAge(
  input: any,
  referenceDate: string | Date = new Date()
): string {
  if (input === null || input === undefined || input === '') return '—';

  const detailed = getPatientDetailedAge(input, referenceDate);
  if (!detailed) return '—';

  const { years, months, days } = detailed;

  // 1. If 1 year or older: show whole number of years (e.g. "42y" or "10y")
  if (years >= 1) {
    return `${years}y`;
  }

  // 2. Under 1 year: If 1 month or more (passed 30/31 days), show in months (e.g. "1m", "2m", "6m")
  if (months >= 1) {
    return `${months}m`;
  }

  // 3. Under 1 month (0 to 30/31 days): show in days (e.g. "15d", "28d")
  return `${days}d`;
}

/**
 * Safely parses a profile bio JSON string into a plain object.
 */
export function parseProfileBio(bio?: string | null): Record<string, any> {
  if (!bio || typeof bio !== 'string') return {};
  try {
    const parsed = JSON.parse(bio);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * Returns whether a doctor's digital signature is explicitly enabled (defaults to false/OFF).
 */
export function isDigitalSignatureEnabled(
  prof: { bio?: string | null; user_id?: string } | null | undefined
): boolean {
  if (!prof) return false;
  const parsed = parseProfileBio(prof.bio);
  if (typeof parsed.digital_signature_enabled === 'boolean') {
    return parsed.digital_signature_enabled;
  }
  if (prof.user_id && typeof window !== 'undefined') {
    const cached = localStorage.getItem(`prescripto_sig_enabled_${prof.user_id}`);
    if (cached !== null) return cached === 'true';
  }
  return false;
}

