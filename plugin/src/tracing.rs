use std::{
    collections::{HashMap, VecDeque},
    sync::{atomic::*, Mutex},
    time::SystemTime,
};

use bevy::utils::tracing::{field::Visit, span::*, *};
use chrono::{DateTime, Utc};
use rweb::Schema;
use serde::Serialize;

pub struct TracingSubscriber {
    next_id: AtomicUsize,
}

pub(crate) fn register() {
    bevy::utils::tracing::subscriber::set_global_default(TracingSubscriber {
        next_id: AtomicUsize::new(1),
    })
    .unwrap();
}

#[derive(Serialize, Debug, Schema)]
pub(crate) struct StoredEvent {
    target: String,
    time: DateTime<Utc>,
    record: StoredRecord,
}

const MAX_EVENTS: usize = 250;

lazy_static::lazy_static! {
  pub(crate) static ref PENDING_EVENTS: Mutex<VecDeque<StoredEvent>> = {
    Mutex::new(VecDeque::with_capacity(MAX_EVENTS))
  };
}

impl Subscriber for TracingSubscriber {
    fn new_span(&self, _attrs: &Attributes<'_>) -> Id {
        let id = self.next_id.fetch_add(1, Ordering::Relaxed);
        let id = Id::from_u64(id as u64);
        /*
        if !attrs.metadata().target().contains("wgpu") {
          let json = json!({
          "new_span": {
              "attributes": attrs.as_serde(),
              "id": id.as_serde(),
          }});
          println!("{}", json);
        }
        */
        id
    }

    fn event(&self, event: &Event<'_>) {
        if event.metadata().target().contains("wgpu")
            || event.metadata().target().contains("warp")
            || event.metadata().target().contains("hyper")
            || *event.metadata().level() == Level::TRACE
        {
            return;
        }

        if let Ok(mut events) = PENDING_EVENTS.lock() {
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

    fn enabled(&self, _metadata: &Metadata<'_>) -> bool {
        true
    }

    fn record(&self, _span: &span::Id, _values: &span::Record<'_>) {}

    fn record_follows_from(&self, _span: &span::Id, _follows: &span::Id) {}

    fn enter(&self, _span: &span::Id) {}

    fn exit(&self, _span: &span::Id) {}
}

#[derive(Serialize, Debug, Schema)]
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
    fn record_debug(&mut self, field: &field::Field, value: &dyn std::fmt::Debug) {
        self.properties
            .insert(field.to_string(), format!("{:#?}", value));
    }
    fn record_str(&mut self, field: &field::Field, value: &str) {
        self.properties.insert(field.to_string(), value.to_string());
    }
}
