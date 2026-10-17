// Hub Lab content only. Rules, model fixes and rubric live in
// public.lab_answer_keys (supabase/099_labs.sql). Task keys must match.

export default {
  slug: 'eng-container-karoo-parcels',
  organisation: 'Karoo Parcels',
  brief: [
    { type: 'p', text: 'Karoo Parcels is a courier firm in Bloemfontein. Its tracking API is a small Python web app that runs in a container, with a Postgres database alongside it, started with Docker Compose.' },
    { type: 'p', text: 'Both files were copied from a tutorial years ago and have never been reviewed. Before the app moves to a production server, you harden the Dockerfile and the Compose file.' },
    { type: 'note', text: 'Karoo Parcels is fictional and the secret in the Dockerfile is fake. Edit each file in its task box, press Check my work as often as you like (30 checks a day for each task), and submit once every check passes.' },
  ],
  evidence: [
    {
      id: 'standards',
      title: 'Container standards',
      meta: 'table',
      body: [
        { type: 'p', text: 'The platform team\'s rules for anything that runs in production.' },
        { type: 'table', columns: ['Rule', 'Why'], rows: [
          ['Pin the base image to a version', 'A "latest" image changes without warning and cannot be audited'],
          ['No secrets baked into an image', 'Anyone who can pull the image can read them'],
          ['Run as a non-root user', 'A flaw in the app should not give root inside the container'],
          ['Use COPY, not ADD', 'ADD can fetch remote files and unpack archives you did not expect'],
          ['Add a health check', 'The platform restarts a container that stops answering'],
          ['Expose only what the app serves', 'The app serves port 5000 only'],
          ['No privileged containers, no host sockets', 'These give a compromised container the whole host'],
          ['Databases are not published to the network', 'The API reaches the database over the Compose network'],
        ] },
      ],
    },
    {
      id: 'app',
      title: 'About the app',
      meta: 'note',
      body: [
        { type: 'p', text: 'The app listens on port 5000 and reads its secret key from an environment variable at start-up. In production the key comes from the platform\'s secret store, so it must not appear in the image.' },
        { type: 'p', text: 'The database is only used by the API, and it does not need to be reachable from outside the Compose network.' },
      ],
    },
  ],
  tasks: [
    {
      key: 't1',
      type: 'multi',
      title: 'Spot the dangerous settings',
      prompt: 'Which of these would let a compromised container reach the host machine? Choose all that apply.',
      points: 10,
      options: [
        { id: 'privileged', label: 'A privileged container' },
        { id: 'docker-sock', label: 'Mounting the Docker socket into the container' },
        { id: 'host-net', label: 'Using the host network' },
        { id: 'healthcheck', label: 'Adding a health check' },
        { id: 'pinned', label: 'Pinning the image to a version tag' },
      ],
    },
    {
      key: 't2',
      type: 'artifact',
      title: 'Harden the Dockerfile',
      prompt: 'Edit the Dockerfile so it meets the container standards. Then press Check my work.',
      points: 60,
      placeholder: 'Dockerfile',
      starters: [
        {
          label: 'Version A',
          text: `FROM python:latest

ENV SECRET_KEY=fake-training-secret-12345

ADD . /app
WORKDIR /app

RUN pip install -r requirements.txt

EXPOSE 22 5000

CMD python app.py
`,
        },
        {
          label: 'Version B',
          text: `FROM python:latest
WORKDIR /srv/tracker

ARG API_TOKEN=fake-token-for-training-only
ADD . /srv/tracker

RUN pip install flask gunicorn

EXPOSE 5000 22
CMD ["gunicorn", "-b", "0.0.0.0:5000", "app:app"]
`,
        },
      ],
    },
    {
      key: 't3',
      type: 'artifact',
      title: 'Harden the Compose file',
      prompt: 'Edit the Compose file so it meets the container standards. Then press Check my work.',
      points: 45,
      placeholder: 'docker-compose.yml',
      starters: [
        {
          label: 'Version A',
          text: `services:
  api:
    build: .
    privileged: true
    network_mode: host
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
  db:
    image: postgres:16
    ports:
      - "5432:5432"
`,
        },
        {
          label: 'Version B',
          text: `services:
  db:
    image: postgres:16
    ports:
      - "0.0.0.0:5432:5432"
  api:
    build: .
    network_mode: "host"
    privileged: true
    volumes:
      - ./data:/data
      - /var/run/docker.sock:/var/run/docker.sock
`,
        },
      ],
    },
    {
      key: 't4',
      type: 'rubric',
      title: 'Explain your fixes',
      prompt: 'In a few sentences, explain what you changed in each file and why. Say which one change would reduce the most risk if you could only make one.',
      points: 0,
      placeholder: 'I changed...',
    },
  ],
};
