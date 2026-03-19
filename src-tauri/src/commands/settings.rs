use std::fs;
use std::path::PathBuf;

fn get_data_dir() -> PathBuf {
    // Portable app: data dir next to the executable
    let exe_path = std::env::current_exe().unwrap_or_default();
    let exe_dir = exe_path.parent().unwrap_or_else(|| std::path::Path::new("."));
    let data_dir = exe_dir.join("data");

    // In dev mode, use a local data folder
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

#[tauri::command]
pub fn get_settings() -> Result<String, String> {
    let path = get_data_dir().join("settings.json");
    match fs::read_to_string(&path) {
        Ok(content) => Ok(content),
        Err(_) => Ok("{}".to_string()),
    }
}

#[tauri::command]
pub fn save_settings(data: String) -> Result<(), String> {
    let path = get_data_dir().join("settings.json");
    fs::write(&path, data).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_tab_settings() -> Result<String, String> {
    let path = get_data_dir().join("tab-settings.json");
    match fs::read_to_string(&path) {
        Ok(content) => Ok(content),
        Err(_) => Ok("[]".to_string()),
    }
}

#[tauri::command]
pub fn save_tab_settings(data: String) -> Result<(), String> {
    let path = get_data_dir().join("tab-settings.json");
    fs::write(&path, data).map_err(|e| e.to_string())
}
