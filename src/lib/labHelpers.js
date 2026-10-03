export const STATUS_BADGE = {
  'In Progress': 'badge-warning',
  Submitted: 'badge-warning',
  'Needs Changes': 'badge-danger',
  Approved: 'badge-success',
};

export function isTaskAnswered(task, value) {
  if (value == null) return false;
  switch (task.type) {
    case 'single': return typeof value === 'string' && value !== '';
    case 'multi': return Array.isArray(value) && value.length > 0;
    case 'match': return typeof value === 'object' && task.items.every((item) => value[item.id]);
    case 'risk_score': return Number.isInteger(value.likelihood) && Number.isInteger(value.impact);
    case 'rubric': return typeof value === 'string' && value.trim().length > 0;
    default: return false;
  }
}
