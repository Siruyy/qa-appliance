/// Reusable backend input validation helpers.
///
/// Every write-path command should validate user input before touching the DB.
/// These helpers return `Err(String)` with user-friendly messages.

/// Validate a required text field: must not be empty/whitespace-only, within max length.
pub fn require_text(field: &str, value: &str, max_len: usize) -> Result<String, String> {
    let trimmed = value.trim().to_string();
    if trimmed.is_empty() {
        return Err(format!("{} is required", field));
    }
    if trimmed.len() > max_len {
        return Err(format!(
            "{} must be at most {} characters",
            field, max_len
        ));
    }
    Ok(trimmed)
}

/// Validate an optional text field: if present, trim and check max length.
pub fn optional_text(field: &str, value: &Option<String>, max_len: usize) -> Result<Option<String>, String> {
    match value {
        None => Ok(None),
        Some(v) => {
            let trimmed = v.trim().to_string();
            if trimmed.is_empty() {
                return Ok(None);
            }
            if trimmed.len() > max_len {
                return Err(format!(
                    "{} must be at most {} characters",
                    field, max_len
                ));
            }
            Ok(Some(trimmed))
        }
    }
}

/// Validate an optional phone number: digits, spaces, dashes, parens, plus sign; 7–20 chars.
pub fn optional_phone(value: &Option<String>) -> Result<Option<String>, String> {
    match value {
        None => Ok(None),
        Some(v) => {
            let trimmed = v.trim().to_string();
            if trimmed.is_empty() {
                return Ok(None);
            }
            if trimmed.len() < 7 || trimmed.len() > 20 {
                return Err("Phone number must be 7–20 characters".into());
            }
            if !trimmed.chars().all(|c| c.is_ascii_digit() || " -+()".contains(c)) {
                return Err("Phone number contains invalid characters".into());
            }
            Ok(Some(trimmed))
        }
    }
}

/// Validate an ISO date string (YYYY-MM-DD format).
pub fn require_iso_date(field: &str, value: &str) -> Result<(), String> {
    let trimmed = value.trim();
    if trimmed.len() != 10 {
        return Err(format!("{} must be a date in YYYY-MM-DD format", field));
    }
    let parts: Vec<&str> = trimmed.split('-').collect();
    if parts.len() != 3 {
        return Err(format!("{} must be a date in YYYY-MM-DD format", field));
    }
    let year: u16 = parts[0].parse().map_err(|_| format!("{} has invalid year", field))?;
    let month: u8 = parts[1].parse().map_err(|_| format!("{} has invalid month", field))?;
    let day: u8 = parts[2].parse().map_err(|_| format!("{} has invalid day", field))?;

    if year < 2000 || year > 2100 {
        return Err(format!("{} year out of range (2000–2100)", field));
    }
    if !(1..=12).contains(&month) {
        return Err(format!("{} has invalid month", field));
    }
    if !(1..=31).contains(&day) {
        return Err(format!("{} has invalid day", field));
    }
    Ok(())
}

/// Validate that a numeric value is strictly positive (> 0).
pub fn require_positive(field: &str, value: f64) -> Result<f64, String> {
    if value <= 0.0 {
        return Err(format!("{} must be greater than 0", field));
    }
    Ok(value)
}

/// Validate that a numeric value is non-negative (>= 0).
pub fn require_non_negative(field: &str, value: f64) -> Result<f64, String> {
    if value < 0.0 {
        return Err(format!("{} must not be negative", field));
    }
    Ok(value)
}

/// Validate that a numeric value falls within a range [min, max].
pub fn require_range(field: &str, value: f64, min: f64, max: f64) -> Result<f64, String> {
    if value < min || value > max {
        return Err(format!("{} must be between {} and {}", field, min, max));
    }
    Ok(value)
}

/// Validate that an integer is positive (> 0).
pub fn require_positive_int(field: &str, value: i64) -> Result<i64, String> {
    if value <= 0 {
        return Err(format!("{} must be greater than 0", field));
    }
    Ok(value)
}
