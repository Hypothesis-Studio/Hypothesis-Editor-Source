/**
 * App metadata — single source of truth.
 * Auto-capitalizes the app name for display.
 */
const rawName = 'hypothesis';

export const APP_NAME_RAW: string = rawName;
export const APP_NAME: string = rawName.charAt(0).toUpperCase() + rawName.slice(1); // "Hypothesis"
export const APP_VERSION: string = '0.2.0';
export const APP_DESCRIPTION: string = 'Every Great Solution Begins with a Hypothesis.';
