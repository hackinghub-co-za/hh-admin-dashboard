// Hub Lab content only - prompts and options. Correct answers, model
// answers and rubrics live in public.lab_answer_keys (supabase/099_labs.sql)
// and never ship in the bundle. Option/item/choice ids here must match
// the answer keys there.

export default {
  slug: 'azure-access-review-cape-vineyards',
  organisation: 'Cape Vineyards Trading',
  brief: [
    { type: 'p', text: 'Cape Vineyards Trading exports wine from the Western Cape and runs its order system and finance data in Microsoft Azure. Over four years, whoever needed access was given it, and nobody has looked at who holds what.' },
    { type: 'p', text: "After a sign-in alert at 02:14 from a country the company has never worked in, the owner has asked you to review who has access to the Azure subscription and how people sign in. Find the risky access, decide the fixes, and then prove you can grant least-privilege access yourself." },
    { type: 'p', text: 'Part one is analysis of the evidence pack here in the portal and is marked automatically. Part two is practical and happens in your own Microsoft Entra tenant and Azure subscription (a free trial is fine, and the identity work in this lab does not need any paid resources). Nothing is hosted for you. Never do this in an employer\'s or a client\'s tenant.' },
    { type: 'note', text: 'Cape Vineyards Trading and everyone named here are fictional. Addresses use the example.test domain.' },
  ],
  evidence: [
    {
      id: 'assignments',
      title: 'Role assignments on the subscription',
      meta: 'table',
      body: [
        { type: 'table', columns: ['Id', 'Principal', 'Type', 'Role', 'Scope'], rows: [
          ['owner-staff', 'nomsa@capevines.example', 'Member user (finance manager)', 'Owner', 'Subscription'],
          ['guest-contrib', 'dev.contractor@mail.example', 'Guest user (outside contractor)', 'Contributor', 'Subscription'],
          ['svc-contrib', 'svc-backup', 'Service principal (backup job)', 'Contributor', 'Subscription'],
          ['helpdesk-uaa', 'helpdesk-group', 'Group (3 people)', 'User Access Administrator', 'Subscription'],
          ['finance-reader', 'finance-group', 'Group (6 people)', 'Reader', 'Resource group rg-finance'],
          ['dev-contrib', 'dev-group', 'Group (4 people)', 'Contributor', 'Resource group rg-dev'],
        ] },
      ],
    },
    {
      id: 'tenant-settings',
      title: 'Tenant sign-in settings',
      meta: 'config',
      body: [
        { type: 'list', items: [
          'Security defaults: off.',
          'Conditional Access: no policies.',
          'Multi-factor authentication: not required for anyone, including administrators.',
          'Legacy authentication protocols (which cannot do multi-factor): allowed.',
          'Emergency access ("break-glass") accounts: none.',
          'Guest invitations: any member or guest can invite other guests.',
          'Privileged Identity Management: not available (the tenant has the free Microsoft Entra ID tier).',
        ] },
      ],
    },
    {
      id: 'signin',
      title: 'The 02:14 alert',
      meta: 'table',
      body: [
        { type: 'table', columns: ['Time (SAST)', 'User', 'App', 'Result', 'Location', 'Authentication'], rows: [
          ['Tue 02:14', 'dev.contractor@mail.example', 'Azure portal', 'Success', 'Country the company has never worked in', 'Single factor (password only)'],
          ['Tue 02:17', 'dev.contractor@mail.example', 'Azure Resource Manager', 'Success', 'Same', 'Single factor (password only)'],
          ['Mon 09:02', 'nomsa@capevines.example', 'Azure portal', 'Success', 'Cape Town', 'Single factor (password only)'],
        ] },
      ],
    },
  ],
  tasks: [
    {
      key: 't1',
      type: 'multi',
      title: 'Whose access is too broad?',
      prompt: 'Select every assignment that is over-privileged or risky.',
      points: 24,
      options: [
        { id: 'owner-staff', label: 'The finance manager is a permanent Owner of the whole subscription' },
        { id: 'guest-contrib', label: 'An outside contractor (a guest) is Contributor on the whole subscription' },
        { id: 'svc-contrib', label: 'The backup service principal is Contributor on the whole subscription' },
        { id: 'helpdesk-uaa', label: 'The help desk group can grant any access on the subscription' },
        { id: 'finance-reader', label: 'The finance group has Reader on rg-finance' },
        { id: 'dev-contrib', label: 'The dev group has Contributor on rg-dev' },
      ],
    },
    {
      key: 't2',
      type: 'match',
      title: 'Match the fix',
      prompt: 'Pick the best fix for each assignment.',
      points: 24,
      items: [
        { id: 'owner-staff', label: 'Permanent Owner for the finance manager' },
        { id: 'guest-contrib', label: 'Guest contractor with Contributor on the subscription' },
        { id: 'svc-contrib', label: 'Backup service principal with Contributor on the subscription' },
        { id: 'helpdesk-uaa', label: 'Help desk with User Access Administrator' },
      ],
      choices: [
        { id: 'fix-owner', label: 'Remove the standing role; grant what the job needs at a lower scope, and make any higher role eligible and time-limited rather than permanent' },
        { id: 'fix-guest', label: 'Remove it; grant a narrow role on only the resource group they work in, for a limited time, with multi-factor authentication required' },
        { id: 'fix-svc', label: 'Give it the least-privileged built-in role it needs (for example a backup role) on only the vault or resource group it uses' },
        { id: 'fix-helpdesk', label: 'Remove it; let the help desk manage group membership through an approval process instead of granting roles' },
        { id: 'fix-rename', label: 'Rename the accounts so attackers cannot find them' },
      ],
    },
    {
      key: 't3',
      type: 'multi',
      title: 'Fix the sign-in settings',
      prompt: 'Which changes to the tenant settings are right? Select all that apply.',
      points: 22,
      options: [
        { id: 'require-mfa', label: 'Require multi-factor authentication for everyone, starting with administrators (security defaults or Conditional Access)' },
        { id: 'block-legacy', label: 'Block legacy authentication' },
        { id: 'break-glass', label: 'Create two emergency access accounts that are excluded from Conditional Access, protected with strong credentials, and monitored' },
        { id: 'restrict-guests', label: 'Limit who can invite guests' },
        { id: 'mfa-off-admins', label: 'Switch multi-factor authentication off for administrators so they never get locked out' },
        { id: 'sms-forever', label: 'Allow password-only sign-in for guests because they are outside the company' },
      ],
    },
    {
      key: 't4',
      type: 'single',
      title: 'The 02:14 sign-in',
      prompt: 'The contractor account signed in at 02:14 from an unexpected country with only a password and then used Azure Resource Manager. What is the right first move?',
      points: 15,
      options: [
        { id: 'contain-first', label: 'Contain: revoke the account\'s sessions, reset or block its sign-in, then review what it did in the activity log' },
        { id: 'email-contractor', label: 'Email the contractor to ask if it was them, and wait for an answer' },
        { id: 'delete-subscription', label: 'Delete the subscription' },
        { id: 'wait-for-morning', label: 'Leave it until the contractor next works with you' },
      ],
    },
    {
      key: 't5',
      type: 'single',
      title: 'Just-in-time admin',
      prompt: 'Which Microsoft Entra feature gives people administrator roles only when they need them, for a limited time, with approval?',
      points: 15,
      options: [
        { id: 'pim', label: 'Privileged Identity Management (which needs a paid Microsoft Entra ID P2 licence)' },
        { id: 'sspr', label: 'Self-service password reset' },
        { id: 'b2b', label: 'B2B guest invitations' },
        { id: 'device-registration', label: 'Device registration' },
      ],
    },
    {
      key: 't6',
      type: 'rubric',
      title: 'Prove it: grant least privilege in your own tenant',
      prompt: `Do this in your own Microsoft Entra tenant and Azure subscription (a free account or trial is fine). Never do it in an employer's or client's tenant. The identity work here does not need paid resources.

1. Create a test user and one empty resource group.
2. Give the test user a narrow role (such as Reader) at the resource group scope only. Do not give anything at the subscription scope.
3. List the assignments to prove it, either with the Azure CLI (for example az role assignment list --resource-group yourgroup --output table) or with a screenshot link of the Access control (IAM) page showing the assignment and the scope.
4. Show that you have turned on multi-factor authentication for yourself or enabled security defaults in your own tenant (a screenshot link of the setting is fine).
5. Clean up: remove the assignment and delete the test user and resource group, and show it.

Submit: the commands or screenshot links, the assignment listing, evidence of the MFA or security defaults setting, evidence of the clean-up, and 80 to 120 words on why you chose that role and scope.`,
      placeholder: 'Commands or screenshot links:\n\nAssignment listing:\n\nMFA or security defaults evidence:\n\nClean-up evidence:\n\nWhy this role and scope:',
      points: 0,
    },
  ],
};
