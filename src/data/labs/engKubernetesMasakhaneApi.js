// Hub Lab content only. Rules, model fix and rubric live in
// public.lab_answer_keys (supabase/099_labs.sql). Task keys must match.

export default {
  slug: 'eng-kubernetes-masakhane-api',
  organisation: 'Masakhane Pay',
  brief: [
    { type: 'p', text: 'Masakhane Pay is a Pretoria payments firm moving its customer API onto Kubernetes. The first deployment manifest was written in a hurry by a developer who wanted the pods running before the weekend.' },
    { type: 'p', text: 'You are the security engineer who reviews it before it reaches the production cluster. Fix the manifest so it follows the cluster\'s pod security rules, and explain what you changed.' },
    { type: 'note', text: 'Masakhane Pay is fictional and the password in the manifest is fake. Edit the file in the task box, press Check my work as often as you like (30 checks a day for each task), and submit once every check passes.' },
  ],
  evidence: [
    {
      id: 'rules',
      title: 'Pod security rules',
      meta: 'table',
      body: [
        { type: 'p', text: 'The cluster rejects workloads that break these rules, and the review checks them first.' },
        { type: 'table', columns: ['Rule', 'Why'], rows: [
          ['Pin the image to a version', 'A "latest" tag changes under you'],
          ['Not privileged, no host network', 'Either one gives the pod the node itself'],
          ['Run as non-root', 'A flaw in the app should not mean root in the container'],
          ['No privilege escalation', 'Stops a process gaining more rights than it started with'],
          ['Read-only root filesystem', 'An attacker cannot plant files in the image'],
          ['Drop all Linux capabilities', 'The API needs none of them'],
          ['CPU and memory limits', 'One noisy pod must not starve the node'],
          ['Secrets come from a Secret, never the manifest', 'Manifests live in Git for everyone to read'],
        ] },
      ],
    },
    {
      id: 'app',
      title: 'About the API',
      meta: 'note',
      body: [
        { type: 'p', text: 'The API listens on port 8080, writes nothing to its own disk, and reads the database password from an environment variable. A Secret named api-secrets already exists in the namespace with a key called db-password.' },
      ],
    },
  ],
  tasks: [
    {
      key: 't1',
      type: 'single',
      title: 'The riskiest setting',
      prompt: 'Which single setting in a pod spec lets a compromised container take over the whole node?',
      points: 10,
      options: [
        { id: 'privileged', label: 'privileged: true' },
        { id: 'replicas', label: 'replicas: 3' },
        { id: 'port', label: 'containerPort: 8080' },
        { id: 'label', label: 'A label that says app: api' },
      ],
    },
    {
      key: 't2',
      type: 'artifact',
      title: 'Lock down the manifest',
      prompt: 'Edit the Deployment so it follows every pod security rule. Keep it valid YAML. Then press Check my work.',
      points: 100,
      placeholder: 'deployment.yaml',
      starters: [
        {
          label: 'Version A',
          text: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: payments-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: payments-api
  template:
    metadata:
      labels:
        app: payments-api
    spec:
      hostNetwork: true
      containers:
        - name: api
          image: masakhane/payments-api:latest
          ports:
            - containerPort: 8080
          env:
            - name: DB_PASSWORD
              value: "fake-password-for-training"
          securityContext:
            privileged: true
`,
        },
        {
          label: 'Version B',
          text: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: customer-api
spec:
  replicas: 2
  selector:
    matchLabels:
      app: customer-api
  template:
    metadata:
      labels:
        app: customer-api
    spec:
      containers:
        - name: web
          image: masakhane/customer-api:latest
          ports:
            - containerPort: 8080
          securityContext:
            runAsUser: 0
            allowPrivilegeEscalation: true
          env:
            - name: DB_PASSWORD
              value: "another-fake-password"
      hostNetwork: true
`,
        },
      ],
    },
    {
      key: 't3',
      type: 'rubric',
      title: 'Explain your fix',
      prompt: 'In a few sentences, explain what you changed and why. Say which change you would make first if the rest had to wait.',
      points: 0,
      placeholder: 'I changed...',
    },
  ],
};
