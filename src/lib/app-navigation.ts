import type { AppRole } from './org';

const NAVIGATION = [
  { label: 'Work', links: [
    { label: 'My day', to: '/app/my-day', icon: 'day', roles: ['org_admin', 'complaints_manager', 'agent', 'qa_reviewer', 'read_only'] },
    { label: 'Queue', to: '/app', icon: 'queue', roles: ['org_admin', 'complaints_manager', 'agent', 'qa_reviewer', 'read_only'] },
    { label: 'Workload', to: '/app/workload', icon: 'workload', roles: ['org_admin', 'complaints_manager', 'qa_reviewer', 'read_only'] },
    { label: 'New complaint', to: '/app/new', icon: 'new', roles: ['org_admin', 'complaints_manager', 'agent', 'qa_reviewer'] },
    { label: 'QA review', to: '/app/qa', icon: 'qa', roles: ['org_admin', 'complaints_manager', 'qa_reviewer', 'read_only', 'agent'] },
  ] },
  { label: 'Insight', links: [
    { label: 'Reports', to: '/app/reports', icon: 'reports', roles: ['org_admin', 'complaints_manager', 'read_only'] },
    { label: 'Audit log', to: '/app/audit', icon: 'audit', roles: ['org_admin', 'complaints_manager', 'read_only'] },
  ] },
  { label: 'Admin', links: [
    { label: 'Templates', to: '/app/templates', icon: 'templates', roles: ['org_admin', 'complaints_manager', 'agent', 'qa_reviewer'] },
    { label: 'Public form', to: '/app/forms', icon: 'forms', roles: ['org_admin'] },
    { label: 'Privacy & data', to: '/app/privacy', icon: 'privacy', roles: ['org_admin'] },
    { label: 'Settings', to: '/app/settings', icon: 'settings', roles: ['org_admin', 'complaints_manager'] },
  ] },
] as const;

/** Preserve shell visibility rules; omit groups with no visible links. */
export function appNavigation(role: AppRole | null | undefined) {
  return NAVIGATION.map(group => ({
    label: group.label,
    links: group.links.filter(link => role ? (link.roles as readonly AppRole[]).includes(role) : link.icon === 'queue'),
  })).filter(group => group.links.length > 0);
}