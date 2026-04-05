/**
 * Shared application constants (CQ-13).
 * Centralizes magic numbers, thresholds, and defaults used across the frontend.
 */

/** Default items per page for paginated lists */
export const DEFAULT_PAGE_SIZE = 10;

/** Maximum entries kept in import/export log (FIFO) */
export const MAX_IMPORT_LOG_ENTRIES = 100;

/** Default low-stock threshold when none is set on a product */
export const DEFAULT_LOW_STOCK_THRESHOLD = 2;

/** Default interest rate (%) for installment calculations */
export const DEFAULT_INTEREST_RATE = 5;

/** Minimum allowed term months for installment sales */
export const MIN_TERM_MONTHS = 1;

/** Maximum allowed term months for installment sales */
export const MAX_TERM_MONTHS = 60;

/** Date display format (used with date-fns) */
export const DATE_FORMAT = "MMM d, yyyy";

/** Date-time display format */
export const DATETIME_FORMAT = "MMM d, yyyy h:mm a";

/** ISO date regex for validation */
export const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
