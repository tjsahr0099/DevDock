use flate2::write::DeflateEncoder;
use flate2::Compression;
use std::io::Write;

/// Encode PlantUML source to the format expected by PlantUML server
fn encode_plantuml(source: &str) -> String {
    // Deflate compress
    let mut encoder = DeflateEncoder::new(Vec::new(), Compression::default());
    encoder.write_all(source.as_bytes()).unwrap();
    let compressed = encoder.finish().unwrap();

    // Encode using PlantUML's custom base64
    encode64(&compressed)
}

fn encode64(data: &[u8]) -> String {
    let mut result = String::new();
    let mut i = 0;
    while i < data.len() {
        if i + 2 < data.len() {
            result.push_str(&encode3bytes(data[i], data[i + 1], data[i + 2]));
        } else if i + 1 < data.len() {
            result.push_str(&encode3bytes(data[i], data[i + 1], 0));
        } else {
            result.push_str(&encode3bytes(data[i], 0, 0));
        }
        i += 3;
    }
    result
}

fn encode3bytes(b1: u8, b2: u8, b3: u8) -> String {
    let c1 = b1 >> 2;
    let c2 = ((b1 & 0x3) << 4) | (b2 >> 4);
    let c3 = ((b2 & 0xF) << 2) | (b3 >> 6);
    let c4 = b3 & 0x3F;
    let mut s = String::new();
    s.push(encode6bit(c1));
    s.push(encode6bit(c2));
    s.push(encode6bit(c3));
    s.push(encode6bit(c4));
    s
}

fn encode6bit(b: u8) -> char {
    let b = b & 0x3F;
    if b < 10 {
        return (48 + b) as char; // '0' - '9'
    }
    let b = b - 10;
    if b < 26 {
        return (65 + b) as char; // 'A' - 'Z'
    }
    let b = b - 26;
    if b < 26 {
        return (97 + b) as char; // 'a' - 'z'
    }
    let b = b - 26;
    if b == 0 {
        return '-';
    }
    if b == 1 {
        return '_';
    }
    '?'
}

#[tauri::command]
pub async fn render_puml_svg(source: String) -> Result<String, String> {
    if source.trim().is_empty() {
        return Err("Empty PlantUML source".to_string());
    }

    let encoded = encode_plantuml(&source);
    let url = format!("https://www.plantuml.com/plantuml/svg/{}", encoded);

    let client = reqwest::Client::new();
    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Failed to connect to PlantUML server: {}", e))?;

    if !response.status().is_success() {
        return Err(format!(
            "PlantUML server returned error: {}",
            response.status()
        ));
    }

    let svg = response
        .text()
        .await
        .map_err(|e| format!("Failed to read response: {}", e))?;

    Ok(svg)
}
