import { Rating } from '../enums/Rating';

/**
 * Revision scheduling rules based on post-completion self-rating.
 * Each rating maps to an array of day offsets from the completion date.
 *
 * Easy:   fewer revisions, spaced further apart
 * Medium: standard spaced repetition
 * Hard:   more revisions, tighter spacing initially
 */
export const REVISION_RULES: Record<Rating, number[]> = {
  [Rating.EASY]: [14, 28],
  [Rating.MEDIUM]: [1, 3, 7, 14],
  [Rating.HARD]: [1, 3, 7, 14, 28],
};

/** Number of days a backlog task survives before expiring */
export const BACKLOG_EXPIRY_DAYS = 7;
