import riskRegisterKasiKredit from './riskRegisterKasiKredit';
import breachOrNotMzansiLearn from './breachOrNotMzansiLearn';
import popiaGapAnalysisIkhaya from './popiaGapAnalysisIkhaya';

// Hub Lab content keyed by labs.slug. A published 'hub' lab with no entry
// here is hidden from members rather than rendered empty.
export const HUB_LAB_CONTENT = Object.fromEntries(
  [riskRegisterKasiKredit, breachOrNotMzansiLearn, popiaGapAnalysisIkhaya].map((lab) => [lab.slug, lab])
);

export const RISK_SCALE = [
  { value: 1, likelihood: 'Rare', impact: 'Negligible' },
  { value: 2, likelihood: 'Unlikely', impact: 'Minor' },
  { value: 3, likelihood: 'Possible', impact: 'Moderate' },
  { value: 4, likelihood: 'Likely', impact: 'Major' },
  { value: 5, likelihood: 'Almost certain', impact: 'Severe' },
];

export function riskRating(score) {
  if (score >= 16) return 'Critical';
  if (score >= 10) return 'High';
  if (score >= 5) return 'Medium';
  return 'Low';
}
