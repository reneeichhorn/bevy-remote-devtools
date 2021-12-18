use bevy::prelude::*;
use sync::*;

mod api;
mod assets;
mod serialization;
mod sync;
mod tracing_tracking;

pub struct RemoteDevToolsPlugin {
    pub port: u16,
    pub name: Option<String>,
}

impl RemoteDevToolsPlugin {
    pub fn new(name: &str, port: u16) -> Self {
        Self {
            name: Some(name.to_string()),
            port,
        }
    }
}

impl Default for RemoteDevToolsPlugin {
    fn default() -> Self {
        Self {
            name: None,
            port: 3030,
        }
    }
}

pub(crate) struct DevToolsSettings {
    name: Option<String>,
}

impl Plugin for RemoteDevToolsPlugin {
    fn build(&self, app: &mut App) {
        app.insert_resource(DevToolsSettings {
            name: self.name.clone(),
        });

        app.register_type::<DevInfo>();

        tracing_tracking::init(app);
        api::start(self.port);

        app.add_stage_before(
            CoreStage::First,
            "devtools_begin",
            SystemStage::single_threaded(),
        );
        app.add_stage_after(
            CoreStage::Last,
            "devtools_end",
            SystemStage::single_threaded(),
        );
        app.add_system_to_stage(
            "devtools_begin",
            execute_world_tasks_begin.exclusive_system(),
        );
        app.add_system_to_stage("devtools_end", execute_world_tasks_end.exclusive_system());
    }
}

#[derive(Component, Reflect, Default)]
#[reflect(Component)]
pub struct DevInfo {
    pub name: String,
    pub module: String,
}

#[macro_export]
macro_rules! dev_named {
    ($name:expr) => {
        $crate::DevInfo {
            name: $name.to_string(),
            module: module_path!().to_string(),
        }
    };
}
