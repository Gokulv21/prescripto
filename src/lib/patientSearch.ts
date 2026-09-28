/**
 * Patient Search Utility
 * Handles multi-word names, titles (Mr, Miss, Mrs, Dr, etc.), phone numbers, and registration IDs.
 */

export const KNOWN_TITLES = new Set([
  'mr', 'mr.', 'mrs', 'mrs.', 'miss', 'ms', 'ms.', 'dr', 'dr.', 'mast', 'mast.', 'master', 'baby', 'selvi', 'thiru', 'smt'
]);

/**
 * Builds PostgREST OR filter conditions for patient search across title, name, phone, and registration_id.
 */
export function buildPatientSearchFilter(rawQuery: string): string {
  if (!rawQuery) return '';

  // Clean characters that would corrupt PostgREST syntax (commas, parentheses, quotes, percent signs)
  const clean = rawQuery.replace(/[,()"'%]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!clean) return '';

  const conditions = new Set<string>();

  // Direct substring match on registration_id
  conditions.add(`registration_id.ilike.%${clean}%`);

  // Phone number search (extract digits)
  const digitsOnly = clean.replace(/\D/g, '');
  if (digitsOnly.length >= 2) {
    conditions.add(`phone.ilike.%${digitsOnly}%`);
    conditions.add(`registration_id.ilike.%${digitsOnly}%`);
  }

  // Full cleaned query on name
  conditions.add(`name.ilike.%${clean}%`);

  // Split into words to handle titles (e.g. "Miss Arasi") and name parts ("Arasi", "Kumar")
  const words = clean.split(' ').filter(Boolean);
  const nonTitleWords = words.filter(w => !KNOWN_TITLES.has(w.toLowerCase()));
  const titleWords = words.filter(w => KNOWN_TITLES.has(w.toLowerCase()));
  const nameWithoutTitle = nonTitleWords.join(' ');

  // If title was stripped and we have a core name (e.g. "Arasi" from "Miss Arasi")
  if (nameWithoutTitle && nameWithoutTitle.toLowerCase() !== clean.toLowerCase()) {
    conditions.add(`name.ilike.%${nameWithoutTitle}%`);
  }

  // If query was ONLY a title (e.g. "Baby" or "Miss")
  if (titleWords.length > 0 && nonTitleWords.length === 0) {
    conditions.add(`title.ilike.%${clean}%`);
  }

  // Match each meaningful word in the name (min 2 chars) so first name, surname, or initials match
  for (const word of nonTitleWords) {
    if (word.length >= 2) {
      conditions.add(`name.ilike.%${word}%`);
    }
  }

  // Check if search looks like a UUID
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clean);
  if (isUuid) {
    conditions.add(`id.eq.${clean}`);
  }

  return Array.from(conditions).join(',');
}

/**
 * Sorts and ranks search results client-side for best match.
 * Gives top priority to exact full-name matches (title + name), name startsWith, phone matches, and recency.
 */
export function rankPatientSearchResults<T extends { title?: string | null; name: string; phone?: string | null; registration_id?: string | null; last_opened_at?: string | null; created_at?: string | null }>(
  patients: T[],
  rawQuery: string
): T[] {
  if (!rawQuery.trim() || !patients.length) return patients;

  const clean = rawQuery.replace(/[,()"'%]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
  const digitsOnly = clean.replace(/\D/g, '');
  const words = clean.split(' ').filter(Boolean);
  const nonTitleWords = words.filter(w => !KNOWN_TITLES.has(w));
  const coreName = nonTitleWords.join(' ');

  return [...patients].sort((a, b) => {
    const scoreA = getMatchScore(a, clean, digitsOnly, coreName, nonTitleWords);
    const scoreB = getMatchScore(b, clean, digitsOnly, coreName, nonTitleWords);

    if (scoreB !== scoreA) {
      return scoreB - scoreA;
    }

    // Tie-breaker: most recently opened or created
    const dateA = new Date(a.last_opened_at || a.created_at || 0).getTime();
    const dateB = new Date(b.last_opened_at || b.created_at || 0).getTime();
    return dateB - dateA;
  });
}

function getMatchScore(
  p: { title?: string | null; name: string; phone?: string | null; registration_id?: string | null },
  clean: string,
  digitsOnly: string,
  coreName: string,
  nonTitleWords: string[]
): number {
  let score = 0;
  const fullName = `${p.title ? p.title.trim() + ' ' : ''}${p.name || ''}`.toLowerCase();
  const patientName = (p.name || '').toLowerCase();
  const phone = (p.phone || '').replace(/\D/g, '');
  const regId = (p.registration_id || '').toLowerCase();

  // Exact full title + name match (e.g. "Miss Arasi")
  if (fullName === clean) score += 200;
  else if (fullName.startsWith(clean)) score += 150;
  else if (fullName.includes(clean)) score += 90;

  // Match against core name (e.g. "Arasi")
  if (coreName) {
    if (patientName === coreName) score += 120;
    else if (patientName.startsWith(coreName)) score += 100;
    else if (patientName.includes(coreName)) score += 80;
  }

  // Exact phone match
  if (digitsOnly && phone) {
    if (phone === digitsOnly) score += 130;
    else if (phone.endsWith(digitsOnly) || phone.startsWith(digitsOnly)) score += 85;
    else if (phone.includes(digitsOnly)) score += 60;
  }

  // Registration ID match
  if (clean && regId) {
    if (regId === clean) score += 130;
    else if (regId.includes(clean)) score += 70;
  }

  // Word matches (first name or surname)
  if (nonTitleWords.length > 0) {
    let matchedWords = 0;
    for (const w of nonTitleWords) {
      if (patientName.includes(w)) matchedWords++;
    }
    score += matchedWords * 25;
  }

  return score;
}
