use std::{
    collections::{HashMap, VecDeque},
    marker::PhantomData,
    sync::Mutex,
    time::SystemTime,
};

use bevy::{log::Level, utils::tracing::Subscriber};
use chrono::{DateTime, Utc};
use rweb::Schema;
use serde::Serialize;
use tracing_subscriber::{field::Visit, registry::LookupSpan, Layer};

pub struct EventLayer<S>
where
    S: Subscriber + for<'span> LookupSpan<'span> + Send + Sync,
{
    _inner: PhantomData<S>,
}

impl<S> EventLayer<S>
where
    S: Subscriber + for<'span> LookupSpan<'span> + Send + Sync,
{
    pub fn new() -> Self {
        Self {
            _inner: PhantomData,
        }
    }
}

impl<S> Layer<S> for EventLayer<S>
where
    S: Subscriber + for<'span> LookupSpan<'span> + Send + Sync,
{
    fn on_event(
        &self,
        event: &bevy::utils::tracing::Event<'_>,
        _ctx: tracing_subscriber::layer::Context<'_, S>,
    ) {
        if event.metadata().target().contains("wgpu")
            || event.metadata().target().contains("warp")
            || event.metadata().target().contains("hyper")
            || event.metadata().target().contains("draw_state")
            || event.metadata().target().contains("diagnostic")
            || *event.metadata().level() == Level::TRACE
        {
            return;
        }

        if let Ok(mut events) = STORED_EVENTS.lock() {
            if events.len() == MAX_EVENTS {
                events.pop_back();
            }
            let mut record = StoredRecord::new();
            event.record(&mut record);
            events.push_front(StoredEvent {
                target: event.metadata().target().to_string(),
                time: SystemTime::now().into(),
                record,
            });
        }
    }
}

const MAX_EVENTS: usize = 300;

lazy_static::lazy_static! {
  pub(crate) static ref STORED_EVENTS: Mutex<VecDeque<StoredEvent>> = {
    Mutex::new(VecDeque::with_capacity(MAX_EVENTS))
  };
}

#[derive(Serialize, Debug, Schema, Clone)]
pub(crate) struct StoredEvent {
    target: String,
    time: DateTime<Utc>,
    record: StoredRecord,
}
#[derive(Serialize, Debug, Schema, Clone)]
pub(crate) struct StoredRecord {
    properties: HashMap<String, String>,
}

impl StoredRecord {
    fn new() -> Self {
        Self {
            properties: HashMap::new(),
        }
    }
}

impl Visit for StoredRecord {
    fn record_debug(
        &mut self,
        field: &bevy::utils::tracing::field::Field,
        value: &dyn std::fmt::Debug,
    ) {
        self.properties
            .insert(field.to_string(), format!("{:#?}", value));
    }
    fn record_str(&mut self, field: &bevy::utils::tracing::field::Field, value: &str) {
        self.properties.insert(field.to_string(), value.to_string());
    }
}
