// Hub Lab content only. Rules, model fix and rubric live in
// public.lab_answer_keys (supabase/099_labs.sql). Task keys must match.

export default {
  slug: 'eng-iam-azure-ndlovu-insights',
  organisation: 'Ndlovu Insights',
  brief: [
    { type: 'p', text: 'Ndlovu Insights is a Cape Town research firm. A nightly job downloads finished reports from one Azure storage account and emails them to clients. When the platform was set up, the job\'s service principal was made an Owner of the whole subscription so that "permissions would never get in the way".' },
    { type: 'p', text: 'You are asked to replace that role assignment with the smallest one that still lets the job read the reports.' },
    { type: 'note', text: 'Ndlovu Insights is fictional. Edit the Terraform in the task box, press Check my work as often as you like (30 checks a day for each task), and submit once every check passes.' },
  ],
  evidence: [
    {
      id: 'needs',
      title: 'What the job actually does',
      meta: 'table',
      body: [
        { type: 'table', columns: ['Step', 'What it needs'], rows: [
          ['Reads finished reports', 'Read access to blob data in the storage account named reports'],
          ['Anything else', 'Nothing. It never writes, deletes, or manages Azure resources.'],
        ] },
        { type: 'note', text: 'Azure has a built-in role named Storage Blob Data Reader that grants read access to blob data. The storage account is declared in the same Terraform as azurerm_storage_account.reports.' },
      ],
    },
    {
      id: 'principles',
      title: 'Role assignment checklist',
      meta: 'list',
      body: [
        { type: 'list', items: [
          'Never Owner, Contributor or User Access Administrator for a job that only reads.',
          'Never assigned at the subscription when one storage account is enough.',
          'Use the built-in role that matches the need.',
          'Scope it to the storage account.',
        ] },
      ],
    },
  ],
  tasks: [
    {
      key: 't1',
      type: 'single',
      title: 'Why this matters',
      prompt: 'The job\'s service principal is an Owner at the subscription. What is the worst realistic outcome if its secret leaks?',
      points: 10,
      options: [
        { id: 'takeover', label: 'An attacker could read, change or delete anything in the subscription, and give themselves more access.' },
        { id: 'slow', label: 'The nightly job would run a little slower.' },
        { id: 'bill', label: 'The Azure bill would show an extra line.' },
        { id: 'nothing', label: 'Nothing, because the secret only works from the firm\'s network.' },
      ],
    },
    {
      key: 't2',
      type: 'artifact',
      title: 'Rewrite the role assignment',
      prompt: 'Change the role assignment so the job can read blob data in the reports storage account and nothing more. Keep it valid Terraform. Then press Check my work.',
      points: 75,
      placeholder: 'roles.tf',
      starters: [
        {
          label: 'Version A',
          text: `data "azurerm_subscription" "primary" {}

resource "azurerm_role_assignment" "report_job" {
  scope                = data.azurerm_subscription.primary.id
  role_definition_name = "Owner"
  principal_id         = azuread_service_principal.report_job.object_id
}
`,
        },
        {
          label: 'Version B',
          text: `data "azurerm_subscription" "current" {}

resource "azurerm_role_assignment" "nightly_reports" {
  principal_id         = azuread_service_principal.report_job.object_id
  role_definition_name = "Contributor"
  scope                = data.azurerm_subscription.current.id
}
`,
        },
      ],
    },
    {
      key: 't3',
      type: 'rubric',
      title: 'Explain your fix',
      prompt: 'In a few sentences, explain why you chose that role and that scope, and how you would confirm the job still works.',
      points: 0,
      placeholder: 'I chose...',
    },
  ],
};
