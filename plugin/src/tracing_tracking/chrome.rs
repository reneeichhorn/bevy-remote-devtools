use bevy::utils::tracing;
use tokio::sync::Notify;
use tracing::{span, Event, Subscriber};
use tracing_subscriber::{
    layer::Context,
    registry::{LookupSpan, SpanRef},
    Layer,
};

use json::{number::Number, object::Object, JsonValue};
use std::{
    fmt::Write,
    marker::PhantomData,
    sync::{
        atomic::{AtomicU64, Ordering},
        mpsc::Sender,
        Arc, Mutex,
    },
};

use std::cell::RefCell;

lazy_static::lazy_static! {
    static ref GLOBAL_OUT: Mutex<Option<Sender<Message>>> = Mutex::new(None);
    static ref LAST_TRACING_RESULT: Mutex<Option<String>> = Mutex::new(None);
}

pub(crate) struct ChromeLayerController;

impl ChromeLayerController {
    /// Tells the tracing layer to start tracing and clears all other traces before hands.
    pub(crate) fn start() {
        let mut output = GLOBAL_OUT.lock().unwrap();
        let output = output.as_mut().unwrap();
        output.send(Message::Start).unwrap();
    }

    /// Stops the active tracing and returns the result of the tracing.
    pub(crate) async fn stop(immediate_start: bool) -> String {
        let notify = {
            let mut output = GLOBAL_OUT.lock().unwrap();
            let output = output.as_mut().unwrap();
            let notify = Arc::new(Notify::new());
            output.send(Message::Stop(notify.clone())).unwrap();
            if immediate_start {
                output.send(Message::Start).unwrap();
            }
            notify
        };
        notify.notified().await;
        let mut result_lock = LAST_TRACING_RESULT.lock().unwrap();
        result_lock.take().unwrap()
    }
}

thread_local! {
    static OUT: RefCell<Option<Sender<Message>>> = RefCell::new(None);
    static TID: RefCell<Option<(u64, u64)>> = RefCell::new(None);
}

type NameFn<S> = Box<dyn Fn(&EventOrSpan<'_, '_, S>) -> String + Send + Sync>;

pub struct ChromeLayer<S>
where
    S: Subscriber + for<'span> LookupSpan<'span> + Send + Sync,
{
    out: Arc<Mutex<Sender<Message>>>,
    start: std::time::Instant,
    max_tid: AtomicU64,
    session: Arc<AtomicU64>,
    include_args: bool,
    include_locations: bool,
    name_fn: Option<NameFn<S>>,
    cat_fn: Option<NameFn<S>>,
    _inner: PhantomData<S>,
}

struct Callsite {
    tid: u64,
    name: String,
    target: String,
    file: Option<&'static str>,
    line: Option<u32>,
    args: Option<Arc<Object>>,
}

enum Message {
    Enter(f64, Callsite, Option<u64>),
    Event(f64, Callsite),
    Exit(f64, Callsite, Option<u64>),
    NewThread(u64, String),
    Start,
    Stop(Arc<Notify>),
}

pub enum EventOrSpan<'a, 'b, S>
where
    S: Subscriber + for<'span> LookupSpan<'span> + Send + Sync,
{
    Event(&'a Event<'b>),
    Span(&'a SpanRef<'b, S>),
}

impl<S> ChromeLayer<S>
where
    S: Subscriber + for<'span> LookupSpan<'span> + Send + Sync,
{
    pub fn new() -> ChromeLayer<S> {
        let (tx, rx) = std::sync::mpsc::channel::<Message>();
        OUT.with(|val| val.replace(Some(tx.clone())));
        let mut global_out = GLOBAL_OUT.lock().unwrap();
        *global_out = Some(tx.clone());

        let session = Arc::new(AtomicU64::new(0));
        let session_clone = session.clone();
        let _handle = std::thread::spawn(move || {
            let mut running = false;
            let mut write = String::with_capacity(10 * 1024 * 1024);

            for msg in rx {
                match &msg {
                    Message::Start => {
                        write.clear();
                        write.write_str("[").unwrap();
                        session_clone.fetch_add(1, Ordering::Relaxed);
                        running = true;
                        continue;
                    }
                    Message::Stop(notify) => {
                        write.pop(); // JSON doesn't like trailing comma
                        write.pop();
                        write.write_str("]").unwrap();
                        running = false;
                        let mut output = LAST_TRACING_RESULT.lock().unwrap();
                        *output = Some(write.clone());
                        notify.notify_one();
                        continue;
                    }
                    _ => {}
                }

                if !running {
                    continue;
                }

                let mut entry = Object::new();

                let (ph, ts, callsite, id) = match &msg {
                    Message::Enter(ts, callsite, None) => ("B", Some(ts), Some(callsite), None),
                    Message::Enter(ts, callsite, Some(root_id)) => {
                        ("b", Some(ts), Some(callsite), Some(root_id))
                    }
                    Message::Event(ts, callsite) => ("i", Some(ts), Some(callsite), None),
                    Message::Exit(ts, callsite, None) => ("E", Some(ts), Some(callsite), None),
                    Message::Exit(ts, callsite, Some(root_id)) => {
                        ("e", Some(ts), Some(callsite), Some(root_id))
                    }
                    Message::NewThread(_tid, _name) => ("M", None, None, None),
                    _ => unreachable!("Start | Stop message is handled earlier."),
                };
                entry.insert("ph", ph.to_string().into());
                entry.insert("pid", 1.into());

                if let Message::NewThread(tid, name) = msg {
                    entry.insert("name", "thread_name".to_string().into());
                    entry.insert("tid", tid.into());
                    let mut args = Object::new();
                    args.insert("name", name.into());
                    entry.insert("args", args.into());
                } else {
                    let ts = ts.unwrap();
                    let callsite = callsite.unwrap();
                    entry.insert("ts", JsonValue::Number(Number::from(*ts)));
                    entry.insert("name", callsite.name.clone().into());
                    entry.insert("cat", callsite.target.clone().into());
                    entry.insert("tid", callsite.tid.into());

                    if let Some(&id) = id {
                        entry.insert("id", id.into());
                    }

                    if ph == "i" {
                        entry.insert("s", "p".into());
                    }

                    let mut args = Object::new();
                    if let (Some(file), Some(line)) = (callsite.file, callsite.line) {
                        args.insert("[file]", file.to_string().into());
                        args.insert("[line]", line.into());
                    }

                    if let Some(call_args) = &callsite.args {
                        for (k, v) in call_args.iter() {
                            args.insert(k, v.clone());
                        }
                    }

                    if !args.is_empty() {
                        entry.insert("args", args.into());
                    }
                }

                write.write_str(entry.dump().as_str()).unwrap();
                write.write_str(",\n").unwrap();
            }
        });

        ChromeLayer {
            out: Arc::new(Mutex::new(tx)),
            start: std::time::Instant::now(),
            max_tid: AtomicU64::new(0),
            session,
            /*
            name_fn: Some(Box::new(|event_or_span| match event_or_span {
                EventOrSpan::Event(event) => event.metadata().name().into(),
                EventOrSpan::Span(span) => {
                    if let Some(fields) = span.extensions().get::<FormattedFields<DefaultFields>>()
                    {
                        format!("{}: {}", span.metadata().name(), fields.fields.as_str())
                    } else {
                        span.metadata().name().into()
                    }
                }
            })),
            */
            name_fn: None,
            cat_fn: None,
            include_args: true,
            include_locations: true,
            _inner: PhantomData::default(),
        }
    }

    fn get_tid(&self) -> (u64, bool) {
        let current_session = self.session.load(Ordering::Relaxed);
        TID.with(|value| {
            let tid = *value.borrow();
            match tid {
                Some((session, tid)) => {
                    let is_new = session != current_session;
                    if is_new {
                        value.replace(Some((current_session, tid)));
                    }
                    (tid, is_new)
                }
                None => {
                    let tid = self.max_tid.fetch_add(1, Ordering::SeqCst);
                    value.replace(Some((current_session, tid)));
                    (tid, true)
                }
            }
        })
    }

    fn get_callsite(&self, data: EventOrSpan<S>) -> Callsite {
        let (tid, new_thread) = self.get_tid();
        let name = self.name_fn.as_ref().map(|name_fn| name_fn(&data));
        let target = self.cat_fn.as_ref().map(|cat_fn| cat_fn(&data));
        let meta = match data {
            EventOrSpan::Event(e) => e.metadata(),
            EventOrSpan::Span(s) => s.metadata(),
        };
        let args = match data {
            EventOrSpan::Event(e) => {
                if self.include_args {
                    let mut args = Object::new();
                    e.record(&mut JsonVisitor { object: &mut args });
                    Some(Arc::new(args))
                } else {
                    None
                }
            }
            EventOrSpan::Span(s) => s
                .extensions()
                .get::<ArgsWrapper>()
                .map(|e| Arc::clone(&e.args)),
        };
        let name = name.unwrap_or_else(|| meta.name().into());
        let target = target.unwrap_or_else(|| meta.target().into());
        let (file, line) = if self.include_locations {
            (meta.file(), meta.line())
        } else {
            (None, None)
        };

        if new_thread {
            let name = match std::thread::current().name() {
                Some(name) => name.to_owned(),
                None => tid.to_string(),
            };
            self.send_message(Message::NewThread(tid, name));
        }

        Callsite {
            tid,
            name,
            target,
            file,
            line,
            args,
        }
    }

    fn enter_span(&self, span: SpanRef<S>, ts: f64) {
        let callsite = self.get_callsite(EventOrSpan::Span(&span));
        self.send_message(Message::Enter(ts, callsite, None));
    }

    fn exit_span(&self, span: SpanRef<S>, ts: f64) {
        let callsite = self.get_callsite(EventOrSpan::Span(&span));
        self.send_message(Message::Exit(ts, callsite, None));
    }

    fn get_ts(&self) -> f64 {
        self.start.elapsed().as_nanos() as f64 / 1000.0
    }

    fn send_message(&self, message: Message) {
        OUT.with(move |val| {
            if val.borrow().is_some() {
                let _ignored = val.borrow().as_ref().unwrap().send(message);
            } else {
                let out = self.out.lock().unwrap().clone();
                let _ignored = out.send(message);
                val.replace(Some(out));
            }
        });
    }
}

impl<S> Layer<S> for ChromeLayer<S>
where
    S: Subscriber + for<'span> LookupSpan<'span> + Send + Sync,
{
    fn on_enter(&self, id: &span::Id, ctx: Context<'_, S>) {
        let ts = self.get_ts();
        self.enter_span(ctx.span(id).expect("Span not found."), ts);
    }

    fn on_event(&self, event: &Event<'_>, _ctx: Context<'_, S>) {
        let ts = self.get_ts();
        let callsite = self.get_callsite(EventOrSpan::Event(event));
        self.send_message(Message::Event(ts, callsite));
    }

    fn on_exit(&self, id: &span::Id, ctx: Context<'_, S>) {
        let ts = self.get_ts();
        self.exit_span(ctx.span(id).expect("Span not found."), ts);
    }

    fn on_new_span(&self, attrs: &span::Attributes<'_>, id: &span::Id, ctx: Context<'_, S>) {
        let _ts = self.get_ts();
        if self.include_args {
            let mut args = Object::new();
            attrs.record(&mut JsonVisitor { object: &mut args });
            ctx.span(id).unwrap().extensions_mut().insert(ArgsWrapper {
                args: Arc::new(args),
            });
        }
    }

    fn on_close(&self, _id: span::Id, _ctx: Context<'_, S>) {}
}

struct JsonVisitor<'a> {
    object: &'a mut json::object::Object,
}

impl<'a> tracing_subscriber::field::Visit for JsonVisitor<'a> {
    fn record_debug(&mut self, field: &tracing::field::Field, value: &dyn std::fmt::Debug) {
        self.object
            .insert(field.name(), JsonValue::String(format!("{:?}", value)));
    }
}

struct ArgsWrapper {
    args: Arc<Object>,
}
