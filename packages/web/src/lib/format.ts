export function formatJobType(job: string): string {
  return job.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export function formatActivity(action: string): string {
  return action.charAt(0).toUpperCase() + action.slice(1);
}

export function formatSimDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function formatRelationshipType(type: string): string {
  return type.charAt(0).toUpperCase() + type.slice(1);
}
