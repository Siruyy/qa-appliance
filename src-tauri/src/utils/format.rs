/// Convert raw attributes JSON in a product summary to a human-readable label.
///
/// Input example:  `Kolin Air Conditioner {"color":"White","size":"1.0 HP"}`
/// Output example: `Kolin Air Conditioner — White, 1.0 HP`
///
/// Handles GROUP_CONCAT'd summaries with commas separating multiple products.
pub fn format_product_summary(raw: &str) -> String {
    // The GROUP_CONCAT separator is ',' — but attribute JSON also contains commas.
    // Strategy: find and replace each `{...}` block inline.
    let mut result = String::with_capacity(raw.len());
    let mut chars = raw.chars().peekable();

    while let Some(ch) = chars.next() {
        if ch == '{' {
            // Collect the full JSON object
            let mut json_str = String::from('{');
            let mut depth = 1;
            for inner in chars.by_ref() {
                json_str.push(inner);
                if inner == '{' {
                    depth += 1;
                } else if inner == '}' {
                    depth -= 1;
                    if depth == 0 {
                        break;
                    }
                }
            }
            // Try to parse as JSON and extract values
            if let Ok(obj) = serde_json::from_str::<serde_json::Value>(&json_str) {
                if let Some(map) = obj.as_object() {
                    let values: Vec<&str> = map
                        .values()
                        .filter_map(|v| v.as_str())
                        .filter(|s| !s.is_empty())
                        .collect();
                    if !values.is_empty() {
                        // Replace the space before `{` with " — "
                        if result.ends_with(' ') {
                            result.pop();
                            result.push_str(" — ");
                        }
                        result.push_str(&values.join(", "));
                        continue;
                    }
                }
            }
            // Fallback: keep raw if parse fails
            result.push_str(&json_str);
        } else {
            result.push(ch);
        }
    }

    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn single_product() {
        let input = r#"Kolin Air Conditioner {"color":"White","size":"1.0 HP"}"#;
        assert_eq!(
            format_product_summary(input),
            "Kolin Air Conditioner — White, 1.0 HP"
        );
    }

    #[test]
    fn multi_product() {
        let input = r#"Kolin Air Conditioner {"color":"White","size":"1.0 HP"},Carrier Air Conditioner {"color":"White","size":"2.0 HP"}"#;
        assert_eq!(
            format_product_summary(input),
            "Kolin Air Conditioner — White, 1.0 HP,Carrier Air Conditioner — White, 2.0 HP"
        );
    }

    #[test]
    fn no_attributes() {
        assert_eq!(format_product_summary("Some Product"), "Some Product");
    }

    #[test]
    fn empty_attributes() {
        let input = r#"Product {}"#;
        assert_eq!(format_product_summary(input), "Product {}");
    }
}
