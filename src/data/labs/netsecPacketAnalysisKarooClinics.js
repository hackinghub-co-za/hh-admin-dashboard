// Hub Lab content only - prompts and options. Correct answers, model
// answers and rubrics live in public.lab_answer_keys (supabase/099_labs.sql)
// and never ship in the bundle. Option/item/choice ids here must match
// the answer keys there.

export default {
  slug: 'netsec-packet-analysis-karoo-clinics',
  organisation: 'Karoo Clinics',
  brief: [
    { type: 'p', text: 'Karoo Clinics has six small clinics linked by one office network. A technician plugged a laptop into a switch port in the reception area and captured about fifteen seconds of traffic after staff complained the network felt odd.' },
    { type: 'p', text: 'You have a summary of that capture, in the style of a Wireshark packet list. Work out what is normal and what is not, decide what to do right now, and then prove you can capture and read traffic yourself.' },
    { type: 'p', text: 'Part one is analysis of the evidence pack here in the portal and is marked automatically. Part two is practical: you capture your own traffic on your own computer and submit proof. Only ever capture traffic on a network and devices you own or have permission to test.' },
    { type: 'note', text: 'Karoo Clinics is fictional. All addresses are private or documentation ranges, and every name and password is made up.' },
  ],
  evidence: [
    {
      id: 'capture',
      title: 'Packet list (summary)',
      meta: 'table',
      body: [
        { type: 'table', columns: ['No.', 'Time (s)', 'Source', 'Destination', 'Protocol', 'Info'], rows: [
          ['1', '0.000', '192.168.1.23', '192.168.1.40', 'FTP', 'Request: USER recep1'],
          ['2', '0.004', '192.168.1.40', '192.168.1.23', 'FTP', 'Response: 331 Password required'],
          ['3', '0.021', '192.168.1.23', '192.168.1.40', 'FTP', 'Request: PASS Karoo2024!'],
          ['4', '0.030', '192.168.1.40', '192.168.1.23', 'FTP', 'Response: 230 Login successful'],
          ['5', '2.100', '192.168.1.57', '203.0.113.50', 'TLSv1.2', 'Client Hello (SNI: cdn-sync.example.test)'],
          ['6', '5.400', '192.168.1.15', '198.51.100.7', 'NTP', 'NTP Version 4, client'],
          ['7', '8.000', '192.168.1.57', '192.168.1.1', 'DNS', 'Standard query TXT 7f3a9c1e2b84d6f0a1c7e5d3b9.data.exfil-dns.example.test'],
          ['8', '8.050', '192.168.1.57', '192.168.1.1', 'DNS', 'Standard query TXT 9b2e4d6f8a0c1e3a5b7d9f2c4e.data.exfil-dns.example.test'],
          ['9', '8.100', '192.168.1.57', '192.168.1.1', 'DNS', 'Standard query TXT c4a6e8b0d2f4a6c8e0b2d4f6a8.data.exfil-dns.example.test'],
          ['10', '12.301', 'aa:bb:cc:00:00:01', 'Broadcast', 'ARP', '192.168.1.1 is at aa:bb:cc:00:00:01'],
          ['11', '12.950', 'de:ad:be:ef:00:99', 'Broadcast', 'ARP', '192.168.1.1 is at de:ad:be:ef:00:99 (duplicate use of 192.168.1.1 detected!)'],
          ['12', '14.000', '192.168.1.30', '198.51.100.20', 'TLSv1.3', 'Client Hello (SNI: www.example.test)'],
          ['13', '62.100', '192.168.1.57', '203.0.113.50', 'TLSv1.2', 'Client Hello (SNI: cdn-sync.example.test)'],
          ['14', '122.200', '192.168.1.57', '203.0.113.50', 'TLSv1.2', 'Client Hello (SNI: cdn-sync.example.test)'],
          ['15', '182.100', '192.168.1.57', '203.0.113.50', 'TLSv1.2', 'Client Hello (SNI: cdn-sync.example.test)'],
        ] },
        { type: 'note', text: 'Packets 13 to 15 come from a longer capture of the same laptop; the times are in seconds from the start. 192.168.1.1 is the clinic gateway and DNS server. 192.168.1.40 is the file server.' },
      ],
    },
    {
      id: 'network-notes',
      title: 'What the clinic tells you',
      meta: 'interviews',
      body: [
        { type: 'quote', text: '192.168.1.57 is the reception back-office PC. Nobody uses it overnight, but the light stays on. (Practice manager)' },
        { type: 'quote', text: 'We use FTP to the file server because it is built into the scanner software. (Reception)' },
        { type: 'quote', text: 'The gateway has one network card and only one MAC address, printed on its label as AA:BB:CC:00:00:01. (Technician)' },
      ],
    },
    {
      id: 'filters',
      title: 'Wireshark display filters, in brief',
      meta: 'summary',
      body: [
        { type: 'list', items: [
          'A display filter hides packets after capture. A capture filter limits what is recorded in the first place.',
          'ftp.request.command == "PASS" shows FTP password commands.',
          'dns.qry.type == 16 shows DNS TXT queries (type 16).',
          'arp.opcode == 2 shows ARP replies.',
          'tcp.flags.syn == 1 shows the first packet of TCP connections.',
        ] },
      ],
    },
  ],
  tasks: [
    {
      key: 't1',
      type: 'match',
      title: 'What is each pattern?',
      prompt: 'Classify each observation in the capture.',
      points: 30,
      items: [
        { id: 'obs-ftp', label: 'Packets 1 to 4: an FTP login from reception to the file server' },
        { id: 'obs-beacon', label: 'Packets 5, 13, 14 and 15: TLS connections from 192.168.1.57 to 203.0.113.50' },
        { id: 'obs-dns', label: 'Packets 7 to 9: DNS TXT queries with long random names from 192.168.1.57' },
        { id: 'obs-arp', label: 'Packets 10 and 11: two different MAC addresses both claiming 192.168.1.1' },
        { id: 'obs-ntp', label: 'Packet 6: an NTP request to an outside time server' },
      ],
      choices: [
        { id: 'cleartext', label: 'Credentials sent in clear text' },
        { id: 'beaconing', label: 'Beaconing: regular check-ins to an outside server' },
        { id: 'dns-tunnel', label: 'DNS tunnelling: data hidden in DNS names' },
        { id: 'arp-spoof', label: 'ARP spoofing: someone pretending to be the gateway' },
        { id: 'normal', label: 'Normal background traffic' },
        { id: 'port-scan', label: 'A port scan' },
      ],
    },
    {
      key: 't2',
      type: 'single',
      title: 'The rhythm in the TLS traffic',
      prompt: 'Look at the times of packets 5, 13, 14 and 15. What do they tell you, even though the traffic is encrypted?',
      points: 14,
      options: [
        { id: 'regular-60', label: 'A connection about every 60 seconds, a regular rhythm that points to software checking in automatically rather than a person browsing' },
        { id: 'random', label: 'Random timing, which proves it is a person using a website' },
        { id: 'every-5', label: 'A connection every 5 seconds, which is a normal software update' },
        { id: 'nothing', label: 'Nothing, because encrypted traffic cannot be analysed at all' },
      ],
    },
    {
      key: 't3',
      type: 'multi',
      title: 'What do you do right now?',
      prompt: 'Select every sensible immediate action.',
      points: 22,
      options: [
        { id: 'isolate-keep-on', label: 'Disconnect 192.168.1.57 from the network but leave it powered on so evidence is preserved' },
        { id: 'block-iocs', label: 'Block 203.0.113.50 and the exfil-dns domain at the firewall and DNS server' },
        { id: 'rotate-ftp', label: 'Change the exposed FTP password, and any other place it was used' },
        { id: 'check-arp', label: 'Find the device with MAC de:ad:be:ef:00:99 and check the switch for ARP protections' },
        { id: 'wipe-now', label: 'Wipe and reinstall 192.168.1.57 immediately' },
        { id: 'reboot-delete', label: 'Reboot the gateway and clear its logs' },
        { id: 'ignore-tls', label: 'Do nothing about the TLS traffic because it is encrypted' },
      ],
    },
    {
      key: 't4',
      type: 'single',
      title: 'Fixing the FTP login',
      prompt: 'The scanner software needs to send files to the file server. What is the right fix for the clear-text login?',
      points: 10,
      options: [
        { id: 'sftp-rotate', label: 'Use SFTP or FTPS instead, and change the password that was exposed' },
        { id: 'new-port', label: 'Move FTP to a different port' },
        { id: 'shorter-pw', label: 'Use a shorter password so it is harder to read' },
        { id: 'leave', label: 'Leave it, because the network is inside the clinic' },
      ],
    },
    {
      key: 't5',
      type: 'match',
      title: 'Find it with a filter',
      prompt: 'Pick the Wireshark display filter that shows each thing.',
      points: 24,
      items: [
        { id: 'goal-ftp', label: 'FTP password commands' },
        { id: 'goal-txt', label: 'DNS TXT queries' },
        { id: 'goal-arp', label: 'ARP replies' },
      ],
      choices: [
        { id: 'f-ftp', label: 'ftp.request.command == "PASS"' },
        { id: 'f-txt', label: 'dns.qry.type == 16' },
        { id: 'f-arp', label: 'arp.opcode == 2' },
        { id: 'f-syn', label: 'tcp.flags.syn == 1' },
        { id: 'f-get', label: 'http.request.method == "GET"' },
      ],
    },
    {
      key: 't6',
      type: 'rubric',
      title: 'Prove it: capture and read your own traffic',
      prompt: `Do this on your own computer, on your own network. Nothing is hosted for you.

1. Install Wireshark (or use tshark on the command line).
2. Start a capture on your loopback or Wi-Fi interface. In a terminal, run a tiny web server (for example python3 -m http.server 8000), then make a request that sends a FAKE login in clear text, such as curl -u fakeuser:fakepass http://localhost:8000/. Also make one DNS lookup (for example nslookup example.com).
3. Stop the capture. Apply a display filter to find the HTTP request, and find the Authorization header. Decode the base64 value to show the fake credentials. Then find the DNS query you made.

Submit: the display filters you used, a pasted packet-list excerpt (or a link to a screenshot), the decoded fake credentials, and 100 to 150 words on what someone on the same Wi-Fi could see here, what they could not see if the page used HTTPS, and what you would change on Karoo's network. Use only fake credentials and only your own traffic.`,
      placeholder: 'Filters used:\n\nPacket excerpt or screenshot link:\n\nDecoded fake credentials:\n\nWhat an observer sees, HTTP versus HTTPS, and what I would change:',
      points: 0,
    },
  ],
};
