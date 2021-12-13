use bevy::{
    prelude::DynamicScene, reflect::TypeRegistry, scene::serde::SceneSerializer, window::Windows,
};
use rweb::*;
use serde::Serialize;
use std::{convert::Infallible, sync::Mutex};

use crate::{
    assets::{assets, get_asset_mesh},
    serialization::NumberToStringSerializer,
    sync::execute_in_world,
    tracing::{StoredEvent, STORED_EVENTS},
};

const VERSION: &str = env!("CARGO_PKG_VERSION");

#[derive(Serialize, Schema, Debug)]
struct Info {
    name: String,
    version: String,
}

#[get("/v1/info")]
#[cors(origins("*"))]
async fn info() -> Result<Json<Info>, Infallible> {
    let name = execute_in_world(|world| {
        let windows = world.get_resource::<Windows>().unwrap();
        windows.get_primary().unwrap().title().to_string()
    })
    .await;

    Ok(Info {
        name,
        version: VERSION.to_string(),
    }
    .into())
}

#[get("/v1/world")]
#[cors(origins("*"))]
async fn world() -> Result<String, Infallible> {
    let json = execute_in_world(|world| {
        let type_registry = world.get_resource::<TypeRegistry>().unwrap();
        let scene = DynamicScene::from_world(world, type_registry);
        let serializer = SceneSerializer::new(&scene, type_registry);
        serde_json::to_string(&NumberToStringSerializer(serializer)).unwrap()
    })
    .await;

    Ok(json)
}

#[get("/v1/tracing/events")]
#[cors(origins("*"), headers("content-type"))]
fn poll_tracing_events() -> Json<Vec<StoredEvent>> {
    let events = STORED_EVENTS.lock().unwrap();
    events.iter().cloned().collect::<Vec<_>>().into()
}

async fn api_main() {
    let (spec, filter) = openapi::spec().build(move || {
        poll_tracing_events()
            .or(info())
            .or(world())
            .or(assets())
            .or(get_asset_mesh())
    });

    let cors = warp::cors()
        .allow_any_origin()
        .allow_headers(vec![
            "User-Agent",
            "Sec-Fetch-Mode",
            "Referer",
            "Origin",
            "Access-Control-Request-Method",
            "Access-Control-Request-Headers",
            "Content-Type",
        ])
        .allow_methods(vec!["POST", "GET"])
        .build();

    serve(filter.or(openapi_docs(spec)).with(cors))
        .run(([0, 0, 0, 0], 3030))
        .await;
}

pub(crate) fn start() {
    // Run mdns responder to advertise itself on the network.
    let _ = std::thread::spawn(|| {
        let responder = libmdns::Responder::new().unwrap();
        let _svc = responder.register(
            "_http._tcp".to_owned(),
            "bevy-remote-v1".to_owned(),
            3030,
            &["path=/"],
        );

        loop {
            ::std::thread::sleep(::std::time::Duration::from_secs(10));
        }
    });

    let _ = std::thread::spawn(|| {
        let rt = tokio::runtime::Runtime::new().unwrap();
        rt.block_on(async {
            tokio::spawn(api_main());
        });
        if let Ok(receiver) = RUNTIME_CHANNEL_SENDER.1.lock() {
            loop {
                let task = receiver.recv().unwrap();
                task(&rt);
            }
        }
    });
}

lazy_static::lazy_static! {
  static ref RUNTIME_CHANNEL_SENDER: (Mutex<std::sync::mpsc::Sender<ChannelType>>, Mutex<std::sync::mpsc::Receiver<ChannelType>>) = {
    let (rx, tx) = std::sync::mpsc::channel();
    (Mutex::new(rx), Mutex::new(tx))
  };
}

type ChannelType = Box<dyn FnOnce(&tokio::runtime::Runtime) + Send>;
