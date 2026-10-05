// Hub Lab content only - prompts and options. Correct answers, model
// answers and rubrics live in public.lab_answer_keys (supabase/099_labs.sql)
// and never ship in the bundle. Option/item/choice ids here must match
// the answer keys there.

export default {
  slug: 'aisec-model-risk-mthunzi-claims',
  organisation: 'Mthunzi Insurance',
  brief: [
    { type: 'p', text: 'Mthunzi Insurance, a short-term insurer in Gauteng, wants to use a fraud-scoring model to decide which motor claims go to a human investigator before they are paid. A data scientist found a promising model on a public model-sharing site and has already wired it into a test service.' },
    { type: 'p', text: 'Before it goes live, the Chief Risk Officer wants an AI risk assessment. You have the model page, the loading code and some early results. Find the security risks, find the fairness risk, decide what to do first, and then show on your own computer that you understand the main supply-chain danger.' },
    { type: 'p', text: 'Part one is analysis of the evidence pack here in the portal and is marked automatically. Part two is practical: you write a short risk register and run a small safe demonstration in a throwaway environment, then submit proof. Nothing is hosted for you.' },
    { type: 'note', text: 'Mthunzi Insurance and everyone named here are fictional. The numbers are invented for teaching.' },
  ],
  evidence: [
    {
      id: 'model-page',
      title: 'The model page and loading code',
      meta: 'config',
      body: [
        { type: 'list', items: [
          'Model: claims-fraud-v3, uploaded by an account created nine days ago. 30 downloads. No description of the training data. No published hash or signature.',
          'File to download: claims_model.pkl (a Python pickle file).',
          'The test service loads it with the line below, on a server that can reach the claims database.',
        ] },
        { type: 'code', title: 'service/load_model.py', text: `import pickle

with open("claims_model.pkl", "rb") as f:
    model = pickle.load(f)

def score(claim):
    return model.predict_proba([claim.features])[0][1]` },
      ],
    },
    {
      id: 'results',
      title: 'Early results from the test set',
      meta: 'table',
      body: [
        { type: 'p', text: 'Overall accuracy on the test set is 96%. The table shows how often genuine, honest claims were wrongly flagged as suspected fraud, by where the policyholder lives.' },
        { type: 'table', columns: ['Group', 'Genuine claims', 'Wrongly flagged', 'Rate'], rows: [
          ['Metro areas', '4,000', '160', '4%'],
          ['Towns', '1,500', '90', '6%'],
          ['Rural areas', '800', '88', '11%'],
        ] },
        { type: 'note', text: 'A flagged claim is held for an investigator. Investigators currently take about three weeks to clear a flag.' },
      ],
    },
    {
      id: 'notes',
      title: 'What the team says',
      meta: 'interviews',
      body: [
        { type: 'quote', text: 'The model was trained on claims from before 2022. Our fraud patterns have shifted since. (Data scientist)' },
        { type: 'quote', text: 'The postal province is one of the strongest features in the model, according to the feature importance chart. (Data scientist)' },
        { type: 'quote', text: 'Nobody has been named as owner of the model. It is "a data science thing". (Chief Risk Officer)' },
        { type: 'quote', text: 'We have no plan for what happens if the model starts misbehaving after go-live. (Head of claims)' },
      ],
    },
    {
      id: 'nist',
      title: 'NIST AI Risk Management Framework, in brief',
      meta: 'summary',
      body: [
        { type: 'list', items: [
          'Govern: culture, accountability, policies and decision rights for AI risk.',
          'Map: understand the context: intended use, who is affected, data and potential harms.',
          'Measure: test and track the risks with metrics and monitoring.',
          'Manage: prioritise and act on the risks, including response and recovery plans.',
        ] },
      ],
    },
  ],
  tasks: [
    {
      key: 't1',
      type: 'single',
      title: 'The pickle file',
      prompt: 'What is the most serious immediate security risk in how the model is loaded?',
      points: 14,
      options: [
        { id: 'pickle-code-exec', label: 'Unpickling an untrusted file can run arbitrary code on the server that loads it, which here can reach the claims database' },
        { id: 'slow-load', label: 'Pickle files load slowly' },
        { id: 'file-size', label: 'Pickle files are always too large for the server' },
        { id: 'no-risk', label: 'There is no risk, because pickle is a standard format' },
      ],
    },
    {
      key: 't2',
      type: 'multi',
      title: 'Supply chain controls',
      prompt: 'Select every sensible control for using a model from a public site.',
      points: 24,
      options: [
        { id: 'verify-hash', label: 'Take the model only from a publisher you can verify, and pin and check the file\'s hash or signature' },
        { id: 'sandbox', label: 'Load and test it first in a sandbox with no network access and no credentials' },
        { id: 'safe-format', label: 'Prefer a format that cannot run code on load (for example safetensors or ONNX), or retrain in-house' },
        { id: 'scan-model', label: 'Scan the file with a tool that looks for unsafe pickle operations before opening it' },
        { id: 'trust-downloads', label: 'Trust it because it has been downloaded by other people' },
        { id: 'rename-file', label: 'Rename the file extension to .bin' },
      ],
    },
    {
      key: 't3',
      type: 'match',
      title: 'Map the gaps to the framework',
      prompt: 'Each action fits one of the four NIST AI RMF functions. Match them.',
      points: 24,
      items: [
        { id: 'a-owner', label: 'Name an accountable owner and an approval process for the model before go-live' },
        { id: 'a-context', label: 'Document the intended use, the data it learned from and who is affected by its decisions' },
        { id: 'a-metrics', label: 'Measure wrongly-flagged rates by group every month' },
        { id: 'a-response', label: 'Agree a human-review fallback and a way to switch the model off quickly' },
      ],
      choices: [
        { id: 'govern', label: 'Govern' },
        { id: 'map', label: 'Map' },
        { id: 'measure', label: 'Measure' },
        { id: 'manage', label: 'Manage' },
      ],
    },
    {
      key: 't4',
      type: 'single',
      title: 'The rural flag rate',
      prompt: 'Rural policyholders\' genuine claims are wrongly flagged at 11%, against 4% in metro areas. What do you recommend first?',
      points: 14,
      options: [
        { id: 'investigate-hold', label: 'Investigate the cause (including whether province acts as a proxy), and do not rely on the model alone for rural claims until it is understood; keep a human review path' },
        { id: 'ship', label: 'Ship it: overall accuracy is 96%, which is what matters' },
        { id: 'remove-rural', label: 'Stop accepting rural policyholders' },
        { id: 'hide-table', label: 'Remove the table from the report' },
      ],
    },
    {
      key: 't5',
      type: 'risk_score',
      title: 'Score it: the unverified pickle in the claims service',
      prompt: 'Risk: an unverified model file from a new account is loaded with pickle.load on a server that can reach the claims database. Score the risk before any controls.',
      points: 24,
    },
    {
      key: 't6',
      type: 'rubric',
      title: 'Prove it: a risk register and a safe demonstration',
      prompt: `Do this on your own computer. Nothing is hosted for you.

Part A, the risk register. Write a one-page AI risk register for this model with at least six risks. For each: a clear risk statement (cause, event, consequence), a likelihood and impact score, an owner, the controls you would put in place, and the NIST AI RMF function it falls under.

Part B, a safe demonstration of the pickle danger. In a disposable environment (a throwaway virtual machine or container, with nothing important in it), write a tiny Python class whose __reduce__ method makes unpickling run a harmless command, such as printing a message or writing a file called hello.txt. Pickle it, load it, and show the command ran. Then show the same data saved as JSON, and show that loading it cannot run anything. Never load a pickle you did not create yourself.

Submit: your risk register, your demonstration code, the outputs, and 80 to 120 words on what you would change in Mthunzi's loading code.`,
      placeholder: 'Risk register:\n\nDemonstration code:\n\nOutput of the pickle load:\n\nOutput of the JSON load:\n\nWhat I would change in the loading code:',
      points: 0,
    },
  ],
};
