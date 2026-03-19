use crate::models::server::{PuttySession, ServerInfo, TrackedContainer};
use std::fs;
use std::path::PathBuf;

fn get_data_dir() -> PathBuf {
    let exe_path = std::env::current_exe().unwrap_or_default();
    let exe_dir = exe_path.parent().unwrap_or_else(|| std::path::Path::new("."));
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

// --- Server CRUD ---

fn servers_path() -> PathBuf {
    get_data_dir().join("servers.json")
}

fn read_servers() -> Vec<ServerInfo> {
    match fs::read_to_string(servers_path()) {
        Ok(content) => match serde_json::from_str(&content) {
            Ok(servers) => servers,
            Err(e) => {
                eprintln!("[DevDock] servers.json parse error: {}", e);
                eprintln!("[DevDock] path: {:?}", servers_path());
                vec![]
            }
        },
        Err(e) => {
            eprintln!("[DevDock] servers.json read error: {} path: {:?}", e, servers_path());
            vec![]
        }
    }
}

fn write_servers(servers: &[ServerInfo]) -> Result<(), String> {
    let json = serde_json::to_string_pretty(servers).map_err(|e| e.to_string())?;
    fs::write(servers_path(), json).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_servers() -> Result<Vec<ServerInfo>, String> {
    Ok(read_servers())
}

#[tauri::command]
pub fn save_server(server: ServerInfo) -> Result<(), String> {
    let mut servers = read_servers();
    if let Some(existing) = servers.iter_mut().find(|s| s.id == server.id) {
        *existing = server;
    } else {
        servers.push(server);
    }
    write_servers(&servers)
}

#[tauri::command]
pub fn delete_server(id: String) -> Result<(), String> {
    let mut servers = read_servers();
    servers.retain(|s| s.id != id);
    write_servers(&servers)
}

#[tauri::command]
pub fn save_servers_order(ids: Vec<String>) -> Result<(), String> {
    let mut servers = read_servers();
    for (i, id) in ids.iter().enumerate() {
        if let Some(s) = servers.iter_mut().find(|s| &s.id == id) {
            s.display_order = i as i32;
        }
    }
    servers.sort_by_key(|s| s.display_order);
    write_servers(&servers)
}

// --- Tracked Containers ---

fn tracked_path() -> PathBuf {
    get_data_dir().join("tracked-containers.json")
}

#[tauri::command]
pub fn get_tracked_containers() -> Result<Vec<TrackedContainer>, String> {
    match fs::read_to_string(tracked_path()) {
        Ok(content) => {
            let containers: Vec<TrackedContainer> =
                serde_json::from_str(&content).unwrap_or_default();
            Ok(containers)
        }
        Err(_) => Ok(vec![]),
    }
}

#[tauri::command]
pub fn save_tracked_containers(containers: Vec<TrackedContainer>) -> Result<(), String> {
    let json = serde_json::to_string_pretty(&containers).map_err(|e| e.to_string())?;
    fs::write(tracked_path(), json).map_err(|e| e.to_string())
}

// --- PuTTY Import ---

#[tauri::command]
pub fn import_putty_sessions() -> Result<Vec<PuttySession>, String> {
    #[cfg(target_os = "windows")]
    {
        use winreg::enums::*;
        use winreg::RegKey;

        let hkcu = RegKey::predef(HKEY_CURRENT_USER);
        let sessions_key = hkcu
            .open_subkey("Software\\SimonTatham\\PuTTY\\Sessions")
            .map_err(|e| format!("PuTTY sessions not found: {}", e))?;

        let mut sessions = Vec::new();

        for name in sessions_key.enum_keys().filter_map(|k| k.ok()) {
            if let Ok(session_key) = sessions_key.open_subkey(&name) {
                let host: String = session_key.get_value("HostName").unwrap_or_default();
                let port: u32 = session_key.get_value("PortNumber").unwrap_or(22);
                let username: String = session_key.get_value("UserName").unwrap_or_default();

                if !host.is_empty() {
                    let decoded_name = urlencoding_decode(&name);
                    sessions.push(PuttySession {
                        name: decoded_name,
                        host,
                        port: port as u16,
                        username,
                    });
                }
            }
        }

        Ok(sessions)
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err("PuTTY import is only available on Windows".to_string())
    }
}

#[cfg(target_os = "windows")]
fn urlencoding_decode(s: &str) -> String {
    // PuTTY URL-encodes session names: collect raw bytes first,
    // then try UTF-8, falling back to EUC-KR (CP949) for Korean Windows.
    let mut bytes = Vec::new();
    let mut chars = s.chars();
    while let Some(c) = chars.next() {
        if c == '%' {
            let hex: String = chars.by_ref().take(2).collect();
            if let Ok(byte) = u8::from_str_radix(&hex, 16) {
                bytes.push(byte);
            }
        } else {
            // ASCII char — push its bytes
            let mut buf = [0u8; 4];
            let encoded = c.encode_utf8(&mut buf);
            bytes.extend_from_slice(encoded.as_bytes());
        }
    }

    // Try UTF-8 first
    if let Ok(s) = String::from_utf8(bytes.clone()) {
        return s;
    }

    // Fallback: decode as EUC-KR (CP949)
    let (decoded, _, _) = encoding_rs::EUC_KR.decode(&bytes);
    decoded.into_owned()
}

// --- Server Health ---

use crate::models::server::ServerHealth;

#[tauri::command]
pub async fn get_server_health(
    host: String,
    port: u16,
    username: String,
    password: String,
) -> Result<ServerHealth, String> {
    let delim = "@@DELIM@@";
    let cmd = format!(
        r#"hostname; echo '{d}';
uptime -p 2>/dev/null || uptime; echo '{d}';
cat /proc/loadavg | awk '{{print $1", "$2", "$3}}'; echo '{d}';
nproc; echo '{d}';
grep 'cpu ' /proc/stat | awk '{{usage=($2+$4)*100/($2+$4+$5)}} END {{printf "%.1f\n", usage}}'; echo '{d}';
free -m | awk '/^Mem:/ {{print $2" "$3" "$4}}'; echo '{d}';
free -m | awk '/^Swap:/ {{print $2" "$3}}'; echo '{d}';
df -BG --total 2>/dev/null | awk '/^total/ {{gsub("G",""); print $2" "$3" "$4}}' || df -g / | awk 'NR==2 {{print $2" "$3" "$4}}'"#,
        d = delim
    );

    let output = crate::commands::ssh::ssh_execute(host, port, username, password, cmd).await?;
    let sections: Vec<&str> = output.split(delim).collect();

    if sections.len() < 8 {
        return Err(format!(
            "Unexpected output format (got {} sections, raw: {})",
            sections.len(),
            output.chars().take(300).collect::<String>()
        ));
    }

    let hostname = sections[0].trim().to_string();
    let uptime = sections[1].trim().to_string();
    let load_average = sections[2].trim().to_string();
    let cpu_cores: u32 = sections[3].trim().parse().unwrap_or(1);
    let cpu_usage: f64 = sections[4].trim().parse().unwrap_or(0.0);

    let mem_parts: Vec<u64> = sections[5]
        .split_whitespace()
        .filter_map(|s| s.parse().ok())
        .collect();
    let (mem_total, mem_used, mem_free) = (
        *mem_parts.first().unwrap_or(&0),
        *mem_parts.get(1).unwrap_or(&0),
        *mem_parts.get(2).unwrap_or(&0),
    );

    let swap_parts: Vec<u64> = sections[6]
        .split_whitespace()
        .filter_map(|s| s.parse().ok())
        .collect();
    let (swap_total, swap_used) = (
        *swap_parts.first().unwrap_or(&0),
        *swap_parts.get(1).unwrap_or(&0),
    );

    let disk_parts: Vec<u64> = sections[7]
        .split_whitespace()
        .filter_map(|s| s.parse().ok())
        .collect();
    let (disk_total, disk_used, disk_free) = (
        *disk_parts.first().unwrap_or(&0),
        *disk_parts.get(1).unwrap_or(&0),
        *disk_parts.get(2).unwrap_or(&0),
    );

    let mem_usage_percent = if mem_total > 0 {
        (mem_used as f64 / mem_total as f64) * 100.0
    } else {
        0.0
    };

    let disk_usage_percent = if disk_total > 0 {
        (disk_used as f64 / disk_total as f64) * 100.0
    } else {
        0.0
    };

    Ok(ServerHealth {
        hostname,
        uptime,
        load_average,
        cpu_usage,
        cpu_cores,
        mem_total,
        mem_used,
        mem_free,
        mem_usage_percent,
        swap_total,
        swap_used,
        disk_total,
        disk_used,
        disk_free,
        disk_usage_percent,
    })
}
