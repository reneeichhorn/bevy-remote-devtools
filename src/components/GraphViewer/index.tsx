import React, { useEffect, useRef } from 'react';
import Rete from "rete";
import ReactRenderPlugin from "rete-react-render-plugin";
import ReadonlyPlugin from 'rete-readonly-plugin';
import MinimapPlugin from 'rete-minimap-plugin';
import ConnectionPlugin from "rete-connection-plugin";
import CommentPlugin from 'rete-comment-plugin';
import AutoArrangePlugin from './autoarrange';
import { buildReteJSON, Graph } from './component';
import styled from '@emotion/styled';

function initRete(container: HTMLElement, graph: Graph) {
  const editor = new Rete.NodeEditor("bevy-graph-viewer@0.1.0", container);
  editor.use(ConnectionPlugin);
  editor.use(ReactRenderPlugin, {
    //component: () => null,
  });
  editor.use(ReadonlyPlugin, { enabled: false });
  editor.use(AutoArrangePlugin, { margin: { x: 200, y: 50 }, depth: 0 });
  editor.use(MinimapPlugin);
  editor.use(CommentPlugin, { margin: 24 });

  const engine = new Rete.Engine("bevy-graph-viewer@0.1.0");
  const builtGraph = buildReteJSON(graph);
  builtGraph.components.forEach(c => {
    engine.register(c);
    editor.register(c);
  });
  editor.on(
    ['process', 'nodecreated', 'noderemoved', 'connectioncreated', 'connectionremoved'],
    async () => {
      await engine.abort();
      await engine.process(editor.toJSON());
    }
  );

  console.warn('nodes', builtGraph);
  editor.fromJSON({
    id: "bevy-graph-viewer@0.1.0",
    nodes: builtGraph.nodes,
  });
  editor.view.resize();
  editor.trigger('process');

  requestAnimationFrame(() => {
    editor.trigger('arrangeall');
    editor.trigger('readonly', true);

    requestAnimationFrame(() => {
      builtGraph.groups.forEach(group => {
        editor.trigger('addcomment', ({
          type: 'frame',
          text: group.name,
          nodes: editor.nodes.filter(n => group.nodes.includes(n.id.toString())),
        }));
      });
    });
    editor.nodes.forEach(node => {
      node.position[1] -= 24;
    });
  });

  return () => {
    engine.destroy();
    editor.clear();
    editor.destroy();
    container.innerHTML = "";
  }
}

interface GraphViewerProps {
  graph: Graph,
}

const StyledDiv = styled("div")({
  width: '100%',
  flex: 1,
  '&#graph-viewer .minimap': {
    right: 42,
  }
});

export function GraphViewer({ graph }: GraphViewerProps): React.ReactElement {
  const divRef = useRef(null);
  useEffect(() => {
    return initRete(divRef.current, graph);
  }, [graph]);

  return (
    <StyledDiv id="graph-viewer" ref={divRef}>
    </StyledDiv>
  )
}