// Hub Lab content only - prompts and options. Correct answers, model
// answers and rubrics live in public.lab_answer_keys (supabase/099_labs.sql)
// and never ship in the bundle. Option/item/choice ids here must match
// the answer keys there.

export default {
  slug: 'grc-popia-gap-analysis-ikhaya-health',
  organisation: 'Ikhaya Health Clinics',
  brief: [
    { type: 'p', text: 'Ikhaya Health Clinics runs four private GP and physiotherapy practices in the Eastern Cape, with about 18,000 patient files.' },
    { type: 'p', text: "The owner, Dr Nomvula Dube, wants to know how far the practice is from complying with POPIA before her insurer's renewal. You have interview notes, the intake form, the website privacy notice and the incident log." },
    { type: 'p', text: "Assess Ikhaya against POPIA's eight conditions for lawful processing, then write a remediation memo she can act on. Health information is special personal information under POPIA, so the bar is higher than usual." },
    { type: 'note', text: 'Ikhaya Health Clinics and everyone named here are fictional. The POPIA summary in the evidence pack is a teaching summary; read the Act itself before advising a real organisation.' },
  ],
  evidence: [
    {
      id: 'conditions',
      title: "POPIA's eight conditions, in brief",
      meta: 'summary',
      body: [
        { type: 'table', columns: ['Condition', 'In short', 'Sections'], rows: [
          ['Accountability', 'The responsible party makes sure every condition is met', 's8'],
          ['Processing limitation', 'Lawful, minimal (adequate, relevant, not excessive), justified by consent or another ground, collected from the person where possible', 's9 to s12'],
          ['Purpose specification', 'Collected for a specific purpose, and not kept longer than that purpose needs', 's13 to s14'],
          ['Further processing limitation', 'Any later use must be compatible with the original purpose', 's15'],
          ['Information quality', 'Reasonable steps to keep information complete, accurate and up to date', 's16'],
          ['Openness', 'Documentation, and telling people what is collected, why, and what their rights are', 's17 to s18'],
          ['Security safeguards', 'Appropriate technical and organisational measures against loss, damage and unauthorised access', 's19 to s22'],
          ['Data subject participation', 'People can access their information and ask for it to be corrected', 's23 to s25'],
        ] },
        { type: 'list', items: [
          'Health information is special personal information. It may only be processed under the authorisations in sections 26 to 33.',
          'Every organisation has an Information Officer, by default its head. The Information Officer must be registered with the Information Regulator.',
          'Direct marketing by SMS or email needs the person\'s consent, or must be to an existing customer about the organisation\'s own similar products, with a chance to opt out (s69).',
          'Sending personal information outside South Africa is allowed where, among other grounds, the recipient is bound by law, binding corporate rules or a contract that gives adequate protection (s72).',
        ] },
      ],
    },
    {
      id: 'front-desk',
      title: 'Interview: front desk, Gqeberha clinic',
      meta: 'notes',
      body: [
        { type: 'quote', text: 'If a patient phones for their blood results, we read them out once the caller gives us the patient\'s ID number.' },
        { type: 'quote', text: 'Old intake forms go in boxes behind reception until someone has time to shred them. Patients wait right there.' },
        { type: 'quote', text: 'If a patient asks to see what\'s in their file, we tell them to ask the doctor. Usually nothing happens after that.' },
        { type: 'quote', text: "When a medical aid rejects a claim because the address or plan number is wrong, we fix it on the claim. Nobody updates the patient's file." },
      ],
    },
    {
      id: 'owner',
      title: 'Interview: Dr Dube, owner',
      meta: 'notes',
      body: [
        { type: 'quote', text: "POPIA's handled. I'm the Information Officer automatically, aren't I? I've never filled anything in, and nobody here really looks after it." },
        { type: 'quote', text: 'We keep every patient file forever. You never know when you\'ll need it.' },
        { type: 'quote', text: 'Our patient system is a cloud product hosted in Ireland. The contract includes a data processing agreement under the GDPR.' },
        { type: 'quote', text: 'Last year my sister opened a gym, and reception sent an SMS to our whole patient list with her opening special.' },
        { type: 'quote', text: 'In September one of the nurses looked up a local radio presenter\'s file when he came in. She was curious. We had a word with her.' },
      ],
    },
    {
      id: 'intake-form',
      title: 'Patient intake form (current)',
      meta: 'form',
      body: [
        { type: 'table', columns: ['Field', 'Notes on the form'], rows: [
          ['Full name, ID number', 'Required'],
          ['Contact number, email, address', 'Required'],
          ['Medical aid name and number', 'Required'],
          ['Emergency contact', 'Optional'],
          ['Allergies and chronic medication', 'Required'],
          ['Religion', '"For our records"'],
          ['Employer and monthly salary', 'Required'],
          ['"I agree to receive news and special offers from Ikhaya and its partners"', 'Checkbox, ticked by default'],
        ] },
      ],
    },
    {
      id: 'privacy-notice',
      title: 'Website privacy notice (excerpt)',
      meta: 'web page',
      body: [
        { type: 'quote', text: 'Ikhaya Health Clinics respects your privacy. We collect your details to provide you with the best care, and may share them with our partners to bring you offers we think you\'ll like. By using our services you agree to this policy. For questions, speak to reception.' },
      ],
    },
    {
      id: 'incident-log',
      title: 'Incident log, July to September',
      meta: '3 rows',
      body: [
        { type: 'table', columns: ['Date', 'What happened', 'Action taken'], rows: [
          ['2026-07-14', "Receptionist's phone stolen. It had a WhatsApp group used for 40 patients' appointment reminders.", 'Bought a new phone'],
          ['2026-08-02', "One patient's lab results filed in another patient's folder; found three weeks later.", 'Moved to the correct file'],
          ['2026-09-10', "Nurse opened a local radio presenter's file with no clinical reason.", 'Verbal warning'],
        ] },
      ],
    },
  ],
  tasks: [
    {
      key: 't1',
      type: 'match',
      title: 'Map findings to conditions',
      prompt: 'Match each finding to the POPIA condition it most clearly breaches. Some conditions apply to more than one finding.',
      points: 45,
      items: [
        { id: 'f1', label: "The privacy notice doesn't say what's collected, what people's rights are, or how to complain" },
        { id: 'f2', label: 'The intake form asks for religion, employer and salary with no reason given' },
        { id: 'f3', label: "Results are read over the phone to anyone who can give the patient's ID number" },
        { id: 'f4', label: 'Old intake forms sit in open boxes next to the waiting area' },
        { id: 'f5', label: 'Every patient file is kept forever, with no retention schedule' },
        { id: 'f6', label: "Patient phone numbers were used to SMS a promotion for the owner's sister's gym" },
        { id: 'f7', label: 'Addresses and medical aid numbers are corrected on claims but never in the file' },
        { id: 'f8', label: 'Patients who ask to see their file are told to ask the doctor, and nothing happens' },
        { id: 'f9', label: 'No Information Officer is registered and nobody owns POPIA compliance' },
      ],
      choices: [
        { id: 'accountability', label: 'Accountability' },
        { id: 'processing-limitation', label: 'Processing limitation' },
        { id: 'purpose-specification', label: 'Purpose specification' },
        { id: 'further-processing', label: 'Further processing limitation' },
        { id: 'information-quality', label: 'Information quality' },
        { id: 'openness', label: 'Openness' },
        { id: 'security', label: 'Security safeguards' },
        { id: 'participation', label: 'Data subject participation' },
      ],
    },
    {
      key: 't2',
      type: 'single',
      title: 'The cloud system in Ireland',
      prompt: "Ikhaya's patient system is hosted in Ireland under a GDPR data processing agreement. Is that a POPIA gap?",
      points: 10,
      options: [
        { id: 'not-a-gap', label: 'Not on its own. Section 72 allows the transfer where the recipient is bound by law or a contract giving adequate protection; check the agreement and document the basis' },
        { id: 'never-leave', label: 'Yes: health information may never leave South Africa' },
        { id: 'always-approval', label: "Yes: every transfer abroad needs the Information Regulator's prior approval" },
        { id: 'not-applicable', label: "No, because POPIA doesn't apply to cloud providers" },
      ],
    },
    {
      key: 't3',
      type: 'multi',
      title: 'Fix the intake form',
      prompt: 'Which fields or settings on the intake form should be removed or changed? Select all that apply.',
      points: 15,
      options: [
        { id: 'religion', label: 'Religion' },
        { id: 'employer-salary', label: 'Employer and monthly salary' },
        { id: 'marketing-preticked', label: 'The pre-ticked news and offers checkbox' },
        { id: 'emergency-contact', label: 'Emergency contact' },
        { id: 'allergies', label: 'Allergies and chronic medication' },
        { id: 'medical-aid', label: 'Medical aid name and number' },
      ],
    },
    {
      key: 't4',
      type: 'risk_score',
      title: 'Score it: staff browsing patient files',
      prompt: "Risk: any staff member can open any patient's file with no clinical reason, and nobody would notice unless they owned up, as happened in September. Score it on a 5 × 5 scale (1 = rare / negligible, 5 = almost certain / severe).",
      points: 10,
    },
    {
      key: 't5',
      type: 'rubric',
      title: 'Remediation memo for Dr Dube',
      prompt: 'Write a memo of about 400 words to Dr Dube with your top five remediation actions, in priority order. For each: what to do, who owns it, and by when. She is a doctor, not a lawyer; write so she could act on it tomorrow.',
      placeholder: 'To: Dr Nomvula Dube\nFrom:\nRe: POPIA remediation priorities\n\n1.',
      points: 0,
    },
  ],
};
