use bevy::{
    diagnostic::FrameTimeDiagnosticsPlugin,
    log::{Level, LogPlugin, LogSettings},
    prelude::*,
};
use bevy_remote_devtools_plugin::{dev_named, RemoteDevToolsPlugin};

fn main() {
    let mut builder = env_logger::Builder::new();
    builder.parse_filters("libmdns=trace");
    builder.init();

    App::new()
        .insert_resource(LogSettings {
            filter: "wgpu=error,hyper=error,bevy_render=error".to_string(),
            level: Level::DEBUG,
        })
        .add_plugin(RemoteDevToolsPlugin::new("3D Example", 3030))
        .insert_resource(Msaa { samples: 4 })
        .add_plugins_with(DefaultPlugins, |group| group.disable::<LogPlugin>())
        .add_plugin(FrameTimeDiagnosticsPlugin::default())
        .add_startup_system(setup)
        .run();
}

/// set up a simple 3D scene
fn setup(
    mut commands: Commands,
    mut meshes: ResMut<Assets<Mesh>>,
    mut materials: ResMut<Assets<StandardMaterial>>,
) {
    // plane
    commands
        .spawn_bundle(PbrBundle {
            mesh: meshes.add(Mesh::from(shape::Plane { size: 5.0 })),
            material: materials.add(Color::rgb(0.3, 0.5, 0.3).into()),
            ..Default::default()
        })
        .insert(dev_named!("Plane"));
    // cube
    commands
        .spawn_bundle(PbrBundle {
            mesh: meshes.add(Mesh::from(shape::Cube { size: 1.0 })),
            material: materials.add(Color::rgb(0.8, 0.7, 0.6).into()),
            transform: Transform::from_xyz(0.0, 0.5, 0.0),
            ..Default::default()
        })
        .insert(dev_named!("Cube"));
    // light
    commands
        .spawn_bundle(PointLightBundle {
            point_light: PointLight {
                intensity: 1500.0,
                shadows_enabled: true,
                ..Default::default()
            },
            transform: Transform::from_xyz(4.0, 8.0, 4.0),
            ..Default::default()
        })
        .insert(dev_named!("Light"));
    // camera
    commands
        .spawn_bundle(PerspectiveCameraBundle {
            transform: Transform::from_xyz(-2.0, 2.5, 5.0).looking_at(Vec3::ZERO, Vec3::Y),
            ..Default::default()
        })
        .insert(dev_named!("Camera"));
}
