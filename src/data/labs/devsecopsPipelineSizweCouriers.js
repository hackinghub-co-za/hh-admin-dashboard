// Hub Lab content only - prompts and options. Correct answers, model
// answers and rubrics live in public.lab_answer_keys (supabase/099_labs.sql)
// and never ship in the bundle. Option/item/choice ids here must match
// the answer keys there.

export default {
  slug: 'devsecops-pipeline-sizwe-couriers',
  organisation: 'Sizwe Couriers',
  brief: [
    { type: 'p', text: 'Sizwe Couriers is a parcel-delivery start-up with 12 developers. Everything ships through one GitHub Actions workflow that builds the API and deploys it to production.' },
    { type: 'p', text: "Last week a contractor's pull request was merged, and afterwards the production deploy key turned up in a public build log. The CTO has asked you to review the workflow file, say what is wrong with it, and show that you can fix it." },
    { type: 'p', text: 'Part one is analysis of the evidence pack here in the portal and is marked automatically. Part two is practical: you do the work on your own computer, and submit proof for a reviewer. Nothing is hosted for you, and you only ever use fake secrets.' },
    { type: 'note', text: 'Sizwe Couriers and everyone named here are fictional. The workflow is a teaching example built to contain mistakes.' },
  ],
  evidence: [
    {
      id: 'workflow',
      title: 'The workflow: .github/workflows/deploy.yml',
      meta: 'code',
      body: [
        { type: 'code', title: 'deploy.yml', text: `name: build-and-deploy
on:
  push:
  pull_request_target:
    types: [opened, synchronize]

permissions: write-all

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: \${{ github.event.pull_request.head.sha }}
      - uses: some-vendor/cache-action@main
      - name: Install
        run: npm install
      - name: Debug env
        run: echo "Deploying with key $DEPLOY_API_KEY"
        env:
          DEPLOY_API_KEY: \${{ secrets.DEPLOY_API_KEY }}
      - name: Test
        run: npm test
      - name: Deploy
        run: ./deploy.sh \${{ github.head_ref }}
        env:
          DEPLOY_API_KEY: \${{ secrets.DEPLOY_API_KEY }}` },
        { type: 'note', text: 'github.head_ref is the name of the branch the pull request comes from. Anyone who can open a pull request chooses that name.' },
      ],
    },
    {
      id: 'background',
      title: 'Background from the team',
      meta: 'interviews',
      body: [
        { type: 'quote', text: "We opened the workflow up so the contractor's pull requests could deploy to a preview. It's faster than waiting for a reviewer. (Lead developer)" },
        { type: 'quote', text: 'The Debug env step was added when a deploy failed. Nobody removed it. (Developer)' },
        { type: 'quote', text: 'There is no step that scans for secrets or vulnerable dependencies. We run npm audit by hand now and then. (QA)' },
        { type: 'quote', text: 'Production deploys are fine whenever the build is green. We do not have a manual approval. (CTO)' },
      ],
    },
    {
      id: 'scan-types',
      title: 'Scan types, in brief',
      meta: 'summary',
      body: [
        { type: 'list', items: [
          'Secret scanning looks through files and git history for credentials, tokens and keys.',
          'Software composition analysis (SCA) checks the libraries you depend on against known vulnerabilities.',
          'Static analysis (SAST) reads your own source code for unsafe patterns, without running it.',
          'Container image scanning checks the operating-system packages and libraries inside a built image.',
          'Dynamic analysis (DAST) probes a running copy of the application from the outside, the way an attacker would.',
        ] },
      ],
    },
  ],
  tasks: [
    {
      key: 't1',
      type: 'multi',
      title: 'What is actually wrong?',
      prompt: 'Which of these are real security problems in deploy.yml? Select all that apply.',
      points: 25,
      options: [
        { id: 'pr-target-checkout', label: 'It uses pull_request_target and then checks out the pull request\'s own code' },
        { id: 'write-all', label: 'The workflow token has permissions: write-all' },
        { id: 'unpinned-action', label: 'A third-party action is referenced by the mutable ref @main' },
        { id: 'echo-secret', label: 'A step prints the deploy key into the build log' },
        { id: 'inject-head-ref', label: 'The branch name is pasted straight into a shell command' },
        { id: 'deploy-every-push', label: 'It can deploy to production from any push or pull request, with no approval' },
        { id: 'runs-on', label: 'The job runs on ubuntu-latest' },
        { id: 'checkout-v4', label: 'It uses actions/checkout@v4' },
        { id: 'npm-test', label: 'It runs npm test' },
      ],
    },
    {
      key: 't2',
      type: 'match',
      title: 'Match the fix',
      prompt: 'Pick the best fix for each problem.',
      points: 25,
      items: [
        { id: 'pr-target-checkout', label: 'pull_request_target plus checkout of the PR head' },
        { id: 'write-all', label: 'permissions: write-all' },
        { id: 'unpinned-action', label: 'some-vendor/cache-action@main' },
        { id: 'echo-secret', label: 'echo of the deploy key' },
        { id: 'inject-head-ref', label: './deploy.sh ${{ github.head_ref }}' },
      ],
      choices: [
        { id: 'trigger-pr', label: 'Use the pull_request trigger for untrusted code, with no secrets in those runs' },
        { id: 'least-priv', label: 'Default to contents: read, and grant more per job only where needed' },
        { id: 'pin-sha', label: 'Pin the action to a full commit SHA' },
        { id: 'no-print', label: 'Delete the step; never print secrets, because masking is not a control' },
        { id: 'env-var', label: 'Pass the value in an environment variable and quote it in the script' },
        { id: 'bigger-runner', label: 'Move to a larger self-hosted runner' },
      ],
    },
    {
      key: 't3',
      type: 'single',
      title: 'The key is in a public log',
      prompt: 'The production deploy key has been visible in a public build log for a week. What do you do first?',
      points: 15,
      options: [
        { id: 'rotate', label: 'Revoke and replace the key now, then look for use of the old one' },
        { id: 'delete-log', label: 'Delete the log so nobody can see it any more' },
        { id: 'rewrite-history', label: 'Rewrite the git history to remove the key' },
        { id: 'wait', label: 'Wait for the next audit and raise it then' },
      ],
    },
    {
      key: 't4',
      type: 'single',
      title: 'Why is pull_request_target dangerous here?',
      prompt: 'What makes pull_request_target combined with checking out the pull request\'s head code a serious problem?',
      points: 15,
      options: [
        { id: 'untrusted-with-secrets', label: "It runs the pull request author's code in a context that has the repository's secrets and a write-capable token" },
        { id: 'slow', label: 'It makes builds slower because the cache cannot be used' },
        { id: 'duplicate', label: 'It runs every workflow twice' },
        { id: 'forks-blocked', label: 'It blocks pull requests from forks' },
      ],
    },
    {
      key: 't5',
      type: 'match',
      title: 'Which scan finds it?',
      prompt: 'For each scan, pick the problem it is best at finding.',
      points: 20,
      items: [
        { id: 'secrets', label: 'Secret scanning (for example Gitleaks)' },
        { id: 'sca', label: 'Dependency scanning / SCA (for example npm audit, OSV-Scanner)' },
        { id: 'sast', label: 'SAST (for example Semgrep, CodeQL)' },
        { id: 'container', label: 'Container image scan (for example Trivy)' },
        { id: 'dast', label: 'DAST (for example OWASP ZAP against staging)' },
      ],
      choices: [
        { id: 'committed-password', label: 'A password committed three commits ago' },
        { id: 'old-library', label: 'A vulnerable version of a library in package-lock.json' },
        { id: 'string-sql', label: 'SQL built by joining strings in the source code' },
        { id: 'os-package', label: 'An outdated operating-system package inside the built image' },
        { id: 'missing-authz', label: 'A missing authorisation check found by probing the running staging app' },
        { id: 'phishing', label: 'A phishing email sent to a developer' },
      ],
    },
    {
      key: 't6',
      type: 'rubric',
      title: 'Prove it on your own machine',
      prompt: `Do this on your own computer. No hosted lab is needed, and you must only use FAKE secrets.

1. Make a throwaway repository with a fake credential in it (an obviously made-up value, such as AWS_SECRET_ACCESS_KEY=fake-not-a-real-key-123) and a package.json that pins an old version of a well-known library.
2. Run a secret scanner (Gitleaks or TruffleHog) and a dependency scanner (npm audit, OSV-Scanner or Trivy fs) against it.
3. Rewrite deploy.yml so it fixes the problems from the evidence pack.

Submit: the commands you ran, the scanner output trimmed to the findings, your corrected deploy.yml, and a link to your repository or gist if you have one. Add a short note on why each fix lowers the risk.`,
      placeholder: 'Commands and output:\n\nCorrected deploy.yml:\n\nWhy each fix helps:\n\nLink (optional):',
      points: 0,
    },
  ],
};
