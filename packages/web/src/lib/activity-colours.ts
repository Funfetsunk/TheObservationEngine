// Maps CitizenAction enum values to Tailwind fill colours and hex for SVG
export const ACTIVITY_COLOUR: Record<string, { fill: string; label: string }> = {
  sleeping:    { fill: '#6366f1', label: 'Sleeping' },   // indigo-500
  working:     { fill: '#3b82f6', label: 'Working' },    // blue-500
  eating:      { fill: '#22c55e', label: 'Eating' },     // green-500
  socialising: { fill: '#f59e0b', label: 'Socialising' },// amber-500
  leisure:     { fill: '#6b7280', label: 'Leisure' },    // gray-500
};

export function activityColour(activity: string): string {
  return ACTIVITY_COLOUR[activity]?.fill ?? '#6b7280';
}
