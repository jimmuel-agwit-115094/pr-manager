import type { PrStage, StageState } from '@pr-manager/contracts';

/** A connector from a stage to one that depends on it. */
export interface StageEdge {
  from: string;
  to: string;
}

/**
 * Stages into columns by dependency depth (ADO layout): a stage sits one column right of its deepest
 * dependency. Without a graph, every stage gets its own column in run order.
 */
export function layoutColumns(stages: readonly PrStage[], hasGraph: boolean): PrStage[][] {
  if (!hasGraph) {
    return stages.map((s) => [s]);
  }
  const byId = new Map(stages.map((s) => [s.id, s]));
  const depth = new Map<string, number>();
  const visiting = new Set<string>();

  const depthOf = (stage: PrStage): number => {
    const known = depth.get(stage.id);
    if (known !== undefined) {
      return known;
    }
    if (visiting.has(stage.id)) {
      return 0; // cycle guard; ADO rejects cycles, so this never happens in practice
    }
    visiting.add(stage.id);
    const deps = stage.dependsOn.map((id) => byId.get(id)).filter((s): s is PrStage => !!s);
    const d = deps.length ? 1 + Math.max(...deps.map(depthOf)) : 0;
    visiting.delete(stage.id);
    depth.set(stage.id, d);
    return d;
  };

  const columns: PrStage[][] = [];
  for (const stage of stages) {
    (columns[depthOf(stage)] ??= []).push(stage);
  }
  return columns.filter(Boolean);
}

export function edgesOf(stages: readonly PrStage[]): StageEdge[] {
  const ids = new Set(stages.map((s) => s.id));
  return stages.flatMap((s) => s.dependsOn.filter((id) => ids.has(id)).map((from) => ({ from, to: s.id })));
}

/**
 * ADO-style connector: out of the source's right edge, down (or up) just past it with rounded corners,
 * then across into the target's left edge.
 */
export function edgePath(x1: number, y1: number, x2: number, y2: number, turnOffset = 16): string {
  if (Math.abs(y1 - y2) < 1) {
    return `M${x1},${y1} H${x2}`;
  }
  const mx = Math.min(x1 + turnOffset, x2);
  const dir = y2 > y1 ? 1 : -1;
  const r = Math.min(8, Math.abs(y2 - y1) / 2, Math.max(0, mx - x1), Math.max(0, x2 - mx));
  return [
    `M${x1},${y1}`,
    `H${mx - r}`,
    `Q${mx},${y1} ${mx},${y1 + dir * r}`,
    `V${y2 - dir * r}`,
    `Q${mx},${y2} ${mx + r},${y2}`,
    `H${x2}`,
  ].join(' ');
}

const EXPANDED_BY_DEFAULT: ReadonlySet<StageState> = new Set(['RUNNING', 'FAILED', 'WARNING', 'CANCELED']);

/** Like ADO, stages that are running or need attention open with their jobs showing. */
export function expandedByDefault(stage: PrStage): boolean {
  return EXPANDED_BY_DEFAULT.has(stage.state);
}
