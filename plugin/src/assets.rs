use std::convert::Infallible;

use bevy::{asset::HandleId, prelude::*, render2::mesh::Mesh};
use rweb::*;
use serde::Serialize;

use crate::sync::execute_in_world;

#[derive(Serialize, Debug)]
struct AssetOverview {
    name: String,
    id: HandleId,
    ty: AssetType,
}

#[derive(Serialize, Debug)]
enum AssetType {
    Mesh,
}

impl openapi::Entity for AssetOverview {
    fn type_name() -> rt::Cow<'static, str> {
        "AssetOverview".into()
    }
    fn describe(_comp_d: &mut openapi::ComponentDescriptor) -> openapi::ComponentOrInlineSchema {
        openapi::ComponentOrInlineSchema::Component {
            name: "AssetOverview".into(),
        }
    }
}

#[allow(dead_code)]
fn get_asset_name(server: &AssetServer, handle: HandleId) -> String {
    server
        .get_handle_path(handle)
        .map(|path| {
            path.label()
                .map(|p| p.to_string())
                .or_else(|| path.path().to_str().map(|p| p.to_string()))
        })
        .flatten()
        .unwrap_or_else(|| "Unknown".to_string())
}

#[get("/v1/assets")]
#[cors(origins("*"))]
pub(crate) async fn assets() -> Result<Json<Vec<AssetOverview>>, Infallible> {
    let assets = execute_in_world(|world| {
        let mut assets = Vec::new();
        if let Some(server) = world.get_resource::<AssetServer>() {
            if let Some(mesh_assets) = world.get_resource::<Assets<Mesh>>() {
                for (id, _) in mesh_assets.iter() {
                    assets.push(AssetOverview {
                        name: get_asset_name(server, id),
                        ty: AssetType::Mesh,
                        id,
                    });
                }
            }
        }
        assets
    })
    .await;

    Ok(assets.into())
}

#[derive(Serialize, Schema)]
struct MeshAsset {
    vertices: Vec<[f32; 3]>,
    indices: Vec<u32>,
}

#[post("/v1/assets/mesh")]
#[cors(origins("*"))]
pub(crate) async fn get_asset_mesh(#[json] id: HandleId) -> Result<String, Infallible> {
    let handle = Handle::<Mesh>::weak(id);
    /*
    let vertices = Vec::new();
    let indices = Vec::new();
    */

    Ok("".to_string())
}
