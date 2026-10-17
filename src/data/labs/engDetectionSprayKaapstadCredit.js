// Hub Lab content only. Rules, model rule and rubric live in
// public.lab_answer_keys (supabase/099_labs.sql). Task keys must match.

export default {
  slug: 'eng-detection-spray-kaapstad-credit',
  organisation: 'Kaapstad Credit Union',
  brief: [
    { type: 'p', text: 'Kaapstad Credit Union is a Cape Town savings co-operative with about 400 staff and members. Over the weekend the help desk reported dozens of staff accounts with a few failed sign-ins each, none of them locked out.' },
    { type: 'p', text: 'You are the detection engineer on the credit union\'s small security team. Your job is to write a detection rule that would have caught this pattern, without paging the team every Monday morning for harmless sign-in problems.' },
    { type: 'note', text: 'Kaapstad Credit Union is fictional and every address and name is made up. The rule language below is a simplified one, written for this lab. Press Check my work as often as you like (30 checks a day for each task), and submit once every check passes.' },
  ],
  evidence: [
    {
      id: 'log',
      title: 'Failed sign-in log (excerpt)',
      meta: 'table',
      body: [
        { type: 'p', text: 'A short excerpt from Saturday night. The full log has about 1,900 failed sign-ins.' },
        { type: 'table', columns: ['Time', 'Source address', 'User', 'Result'], rows: [
          ['23:41:02', '185.220.14.9', 'a.dlamini', 'failed'],
          ['23:41:05', '185.220.14.9', 'b.naidoo', 'failed'],
          ['23:41:09', '185.220.14.9', 'c.mokoena', 'failed'],
          ['23:41:12', '185.220.14.9', 'd.pretorius', 'failed'],
          ['23:41:16', '185.220.14.9', 'e.khumalo', 'failed'],
          ['23:41:19', '185.220.14.9', 'f.jacobs', 'failed'],
          ['23:51:40', '185.220.14.9', 'a.dlamini', 'failed'],
          ['23:51:44', '185.220.14.9', 'b.naidoo', 'failed'],
          ['08:02:11', '10.20.0.5', 'g.sithole', 'failed'],
          ['08:02:30', '10.20.0.5', 'h.vanwyk', 'failed'],
          ['08:03:02', '10.20.0.5', 'i.zulu', 'failed'],
          ['08:03:40', '10.20.0.5', 'j.molefe', 'failed'],
          ['08:04:15', '10.20.0.5', 'k.pillay', 'failed'],
          ['08:04:50', '10.20.0.5', 'l.ndaba', 'failed'],
        ] },
        { type: 'note', text: 'The 185.220.14.9 rows are the attack. The 10.20.0.5 rows are the head office gateway, where every employee\'s sign-in appears to come from one address, and a few staff mistype passwords every Monday at 08:00.' },
      ],
    },
    {
      id: 'format',
      title: 'The rule format',
      meta: 'code',
      body: [
        { type: 'p', text: 'Write the rule in this simple YAML-style format. Lines starting with # are comments.' },
        { type: 'code', title: 'Format', text: `detect:
  event: signin_failed          # which log events to look at
  group_by: source_ip           # what to count together (source_ip or username)
  window: 10m                   # how far back to count, e.g. 10m or 1h
  where:
    distinct_users: ">= 20"     # how many different accounts
    count: ">= 40"              # how many failed attempts in total
  exclude:
    source_ip: ["10.20.0.5"]    # addresses that must not trigger the rule` },
      ],
    },
  ],
  tasks: [
    {
      key: 't1',
      type: 'single',
      title: 'Name the attack',
      prompt: 'One address trying a few passwords against many different accounts, slowly enough not to lock any of them out. What is this called?',
      points: 10,
      options: [
        { id: 'spray', label: 'Password spraying' },
        { id: 'brute', label: 'Brute force against one account' },
        { id: 'phish', label: 'Phishing' },
        { id: 'ddos', label: 'A denial-of-service attack' },
      ],
    },
    {
      key: 't2',
      type: 'artifact',
      title: 'Write the detection rule',
      prompt: 'Write a rule in the format above that catches this attack and does not fire on the head office gateway. Think about what to count, how many accounts and how long a window. Then press Check my work.',
      points: 80,
      placeholder: 'detect:\n  event: ...',
    },
    {
      key: 't3',
      type: 'rubric',
      title: 'Explain your rule',
      prompt: 'In a few sentences, explain why you chose that grouping, those thresholds and that window, and what false alarms you still expect.',
      points: 0,
      placeholder: 'I chose...',
    },
  ],
};
