#![cfg_attr(
  all(not(debug_assertions), target_os = "windows"),
  windows_subsystem = "windows"
)]

mod discovery;

use discovery::*;
use log::info;

fn main() {
  env_logger::init();
  info!("Starting tauri...");

  tauri::Builder::default()
    .manage(discovery::ClientDiscovery::new())
    .invoke_handler(tauri::generate_handler![get_clients])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
