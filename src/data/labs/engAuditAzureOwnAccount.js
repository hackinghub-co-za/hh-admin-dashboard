// Hub Lab content only. Rules, model answers and rubric live in
// public.lab_answer_keys (supabase/099_labs.sql). Task keys must match.
// The work happens in the member's own free Azure account and the member
// pastes the output of a read-only command.

export default {
  slug: 'eng-audit-azure-own-account',
  organisation: 'Your own Azure account',
  brief: [
    { type: 'p', text: 'In this lab you audit and fix a storage account in your own free Azure account. You create a throwaway storage account, check its security settings with one read-only command, fix the gaps, and paste the command\'s output so the portal can check it.' },
    { type: 'p', text: 'Nobody gets access to your account. The portal only reads the text you paste, so remove anything that identifies you before you paste it, such as a subscription ID.' },
    { type: 'note', text: 'Use only an account you own, and a storage account you create for this lab. Delete it when you finish so nothing keeps running. Press Check my work as often as you like (30 checks a day for each task), and submit once every check passes.' },
  ],
  evidence: [
    {
      id: 'setup',
      title: 'Setup steps',
      meta: 'list',
      body: [
        { type: 'list', items: [
          'Sign in to the Azure portal with your own free account and open Cloud Shell, or use the Azure CLI on your computer.',
          'Create a resource group and a storage account with a unique name in South Africa North. Leave everything else on its defaults.',
          'Run the audit command in Task 1, read the output, then switch anonymous blob access off, require HTTPS and set the minimum TLS version to 1.2, and run it again.',
          'Run the network command in Task 2, set the default network rule to deny, and run it again.',
          'Delete the resource group when you are done.',
        ] },
      ],
    },
    {
      id: 'reading',
      title: 'Reading the output',
      meta: 'note',
      body: [
        { type: 'p', text: 'The audit command is written to return just three fields: whether blobs may be made public, whether only HTTPS is accepted, and the minimum TLS version. A safe account returns publicAccess false, httpsOnly true and minTls TLS1_2.' },
        { type: 'p', text: 'The network command shows what the storage firewall does with traffic that matches no rule. For a private account that must be Deny.' },
        { type: 'note', text: 'Remove any subscription ID before pasting. It is the long number with dashes that appears in resource IDs. A paste that contains one fails the check on purpose.' },
      ],
    },
  ],
  tasks: [
    {
      key: 't1',
      type: 'single',
      title: 'What is it checking?',
      prompt: 'What does publicAccess: true mean in the audit output?',
      points: 10,
      options: [
        { id: 'anon', label: 'Containers in the account can be set up so anyone can read their blobs without signing in.' },
        { id: 'tls', label: 'The account only accepts old TLS versions.' },
        { id: 'region', label: 'The account is in a public Azure region.' },
        { id: 'sas', label: 'The account has a shared access signature in use.' },
      ],
    },
    {
      key: 't2',
      type: 'output',
      title: 'Account settings after your fix',
      prompt: 'Make the account private, HTTPS-only and TLS 1.2 or newer, then paste the output of the command below.',
      points: 50,
      commands: ['az storage account show -n YOUR-ACCOUNT -g YOUR-GROUP --query "{publicAccess:allowBlobPublicAccess, httpsOnly:enableHttpsTrafficOnly, minTls:minimumTlsVersion}"'],
      placeholder: 'Paste the command output here (remove any subscription ID first)',
    },
    {
      key: 't3',
      type: 'output',
      title: 'Storage firewall',
      prompt: 'Set the default network rule to deny, then paste the output of the command below.',
      points: 25,
      commands: ['az storage account show -n YOUR-ACCOUNT -g YOUR-GROUP --query "networkRuleSet.defaultAction"'],
      placeholder: 'Paste the command output here (remove any subscription ID first)',
    },
    {
      key: 't4',
      type: 'rubric',
      title: 'What you found',
      prompt: 'In a few sentences, say what the first run of the command showed, what you changed, and how you would check this across a hundred storage accounts rather than one.',
      points: 0,
      placeholder: 'The first run showed...',
    },
  ],
};
