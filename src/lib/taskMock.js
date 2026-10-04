// Example tasks for Mock Admin - shared by the Tasks board and the
// Dashboard's "My open tasks" tile so both show the same demo data.
import { addDaysSast } from './taskHelpers';

export const makeMockTasks = (myEmail) => [
  { id: 1, title: 'Follow up with the three Ready to Join prospects', description: '', status: 'To Do', priority: 'High', assigneeEmail: myEmail, dueDate: addDaysSast(1), labels: ['Sales'], checklist: [{ text: 'Call Blessing', done: true }, { text: 'Send payment link', done: false }, { text: 'Log outcome', done: false }], adminOnly: false, sortOrder: 0, completedAt: null },
  { id: 2, title: 'Plan the November meetup', description: 'Venue, speaker, RSVP link.', status: 'In Progress', priority: 'Medium', assigneeEmail: 'thandiwe@example.com', dueDate: addDaysSast(9), labels: ['Events'], checklist: [{ text: 'Shortlist venues', done: true }, { text: 'Confirm speaker', done: false }], adminOnly: false, sortOrder: 0, completedAt: null },
  { id: 3, title: 'Approve pending room logs', description: '', status: 'To Do', priority: 'Urgent', assigneeEmail: 'blessing@example.com', dueDate: addDaysSast(-2), labels: ['Competition'], checklist: [], adminOnly: false, sortOrder: 1, completedAt: null },
  { id: 4, title: 'Review Q4 staff compensation', description: 'Compare against the org chart.', status: 'Backlog', priority: 'Medium', assigneeEmail: myEmail, dueDate: '', labels: ['Finance'], checklist: [], adminOnly: true, sortOrder: 0, completedAt: null },
  { id: 5, title: 'Write the weekly breakdown', description: '', status: 'In Review', priority: 'Medium', assigneeEmail: 'thandiwe@example.com', dueDate: addDaysSast(0), labels: ['Content'], checklist: [], adminOnly: false, sortOrder: 0, completedAt: null },
  { id: 6, title: 'Add curated labs for SOC', description: '', status: 'Backlog', priority: 'Low', assigneeEmail: '', dueDate: '', labels: ['Labs', 'Content'], checklist: [], adminOnly: false, sortOrder: 1, completedAt: null },
  { id: 7, title: 'Publish GRC labs announcement', description: '', status: 'Done', priority: 'Medium', assigneeEmail: myEmail, dueDate: '', labels: ['Labs'], checklist: [], adminOnly: false, sortOrder: 0, completedAt: new Date().toISOString() },
].map((t) => ({ commentCount: 0, createdBy: myEmail, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), ...t }));
