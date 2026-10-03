function blockText(block) {
  if (block.type === 'list') return block.items.map((i) => `- ${i}`).join('\n');
  if (block.type === 'table') return [block.columns.join(' | '), ...block.rows.map((r) => r.join(' | '))].join('\n');
  return block.text || '';
}

// Only material already on the member's screen goes to Gemma - never answers.
export function labContext(content, task) {
  const options = task.options?.map((o) => `${o.id}: ${o.label}`) || [];
  const items = task.items?.map((i) => `${i.id}: ${i.label}`) || [];
  const choices = task.choices?.map((c) => `${c.id}: ${c.label}`) || [];
  return {
    brief: content.brief.map(blockText).join('\n'),
    evidence: content.evidence.map((ev) => `## ${ev.title}\n${ev.body.map(blockText).join('\n')}`).join('\n\n'),
    task: [
      `${task.title}: ${task.prompt}`,
      options.length ? `Options:\n${options.join('\n')}` : '',
      items.length ? `Items:\n${items.join('\n')}` : '',
      choices.length ? `Choices:\n${choices.join('\n')}` : '',
    ].filter(Boolean).join('\n'),
  };
}

