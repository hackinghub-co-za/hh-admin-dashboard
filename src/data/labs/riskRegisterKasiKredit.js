// Hub Lab content only - prompts and options. Correct answers, model
// answers and rubrics live in public.lab_answer_keys (supabase/099_labs.sql)
// and never ship in the bundle. Option/item/choice ids here must match
// the answer keys there.

export default {
  slug: 'grc-risk-register-kasi-kredit',
  organisation: 'Kasi Kredit (Pty) Ltd',
  brief: [
    { type: 'p', text: "You're a junior GRC analyst at Ubuntu Assurance, a small Johannesburg consultancy. Your client, Kasi Kredit (Pty) Ltd, is a micro-lender with 40 staff across a head office in Soweto and two branches." },
    { type: 'p', text: "Kasi Kredit's funder starts due diligence next month and has asked for a documented information security risk register. Nobody at Kasi Kredit has written one before. Your manager did the site visit; the notes are in the evidence pack." },
    { type: 'p', text: 'Your job: separate real risks from noise, score them with Kasi Kredit\'s own scoring guide, choose treatments and controls, and write up the top risk properly.' },
    { type: 'note', text: 'Kasi Kredit, Ubuntu Assurance and everyone named here are fictional.' },
  ],
  evidence: [
    {
      id: 'it-notes',
      title: 'Site visit notes: IT',
      meta: 'notes',
      body: [
        { type: 'list', items: [
          'LoanDesk, the loan management system, runs on one physical server in the head office storeroom. It holds every customer\'s ID number, address, payslip details and repayment history.',
          'Backups: Sipho, the only IT person, copies the LoanDesk database to a USB drive every Friday and takes the drive home. Nobody has ever tried restoring from it.',
          'Branch staff log in to LoanDesk with one shared username per branch ("branch1", "branch2"). The password is on a sticky note at each branch.',
          'Email is Microsoft 365. Multi-factor authentication (MFA) is not switched on.',
          'Scanned copies of customer ID documents are saved to a shared drive folder that every staff member can open.',
          'The 14 staff laptops have no disk encryption. Two were stolen from cars last year.',
          'Card repayments go through a third-party payment provider. Kasi Kredit never sees or stores card numbers.',
          'The Branch 2 printer runs old firmware. It sits on its own network with no internet access and is being replaced next quarter.',
          'Kasi Kredit has no ATMs; customers repay by debit order, EFT or card.',
        ] },
      ],
    },
    {
      id: 'md-interview',
      title: 'Interview: Managing Director',
      meta: 'notes',
      body: [
        { type: 'quote', text: "Last month someone in collections got an email that looked like it came from Microsoft and typed in their password. The next day customers started getting emails from that account asking for 'urgent settlement payments' into a different bank account. We changed the password, but I don't know how many people paid." },
        { type: 'quote', text: "Our loan officers sometimes ask customers to WhatsApp a photo of their payslip to the officer's own phone. It's faster than email." },
        { type: 'quote', text: "The funder's checklist asks whether we have cyber insurance. We don't, but I'd rather pay a premium than carry a big breach bill ourselves." },
        { type: 'quote', text: "If LoanDesk went down for a week we'd basically stop trading. We wouldn't know who owes us what." },
        { type: 'quote', text: "Half the staff can't tell a real Microsoft email from a fake one. Nobody's ever been trained." },
      ],
    },
    {
      id: 'scoring-guide',
      title: 'Kasi Kredit risk scoring guide',
      meta: 'table',
      body: [
        { type: 'table', columns: ['Score', 'Likelihood', 'Impact'], rows: [
          ['1', 'Rare: less than once in 5 years', 'Negligible: no customer impact, under R10k'],
          ['2', 'Unlikely: once in 2 to 5 years', 'Minor: a few customers affected, under R100k'],
          ['3', 'Possible: about once a year', 'Moderate: many customers affected, or R100k to R500k'],
          ['4', 'Likely: several times a year', 'Major: regulator involvement, or R500k to R2m'],
          ['5', 'Almost certain: monthly or more', "Severe: can't trade, or over R2m"],
        ] },
        { type: 'table', columns: ['Likelihood × Impact', 'Rating'], rows: [
          ['1 to 4', 'Low'],
          ['5 to 9', 'Medium'],
          ['10 to 15', 'High'],
          ['16 to 25', 'Critical'],
        ] },
        { type: 'table', columns: ['Treatment', 'Meaning'], rows: [
          ['Mitigate', 'Reduce likelihood or impact with controls'],
          ['Transfer', 'Shift the financial impact to someone else, e.g. insurance'],
          ['Avoid', 'Stop doing the activity that creates the risk'],
          ['Accept', 'Live with it, documented and signed off'],
        ] },
      ],
    },
  ],
  tasks: [
    {
      key: 't1',
      type: 'multi',
      title: 'Spot the real risks',
      prompt: "Your manager's draft list has eight candidate risks. Select every one that the evidence actually supports. Wrong picks cancel out right ones.",
      points: 20,
      options: [
        { id: 'server-loss', label: 'Ransomware or hardware failure takes out the only LoanDesk server, with no tested backup' },
        { id: 'shared-logins', label: "Branch staff share LoanDesk logins, so fraud can't be traced to a person" },
        { id: 'bec', label: 'A phished mailbox is used to redirect customer repayments (business email compromise)' },
        { id: 'id-folder', label: 'Customer ID scans are readable by every staff member' },
        { id: 'laptop-theft', label: 'Unencrypted laptops are stolen with customer data on them' },
        { id: 'whatsapp', label: "Payslips are collected on loan officers' personal WhatsApp" },
        { id: 'card-data', label: 'Card numbers are stored unencrypted in LoanDesk' },
        { id: 'atm-skimming', label: "Skimming devices are fitted to Kasi Kredit's ATMs" },
      ],
    },
    {
      key: 't2',
      type: 'risk_score',
      title: 'Score it: losing LoanDesk',
      prompt: "Risk: the LoanDesk server fails, is stolen or is hit by ransomware, and the only backup is a week-old, never-tested USB drive at Sipho's house. Score it with the scoring guide.",
      points: 10,
    },
    {
      key: 't3',
      type: 'risk_score',
      title: 'Score it: shared branch logins',
      prompt: "Risk: branch staff share a LoanDesk login whose password is on a sticky note, so a fraudulent loan or a deleted repayment can't be traced to anyone.",
      points: 10,
    },
    {
      key: 't4',
      type: 'match',
      title: 'Pick a treatment',
      prompt: 'Choose the best treatment for each risk. Use each treatment once.',
      points: 20,
      items: [
        { id: 'no-mfa', label: 'No MFA on Microsoft 365, after a mailbox was already phished' },
        { id: 'breach-costs', label: 'The cost of responding to a serious data breach (forensics, notifications, legal)' },
        { id: 'whatsapp', label: "Loan officers collecting payslips on their personal WhatsApp" },
        { id: 'printer', label: 'Old firmware on the isolated Branch 2 printer, being replaced next quarter' },
      ],
      choices: [
        { id: 'mitigate', label: 'Mitigate' },
        { id: 'transfer', label: 'Transfer' },
        { id: 'avoid', label: 'Avoid' },
        { id: 'accept', label: 'Accept' },
      ],
    },
    {
      key: 't5',
      type: 'match',
      title: 'Match controls to risks',
      prompt: 'Pick the control that most directly reduces each risk. One control is a distractor.',
      points: 30,
      items: [
        { id: 'server-loss', label: 'Losing LoanDesk with no usable backup' },
        { id: 'shared-logins', label: 'Untraceable activity on shared branch logins' },
        { id: 'stolen-password', label: 'A stolen password is all it takes to get into a mailbox' },
        { id: 'id-folder', label: 'Every staff member can open the customer ID scans' },
        { id: 'laptop-theft', label: 'Customer data readable on a stolen laptop' },
        { id: 'fake-login', label: "Staff can't recognise a fake Microsoft login page" },
      ],
      choices: [
        { id: 'backups', label: 'Automated, encrypted off-site backups with a quarterly restore test' },
        { id: 'named-accounts', label: 'Named accounts for every user, plus a monthly access review' },
        { id: 'mfa', label: 'MFA on every Microsoft 365 account' },
        { id: 'least-privilege', label: 'Restrict the ID folder to the credit team only' },
        { id: 'disk-encryption', label: 'Full-disk encryption on every laptop' },
        { id: 'awareness', label: 'Phishing awareness training with simulated phishing emails' },
        { id: 'printer-av', label: 'Antivirus on the Branch 2 printer' },
      ],
    },
    {
      key: 't6',
      type: 'rubric',
      title: 'Write up your top risk',
      prompt: 'Pick the risk you would put at the top of the register and write the full entry: a risk statement in cause → event → consequence form, an owner (a role at Kasi Kredit), your likelihood and impact with a sentence of reasoning, the treatment, at least two specific controls, and the residual rating you expect once those controls are in place.',
      placeholder: 'Risk statement:\nOwner:\nLikelihood / impact and why:\nTreatment:\nControls:\nResidual rating:',
      points: 0,
    },
  ],
};
