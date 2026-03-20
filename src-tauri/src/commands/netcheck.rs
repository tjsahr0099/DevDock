use crate::models::netcheck::{NetCheckConfig, NetCheckResult};
use std::fs;
use std::path::PathBuf;

fn get_data_dir() -> PathBuf {
    let exe_path = std::env::current_exe().unwrap_or_default();
    let exe_dir = exe_path
        .parent()
        .unwrap_or_else(|| std::path::Path::new("."));
    let data_dir = exe_dir.join("data");

    if cfg!(debug_assertions) {
        let dev_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .unwrap_or_else(|| std::path::Path::new("."))
            .join("data");
        if !dev_dir.exists() {
            fs::create_dir_all(&dev_dir).ok();
        }
        return dev_dir;
    }

    if !data_dir.exists() {
        fs::create_dir_all(&data_dir).ok();
    }
    data_dir
}

fn config_path() -> PathBuf {
    get_data_dir().join("netcheck.json")
}

fn read_config() -> NetCheckConfig {
    let content = match fs::read_to_string(config_path()) {
        Ok(c) => c,
        Err(_) => return NetCheckConfig::new(),
    };

    // Try new format (HashMap<String, Vec<Target>>) first
    if let Ok(config) = serde_json::from_str::<NetCheckConfig>(&content) {
        // Migrate: if old "targets" key exists, move to first server
        if config.contains_key("targets") {
            // Old format had "targets" as a key — this is actually a mixed state.
            // Parse as generic JSON to extract properly.
            if let Ok(raw) = serde_json::from_str::<serde_json::Value>(&content) {
                let mut migrated = NetCheckConfig::new();

                // Copy new-format server entries
                if let Some(obj) = raw.as_object() {
                    for (key, val) in obj {
                        if key == "targets" {
                            continue; // skip old format
                        }
                        if let Ok(targets) = serde_json::from_value::<Vec<crate::models::netcheck::NetCheckTarget>>(val.clone()) {
                            migrated.insert(key.clone(), targets);
                        }
                    }

                    // Move old "targets" array to first server that has no entry yet
                    if let Some(old_targets) = obj.get("targets") {
                        if let Ok(targets) = serde_json::from_value::<Vec<crate::models::netcheck::NetCheckTarget>>(old_targets.clone()) {
                            if !targets.is_empty() {
                                // Find first server from servers.json
                                let servers_path = config_path().parent().unwrap().join("servers.json");
                                if let Ok(servers_json) = fs::read_to_string(servers_path) {
                                    if let Ok(servers) = serde_json::from_str::<Vec<serde_json::Value>>(&servers_json) {
                                        if let Some(first) = servers.first().and_then(|s| s.get("id")).and_then(|v| v.as_str()) {
                                            let entry = migrated.entry(first.to_string()).or_default();
                                            // Prepend old targets
                                            let mut merged = targets;
                                            merged.extend(entry.drain(..));
                                            *entry = merged;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                // Save migrated config
                let _ = write_config(&migrated);
                return migrated;
            }
        }
        return config;
    }

    NetCheckConfig::new()
}

fn write_config(config: &NetCheckConfig) -> Result<(), String> {
    let json = serde_json::to_string_pretty(config).map_err(|e| e.to_string())?;
    fs::write(config_path(), json).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_netcheck_targets(server_id: String) -> Result<String, String> {
    let config = read_config();
    let targets = config.get(&server_id).cloned().unwrap_or_default();
    serde_json::to_string(&targets).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_netcheck_targets(server_id: String, data: String) -> Result<(), String> {
    let targets: Vec<crate::models::netcheck::NetCheckTarget> =
        serde_json::from_str(&data).map_err(|e| e.to_string())?;
    let mut config = read_config();
    if targets.is_empty() {
        config.remove(&server_id);
    } else {
        config.insert(server_id, targets);
    }
    write_config(&config)
}

fn build_check_command(
    check_type: &str,
    host: &str,
    port: &str,
    http_url: &str,
) -> Result<String, String> {
    match check_type {
        "telnet" => Ok(format!(
            r#"if command -v nc &>/dev/null; then nc -z -w3 {} {} 2>&1 && echo "NETCHECK_OK" || echo "NETCHECK_FAIL"; else timeout 3 bash -c 'echo > /dev/tcp/{}/{}' 2>&1 && echo "NETCHECK_OK" || echo "NETCHECK_FAIL"; fi"#,
            host, port, host, port
        )),
        "ping" => Ok(format!(
            r#"ping -c 1 -W 3 {} 2>&1; echo "EXIT_CODE=$?""#,
            host
        )),
        "http" => Ok(format!(
            r#"curl -s -o /dev/null -w "HTTP_CODE=%{{http_code}} TIME=%{{time_total}}" --connect-timeout 3 --max-time 3 '{}'"#,
            http_url
        )),
        _ => Err(format!("지원하지 않는 검사 타입: {}", check_type)),
    }
}

fn parse_check_result(
    check_type: &str,
    output: &str,
    elapsed_ms: i64,
) -> Result<NetCheckResult, String> {
    match check_type {
        "telnet" => {
            let success = output.contains("NETCHECK_OK");
            Ok(NetCheckResult {
                success,
                message: if success {
                    "포트 연결 성공".to_string()
                } else {
                    format!(
                        "포트 연결 실패: {}",
                        output
                            .lines()
                            .find(|l| !l.contains("NETCHECK_"))
                            .unwrap_or("연결 거부 또는 시간 초과")
                    )
                },
                response_time_ms: elapsed_ms,
            })
        }
        "ping" => {
            let rtt = output
                .lines()
                .find(|l| l.contains("time="))
                .and_then(|l| {
                    l.split("time=")
                        .nth(1)
                        .and_then(|s| s.split_whitespace().next())
                        .and_then(|s| s.trim_end_matches("ms").parse::<f64>().ok())
                });
            let success = output.contains("EXIT_CODE=0");
            Ok(NetCheckResult {
                success,
                message: if success {
                    format!(
                        "ping 응답 ({}ms)",
                        rtt.map(|v| format!("{:.1}", v))
                            .unwrap_or("?".into())
                    )
                } else {
                    "ping 응답 없음 (시간 초과)".to_string()
                },
                response_time_ms: rtt.map(|v| v as i64).unwrap_or(elapsed_ms),
            })
        }
        "http" => {
            let http_code = output
                .split("HTTP_CODE=")
                .nth(1)
                .and_then(|s| s.split_whitespace().next())
                .unwrap_or("000");
            let time_sec = output
                .split("TIME=")
                .nth(1)
                .and_then(|s| s.split_whitespace().next())
                .and_then(|s| s.parse::<f64>().ok())
                .unwrap_or(0.0);
            let time_ms = (time_sec * 1000.0) as i64;

            let code_num: u16 = http_code.parse().unwrap_or(0);
            let success = (200..400).contains(&code_num);

            Ok(NetCheckResult {
                success,
                message: if success {
                    format!("HTTP {} ({}ms)", http_code, time_ms)
                } else if code_num == 0 {
                    "HTTP 연결 실패 (응답 없음)".to_string()
                } else {
                    format!("HTTP {} ({}ms)", http_code, time_ms)
                },
                response_time_ms: time_ms,
            })
        }
        _ => Err(format!("지원하지 않는 검사 타입: {}", check_type)),
    }
}

#[tauri::command]
pub async fn run_netcheck(
    server_host: String,
    server_port: u16,
    server_username: String,
    server_password: String,
    check_type: String,
    target_host: String,
    target_port: String,
    http_url: String,
) -> Result<NetCheckResult, String> {
    let command = build_check_command(&check_type, &target_host, &target_port, &http_url)?;

    let start = std::time::Instant::now();
    let output = crate::commands::ssh::ssh_execute(
        server_host,
        server_port,
        server_username,
        server_password,
        command,
    )
    .await;
    let elapsed = start.elapsed().as_millis() as i64;

    match output {
        Ok(stdout) => parse_check_result(&check_type, &stdout, elapsed),
        Err(e) => Ok(NetCheckResult {
            success: false,
            message: format!("SSH 실행 실패: {}", e),
            response_time_ms: -1,
        }),
    }
}
