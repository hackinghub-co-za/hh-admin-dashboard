// Hub Lab content only - prompts and options. Correct answers, model
// answers and rubrics live in public.lab_answer_keys (supabase/099_labs.sql)
// and never ship in the bundle. Option/item/choice ids here must match
// the answer keys there.

export default {
  slug: 'devsecops-container-lekker-eats',
  organisation: 'Lekker Eats',
  brief: [
    { type: 'p', text: 'Lekker Eats is a food-ordering app for township restaurants. The API runs as a container image that a developer built once and everyone has been deploying since.' },
    { type: 'p', text: 'A customer asked how the company knows what is inside its images. The CTO has no answer. You have the Dockerfile and a scan of the current image. Review the Dockerfile, decide which vulnerability to fix first, and show on your own machine that you can build and scan a better image.' },
    { type: 'p', text: 'Part one is analysis of the evidence pack here in the portal and is marked automatically. Part two is practical and uses tools on your own computer (Docker or Podman, and a scanner). Nothing is hosted for you.' },
    { type: 'note', text: 'Lekker Eats is fictional. Vulnerability IDs in the scan use the made-up prefix CVE-2099 so they cannot be confused with real ones.' },
  ],
  evidence: [
    {
      id: 'dockerfile',
      title: 'Dockerfile',
      meta: 'code',
      body: [
        { type: 'code', title: 'Dockerfile', text: `FROM node:latest
WORKDIR /app
COPY . .
ENV DB_PASSWORD=lekker123
RUN curl -sSL https://installer.example.test/setup.sh | bash
RUN npm install
EXPOSE 22 3000
CMD ["node", "server.js"]` },
        { type: 'note', text: 'There is no .dockerignore file. The repository root also contains .git, a .env file with development settings, and a test folder.' },
      ],
    },
    {
      id: 'scan',
      title: 'Image scan summary',
      meta: 'table',
      body: [
        { type: 'table', columns: ['Row', 'Component', 'Installed', 'Severity', 'Fixed in', 'Exploited in the wild', 'Where it is used'], rows: [
          ['r-openssl', 'openssl (OS package)', '3.0.2', 'CRITICAL', '3.0.15', 'No', 'In the base image. The app does its TLS at the load balancer and never calls it.'],
          ['r-lodash', 'lodash (npm)', '4.17.15', 'HIGH', '4.17.21', 'Yes', 'Used by the order-handling code on every request.'],
          ['r-zlib', 'zlib (OS package)', '1.2.11', 'MEDIUM', '1.2.13', 'No', 'In the base image, used by gzip responses.'],
          ['r-devdep', 'mocha (npm, devDependency)', '9.0.0', 'HIGH', '9.2.2', 'No', 'Test runner only. Present because npm install pulls devDependencies.'],
          ['r-imagemagick', 'imagemagick (OS package)', '6.9.10', 'LOW', 'none yet', 'No', 'In the base image. Never called.'],
        ] },
        { type: 'note', text: '"Exploited in the wild" means the vulnerability is on a list of flaws known to be used in real attacks.' },
      ],
    },
    {
      id: 'ops',
      title: 'How images get deployed',
      meta: 'interview',
      body: [
        { type: 'quote', text: "I build on my laptop and push to the registry. The server pulls the latest tag. (Developer)" },
        { type: 'quote', text: 'Anyone with registry access can push any image under that name. (DevOps contractor)' },
        { type: 'quote', text: 'We do not keep a list of what is in each image. If a new CVE is announced, we search chat for who last touched it. (CTO)' },
      ],
    },
  ],
  tasks: [
    {
      key: 't1',
      type: 'multi',
      title: 'What is wrong with the Dockerfile?',
      prompt: 'Select every real problem.',
      points: 24,
      options: [
        { id: 'latest-tag', label: 'The base image is node:latest, an unpinned tag' },
        { id: 'env-secret', label: 'A database password is set with ENV, so it is baked into the image' },
        { id: 'curl-bash', label: 'It pipes a script from the internet straight into bash' },
        { id: 'root-user', label: 'There is no USER instruction, so the app runs as root' },
        { id: 'copy-all', label: 'COPY . . with no .dockerignore sends .git, .env and tests into the image' },
        { id: 'expose-22', label: 'It exposes port 22' },
        { id: 'workdir', label: 'It sets WORKDIR /app' },
        { id: 'expose-3000', label: 'It exposes port 3000' },
      ],
    },
    {
      key: 't2',
      type: 'match',
      title: 'Match the fix',
      prompt: 'Pick the best fix for each problem.',
      points: 30,
      items: [
        { id: 'latest-tag', label: 'FROM node:latest' },
        { id: 'env-secret', label: 'ENV DB_PASSWORD=lekker123' },
        { id: 'curl-bash', label: 'curl ... | bash' },
        { id: 'root-user', label: 'Runs as root' },
        { id: 'copy-all', label: 'COPY . . with no .dockerignore' },
        { id: 'expose-22', label: 'EXPOSE 22' },
      ],
      choices: [
        { id: 'pin-slim', label: 'Pin a specific version (or digest) of a slim base image' },
        { id: 'runtime-secret', label: 'Supply it at runtime from a secrets manager or orchestrator secret, never in the image' },
        { id: 'verify-download', label: 'Download a pinned release and verify its checksum or signature' },
        { id: 'add-user', label: 'Create a non-root user and switch to it with USER' },
        { id: 'dockerignore', label: 'Add a .dockerignore and copy only what the build needs' },
        { id: 'remove-port', label: 'Remove it; use docker exec or kubectl exec to get a shell when you must' },
        { id: 'bigger-image', label: 'Use a larger base image with more tools installed' },
      ],
    },
    {
      key: 't3',
      type: 'single',
      title: 'Which one do you fix first?',
      prompt: 'You have time to fix one finding today. Using the table, which comes first?',
      points: 16,
      options: [
        { id: 'r-lodash', label: 'lodash: exploited in the wild and used on every request' },
        { id: 'r-openssl', label: 'openssl: it has the highest severity label (CRITICAL)' },
        { id: 'r-zlib', label: 'zlib: it is the oldest package' },
        { id: 'r-devdep', label: 'mocha: it is rated HIGH' },
        { id: 'r-imagemagick', label: 'imagemagick: it has no fix yet, so it needs the most attention' },
      ],
    },
    {
      key: 't4',
      type: 'single',
      title: 'What is an SBOM for?',
      prompt: 'The CTO asks why you want to generate a software bill of materials for each image.',
      points: 14,
      options: [
        { id: 'inventory', label: 'It is an inventory of components in the image, so when a new vulnerability is announced you can find every image that contains it' },
        { id: 'fix', label: 'It automatically patches vulnerable libraries' },
        { id: 'encrypt', label: 'It encrypts the image so nobody can read the code' },
        { id: 'speed', label: 'It makes the container start faster' },
      ],
    },
    {
      key: 't5',
      type: 'single',
      title: 'Only deploy what the pipeline built',
      prompt: 'Anyone with registry access can push to the same tag. How do you make sure only images your pipeline built get deployed?',
      points: 16,
      options: [
        { id: 'sign-verify', label: 'Sign images in the pipeline, and have the cluster or deploy step refuse anything without a valid signature' },
        { id: 'scan-only', label: 'Scan every image after it is deployed' },
        { id: 'secret-tag', label: 'Keep the tag name secret' },
        { id: 'trust-team', label: 'Trust the team, because they are all employees' },
      ],
    },
    {
      key: 't6',
      type: 'rubric',
      title: 'Prove it: build, scan, harden, rescan',
      prompt: `Do this on your own computer with Docker or Podman and a scanner (Trivy or Grype). Nothing is hosted for you.

1. Make a tiny app: a server.js that prints a message and a package.json with one dependency. Use the Dockerfile from the evidence pack, but delete the curl | bash line because that address does not exist. Use only fake values for any secret.
2. Build the image and scan it. Record the vulnerability counts by severity.
3. Write a hardened Dockerfile and a .dockerignore: a pinned slim base, no secret in ENV, a non-root user, only needed files copied, no port 22. Rebuild and scan again.
4. Show the container really runs as a non-root user (for example the output of docker run --rm yourimage id).

Submit: your commands, the before and after scan summaries, the hardened Dockerfile and .dockerignore, the output that shows the non-root user, and a link to a repo or gist if you have one. Finish with two sentences on which finding you would fix first on a real project and why.`,
      placeholder: 'Commands:\n\nBefore scan summary:\n\nHardened Dockerfile and .dockerignore:\n\nAfter scan summary:\n\nNon-root proof:\n\nWhich first, and why:',
      points: 0,
    },
  ],
};
