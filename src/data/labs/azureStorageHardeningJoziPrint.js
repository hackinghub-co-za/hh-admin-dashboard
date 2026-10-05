// Hub Lab content only - prompts and options. Correct answers, model
// answers and rubrics live in public.lab_answer_keys (supabase/099_labs.sql)
// and never ship in the bundle. Option/item/choice ids here must match
// the answer keys there.

export default {
  slug: 'azure-storage-hardening-jozi-print',
  organisation: 'Jozi Print Works',
  brief: [
    { type: 'p', text: 'Jozi Print Works takes artwork and orders from customers online. The files land in an Azure storage account, and a small virtual machine processes them. A developer set everything up quickly last year using the defaults they knew from older tutorials.' },
    { type: 'p', text: "A customer's auditor asked for a configuration review. You have the storage account's settings, the network security group rules for the virtual machine, and a list of what Microsoft Defender for Cloud is flagging. Work out what is exposed, fix it on paper, and then prove you can harden a storage account in your own subscription." },
    { type: 'p', text: 'Part one is analysis of the evidence pack here in the portal and is marked automatically. Part two is practical, in your own Azure subscription (a free trial works): you create a small storage account in one resource group, harden it, show before and after, and delete it. Nothing is hosted for you. Set a budget alert first and delete everything when you finish.' },
    { type: 'note', text: 'Jozi Print Works is fictional. The settings are an excerpt in the style of az storage account show; property names and the recommendations list are paraphrased and can differ by version.' },
  ],
  evidence: [
    {
      id: 'storage',
      title: 'Storage account jozprintdata (excerpt)',
      meta: 'code',
      body: [
        { type: 'code', title: 'az storage account show', text: `{
  "name": "jozprintdata",
  "sku": { "name": "Standard_LRS" },
  "allowBlobPublicAccess": true,
  "minimumTlsVersion": "TLS1_0",
  "enableHttpsTrafficOnly": false,
  "allowSharedKeyAccess": true,
  "networkRuleSet": { "defaultAction": "Allow", "ipRules": [], "virtualNetworkRules": [] },
  "encryption": {
    "keySource": "Microsoft.Storage",
    "services": { "blob": { "enabled": true }, "file": { "enabled": true } }
  }
}` },
        { type: 'note', text: 'Customer artwork is in a container called "uploads". Some customers share links to their files with each other.' },
      ],
    },
    {
      id: 'nsg',
      title: 'Network security group on the processing VM',
      meta: 'table',
      body: [
        { type: 'table', columns: ['Id', 'Priority', 'Name', 'Source', 'Port', 'Action'], rows: [
          ['n-rdp', '100', 'allow-rdp-any', 'Any (internet)', '3389', 'Allow'],
          ['n-https', '110', 'allow-https', 'Any (internet)', '443', 'Allow'],
          ['n-sql', '120', 'allow-sql-any', 'Any (internet)', '1433', 'Allow'],
          ['n-vnet', '65000', 'AllowVnetInBound', 'Virtual network', 'Any', 'Allow'],
          ['n-deny', '65500', 'DenyAllInBound', 'Any', 'Any', 'Deny'],
        ] },
        { type: 'note', text: 'The VM serves a customer upload page on HTTPS (443). It also runs a small SQL Server for job tracking that only the VM itself uses. Staff remote in to manage it.' },
      ],
    },
    {
      id: 'defender',
      title: 'What Defender for Cloud is flagging',
      meta: 'list',
      body: [
        { type: 'list', items: [
          'Storage account public access should be disallowed.',
          'Secure transfer to storage accounts should be enabled.',
          'Storage accounts should restrict network access.',
          'Management ports of virtual machines should be protected with just-in-time network access control.',
          'Secure score: 31%.',
        ] },
      ],
    },
  ],
  tasks: [
    {
      key: 't1',
      type: 'multi',
      title: 'Which storage settings are a problem?',
      prompt: 'Select every setting in the storage excerpt that is a security problem.',
      points: 24,
      options: [
        { id: 's-public', label: 'allowBlobPublicAccess is true' },
        { id: 's-tls', label: 'minimumTlsVersion is TLS1_0' },
        { id: 's-https', label: 'enableHttpsTrafficOnly is false' },
        { id: 's-network', label: 'The network rules default action is Allow' },
        { id: 's-sharedkey', label: 'allowSharedKeyAccess is true' },
        { id: 's-encryption', label: 'Encryption is enabled for blob and file services' },
        { id: 's-sku', label: 'The redundancy option is Standard_LRS' },
      ],
    },
    {
      key: 't2',
      type: 'match',
      title: 'Target values',
      prompt: 'Match each setting to the value you want.',
      points: 25,
      items: [
        { id: 'allowBlobPublicAccess', label: 'allowBlobPublicAccess' },
        { id: 'minimumTlsVersion', label: 'minimumTlsVersion' },
        { id: 'enableHttpsTrafficOnly', label: 'enableHttpsTrafficOnly' },
        { id: 'defaultAction', label: 'networkRuleSet.defaultAction' },
        { id: 'allowSharedKeyAccess', label: 'allowSharedKeyAccess' },
      ],
      choices: [
        { id: 'v-false', label: 'false' },
        { id: 'v-true', label: 'true' },
        { id: 'v-tls12', label: 'TLS1_2' },
        { id: 'v-tls10', label: 'TLS1_0' },
        { id: 'v-deny', label: 'Deny, with only the VNets or addresses that need access (or a private endpoint)' },
      ],
    },
    {
      key: 't3',
      type: 'multi',
      title: 'Which NSG rules are a problem?',
      prompt: 'Given what the VM does, which rules should not exist as written? Select all that apply.',
      points: 18,
      options: [
        { id: 'n-rdp', label: 'allow-rdp-any: Remote Desktop from the whole internet' },
        { id: 'n-sql', label: 'allow-sql-any: SQL Server from the whole internet' },
        { id: 'n-https', label: 'allow-https: HTTPS from the internet to the upload page' },
        { id: 'n-deny', label: 'DenyAllInBound at the lowest priority' },
      ],
    },
    {
      key: 't4',
      type: 'single',
      title: 'Managing the VM without exposing RDP',
      prompt: 'Staff need to manage the VM. What is the best way to do it without leaving port 3389 open to the internet?',
      points: 17,
      options: [
        { id: 'bastion-jit', label: 'Use Azure Bastion, or just-in-time VM access that opens the port for your address for a limited time, and remove the open rule' },
        { id: 'new-port', label: 'Move RDP to a different port' },
        { id: 'strong-pw', label: 'Keep the rule and use a longer password' },
        { id: 'disable-nsg', label: 'Remove the network security group entirely' },
      ],
    },
    {
      key: 't5',
      type: 'single',
      title: 'Which service gives the secure score?',
      prompt: 'Which Azure service continuously assesses your resources and gives a secure score with recommendations?',
      points: 16,
      options: [
        { id: 'defender-cloud', label: 'Microsoft Defender for Cloud' },
        { id: 'cost-management', label: 'Cost Management' },
        { id: 'service-health', label: 'Service Health' },
        { id: 'advisor-cost', label: 'Azure Pricing Calculator' },
      ],
    },
    {
      key: 't6',
      type: 'rubric',
      title: 'Prove it: harden a storage account in your own subscription',
      prompt: `Do this in your own Azure subscription (a free trial works). Cost should be close to nothing, but set a budget alert first, create everything in ONE resource group, and delete the group when you finish. Nothing is hosted for you. Never do this in an employer's or client's subscription.

1. Create a resource group and a small storage account with a Standard_LRS SKU.
2. Capture its settings before you change anything, for example az storage account show --name yourname --resource-group yourgroup, trimmed to the security settings from the evidence pack.
3. Harden it: disable blob public access, require TLS 1.2, require HTTPS only, disable shared key access if you can authenticate with Microsoft Entra, set the network default action to Deny and allow only your own address, and turn on blob soft delete.
4. Capture the settings again and show the changes.
5. If Defender for Cloud shows the account, add a screenshot link of its recommendations. Then delete the resource group and show it is gone.

Submit: the before and after settings, the commands you used, the clean-up evidence and your budget alert, and 80 to 120 words on which setting you think matters most for a printing company and why.`,
      placeholder: 'Before settings:\n\nCommands used:\n\nAfter settings:\n\nDefender screenshot link (optional):\n\nClean-up and budget alert evidence:\n\nWhich setting matters most, and why:',
      points: 0,
    },
  ],
};
