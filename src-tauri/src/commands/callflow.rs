use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::Path;
use walkdir::WalkDir;

// ── Models ──

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClassMetadata {
    pub package_name: String,
    pub class_name: String,
    pub full_name: String,
    pub class_type: String, // CONTROLLER, SERVICE, REPOSITORY, COMPONENT, ENTITY, MAPPER, BATCH, EXTERNAL_CLIENT, OTHER
    pub annotations: Vec<String>,
    pub methods: Vec<MethodMetadata>,
    pub injected_fields: HashMap<String, String>, // field_name -> type
    pub base_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MethodMetadata {
    pub method_name: String,
    pub return_type: String,
    pub parameters: Vec<String>,
    pub annotations: Vec<String>,
    pub is_endpoint: bool,
    pub http_method: String,
    pub request_path: String,
    pub is_scheduled: bool,
    pub cron_expression: String,
    pub method_calls: Vec<MethodCall>,
    pub javadoc: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MethodCall {
    pub target_field: String,
    pub target_class: String,
    pub target_method: String,
    pub call_type: String, // INTERNAL, EXTERNAL_API, DB_ACCESS, MESSAGE_QUEUE
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalysisResult {
    pub classes: Vec<ClassMetadata>,
    pub errors: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct AnalysisTreeNode {
    pub label: String,
    pub node_type: String, // root, category, class, method
    pub class_name: Option<String>,
    pub method_name: Option<String>,
    pub children: Vec<AnalysisTreeNode>,
}

// ── Commands ──

#[tauri::command]
pub async fn analyze_project(project_path: String) -> Result<AnalysisResult, String> {
    let path = Path::new(&project_path);
    if !path.exists() {
        return Err("Project path does not exist".to_string());
    }

    let mut classes = Vec::new();
    let mut errors = Vec::new();

    for entry in WalkDir::new(path)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| {
            e.path().extension().map_or(false, |ext| ext == "java")
                && !e.path().to_string_lossy().contains("test")
                && !e.path().to_string_lossy().contains("Test")
        })
    {
        let file_path = entry.path();
        match fs::read_to_string(file_path) {
            Ok(content) => match parse_java_file(&content) {
                Some(mut class_meta) => {
                    // Phase 2: parse method calls
                    parse_all_method_calls(&content, &mut class_meta);
                    classes.push(class_meta);
                }
                None => {}
            },
            Err(e) => {
                errors.push(format!("{}: {}", file_path.display(), e));
            }
        }
    }

    // Resolve field types to class names
    resolve_field_types(&mut classes);

    Ok(AnalysisResult { classes, errors })
}

#[tauri::command]
pub fn build_analysis_tree(result: AnalysisResult) -> AnalysisTreeNode {
    let mut endpoints_node = AnalysisTreeNode {
        label: "API Endpoints".to_string(),
        node_type: "category".to_string(),
        class_name: None,
        method_name: None,
        children: Vec::new(),
    };

    let mut batch_node = AnalysisTreeNode {
        label: "Batch / Scheduler".to_string(),
        node_type: "category".to_string(),
        class_name: None,
        method_name: None,
        children: Vec::new(),
    };

    for class in &result.classes {
        let endpoint_methods: Vec<&MethodMetadata> =
            class.methods.iter().filter(|m| m.is_endpoint).collect();
        let scheduled_methods: Vec<&MethodMetadata> =
            class.methods.iter().filter(|m| m.is_scheduled).collect();

        if !endpoint_methods.is_empty() {
            let mut class_node = AnalysisTreeNode {
                label: class.class_name.clone(),
                node_type: "class".to_string(),
                class_name: Some(class.full_name.clone()),
                method_name: None,
                children: Vec::new(),
            };
            for method in endpoint_methods {
                class_node.children.push(AnalysisTreeNode {
                    label: format!("{} {}", method.http_method, method.request_path),
                    node_type: "method".to_string(),
                    class_name: Some(class.full_name.clone()),
                    method_name: Some(method.method_name.clone()),
                    children: Vec::new(),
                });
            }
            endpoints_node.children.push(class_node);
        }

        if !scheduled_methods.is_empty() {
            let mut class_node = AnalysisTreeNode {
                label: class.class_name.clone(),
                node_type: "class".to_string(),
                class_name: Some(class.full_name.clone()),
                method_name: None,
                children: Vec::new(),
            };
            for method in scheduled_methods {
                let label = if method.cron_expression.is_empty() {
                    method.method_name.clone()
                } else {
                    format!("{} [{}]", method.method_name, method.cron_expression)
                };
                class_node.children.push(AnalysisTreeNode {
                    label,
                    node_type: "method".to_string(),
                    class_name: Some(class.full_name.clone()),
                    method_name: Some(method.method_name.clone()),
                    children: Vec::new(),
                });
            }
            batch_node.children.push(class_node);
        }
    }

    AnalysisTreeNode {
        label: "분석 결과".to_string(),
        node_type: "root".to_string(),
        class_name: None,
        method_name: None,
        children: vec![endpoints_node, batch_node],
    }
}

#[tauri::command]
pub fn generate_sequence_diagram(
    result: AnalysisResult,
    class_name: String,
    method_name: String,
) -> Result<String, String> {
    let class = result
        .classes
        .iter()
        .find(|c| c.full_name == class_name)
        .ok_or_else(|| format!("Class not found: {}", class_name))?;

    let method = class
        .methods
        .iter()
        .find(|m| m.method_name == method_name)
        .ok_or_else(|| format!("Method not found: {}", method_name))?;

    let class_map: HashMap<String, &ClassMetadata> = result
        .classes
        .iter()
        .map(|c| (c.full_name.clone(), c))
        .chain(result.classes.iter().map(|c| (c.class_name.clone(), c)))
        .collect();

    let puml = generate_puml(class, method, &class_map);
    Ok(puml)
}

// ── Parsing ──

fn parse_java_file(content: &str) -> Option<ClassMetadata> {
    let package_re = Regex::new(r"package\s+([\w.]+)\s*;").unwrap();
    let class_re =
        Regex::new(r"(?:public\s+)?(?:abstract\s+)?(?:class|interface)\s+(\w+)").unwrap();

    let package_name = package_re
        .captures(content)
        .map(|c| c[1].to_string())
        .unwrap_or_default();

    let class_name = class_re.captures(content).map(|c| c[1].to_string())?;

    let full_name = if package_name.is_empty() {
        class_name.clone()
    } else {
        format!("{}.{}", package_name, class_name)
    };

    // Extract annotations
    let annotation_re = Regex::new(r"@(\w+)(?:\([^)]*\))?").unwrap();
    let annotations: Vec<String> = annotation_re
        .captures_iter(content)
        .map(|c| c[1].to_string())
        .collect();

    // Determine class type
    let class_type = determine_class_type(&annotations, &class_name);

    // Extract base path for controllers
    let base_path = extract_base_path(content, &class_type);

    // Extract injected fields
    let injected_fields = extract_injected_fields(content);

    // Extract methods
    let methods = extract_methods(content, &base_path);

    Some(ClassMetadata {
        package_name,
        class_name,
        full_name,
        class_type,
        annotations: annotations
            .into_iter()
            .collect::<HashSet<_>>()
            .into_iter()
            .collect(),
        methods,
        injected_fields,
        base_path,
    })
}

fn determine_class_type(annotations: &[String], class_name: &str) -> String {
    for ann in annotations {
        match ann.as_str() {
            "RestController" | "Controller" => return "CONTROLLER".to_string(),
            "Service" => return "SERVICE".to_string(),
            "Repository" => return "REPOSITORY".to_string(),
            "Component" => return "COMPONENT".to_string(),
            "Entity" => return "ENTITY".to_string(),
            "Mapper" => return "MAPPER".to_string(),
            "FeignClient" => return "EXTERNAL_CLIENT".to_string(),
            _ => {}
        }
    }

    // Fallback: naming convention
    if class_name.ends_with("Controller") {
        "CONTROLLER".to_string()
    } else if class_name.ends_with("Service") || class_name.ends_with("ServiceImpl") {
        "SERVICE".to_string()
    } else if class_name.ends_with("Repository") || class_name.ends_with("Mapper") {
        "REPOSITORY".to_string()
    } else if class_name.ends_with("Job") || class_name.ends_with("Scheduler") {
        "BATCH".to_string()
    } else {
        "OTHER".to_string()
    }
}

fn extract_base_path(content: &str, class_type: &str) -> String {
    if class_type != "CONTROLLER" {
        return String::new();
    }
    let re = Regex::new(r#"@RequestMapping\s*\(\s*(?:value\s*=\s*)?["']([^"']+)["']"#).unwrap();
    re.captures(content)
        .map(|c| c[1].to_string())
        .unwrap_or_default()
}

fn extract_injected_fields(content: &str) -> HashMap<String, String> {
    let mut fields = HashMap::new();

    // @Autowired, @Inject, @Resource fields
    let autowired_re = Regex::new(
        r"(?:@Autowired|@Inject|@Resource)\s+(?:private\s+)?(\w+)\s+(\w+)\s*;",
    )
    .unwrap();
    for cap in autowired_re.captures_iter(content) {
        fields.insert(cap[2].to_string(), cap[1].to_string());
    }

    // Constructor injection (private final Type field;)
    let has_lombok = content.contains("@RequiredArgsConstructor")
        || content.contains("@AllArgsConstructor");
    if has_lombok {
        let final_re =
            Regex::new(r"private\s+final\s+(\w+)\s+(\w+)\s*;").unwrap();
        for cap in final_re.captures_iter(content) {
            let type_name = &cap[1];
            // Skip primitive types and common non-bean types
            if !is_primitive_type(type_name) {
                fields.insert(cap[2].to_string(), type_name.to_string());
            }
        }
    }

    fields
}

fn is_primitive_type(type_name: &str) -> bool {
    matches!(
        type_name,
        "String"
            | "int"
            | "long"
            | "double"
            | "float"
            | "boolean"
            | "byte"
            | "char"
            | "short"
            | "Integer"
            | "Long"
            | "Double"
            | "Float"
            | "Boolean"
            | "List"
            | "Map"
            | "Set"
            | "Optional"
            | "Logger"
            | "ObjectMapper"
    )
}

fn extract_methods(content: &str, base_path: &str) -> Vec<MethodMetadata> {
    let mut methods = Vec::new();

    // Match method declarations with preceding annotations and javadoc
    let method_re = Regex::new(
        r"(?s)((?:/\*\*.*?\*/\s*)?(?:@\w+(?:\([^)]*\))?[\s\n]*)*)\s*(?:public|protected|private)\s+(?:static\s+)?(?:final\s+)?(\w+(?:<[^>]+>)?)\s+(\w+)\s*\(([^)]*)\)\s*(?:throws\s+[\w,\s]+)?\s*\{"
    ).unwrap();

    for cap in method_re.captures_iter(content) {
        let prefix = &cap[1];
        let return_type = cap[2].to_string();
        let method_name = cap[3].to_string();
        let params_str = cap[4].to_string();

        // Skip constructors and getters/setters
        if return_type == method_name
            || method_name.starts_with("get")
                && params_str.is_empty()
                && !prefix.contains("@GetMapping")
            || method_name.starts_with("set") && !prefix.contains("@")
        {
            continue;
        }

        let annotations = extract_annotation_list(prefix);
        let javadoc = extract_javadoc(prefix);
        let parameters: Vec<String> = if params_str.trim().is_empty() {
            Vec::new()
        } else {
            params_str
                .split(',')
                .map(|p| p.trim().to_string())
                .collect()
        };

        let (is_endpoint, http_method, request_path) =
            extract_endpoint_info(&annotations, prefix, base_path);
        let (is_scheduled, cron_expression) = extract_schedule_info(&annotations, prefix);

        methods.push(MethodMetadata {
            method_name,
            return_type,
            parameters,
            annotations,
            is_endpoint,
            http_method,
            request_path,
            is_scheduled,
            cron_expression,
            method_calls: Vec::new(),
            javadoc,
        });
    }

    methods
}

fn extract_annotation_list(prefix: &str) -> Vec<String> {
    let re = Regex::new(r"@(\w+)").unwrap();
    re.captures_iter(prefix)
        .map(|c| c[1].to_string())
        .collect()
}

fn extract_javadoc(prefix: &str) -> String {
    let re = Regex::new(r"(?s)/\*\*\s*(.*?)\s*\*/").unwrap();
    if let Some(cap) = re.captures(prefix) {
        let doc = &cap[1];
        let cleaned: Vec<&str> = doc
            .lines()
            .map(|l| l.trim().trim_start_matches('*').trim())
            .filter(|l| !l.is_empty() && !l.starts_with('@'))
            .collect();
        cleaned.join(" ")
    } else {
        String::new()
    }
}

fn extract_endpoint_info(
    annotations: &[String],
    prefix: &str,
    base_path: &str,
) -> (bool, String, String) {
    let mapping_re =
        Regex::new(r#"@(Get|Post|Put|Delete|Patch)Mapping\s*(?:\(\s*(?:value\s*=\s*)?["']?([^"')]+)["']?\s*\))?"#)
            .unwrap();

    if let Some(cap) = mapping_re.captures(prefix) {
        let method = cap[1].to_uppercase();
        let path = cap.get(2).map(|m| m.as_str()).unwrap_or("");
        let full_path = format!("{}{}", base_path, path);
        return (true, method, full_path);
    }

    // @RequestMapping with method
    let rm_re = Regex::new(
        r#"@RequestMapping\s*\([^)]*method\s*=\s*RequestMethod\.(\w+)[^)]*value\s*=\s*["']([^"']+)["']"#,
    )
    .unwrap();
    if let Some(cap) = rm_re.captures(prefix) {
        let method = cap[1].to_uppercase();
        let path = format!("{}{}", base_path, &cap[2]);
        return (true, method, path);
    }

    for ann in annotations {
        if ann == "GetMapping" || ann == "PostMapping" || ann == "PutMapping"
            || ann == "DeleteMapping" || ann == "PatchMapping"
        {
            let method = ann.replace("Mapping", "").to_uppercase();
            return (true, method, base_path.to_string());
        }
    }

    (false, String::new(), String::new())
}

fn extract_schedule_info(annotations: &[String], prefix: &str) -> (bool, String) {
    if !annotations.iter().any(|a| a == "Scheduled") {
        return (false, String::new());
    }

    let cron_re = Regex::new(r#"@Scheduled\s*\([^)]*cron\s*=\s*["']([^"']+)["']"#).unwrap();
    let cron = cron_re
        .captures(prefix)
        .map(|c| c[1].to_string())
        .unwrap_or_default();

    (true, cron)
}

fn parse_all_method_calls(content: &str, class: &mut ClassMetadata) {
    // Find method bodies and parse calls within them
    let method_body_re = Regex::new(
        r"(?:public|protected|private)\s+(?:static\s+)?(?:final\s+)?(?:\w+(?:<[^>]+>)?)\s+(\w+)\s*\([^)]*\)\s*(?:throws\s+[\w,\s]+)?\s*\{"
    ).unwrap();

    let field_names: Vec<String> = class.injected_fields.keys().cloned().collect();

    for cap in method_body_re.captures_iter(content) {
        let method_name = cap[1].to_string();
        let start = cap.get(0).unwrap().end();

        if let Some(body) = extract_method_body(content, start) {
            let calls = parse_method_calls_in_body(&body, &field_names, &class.injected_fields);

            if let Some(method) = class.methods.iter_mut().find(|m| m.method_name == method_name) {
                method.method_calls = calls;
            }
        }
    }
}

fn extract_method_body(content: &str, start: usize) -> Option<String> {
    let bytes = content.as_bytes();
    let mut depth = 1;
    let mut i = start;
    while i < bytes.len() && depth > 0 {
        match bytes[i] {
            b'{' => depth += 1,
            b'}' => depth -= 1,
            b'"' => {
                // Skip string literals
                i += 1;
                while i < bytes.len() && bytes[i] != b'"' {
                    if bytes[i] == b'\\' {
                        i += 1;
                    }
                    i += 1;
                }
            }
            b'/' if i + 1 < bytes.len() && bytes[i + 1] == b'/' => {
                // Skip line comments
                while i < bytes.len() && bytes[i] != b'\n' {
                    i += 1;
                }
            }
            _ => {}
        }
        i += 1;
    }
    if depth == 0 {
        Some(content[start..i - 1].to_string())
    } else {
        None
    }
}

fn parse_method_calls_in_body(
    body: &str,
    field_names: &[String],
    injected_fields: &HashMap<String, String>,
) -> Vec<MethodCall> {
    let mut calls = Vec::new();
    let mut seen = HashSet::new();

    // Match field.method() calls
    let call_re = Regex::new(r"(\w+)\.(\w+)\s*\(").unwrap();
    for cap in call_re.captures_iter(body) {
        let field = &cap[1];
        let method = &cap[2];

        if !field_names.contains(&field.to_string()) {
            continue;
        }

        let key = format!("{}.{}", field, method);
        if seen.contains(&key) {
            continue;
        }
        seen.insert(key);

        let type_name = injected_fields
            .get(field)
            .cloned()
            .unwrap_or_default();

        let call_type = determine_call_type(&type_name, method);

        calls.push(MethodCall {
            target_field: field.to_string(),
            target_class: type_name,
            target_method: method.to_string(),
            call_type,
        });
    }

    // Detect RestTemplate / WebClient / KafkaTemplate calls
    let http_re = Regex::new(
        r"(?:restTemplate|webClient)\s*\.\s*(\w+)\s*\(",
    )
    .unwrap();
    for cap in http_re.captures_iter(body) {
        let method = &cap[1];
        let key = format!("http.{}", method);
        if seen.contains(&key) {
            continue;
        }
        seen.insert(key);
        calls.push(MethodCall {
            target_field: "restTemplate".to_string(),
            target_class: "RestTemplate".to_string(),
            target_method: method.to_string(),
            call_type: "EXTERNAL_API".to_string(),
        });
    }

    let kafka_re = Regex::new(r"kafkaTemplate\s*\.\s*(\w+)\s*\(").unwrap();
    for cap in kafka_re.captures_iter(body) {
        let method = &cap[1];
        let key = format!("kafka.{}", method);
        if seen.contains(&key) {
            continue;
        }
        seen.insert(key);
        calls.push(MethodCall {
            target_field: "kafkaTemplate".to_string(),
            target_class: "KafkaTemplate".to_string(),
            target_method: method.to_string(),
            call_type: "MESSAGE_QUEUE".to_string(),
        });
    }

    calls
}

fn determine_call_type(type_name: &str, _method: &str) -> String {
    let lower = type_name.to_lowercase();
    if lower.ends_with("repository") || lower.ends_with("mapper") || lower.ends_with("dao") {
        "DB_ACCESS".to_string()
    } else if lower.contains("resttemplate")
        || lower.contains("webclient")
        || lower.ends_with("client")
        || lower.contains("feign")
    {
        "EXTERNAL_API".to_string()
    } else if lower.contains("kafka") || lower.contains("rabbit") || lower.contains("jms") {
        "MESSAGE_QUEUE".to_string()
    } else {
        "INTERNAL".to_string()
    }
}

fn resolve_field_types(classes: &mut Vec<ClassMetadata>) {
    let class_name_map: HashMap<String, String> = classes
        .iter()
        .map(|c| (c.class_name.clone(), c.full_name.clone()))
        .collect();

    for class in classes.iter_mut() {
        for method in &mut class.methods {
            for call in &mut method.method_calls {
                // Resolve simple class name to full name
                if let Some(full) = class_name_map.get(&call.target_class) {
                    call.target_class = full.clone();
                }
            }
        }
    }
}

// ── PlantUML Generation ──

fn generate_puml(
    class: &ClassMetadata,
    method: &MethodMetadata,
    class_map: &HashMap<String, &ClassMetadata>,
) -> String {
    let mut puml = String::new();
    puml.push_str("@startuml\n");
    puml.push_str("skinparam style strictuml\n");
    puml.push_str("skinparam sequenceMessageAlign center\n");
    puml.push_str("skinparam responseMessageBelowArrow true\n\n");

    // Title
    if method.is_endpoint {
        let title = if method.javadoc.is_empty() {
            format!("{} {}", method.http_method, method.request_path)
        } else {
            format!(
                "{} {} - {}",
                method.http_method, method.request_path, method.javadoc
            )
        };
        puml.push_str(&format!("title {}\n\n", title));
    } else if method.is_scheduled {
        let title = if method.cron_expression.is_empty() {
            method.method_name.clone()
        } else {
            format!("{} [{}]", method.method_name, method.cron_expression)
        };
        puml.push_str(&format!("title {}\n\n", title));
    }

    // Collect participants
    let mut participants = Vec::new();
    let mut participant_set = HashSet::new();

    if method.is_endpoint {
        puml.push_str("actor Client\n");
    } else {
        puml.push_str("entity Scheduler\n");
    }

    // Add the owning class
    let owner_stereo = get_stereotype(&class.class_type);
    puml.push_str(&format!(
        "participant \"{}\" as {} {}\n",
        class.class_name, class.class_name, owner_stereo
    ));
    participant_set.insert(class.class_name.clone());

    // Collect all participants recursively
    collect_participants(
        method,
        class_map,
        &mut participants,
        &mut participant_set,
        0,
    );

    for (name, stereo) in &participants {
        puml.push_str(&format!(
            "participant \"{}\" as {} {}\n",
            name, name, stereo
        ));
    }

    puml.push_str("\n");

    // Sequence
    if method.is_endpoint {
        puml.push_str(&format!(
            "Client -> {} : {} {}()\n",
            class.class_name, method.http_method, method.method_name
        ));
        puml.push_str(&format!("activate {}\n", class.class_name));
    } else {
        puml.push_str(&format!(
            "Scheduler -> {} : {}()\n",
            class.class_name, method.method_name
        ));
        puml.push_str(&format!("activate {}\n", class.class_name));
    }

    // Generate method calls
    generate_calls(
        &mut puml,
        &class.class_name,
        method,
        class_map,
        &mut HashSet::new(),
        1,
    );

    // Return
    if method.is_endpoint {
        puml.push_str(&format!(
            "{} --> Client : {}\n",
            class.class_name, method.return_type
        ));
        puml.push_str(&format!("deactivate {}\n", class.class_name));
    } else {
        puml.push_str(&format!(
            "{} --> Scheduler : done\n",
            class.class_name
        ));
        puml.push_str(&format!("deactivate {}\n", class.class_name));
    }

    puml.push_str("\n@enduml\n");
    puml
}

fn get_stereotype(class_type: &str) -> String {
    match class_type {
        "CONTROLLER" => "<<Controller>>".to_string(),
        "SERVICE" => "<<Service>>".to_string(),
        "REPOSITORY" => "<<Repository>>".to_string(),
        "COMPONENT" => "<<Component>>".to_string(),
        "ENTITY" => "<<Entity>>".to_string(),
        "MAPPER" => "<<Mapper>>".to_string(),
        "BATCH" => "<<Batch>>".to_string(),
        "EXTERNAL_CLIENT" => "<<External>>".to_string(),
        _ => String::new(),
    }
}

fn collect_participants(
    method: &MethodMetadata,
    class_map: &HashMap<String, &ClassMetadata>,
    participants: &mut Vec<(String, String)>,
    seen: &mut HashSet<String>,
    depth: usize,
) {
    if depth > 5 {
        return;
    }

    for call in &method.method_calls {
        let simple_name = call
            .target_class
            .rsplit('.')
            .next()
            .unwrap_or(&call.target_class);

        if seen.contains(simple_name) {
            continue;
        }

        let stereo = match call.call_type.as_str() {
            "DB_ACCESS" => "<<Repository>>".to_string(),
            "EXTERNAL_API" => "<<External>>".to_string(),
            "MESSAGE_QUEUE" => "<<MQ>>".to_string(),
            _ => {
                if let Some(target_class) = class_map.get(&call.target_class) {
                    get_stereotype(&target_class.class_type)
                } else if let Some(target_class) = class_map.get(simple_name) {
                    get_stereotype(&target_class.class_type)
                } else {
                    "<<Service>>".to_string()
                }
            }
        };

        seen.insert(simple_name.to_string());
        participants.push((simple_name.to_string(), stereo));

        // Recursively collect from target methods
        if let Some(target_class) = class_map
            .get(&call.target_class)
            .or_else(|| class_map.get(simple_name))
        {
            if let Some(target_method) = target_class
                .methods
                .iter()
                .find(|m| m.method_name == call.target_method)
            {
                collect_participants(target_method, class_map, participants, seen, depth + 1);
            }
        }
    }
}

fn generate_calls(
    puml: &mut String,
    caller: &str,
    method: &MethodMetadata,
    class_map: &HashMap<String, &ClassMetadata>,
    visited: &mut HashSet<String>,
    depth: usize,
) {
    if depth > 5 {
        return;
    }

    for call in &method.method_calls {
        let target_simple = call
            .target_class
            .rsplit('.')
            .next()
            .unwrap_or(&call.target_class);

        match call.call_type.as_str() {
            "DB_ACCESS" => {
                let op = guess_db_operation(&call.target_method);
                puml.push_str(&format!(
                    "note right of {} : [DB] {} {}\n",
                    caller, target_simple, op
                ));
            }
            "EXTERNAL_API" => {
                puml.push_str(&format!(
                    "{} -> {} : {}()\n",
                    caller, target_simple, call.target_method
                ));
                puml.push_str(&format!("activate {}\n", target_simple));
                puml.push_str(&format!("note right : External API call\n"));
                puml.push_str(&format!("{} --> {} : response\n", target_simple, caller));
                puml.push_str(&format!("deactivate {}\n", target_simple));
            }
            "MESSAGE_QUEUE" => {
                puml.push_str(&format!(
                    "{} -> {} : {}()\n",
                    caller, target_simple, call.target_method
                ));
                puml.push_str(&format!("activate {}\n", target_simple));
                puml.push_str(&format!("note right : Message Queue\n"));
                puml.push_str(&format!("{} --> {} : ack\n", target_simple, caller));
                puml.push_str(&format!("deactivate {}\n", target_simple));
            }
            _ => {
                // INTERNAL call
                let visit_key = format!("{}.{}", call.target_class, call.target_method);
                puml.push_str(&format!(
                    "{} -> {} : {}()\n",
                    caller, target_simple, call.target_method
                ));
                puml.push_str(&format!("activate {}\n", target_simple));

                if !visited.contains(&visit_key) {
                    visited.insert(visit_key);

                    // Recursively generate calls for target method
                    if let Some(target_class) = class_map
                        .get(&call.target_class)
                        .or_else(|| class_map.get(target_simple))
                    {
                        if let Some(target_method) = target_class
                            .methods
                            .iter()
                            .find(|m| m.method_name == call.target_method)
                        {
                            generate_calls(
                                puml,
                                target_simple,
                                target_method,
                                class_map,
                                visited,
                                depth + 1,
                            );
                        }
                    }
                }

                puml.push_str(&format!("{} --> {} : result\n", target_simple, caller));
                puml.push_str(&format!("deactivate {}\n", target_simple));
            }
        }
    }
}

fn guess_db_operation(method_name: &str) -> &'static str {
    let lower = method_name.to_lowercase();
    if lower.starts_with("find")
        || lower.starts_with("get")
        || lower.starts_with("select")
        || lower.starts_with("read")
        || lower.starts_with("query")
        || lower.starts_with("search")
        || lower.starts_with("count")
        || lower.starts_with("exists")
        || lower.starts_with("fetch")
        || lower.starts_with("load")
    {
        "SELECT"
    } else if lower.starts_with("save")
        || lower.starts_with("insert")
        || lower.starts_with("add")
        || lower.starts_with("create")
        || lower.starts_with("register")
    {
        "INSERT/UPDATE"
    } else if lower.starts_with("update")
        || lower.starts_with("modify")
        || lower.starts_with("change")
        || lower.starts_with("edit")
    {
        "UPDATE"
    } else if lower.starts_with("delete")
        || lower.starts_with("remove")
        || lower.starts_with("drop")
        || lower.starts_with("clear")
    {
        "DELETE"
    } else {
        "QUERY"
    }
}
