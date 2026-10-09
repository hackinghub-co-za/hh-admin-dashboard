// Career Simulator scenario packs - the PUBLIC half only (prompts, evidence,
// graphs, option lists). Truth labels, best choices and consequences live in
// src/data/sim/keys.js and are only ever imported through src/lib/simProvider.js.

export const CHOICE_LABELS = {
  escalate: 'Escalate to IR',
  contain: 'Contain host',
  tune_rule: 'Tune rule',
  close_benign: 'Close as benign',
  block: 'Block and rotate',
  fix_now: 'Fix now with dev',
  allow_with_ticket: 'Allow, open ticket',
  suppress_as_fp: 'Mark false positive',
};

const SOC_PACK = {
  id: 'soc-a1-shift-01',
  act: 'soc',
  title: 'Month-end at Kasi Kredit',
  briefing: 'You are the night-to-morning analyst at a micro-lender in Johannesburg. Month-end means payroll runs, vendor updates and a lot of noise. Read the evidence, run queries when you need more, then decide. Every action costs focus. Leave too many alerts waiting and your focus drains faster.',
  durationSec: 420,
  focus: { start: 100, perChoice: 3, perQuery: 4, backlogThreshold: 4, backlogDrainPerSec: 0.4, lowMark: 35 },
  events: [
    {
      id: 'ev-101', type: 'alert', at: 5, severity: 'low', source: 'AUTH', summary: 'Three failed logins for svc-backup',
      lines: ['02:14:07 svc-backup FAILED_LOGIN src=10.4.1.9 reason=bad_password', '02:14:19 svc-backup FAILED_LOGIN src=10.4.1.9 reason=bad_password', '02:14:30 svc-backup FAILED_LOGIN src=10.4.1.9 reason=bad_password', '02:14:41 svc-backup SUCCESS src=10.4.1.9'],
      context: ['Asset: BACKUP-SRV-01', 'Role: nightly backup job', 'Rule: AUTH-BRUTE-3 (fired 6 times this week)'],
      queries: [{ cmd: 'auth svc-backup', out: ['02:10 CHG-2229: password rotated for svc-backup by it-ops', '02:14 job retried old password 3 times, then picked up new secret', 'src 10.4.1.9 is BACKUP-SRV-01 on every attempt'] }],
    },
    {
      id: 'ev-102', type: 'alert', at: 20, severity: 'med', source: 'DNS', summary: 'Rare domain lookups from RECEPTION-PC',
      lines: ['RECEPTION-PC resolved updates.vendor-cdn.example 214 times in 1 hour', 'Domain first seen on network 3 days ago'],
      context: ['Asset: RECEPTION-PC', 'Rule: DNS-RARE-DOMAIN (fired 40 times this week)'],
      queries: [{ cmd: 'dns RECEPTION-PC', out: ['updates.vendor-cdn.example belongs to the PrinterSoft updater', 'Same domain seen on 6 other hosts, all clean in EDR', 'No data uploaded, only small GET requests'] }],
    },
    {
      id: 'ev-103', type: 'alert', at: 45, severity: 'high', source: 'EDR', summary: 'Unusual upload from FIN-LAP-23',
      lines: ['10:41:02 10.4.8.23 POST rare-domain.example 4.2MB', '10:41:09 10.4.8.23 POST rare-domain.example 3.9MB', '10:41:15 10.4.8.23 GET intranet/payroll 0.1MB'],
      context: ['Asset: FIN-LAP-23', 'Owner: finance team', 'Rule: EGRESS-LARGE-POST (fired 31 times this week, 29 benign)'],
      queries: [
        { cmd: 'proxy host=FIN-LAP-23', out: ['14 POSTs to rare-domain.example in 6 minutes, 52MB total', 'Preceded by 9 reads of the payroll share', 'Laptop has never contacted this domain before today'] },
        { cmd: 'whois rare-domain.example', out: ['Registered 2 days ago', 'Registrant hidden by privacy service', 'Hosted outside South Africa'] },
      ],
    },
    {
      id: 'ev-104', type: 'alert', at: 80, severity: 'med', source: 'VPN', summary: 'VPN login from a new country',
      lines: ['10:02:11 n.dlamini VPN LOGIN ok src=41.x.x.x (Johannesburg)', '10:05:48 n.dlamini VPN LOGIN ok src=85.x.x.x (Bucharest)'],
      context: ['User: n.dlamini, sales', 'Rule: VPN-IMPOSSIBLE-TRAVEL'],
      queries: [{ cmd: 'vpn user=n.dlamini', out: ['Second login skipped MFA: legacy client profile', 'HR roster: n.dlamini is in the Sandton office today', 'Session already pulled 1.1GB from the CRM export share'] }],
    },
    {
      id: 'ev-105', type: 'alert', at: 130, severity: 'low', source: 'FW', summary: 'Firewall rule changed on FW-EDGE-01',
      lines: ['09:12:30 FW-EDGE-01 rule 42 modified by t.naidoo', 'Change: allow tcp/8443 from 10.4.20.0/24'],
      context: ['Admin: t.naidoo, network team', 'Rule: FW-POLICY-CHANGE'],
      queries: [{ cmd: 'change FW-EDGE-01', out: ['CHG-2231 approved, window 09:00-10:00', 'Adds port 8443 for the new monitoring subnet', 'Approver: it-manager'] }],
    },
    {
      id: 'ev-106', type: 'alert', at: 170, severity: 'high', source: 'AV', summary: 'PUA detected on DEV-LAP-04',
      lines: ['DEV-LAP-04 quarantined Installer_Crack_IDE.exe (PUA.Generic)', 'Parent process spawned powershell.exe with an encoded command'],
      context: ['Asset: DEV-LAP-04', 'Owner: j.pretorius, developer', 'Rule: AV-PUA'],
      queries: [{ cmd: 'edr host=DEV-LAP-04', out: ['powershell.exe -enc JAB... (encoded)', 'Outbound 443 to 45.x.x.x, 18 seconds after quarantine', 'Second payload written to %TEMP%\\svc.dat'] }],
    },
    {
      id: 'ev-107', type: 'alert', at: 230, severity: 'med', source: 'WEB', summary: 'Spike of 404s on the public site',
      lines: ['198.51.100.23 requested 1,204 paths in 90 seconds', 'All 404 except /robots.txt'],
      context: ['Asset: WEB-01 public website', 'Rule: WEB-404-SPIKE'],
      queries: [{ cmd: 'web top-ips', out: ['198.51.100.23 is a known internet scanner', 'No requests reached login or API paths', 'No successful responses other than robots.txt'] }],
    },
    {
      id: 'ev-108', type: 'alert', at: 300, severity: 'critical', source: 'EDR', summary: 'Mass file renames on FILE-SRV-02',
      lines: ['FILE-SRV-02: 3,100 files renamed to *.locked in 4 minutes', 'Actor account: svc-share'],
      context: ['Asset: FILE-SRV-02, shared drives', 'Rule: EDR-MASS-RENAME'],
      queries: [{ cmd: 'edr host=FILE-SRV-02', out: ['Process encryptor.exe started 4 minutes ago', 'HOW_TO_RECOVER.txt dropped in 12 shares', 'Still spreading to the finance share'] }],
    },
  ],
};

const PIPELINE_PACK = {
  id: 'dso-a2-shift-01',
  act: 'devsecops',
  title: 'Release train: payments-api',
  briefing: 'You now run security for the engineering team. A release train leaves at the end of this shift and every pull request waits on you. Scanners are loud and sometimes wrong. Block what is dangerous, let safe work through, and watch the two meters: velocity rewards shipping, security debt punishes shortcuts.',
  durationSec: 360,
  meters: { velocity: 60, debt: 20 },
  weights: { accuracy: 0.6, coverage: 0.15, velocity: 0.25 },
  events: [
    {
      id: 'ev-201', type: 'commit', at: 0, severity: 'high', repo: 'payments-api', title: 'PR #482: Add refund webhook', author: 't.mokoena',
      diff: [{ file: 'config/prod.env', lines: [{ t: 'del', s: '-API_KEY=' }, { t: 'add', s: '+API_KEY=sk_live_********' }] }],
      scanners: [{ tool: 'SAST', finding: 'Hard-coded secret', confidence: 'medium' }],
      note: 'The key prefix matches the payment provider live key format.',
    },
    {
      id: 'ev-202', type: 'commit', at: 0, severity: 'med', repo: 'payments-api', title: 'PR #485: Update PDF test fixtures', author: 'a.khumalo',
      diff: [{ file: 'package.json', lines: [{ t: 'ctx', s: '  "devDependencies": {' }, { t: 'add', s: '+    "pdf-render": "2.3.1",' }, { t: 'ctx', s: '  }' }] }],
      scanners: [{ tool: 'SCA', finding: 'Advisory on pdf-render 2.3.1', confidence: 'high' }],
      note: 'The package is only imported by the test suite and is not shipped in the build.',
    },
    {
      id: 'ev-203', type: 'commit', at: 0, severity: 'high', repo: 'payments-api', title: 'PR #487: Refund endpoint v2', author: 't.mokoena',
      diff: [{ file: 'routes/refunds.js', lines: [{ t: 'add', s: "+router.post('/v2/refunds', issueRefund);" }, { t: 'ctx', s: '  // other routes use requireAuth middleware' }] }],
      scanners: [{ tool: 'DAST', finding: 'POST /v2/refunds accepts anonymous requests', confidence: 'high' }],
      note: 'The staging deploy returned 200 to an unauthenticated refund request.',
    },
    {
      id: 'ev-204', type: 'commit', at: 0, severity: 'med', repo: 'payments-api', title: 'PR #489: Export report to CSV', author: 'l.venter',
      diff: [{ file: 'reports/export.js', lines: [{ t: 'add', s: "+const rows = await db.query('SELECT * FROM txns WHERE id = $1', [id]);" }, { t: 'add', s: '+logger.info("exporting " + id);' }] }],
      scanners: [{ tool: 'SAST', finding: 'Possible SQL injection (string concatenation)', confidence: 'low' }],
      note: 'The concatenation the scanner flagged is the log line, not the query.',
    },
    {
      id: 'ev-205', type: 'commit', at: 0, severity: 'high', repo: 'infra', title: 'PR #31: Marketing assets bucket', author: 'r.maseko',
      diff: [{ file: 'storage.tf', lines: [{ t: 'add', s: '+resource "storage_bucket" "assets" {' }, { t: 'add', s: '+  name = "hh-marketing-assets"' }, { t: 'add', s: '+  acl  = "public-read"' }, { t: 'add', s: '+}' }, { t: 'ctx', s: '  # invoices/ prefix also lives in this bucket' }] }],
      scanners: [{ tool: 'IaC', finding: 'Bucket is publicly readable', confidence: 'high' }],
      note: 'Finance exports customer invoices into the same bucket.',
    },
    {
      id: 'ev-206', type: 'commit', at: 0, severity: 'low', repo: 'payments-api', title: 'PR #490: Rebuild container image', author: 'ci-bot',
      diff: [{ file: 'Dockerfile', lines: [{ t: 'ctx', s: '  FROM debian:11-slim' }] }],
      scanners: [{ tool: 'Image scan', finding: '14 low-severity CVEs in base packages', confidence: 'high' }],
      note: 'No fixed package versions exist upstream yet.',
    },
  ],
};

const REDTEAM_PACK = {
  id: 'red-a3-shift-01',
  act: 'redteam',
  title: 'Operation Greyline',
  briefing: 'Kasi Kredit hired you to test its defences. Objective: reach the customer database and prove data could leave. Build the chain one technique at a time. Every move makes noise and the defenders are watching. The payroll system is out of scope; touching it ends the engagement. Whatever you find, you must decide what goes in the report.',
  durationSec: 300,
  objective: 'Exfiltrate data from the customer database',
  detectionLimit: 100,
  nodes: [
    { id: 'internet', name: 'Internet', kind: 'external', x: 40, y: 150, inScope: true },
    { id: 'web', name: 'Public site', kind: 'host', x: 160, y: 60, inScope: true },
    { id: 'vpn', name: 'VPN gateway', kind: 'host', x: 160, y: 240, inScope: true },
    { id: 'app', name: 'App server', kind: 'host', x: 300, y: 60, inScope: true },
    { id: 'files', name: 'File server', kind: 'host', x: 300, y: 240, inScope: true },
    { id: 'db', name: 'Customer DB', kind: 'data', x: 440, y: 120, inScope: true },
    { id: 'dc', name: 'Domain ctrl', kind: 'host', x: 440, y: 240, inScope: true },
    { id: 'payroll', name: 'Payroll system', kind: 'host', x: 570, y: 180, inScope: false },
  ],
  edges: [['internet', 'web'], ['internet', 'vpn'], ['web', 'app'], ['vpn', 'files'], ['app', 'db'], ['app', 'files'], ['files', 'dc'], ['db', 'payroll'], ['dc', 'payroll']],
  techniques: [
    { id: 'T1046', name: 'Network service discovery', tactic: 'Discovery', blurb: 'Scan a neighbouring host to learn what it exposes. Quiet, but not free.' },
    { id: 'T1190', name: 'Exploit public-facing application', tactic: 'Initial access', blurb: 'Attack a vulnerable internet-facing service. Loud.' },
    { id: 'T1078', name: 'Valid accounts', tactic: 'Persistence', blurb: 'Log in with credentials that already work. Quiet when credentials exist.' },
    { id: 'T1021', name: 'Remote services', tactic: 'Lateral movement', blurb: 'Move from a host you hold to a neighbour using its remote service.' },
    { id: 'T1041', name: 'Exfiltration over C2 channel', tactic: 'Exfiltration', blurb: 'Pull data out of a compromised data store. The objective, and very loud.' },
  ],
  findingLabels: {
    public_vuln: 'Internet-facing service with an exploitable weakness',
    weak_creds: 'Credentials that work and should not',
    remote_svc: 'Remote service reachable from inside the network',
  },
};

const BOARD_PACK = {
  id: 'grc-a4-shift-01',
  act: 'grc',
  title: 'Q3 board review',
  briefing: 'You are now the head of security. The board meets after a regulator-readiness audit. Place each risk on the matrix where the evidence puts it, spend your budget on controls, then answer the audit and board questions. Risks you created, ignored or hid in earlier acts are all on this register.',
  baseCredits: 60,
  scale: [
    { v: 1, likelihood: 'Rare', impact: 'Negligible' },
    { v: 2, likelihood: 'Unlikely', impact: 'Minor' },
    { v: 3, likelihood: 'Possible', impact: 'Moderate' },
    { v: 4, likelihood: 'Likely', impact: 'Major' },
    { v: 5, likelihood: 'Almost certain', impact: 'Severe' },
  ],
  risks: [
    { id: 'r1', title: 'Ransomware spreading through file shares', detail: 'Shared drives hold finance and customer files, and one live ransomware alert was seen this quarter.', appearsIf: null },
    { id: 'r2', title: 'Customer data leaving unnoticed', detail: 'Large uploads to unknown domains were seen and egress monitoring has gaps.', appearsIf: ['exfil_dismissed', 'rule_blind_egress'] },
    { id: 'r3', title: 'Fraudulent refunds through an open endpoint', detail: 'A refund endpoint went out without authentication.', appearsIf: ['unauth_refunds'] },
    { id: 'r4', title: 'Live payment key exposed in code', detail: 'A production API key sits in the repository history.', appearsIf: ['secret_leaked'] },
    { id: 'r5', title: 'Public storage bucket holding invoices', detail: 'Customer invoices share a bucket with public marketing files.', appearsIf: ['public_bucket'] },
    { id: 'r6', title: 'Hijacked remote-access accounts', detail: 'A VPN login from abroad skipped MFA and pulled CRM data.', appearsIf: ['vpn_dismissed'] },
    { id: 'r7', title: 'Third-party vendor with standing access', detail: 'Three vendors keep permanent remote access with shared logins.', appearsIf: null },
    { id: 'r8', title: 'Penetration test findings never reported', detail: 'Issues found in testing were left out of the report, so nobody owns the fixes.', appearsIf: ['finding_unreported_web', 'finding_unreported_app', 'finding_unreported_vpn', 'finding_unreported_files', 'finding_unreported_db'] },
    { id: 'r9', title: 'Lost or stolen laptop with customer data', detail: 'Staff travel with laptops that hold customer spreadsheets.', appearsIf: null },
  ],
  controls: [
    { id: 'monitoring', name: 'Monitoring and response', detail: 'SIEM tuning, egress alerts, an on-call responder.', max: 40 },
    { id: 'patching', name: 'Secure development and patching', detail: 'Pipeline gates, secrets scanning, faster fixes.', max: 40 },
    { id: 'training', name: 'Staff training and MFA', detail: 'Awareness, enforced MFA, device encryption.', max: 40 },
    { id: 'vendor', name: 'Vendor and data governance', detail: 'Access reviews, storage policies, vendor contracts.', max: 40 },
  ],
  audit: {
    framework: 'POPIA',
    clause: 'Section 19: Security safeguards',
    question: 'The auditor finds customer ID scans on an open shared drive. What do you put in your response?',
    options: [
      { id: 'fix_and_evidence', text: 'Restrict access today, show the access log, and commit to a quarterly access review.' },
      { id: 'policy_only', text: 'Point to the written information security policy that says files must be protected.' },
      { id: 'accept_gap', text: 'Accept the gap and explain that the business needs the files open for speed.' },
      { id: 'blame_team', text: 'Say the finance team ignored the policy and is responsible.' },
    ],
  },
  boardEvent: {
    appearsIf: ['exfil_dismissed', 'rule_blind_egress', 'ransomware_spread'],
    title: 'Board incident: customer data exposure',
    question: 'Investigation confirms customer data left the network earlier this quarter and was not escalated at the time. How do you brief the board?',
    options: [
      { id: 'notify_all', text: 'Notify the Information Regulator and affected customers, take responsibility, and present the fixes.' },
      { id: 'regulator_only', text: 'Notify the Information Regulator but keep customers out of it until the facts are firmer.' },
      { id: 'wait', text: 'Wait for more evidence before telling anyone outside the company.' },
      { id: 'hide', text: 'Keep it internal. No customer harm has been proven.' },
    ],
  },
};

export const SIM_ACTS = [
  { id: 'soc', order: 1, role: 'SOC Analyst', tagline: 'Triage alerts without drowning', pack: SOC_PACK },
  { id: 'devsecops', order: 2, role: 'DevSecOps Engineer', tagline: 'Ship software without shipping a breach', pack: PIPELINE_PACK },
  { id: 'redteam', order: 3, role: 'Penetration Tester', tagline: 'Reach the objective before they catch you', pack: REDTEAM_PACK },
  { id: 'grc', order: 4, role: 'GRC Manager and CISO', tagline: 'Make the trade-offs leadership owns', pack: BOARD_PACK },
];

export const PASS_MARK = 60;

// Shown in debriefs after a shift, once consequences are already decided.
export const FLAG_TEXT = {
  exfil_dismissed: 'A real data-exfiltration alert was not escalated.',
  rule_blind_egress: 'The egress detection rule was tuned until it went blind.',
  vpn_dismissed: 'A hijacked VPN session was left running.',
  dropper_missed: 'A malware dropper on a developer laptop was not contained.',
  ransomware_spread: 'Ransomware was left to spread across the file shares.',
  secret_leaked: 'A live payment key shipped in the code.',
  unauth_refunds: 'A refund endpoint shipped without authentication.',
  public_bucket: 'A public storage bucket now holds customer invoices.',
  finding_unreported_web: 'A public-site weakness was left out of the report.',
  finding_unreported_app: 'An app-server weakness was left out of the report.',
  finding_unreported_vpn: 'A VPN weakness was left out of the report.',
  finding_unreported_files: 'A file-server weakness was left out of the report.',
  finding_unreported_db: 'A database weakness was left out of the report.',
};
