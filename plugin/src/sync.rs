use std::sync::{Arc, Mutex};

use bevy::prelude::World;
use tokio::sync::Notify;

pub(crate) fn execute_world_tasks_begin(world: &mut World) {
    let receiver = CHANNEL_FRAME_START.1.lock().unwrap();
    while let Ok(task) = receiver.try_recv() {
        (task.task)(world);
    }
}

pub(crate) fn execute_world_tasks_end(world: &mut World) {
    let receiver = CHANNEL_FRAME_END.1.lock().unwrap();
    while let Ok(task) = receiver.try_recv() {
        (task.task)(world);
    }
}

pub(crate) fn execute_world_tasks_render_app(world: &mut World) {
    let receiver = CHANNEL_RENDER_APP.1.lock().unwrap();
    while let Ok(task) = receiver.try_recv() {
        (task.task)(world);
    }
}

struct WorldTask {
    task: Box<dyn FnOnce(&mut World) + Send + Sync + 'static>,
}

pub(crate) async fn execute_in_world<
    T: Send + Sync + 'static,
    F: FnOnce(&mut World) -> T + Send + Sync + 'static,
>(
    channel: ExecutionChannel,
    task: F,
) -> T {
    let notify = Arc::new(Notify::new());
    let output = Arc::new(Mutex::new(None));

    let notify_cloned = notify.clone();
    let output_cloned = output.clone();
    let boxed_task = Box::new(move |world: &mut World| {
        let mut output = output_cloned.lock().unwrap();
        *output = Some(task(world));
        notify_cloned.notify_one();
    });

    let world_task = WorldTask { task: boxed_task };
    {
        let channel = match channel {
            ExecutionChannel::FrameStart => &CHANNEL_FRAME_START.0,
            ExecutionChannel::FrameEnd => &CHANNEL_FRAME_END.0,
            ExecutionChannel::RenderApp => &CHANNEL_RENDER_APP.0,
        };

        let sender = channel.lock().unwrap();
        sender.send(world_task).unwrap();
    }

    notify.notified().await;

    let mut output = output.lock().unwrap();
    output.take().unwrap()
}

lazy_static::lazy_static! {
  static ref CHANNEL_FRAME_START: (Mutex<std::sync::mpsc::Sender<WorldTask>>, Mutex<std::sync::mpsc::Receiver<WorldTask>>) = {
    let (rx, tx) = std::sync::mpsc::channel();
    (Mutex::new(rx), Mutex::new(tx))
  };
  static ref CHANNEL_FRAME_END: (Mutex<std::sync::mpsc::Sender<WorldTask>>, Mutex<std::sync::mpsc::Receiver<WorldTask>>) = {
    let (rx, tx) = std::sync::mpsc::channel();
    (Mutex::new(rx), Mutex::new(tx))
  };
  static ref CHANNEL_RENDER_APP: (Mutex<std::sync::mpsc::Sender<WorldTask>>, Mutex<std::sync::mpsc::Receiver<WorldTask>>) = {
    let (rx, tx) = std::sync::mpsc::channel();
    (Mutex::new(rx), Mutex::new(tx))
  };
}

pub(crate) enum ExecutionChannel {
    FrameStart,
    FrameEnd,
    RenderApp,
}
