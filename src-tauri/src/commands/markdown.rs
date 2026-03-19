use comrak::{markdown_to_html, Options};
use std::path::{Path, PathBuf};

/// Convert markdown content to a full HTML document with styling
fn md_to_styled_html(content: &str) -> String {
    let mut options = Options::default();
    options.extension.strikethrough = true;
    options.extension.table = true;
    options.extension.autolink = true;
    options.extension.tasklist = true;
    options.render.unsafe_ = true;

    let html_body = markdown_to_html(content, &options);

    format!(
        r#"<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<style>
body {{
    font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif;
    line-height: 1.7;
    max-width: 900px;
    margin: 0 auto;
    padding: 40px 30px;
    color: #1a1a1a;
    font-size: 14px;
}}
h1 {{ font-size: 1.8em; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px; margin-top: 1.5em; }}
h2 {{ font-size: 1.4em; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px; margin-top: 1.3em; }}
h3 {{ font-size: 1.15em; margin-top: 1.2em; }}
p {{ margin: 0.8em 0; }}
code {{
    font-family: 'D2Coding', 'Consolas', monospace;
    background: #f3f4f6;
    padding: 2px 5px;
    border-radius: 3px;
    font-size: 0.9em;
}}
pre {{
    background: #f3f4f6;
    padding: 14px 18px;
    border-radius: 6px;
    overflow-x: auto;
    font-size: 0.88em;
    line-height: 1.5;
}}
pre code {{
    background: none;
    padding: 0;
}}
table {{
    border-collapse: collapse;
    width: 100%;
    margin: 1em 0;
    font-size: 0.92em;
}}
th, td {{
    border: 1px solid #d1d5db;
    padding: 8px 12px;
    text-align: left;
}}
th {{
    background: #f9fafb;
    font-weight: 600;
}}
blockquote {{
    border-left: 4px solid #d1d5db;
    margin: 1em 0;
    padding: 0.5em 1em;
    color: #4b5563;
    background: #f9fafb;
}}
ul, ol {{
    padding-left: 1.8em;
}}
li {{
    margin: 0.3em 0;
}}
hr {{
    border: none;
    border-top: 1px solid #e5e7eb;
    margin: 2em 0;
}}
img {{
    max-width: 100%;
}}
a {{
    color: #2563eb;
    text-decoration: none;
}}
</style>
</head>
<body>
{html_body}
</body>
</html>"#,
        html_body = html_body
    )
}

/// Find a Chromium-based browser executable on the system
fn find_browser() -> Option<PathBuf> {
    if cfg!(windows) {
        let candidates = [
            // Edge (always present on Windows 10/11)
            r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
            r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
            // Chrome
            r"C:\Program Files\Google\Chrome\Application\chrome.exe",
            r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        ];
        for path in &candidates {
            if Path::new(path).exists() {
                return Some(PathBuf::from(path));
            }
        }
        // Check user-level Chrome install
        if let Ok(local) = std::env::var("LOCALAPPDATA") {
            let chrome = PathBuf::from(&local)
                .join("Google")
                .join("Chrome")
                .join("Application")
                .join("chrome.exe");
            if chrome.exists() {
                return Some(chrome);
            }
        }
    } else if cfg!(target_os = "macos") {
        let candidates = [
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
            "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
        ];
        for path in &candidates {
            if Path::new(path).exists() {
                return Some(PathBuf::from(path));
            }
        }
    } else {
        // Linux
        let candidates = ["google-chrome", "chromium-browser", "chromium", "microsoft-edge"];
        for name in &candidates {
            if let Ok(output) = std::process::Command::new("which").arg(name).output() {
                if output.status.success() {
                    let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
                    if !path.is_empty() {
                        return Some(PathBuf::from(path));
                    }
                }
            }
        }
    }
    None
}

#[tauri::command]
pub async fn markdown_to_pdf(
    content: String,
    output_path: String,
) -> Result<String, String> {
    let browser = find_browser().ok_or_else(|| {
        "PDF 변환에 필요한 브라우저를 찾을 수 없습니다. Chrome 또는 Edge가 설치되어 있어야 합니다."
            .to_string()
    })?;

    // 1. Convert markdown to styled HTML
    let full_html = md_to_styled_html(&content);

    // 2. Write HTML to temp file
    let temp_dir = std::env::temp_dir();
    let temp_html = temp_dir.join("devdock_md_export.html");
    std::fs::write(&temp_html, &full_html).map_err(|e| format!("임시 HTML 파일 쓰기 실패: {e}"))?;

    // 3. Ensure output directory exists
    let pdf_path = PathBuf::from(&output_path);
    if let Some(parent) = pdf_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("출력 폴더 생성 실패: {e}"))?;
    }

    // 4. Use headless browser to print to PDF
    let temp_html_url = format!("file:///{}", temp_html.to_string_lossy().replace('\\', "/"));
    let output = std::process::Command::new(&browser)
        .arg("--headless")
        .arg("--disable-gpu")
        .arg("--no-sandbox")
        .arg("--run-all-compositor-stages-before-draw")
        .arg(format!("--print-to-pdf={}", pdf_path.display()))
        .arg(&temp_html_url)
        .output()
        .map_err(|e| format!("브라우저 실행 실패: {e}"))?;

    // Clean up temp file
    let _ = std::fs::remove_file(&temp_html);

    if pdf_path.exists() {
        Ok(pdf_path.to_string_lossy().to_string())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(format!(
            "PDF 생성에 실패했습니다.{}",
            if stderr.is_empty() {
                String::new()
            } else {
                format!("\n{stderr}")
            }
        ))
    }
}
