use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerInfo {
    pub id: String,
    pub name: String,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub password: String,
    pub description: String,
    pub display_order: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DockerContainer {
    pub container_id: String,
    pub image: String,
    pub command: String,
    pub created: String,
    pub status: String,
    pub ports: String,
    pub names: String,
    pub cpu_percent: String,
    pub mem_usage: String,
    pub mem_percent: String,
    pub net_io: String,
    pub block_io: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerHealth {
    pub hostname: String,
    pub uptime: String,
    pub load_average: String,
    pub cpu_usage: f64,
    pub cpu_cores: u32,
    pub mem_total: u64,
    pub mem_used: u64,
    pub mem_free: u64,
    pub mem_usage_percent: f64,
    pub swap_total: u64,
    pub swap_used: u64,
    pub disk_total: u64,
    pub disk_used: u64,
    pub disk_free: u64,
    pub disk_usage_percent: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrackedContainer {
    pub server_id: String,
    pub server_name: String,
    pub container_id: String,
    pub container_name: String,
    pub order: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PuttySession {
    pub name: String,
    pub host: String,
    pub port: u16,
    pub username: String,
}
