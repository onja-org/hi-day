/**
 * Whether time is tracked against Projects. Off unless an admin turns it on:
 * an Organisation that never set it reads as off, and the migration that
 * introduced it switches it on for every Organisation that already has
 * Projects, so nobody's existing setup changes underneath them.
 */
export const DEFAULT_PROJECTS_ENABLED = false;
