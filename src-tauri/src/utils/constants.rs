/// Shared application constants (CQ-15).
/// Centralizes magic numbers used across the Rust backend.

/// Tolerance for floating-point currency comparisons (half a centavo).
pub const CENTAVO_TOLERANCE: f64 = 0.01;

/// Days between penalty applications for both scheduled and unscheduled accounts.
pub const PENALTY_COOLDOWN_DAYS: i64 = 30;

/// Default low-stock threshold when none is configured on a product variant.
pub const DEFAULT_LOW_STOCK_THRESHOLD: i64 = 2;


