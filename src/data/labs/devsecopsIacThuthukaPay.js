// Hub Lab content only - prompts and options. Correct answers, model
// answers and rubrics live in public.lab_answer_keys (supabase/099_labs.sql)
// and never ship in the bundle. Option/item/choice ids here must match
// the answer keys there.

export default {
  slug: 'devsecops-iac-thuthuka-pay',
  organisation: 'Thuthuka Pay',
  brief: [
    { type: 'p', text: 'Thuthuka Pay is a payments start-up that stores customer statements and runs its API on AWS in the Cape Town region. All of its infrastructure is written in Terraform.' },
    { type: 'p', text: 'The platform lead has a pull request open that adds a new statements bucket, a database and a server. Before it merges, she wants you to review the Terraform, explain what an attacker would use, and prove you can fix it with a scanner.' },
    { type: 'p', text: 'Part one is analysis of the evidence pack here in the portal and is marked automatically. Part two is practical: you scan and fix the file on your own computer and submit proof. You only scan. Do not run terraform apply, and do not create anything in a cloud account.' },
    { type: 'note', text: 'Thuthuka Pay is fictional and every credential in the file is fake. The scanner output is an illustrative excerpt in the style of Checkov; check IDs and wording differ between versions.' },
  ],
  evidence: [
    {
      id: 'main-tf',
      title: 'main.tf',
      meta: 'code',
      body: [
        { type: 'code', title: 'main.tf', text: `provider "aws" {
  region     = "af-south-1"
  access_key = "AKIAFAKEFAKEFAKE1234"
  secret_key = "fake/secret/key/for/training/only"
}

resource "aws_s3_bucket" "statements" {
  bucket = "thuthuka-customer-statements"
  acl    = "public-read"
}

resource "aws_security_group" "app" {
  name = "app-sg"

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

resource "aws_db_instance" "main" {
  engine              = "postgres"
  instance_class      = "db.t3.micro"
  username            = "admin"
  password            = "Thuthuka2024!"
  storage_encrypted   = false
  publicly_accessible = true
  skip_final_snapshot = true
}` },
        { type: 'note', text: 'The app security group is attached to the public API servers. Port 443 is how customers reach the API.' },
      ],
    },
    {
      id: 'scan',
      title: 'Scanner output (excerpt)',
      meta: 'code',
      body: [
        { type: 'code', title: 'checkov -f main.tf', text: `Passed checks: 3, Failed checks: 5, Skipped checks: 0

Check: CKV_AWS_41: "Ensure no hard coded AWS access key and secret key exists in provider"
	FAILED for resource: aws.default
Check: CKV_AWS_20: "S3 Bucket has an ACL defined which allows public READ access."
	FAILED for resource: aws_s3_bucket.statements
Check: CKV_AWS_24: "Ensure no security groups allow ingress from 0.0.0.0:0 to port 22"
	FAILED for resource: aws_security_group.app
Check: CKV_AWS_16: "Ensure all data stored in the RDS is securely encrypted at rest"
	FAILED for resource: aws_db_instance.main
Check: CKV_AWS_17: "Ensure all data stored in RDS is not publicly accessible"
	FAILED for resource: aws_db_instance.main` },
        { type: 'p', text: 'Notice what the scanner did not report: the database password is written into the file in plain text, and neither bucket versioning nor access logging is configured. A scanner is a floor, not a review.' },
      ],
    },
    {
      id: 'state',
      title: 'Notes from the platform lead',
      meta: 'interview',
      body: [
        { type: 'quote', text: 'Terraform state lives in a terraform.tfstate file in the repo so everyone has the same copy. (Platform lead)' },
        { type: 'quote', text: 'Those access keys were pasted in so the pipeline would run. They were committed three weeks ago. (Developer)' },
        { type: 'quote', text: "We do not run any scanner on pull requests; the reviewer looks at the diff. (Platform lead)" },
      ],
    },
  ],
  tasks: [
    {
      key: 't1',
      type: 'multi',
      title: 'Which parts of main.tf are a problem?',
      prompt: 'Select every problem with the Terraform. Think about what the file really allows, not only what the scanner reported.',
      points: 24,
      options: [
        { id: 'provider-keys', label: 'Access and secret keys are written into the provider block' },
        { id: 'public-bucket', label: 'The statements bucket has a public-read ACL' },
        { id: 'ssh-open', label: 'SSH (port 22) is open to the whole internet' },
        { id: 'db-password', label: 'The database password is written in plain text in the file' },
        { id: 'db-unencrypted', label: 'The database storage is not encrypted' },
        { id: 'db-public', label: 'The database is publicly accessible' },
        { id: 'https-open', label: 'HTTPS (port 443) is open to the internet on the app security group' },
        { id: 'region', label: 'The resources are in af-south-1' },
      ],
    },
    {
      key: 't2',
      type: 'match',
      title: 'Match the fix',
      prompt: 'Pick the best fix for each problem.',
      points: 30,
      items: [
        { id: 'provider-keys', label: 'Keys in the provider block' },
        { id: 'public-bucket', label: 'Public-read bucket' },
        { id: 'ssh-open', label: 'SSH open to the internet' },
        { id: 'db-password', label: 'Plain-text database password' },
        { id: 'db-unencrypted', label: 'Unencrypted database storage' },
        { id: 'db-public', label: 'Publicly accessible database' },
      ],
      choices: [
        { id: 'role-creds', label: 'Remove them; use environment or role-based credentials (for example OIDC from the pipeline)' },
        { id: 'block-public', label: 'Remove the public ACL and turn on S3 Block Public Access' },
        { id: 'restrict-ssh', label: 'Allow it only from a VPN or bastion address, or use Session Manager instead' },
        { id: 'secrets-manager', label: 'Generate it, keep it in a secrets manager, and reference it rather than typing it' },
        { id: 'encrypt-storage', label: 'Set storage_encrypted = true (an existing database must be recreated from an encrypted copy)' },
        { id: 'private-subnet', label: 'Set publicly_accessible = false and place the database in private subnets' },
        { id: 'rename', label: 'Rename the resources so they are harder to guess' },
      ],
    },
    {
      key: 't3',
      type: 'single',
      title: 'The keys are already in git',
      prompt: 'The fake-looking keys were committed three weeks ago. Treat them as real. What is the right first move?',
      points: 14,
      options: [
        { id: 'revoke-first', label: 'Treat them as compromised: revoke them and issue new ones, then clean up the code' },
        { id: 'delete-file', label: 'Delete the lines in a new commit; the history is private anyway' },
        { id: 'force-push-only', label: 'Force-push to rewrite history and leave the keys active' },
        { id: 'ignore', label: 'Leave them, because only three people have repository access' },
      ],
    },
    {
      key: 't4',
      type: 'single',
      title: 'Where should Terraform state live?',
      prompt: 'The team keeps terraform.tfstate in the repository. What is the best advice?',
      points: 14,
      options: [
        { id: 'remote-backend', label: 'Use an encrypted remote backend with access control and locking, and keep state out of git, because state can contain secrets in plain text' },
        { id: 'keep-in-git', label: 'Keep it in git; it is only a record of what exists' },
        { id: 'gitignore-only', label: 'Add it to .gitignore and keep it on one developer\'s laptop' },
        { id: 'email', label: 'Email the file to whoever needs to run Terraform' },
      ],
    },
    {
      key: 't5',
      type: 'single',
      title: 'When should the scanner run?',
      prompt: 'Where does an infrastructure scanner give the most value?',
      points: 18,
      options: [
        { id: 'in-pr', label: 'As a required check on every pull request, blocking merges on high-severity failures' },
        { id: 'before-audit', label: 'Once, the week before an audit' },
        { id: 'after-deploy', label: 'Manually, after the infrastructure is already live' },
        { id: 'never', label: 'It does not need to run if reviewers read the diff carefully' },
      ],
    },
    {
      key: 't6',
      type: 'rubric',
      title: 'Prove it: scan, fix, scan again',
      prompt: `Do this on your own computer. You are only scanning files, so no cloud account is needed. Do not run terraform apply.

1. Install a scanner for Terraform: Checkov, tfsec or Trivy (config mode).
2. Copy main.tf from the evidence pack into an empty folder and scan it. Note the number of failed checks.
3. Fix the problems from the lab in the file. Where a value must come from somewhere else, use a variable with no default (and mark it sensitive) instead of typing the secret.
4. Scan again and show the failures drop.

Submit: the commands you ran, the before and after summary lines from the scanner, your fixed main.tf, and a link to a repo or gist if you have one. Say in two or three sentences which finding you would fix first on a real project and why.`,
      placeholder: 'Scanner and commands:\n\nBefore (summary):\n\nAfter (summary):\n\nFixed main.tf:\n\nWhich first, and why:',
      points: 0,
    },
  ],
};
