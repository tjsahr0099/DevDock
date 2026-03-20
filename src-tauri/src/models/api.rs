use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[allow(dead_code)]
pub struct ApiCollection {
    pub items: Vec<ApiItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind")]
#[allow(dead_code)]
pub enum ApiItem {
    #[serde(rename = "folder")]
    Folder {
        id: String,
        name: String,
        children: Vec<ApiItem>,
    },
    #[serde(rename = "request")]
    Request {
        id: String,
        name: String,
        method: String,
        url: String,
        headers: Vec<ApiHeader>,
        body: String,
        body_type: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiHeader {
    pub key: String,
    pub value: String,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HttpResponse {
    pub status: u16,
    pub status_text: String,
    pub headers: Vec<ApiHeader>,
    pub body: String,
    pub time_ms: u64,
    pub size_bytes: u64,
}
