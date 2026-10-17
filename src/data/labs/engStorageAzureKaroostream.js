// Hub Lab content only. Rules, model fix and rubric live in
// public.lab_answer_keys (supabase/099_labs.sql). Task keys must match.

export default {
  slug: 'eng-storage-azure-karoostream',
  organisation: 'KarooStream',
  brief: [
    { type: 'p', text: 'KarooStream is a Port Elizabeth video-on-demand start-up. Training videos and customer invoices share one Azure storage account in South Africa North, and the platform is written in Terraform.' },
    { type: 'p', text: 'A pull request adds the storage account and a network rule for the encoding server. You are the security engineer reviewing it. Fix the Terraform so it is safe to merge, and explain what you changed.' },
    { type: 'note', text: 'KarooStream is fictional and every credential in the file is fake. Edit the file in the task box, press Check my work as often as you like (30 checks a day for each task), and submit once every check passes.' },
  ],
  evidence: [
    {
      id: 'findings',
      title: 'Review findings',
      meta: 'table',
      body: [
        { type: 'p', text: 'The platform lead has listed what the review has to cover. The starting file is in Task 2.' },
        { type: 'table', columns: ['Area', 'What the review has to confirm'], rows: [
          ['Public access', 'No blob can be read anonymously'],
          ['Transport', 'Only HTTPS is accepted, with TLS 1.2 or newer'],
          ['Network', 'The storage firewall denies by default, and the encoding subnet is the only way in'],
          ['Administration', 'The network security group does not allow SSH from the whole internet'],
          ['Secrets', 'No client secret is written in the Terraform'],
        ] },
      ],
    },
    {
      id: 'notes',
      title: 'Reviewer notes',
      meta: 'note',
      body: [
        { type: 'p', text: 'Customers watch videos through a signed link the application creates, so the storage account never needs anonymous access.' },
        { type: 'p', text: 'Azure provider versions name some settings differently. Either spelling of the HTTPS setting is accepted, as long as it is switched on.' },
        { type: 'note', text: 'Match controls, not wording. A check passes when the setting is right, whatever you call your resources.' },
      ],
    },
  ],
  tasks: [
    {
      key: 't1',
      type: 'single',
      title: 'Which fault matters most?',
      prompt: 'Which single fault would let someone read a customer invoice without an account?',
      points: 10,
      options: [
        { id: 'nested-public', label: 'Blobs can be made public, so an invoice container can be read by anyone with the address.' },
        { id: 'old-tls', label: 'The account still accepts an old TLS version.' },
        { id: 'ssh', label: 'SSH is open to the internet on the encoding server.' },
        { id: 'region', label: 'The account is in South Africa North.' },
      ],
    },
    {
      key: 't2',
      type: 'artifact',
      title: 'Fix the Terraform',
      prompt: 'Edit the file so it meets every finding in the review. Keep it valid Terraform. Then press Check my work.',
      points: 75,
      placeholder: 'main.tf',
      starters: [
        {
          label: 'Version A',
          text: `provider "azurerm" {
  features {}
  client_id     = "00000000-0000-0000-0000-000000000000"
  client_secret = "fake-secret-for-training-only"
}

resource "azurerm_storage_account" "media" {
  name                            = "karoostreammedia"
  resource_group_name             = "rg-karoostream"
  location                        = "southafricanorth"
  account_tier                    = "Standard"
  account_replication_type        = "LRS"
  allow_nested_items_to_be_public = true
  min_tls_version                 = "TLS1_0"
  enable_https_traffic_only       = false

  network_rules {
    default_action = "Allow"
  }
}

resource "azurerm_network_security_rule" "ssh" {
  name                        = "allow-ssh"
  priority                    = 100
  direction                   = "Inbound"
  access                      = "Allow"
  protocol                    = "Tcp"
  source_port_range           = "*"
  destination_port_range      = "22"
  source_address_prefix       = "*"
  destination_address_prefix  = "*"
  resource_group_name         = "rg-karoostream"
  network_security_group_name = "nsg-encoder"
}
`,
        },
        {
          label: 'Version B',
          text: `provider "azurerm" {
  features {}
  client_id     = "11111111-1111-1111-1111-111111111111"
  client_secret = "another-fake-secret-for-training"
}

resource "azurerm_network_security_rule" "admin" {
  name                        = "admin-access"
  priority                    = 120
  direction                   = "Inbound"
  access                      = "Allow"
  protocol                    = "Tcp"
  source_address_prefix       = "Internet"
  source_port_range           = "*"
  destination_address_prefix  = "*"
  destination_port_range      = "22"
  resource_group_name         = "rg-karoostream"
  network_security_group_name = "nsg-encoder"
}

resource "azurerm_storage_account" "videos" {
  name                            = "karoostreamvideos"
  resource_group_name             = "rg-karoostream"
  location                        = "southafricanorth"
  account_tier                    = "Standard"
  account_replication_type        = "GRS"
  min_tls_version                 = "TLS1_0"
  allow_nested_items_to_be_public = true
  enable_https_traffic_only       = false

  network_rules {
    default_action = "Allow"
    bypass         = ["AzureServices"]
  }
}
`,
        },
      ],
    },
    {
      key: 't3',
      type: 'rubric',
      title: 'Explain your fix',
      prompt: 'In a few sentences, explain what you changed and why each change matters for KarooStream. Say which fix you would do first if you only had time for one.',
      points: 0,
      placeholder: 'I changed...',
    },
  ],
};
