// Hub Lab content only - prompts and options. Correct answers, model
// answers and rubrics live in public.lab_answer_keys (supabase/099_labs.sql)
// and never ship in the bundle. Option/item/choice ids here must match
// the answer keys there.

export default {
  slug: 'grc-breach-or-not-mzansi-learn',
  organisation: 'Mzansi Learn (Pty) Ltd',
  brief: [
    { type: 'p', text: "You've just joined the privacy team at Mzansi Learn (Pty) Ltd, an online tutoring company with about 6,000 learners aged 10 to 18 on its platform, plus their parents." },
    { type: 'p', text: "The Information Officer is on leave and four incidents landed in the incident register this week. The COO wants to know today which of them must be reported under section 22 of POPIA, and needs a draft notice to parents for the worst one." },
    { type: 'note', text: 'Mzansi Learn and everyone named here are fictional. The section 22 summary in the evidence pack is a teaching summary; read the Act itself before advising a real organisation.' },
  ],
  evidence: [
    {
      id: 's22',
      title: 'POPIA section 22, in plain language',
      meta: 'summary',
      body: [
        { type: 'list', items: [
          'Trigger: there are reasonable grounds to believe personal information has been accessed or acquired by an unauthorised person.',
          'Who to notify: the Information Regulator, and the affected data subjects (unless their identity can\'t be established).',
          'When: as soon as reasonably possible after discovering the compromise, taking into account the legitimate needs of law enforcement and any steps needed to work out the scope of the compromise and restore the integrity of the system.',
          'Delay: notice to data subjects may be delayed only if a public body responsible for preventing, detecting or investigating offences, or the Regulator, decides that notifying would impede a criminal investigation.',
          "How: in writing, by post, email, a prominent notice on the website, the news media, or as the Regulator directs.",
          'What the notice must contain: enough to let data subjects protect themselves, including the possible consequences, what the responsible party has done or plans to do, what the data subject can do to reduce the impact, and the identity of the unauthorised person if known.',
        ] },
        { type: 'p', text: "Unlike the GDPR, section 22 has no \"unlikely to result in harm\" exemption. The test is whether there are reasonable grounds to believe the information was accessed or acquired." },
        { type: 'p', text: 'Learners under 18 are children under POPIA. Notices about a child\'s information go to the parent or guardian.' },
      ],
    },
    {
      id: 'incident-1',
      title: 'Incident 1: stolen tutor laptop',
      meta: 'register',
      body: [
        { type: 'p', text: "A tutor's laptop was stolen from her car on Tuesday evening. It held recorded lessons that show learners' first names." },
        { type: 'p', text: "IT confirms the laptop is managed through Intune with BitLocker full-disk encryption enforced, it was fully shut down at the time, and the tutor's password isn't written down anywhere. IT has sent a remote wipe command and blocked the device." },
      ],
    },
    {
      id: 'incident-2',
      title: 'Incident 2: spreadsheet to the wrong parent',
      meta: 'register',
      body: [
        { type: 'p', text: "An admin assistant emailed the Grade 11 maths progress spreadsheet (312 learners: full names, marks, and a parent's phone number for each) to a parent instead of the maths teacher. Email autocomplete picked the wrong \"T. Ndlovu\"." },
        { type: 'quote', text: "I've deleted this, just letting you know. (Reply from the parent, an hour later)" },
      ],
    },
    {
      id: 'incident-3',
      title: 'Incident 3: ransomware on the file server',
      meta: 'register',
      body: [
        { type: 'p', text: 'On Wednesday at 02:14 the file server was encrypted by ransomware. Firewall logs show about 4 GB sent to an unfamiliar overseas IP address between 01:30 and 02:10.' },
        { type: 'p', text: 'The server held learner enrolment records and the debit order details (bank, account number, account holder) of about 2,100 paying parents. A ransom note says the data will be published unless Mzansi Learn pays.' },
      ],
    },
    {
      id: 'incident-4',
      title: 'Incident 4: wrong dashboard shown',
      meta: 'register',
      body: [
        { type: 'p', text: "After Thursday's release, a caching bug showed one learner another learner's dashboard (name, grade and recent quiz scores) for about ten minutes." },
        { type: 'p', text: 'Application logs confirm exactly one learner saw exactly one other learner\'s dashboard before the release was rolled back. The learner who saw it told their teacher.' },
      ],
    },
  ],
  tasks: [
    {
      key: 't1',
      type: 'match',
      title: 'Notifiable or not?',
      prompt: 'For each incident, decide whether it must be notified under section 22. Use the reasoning most South African privacy practitioners would accept.',
      points: 40,
      items: [
        { id: 'incident-1', label: 'Incident 1: stolen, encrypted, powered-off laptop' },
        { id: 'incident-2', label: 'Incident 2: spreadsheet sent to the wrong parent' },
        { id: 'incident-3', label: 'Incident 3: ransomware with data sent offsite' },
        { id: 'incident-4', label: "Incident 4: one learner saw another's dashboard" },
      ],
      choices: [
        { id: 'notify', label: 'Notify under s22' },
        { id: 'record', label: 'Record it, no s22 notice' },
      ],
    },
    {
      key: 't2',
      type: 'single',
      title: 'Incident 2: "I\'ve deleted it"',
      prompt: 'The parent says they deleted the spreadsheet. What does that change?',
      points: 10,
      options: [
        { id: 'still-notify', label: 'The duty to notify stands; the spreadsheet was already acquired by an unauthorised person' },
        { id: 'no-duty', label: 'There is no longer any duty to notify, since the copy was deleted' },
        { id: 'regulator-only', label: 'Only the Regulator needs to be told, not the parents' },
        { id: 'wait-and-see', label: 'Notify only if the data later turns up somewhere public' },
      ],
    },
    {
      key: 't3',
      type: 'multi',
      title: 'Incident 3: who must be told?',
      prompt: 'Under section 22, who must Mzansi Learn notify about the ransomware incident? Select all that apply.',
      points: 15,
      options: [
        { id: 'regulator', label: 'The Information Regulator' },
        { id: 'parents', label: 'The affected parents, for their own bank details and their children\'s records' },
        { id: 'all-users', label: "Every user on the platform, including those whose data wasn't on the server" },
        { id: 'attackers', label: 'The ransomware group, to open negotiations' },
        { id: 'auditor', label: 'The external auditor, before anyone else' },
      ],
    },
    {
      key: 't4',
      type: 'multi',
      title: 'What goes in the notice?',
      prompt: 'Which of these does section 22 require in the notice to affected parents? Select all that apply.',
      points: 20,
      options: [
        { id: 'consequences', label: 'A description of the possible consequences' },
        { id: 'measures-taken', label: 'What Mzansi Learn has done or intends to do about the compromise' },
        { id: 'recommendations', label: 'What parents can do to reduce the impact' },
        { id: 'identity', label: 'The identity of the unauthorised person, if known' },
        { id: 'forensics', label: 'The full forensic report' },
        { id: 'liability', label: 'A statement on whether Mzansi Learn accepts legal liability' },
        { id: 'staff-names', label: 'The names of the staff members involved' },
      ],
    },
    {
      key: 't5',
      type: 'single',
      title: 'How fast?',
      prompt: 'When must Mzansi Learn notify the Regulator and the affected parents about Incident 3?',
      points: 15,
      options: [
        { id: 'asap', label: "As soon as reasonably possible after discovering it, allowing for law enforcement's legitimate needs and for working out the scope" },
        { id: '72h', label: 'Within exactly 72 hours, as under the GDPR' },
        { id: '30d', label: 'Within 30 days, once the investigation is complete' },
        { id: 'after-ransom', label: 'Only after deciding whether to pay the ransom' },
      ],
    },
    {
      key: 't6',
      type: 'rubric',
      title: 'Draft the notice to parents',
      prompt: 'Write the email to affected parents about Incident 3, in about 250 words. Plain language, no speculation, and enough detail for a parent to protect themselves and their child.',
      placeholder: 'Subject:\n\nDear parent or guardian,\n',
      points: 0,
    },
  ],
};
