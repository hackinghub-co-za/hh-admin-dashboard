// Hub Lab content only. Rules, model fix and rubric live in
// public.lab_answer_keys (supabase/099_labs.sql). Task keys must match.

export default {
  slug: 'eng-iam-aws-sibusiso-reports',
  organisation: 'Sibusiso Analytics',
  brief: [
    { type: 'p', text: 'Sibusiso Analytics is a Johannesburg data firm. A nightly job reads finished reports from one S3 bucket and emails them to clients. A developer gave the job\'s IAM role a policy that "just works", and the policy has been copied to three other roles since.' },
    { type: 'p', text: 'You are asked to replace it with a least-privilege policy: only what the job needs, on only the bucket it needs.' },
    { type: 'note', text: 'Sibusiso Analytics is fictional. Edit the policy in the task box, press Check my work as often as you like (30 checks a day for each task), and submit once every check passes.' },
  ],
  evidence: [
    {
      id: 'needs',
      title: 'What the job actually does',
      meta: 'table',
      body: [
        { type: 'table', columns: ['Step', 'AWS action needed'], rows: [
          ['Lists the finished reports', 's3:ListBucket on the bucket sibusiso-client-reports'],
          ['Downloads each report', 's3:GetObject on the objects in sibusiso-client-reports'],
          ['Anything else', 'Nothing. It never writes, deletes, creates users or touches other services.'],
        ] },
        { type: 'note', text: 'The bucket is named sibusiso-client-reports. Listing applies to the bucket itself, and downloading applies to the objects inside it, so the two actions use two different resource addresses.' },
      ],
    },
    {
      id: 'principles',
      title: 'Policy review checklist',
      meta: 'list',
      body: [
        { type: 'list', items: [
          'No action wildcards such as s3:* or *.',
          'No resource wildcard that covers every bucket.',
          'No administrator actions such as iam:*.',
          'No write or delete actions for a job that only reads.',
          'The policy still has to work for the job.',
        ] },
      ],
    },
  ],
  tasks: [
    {
      key: 't1',
      type: 'single',
      title: 'Why this matters',
      prompt: 'The old policy allows s3:* and iam:* on every resource. What is the worst realistic outcome if the job\'s credentials leak?',
      points: 10,
      options: [
        { id: 'takeover', label: 'An attacker could read or delete any bucket and create new administrator users, taking over the account.' },
        { id: 'slow', label: 'The nightly job would run a little slower.' },
        { id: 'bill', label: 'The AWS bill would show an extra line.' },
        { id: 'nothing', label: 'Nothing, because the credentials only work from inside the firm.' },
      ],
    },
    {
      key: 't2',
      type: 'artifact',
      title: 'Rewrite the policy',
      prompt: 'Replace the policy with a least-privilege one that lets the job list and download reports from sibusiso-client-reports and nothing else. Keep it valid JSON. Then press Check my work.',
      points: 80,
      placeholder: 'policy.json',
      starters: [
        {
          label: 'Version A',
          text: `{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:*", "iam:*"],
      "Resource": "*"
    }
  ]
}
`,
        },
        {
          label: 'Version B',
          text: `{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ReportJob",
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:ListBucket",
        "iam:CreateUser"
      ],
      "Resource": ["*"]
    }
  ]
}
`,
        },
      ],
    },
    {
      key: 't3',
      type: 'rubric',
      title: 'Explain your fix',
      prompt: 'In a few sentences, explain why you chose each action and each resource address, and how you would check the job still works.',
      points: 0,
      placeholder: 'I chose...',
    },
  ],
};
