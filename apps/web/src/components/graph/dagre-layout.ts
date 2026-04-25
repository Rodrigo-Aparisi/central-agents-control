import { type Edge, type Node, Position } from '@xyflow/react';
import dagre from 'dagre';

const NODE_WIDTH = 200;
const NODE_HEIGHT = 52;

export function layoutGraph<NodeData extends Record<string, unknown>>(
  nodes: Array<Node<NodeData>>,
  edges: Edge[],
): Array<Node<NodeData>> {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'TB', nodesep: 24, ranksep: 56, marginx: 20, marginy: 20 });

  for (const node of nodes) {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }
  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }

  dagre.layout(g);

  return nodes.map((node) => {
    const { x, y } = g.node(node.id);
    return {
      ...node,
      position: { x: x - NODE_WIDTH / 2, y: y - NODE_HEIGHT / 2 },
      targetPosition: Position.Top,
      sourcePosition: Position.Bottom,
    };
  });
}
