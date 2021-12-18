use bevy::{
    diagnostic::{Diagnostics, FrameTimeDiagnosticsPlugin},
    prelude::DynamicScene,
    reflect::TypeRegistryArc,
    scene::serde::SceneSerializer,
    window::Windows,
};
use rweb::*;
use serde::Serialize;
use std::{convert::Infallible, sync::Mutex};

use crate::{
    assets::{assets, get_asset_mesh},
    serialization::NumberToStringSerializer,
    sync::execute_in_world,
    tracing_tracking::{get_tracing_events, trace_frames},
    DevToolsSettings,
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
    let name = execute_in_world(true, |world| {
        let name = world
            .get_resource::<DevToolsSettings>()
            .map(|settings| settings.name.clone())
            .flatten();
        let window_title = world
            .get_resource::<Windows>()
            .map(|windows| {
                windows
                    .get_primary()
                    .map(|primary| primary.title().to_string())
            })
            .flatten();
        name.or(window_title).unwrap_or_else(|| "Bevy".to_string())
    })
    .await;

    Ok(Info {
        name,
        version: VERSION.to_string(),
    }
    .into())
}
//        diagnostics: Res<Diagnostics>,

#[derive(Serialize, Schema, Debug, Default)]
struct FrameDiagnostics {
    fps: Option<f64>,
    frame_time: Option<f64>,
}

#[get("/v1/diagnostics/frame")]
#[cors(origins("*"))]
async fn diagnostics_frame() -> Result<Json<FrameDiagnostics>, Infallible> {
    let output = execute_in_world(false, |world| {
        if let Some(diagnostics) = world.get_resource::<Diagnostics>() {
            let fps = diagnostics
                .get(FrameTimeDiagnosticsPlugin::FPS)
                .map(|fps| fps.value())
                .flatten();
            let frame_time = diagnostics
                .get(FrameTimeDiagnosticsPlugin::FRAME_TIME)
                .map(|time| time.value())
                .flatten();
            Some(FrameDiagnostics { fps, frame_time })
        } else {
            None
        }
    })
    .await;
    Ok(output.unwrap_or_default().into())
}

#[get("/v1/world")]
#[cors(origins("*"))]
async fn world() -> Result<String, Infallible> {
    let json = execute_in_world(true, |world| {
        let type_registry = world.get_resource::<TypeRegistryArc>().unwrap();
        let scene = DynamicScene::from_world(world, type_registry);
        let serializer = SceneSerializer::new(&scene, type_registry);
        serde_json::to_string(&NumberToStringSerializer(serializer)).unwrap()
    })
    .await;

    Ok(json)
}

async fn api_main(port: u16) {
    let (spec, filter) = openapi::spec().build(move || {
        get_tracing_events()
            .or(info())
            .or(world())
            .or(assets())
            .or(get_asset_mesh())
            .or(trace_frames())
            .or(diagnostics_frame())
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
        .run(([0, 0, 0, 0], port))
        .await;
}

pub(crate) fn start(port: u16) {
    // Run mdns responder to advertise itself on the network.
    let _ = std::thread::spawn(move || {
        let responder = libmdns::Responder::new().unwrap();
        let _svc = responder.register(
            "_http._tcp".to_owned(),
            "bevy-remote-v1".to_owned(),
            port,
            &["path=/"],
        );

        loop {
            ::std::thread::sleep(::std::time::Duration::from_secs(10));
        }
    });

    let _ = std::thread::spawn(move || {
        let rt = tokio::runtime::Runtime::new().unwrap();
        rt.block_on(async {
            tokio::spawn(api_main(port));
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
