/// Philippines timezone offset: UTC+8 = 8 * 3600 seconds
const PHT_OFFSET_SECS: u64 = 8 * 3600;

/// Returns today's date as "YYYY-MM-DD" in Philippine Standard Time (UTC+8).
pub fn today_iso() -> String {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .expect("System clock before UNIX epoch")
        .as_secs() + PHT_OFFSET_SECS;
    let days = now / 86400;
    let (year, month, day) = days_to_ymd(days as i64 + 719468);
    format!("{:04}-{:02}-{:02}", year, month, day)
}

/// Returns the current datetime as "YYYY-MM-DD HH:MM:SS" in PHT (UTC+8).
pub fn now_pht_iso() -> String {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .expect("System clock before UNIX epoch")
        .as_secs() + PHT_OFFSET_SECS;
    let days = now / 86400;
    let remainder = now % 86400;
    let hours = remainder / 3600;
    let minutes = (remainder % 3600) / 60;
    let seconds = remainder % 60;
    let (year, month, day) = days_to_ymd(days as i64 + 719468);
    format!("{:04}-{:02}-{:02} {:02}:{:02}:{:02}", year, month, day, hours, minutes, seconds)
}

/// Returns the date N days ago as "YYYY-MM-DD" in PHT (UTC+8).
pub fn days_ago_iso(n: u64) -> String {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .expect("System clock before UNIX epoch")
        .as_secs() + PHT_OFFSET_SECS;
    let days = (now / 86400) as i64 - n as i64;
    let (year, month, day) = days_to_ymd(days + 719468);
    format!("{:04}-{:02}-{:02}", year, month, day)
}

/// Returns the first day of the month for a given "YYYY-MM-DD" string.
pub fn first_of_month(date: &str) -> String {
    format!("{}-01", &date[..7])
}

/// Returns (prev_month_start, prev_month_end) strings given today's date.
pub fn prev_month_range(today: &str) -> Result<(String, String), String> {
    let y: i32 = today.get(..4).ok_or("Invalid date format")?.parse().map_err(|_| "Invalid year in date".to_string())?;
    let m: u32 = today.get(5..7).ok_or("Invalid date format")?.parse().map_err(|_| "Invalid month in date".to_string())?;
    let (py, pm) = if m == 1 { (y - 1, 12u32) } else { (y, m - 1) };
    let last_day = days_in_month(py, pm);
    Ok((
        format!("{:04}-{:02}-01", py, pm),
        format!("{:04}-{:02}-{:02}", py, pm, last_day),
    ))
}

/// Returns the number of days elapsed between two "YYYY-MM-DD" strings.
pub fn days_since(from: &str, to: &str) -> i64 {
    let parse_date = |s: &str| -> Option<i64> {
        let parts: Vec<&str> = s.split('-').collect();
        if parts.len() < 3 {
            return None;
        }
        let y: i64 = parts[0].parse().ok()?;
        let m: u32 = parts[1].parse().ok()?;
        let d: u32 = parts[2].parse().ok()?;
        let (y, m) = if m <= 2 { (y - 1, m + 9) } else { (y, m - 3) };
        let era = if y >= 0 { y } else { y - 399 } / 400;
        let yoe = (y - era * 400) as u32;
        let doy = (153 * m + 2) / 5 + d - 1;
        let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
        Some(era * 146097 + doe as i64 - 719468)
    };
    match (parse_date(from), parse_date(to)) {
        (Some(f), Some(t)) => t - f,
        _ => 0,
    }
}

fn days_to_ymd(days: i64) -> (i64, u32, u32) {
    let era = if days >= 0 { days } else { days - 146096 } / 146097;
    let doe = (days - era * 146097) as u32;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let y = yoe as i64 + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = if m <= 2 { y + 1 } else { y };
    (y, m, d)
}

fn days_in_month(year: i32, month: u32) -> u32 {
    match month {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 => {
            if year % 400 == 0 || (year % 100 != 0 && year % 4 == 0) {
                29
            } else {
                28
            }
        }
        _ => 30,
    }
}

/// Adds `months` calendar months to a "YYYY-MM-DD" string, clamping the day
/// to the last valid day of the resulting month (e.g., Jan 31 + 1 month → Feb 28/29).
pub fn add_months_to_date(date_str: &str, months: u32) -> Result<String, String> {
    let parts: Vec<&str> = date_str.split('-').collect();
    if parts.len() != 3 {
        return Err("Invalid date format".to_string());
    }

    let year: i32 = parts[0].parse().map_err(|_| "Invalid year".to_string())?;
    let month: u32 = parts[1].parse().map_err(|_| "Invalid month".to_string())?;
    let day: u32 = parts[2].parse().map_err(|_| "Invalid day".to_string())?;

    let total_months = (year * 12 + month as i32 - 1) + months as i32;
    let new_year = total_months / 12;
    let new_month = (total_months % 12) + 1;

    let max_day = days_in_month(new_year, new_month as u32);
    let clamped_day = day.min(max_day);
    Ok(format!("{:04}-{:02}-{:02}", new_year, new_month, clamped_day))
}
