import type { ActivityKind } from '../../domain/activity/types';

export const groupOf = (activity: ActivityKind) =>
  ACTIVITY_GROUPS.find(group => group.activities.includes(activity))?.id;

/** Every activity, in its group order; the sea group appears only where there is a sea. */
export const ACTIVITY_GROUPS: ReadonlyArray<{ id: string; activities: ActivityKind[] }> = [
  { id: 'move', activities: ['walk', 'run', 'bike', 'dog'] },
  { id: 'outdoors', activities: ['picnic', 'children', 'beach'] },
  { id: 'home', activities: ['garden', 'laundry'] },
  { id: 'photo', activities: ['photo'] },
  { id: 'road', activities: ['motorcycle'] },
];

/** A circle as a path, so every glyph is one list of strokes. */
