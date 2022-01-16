use bevy::render::render_graph::{RenderGraph, SlotInfos, SlotType};
use rweb::{
    openapi::{ComponentDescriptor, ComponentOrInlineSchema, Entity},
    *,
};
use serde::Serialize;
use std::convert::Infallible;

use crate::sync::{execute_in_world, ExecutionChannel};

#[derive(Serialize, Debug, Clone)]
enum RenderGraphNode {
    SubGraph {
        name: String,
        graph: SubRenderGraph,
    },
    Node {
        id: String,
        name: String,
        ty_name: String,
        input_slots: Vec<RenderGraphNodeSlot>,
        output_slots: Vec<RenderGraphNodeSlot>,
    },
}

#[derive(Serialize, Debug, Clone)]
pub struct RenderGraphNodeSlot {
    name: String,
    ty_name: String,
}

#[derive(Serialize, Debug, Clone)]
pub struct SubRenderGraph {
    nodes: Vec<RenderGraphNode>,
    edges: Vec<Edge>,
}

#[derive(Serialize, Debug, Clone)]
pub struct Edge {
    source_node: String,
    source_slot: Option<usize>,
    sink_node: String,
    sink_slot: Option<usize>,
}

// TODO: Proc macro derive causes a stack overflow do to the struct being nested with itself.
impl Entity for SubRenderGraph {
    fn type_name() -> rweb::rt::Cow<'static, str> {
        rweb::rt::Cow::Borrowed("SubRenderGraph")
    }

    fn describe(_comp_d: &mut ComponentDescriptor) -> ComponentOrInlineSchema {
        ComponentOrInlineSchema::Component {
            name: rweb::rt::Cow::Borrowed("SubRenderGraph"),
        }
    }
}

fn build_render_graph_slots(slots: &SlotInfos) -> Vec<RenderGraphNodeSlot> {
    slots
        .iter()
        .map(|slot| RenderGraphNodeSlot {
            name: slot.name.to_string(),
            ty_name: match slot.slot_type {
                SlotType::Buffer => "Buffer",
                SlotType::Entity => "Entity",
                SlotType::Sampler => "Sampler",
                SlotType::TextureView => "TextureView",
            }
            .to_string(),
        })
        .collect()
}

pub fn build_render_graph(render_graph: &RenderGraph) -> SubRenderGraph {
    let mut output_graph = SubRenderGraph {
        nodes: Vec::new(),
        edges: Vec::new(),
    };

    for (name, sub_graph) in render_graph.iter_sub_graphs() {
        output_graph.nodes.push(RenderGraphNode::SubGraph {
            name: name.to_string(),
            graph: build_render_graph(sub_graph),
        });
    }

    for node_state in render_graph.iter_nodes() {
        let name = node_state
            .name
            .as_ref()
            .map(|n| n.to_string())
            .unwrap_or_else(|| "unknown".to_string());

        for edge in &node_state.edges.input_edges {
            let source_node = edge.get_input_node().uuid().to_string();
            let sink_node = edge.get_output_node().uuid().to_string();
            let (source_slot, sink_slot) = match edge {
                bevy::render::render_graph::Edge::NodeEdge { .. } => (None, None),
                bevy::render::render_graph::Edge::SlotEdge {
                    input_index,
                    output_index,
                    ..
                } => (Some(*input_index), Some(*output_index)),
            };
            output_graph.edges.push(Edge {
                source_node: sink_node,
                source_slot: sink_slot,
                sink_node: source_node,
                sink_slot: source_slot,
            })
        }

        output_graph.nodes.push(RenderGraphNode::Node {
            id: node_state.id.uuid().to_string(),
            name,
            ty_name: node_state.type_name.to_string(),
            input_slots: build_render_graph_slots(&node_state.input_slots),
            output_slots: build_render_graph_slots(&node_state.output_slots),
        })
    }

    output_graph
}

#[get("/v1/render_graph")]
#[cors(origins("*"), headers("content-type"))]
pub(crate) async fn get_render_graph() -> Result<Json<SubRenderGraph>, Infallible> {
    let output = execute_in_world(ExecutionChannel::RenderApp, |world| {
        let render_graph = world.get_resource::<RenderGraph>().unwrap();
        build_render_graph(render_graph)
    })
    .await;
    Ok(output.into())
}
