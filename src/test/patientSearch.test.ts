import { describe, it, expect } from 'vitest';
import { buildPatientSearchFilter, rankPatientSearchResults } from '../lib/patientSearch';

describe('Patient Search Utility', () => {
  it('should extract core name when query includes title like Miss', () => {
    const filter = buildPatientSearchFilter('Miss Arasi');
    expect(filter).toContain('name.ilike.%Arasi%');
    expect(filter).toContain('name.ilike.%Miss Arasi%');
  });

  it('should handle Mr. and other doctor/formal titles', () => {
    const filter = buildPatientSearchFilter('Mr. Rajesh Kumar');
    expect(filter).toContain('name.ilike.%Rajesh Kumar%');
    expect(filter).toContain('name.ilike.%Rajesh%');
    expect(filter).toContain('name.ilike.%Kumar%');
  });

  it('should handle phone numbers', () => {
    const filter = buildPatientSearchFilter('9876543210');
    expect(filter).toContain('phone.ilike.%9876543210%');
    expect(filter).toContain('registration_id.ilike.%9876543210%');
  });

  it('should sanitize characters that break PostgREST syntax', () => {
    const filter = buildPatientSearchFilter('Arasi, M (Special)');
    // Raw parentheses and special characters from input should be stripped
    expect(filter).not.toContain('(');
    expect(filter).not.toContain(')');
    expect(filter).toContain('name.ilike.%Arasi M Special%');
  });

  it('should correctly rank Miss Arasi as top match for query "Miss Arasi"', () => {
    const mockPatients = [
      { id: '1', title: 'Mr.', name: 'Arasikumar', phone: '1111111111', registration_id: '101' },
      { id: '2', title: 'Miss', name: 'Arasi', phone: '9876543210', registration_id: '102', last_opened_at: '2026-09-28T10:00:00Z' },
      { id: '3', title: 'Mrs.', name: 'Saranya Arasi', phone: '2222222222', registration_id: '103' },
    ];

    const ranked = rankPatientSearchResults(mockPatients, 'Miss Arasi');
    expect(ranked[0].id).toBe('2');
    expect(ranked[0].name).toBe('Arasi');
  });

  it('should rank exact name match as top match for query "Arasi"', () => {
    const mockPatients = [
      { id: '1', title: 'Mr.', name: 'Sundararasi', phone: '1111111111', registration_id: '101' },
      { id: '2', title: 'Miss', name: 'Arasi', phone: '9876543210', registration_id: '102' },
      { id: '3', title: 'Mrs.', name: 'Arasi M', phone: '2222222222', registration_id: '103' },
    ];

    const ranked = rankPatientSearchResults(mockPatients, 'Arasi');
    expect(ranked[0].id).toBe('2');
  });
});
