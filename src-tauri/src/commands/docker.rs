use crate::models::server::DockerContainer;

fn parse_docker_ps(output: &str) -> Vec<DockerContainer> {
    output
        .lines()
        .filter(|line| !line.trim().is_empty())
        .filter_map(|line| {
            // Strip leading/trailing quotes that SSH shell may leave
            let line = line.trim().trim_matches('\'').trim_matches('"');
            let parts: Vec<&str> = line.splitn(7, '|').collect();
            if parts.len() >= 7 {
                Some(DockerContainer {
                    container_id: parts[0].trim().to_string(),
                    image: parts[1].trim().to_string(),
                    command: parts[2].trim().to_string(),
                    created: parts[3].trim().to_string(),
                    status: parts[4].trim().to_string(),
                    ports: parts[5].trim().to_string(),
                    names: parts[6].trim().to_string(),
                    cpu_percent: String::new(),
                    mem_usage: String::new(),
                    mem_percent: String::new(),
                    net_io: String::new(),
                    block_io: String::new(),
                })
            } else {
                None
            }
        })
        .collect()
}

fn merge_stats(containers: &mut Vec<DockerContainer>, stats_output: &str) {
    for line in stats_output.lines() {
        // Strip leading/trailing quotes that SSH shell may leave
        let line = line.trim().trim_matches('\'').trim_matches('"');
        if line.is_empty() {
            continue;
        }
        let parts: Vec<&str> = line.splitn(6, '|').collect();
        if parts.len() >= 6 {
            let id = parts[0].trim();
            if let Some(c) = containers.iter_mut().find(|c| {
                c.container_id == id
                    || c.container_id.starts_with(id)
                    || id.starts_with(&c.container_id)
                    || c.names == id
                    || c.names.eq_ignore_ascii_case(id)
            }) {
                c.cpu_percent = parts[1].trim().to_string();
                c.mem_usage = parts[2].trim().to_string();
                c.mem_percent = parts[3].trim().to_string();
                c.net_io = parts[4].trim().to_string();
                c.block_io = parts[5].trim().to_string();
            }
        }
    }
}

#[tauri::command]
pub async fn get_docker_containers(
    host: String,
    port: u16,
    username: String,
    password: String,
) -> Result<Vec<DockerContainer>, String> {
    let ps_cmd = r#"docker ps -a --format '{{.ID}}|{{.Image}}|{{.Command}}|{{.CreatedAt}}|{{.Status}}|{{.Ports}}|{{.Names}}'"#;
    let ps_output =
        crate::commands::ssh::ssh_execute(host.clone(), port, username.clone(), password.clone(), ps_cmd.to_string())
            .await?;

    let mut containers = parse_docker_ps(&ps_output);

    if !containers.is_empty() {
        let stats_cmd = r#"docker stats --no-stream --format '{{.Container}}|{{.CPUPerc}}|{{.MemUsage}}|{{.MemPerc}}|{{.NetIO}}|{{.BlockIO}}'"#;
        match crate::commands::ssh::ssh_execute(host, port, username, password, stats_cmd.to_string()).await {
            Ok(stats_output) => {
                merge_stats(&mut containers, &stats_output);
            }
            Err(e) => {
                eprintln!("[docker stats] failed: {}", e);
            }
        }
    }

    Ok(containers)
}

#[tauri::command]
pub fn docker_exec_terminal(
    host: String,
    port: u16,
    username: String,
    password: String,
    container_id: String,
) -> Result<(), String> {
    let docker_cmd = format!(
        "docker exec -it {} /bin/bash || docker exec -it {} /bin/sh",
        container_id, container_id
    );

    #[cfg(target_os = "windows")]
    {
        let ssh_cmd = format!(
            "ssh -o StrictHostKeyChecking=no -t {}@{} -p {} \"{}\"",
            username, host, port, docker_cmd
        );

        // Prepend chcp 65001 to set UTF-8 codepage for Korean support
        let full_cmd = format!("chcp 65001 >nul && {}", ssh_cmd);

        // Try wt (Windows Terminal)
        let wt_result = std::process::Command::new("wt")
            .args(["new-tab", "cmd", "/k", &full_cmd])
            .spawn();

        if wt_result.is_ok() {
            return Ok(());
        }

        // Try putty with command
        let putty_result = std::process::Command::new("putty")
            .args([
                "-ssh",
                &format!("{}@{}", username, host),
                "-P",
                &port.to_string(),
                "-pw",
                &password,
                "-m",
                &docker_cmd,
            ])
            .spawn();

        if putty_result.is_ok() {
            return Ok(());
        }

        // Fallback to cmd
        std::process::Command::new("cmd")
            .args(["/c", "start", "cmd", "/k", &full_cmd])
            .spawn()
            .map_err(|e| format!("Failed to open terminal: {}", e))?;
    }

    #[cfg(target_os = "macos")]
    {
        let script = format!(
            "tell application \"Terminal\" to do script \"ssh -o StrictHostKeyChecking=no -t {}@{} -p {} '{}'\"",
            username, host, port, docker_cmd
        );
        std::process::Command::new("osascript")
            .args(["-e", &script])
            .spawn()
            .map_err(|e| format!("Failed to open terminal: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        let ssh_cmd = format!(
            "ssh -o StrictHostKeyChecking=no -t {}@{} -p {} \"{}\"",
            username, host, port, docker_cmd
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

#[tauri::command]
pub async fn get_docker_logs(
    host: String,
    port: u16,
    username: String,
    password: String,
    container_id: String,
    tail: u32,
) -> Result<String, String> {
    let cmd = format!("docker logs --tail {} {}", tail, container_id);
    crate::commands::ssh::ssh_execute(host, port, username, password, cmd).await
}
