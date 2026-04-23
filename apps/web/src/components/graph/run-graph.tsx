import type { RunGraphResponse } from '@cac/shared';
import {
  Background,
  Controls,
  type Edge,
  MarkerType,
  type Node,
  ReactFlow,
  ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useNavigate } from '@tanstack/react-router';
import { GitBranch } from 'lucide-react';
import { useMemo } from 'react';
import { layoutGraph } from './dagre-layout';
import { RunNode, type RunNodeData } from './run-node';

interface Props {
  graph: RunGraphResponse;
}

const nodeTypes = { run: RunNode };

export function RunGraph({ graph }: Props) {
  const navigate = useNavigate();

  const { nodes, edges } = useMemo(() => {
    const rawNodes: Array<Node<RunNodeData>> = graph.nodes.map((n) => ({
      id: n.id,
      type: 'run',
      position: { x: 0, y: 0 },
      data: {
        shortId: n.id.slice(0, 8),
        status: n.status,
        timestamp: n.createdAt.slice(11, 16),
        duration: null,
      },
    }));
    const rawEdges: Edge[] = graph.edges.map((e) => ({
      id: `${e.from}->${e.to}`,
      source: e.from,
      target: e.to,
      type: 'smoothstep',
      style: { stroke: 'var(--rule-strong)', strokeWidth: 1 },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: 'var(--rule-strong)',
        width: 12,
        height: 12,
      },
    }));
    return { nodes: layoutGraph(rawNodes, rawEdges), edges: rawEdges };
  }, [graph]);

  if (nodes.length === 0) {
    return (
      <div className="flex h-[520px] flex-col items-center justify-center gap-2 rule border bg-card/40">
        <GitBranch className="size-6 text-muted-foreground" strokeWidth={1.75} />
        <p className="text-sm text-muted-foreground">Sin runs todavía</p>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-220px)] min-h-[520px] rule border bg-background">
      <ReactFlowProvider>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          minZoom={0.3}
          maxZoom={1.5}
          proOptions={{ hideAttribution: true }}
          onNodeClick={(_e, node) => {
            navigate({ to: '/runs/$id', params: { id: node.id } });
          }}
          nodesDraggable={false}
          nodesConnectable={false}
          edgesFocusable={false}
        >
          <Background gap={28} size={1} color="var(--rule-soft)" style={{ opacity: 0.4 }} />
          <Controls
            showInteractive={false}
            className="!rounded-none !border !bg-card [&>button]:!rounded-none [&>button]:!border-0 [&>button]:!bg-transparent [&>button]:hover:!bg-accent"
          />
        </ReactFlow>
      </ReactFlowProvider>
    </div>
  );
}
