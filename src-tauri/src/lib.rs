mod commands;
mod models;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            // Settings
            commands::settings::get_settings,
            commands::settings::save_settings,
            commands::settings::get_tab_settings,
            commands::settings::save_tab_settings,
            // File system
            commands::fs::list_directory,
            commands::fs::read_text_file,
            commands::fs::save_text_file,
            commands::fs::open_in_explorer,
            commands::fs::open_external_url,
            // PlantUML
            commands::puml::render_puml_svg,
            // SSH
            commands::ssh::ssh_test_connection,
            commands::ssh::ssh_execute,
            commands::ssh::open_ssh_terminal,
            commands::ssh::check_plink_installed,
            // Docker
            commands::docker::get_docker_containers,
            commands::docker::get_docker_logs,
            commands::docker::docker_exec_terminal,
            // Server config
            commands::server_config::get_servers,
            commands::server_config::save_server,
            commands::server_config::delete_server,
            commands::server_config::save_servers_order,
            commands::server_config::get_tracked_containers,
            commands::server_config::save_tracked_containers,
            commands::server_config::import_putty_sessions,
            commands::server_config::get_server_health,
            // DB
            commands::db::test_db_connection,
            commands::db::get_all_tables,
            commands::db::get_table_columns,
            commands::db::get_table_indexes,
            // Excel
            commands::excel::generate_table_definition,
            commands::excel::generate_dictionary,
            // CallFlow
            commands::callflow::analyze_project,
            commands::callflow::build_analysis_tree,
            commands::callflow::generate_sequence_diagram,
            // Markdown
            commands::markdown::markdown_to_pdf,
            // NetCheck
            commands::netcheck::get_netcheck_targets,
            commands::netcheck::save_netcheck_targets,
            commands::netcheck::run_netcheck,
            // API Tester
            commands::api::get_api_collections,
            commands::api::save_api_collections,
            commands::api::send_http_request,
            // Git History
            commands::git::git_list_branches,
            commands::git::git_get_commits,
            commands::git::git_get_diff,
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
