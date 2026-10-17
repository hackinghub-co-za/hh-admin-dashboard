// Hub Lab content only - prompts, starting files and options. The rules that
// check the fixed file, the model fix and the rubric live in
// public.lab_answer_keys (supabase/099_labs.sql) and never ship in the
// bundle. Task keys must match the answer keys there.

export default {
  slug: 'eng-storage-aws-amanzi-statements',
  organisation: 'Amanzi Statements',
  brief: [
    { type: 'p', text: 'Amanzi Statements is a Durban start-up that emails customers a monthly PDF statement. The PDFs sit in an Amazon S3 bucket in the Cape Town region, and the whole environment is written in Terraform.' },
    { type: 'p', text: 'A developer has opened a pull request that adds the bucket and a server for the statement job. You are the security engineer who reviews it. Your job is to fix the Terraform so it is safe to merge, and to explain what you changed.' },
    { type: 'note', text: 'Amanzi Statements is fictional and every credential in the file is fake. Edit the file in the task box, press Check my work as often as you like (30 checks a day for each task), and submit once every check passes.' },
  ],
  evidence: [
    {
      id: 'findings',
      title: 'Review findings',
      meta: 'table',
      body: [
        { type: 'p', text: 'The platform lead has listed what the review has to cover. The starting file is in Task 2.' },
        { type: 'table', columns: ['Area', 'What the review has to confirm'], rows: [
          ['Public exposure', 'No customer statement can be read without signing in'],
          ['Public access block', 'The bucket has all four S3 public access block settings turned on'],
          ['Encryption', 'Objects are encrypted at rest on the server side'],
          ['Network', 'The statement server is not reachable for administration from the whole internet'],
          ['Secrets', 'No access key or secret is written in the Terraform'],
        ] },
      ],
    },
    {
      id: 'notes',
      title: 'Reviewer notes',
      meta: 'note',
      body: [
        { type: 'p', text: 'Customers never open the bucket directly. The emailing job reads the PDFs with its own role, so nothing about the bucket needs to be public.' },
        { type: 'p', text: 'The server needs port 443 open to the internet because customers reach the statement viewer through it. It does not need SSH open to anyone.' },
        { type: 'note', text: 'Match controls, not wording. A check passes when the setting is right, whatever you call your resources.' },
      ],
    },
  ],
  tasks: [
    {
      key: 't1',
      type: 'single',
      title: 'Which fault matters most?',
      prompt: 'Look at the review findings. Which single fault could let a stranger download customers\' statements today?',
      points: 10,
      options: [
        { id: 'public-acl', label: 'The bucket is public, so anyone with the address can read the statements.' },
        { id: 'no-encryption', label: 'The objects are not encrypted at rest.' },
        { id: 'ssh-open', label: 'SSH is open to the internet.' },
        { id: 'region', label: 'The bucket is in the Cape Town region.' },
      ],
    },
    {
      key: 't2',
      type: 'artifact',
      title: 'Fix the Terraform',
      prompt: 'Edit the file so it meets every finding in the review. Keep it valid Terraform: change the settings and add what is missing, and remove anything that should never be in the file. Then press Check my work.',
      points: 80,
      placeholder: 'main.tf',
      starters: [
        {
          label: 'Version A',
          text: `provider "aws" {
  region     = "af-south-1"
  access_key = "AKIAFAKEFAKEFAKE1234"
  secret_key = "fake/secret/for/training/only"
}

resource "aws_s3_bucket" "statements" {
  bucket = "amanzi-customer-statements"
  acl    = "public-read"
}

resource "aws_security_group" "statement_server" {
  name = "statement-server"

  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
}
`,
        },
        {
          label: 'Version B',
          text: `provider "aws" {
  region     = "af-south-1"
  access_key = "AKIAFAKEFAKEFAKE5678"
  secret_key = "another/fake/secret/for/training"
}

resource "aws_security_group" "viewer" {
  name = "statement-viewer"

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_s3_bucket" "pdfs" {
  bucket = "amanzi-monthly-pdfs"
  acl    = "public-read"
}
`,
        },
      ],
    },
    {
      key: 't3',
      type: 'rubric',
      title: 'Explain your fix',
      prompt: 'In a few sentences, explain what you changed and why each change matters for Amanzi\'s customers. Say which fix you would do first if you only had time for one.',
      points: 0,
      placeholder: 'I changed...',
    },
  ],
};
