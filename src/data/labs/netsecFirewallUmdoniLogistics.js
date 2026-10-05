// Hub Lab content only - prompts and options. Correct answers, model
// answers and rubrics live in public.lab_answer_keys (supabase/099_labs.sql)
// and never ship in the bundle. Option/item/choice ids here must match
// the answer keys there.

export default {
  slug: 'netsec-firewall-umdoni-logistics',
  organisation: 'Umdoni Logistics',
  brief: [
    { type: 'p', text: 'Umdoni Logistics runs a depot in Durban with about 40 staff, a small finance team and a public website. Its firewall was set up by a vendor two years ago and has been added to ever since.' },
    { type: 'p', text: "After a scare with a stranger scanning the office from the internet, the operations manager wants the rulebase reviewed. You have the full ruleset. Find what is wrong, decide what happens to each rule, and show you can write a safer one." },
    { type: 'p', text: 'Part one is analysis of the evidence pack here in the portal and is marked automatically. Part two is practical: you build and test a small firewall on your own computer and submit proof. Nothing is hosted for you.' },
    { type: 'note', text: 'Umdoni Logistics is fictional. Addresses are private example ranges.' },
  ],
  evidence: [
    {
      id: 'rules',
      title: 'The firewall ruleset, in order',
      meta: 'table',
      body: [
        { type: 'p', text: 'The firewall reads rules from the top and applies the first one that matches. Rules below a match are never reached for that traffic.' },
        { type: 'table', columns: ['#', 'Source', 'Destination', 'Service', 'Action', 'Logged', 'Comment'], rows: [
          ['1', 'Any', 'Any', 'Any', 'Allow', 'No', 'Temporary, for go-live (vendor, 2022)'],
          ['2', 'Internet', 'Web server 10.1.10.20', 'HTTPS (443)', 'Allow', 'Yes', 'Public website'],
          ['3', 'Internet', 'Finance PC 10.1.30.15', 'RDP (3389)', 'Allow', 'No', 'So the finance lead can work from home'],
          ['4', 'Staff LAN 10.1.20.0/24', 'Internet', 'HTTP, HTTPS', 'Allow', 'Yes', 'Staff browsing'],
          ['5', 'Any', 'Printer VLAN 10.1.40.0/24', 'Any', 'Allow', 'No', 'Printing'],
          ['6', 'Guest Wi-Fi 10.1.50.0/24', 'Staff LAN 10.1.20.0/24', 'Any', 'Allow', 'No', 'Guests print from the staff printer'],
          ['7', 'Any', 'Any', 'Telnet (23)', 'Deny', 'Yes', 'Added after an audit'],
          ['8', 'Any', 'Any', 'Any', 'Deny', 'Yes', 'Default deny'],
        ] },
      ],
    },
    {
      id: 'notes',
      title: 'Notes from the depot',
      meta: 'interviews',
      body: [
        { type: 'quote', text: 'The finance PC holds the payroll and the bank profile. The finance lead logs in from home most evenings. (Operations manager)' },
        { type: 'quote', text: "The firewall log shows thousands of failed Remote Desktop logins from addresses we don't recognise, every night. (IT support)" },
        { type: 'quote', text: 'Nobody remembers who asked for rule 5 or rule 6. (IT support)' },
      ],
    },
    {
      id: 'ref',
      title: 'Rulebase practice, in brief',
      meta: 'summary',
      body: [
        { type: 'list', items: [
          'Order matters: put specific rules first and the explicit deny-all last, and log the denies.',
          'Every rule needs an owner and a reason, and ideally an expiry date for anything temporary.',
          'Remote Desktop should never be exposed directly to the internet. Put it behind a VPN or zero-trust gateway with multi-factor authentication.',
          'Guest networks should reach the internet and nothing internal.',
          'Prefer named objects (such as FinancePC) to raw addresses so rules stay readable as the network changes.',
        ] },
      ],
    },
  ],
  tasks: [
    {
      key: 't1',
      type: 'single',
      title: 'The rule that cancels the rest',
      prompt: 'One rule means most of the rules below it never take effect. Which one, and why?',
      points: 12,
      options: [
        { id: 'rule-1', label: 'Rule 1: an Any/Any/Any allow at the top matches everything first, so the denies below it are never reached' },
        { id: 'rule-8', label: 'Rule 8: the default deny blocks everything above it' },
        { id: 'rule-4', label: 'Rule 4: staff browsing overrides all other rules' },
        { id: 'rule-7', label: 'Rule 7: the Telnet deny cancels the web server rule' },
      ],
    },
    {
      key: 't2',
      type: 'match',
      title: 'Decide each rule',
      prompt: 'For each rule, pick what should happen to it.',
      points: 30,
      items: [
        { id: 'r1', label: 'Rule 1: Any, Any, Any, Allow' },
        { id: 'r2', label: 'Rule 2: Internet to the web server on HTTPS' },
        { id: 'r3', label: 'Rule 3: Internet to the finance PC on RDP' },
        { id: 'r4', label: 'Rule 4: Staff LAN to the internet on HTTP and HTTPS' },
        { id: 'r5', label: 'Rule 5: Any to the printer VLAN, any service' },
        { id: 'r6', label: 'Rule 6: Guest Wi-Fi to the staff LAN, any service' },
      ],
      choices: [
        { id: 'keep', label: 'Keep, with logging' },
        { id: 'remove', label: 'Remove' },
        { id: 'restrict', label: 'Restrict to what is needed' },
        { id: 'vpn', label: 'Replace with remote access through a VPN with multi-factor authentication' },
      ],
    },
    {
      key: 't3',
      type: 'risk_score',
      title: 'Score it: RDP from the internet',
      prompt: 'Risk: Remote Desktop on the finance PC is reachable from anywhere on the internet. Thousands of failed logins arrive every night. The PC holds payroll and the bank profile. Score the risk.',
      points: 12,
    },
    {
      key: 't4',
      type: 'multi',
      title: 'A better rulebase',
      prompt: 'Which of these belong in the cleaned-up ruleset and its upkeep? Select all that apply.',
      points: 22,
      options: [
        { id: 'deny-last-logged', label: 'An explicit deny-all as the last rule, with logging' },
        { id: 'owner-expiry', label: 'An owner, a reason and a review date on every rule, and an expiry on temporary ones' },
        { id: 'log-exposed', label: 'Logging on every rule that exposes an internal server' },
        { id: 'named-objects', label: 'Named objects such as FinancePC instead of raw addresses' },
        { id: 'temp-any', label: 'A temporary Any/Any rule for emergencies, kept at the top' },
        { id: 'logging-off', label: 'Switching logging off to save disk space' },
      ],
    },
    {
      key: 't5',
      type: 'single',
      title: 'Remote access for finance',
      prompt: 'The finance lead really does need to work from home. What is the best way to allow it?',
      points: 24,
      options: [
        { id: 'vpn-mfa', label: 'A VPN or zero-trust gateway with multi-factor authentication, then RDP across the internal network' },
        { id: 'change-port', label: 'Move RDP to port 3390 so scanners miss it' },
        { id: 'hours-only', label: 'Allow the open RDP rule only between 18:00 and 22:00' },
        { id: 'disable-fw', label: 'Turn off the Windows firewall on the finance PC so it connects reliably' },
      ],
    },
    {
      key: 't6',
      type: 'rubric',
      title: 'Prove it: build and test your own firewall',
      prompt: `Do this on your own computer. Nothing is hosted for you.

Build a small firewall for a pretend server and prove it blocks what it should. You can use nftables, iptables or ufw on a Linux machine or WSL, or a firewall in a virtual machine. One simple setup is two containers on one Docker network, where one runs the firewall rules and some listening services and the other scans it, but any setup is fine.

1. Run three services on the server: 443, 22 and 3389 (they can be simple listeners).
2. Before: scan it from a second machine or container (for example nmap -Pn -p 22,443,3389 server) and record that all three are open.
3. Write your rules. Default drop, allow 443 only, allow established connections, and log the drops.
4. After: scan again and show only 443 is reachable.

Submit: your ruleset, the before and after scan output, and a short explanation of why each rule is there and how you would add an exception for a VPN address safely.`,
      placeholder: 'Setup used:\n\nBefore scan:\n\nRuleset:\n\nAfter scan:\n\nWhy each rule, and how to allow a VPN address:',
      points: 0,
    },
  ],
};
