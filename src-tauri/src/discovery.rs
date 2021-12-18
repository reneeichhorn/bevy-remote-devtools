use std::{
  collections::HashMap,
  sync::{Arc, Mutex},
};

use simple_mdns_client::MdnsClient;

#[derive(serde::Serialize, Eq, PartialEq, Hash, Debug, Clone)]
pub struct Client {
  host: String,
  port: u16,
}

pub struct ClientDiscovery {
  clients: Arc<Mutex<HashMap<Client, ()>>>,
}

impl ClientDiscovery {
  pub fn new() -> Self {
    let clients = Arc::new(Mutex::new(HashMap::new()));
    let clients_cloned = clients.clone();
    let _ = std::thread::spawn(move || {
      let mdns = MdnsClient::new("bevy-remote-v1._http._tcp.local").unwrap();

      loop {
        let services = mdns.get_services();

        {
          let mut clients = clients_cloned.lock().unwrap();
          clients.clear();

          for (service, reg) in services {
            clients.insert(
              Client {
                host: reg
                  .preferred_address
                  .map(|addr| addr.to_string())
                  .unwrap_or_else(|| service.host.clone()),
                port: service.port,
              },
              (),
            );
          }
        }

        std::thread::sleep(std::time::Duration::from_millis(5000));
      }
    });

    Self { clients }
  }
}

#[tauri::command]
pub fn get_clients(state: tauri::State<ClientDiscovery>) -> Vec<Client> {
  let clients = state.clients.lock().unwrap();
  clients.keys().map(|k| k.clone()).collect::<Vec<_>>()
}
