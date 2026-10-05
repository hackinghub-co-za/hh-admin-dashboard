// Hub Lab content only - prompts and options. Correct answers, model
// answers and rubrics live in public.lab_answer_keys (supabase/099_labs.sql)
// and never ship in the bundle. Option/item/choice ids here must match
// the answer keys there.

export default {
  slug: 'azure-activity-hunt-drakensberg-telecom',
  organisation: 'Drakensberg Telecom',
  brief: [
    { type: 'p', text: 'Drakensberg Telecom runs its billing platform in Azure. At 06:30 on Tuesday the finance team noticed a virtual machine nobody recognised, named vm-miner01, and the monthly cost forecast had jumped.' },
    { type: 'p', text: 'You are the analyst on call. The Azure activity log (the record of control-plane operations such as creating a VM or changing a role) is sent to a Log Analytics workspace. You have an extract of it. Work out what happened in order, decide what to do now, pick the right queries, and then run real queries yourself.' },
    { type: 'p', text: 'Part one is analysis of the evidence pack here in the portal and is marked automatically. Part two is practical: you run Kusto Query Language (KQL) queries in a free demo workspace and submit proof. Nothing is hosted for you.' },
    { type: 'note', text: 'Drakensberg Telecom is fictional. Addresses use documentation ranges, and the extract is simplified; real tables have more columns.' },
  ],
  evidence: [
    {
      id: 'activity',
      title: 'Activity log extract (AzureActivity)',
      meta: 'table',
      body: [
        { type: 'table', columns: ['Id', 'Time (UTC)', 'Caller', 'Caller IP', 'Operation', 'Status', 'Resource'], rows: [
          ['e1', 'Mon 08:55', 'anna@drakensberg.example', '41.0.0.10', 'Microsoft.Compute/virtualMachines/start/action', 'Succeeded', 'vm-billing01'],
          ['e2', 'Mon 09:20', 'thabo@drakensberg.example', '41.0.0.22', 'Microsoft.Storage/storageAccounts/write', 'Succeeded', 'stbillingarchive'],
          ['e3', 'Tue 02:11', 'svc-deploy@drakensberg.example', '185.0.2.14', 'Microsoft.Authorization/roleAssignments/write', 'Succeeded', 'rg-prod'],
          ['e4', 'Tue 02:14', 'svc-deploy@drakensberg.example', '185.0.2.14', 'Microsoft.Storage/storageAccounts/listKeys/action', 'Succeeded', 'stbillingarchive'],
          ['e5', 'Tue 02:16', 'svc-deploy@drakensberg.example', '185.0.2.14', 'Microsoft.Insights/diagnosticSettings/delete', 'Succeeded', 'ds-send-to-workspace'],
          ['e6', 'Tue 02:18', 'svc-deploy@drakensberg.example', '185.0.2.14', 'Microsoft.Compute/virtualMachines/write', 'Succeeded', 'vm-miner01'],
          ['e7', 'Tue 02:20', 'svc-deploy@drakensberg.example', '185.0.2.14', 'Microsoft.Network/networkSecurityGroups/securityRules/write', 'Succeeded', 'nsg-vm-miner01'],
        ] },
        { type: 'note', text: 'svc-deploy is a service account used by the deployment pipeline. Its normal activity comes from the pipeline\'s fixed address range, 41.0.0.0/24, during working hours.' },
      ],
    },
    {
      id: 'queries',
      title: 'Four candidate queries',
      meta: 'code',
      body: [
        { type: 'code', title: 'Query A', text: `AzureActivity
| where TimeGenerated > ago(24h)
| summarize count() by Caller
| sort by count_ desc` },
        { type: 'code', title: 'Query B', text: `SELECT Caller, COUNT(*)
FROM AzureActivity
GROUP BY Caller` },
        { type: 'code', title: 'Query C', text: `AzureActivity
| filter TimeGenerated > ago(24h)
| count by Caller` },
        { type: 'code', title: 'Query D', text: `AzureActivity
| where TimeGenerated > ago(24h)
| project Caller
| distinct Caller` },
        { type: 'note', text: 'KQL reads left to right: a table name, then steps joined with the pipe character. where filters rows, summarize aggregates, project picks columns, sort by orders rows. count() names its output column count_.' },
      ],
    },
  ],
  tasks: [
    {
      key: 't1',
      type: 'match',
      title: 'What was the attacker doing?',
      prompt: 'Match each event to what the person behind svc-deploy was doing.',
      points: 30,
      items: [
        { id: 'e3', label: 'e3: roleAssignments/write on rg-prod' },
        { id: 'e4', label: 'e4: storageAccounts/listKeys/action on stbillingarchive' },
        { id: 'e5', label: 'e5: diagnosticSettings/delete' },
        { id: 'e6', label: 'e6: virtualMachines/write creating vm-miner01' },
        { id: 'e7', label: 'e7: securityRules/write on nsg-vm-miner01' },
      ],
      choices: [
        { id: 'grant-access', label: 'Giving themselves (or another identity) more access' },
        { id: 'collect-creds', label: 'Collecting the keys that open the storage data directly' },
        { id: 'hide-tracks', label: 'Hiding their tracks by turning logging off' },
        { id: 'abuse-compute', label: 'Using your cloud for their own purposes, such as crypto mining' },
        { id: 'open-paths', label: 'Opening network paths in' },
        { id: 'normal-work', label: 'Ordinary day-to-day administration' },
      ],
    },
    {
      key: 't2',
      type: 'single',
      title: 'Pick the query',
      prompt: 'You want to know how many operations each caller performed in the last 24 hours, busiest first. Which query does that correctly?',
      points: 14,
      options: [
        { id: 'q-a', label: 'Query A' },
        { id: 'q-b', label: 'Query B' },
        { id: 'q-c', label: 'Query C' },
        { id: 'q-d', label: 'Query D' },
      ],
    },
    {
      key: 't3',
      type: 'multi',
      title: 'Contain it',
      prompt: 'Select every sensible immediate response.',
      points: 24,
      options: [
        { id: 'revoke-svc', label: 'Rotate or disable svc-deploy\'s credentials and revoke its sessions' },
        { id: 'remove-role', label: 'Remove the unexpected role assignment and delete vm-miner01' },
        { id: 'restore-logging', label: 'Turn the diagnostic setting back on, and export the logs you already have before anything else changes' },
        { id: 'rotate-storage-keys', label: 'Rotate the storage account keys that were listed' },
        { id: 'delete-rg', label: 'Delete the whole rg-prod resource group straight away' },
        { id: 'ignore', label: 'Take no action, since every operation shows Succeeded and nothing has been reported as lost' },
      ],
    },
    {
      key: 't4',
      type: 'single',
      title: 'Why does e5 matter so much?',
      prompt: 'Why is the deletion of the diagnostic setting at 02:16 particularly significant?',
      points: 12,
      options: [
        { id: 'blind-spot', label: 'It stops logs flowing to the workspace, so later activity becomes invisible to your queries and alerts; any deletion of one should itself raise an alert' },
        { id: 'costs', label: 'It increases the monthly bill' },
        { id: 'slow', label: 'It makes the VM start slowly' },
        { id: 'nothing', label: 'It does not matter, because the log is only for compliance' },
      ],
    },
    {
      key: 't5',
      type: 'multi',
      title: 'Detections worth building',
      prompt: 'Which alerts would have caught this earlier? Select all that apply.',
      points: 20,
      options: [
        { id: 'role-new-ip', label: 'A role assignment written by an identity from an address outside its usual range' },
        { id: 'diag-delete', label: 'Any deletion of a diagnostic setting' },
        { id: 'vm-outside-window', label: 'A new virtual machine created outside the normal change window, or by a pipeline identity from an unexpected address' },
        { id: 'every-success', label: 'An alert for every successful operation' },
        { id: 'weekday-logins', label: 'An alert whenever someone signs in on a weekday' },
      ],
    },
    {
      key: 't6',
      type: 'rubric',
      title: 'Prove it: run real KQL in the free demo workspace',
      prompt: `Do this on your own, using Microsoft's free Log Analytics demo environment at https://aka.ms/lademo. Sign in with a Microsoft account; it does not need an Azure subscription. Nothing is hosted by Hacking Hub. If the demo is not available to you, say so and write your queries against the sample rows in the evidence pack, explaining what each would return.

1. Open the demo workspace and look at the tables available. Name the table you chose to work with, and why.
2. Run at least three queries. Include one that counts events by a column (summarize count() by something), one that filters by time with ago(), and one that shows activity over time (summarize ... by bin(TimeGenerated, 1h) and render timechart).
3. For each query, paste the query and a short description of what the result showed (the number of rows, the top entry or a screenshot link).
4. Write 100 to 150 words on a detection rule you would build from what you found, what it would alert on, and what false positives to expect.

Submit: the table you used, your queries and their results, and your short detection write-up. Do not paste anything that looks like real personal data from the demo workspace.`,
      placeholder: 'Table used and why:\n\nQuery 1 and result:\n\nQuery 2 and result:\n\nQuery 3 and result:\n\nDetection rule idea:',
      points: 0,
    },
  ],
};
