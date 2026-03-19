use serde::Serialize;
use sqlx::mysql::MySqlPoolOptions;
use sqlx::{MySqlPool, Row};

#[derive(Debug, Clone, Serialize)]
pub struct ColumnInfo {
    pub column_name: String,
    pub column_type: String,
    pub is_nullable: String,
    pub column_key: String,
    pub column_default: Option<String>,
    pub column_comment: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct IndexInfo {
    pub index_name: String,
    pub column_name: String,
    pub seq_in_index: i64,
    pub non_unique: i64,
}

async fn create_pool(
    host: &str,
    port: u16,
    database: &str,
    username: &str,
    password: &str,
) -> Result<MySqlPool, String> {
    let url = format!(
        "mysql://{}:{}@{}:{}/{}",
        username, password, host, port, database
    );
    MySqlPoolOptions::new()
        .max_connections(2)
        .connect(&url)
        .await
        .map_err(|e| format!("DB connection failed: {}", e))
}

#[tauri::command]
pub async fn test_db_connection(
    host: String,
    port: u16,
    database: String,
    username: String,
    password: String,
) -> Result<bool, String> {
    let pool = create_pool(&host, port, &database, &username, &password).await?;
    let _result = sqlx::query("SELECT 1")
        .fetch_one(&pool)
        .await
        .map_err(|e| format!("Query failed: {}", e))?;
    pool.close().await;
    Ok(true)
}

#[tauri::command]
pub async fn get_all_tables(
    host: String,
    port: u16,
    database: String,
    username: String,
    password: String,
) -> Result<Vec<String>, String> {
    let pool = create_pool(&host, port, &database, &username, &password).await?;
    let rows = sqlx::query(
        "SELECT TABLE_NAME FROM information_schema.TABLES \
         WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE' \
         ORDER BY TABLE_NAME",
    )
    .bind(&database)
    .fetch_all(&pool)
    .await
    .map_err(|e| format!("Query failed: {}", e))?;

    let tables: Vec<String> = rows
        .iter()
        .map(|r| r.get::<String, _>("TABLE_NAME"))
        .collect();

    pool.close().await;
    Ok(tables)
}

#[tauri::command]
pub async fn get_table_columns(
    host: String,
    port: u16,
    database: String,
    username: String,
    password: String,
    table: String,
) -> Result<Vec<ColumnInfo>, String> {
    let pool = create_pool(&host, port, &database, &username, &password).await?;
    let rows = sqlx::query(
        "SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_KEY, \
         COLUMN_DEFAULT, COLUMN_COMMENT \
         FROM information_schema.COLUMNS \
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? \
         ORDER BY ORDINAL_POSITION",
    )
    .bind(&database)
    .bind(&table)
    .fetch_all(&pool)
    .await
    .map_err(|e| format!("Query failed: {}", e))?;

    let columns: Vec<ColumnInfo> = rows
        .iter()
        .map(|r| ColumnInfo {
            column_name: r.get("COLUMN_NAME"),
            column_type: r.get("COLUMN_TYPE"),
            is_nullable: r.get("IS_NULLABLE"),
            column_key: r.get("COLUMN_KEY"),
            column_default: r.get("COLUMN_DEFAULT"),
            column_comment: r.get("COLUMN_COMMENT"),
        })
        .collect();

    pool.close().await;
    Ok(columns)
}

#[tauri::command]
pub async fn get_table_indexes(
    host: String,
    port: u16,
    database: String,
    username: String,
    password: String,
    table: String,
) -> Result<Vec<IndexInfo>, String> {
    let pool = create_pool(&host, port, &database, &username, &password).await?;
    let rows = sqlx::query(
        "SELECT INDEX_NAME, COLUMN_NAME, SEQ_IN_INDEX, NON_UNIQUE \
         FROM information_schema.STATISTICS \
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? \
         ORDER BY INDEX_NAME, SEQ_IN_INDEX",
    )
    .bind(&database)
    .bind(&table)
    .fetch_all(&pool)
    .await
    .map_err(|e| format!("Query failed: {}", e))?;

    let indexes: Vec<IndexInfo> = rows
        .iter()
        .map(|r| IndexInfo {
            index_name: r.get("INDEX_NAME"),
            column_name: r.get("COLUMN_NAME"),
            seq_in_index: r.get("SEQ_IN_INDEX"),
            non_unique: r.get("NON_UNIQUE"),
        })
        .collect();

    pool.close().await;
    Ok(indexes)
}
