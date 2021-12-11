use bevy::prelude::*;
use sync::execute_world_tasks;

mod api;
mod assets;
mod graph;
mod sync;
mod tracing;

struct RemoteDevToolsPlugin;

impl Plugin for RemoteDevToolsPlugin {
    fn build(&self, app: &mut App) {
        app.add_system(execute_world_tasks.exclusive_system());
    }
}

pub trait AppDevToolsExt {
    fn run_with_dev_tools(&mut self);
}

impl AppDevToolsExt for App {
    fn run_with_dev_tools(&mut self) {
        tracing::register();
        api::start_api();
        self.add_plugin(RemoteDevToolsPlugin).run();
    }
}
