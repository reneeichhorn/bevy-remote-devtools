use bevy::{log::LogSettings, prelude::*, utils::tracing::subscriber::set_global_default};
use tracing_subscriber::{prelude::*, EnvFilter, Registry};

use rweb::*;
use std::convert::Infallible;

mod chrome;
mod events;

pub(crate) use chrome::ChromeLayerController;
pub(crate) use events::*;

use crate::sync::execute_in_world;

use self::chrome::ChromeLayer;

pub fn init(app: &mut App) {
    let default_filter = {
        let settings = app.world.get_resource_or_insert_with(LogSettings::default);
        format!("{},{}", settings.level, settings.filter)
    };
    let filter_layer = EnvFilter::try_from_default_env()
        .or_else(|_| EnvFilter::try_new(&default_filter))
        .unwrap();
    let subscriber = Registry::default().with(filter_layer);

    let fmt_layer = tracing_subscriber::fmt::Layer::default();
    let subscriber = subscriber.with(fmt_layer);
    let subscriber = subscriber.with(EventLayer::new());
    let subscriber = subscriber.with(ChromeLayer::new());

    set_global_default(subscriber)
        .expect("Could not set global default tracing subscriber. If you've already set up a tracing subscriber, please disable LogPlugin from Bevy's DefaultPlugins");
}

#[get("/v1/tracing/frames/{n}")]
#[cors(origins("*"), headers("content-type"))]
pub(crate) async fn trace_frames(n: usize) -> Result<String, Infallible> {
    let mut output = String::with_capacity(n * 10 * 1024 * 1024);
    output += "[";

    // Wait for the next frame start and start tracing.
    let _ = execute_in_world(true, |_| ChromeLayerController::start()).await;

    for i in 0..n {
        // Wait for n frame ends.
        let future_output =
            execute_in_world(false, move |_| ChromeLayerController::stop(i != n - 1)).await;
        output += future_output.await.as_str();
        output += ",\n";
    }

    output.pop();
    output.pop();
    output += "]";

    Ok(output)
}

#[get("/v1/tracing/events")]
#[cors(origins("*"), headers("content-type"))]
pub(crate) fn get_tracing_events() -> Json<Vec<StoredEvent>> {
    let events = STORED_EVENTS.lock().unwrap();
    events.iter().cloned().collect::<Vec<_>>().into()
}
