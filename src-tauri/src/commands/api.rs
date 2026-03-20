use crate::models::api::{ApiHeader, HttpResponse};
use std::time::Instant;

#[tauri::command]
pub fn get_api_collections() -> Result<String, String> {
    let path = std::env::current_dir()
        .unwrap_or_default()
        .join("data")
        .join("api-collections.json");
    if path.exists() {
        std::fs::read_to_string(&path).map_err(|e| e.to_string())
    } else {
        Ok(r#"{"items":[]}"#.to_string())
    }
}

#[tauri::command]
pub fn save_api_collections(data: String) -> Result<(), String> {
    let path = std::env::current_dir()
        .unwrap_or_default()
        .join("data")
        .join("api-collections.json");
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    std::fs::write(&path, data).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn send_http_request(
    method: String,
    url: String,
    headers: Vec<ApiHeader>,
    body: String,
    body_type: String,
) -> Result<HttpResponse, String> {
    let client = reqwest::Client::builder()
        .danger_accept_invalid_certs(true)
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| e.to_string())?;

    let method_parsed = method
        .parse::<reqwest::Method>()
        .map_err(|e| e.to_string())?;

    let mut req = client.request(method_parsed, &url);

    // Add headers
    for h in &headers {
        if h.enabled && !h.key.is_empty() {
            req = req.header(&h.key, &h.value);
        }
    }

    // Add body for methods that support it
    let upper = method.to_uppercase();
    if !body.is_empty() && (upper == "POST" || upper == "PUT" || upper == "PATCH") {
        match body_type.as_str() {
            "json" => {
                req = req.header("Content-Type", "application/json");
                req = req.body(body);
            }
            _ => {
                req = req.body(body);
            }
        }
    }

    let start = Instant::now();
    let response = req.send().await.map_err(|e| e.to_string())?;
    let elapsed = start.elapsed().as_millis() as u64;

    let status = response.status().as_u16();
    let status_text = response
        .status()
        .canonical_reason()
        .unwrap_or("")
        .to_string();

    let resp_headers: Vec<ApiHeader> = response
        .headers()
        .iter()
        .map(|(k, v)| ApiHeader {
            key: k.to_string(),
            value: v.to_str().unwrap_or("").to_string(),
            enabled: true,
        })
        .collect();

    let body_bytes = response.bytes().await.map_err(|e| e.to_string())?;
    let size_bytes = body_bytes.len() as u64;
    let body_str = String::from_utf8_lossy(&body_bytes).to_string();

    Ok(HttpResponse {
        status,
        status_text,
        headers: resp_headers,
        body: body_str,
        time_ms: elapsed,
        size_bytes,
    })
}
