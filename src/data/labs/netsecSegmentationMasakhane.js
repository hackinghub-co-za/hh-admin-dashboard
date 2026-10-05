// Hub Lab content only - prompts and options. Correct answers, model
// answers and rubrics live in public.lab_answer_keys (supabase/099_labs.sql)
// and never ship in the bundle. Option/item/choice ids here must match
// the answer keys there.

export default {
  slug: 'netsec-segmentation-masakhane-print-pack',
  organisation: 'Masakhane Print & Pack',
  brief: [
    { type: 'p', text: 'Masakhane Print & Pack prints and packs promotional items for retailers. About 60 people work across an office and a production floor in Gqeberha, and everything plugs into one flat network.' },
    { type: 'p', text: "A retailer's security questionnaire asked how the company keeps its production floor, its finance team and visitors apart. The honest answer is that it doesn't. You have been asked to design a segmented network that is realistic for a small business, and to show your thinking in a diagram." },
    { type: 'p', text: 'Part one is analysis of the evidence pack here in the portal and is marked automatically. Part two is a design deliverable you draw yourself and submit for review. Nothing is hosted for you.' },
    { type: 'note', text: 'Masakhane Print & Pack is fictional.' },
  ],
  evidence: [
    {
      id: 'inventory',
      title: 'What is on the network today',
      meta: 'table',
      body: [
        { type: 'p', text: 'Everything is on one subnet, 192.168.0.0/24, behind one firewall. Every device can reach every other device.' },
        { type: 'table', columns: ['Id', 'Device group', 'Count', 'What it does and holds'], rows: [
          ['staff', 'Staff laptops and desktops', '35', 'Email, documents, the order system'],
          ['finance', 'Finance PCs', '3', 'Payroll, bank profile, supplier payments'],
          ['production', 'Label printers and line controllers', '12', 'Run the packing line; old software, rarely patched'],
          ['cctv', 'CCTV cameras and recorder', '14', 'Record the floor; vendor cloud access for viewing'],
          ['guest', 'Visitor and driver Wi-Fi', 'varies', 'Phones and laptops of people who are not staff'],
          ['public', 'Public web and email server', '1', 'The company website and customer email, reachable from the internet'],
          ['fileserver', 'Internal file server', '1', 'Shared documents and design files'],
        ] },
      ],
    },
    {
      id: 'constraints',
      title: 'Constraints',
      meta: 'interviews',
      body: [
        { type: 'quote', text: 'We have one firewall and one managed switch. No budget for more hardware this year. (Owner)' },
        { type: 'quote', text: "The packing-line controller supplier connects remotely about once a month to update the recipes. Right now they log into a staff laptop. (Production manager)" },
        { type: 'quote', text: 'The CCTV recorder talks to the vendor cloud so the owner can watch from his phone. (IT support)' },
        { type: 'quote', text: 'Visitors and drivers need Wi-Fi for their phones and sometimes to print a delivery note. (Reception)' },
      ],
    },
    {
      id: 'practice',
      title: 'Segmentation, in brief',
      meta: 'summary',
      body: [
        { type: 'list', items: [
          'A VLAN separates broadcast traffic. By itself it does not stop devices on different VLANs talking, because traffic between them is routed. Segmentation needs rules (a firewall or access lists) between the zones.',
          'Start from default deny between zones, then allow only the flows that are needed, from the narrowest source to the narrowest destination.',
          'Group devices by how much you trust them and how bad it would be if they were compromised, not by who owns them.',
          'Third-party access should be time-limited, authenticated, logged, and land on a controlled jump point rather than a user\'s own machine.',
        ] },
      ],
    },
  ],
  tasks: [
    {
      key: 't1',
      type: 'match',
      title: 'Put each group in a zone',
      prompt: 'Choose the zone each group of devices belongs in.',
      points: 30,
      items: [
        { id: 'staff', label: 'Staff laptops and desktops' },
        { id: 'finance', label: 'Finance PCs' },
        { id: 'production', label: 'Label printers and line controllers' },
        { id: 'cctv', label: 'CCTV cameras and recorder' },
        { id: 'guest', label: 'Visitor and driver Wi-Fi' },
        { id: 'public', label: 'Public web and email server' },
        { id: 'fileserver', label: 'Internal file server' },
      ],
      choices: [
        { id: 'z-staff', label: 'Staff zone' },
        { id: 'z-finance', label: 'Finance zone (restricted)' },
        { id: 'z-production', label: 'Production zone (old, hard to patch)' },
        { id: 'z-iot', label: 'Cameras and IoT zone' },
        { id: 'z-guest', label: 'Guest zone' },
        { id: 'z-dmz', label: 'DMZ (internet-facing)' },
        { id: 'z-servers', label: 'Internal servers zone' },
      ],
    },
    {
      key: 't2',
      type: 'multi',
      title: 'Which flows should be allowed?',
      prompt: 'With default deny between zones, which of these flows should the firewall allow? Select all that apply.',
      points: 24,
      options: [
        { id: 'staff-fileserver', label: 'Staff zone to the file server, on file-sharing ports only' },
        { id: 'guest-internet', label: 'Guest zone to the internet only' },
        { id: 'finance-bank', label: 'Finance zone to the bank\'s website over HTTPS, through the filtering proxy' },
        { id: 'guest-staff', label: 'Guest zone to the staff zone' },
        { id: 'cctv-internet', label: 'Cameras straight to any address on the internet' },
        { id: 'dmz-internal', label: 'DMZ to the internal servers on any port' },
        { id: 'any-production', label: 'Any zone to the production zone' },
      ],
    },
    {
      key: 't3',
      type: 'single',
      title: 'The supplier who logs in once a month',
      prompt: 'How should the line-controller supplier get access?',
      points: 16,
      options: [
        { id: 'timeboxed-jump', label: 'A named, time-limited VPN account with multi-factor authentication to a jump host that can reach only the controllers, logged, and disabled between visits' },
        { id: 'staff-laptop', label: 'Keep letting them log into a staff laptop, but change its password' },
        { id: 'open-port', label: 'Open a port on the firewall straight to the controllers' },
        { id: 'shared-admin', label: 'Give them the shared administrator password' },
      ],
    },
    {
      key: 't4',
      type: 'single',
      title: 'Are VLANs enough?',
      prompt: 'The switch supports VLANs. The owner says that putting each group on its own VLAN is all the segmentation they need. What do you tell them?',
      points: 15,
      options: [
        { id: 'need-rules', label: 'VLANs separate the networks, but traffic between them is routed, so you also need firewall or access-list rules that deny by default' },
        { id: 'enough', label: 'Yes, VLANs alone block all traffic between groups' },
        { id: 'encrypt', label: 'VLANs encrypt traffic between groups' },
        { id: 'faster', label: 'VLANs are only for making the network faster' },
      ],
    },
    {
      key: 't5',
      type: 'single',
      title: 'Guests attacking each other',
      prompt: 'Two guests are on the same Wi-Fi. Which setting stops one guest device from reaching another?',
      points: 15,
      options: [
        { id: 'client-isolation', label: 'Client (AP) isolation on the guest network' },
        { id: 'hide-ssid', label: 'Hiding the guest network name' },
        { id: 'long-name', label: 'Giving the guest network a long name' },
        { id: 'more-power', label: 'Turning down the access point\'s power' },
      ],
    },
    {
      key: 't6',
      type: 'rubric',
      title: 'Design it: your segmented network',
      prompt: `Design the new network and submit it. Nothing is hosted for you.

1. Draw a diagram with a free tool such as diagrams.net or Excalidraw. Show each zone, a VLAN number and subnet for it, the firewall, the switch, and where the supplier's remote access lands.
2. Write a zone-to-zone rule matrix as a table: for each pair of zones, say allow (with the service) or deny. Default should be deny.
3. If you want to go further, build one part of it in Cisco Packet Tracer or GNS3 and include the configuration for one VLAN interface and one access list.

Submit: a view-only link to your diagram, the pasted rule matrix, and 100 to 150 words explaining the two decisions you are least sure about and how you would test them.`,
      placeholder: 'Diagram link:\n\nZone and VLAN table:\n\nRule matrix:\n\nDecisions I am least sure about:',
      points: 0,
    },
  ],
};
