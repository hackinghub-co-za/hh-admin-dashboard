// Career Simulator ANSWER KEYS - truth labels, best choices and consequences.
// Never import this directly from UI code: it is only reached through
// src/lib/simProvider.js (dynamic import). In the shipped design these live
// server-side (like lab_answer_keys); this local copy exists for the preview.

export const SIM_KEYS = {
  'soc-a1-shift-01': {
    events: {
      'ev-101': { truth: 'benign', best: ['close_benign'], ok: [], effects: { escalate: { trust: -3 } }, debrief: 'The password was rotated minutes earlier (CHG-2229) and the job retried the old secret before picking up the new one. Same source host every time.' },
      'ev-102': { truth: 'noisy', best: ['tune_rule', 'close_benign'], ok: [], effects: { escalate: { trust: -3 } }, debrief: 'A vendor updater seen on 7 hosts. A rule that fires 40 times a week on the same benign domain deserves tuning so real alerts stand out.' },
      'ev-103': { truth: 'true_positive', best: ['escalate', 'contain'], ok: [], effects: { close_benign: { trust: -15, flags: ['exfil_dismissed'] }, tune_rule: { trust: -10, flags: ['rule_blind_egress'] } }, missed: { trust: -12, flags: ['exfil_dismissed'] }, debrief: '52MB to a 2-day-old domain, right after reading the payroll share, from a laptop that had never contacted it. This is data staging. The rule fires often, but 2 of its 31 hits were real.' },
      'ev-104': { truth: 'true_positive', best: ['contain'], ok: ['escalate'], effects: { close_benign: { trust: -10, flags: ['vpn_dismissed'] }, tune_rule: { trust: -6, flags: ['vpn_dismissed'] } }, missed: { trust: -10, flags: ['vpn_dismissed'] }, debrief: 'Two countries in three minutes, MFA skipped, and HR confirms the user is in the office. The account was taken over. Disable the session first, then investigate.' },
      'ev-105': { truth: 'benign', best: ['close_benign'], ok: [], effects: { escalate: { trust: -3 }, contain: { trust: -3 } }, debrief: 'An approved change inside its window, made by the network team. Check the ticket before raising the alarm.' },
      'ev-106': { truth: 'true_positive', best: ['contain'], ok: ['escalate'], effects: { close_benign: { trust: -6, flags: ['dropper_missed'] }, tune_rule: { trust: -4, flags: ['dropper_missed'] } }, missed: { trust: -6, flags: ['dropper_missed'] }, debrief: 'A cracked installer with an encoded PowerShell command and a second payload calling out. That is a malware dropper, not just a nuisance program.' },
      'ev-107': { truth: 'noisy', best: ['close_benign', 'tune_rule', 'contain'], ok: [], effects: { escalate: { trust: -3 } }, debrief: 'Internet background scanning that never reached a login or API path. Nothing to investigate.' },
      'ev-108': { truth: 'true_positive', best: ['contain'], ok: ['escalate'], effects: { close_benign: { trust: -25, flags: ['ransomware_spread'] }, tune_rule: { trust: -25, flags: ['ransomware_spread'] } }, missed: { trust: -25, flags: ['ransomware_spread'] }, debrief: 'Live encryption, ransom notes in 12 shares, still spreading. Isolate FILE-SRV-02 first; every minute is more files lost.' },
    },
    severityWeights: { low: 1, med: 2, high: 3, critical: 4 },
    sla: { low: 180, med: 120, high: 60, critical: 40 },
    weights: { accuracy: 0.5, coverage: 0.3, speed: 0.2 },
  },

  'dso-a2-shift-01': {
    start: { velocity: 60, debt: 20 },
    choiceEffects: {
      block: { velocity: -8, debt: 0 },
      fix_now: { velocity: -12, debt: -2 },
      allow_with_ticket: { velocity: 4, debt: 12 },
      suppress_as_fp: { velocity: 6, debt: 18 },
    },
    missedEffect: { velocity: 5, debt: 20 },
    events: {
      'ev-201': { truth: 'true_positive', best: ['block', 'fix_now'], ok: [], effects: { allow_with_ticket: { flags: ['secret_leaked'], trust: -8 }, suppress_as_fp: { flags: ['secret_leaked'], trust: -12 } }, missed: { flags: ['secret_leaked'], trust: -10 }, debrief: 'A live payment key committed to the repository. Block the merge and rotate the key, because it is already exposed in the diff.' },
      'ev-202': { truth: 'unreachable', best: ['allow_with_ticket', 'suppress_as_fp'], ok: ['fix_now'], effects: { block: { trust: -2 } }, debrief: 'The advisory is real but the package is a test-only dependency that never ships. Reachability decides risk. Ticket it and move on.' },
      'ev-203': { truth: 'true_positive', best: ['block', 'fix_now'], ok: [], effects: { allow_with_ticket: { flags: ['unauth_refunds'], trust: -8 }, suppress_as_fp: { flags: ['unauth_refunds'], trust: -12 } }, missed: { flags: ['unauth_refunds'], trust: -10 }, debrief: 'Staging returned 200 to an anonymous refund. DAST proved this one by behaviour. It must not ship.' },
      'ev-204': { truth: 'false_positive', best: ['suppress_as_fp'], ok: ['allow_with_ticket'], effects: { block: { trust: -2 }, fix_now: { trust: -1 } }, debrief: 'The query is parameterised; the scanner tripped on the log message. Suppressing a verified false positive is good hygiene, with a note explaining why.' },
      'ev-205': { truth: 'true_positive', best: ['block', 'fix_now'], ok: [], effects: { allow_with_ticket: { flags: ['public_bucket'], trust: -8 }, suppress_as_fp: { flags: ['public_bucket'], trust: -12 } }, missed: { flags: ['public_bucket'], trust: -10 }, debrief: 'Invoices share the bucket with public files, so public-read exposes customer data. Separate the buckets before this merges.' },
      'ev-206': { truth: 'acceptable', best: ['allow_with_ticket'], ok: ['suppress_as_fp'], effects: { block: { trust: -2 }, fix_now: { trust: -1 } }, debrief: 'Low-severity findings with no upstream fix. Track them and rebuild when patches exist; blocking the train for this costs more than it saves.' },
    },
    severityWeights: { low: 1, med: 2, high: 3, critical: 4 },
    weights: { accuracy: 0.6, coverage: 0.15, velocity: 0.25 },
  },

  'red-a3-shift-01': {
    exposure: { web: ['public_vuln'], vpn: [], app: ['remote_svc'], files: ['remote_svc'], db: ['remote_svc'], dc: ['remote_svc'], payroll: ['remote_svc'] },
    monitored: { web: false, vpn: true, app: false, files: true, db: true, dc: true, payroll: true },
    techniques: {
      T1046: { noise: 6, needs: null },
      T1190: { noise: 20, needs: 'public_vuln' },
      T1078: { noise: 8, needs: 'weak_creds' },
      T1021: { noise: 14, needs: 'remote_svc' },
      T1041: { noise: 26, needs: null },
    },
    flagMods: [
      { flag: 'secret_leaked', node: 'app', add: ['weak_creds'], note: 'A leaked key from Act II works on the app server.' },
      { flag: 'unauth_refunds', node: 'app', add: ['weak_creds'], note: 'The open refund endpoint from Act II exposes app credentials.' },
      { flag: 'public_bucket', node: 'db', add: ['weak_creds'], note: 'Invoices in the public bucket expose database credentials.' },
      { flag: 'vpn_dismissed', node: 'vpn', add: ['weak_creds'], note: 'The VPN account you left taken over in Act I still works.' },
      { flag: 'dropper_missed', node: 'files', add: ['weak_creds'], note: 'The dropper you missed in Act I left credentials on the file server.' },
      { flag: 'exfil_dismissed', technique: 'T1041', detection: 0.4, note: 'Egress alerts you dismissed in Act I never got fixed.' },
      { flag: 'rule_blind_egress', technique: 'T1041', detection: 0.4, note: 'The egress rule you tuned away in Act I is blind here.' },
    ],
    omitTrust: -10,
    omitScore: 8,
  },

  'grc-a4-shift-01': {
    truth: { r1: { l: 4, i: 5 }, r2: { l: 4, i: 5 }, r3: { l: 4, i: 4 }, r4: { l: 3, i: 4 }, r5: { l: 4, i: 4 }, r6: { l: 3, i: 4 }, r7: { l: 3, i: 3 }, r8: { l: 3, i: 4 }, r9: { l: 2, i: 2 } },
    controls: {
      monitoring: { reduces: ['r1', 'r2', 'r6', 'r8'] },
      patching: { reduces: ['r3', 'r4', 'r1'] },
      training: { reduces: ['r1', 'r6', 'r9'] },
      vendor: { reduces: ['r5', 'r7', 'r2', 'r8'] },
    },
    maxReduction: 0.6,
    audit: {
      fix_and_evidence: { quality: 'best', text: 'Closing the exposure and showing evidence plus a review cycle is what section 19 asks for: appropriate, reasonable safeguards you can prove.' },
      policy_only: { quality: 'ok', text: 'A policy alone does not prove a safeguard is in place. Auditors want the control working, not just written.' },
      accept_gap: { quality: 'wrong', text: 'Convenience is not a defence for exposing personal information. Expect a finding.' },
      blame_team: { quality: 'wrong', text: 'Safeguards are the responsible party\'s duty. Blaming a team reads as no governance.' },
    },
    board: {
      notify_all: { quality: 'best', text: 'POPIA section 22 expects notification of the regulator and affected people. Prompt, honest disclosure with a fix plan protects trust.' },
      regulator_only: { quality: 'ok', text: 'Partial disclosure leaves customers exposed to risk they do not know about, and the duty covers them too.' },
      wait: { quality: 'wrong', text: 'Delay is itself a failure. Notify as soon as reasonably possible, and update as facts firm up.' },
      hide: { quality: 'wrong', text: 'Hiding a confirmed exposure turns an incident into a governance failure.' },
    },
    weights: { placement: 0.4, allocation: 0.3, governance: 0.3 },
    allocationTarget: 0.5,
  },
};
