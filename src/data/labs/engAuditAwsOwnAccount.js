// Hub Lab content only. Rules, model answers and rubric live in
// public.lab_answer_keys (supabase/099_labs.sql). Task keys must match.
// Unlike the other engineering labs, the work happens in the member's own
// free AWS account and the member pastes the output of a read-only command.

export default {
  slug: 'eng-audit-aws-own-account',
  organisation: 'Your own AWS account',
  brief: [
    { type: 'p', text: 'In this lab you audit and fix a storage bucket in your own free AWS account. You create a throwaway bucket, check its public access settings with one read-only command, fix the gaps, and paste the command\'s output so the portal can check it.' },
    { type: 'p', text: 'Nobody gets access to your account. The portal only reads the text you paste, so remove anything that identifies you before you paste it, such as your 12-digit account ID.' },
    { type: 'note', text: 'Use only an account you own, and a bucket you create for this lab. Delete the bucket when you finish so nothing is left running. Press Check my work as often as you like (30 checks a day for each task), and submit once every check passes.' },
  ],
  evidence: [
    {
      id: 'setup',
      title: 'Setup steps',
      meta: 'list',
      body: [
        { type: 'list', items: [
          'Sign in to the AWS console with your own free-tier account and open CloudShell, or use the AWS CLI on your computer.',
          'Create a bucket with a unique name, for example hh-audit-yourname-2026, in the Cape Town (af-south-1) region. Leave everything else on its defaults.',
          'Run the audit command in Task 1, read the output, then turn on every public access block setting and run it again.',
          'Run the encryption command in Task 2. Enable default encryption if the command shows none, and run it again.',
          'Delete the bucket when you are done.',
        ] },
      ],
    },
    {
      id: 'reading',
      title: 'Reading the output',
      meta: 'note',
      body: [
        { type: 'p', text: 'The public access command returns four settings. Each one blocks a different way a bucket can become public: through ACLs, through bucket policies, or both when they are ignored or restricted. A safe bucket has all four set to true.' },
        { type: 'p', text: 'The encryption command returns the default server-side encryption rule. S3 now encrypts new objects by default, but the audit is about knowing it and being able to show it.' },
        { type: 'note', text: 'Remove your account ID before pasting. It is the 12-digit number that appears in ARNs. A paste that contains one fails the check on purpose.' },
      ],
    },
  ],
  tasks: [
    {
      key: 't1',
      type: 'single',
      title: 'What is it checking?',
      prompt: 'What does it mean when BlockPublicPolicy is false on a bucket?',
      points: 10,
      options: [
        { id: 'policy', label: 'A bucket policy that makes the bucket public would be accepted.' },
        { id: 'acl', label: 'Public ACLs on objects would be ignored.' },
        { id: 'enc', label: 'Objects are stored without encryption.' },
        { id: 'region', label: 'The bucket is not in your home region.' },
      ],
    },
    {
      key: 't2',
      type: 'output',
      title: 'Public access after your fix',
      prompt: 'Turn on all four public access block settings for your bucket, then paste the output of the command below.',
      points: 50,
      commands: ['aws s3api get-public-access-block --bucket YOUR-BUCKET-NAME'],
      placeholder: 'Paste the command output here (remove your account ID first)',
    },
    {
      key: 't3',
      type: 'output',
      title: 'Default encryption',
      prompt: 'Make sure your bucket has default encryption, then paste the output of the command below.',
      points: 25,
      commands: ['aws s3api get-bucket-encryption --bucket YOUR-BUCKET-NAME'],
      placeholder: 'Paste the command output here (remove your account ID first)',
    },
    {
      key: 't4',
      type: 'rubric',
      title: 'What you found',
      prompt: 'In a few sentences, say what the first run of the command showed, what you changed, and how you would check this across a hundred buckets rather than one.',
      points: 0,
      placeholder: 'The first run showed...',
    },
  ],
};
