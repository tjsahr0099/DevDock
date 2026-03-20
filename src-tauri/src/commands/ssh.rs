use async_trait::async_trait;
use russh::client;
use russh_keys::key;
use std::sync::Arc;
use tokio::io::AsyncReadExt;

struct ClientHandler;

#[async_trait]
impl client::Handler for ClientHandler {
    type Error = russh::Error;

    async fn check_server_key(
        &mut self,
        _server_public_key: &key::PublicKey,
    ) -> Result<bool, Self::Error> {
        // Accept all server keys (like StrictHostKeyChecking=no)
        Ok(true)
    }
}

async fn connect_and_exec(
    host: &str,
    port: u16,
    username: &str,
    password: &str,
    command: &str,
) -> Result<String, String> {
    let mut config = client::Config::default();
    config.inactivity_timeout = Some(std::time::Duration::from_secs(3));
    let config = Arc::new(config);
    let handler = ClientHandler;

    let mut session = tokio::time::timeout(
        std::time::Duration::from_secs(3),
        client::connect(config, (host, port), handler),
    )
    .await
    .map_err(|_| "Connection timed out (3s)".to_string())?
    .map_err(|e| format!("Connection failed: {}", e))?;

    let authenticated = session
        .authenticate_password(username, password)
        .await
        .map_err(|e| format!("Authentication failed: {}", e))?;

    if !authenticated {
        return Err("Authentication failed: invalid credentials".to_string());
    }

    let mut channel = session
        .channel_open_session()
        .await
        .map_err(|e| format!("Failed to open channel: {}", e))?;

    channel
        .exec(true, command)
        .await
        .map_err(|e| format!("Failed to execute command: {}", e))?;

    let mut output = String::new();
    let mut buf = vec![0u8; 8192];

    loop {
        match channel.make_reader().read(&mut buf).await {
            Ok(0) => break,
            Ok(n) => {
                output.push_str(&String::from_utf8_lossy(&buf[..n]));
            }
            Err(_) => break,
        }
    }

    let _ = channel.close().await;

    Ok(output)
}

#[tauri::command]
pub async fn ssh_test_connection(
    host: String,
    port: u16,
    username: String,
    password: String,
) -> Result<bool, String> {
    let config = Arc::new(client::Config::default());
    let handler = ClientHandler;

    let mut session = client::connect(config, (host.as_str(), port), handler)
        .await
        .map_err(|e| format!("Connection failed: {}", e))?;

    let authenticated = session
        .authenticate_password(&username, &password)
        .await
        .map_err(|e| format!("Authentication failed: {}", e))?;

    let _ = session
        .disconnect(russh::Disconnect::ByApplication, "", "")
        .await;

    Ok(authenticated)
}

#[tauri::command]
pub async fn ssh_execute(
    host: String,
    port: u16,
    username: String,
    password: String,
    command: String,
) -> Result<String, String> {
    connect_and_exec(&host, port, &username, &password, &command).await
}

#[cfg(target_os = "windows")]
fn find_plink() -> Option<std::path::PathBuf> {
    // Check PATH
    if let Ok(output) = std::process::Command::new("where")
        .arg("plink.exe")
        .output()
    {
        if output.status.success() {
            let path_str = String::from_utf8_lossy(&output.stdout);
            if let Some(first_line) = path_str.lines().next() {
                let p = std::path::PathBuf::from(first_line.trim());
                if p.exists() {
                    return Some(p);
                }
            }
        }
    }

    // Check default PuTTY install locations
    let candidates = [
        r"C:\Program Files\PuTTY\plink.exe",
        r"C:\Program Files (x86)\PuTTY\plink.exe",
    ];
    for path in &candidates {
        let p = std::path::PathBuf::from(path);
        if p.exists() {
            return Some(p);
        }
    }

    None
}

#[tauri::command]
pub fn check_plink_installed() -> bool {
    #[cfg(target_os = "windows")]
    {
        find_plink().is_some()
    }
    #[cfg(not(target_os = "windows"))]
    {
        false
    }
}

#[cfg(target_os = "windows")]
fn ensure_putty_utf8_session() {
    // Create/update a PuTTY session "DevDock-UTF8" with UTF-8 encoding in the registry.
    // plink -load "DevDock-UTF8" will inherit this encoding setting.
    use winreg::enums::*;
    use winreg::RegKey;

    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    if let Ok((key, _)) = hkcu.create_subkey(r"Software\SimonTatham\PuTTY\Sessions\DevDock-UTF8") {
        let _ = key.set_value("LineCodePage", &"UTF-8");
    }
}

#[tauri::command]
pub fn open_ssh_terminal(
    host: String,
    port: u16,
    username: String,
    password: String,
) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let plink_path = find_plink().ok_or_else(|| "plink_not_found".to_string())?;
        let plink = plink_path.to_string_lossy().to_string();

        // Ensure a PuTTY session with UTF-8 encoding exists
        ensure_putty_utf8_session();

        let plink_cmd = format!(
            "chcp 65001 >nul && \"{}\" -load \"DevDock-UTF8\" -ssh {}@{} -P {} -pw {}",
            plink, username, host, port, password
        );

        // Try wt (Windows Terminal)
        let wt_result = std::process::Command::new("wt")
            .args(["new-tab", "cmd", "/k", &plink_cmd])
            .spawn();

        if wt_result.is_ok() {
            return Ok(());
        }

        // Fallback: cmd
        std::process::Command::new("cmd")
            .args(["/c", "start", "cmd", "/k", &plink_cmd])
            .spawn()
            .map_err(|e| format!("Failed to open terminal: {}", e))?;
    }

    #[cfg(target_os = "macos")]
    {
        let script = format!(
            "tell application \"Terminal\" to do script \"ssh -o StrictHostKeyChecking=no {}@{} -p {}\"",
            username, host, port
        );
        std::process::Command::new("osascript")
            .args(["-e", &script])
            .spawn()
            .map_err(|e| format!("Failed to open terminal: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        let ssh_cmd = format!(
            "ssh -o StrictHostKeyChecking=no {}@{} -p {}",
            username, host, port
        );
        std::process::Command::new("x-terminal-emulator")
            .args(["-e", &ssh_cmd])
            .spawn()
            .or_else(|_| {
                std::process::Command::new("gnome-terminal")
                    .args(["--", "bash", "-c", &ssh_cmd])
                    .spawn()
            })
            .map_err(|e| format!("Failed to open terminal: {}", e))?;
    }

    Ok(())
}
