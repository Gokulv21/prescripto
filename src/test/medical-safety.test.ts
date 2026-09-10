import { describe, it, expect } from 'vitest';
import { evaluateMedicineSafety } from '@/lib/medicalSafety';

describe('Medical Safety & Age-Based Contraindication Engine', () => {
  it('should flag Aspirin in children under 12 years (Reye Syndrome risk)', () => {
    const warnings = evaluateMedicineSafety('Aspirin 75mg', 'Tab.', 6);
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0].severity).toBe('critical');
    expect(warnings[0].title).toBe('Reye Syndrome Risk');
  });

  it('should NOT flag Aspirin in adult patients (e.g. 45 years)', () => {
    const warnings = evaluateMedicineSafety('Aspirin 75mg', 'Tab.', 45);
    expect(warnings.length).toBe(0);
  });

  it('should flag Fluoroquinolones (Ciprofloxacin) in pediatric patients (< 16 years)', () => {
    const warnings = evaluateMedicineSafety('Ciprofloxacin 500mg', 'Tab.', 10);
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0].type).toBe('pediatric');
    expect(warnings[0].title).toContain('Cartilage');
  });

  it('should flag Tetracyclines (Doxycycline) in young children (< 8 years)', () => {
    const warnings = evaluateMedicineSafety('Doxycycline 100mg', 'Cap.', 5);
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0].severity).toBe('critical');
    expect(warnings[0].title).toContain('Tooth Discoloration');
  });

  it('should suggest liquid/syrup form factor for toddlers under 4 years when tablet is selected', () => {
    const warnings = evaluateMedicineSafety('Paracetamol', 'Tab.', 2);
    expect(warnings.some(w => w.type === 'dosage')).toBe(true);
  });

  it('should flag heavy NSAIDs (Diclofenac) in geriatric patients (65+ years)', () => {
    const warnings = evaluateMedicineSafety('Diclofenac Sodium 50mg', 'Tab.', 72);
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0].type).toBe('geriatric');
    expect(warnings[0].title).toContain('GI Bleed');
  });
});
