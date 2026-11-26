import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterRenderEffect,
  computed,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import type { ApiError, PrStage } from '@pr-manager/contracts';
import { edgePath, edgesOf, expandedByDefault, layoutColumns } from '../../../services/stage-graph';
import { StageCardComponent } from '../stage-card/stage-card.component';

interface Box {
  x: number;
  y: number;
  w: number;
}

/** Card header line the connectors attach to, from the card's top edge. */
const ANCHOR_Y = 21;
/** Half the column gap: where connectors turn. */
const TURN_OFFSET = 16;

/** ADO-style stage graph: columns by dependency depth, connector lines, expandable stage cards. */
@Component({
  selector: 'app-stage-graph',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StageCardComponent],
  templateUrl: './stage-graph.component.html',
  styleUrl: './stage-graph.component.scss',
})
export class StageGraphComponent {
  readonly stages = input.required<PrStage[]>();
  readonly hasGraph = input(true);
  readonly selectedId = input<string | null>(null);
  readonly canRerun = input(true);
  /** Identifier of the stage whose rerun is in flight. */
  readonly busyStage = input<string | null>(null);
  /** Any rerun in flight. */
  readonly disabled = input(false);
  readonly stageError = input<{ stage: string; error: ApiError } | null>(null);

  readonly select = output<string>();
  readonly rerun = output<{ stage: string; allJobs: boolean }>();
  readonly openJob = output<string>();

  private readonly canvas = viewChild.required<ElementRef<HTMLElement>>('canvas');

  protected readonly columns = computed(() => layoutColumns(this.stages(), this.hasGraph()));
  private readonly edges = computed(() => (this.hasGraph() ? edgesOf(this.stages()) : []));

  /** Stages the user opened or closed, flipping their default. */
  private readonly toggled = signal<ReadonlySet<string>>(new Set());
  private readonly boxes = signal<ReadonlyMap<string, Box>>(new Map());
  protected readonly size = signal({ w: 0, h: 0 });
  private readonly resizeTick = signal(0);
  private measuredKey = '';

  protected readonly paths = computed(() => {
    const boxes = this.boxes();
    const selected = this.selectedId();
    return this.edges()
      .map((e) => {
        const a = boxes.get(e.from);
        const b = boxes.get(e.to);
        if (!a || !b) {
          return null;
        }
        const x1 = a.x + a.w;
        const y1 = a.y + ANCHOR_Y;
        const x2 = b.x;
        const y2 = b.y + ANCHOR_Y;
        return { key: `${e.from}>${e.to}`, d: edgePath(x1, y1, x2, y2, TURN_OFFSET), active: e.from === selected || e.to === selected, x1, y1, x2, y2 };
      })
      .filter((p) => p !== null)
      // Highlighted lines last, so they draw on top.
      .sort((p, q) => Number(p.active) - Number(q.active));
  });

  constructor() {
    const observer = new ResizeObserver(() => this.resizeTick.update((n) => n + 1));
    inject(DestroyRef).onDestroy(() => observer.disconnect());

    afterRenderEffect(() => {
      // Re-measure whenever the cards or their sizes may have changed.
      this.stages();
      this.toggled();
      this.resizeTick();
      const canvas = this.canvas().nativeElement;
      observer.observe(canvas);

      const boxes = new Map<string, Box>();
      canvas.querySelectorAll<HTMLElement>('[data-stage]').forEach((el) => {
        boxes.set(el.dataset['stage']!, { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth });
      });
      const size = { w: canvas.scrollWidth, h: canvas.scrollHeight };
      const key = JSON.stringify([size, [...boxes]]);
      if (key !== this.measuredKey) {
        this.measuredKey = key;
        this.boxes.set(boxes);
        this.size.set(size);
      }
    });

    // Bring the stage picked in the list into view.
    afterRenderEffect(() => {
      const id = this.selectedId();
      if (id) {
        untracked(() => this.canvas().nativeElement.querySelector(`[data-stage="${CSS.escape(id)}"]`))?.scrollIntoView({
          block: 'nearest',
          inline: 'nearest',
          behavior: 'smooth',
        });
      }
    });
  }

  protected isExpanded(stage: PrStage): boolean {
    return expandedByDefault(stage) !== this.toggled().has(stage.id);
  }

  protected onToggle(stage: PrStage): void {
    this.toggled.update((set) => {
      const next = new Set(set);
      if (!next.delete(stage.id)) {
        next.add(stage.id);
      }
      return next;
    });
    this.select.emit(stage.id);
  }
}
