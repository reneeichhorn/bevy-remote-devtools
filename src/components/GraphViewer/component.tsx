import Rete from 'rete';
import _ from 'lodash';

const slotSocket = new Rete.Socket("A bevy slot.");
const nodeSocket = new Rete.Socket("The node input / output.");

export interface Graph {
  nodes: Node[],
  edges: Edge[],
}

export interface Node {
  Node?: SubNode,
  SubGraph?: SubGraph,
}

export interface SubNode {
  id: string,
  name: string,
  ty_name: string,
  input_slots: Slot[],
  output_slots: Slot[],
}

export interface Slot {
  name: string,
  ty_name: string,
}

export interface SubGraph {
  graph: Graph,
  name: string,
}

export interface Edge {
  source_node: string,
  source_slot?: number,
  sink_node: string,
  sink_slot?: number,
}

function customizeMerge(objValue, srcValue) {
  if (_.isArray(objValue)) {
    return objValue.concat(srcValue);
  }
}

function buildComponents(graph: Graph, componentsOut = {}, nodesOut = {}, groupsOut = []) {
  graph.nodes.forEach(inNode => {
    const ty = Object.keys(inNode)[0];
    if (ty === "Node") {
      const node = inNode.Node;

      // Build component.
      const output_edges = graph.edges.filter(edge => edge.source_node === node.id);

      nodesOut[node.id] = {
        id: node.id,
        data: {},
        outputs: _.mergeWith({}, ...output_edges.map(edge => ({
          [edge.sink_slot === null ? '{root}' : node.output_slots[edge.sink_slot].name]: {
            connections: [{
              node: edge.sink_node,
              input: edge.sink_slot === null 
                ? '{root}' 
                : graph.nodes
                  .find(f => f?.Node?.id === edge.sink_node)
                  .Node
                  .input_slots[edge.source_slot].name,
              data: {},
            }],
          },
        })), customizeMerge),
        position: [0, 0],
        name: node.ty_name,
      };

      // Skip nodes of the same type.
      if (componentsOut[node.ty_name]) {
        return;
      }

      class Component extends Rete.Component {
        constructor() {
          super(node.ty_name);
        }

        builder(nodeIn) {
          let out = nodeIn
            .addInput(new Rete.Input("{root}", "{root}", nodeSocket, true))
            .addOutput(new Rete.Output("{root}", "{root}", nodeSocket, true));
          node.input_slots.forEach(slot => {
            out = out.addInput(new Rete.Input(slot.name, slot.ty_name, slotSocket, true));
          });
          node.output_slots.forEach(slot => {
            out = out.addOutput(new Rete.Output(slot.name, slot.ty_name, slotSocket, true));
          });
          return out;
        }

        // eslint-disable-next-line @typescript-eslint/no-empty-function
        worker() {}
      }

      componentsOut[node.ty_name] = new Component();
    } else if (ty === "SubGraph") {
      buildComponents(inNode.SubGraph.graph, componentsOut, nodesOut, groupsOut);
      const nodes = inNode.SubGraph.graph.nodes.map(n => n.Node?.id).filter(n => !!n);
      groupsOut.push({ nodes, name: inNode.SubGraph.name });
    }
  });
}

interface BuiltReteGraph {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  components: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  nodes: Record<string, any>,
  groups: Group[],
}

interface Group {
  name: string,
  nodes: string[],
}

export function buildReteJSON(graph: Graph): BuiltReteGraph {
  const components = {};
  const nodes = {};
  const groups = [];
  buildComponents(graph, components, nodes, groups);

  return {
    components: Object.values(components),
    groups,
    nodes,
  };
}