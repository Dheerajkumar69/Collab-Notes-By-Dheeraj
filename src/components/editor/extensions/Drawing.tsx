/**
 * Drawing — a resizable in-note sketch pad.
 *
 * How it works:
 *  - Custom Tiptap Node ("drawing") that stores its state as a single JSON
 *    attribute: { strokes: Stroke[], width, height, bg }.
 *  - Rendered via a React NodeView that:
 *      • paints all strokes into a canvas element,
 *      • captures pointer input to append new strokes,
 *      • supports pen (color + width), eraser (stroke-hit removal), undo,
 *        clear, and a corner resize grip.
 *  - Strokes are vectors, not rasters, so a drawing weighs a few KB not MB —
 *    safe for Yjs and offline persistence.
 *  - The NodeView is deterministic: on mount and whenever attrs change, it
 *    fully repaints from the strokes array, so remote Yjs updates (another
 *    collaborator drawing) appear live.
 *  - Every stroke commit runs through updateAttributes so it flows into the
 *    Yjs document and out over the network like any other node change.
 */
import { Node, mergeAttributes, type NodeViewProps } from '@tiptap/core';
import { NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react';
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Pen, Eraser, Undo2, Trash2, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Stroke = {
  color: string;
  width: number;
  eraser?: boolean;
  points: number[]; // Flat [x0,y0,x1,y1,...] to keep JSON compact.
};

type DrawingAttrs = {
  strokes: Stroke[];
  width: number;
  height: number;
  bg: string;
};

const DEFAULT_ATTRS: DrawingAttrs = {
  strokes: [],
  width: 640,
  height: 360,
  bg: '#ffffff',
};

const COLORS = ['#111827', '#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6'];
const MAX_STROKES = 2000; // Safety cap so a runaway session can't bloat the doc.

function DrawingView(props: NodeViewProps) {
  const attrs = props.node.attrs as DrawingAttrs;
  const editable = props.editor.isEditable;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const drawingRef = useRef<Stroke | null>(null);
  const [color, setColor] = useState<string>(COLORS[0]);
  const [width, setWidth] = useState<number>(3);
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');

  const repaint = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // Fill background.
    ctx.save();
    ctx.fillStyle = attrs.bg || '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    // Paint committed strokes.
    for (const s of attrs.strokes) drawStroke(ctx, s, attrs.bg);
    // Paint in-progress stroke on top.
    if (drawingRef.current) drawStroke(ctx, drawingRef.current, attrs.bg);
  }, [attrs.strokes, attrs.bg]);

  // Keep the canvas backing store in sync with attribute dimensions.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = attrs.width;
    canvas.height = attrs.height;
    repaint();
  }, [attrs.width, attrs.height, repaint]);

  useEffect(() => { repaint(); }, [repaint]);

  const posFromEvent = (e: React.PointerEvent): [number, number] => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
    return [Math.round(x), Math.round(y)];
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!editable) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const [x, y] = posFromEvent(e);
    drawingRef.current = {
      color,
      width: tool === 'eraser' ? Math.max(width * 4, 12) : width,
      eraser: tool === 'eraser',
      points: [x, y],
    };
    repaint();
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!editable || !drawingRef.current) return;
    const [x, y] = posFromEvent(e);
    const pts = drawingRef.current.points;
    // Skip near-duplicate points for smaller JSON.
    const lx = pts[pts.length - 2];
    const ly = pts[pts.length - 1];
    if (Math.hypot(x - lx, y - ly) < 1.5) return;
    pts.push(x, y);
    repaint();
  };

  const commitStroke = () => {
    const stroke = drawingRef.current;
    drawingRef.current = null;
    if (!stroke || stroke.points.length < 4) { repaint(); return; }
    const next = [...attrs.strokes, stroke].slice(-MAX_STROKES);
    props.updateAttributes({ strokes: next });
  };

  const onPointerUp = () => { if (drawingRef.current) commitStroke(); };
  const onPointerCancel = () => { if (drawingRef.current) commitStroke(); };

  const undo = () => {
    if (!editable || attrs.strokes.length === 0) return;
    props.updateAttributes({ strokes: attrs.strokes.slice(0, -1) });
  };
  const clear = () => {
    if (!editable) return;
    props.updateAttributes({ strokes: [] });
  };
  const download = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement('a');
    a.download = 'drawing.png';
    a.href = canvas.toDataURL('image/png');
    a.click();
  };

  // Resize via a corner grip. Constrained to sensible min/max.
  const resizing = useRef<{ startX: number; startY: number; startW: number; startH: number } | null>(null);
  const onResizeDown = (e: React.PointerEvent) => {
    if (!editable) return;
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    resizing.current = { startX: e.clientX, startY: e.clientY, startW: attrs.width, startH: attrs.height };
  };
  const onResizeMove = (e: React.PointerEvent) => {
    if (!resizing.current) return;
    const dx = e.clientX - resizing.current.startX;
    const dy = e.clientY - resizing.current.startY;
    const w = Math.min(1600, Math.max(240, Math.round(resizing.current.startW + dx)));
    const h = Math.min(1200, Math.max(160, Math.round(resizing.current.startH + dy)));
    // Live preview via CSS only; commit on pointer-up so we don't spam Yjs.
    if (wrapperRef.current) {
      wrapperRef.current.style.width = w + 'px';
      wrapperRef.current.dataset.pendingW = String(w);
      wrapperRef.current.dataset.pendingH = String(h);
    }
  };
  const onResizeUp = () => {
    const el = wrapperRef.current;
    if (!el || !resizing.current) return;
    const w = Number(el.dataset.pendingW || attrs.width);
    const h = Number(el.dataset.pendingH || attrs.height);
    resizing.current = null;
    el.style.width = '';
    delete el.dataset.pendingW;
    delete el.dataset.pendingH;
    if (w !== attrs.width || h !== attrs.height) {
      props.updateAttributes({ width: w, height: h });
    }
  };

  return (
    <NodeViewWrapper className="drawing-node my-3">
      <div
        ref={wrapperRef}
        className="relative inline-block rounded-lg border bg-background shadow-sm"
        style={{ width: attrs.width }}
      >
        {editable && (
          <div className="flex flex-wrap items-center gap-1 border-b p-1.5 bg-muted/40">
            <Button size="sm" variant={tool === 'pen' ? 'default' : 'ghost'} className="h-7 px-2" onClick={() => setTool('pen')} title="Pen"><Pen className="h-3.5 w-3.5" /></Button>
            <Button size="sm" variant={tool === 'eraser' ? 'default' : 'ghost'} className="h-7 px-2" onClick={() => setTool('eraser')} title="Eraser"><Eraser className="h-3.5 w-3.5" /></Button>
            <div className="mx-1 h-5 w-px bg-border" />
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Color ${c}`}
                onClick={() => { setColor(c); setTool('pen'); }}
                className="h-5 w-5 rounded-full border"
                style={{ background: c, outline: color === c ? '2px solid hsl(var(--ring))' : undefined, outlineOffset: 1 }}
              />
            ))}
            <div className="mx-1 h-5 w-px bg-border" />
            <input
              type="range"
              min={1}
              max={16}
              value={width}
              onChange={(e) => setWidth(Number(e.target.value))}
              className="h-2 w-20 accent-primary"
              title="Stroke width"
            />
            <span className="text-[10px] text-muted-foreground w-4 text-center">{width}</span>
            <div className="ml-auto flex items-center gap-1">
              <Button size="sm" variant="ghost" className="h-7 px-2" onClick={undo} title="Undo last stroke"><Undo2 className="h-3.5 w-3.5" /></Button>
              <Button size="sm" variant="ghost" className="h-7 px-2" onClick={clear} title="Clear"><Trash2 className="h-3.5 w-3.5" /></Button>
              <Button size="sm" variant="ghost" className="h-7 px-2" onClick={download} title="Download PNG"><Download className="h-3.5 w-3.5" /></Button>
            </div>
          </div>
        )}
        <div className="relative">
          <canvas
            ref={canvasRef}
            style={{ width: '100%', height: 'auto', touchAction: 'none', cursor: editable ? 'crosshair' : 'default', display: 'block', borderBottomLeftRadius: 6, borderBottomRightRadius: 6 }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerCancel}
            onPointerCancel={onPointerCancel}
          />
          {editable && (
            <div
              role="separator"
              aria-label="Resize drawing"
              onPointerDown={onResizeDown}
              onPointerMove={onResizeMove}
              onPointerUp={onResizeUp}
              className="absolute bottom-1 right-1 h-3 w-3 cursor-nwse-resize bg-border rounded-sm hover:bg-primary/70"
            />
          )}
        </div>
      </div>
    </NodeViewWrapper>
  );
}

function drawStroke(ctx: CanvasRenderingContext2D, s: Stroke, bg: string) {
  if (s.points.length < 2) return;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (s.eraser) {
    // Paint over with the canvas background color so erased areas visually
    // match the drawing surface (instead of punching transparent holes that
    // reveal the parent element's dark theme background).
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = bg || '#ffffff';
  } else {
    ctx.strokeStyle = s.color;
  }
  ctx.lineWidth = s.width;
  ctx.beginPath();
  ctx.moveTo(s.points[0], s.points[1]);
  for (let i = 2; i < s.points.length; i += 2) {
    ctx.lineTo(s.points[i], s.points[i + 1]);
  }
  ctx.stroke();
  ctx.restore();
}

export const Drawing = Node.create({
  name: 'drawing',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      strokes: {
        default: DEFAULT_ATTRS.strokes,
        parseHTML: (el) => {
          try { return JSON.parse((el as HTMLElement).getAttribute('data-strokes') || '[]'); }
          catch { return []; }
        },
        renderHTML: (attrs) => ({ 'data-strokes': JSON.stringify(attrs.strokes || []) }),
      },
      width: {
        default: DEFAULT_ATTRS.width,
        parseHTML: (el) => Number((el as HTMLElement).getAttribute('data-width')) || DEFAULT_ATTRS.width,
        renderHTML: (attrs) => ({ 'data-width': attrs.width }),
      },
      height: {
        default: DEFAULT_ATTRS.height,
        parseHTML: (el) => Number((el as HTMLElement).getAttribute('data-height')) || DEFAULT_ATTRS.height,
        renderHTML: (attrs) => ({ 'data-height': attrs.height }),
      },
      bg: {
        default: DEFAULT_ATTRS.bg,
        parseHTML: (el) => (el as HTMLElement).getAttribute('data-bg') || DEFAULT_ATTRS.bg,
        renderHTML: (attrs) => ({ 'data-bg': attrs.bg }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-drawing="true"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-drawing': 'true', class: 'drawing-block' }), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(DrawingView);
  },

  addCommands() {
    return {
      insertDrawing:
        () =>
        ({ chain }) =>
          chain().insertContent({ type: this.name, attrs: { ...DEFAULT_ATTRS } }).run(),
    } as never;
  },
});

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    drawing: {
      insertDrawing: () => ReturnType;
    };
  }
}