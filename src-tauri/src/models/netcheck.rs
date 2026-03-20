use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetCheckTarget {
    pub id: String,
    pub label: String,
    #[serde(rename = "type")]
    pub check_type: String,
    pub host: String,
    pub port: String,
    pub http_url: String,
}

/// Map of server_id -> targets
pub type NetCheckConfig = std::collections::HashMap<String, Vec<NetCheckTarget>>;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetCheckResult {
    pub success: bool,
    pub message: String,
    pub response_time_ms: i64,
}
