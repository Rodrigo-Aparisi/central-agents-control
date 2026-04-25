import type { RunEvent, RunStatus } from '@cac/shared';
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
import { Network, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { layoutGraph } from './dagre-layout';
import { RunNode, type RunNodeData } from './run-node';

interface Props {
  events: RunEvent[];
  runId: string;
  runPrompt: string;
  runStatus: RunStatus;
}

interface TaskMeta {
  id: string;
  name: string;
  subtitle: string;
  description: string;
  toolType: 'agent' | 'task';
  status: RunStatus;
  seq: number;
  timestamp: string;
}

interface DetailItem {
  name: string;
  toolType: 'orchestrator' | 'agent' | 'task';
  subtitle: string;
  description: string;
}

const ACCENT_COLOR: Record<string, string> = {
  orchestrator: '#a78bfa',
  agent: '#2dd4bf',
  task: '#60a5fa',
};

const nodeTypes = { run: RunNode };

function deriveTaskNodes(events: RunEvent[]): TaskMeta[] {
  const pending: number[] = [];
  const nodes: TaskMeta[] = [];

  for (const ev of events) {
    const p = ev.payload;
    const toolLower =
      p.type === 'tool_use' || p.type === 'tool_result' ? p.tool.toLowerCase() : '';

    if (p.type === 'tool_use' && (toolLower === 'task' || toolLower === 'agent')) {
      const isAgent = toolLower === 'agent';
      const name = isAgent
        ? typeof p.input.subagent_type === 'string'
          ? p.input.subagent_type
          : 'async-agent'
        : typeof p.input.description === 'string'
          ? p.input.description.slice(0, 24)
          : 'sub-agent';

      const subtitle =
        typeof p.input.description === 'string'
          ? p.input.description
          : typeof p.input.prompt === 'string'
            ? p.input.prompt.slice(0, 80)
            : '';

      const description =
        typeof p.input.prompt === 'string'
          ? p.input.prompt
          : typeof p.input.description === 'string'
            ? p.input.description
            : '';

      nodes.push({
        id: `task-${ev.seq}`,
        name,
        subtitle,
        description,
        toolType: isAgent ? 'agent' : 'task',
        status: 'running',
        seq: ev.seq,
        timestamp: ev.timestamp.slice(11, 16),
      });
      pending.push(ev.seq);
    } else if (
      p.type === 'tool_result' &&
      (toolLower === 'task' || toolLower === 'agent')
    ) {
      const pendingSeq = pending.shift();
      if (pendingSeq !== undefined) {
        const node = nodes.find((n) => n.seq === pendingSeq);
        if (node) node.status = p.isError ? 'failed' : 'completed';
      }
    }
  }

  return nodes;
}

export function AgentFlowGraph({ events, runId, runPrompt, runStatus }: Props) {
  const [detail, setDetail] = useState<DetailItem | null>(null);

  const { nodes, edges, taskNodes } = useMemo(() => {
    const taskNodes = deriveTaskNodes(events);

    const rawNodes: Array<Node<RunNodeData>> = [
      {
        id: runId,
        type: 'run',
        position: { x: 0, y: 0 },
        data: {
          shortId: runId.slice(0, 8),
          label: runPrompt.length > 0 ? runPrompt.slice(0, 40) : undefined,
          toolType: 'orchestrator',
          status: runStatus,
          timestamp: '',
          duration: null,
        },
      },
      ...taskNodes.map((n) => ({
        id: n.id,
        type: 'run' as const,
        position: { x: 0, y: 0 },
        data: {
          shortId: n.id,
          name: n.name,
          subtitle: n.subtitle,
          toolType: n.toolType,
          status: n.status,
          timestamp: n.timestamp,
          duration: null,
        } satisfies RunNodeData,
      })),
    ];

    const rawEdges: Edge[] = taskNodes.map((n) => ({
      id: `${runId}->${n.id}`,
      source: runId,
      target: n.id,
      type: 'smoothstep',
      style: { stroke: 'rgba(255,255,255,0.18)', strokeWidth: 1 },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: 'rgba(255,255,255,0.25)',
        width: 10,
        height: 10,
      },
    }));

    return { nodes: layoutGraph(rawNodes, rawEdges), edges: rawEdges, taskNodes };
  }, [events, runId, runPrompt, runStatus]);

  if (edges.length === 0) {
    return (
      <div className="flex h-[420px] flex-col items-center justify-center gap-2 rule border bg-card/40">
        <Network className="size-6 text-muted-foreground" strokeWidth={1.75} />
        <p className="text-sm text-muted-foreground">
          Sin sub-agentes detectados — el flujo aparecerá aquí en tiempo real.
        </p>
      </div>
    );
  }

  return (
    <div className="relative rule border bg-background h-[calc(100vh-280px)] min-h-[420px]">
      <ReactFlowProvider>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          minZoom={0.3}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
          nodesDraggable={false}
          nodesConnectable={false}
          edgesFocusable={false}
          onNodeClick={(_, node) => {
            if (node.id === runId) {
              setDetail({
                name: 'Orquestador',
                toolType: 'orchestrator',
                subtitle: runId.slice(0, 8),
                description: runPrompt,
              });
              return;
            }
            const task = taskNodes.find((t) => t.id === node.id);
            if (task) {
              setDetail({
                name: task.name,
                toolType: task.toolType,
                subtitle: task.subtitle,
                description: task.description,
              });
            }
          }}
          onPaneClick={() => setDetail(null)}
        >
          <Background gap={28} size={1} color="var(--rule-soft)" style={{ opacity: 0.4 }} />
          <Controls
            showInteractive={false}
            className="!rounded-none !border !bg-card [&>button]:!rounded-none [&>button]:!border-0 [&>button]:!bg-transparent [&>button]:hover:!bg-accent"
          />
        </ReactFlow>
      </ReactFlowProvider>

      {detail && (
        <div className="absolute top-3 right-3 z-10 w-[300px] rule border bg-card/95 backdrop-blur-sm flex flex-col gap-2 p-3 shadow-[var(--elev-3)]">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="shrink-0 h-3.5 w-[3px] rounded-full"
                style={{ backgroundColor: ACCENT_COLOR[detail.toolType] }}
                aria-hidden
              />
              <span className="font-mono text-[11px] font-semibold text-foreground truncate">
                {detail.name}
              </span>
              <span
                className="shrink-0 rounded border px-1.5 py-px font-mono text-[9px] uppercase tracking-wider"
                style={{
                  borderColor: ACCENT_COLOR[detail.toolType],
                  color: ACCENT_COLOR[detail.toolType],
                }}
              >
                {detail.toolType}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setDetail(null)}
              className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Cerrar"
            >
              <X className="size-3.5" />
            </button>
          </div>

          {detail.subtitle && detail.subtitle !== detail.description && (
            <p className="font-mono text-[11px] text-muted-foreground leading-relaxed">
              {detail.subtitle}
            </p>
          )}

          {detail.description && (
            <pre className="max-h-[200px] overflow-auto rounded bg-muted/20 p-2.5 font-mono text-[10px] text-muted-foreground whitespace-pre-wrap leading-relaxed border rule-soft">
              {detail.description}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
