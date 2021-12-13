use std::convert::Infallible;

use bevy::{
    asset::HandleId,
    prelude::{AssetServer, Assets},
    render2::mesh::{Indices, Mesh, VertexAttributeValues},
};
use rweb::{
    reject::{custom, Reject},
    *,
};
use serde::Serialize;

use crate::{serialization::StringHandleId, sync::execute_in_world};

#[derive(Serialize, Debug)]
struct AssetOverview {
    name: String,
    id: StringHandleId,
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
                        id: id.into(),
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
pub(crate) async fn get_asset_mesh(
    #[json] id: StringHandleId,
) -> Result<Json<MeshAsset>, rweb::Rejection> {
    let id: HandleId = id.into();
    let mesh = execute_in_world(move |world| {
        let meshes = world.get_resource::<Assets<Mesh>>();
        meshes.map(|meshes| meshes.get(id).cloned()).flatten()
    })
    .await;

    if let Some(mesh) = mesh {
        let vertices = if let Some(VertexAttributeValues::Float32x3(values)) =
            mesh.attribute(Mesh::ATTRIBUTE_POSITION)
        {
            values.clone()
        } else {
            return Err(custom(AssetMeshErrors::UnsupportedFormat));
        };

        let mut indices = Vec::new();
        match mesh.indices() {
            Some(Indices::U16(raw)) => indices.extend(raw.iter().map(|i| *i as u32)),
            Some(Indices::U32(raw)) => indices.extend(raw),
            _ => {
                return Err(custom(AssetMeshErrors::UnsupportedFormat));
            }
        }

        return Ok(MeshAsset { vertices, indices }.into());
    }

    Err(custom(AssetMeshErrors::NotFound))
}

#[allow(dead_code)]
#[derive(Debug)]
enum AssetMeshErrors {
    NotFound,
    UnsupportedFormat,
}
impl Reject for AssetMeshErrors {}
