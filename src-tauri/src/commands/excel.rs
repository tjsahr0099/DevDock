use rust_xlsxwriter::*;
use sqlx::Row;

use super::db;

#[tauri::command]
pub async fn generate_table_definition(
    host: String,
    port: u16,
    database: String,
    username: String,
    password: String,
    output_path: String,
    author: String,
    db_user: String,
    app: tauri::AppHandle,
) -> Result<String, String> {
    use tauri::Emitter;

    let tables = db::get_all_tables(
        host.clone(),
        port,
        database.clone(),
        username.clone(),
        password.clone(),
    )
    .await?;

    if tables.is_empty() {
        return Err("No tables found".to_string());
    }

    let mut workbook = Workbook::new();

    // Header format
    let header_fmt = Format::new()
        .set_bold()
        .set_background_color(Color::RGB(0xD9E1F2))
        .set_border(FormatBorder::Thin)
        .set_font_size(10.0);

    let cell_fmt = Format::new()
        .set_border(FormatBorder::Thin)
        .set_font_size(10.0);

    let title_fmt = Format::new()
        .set_bold()
        .set_font_size(14.0);

    let total = tables.len();

    for (i, table_name) in tables.iter().enumerate() {
        let progress = (i as f64 + 1.0) / total as f64;
        let _ = app.emit(
            "generate-progress",
            serde_json::json!({
                "message": format!("처리 중: {} ({}/{})", table_name, i + 1, total),
                "progress": progress
            }),
        );

        let columns = db::get_table_columns(
            host.clone(),
            port,
            database.clone(),
            username.clone(),
            password.clone(),
            table_name.clone(),
        )
        .await?;

        let indexes = db::get_table_indexes(
            host.clone(),
            port,
            database.clone(),
            username.clone(),
            password.clone(),
            table_name.clone(),
        )
        .await?;

        // Sheet name (max 31 chars)
        let sheet_name = if table_name.len() > 31 {
            &table_name[..31]
        } else {
            table_name
        };

        let sheet = workbook.add_worksheet();
        sheet.set_name(sheet_name).map_err(|e| e.to_string())?;

        // Title
        sheet
            .write_with_format(0, 0, format!("테이블: {}", table_name), &title_fmt)
            .map_err(|e| e.to_string())?;
        sheet
            .write(1, 0, format!("작성자: {}  |  DB User: {}", author, db_user))
            .map_err(|e| e.to_string())?;

        // Column headers
        let col_headers = ["No", "컬럼명", "타입", "Nullable", "Key", "기본값", "설명"];
        for (j, h) in col_headers.iter().enumerate() {
            sheet
                .write_with_format(3, j as u16, *h, &header_fmt)
                .map_err(|e| e.to_string())?;
        }

        // Column data
        for (j, col) in columns.iter().enumerate() {
            let row = (j + 4) as u32;
            sheet
                .write_with_format(row, 0, (j + 1) as u32, &cell_fmt)
                .map_err(|e| e.to_string())?;
            sheet
                .write_with_format(row, 1, &col.column_name, &cell_fmt)
                .map_err(|e| e.to_string())?;
            sheet
                .write_with_format(row, 2, &col.column_type, &cell_fmt)
                .map_err(|e| e.to_string())?;
            sheet
                .write_with_format(row, 3, &col.is_nullable, &cell_fmt)
                .map_err(|e| e.to_string())?;
            sheet
                .write_with_format(row, 4, &col.column_key, &cell_fmt)
                .map_err(|e| e.to_string())?;
            sheet
                .write_with_format(
                    row,
                    5,
                    col.column_default.as_deref().unwrap_or(""),
                    &cell_fmt,
                )
                .map_err(|e| e.to_string())?;
            sheet
                .write_with_format(row, 6, &col.column_comment, &cell_fmt)
                .map_err(|e| e.to_string())?;
        }

        // Index section
        if !indexes.is_empty() {
            let idx_start = (columns.len() + 6) as u32;
            sheet
                .write_with_format(idx_start, 0, "인덱스 정보", &title_fmt)
                .map_err(|e| e.to_string())?;

            let idx_headers = ["인덱스명", "컬럼명", "순서", "Unique"];
            for (j, h) in idx_headers.iter().enumerate() {
                sheet
                    .write_with_format(idx_start + 1, j as u16, *h, &header_fmt)
                    .map_err(|e| e.to_string())?;
            }

            for (j, idx) in indexes.iter().enumerate() {
                let row = idx_start + 2 + j as u32;
                sheet
                    .write_with_format(row, 0, &idx.index_name, &cell_fmt)
                    .map_err(|e| e.to_string())?;
                sheet
                    .write_with_format(row, 1, &idx.column_name, &cell_fmt)
                    .map_err(|e| e.to_string())?;
                sheet
                    .write_with_format(row, 2, idx.seq_in_index as u32, &cell_fmt)
                    .map_err(|e| e.to_string())?;
                sheet
                    .write_with_format(
                        row,
                        3,
                        if idx.non_unique == 0 { "YES" } else { "NO" },
                        &cell_fmt,
                    )
                    .map_err(|e| e.to_string())?;
            }
        }

        // Set column widths
        sheet.set_column_width(0, 5).map_err(|e| e.to_string())?;
        sheet.set_column_width(1, 25).map_err(|e| e.to_string())?;
        sheet.set_column_width(2, 20).map_err(|e| e.to_string())?;
        sheet.set_column_width(3, 10).map_err(|e| e.to_string())?;
        sheet.set_column_width(4, 8).map_err(|e| e.to_string())?;
        sheet.set_column_width(5, 15).map_err(|e| e.to_string())?;
        sheet.set_column_width(6, 30).map_err(|e| e.to_string())?;
    }

    let file_path = format!("{}/table_definition_{}.xlsx", output_path, database);
    workbook.save(&file_path).map_err(|e| e.to_string())?;

    let _ = app.emit(
        "generate-progress",
        serde_json::json!({
            "message": "완료!",
            "progress": 1.0
        }),
    );

    Ok(file_path)
}

#[tauri::command]
pub async fn generate_dictionary(
    host: String,
    port: u16,
    database: String,
    username: String,
    password: String,
    output_path: String,
    app: tauri::AppHandle,
) -> Result<String, String> {
    use tauri::Emitter;

    let url = format!(
        "mysql://{}:{}@{}:{}/{}",
        username, password, host, port, database
    );
    let pool = sqlx::mysql::MySqlPoolOptions::new()
        .max_connections(2)
        .connect(&url)
        .await
        .map_err(|e| format!("DB connection failed: {}", e))?;

    let _ = app.emit(
        "generate-progress",
        serde_json::json!({ "message": "데이터 사전 조회 중...", "progress": 0.1 }),
    );

    let rows = sqlx::query(
        "SELECT c.TABLE_NAME, c.COLUMN_NAME, c.COLUMN_TYPE, c.IS_NULLABLE, \
         c.COLUMN_KEY, c.COLUMN_DEFAULT, c.COLUMN_COMMENT, t.TABLE_COMMENT \
         FROM information_schema.COLUMNS c \
         JOIN information_schema.TABLES t ON c.TABLE_SCHEMA = t.TABLE_SCHEMA AND c.TABLE_NAME = t.TABLE_NAME \
         WHERE c.TABLE_SCHEMA = ? \
         ORDER BY c.TABLE_NAME, c.ORDINAL_POSITION",
    )
    .bind(&database)
    .fetch_all(&pool)
    .await
    .map_err(|e| format!("Query failed: {}", e))?;

    pool.close().await;

    let _ = app.emit(
        "generate-progress",
        serde_json::json!({ "message": "Excel 생성 중...", "progress": 0.5 }),
    );

    let mut workbook = Workbook::new();
    let sheet = workbook.add_worksheet();
    sheet.set_name("데이터 사전").map_err(|e| e.to_string())?;

    let header_fmt = Format::new()
        .set_bold()
        .set_background_color(Color::RGB(0xD9E1F2))
        .set_border(FormatBorder::Thin)
        .set_font_size(10.0);
    let cell_fmt = Format::new()
        .set_border(FormatBorder::Thin)
        .set_font_size(10.0);

    let headers = [
        "테이블명", "테이블 설명", "컬럼명", "타입", "Nullable", "Key", "기본값", "설명",
    ];
    for (j, h) in headers.iter().enumerate() {
        sheet
            .write_with_format(0, j as u16, *h, &header_fmt)
            .map_err(|e| e.to_string())?;
    }

    for (i, row) in rows.iter().enumerate() {
        let r = (i + 1) as u32;
        sheet.write_with_format(r, 0, row.get::<String, _>("TABLE_NAME"), &cell_fmt).map_err(|e| e.to_string())?;
        sheet.write_with_format(r, 1, row.get::<String, _>("TABLE_COMMENT"), &cell_fmt).map_err(|e| e.to_string())?;
        sheet.write_with_format(r, 2, row.get::<String, _>("COLUMN_NAME"), &cell_fmt).map_err(|e| e.to_string())?;
        sheet.write_with_format(r, 3, row.get::<String, _>("COLUMN_TYPE"), &cell_fmt).map_err(|e| e.to_string())?;
        sheet.write_with_format(r, 4, row.get::<String, _>("IS_NULLABLE"), &cell_fmt).map_err(|e| e.to_string())?;
        sheet.write_with_format(r, 5, row.get::<String, _>("COLUMN_KEY"), &cell_fmt).map_err(|e| e.to_string())?;
        sheet.write_with_format(r, 6, row.get::<Option<String>, _>("COLUMN_DEFAULT").unwrap_or_default(), &cell_fmt).map_err(|e| e.to_string())?;
        sheet.write_with_format(r, 7, row.get::<String, _>("COLUMN_COMMENT"), &cell_fmt).map_err(|e| e.to_string())?;
    }

    sheet.set_column_width(0, 25).map_err(|e| e.to_string())?;
    sheet.set_column_width(1, 25).map_err(|e| e.to_string())?;
    sheet.set_column_width(2, 25).map_err(|e| e.to_string())?;
    sheet.set_column_width(3, 20).map_err(|e| e.to_string())?;
    sheet.set_column_width(7, 30).map_err(|e| e.to_string())?;

    let file_path = format!("{}/dictionary_{}.xlsx", output_path, database);
    workbook.save(&file_path).map_err(|e| e.to_string())?;

    let _ = app.emit(
        "generate-progress",
        serde_json::json!({ "message": "완료!", "progress": 1.0 }),
    );

    Ok(file_path)
}
