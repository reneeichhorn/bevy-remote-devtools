use bevy::prelude::*;
use sync::execute_world_tasks;

mod api;
mod assets;
//mod graph;
mod sync;
mod tracing;

pub struct RemoteDevToolsPlugin;

impl Plugin for RemoteDevToolsPlugin {
    fn build(&self, app: &mut App) {
        tracing::register();
        api::start();

        app.add_system(execute_world_tasks.exclusive_system());
    }
}
