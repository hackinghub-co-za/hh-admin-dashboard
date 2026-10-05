// Hub Lab content only - prompts and options. Correct answers, model
// answers and rubrics live in public.lab_answer_keys (supabase/099_labs.sql)
// and never ship in the bundle. Option/item/choice ids here must match
// the answer keys there.

export default {
  slug: 'aisec-rag-leakage-imbizo-hr',
  organisation: 'Imbizo Group',
  brief: [
    { type: 'p', text: 'Imbizo Group is a mid-sized South African retailer with about 1,800 staff. Its HR team launched an internal assistant, the HR Copilot, that answers staff questions from HR documents using retrieval-augmented generation (RAG).' },
    { type: 'p', text: 'Three weeks in, a junior employee told her manager that the Copilot had told her what the CEO\'s bonus was. The head of HR has asked you to work out how it happened, what to change, and how serious it is, and then to show you can demonstrate the fix in a small piece of code.' },
    { type: 'p', text: 'Part one is analysis of the evidence pack here in the portal and is marked automatically. Part two is practical: you write a short threat model and a tiny script on your own computer, and submit proof. Nothing is hosted for you.' },
    { type: 'note', text: 'Imbizo Group and everyone named here are fictional.' },
  ],
  evidence: [
    {
      id: 'design',
      title: 'How the HR Copilot works',
      meta: 'architecture',
      body: [
        { type: 'list', items: [
          'Staff sign in with single sign-on. The chat window knows who they are.',
          'When someone asks a question, the question is turned into an embedding and matched against a vector database that holds chunks of every HR document in a single collection.',
          'The five best-matching chunks and the question are sent to the language model, which writes the answer and cites the documents it used.',
          'The retrieval service uses a service account that can read every document in the HR library.',
          'The chat window hides the "HR only" folder from non-HR users in its browse menu. Nothing else checks who is asking.',
          'Everything that is asked and answered is stored for 90 days for quality review.',
        ] },
      ],
    },
    {
      id: 'documents',
      title: 'What is in the library',
      meta: 'table',
      body: [
        { type: 'table', columns: ['Id', 'Document', 'Who is meant to see it'], rows: [
          ['handbook', 'Employee handbook', 'All staff'],
          ['leave', 'Leave policy', 'All staff'],
          ['salary-bands', 'Salary bands by grade', 'HR team only'],
          ['disciplinary', 'Disciplinary case notes', 'The HR case owner for that case only'],
          ['exec-comp', 'Executive compensation report', 'Board remuneration committee only'],
        ] },
      ],
    },
    {
      id: 'logs',
      title: 'Two conversations from the logs',
      meta: 'transcripts',
      body: [
        { type: 'quote', text: 'User (junior employee): What is the CEO\'s bonus?\nAssistant: According to the Executive compensation report, the CEO\'s bonus was R4.2 million. [Source: Executive compensation report.pdf]' },
        { type: 'quote', text: 'User (same user, a minute later): Summarise any disciplinary cases mentioning a delivery driver.\nAssistant: There are two cases. In the first... [Source: Disciplinary case notes.docx]' },
      ],
    },
  ],
  tasks: [
    {
      key: 't1',
      type: 'single',
      title: 'The root cause',
      prompt: 'Why did a junior employee get the CEO\'s bonus?',
      points: 14,
      options: [
        { id: 'service-account-no-filter', label: 'Retrieval runs as a service account that sees every document and nothing filters results by who is asking, so hiding a folder in the menu was never enforcement' },
        { id: 'model-hallucinated', label: 'The language model invented the figure' },
        { id: 'weak-passwords', label: 'The employee guessed a manager\'s password' },
        { id: 'sso-broken', label: 'Single sign-on is switched off' },
      ],
    },
    {
      key: 't2',
      type: 'multi',
      title: 'Which controls fix it?',
      prompt: 'Select every control that addresses the root cause.',
      points: 24,
      options: [
        { id: 'filter-at-retrieval', label: 'Apply the signed-in user\'s permissions as a filter on every retrieval query, using access metadata stored with each chunk' },
        { id: 'on-behalf-of', label: 'Call the retrieval service on the user\'s behalf with their own identity, not a shared super-user account' },
        { id: 'separate-indexes', label: 'Keep the most sensitive documents (executive pay, case notes) in separate indexes that most users cannot query at all' },
        { id: 'log-retrieved', label: 'Record which document IDs were retrieved for each answer, so access can be audited' },
        { id: 'prompt-refuse', label: 'Tell the model in its prompt to refuse salary and bonus questions' },
        { id: 'hide-folder', label: 'Hide the HR folder from the browse menu' },
        { id: 'remove-citations', label: 'Remove the citations from answers' },
      ],
    },
    {
      key: 't3',
      type: 'match',
      title: 'Who should be able to retrieve what?',
      prompt: 'For each document, choose the audience whose permissions should let the Copilot use it in an answer.',
      points: 24,
      items: [
        { id: 'handbook', label: 'Employee handbook' },
        { id: 'leave', label: 'Leave policy' },
        { id: 'salary-bands', label: 'Salary bands by grade' },
        { id: 'disciplinary', label: 'Disciplinary case notes' },
        { id: 'exec-comp', label: 'Executive compensation report' },
      ],
      choices: [
        { id: 'a-all', label: 'All staff' },
        { id: 'a-hr', label: 'HR team' },
        { id: 'a-case-owner', label: 'The HR case owner for that case' },
        { id: 'a-board', label: 'Board remuneration committee' },
      ],
    },
    {
      key: 't4',
      type: 'single',
      title: 'Where must the permission check happen?',
      prompt: 'Where is the right place to enforce who may see a chunk?',
      points: 14,
      options: [
        { id: 'before-prompt', label: 'Before retrieval results are placed in the model\'s prompt, because anything in the prompt may appear in the answer' },
        { id: 'after-answer', label: 'After the model has answered, by asking it to remove anything private' },
        { id: 'ui-only', label: 'In the chat window only' },
        { id: 'user-honesty', label: 'By asking users not to ask about restricted topics' },
      ],
    },
    {
      key: 't5',
      type: 'risk_score',
      title: 'Score it: any employee can read executive pay and case notes',
      prompt: 'Risk: any of the 1,800 staff can ask the HR Copilot for executive compensation or disciplinary case notes and get them, today, with no special skill. Score the risk.',
      points: 24,
    },
    {
      key: 't6',
      type: 'rubric',
      title: 'Prove it: a threat model and a working filter',
      prompt: `Do this on your own computer. Nothing is hosted for you, and you only use made-up data.

Part A, the threat model. Pick a fictional company and design a RAG assistant for it (HR, legal, support, finance, anything). Draw the data flow with a free tool such as diagrams.net, and write a table of at least six threats: the threat, the OWASP Top 10 for LLM Applications category it falls under, the impact, and the control.

Part B, a working demonstration. Write a short script in any language that holds about ten made-up document chunks, each with an access list (the groups allowed to see it). Write a retrieve(user, question) function that finds matching chunks (a simple keyword match is fine) but only among chunks the user is allowed to see. Run it for two different users asking the same question and show the results differ.

Submit: a view-only link to your diagram, the threats table, your script, and the output for the two users. Add a short note on what your demo does not protect against.`,
      placeholder: 'Diagram link:\n\nThreats table:\n\nScript:\n\nOutput for two users:\n\nWhat this does not protect against:',
      points: 0,
    },
  ],
};
