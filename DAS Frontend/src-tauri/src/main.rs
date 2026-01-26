// Hide console window in release builds
#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use tauri::{Manager, command};
use tauri::webview::Color;
use std::sync::Mutex;
use std::process::{Command, Child, Stdio};
use std::fs::File;
use std::time::Duration;
use std::net::TcpStream;
use std::io::{Write, Read};
use std::thread;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

// Command to handle search functionality
#[command]
async fn handle_search(query: &str, _window: tauri::Window) -> Result<String, String> {
    #[cfg(debug_assertions)]
    println!("Search requested for: {}", query);
    // In a real implementation, this would perform the actual search
    Ok(format!("Searching for: {}", query))
}

// Command to toggle theme
#[command]
async fn toggle_theme(window: tauri::Window) -> Result<String, String> {
    #[cfg(debug_assertions)]
    println!("Theme toggle requested");
    // Toggle between light and dark theme
    let current_theme = window.theme().unwrap_or(tauri::Theme::Light);
    let new_theme = match current_theme {
        tauri::Theme::Light => tauri::Theme::Dark,
        tauri::Theme::Dark => tauri::Theme::Light,
        _ => tauri::Theme::Light, // Default to light theme for any other case
    };
    window.set_theme(Some(new_theme)).unwrap();
    // Adjust the overlay titlebar background color to match theme
    let color = match new_theme {
        tauri::Theme::Light => Color(255, 255, 255, 255),
        _ => Color(32, 32, 32, 255),
    };
    let _ = window.set_background_color(Some(color));
    Ok(format!("Theme toggled to {:?}", new_theme))
}

// Command to open settings
#[command]
async fn open_settings(_window: tauri::Window) -> Result<String, String> {
    #[cfg(debug_assertions)]
    println!("Settings requested");
    // In a real implementation, this would open the settings window
    Ok("Settings opened".to_string())
}

// Command to open directory in file explorer
#[command]
async fn open_directory(path: String) -> Result<(), String> {
    // Get the directory where the exe is located
    let exe_path = std::env::current_exe()
        .map_err(|e| format!("Failed to get exe path: {}", e))?;
    let exe_dir = exe_path.parent()
        .ok_or_else(|| "Cannot find exe directory".to_string())?;
    
    // Determine the target directory
    let target_dir = if path.is_empty() {
        // Open the app directory
        exe_dir.to_path_buf()
    } else {
        // Open a subdirectory (e.g., "director_notes")
        exe_dir.join(&path)
    };
    
    #[cfg(debug_assertions)]
    println!("Opening directory: {:?}", target_dir);
    
    // Create the directory if it doesn't exist
    if !target_dir.exists() {
        std::fs::create_dir_all(&target_dir)
            .map_err(|e| format!("Failed to create directory: {}", e))?;
    }
    
    // Open the directory in Windows Explorer
    #[cfg(target_os = "windows")]
    {
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        Command::new("explorer")
            .arg(target_dir.to_str().ok_or_else(|| "Invalid path".to_string())?)
            .creation_flags(CREATE_NO_WINDOW)
            .spawn()
            .map_err(|e| format!("Failed to open directory: {}", e))?;
    }
    
    #[cfg(not(target_os = "windows"))]
    {
        // For non-Windows systems (macOS, Linux)
        #[cfg(target_os = "macos")]
        let opener = "open";
        #[cfg(target_os = "linux")]
        let opener = "xdg-open";
        
        Command::new(opener)
            .arg(target_dir.to_str().ok_or_else(|| "Invalid path".to_string())?)
            .spawn()
            .map_err(|e| format!("Failed to open directory: {}", e))?;
    }
    
    Ok(())
}

// Backend process state
struct BackendProcess(Mutex<Option<Child>>);

fn wait_for_backend_ready(max_attempts: u32, delay_ms: u64) -> bool {
    // Wait for backend to be ready by checking the /health endpoint
    // Backend binds to 0.0.0.0 when running as exe, so we connect to 127.0.0.1
    // which the OS translates to localhost networking
    for _attempt in 0..max_attempts {
        match TcpStream::connect("127.0.0.1:8000") {
            Ok(mut stream) => {
                // Set a short timeout for the read operation
                if let Err(_) = stream.set_read_timeout(Some(Duration::from_millis(1000))) {
                    thread::sleep(Duration::from_millis(delay_ms));
                    continue;
                }
                
                // Send HTTP GET request to /health endpoint
                let request = "GET /health HTTP/1.1\r\nHost: 127.0.0.1:8000\r\nConnection: close\r\n\r\n";
                if stream.write_all(request.as_bytes()).is_ok() {
                    let mut response = vec![0u8; 2048];
                    match stream.read(&mut response) {
                        Ok(bytes_read) if bytes_read > 0 => {
                            let response_str = String::from_utf8_lossy(&response[..bytes_read]);
                            // Check for successful HTTP response with health check
                            if response_str.contains("HTTP/1.1 200") || response_str.contains("\"status\"") {
                                #[cfg(debug_assertions)]
                                println!("Backend is ready!");
                                return true;
                            }
                        }
                        _ => {}
                    }
                }
                thread::sleep(Duration::from_millis(delay_ms));
            }
            Err(_) => {
                // TCP connection failed, backend not yet listening
                #[cfg(debug_assertions)]
                println!("Waiting for backend...");
                thread::sleep(Duration::from_millis(delay_ms));
            }
        }
    }
    
    #[cfg(debug_assertions)]
    eprintln!("Backend readiness check timed out after {} attempts", max_attempts);
    false
}

fn terminate_backend_process(pid: u32) {
    // Use taskkill with /T to kill the entire process tree (including child processes)
    // /F forces termination, /T terminates the process tree
    #[cfg(target_os = "windows")]
    {
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        let _ = Command::new("taskkill")
            .args(&["/PID", &pid.to_string(), "/T", "/F"])
            .creation_flags(CREATE_NO_WINDOW)
            .output();
    }
    
    #[cfg(not(target_os = "windows"))]
    {
        let _ = Command::new("taskkill")
            .args(&["/PID", &pid.to_string(), "/T", "/F"])
            .output();
    }
    
    #[cfg(debug_assertions)]
    println!("taskkill sent for process tree starting at PID: {}", pid);
}

fn start_backend() -> Result<Child, std::io::Error> {
    // Get the directory where the exe is located
    let exe_path = std::env::current_exe()?;
    let exe_dir = exe_path.parent().ok_or_else(|| {
        std::io::Error::new(std::io::ErrorKind::NotFound, "Cannot find exe directory")
    })?;
    
    // Look for backend exe in the same directory
    let backend_path = exe_dir.join("school-management-backend.exe");
    
    #[cfg(debug_assertions)]
    println!("Looking for backend at: {:?}", backend_path);
    
    // Create log file for backend output
    let log_path = exe_dir.join("backend.log");
    let log_file = File::create(&log_path)?;
    let log_file_err = log_file.try_clone()?;
    
    #[cfg(debug_assertions)]
    println!("Backend log file: {:?}", log_path);
    
    let backend_exe = if backend_path.exists() {
        backend_path
    } else {
        // Try the sidecar naming convention
        let sidecar_path = exe_dir.join("school-management-backend-x86_64-pc-windows-msvc.exe");
        #[cfg(debug_assertions)]
        println!("Trying sidecar path: {:?}", sidecar_path);
        if sidecar_path.exists() {
            sidecar_path
        } else {
            return Err(std::io::Error::new(
                std::io::ErrorKind::NotFound,
                format!("Backend exe not found at {:?}", backend_path)
            ));
        }
    };
    
    let child = Command::new(&backend_exe)
        .current_dir(exe_dir)
        .env("PYTHONIOENCODING", "utf-8")  // Force UTF-8 encoding for Python
        .stdout(Stdio::from(log_file))
        .stderr(Stdio::from(log_file_err))
        .spawn()?;
    
    // Wait for backend to be ready (up to 20 seconds, checking every 200ms)
    // Increased timeout for packaged exe startup complexity and database initialization
    if !wait_for_backend_ready(100, 200) {
        #[cfg(debug_assertions)]
        eprintln!("Warning: Backend may not be ready yet");
    }
    
    Ok(child)
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![handle_search, toggle_theme, open_settings, open_directory])
        .setup(|app| {
            // Start the backend server
            match start_backend() {
                Ok(child) => {
                    #[cfg(debug_assertions)]
                    println!("Backend server started with PID: {}", child.id());
                    app.manage(BackendProcess(Mutex::new(Some(child))));
                }
                Err(e) => {
                    #[cfg(debug_assertions)]
                    eprintln!("Failed to start backend: {}", e);
                    #[cfg(not(debug_assertions))]
                    let _ = e; // Suppress unused variable warning in release builds
                    app.manage(BackendProcess(Mutex::new(None)));
                }
            }
            
            // Get main window - using standard Windows decorations (no overlay titlebar)
            // This gives us native Windows title bar with proper minimize/maximize/close buttons
            let main_window = app.get_webview_window("main").unwrap();
            
            // Theme-aware background on startup
            let color = match main_window.theme().unwrap_or(tauri::Theme::Light) {
                tauri::Theme::Light => Color(255, 255, 255, 255),
                _ => Color(32, 32, 32, 255),
            };
            let _ = main_window.set_background_color(Some(color));
            
            // Handle window close to ensure backend is terminated
            let app_handle_clone = app.handle().clone();
            main_window.on_window_event(move |event| {
                if let tauri::WindowEvent::CloseRequested { .. } = event {
                    // Don't prevent close - let Tauri handle it gracefully
                    // The RunEvent::Exit handler will clean up the backend
                    
                    // Spawn a thread to terminate the backend without blocking the UI
                    let app_handle_thread = app_handle_clone.clone();
                    std::thread::spawn(move || {
                        if let Some(backend) = app_handle_thread.try_state::<BackendProcess>() {
                            if let Ok(mut process) = backend.0.lock() {
                                if let Some(child) = process.take() {
                                    let pid = child.id();
                                    #[cfg(debug_assertions)]
                                    println!("Window close detected, terminating backend process tree (PID: {})", pid);
                                    
                                    terminate_backend_process(pid);
                                }
                            }
                        }
                    });
                }
            });
            
            // Devtools disabled in production via tauri.conf.json (devtools: false)
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            // Handle app exit to cleanup backend process
            if let tauri::RunEvent::Exit = event {
                if let Some(backend) = app_handle.try_state::<BackendProcess>() {
                    if let Ok(mut process) = backend.0.lock() {
                        if let Some(child) = process.take() {
                            let pid = child.id();
                            #[cfg(debug_assertions)]
                            println!("App exit detected, terminating backend process tree (PID: {})", pid);
                            
                            // Terminate the backend process tree without blocking
                            terminate_backend_process(pid);
                        }
                    }
                }
            }
        });
}