/**
 * ERDiagramView — SVG-based Entity Relationship Diagram renderer.
 * No external dependencies. Reads ERDiagram from dbStore.
 * Supports pan, zoom, highlights FK relations on hover,
 * minimap thumbnail navigation, and PNG/SVG export.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useDBStore } from '../../stores/dbStore';
import type { ERDiagram, ERDiagramTable, ERDiagramRelation } from '../../../shared/types/database';

// ── Constants ─────────────────────────────────────────────────────

const CARD_WIDTH = 200;
const COL_HEIGHT = 22;
const HEADER_HEIGHT = 34;
const PADDING = 8;
const FK_COLOR = '#a371f7';
const PK_COLOR = '#e3b341';
const ACCENT = 'var(--theme-accent, #58a6ff)';

// ── Helpers ───────────────────────────────────────────────────────

function tableHeight(t: ERDiagramTable): number {
  return HEADER_HEIGHT + t.columns.length * COL_HEIGHT + PADDING;
}

/** Return the midpoint Y of a column within its table card */
function columnMidY(table: ERDiagramTable, colName: string): number {
  const idx = table.columns.findIndex((c) => c.name === colName);
  const colIdx = idx < 0 ? 0 : idx;
  return table.y + HEADER_HEIGHT + colIdx * COL_HEIGHT + COL_HEIGHT / 2;
}

/** Compute bezier path between two table cards */
function relationPath(
  from: ERDiagramTable,
  fromCol: string,
  to: ERDiagramTable,
  toCol: string,
): string {
  const fromRight = from.x + CARD_WIDTH;
  const fromLeft = from.x;
  const toRight = to.x + CARD_WIDTH;
  const toLeft = to.x;

  const fy = columnMidY(from, fromCol);
  const ty = columnMidY(to, toCol);

  // Choose sides to connect from/to based on relative horizontal position
  let x1: number, x2: number, cp1x: number, cp2x: number;

  if (fromRight <= toLeft) {
    // from is left of to
    x1 = fromRight;
    x2 = toLeft;
    const gap = x2 - x1;
    cp1x = x1 + Math.min(gap * 0.5, 80);
    cp2x = x2 - Math.min(gap * 0.5, 80);
  } else if (fromLeft >= toRight) {
    // from is right of to
    x1 = fromLeft;
    x2 = toRight;
    const gap = x1 - x2;
    cp1x = x1 - Math.min(gap * 0.5, 80);
    cp2x = x2 + Math.min(gap * 0.5, 80);
  } else {
    // Overlapping horizontally — route around
    x1 = fromLeft;
    x2 = toLeft;
    cp1x = Math.min(fromLeft, toLeft) - 60;
    cp2x = cp1x;
  }

  return `M ${x1} ${fy} C ${cp1x} ${fy}, ${cp2x} ${ty}, ${x2} ${ty}`;
}

// ── Sub-components ────────────────────────────────────────────────

interface TableCardProps {
  table: ERDiagramTable;
  highlighted: boolean;
  highlightedCols: Set<string>;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onDragStart: (e: React.MouseEvent, tableName: string) => void;
}

const TableCard: React.FC<TableCardProps> = ({
  table,
  highlighted,
  highlightedCols,
  onMouseEnter,
  onMouseLeave,
  onDragStart,
}) => {
  const h = tableHeight(table);

  return (
    <g
      transform={`translate(${table.x}, ${table.y})`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{ cursor: 'grab' }}
      onMouseDown={(e) => onDragStart(e, table.name)}
    >
      {/* Card shadow */}
      <rect
        x={2} y={3}
        width={CARD_WIDTH} height={h}
        rx={6} ry={6}
        fill="rgba(0,0,0,0.25)"
      />
      {/* Card body */}
      <rect
        x={0} y={0}
        width={CARD_WIDTH} height={h}
        rx={6} ry={6}
        fill="var(--theme-bg-secondary, #161b22)"
        stroke={highlighted ? ACCENT : 'var(--theme-border, #30363d)'}
        strokeWidth={highlighted ? 2 : 1}
      />
      {/* Header background */}
      <rect
        x={0} y={0}
        width={CARD_WIDTH} height={HEADER_HEIGHT}
        rx={6} ry={6}
        fill={highlighted ? 'rgba(88,166,255,0.12)' : 'var(--theme-bg-tertiary, rgba(255,255,255,0.04))'}
      />
      {/* Header bottom border */}
      <line
        x1={0} y1={HEADER_HEIGHT}
        x2={CARD_WIDTH} y2={HEADER_HEIGHT}
        stroke="var(--theme-border, #30363d)"
        strokeWidth={1}
      />
      {/* Table name */}
      <text
        x={12} y={HEADER_HEIGHT / 2 + 5}
        fontSize={12}
        fontWeight={700}
        fill="var(--theme-fg, #e6edf3)"
        fontFamily="var(--font-mono, monospace)"
      >
        {table.name.length > 22 ? table.name.slice(0, 20) + '\u2026' : table.name}
      </text>

      {/* Columns */}
      {table.columns.map((col, i) => {
        const cy = HEADER_HEIGHT + i * COL_HEIGHT;
        const isPK = table.primaryKey.includes(col.name);
        const isFK = col.isForeignKey;
        const isHl = highlightedCols.has(col.name);

        return (
          <g key={col.name} transform={`translate(0, ${cy})`}>
            {/* Row highlight on FK hover */}
            {isHl && (
              <rect
                x={1} y={0}
                width={CARD_WIDTH - 2} height={COL_HEIGHT}
                fill="rgba(163,113,247,0.10)"
              />
            )}
            {/* Separator */}
            {i > 0 && (
              <line
                x1={8} y1={0}
                x2={CARD_WIDTH - 8} y2={0}
                stroke="var(--theme-border, #30363d)"
                strokeWidth={0.5}
                opacity={0.5}
              />
            )}
            {/* PK / FK badge */}
            {isPK && (
              <text x={8} y={15} fontSize={9} fontWeight={700} fill={PK_COLOR} fontFamily="monospace">
                PK
              </text>
            )}
            {isFK && !isPK && (
              <text x={8} y={15} fontSize={9} fontWeight={700} fill={FK_COLOR} fontFamily="monospace">
                FK
              </text>
            )}
            {/* Column name */}
            <text
              x={isPK || isFK ? 30 : 12}
              y={15}
              fontSize={11}
              fill={isHl ? FK_COLOR : isPK ? PK_COLOR : 'var(--theme-fg, #e6edf3)'}
              fontFamily="var(--font-mono, monospace)"
            >
              {col.name.length > 18 ? col.name.slice(0, 16) + '\u2026' : col.name}
            </text>
            {/* Type */}
            <text
              x={CARD_WIDTH - 8}
              y={15}
              fontSize={10}
              fill={ACCENT}
              textAnchor="end"
              fontFamily="var(--font-mono, monospace)"
              opacity={0.75}
            >
              {col.type.length > 10 ? col.type.slice(0, 9) + '\u2026' : col.type}
            </text>
            {/* Nullable indicator */}
            {col.nullable && (
              <text x={CARD_WIDTH - 8} y={15} fontSize={9} fill="var(--theme-fg-muted, #8b949e)" textAnchor="end" dy={9} opacity={0.5}>
                null
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
};

// ── Relation line ─────────────────────────────────────────────────

interface RelationLineProps {
  relation: ERDiagramRelation;
  fromTable: ERDiagramTable;
  toTable: ERDiagramTable;
  highlighted: boolean;
}

const RelationLine: React.FC<RelationLineProps> = ({ relation, fromTable, toTable, highlighted }) => {
  const d = relationPath(fromTable, relation.fromColumn, toTable, relation.toColumn);
  const color = highlighted ? FK_COLOR : 'var(--theme-border, #30363d)';

  // Arrow marker id must be unique per color state to avoid SVG marker caching issues
  const markerId = highlighted ? 'arrow-hl' : 'arrow-dim';

  return (
    <path
      d={d}
      fill="none"
      stroke={color}
      strokeWidth={highlighted ? 2 : 1.5}
      strokeDasharray={highlighted ? undefined : '4 3'}
      markerEnd={`url(#${markerId})`}
      opacity={highlighted ? 1 : 0.45}
      style={{ transition: 'stroke 0.15s, opacity 0.15s, stroke-width 0.15s' }}
    />
  );
};

// ── Minimap ───────────────────────────────────────────────────────

const MINIMAP_W = 140;
const MINIMAP_H = 90;
const MINIMAP_PAD = 6;

interface MinimapProps {
  tables: ERDiagramTable[];
  relations: ERDiagramRelation[];
  pan: { x: number; y: number };
  zoom: number;
  viewW: number;
  viewH: number;
  onPanTo: (x: number, y: number) => void;
}

const Minimap: React.FC<MinimapProps> = ({ tables, relations, pan, zoom, viewW, viewH, onPanTo }) => {
  const mmRef = useRef<SVGSVGElement>(null);
  if (tables.length === 0) return null;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const t of tables) {
    minX = Math.min(minX, t.x);
    minY = Math.min(minY, t.y);
    maxX = Math.max(maxX, t.x + CARD_WIDTH);
    maxY = Math.max(maxY, t.y + tableHeight(t));
  }
  const diagramW = maxX - minX + 40;
  const diagramH = maxY - minY + 40;
  const scaleX = (MINIMAP_W - MINIMAP_PAD * 2) / diagramW;
  const scaleY = (MINIMAP_H - MINIMAP_PAD * 2) / diagramH;
  const mmScale = Math.min(scaleX, scaleY);

  const toMM = (dx: number, dy: number) => ({
    x: (dx - minX) * mmScale + MINIMAP_PAD,
    y: (dy - minY) * mmScale + MINIMAP_PAD,
  });

  const vpX = -pan.x / zoom;
  const vpY = -pan.y / zoom;
  const vpMM = toMM(vpX, vpY);
  const vpW_MM = (viewW / zoom) * mmScale;
  const vpH_MM = (viewH / zoom) * mmScale;

  const handleMMClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = mmRef.current!.getBoundingClientRect();
    const diagX = (e.clientX - rect.left - MINIMAP_PAD) / mmScale + minX;
    const diagY = (e.clientY - rect.top - MINIMAP_PAD) / mmScale + minY;
    onPanTo(-(diagX * zoom - viewW / 2), -(diagY * zoom - viewH / 2));
  };

  return (
    <div style={{
      position: 'absolute', top: 8, right: 12,
      background: 'var(--theme-bg-secondary)',
      border: '1px solid var(--theme-border)',
      borderRadius: 6, overflow: 'hidden',
      boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
      pointerEvents: 'auto',
      opacity: 0.92,
    }}>
      <svg ref={mmRef} width={MINIMAP_W} height={MINIMAP_H}
        style={{ display: 'block', cursor: 'crosshair' }}
        onClick={handleMMClick}
      >
        {tables.map(t => {
          const { x, y } = toMM(t.x, t.y);
          return (
            <rect key={t.name} x={x} y={y}
              width={CARD_WIDTH * mmScale} height={tableHeight(t) * mmScale}
              rx={2} ry={2}
              fill="var(--theme-bg-tertiary, rgba(255,255,255,0.08))"
              stroke="var(--theme-border, #30363d)" strokeWidth={0.5}
            />
          );
        })}
        {relations.map(rel => {
          const fromT = tables.find(t => t.name === rel.fromTable);
          const toT = tables.find(t => t.name === rel.toTable);
          if (!fromT || !toT) return null;
          const f = toMM(fromT.x + CARD_WIDTH / 2, fromT.y + tableHeight(fromT) / 2);
          const t2 = toMM(toT.x + CARD_WIDTH / 2, toT.y + tableHeight(toT) / 2);
          return (
            <line key={rel.constraintName + rel.fromColumn}
              x1={f.x} y1={f.y} x2={t2.x} y2={t2.y}
              stroke={FK_COLOR} strokeWidth={0.5} opacity={0.4}
            />
          );
        })}
        <rect
          x={vpMM.x} y={vpMM.y}
          width={Math.max(4, vpW_MM)} height={Math.max(4, vpH_MM)}
          fill="rgba(88,166,255,0.08)" stroke={ACCENT} strokeWidth={1} rx={1}
          style={{ pointerEvents: 'none' }}
        />
      </svg>
    </div>
  );
};

// ── Export helpers ────────────────────────────────────────────────────────────────────────────────────

function exportAsSVG(svgEl: SVGSVGElement, filename: string) {
  const svgStr = new XMLSerializer().serializeToString(svgEl);
  (window as any).api.file.dialogSave({
    defaultPath: filename,
    filters: [{ name: 'SVG Image', extensions: ['svg'] }, { name: 'All Files', extensions: ['*'] }],
  }).then((r: { canceled: boolean; filePath?: string }) => {
    if (!r.canceled && r.filePath) {
      (window as any).api.fs.writeFile(r.filePath, svgStr);
    }
  });
}

function exportAsPNG(svgEl: SVGSVGElement, filename: string) {
  const svgStr = new XMLSerializer().serializeToString(svgEl);
  const { width, height } = svgEl.getBoundingClientRect();
  const scale = 2;
  const canvas = document.createElement('canvas');
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale);
  const url = URL.createObjectURL(new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' }));
  const img = new Image();
  img.onload = () => {
    ctx.drawImage(img, 0, 0, width, height);
    URL.revokeObjectURL(url);
    canvas.toBlob(blob => {
      if (!blob) return;
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        (window as any).api.file.dialogSave({
          defaultPath: filename,
          filters: [{ name: 'PNG Image', extensions: ['png'] }, { name: 'All Files', extensions: ['*'] }],
        }).then((r: { canceled: boolean; filePath?: string }) => {
          if (!r.canceled && r.filePath) {
            (window as any).api.fs.writeFile(r.filePath, Buffer.from(base64, 'base64'));
          }
        });
      };
      reader.readAsDataURL(blob);
    }, 'image/png');
  };
  img.src = url;
}

// ── Empty / loading states ────────────────────────────────────────

const Spinner: React.FC = () => (
  <span style={{
    display: 'inline-block', width: 18, height: 18,
    border: '2px solid var(--theme-border)', borderTopColor: ACCENT,
    borderRadius: '50%', animation: 'spin 0.6s linear infinite',
  }} />
);

// ── Main component ────────────────────────────────────────────────

export const ERDiagramView: React.FC = () => {
  const { erDiagram, erDiagramLoading, activeConnectionId, loadERDiagram } = useDBStore();

  // Pan & zoom state
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });
  const panOrigin = useRef({ x: 0, y: 0 });

  // Dragging a table card
  const draggingTable = useRef<string | null>(null);
  const dragStart = useRef({ mx: 0, my: 0, tx: 0, ty: 0 });

  // Local mutable table positions (override layout from store during session)
  const [tablePositions, setTablePositions] = useState<Record<string, { x: number; y: number }>>({});

  // Hover state for relation highlighting
  const [hoveredTable, setHoveredTable] = useState<string | null>(null);

  // Minimap
  const [showMinimap, setShowMinimap] = useState(true);
  const [viewSize, setViewSize] = useState({ w: 800, h: 600 });

  // Export dropdown
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Reset positions when diagram changes
  useEffect(() => {
    setTablePositions({});
    setPan({ x: 0, y: 0 });
    setZoom(1);
  }, [erDiagram?.connectionId, erDiagram?.databaseName]);

  // ── Pan ────────────────────────────────────────────────────────

  const onSvgMouseDown = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (draggingTable.current) return;
    isPanning.current = true;
    panStart.current = { x: e.clientX, y: e.clientY };
    panOrigin.current = { ...pan };
    e.preventDefault();
  }, [pan]);

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (draggingTable.current && erDiagram) {
      const dx = (e.clientX - dragStart.current.mx) / zoom;
      const dy = (e.clientY - dragStart.current.my) / zoom;
      setTablePositions((prev) => ({
        ...prev,
        [draggingTable.current!]: {
          x: dragStart.current.tx + dx,
          y: dragStart.current.ty + dy,
        },
      }));
      return;
    }
    if (isPanning.current) {
      setPan({
        x: panOrigin.current.x + e.clientX - panStart.current.x,
        y: panOrigin.current.y + e.clientY - panStart.current.y,
      });
    }
  }, [erDiagram, zoom]);

  const onMouseUp = useCallback(() => {
    isPanning.current = false;
    draggingTable.current = null;
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [onMouseMove, onMouseUp]);

  // ── Zoom ───────────────────────────────────────────────────────

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom((z) => Math.min(3, Math.max(0.2, z * delta)));
  }, []);

  // ── Table drag ────────────────────────────────────────────────

  const onTableDragStart = useCallback((e: React.MouseEvent, tableName: string) => {
    e.stopPropagation();
    if (!erDiagram) return;
    const base = erDiagram.tables.find((t) => t.name === tableName);
    if (!base) return;
    const pos = tablePositions[tableName] ?? { x: base.x, y: base.y };
    draggingTable.current = tableName;
    dragStart.current = { mx: e.clientX, my: e.clientY, tx: pos.x, ty: pos.y };
  }, [erDiagram, tablePositions]);

  // ── Resolved tables with overridden positions ─────────────────

  const resolvedTables: ERDiagramTable[] = erDiagram
    ? erDiagram.tables.map((t) => {
        const pos = tablePositions[t.name];
        return pos ? { ...t, x: pos.x, y: pos.y } : t;
      })
    : [];

  const tableMap = new Map<string, ERDiagramTable>(resolvedTables.map((t) => [t.name, t]));

  // ── Highlighted relations for hovered table ───────────────────

  const highlightedRelations = new Set<string>();
  const highlightedTableCols = new Map<string, Set<string>>();

  if (hoveredTable && erDiagram) {
    for (const rel of erDiagram.relations) {
      if (rel.fromTable === hoveredTable || rel.toTable === hoveredTable) {
        highlightedRelations.add(rel.constraintName);

        if (!highlightedTableCols.has(rel.fromTable)) highlightedTableCols.set(rel.fromTable, new Set());
        highlightedTableCols.get(rel.fromTable)!.add(rel.fromColumn);

        if (!highlightedTableCols.has(rel.toTable)) highlightedTableCols.set(rel.toTable, new Set());
        highlightedTableCols.get(rel.toTable)!.add(rel.toColumn);
      }
    }
  }

  // ── Fit to view ───────────────────────────────────────────────

  const handleFit = useCallback(() => {
    if (!erDiagram || !containerRef.current) return;
    const cw = containerRef.current.clientWidth;
    const ch = containerRef.current.clientHeight;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const t of resolvedTables) {
      minX = Math.min(minX, t.x);
      minY = Math.min(minY, t.y);
      maxX = Math.max(maxX, t.x + CARD_WIDTH);
      maxY = Math.max(maxY, t.y + tableHeight(t));
    }
    if (!isFinite(minX)) return;

    const diagramW = maxX - minX + 48;
    const diagramH = maxY - minY + 48;
    const newZoom = Math.min(1, Math.min(cw / diagramW, ch / diagramH));
    const newPanX = (cw - diagramW * newZoom) / 2 - minX * newZoom + 24 * newZoom;
    const newPanY = (ch - diagramH * newZoom) / 2 - minY * newZoom + 24 * newZoom;

    setZoom(newZoom);
    setPan({ x: newPanX, y: newPanY });
  }, [erDiagram, resolvedTables]);

  // Auto-fit on load
  useEffect(() => {
    if (erDiagram && !erDiagramLoading) {
      setTimeout(handleFit, 50);
    }
  }, [erDiagram, erDiagramLoading]);

  // Track container size for minimap viewport rect
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(entries => {
      const e = entries[0];
      if (e) setViewSize({ w: e.contentRect.width, h: e.contentRect.height });
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Close export dropdown on outside click
  useEffect(() => {
    if (!showExportMenu) return;
    const handler = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node))
        setShowExportMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showExportMenu]);

  // Minimap pan callback
  const handleMinimapPan = useCallback((x: number, y: number) => {
    setPan({ x, y });
  }, []);

  // ── Render ────────────────────────────────────────────────────

  const S = {
    root: {
      height: '100%',
      display: 'flex',
      flexDirection: 'column' as const,
      background: 'var(--theme-bg)',
      overflow: 'hidden',
      position: 'relative' as const,
    },
    toolbar: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '6px 12px',
      borderBottom: '1px solid var(--theme-border)',
      background: 'var(--theme-bg-secondary)',
      flexShrink: 0,
      fontSize: 12,
      color: 'var(--theme-fg-muted)',
    },
    toolbarBtn: {
      padding: '3px 10px',
      fontSize: 11,
      borderRadius: 4,
      border: '1px solid var(--theme-border)',
      background: 'var(--theme-bg-tertiary, rgba(255,255,255,0.05))',
      color: 'var(--theme-fg)',
      cursor: 'pointer',
    } as React.CSSProperties,
    canvas: {
      flex: 1,
      overflow: 'hidden',
      cursor: isPanning.current ? 'grabbing' : 'grab',
      position: 'relative' as const,
    },
    svg: {
      width: '100%',
      height: '100%',
      display: 'block',
      userSelect: 'none' as const,
    },
    center: {
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 14,
      height: '100%',
      color: 'var(--theme-fg-muted)',
      fontSize: 13,
    },
    refreshBtn: {
      padding: '6px 16px',
      fontSize: 12,
      borderRadius: 4,
      border: 'none',
      background: ACCENT,
      color: '#fff',
      cursor: 'pointer',
    },
    legend: {
      position: 'absolute' as const,
      bottom: 12,
      right: 12,
      background: 'var(--theme-bg-secondary)',
      border: '1px solid var(--theme-border)',
      borderRadius: 6,
      padding: '8px 12px',
      fontSize: 10,
      color: 'var(--theme-fg-muted)',
      display: 'flex',
      flexDirection: 'column' as const,
      gap: 4,
      pointerEvents: 'none' as const,
    },
    legendItem: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
    },
  };

  if (erDiagramLoading) {
    return (
      <div style={S.root}>
        <div style={S.center}>
          <Spinner />
          <span>Generating ER Diagram...</span>
        </div>
      </div>
    );
  }

  if (!erDiagram) {
    return (
      <div style={S.root}>
        <div style={S.center}>
          <svg width="40" height="40" viewBox="0 0 16 16" fill="var(--theme-fg-muted)" opacity={0.3}>
            <path d="M1 2.75A.75.75 0 0 1 1.75 2h3.5a.75.75 0 0 1 .75.75v2.5A.75.75 0 0 1 5.25 6H4v1h4V6h-1.25A.75.75 0 0 1 6 5.25v-2.5A.75.75 0 0 1 6.75 2h3.5a.75.75 0 0 1 .75.75v2.5A.75.75 0 0 1 10.25 6H9v1h2.25a.75.75 0 0 1 .75.75V9h.25a.75.75 0 0 1 .75.75v2.5a.75.75 0 0 1-.75.75h-3.5a.75.75 0 0 1-.75-.75v-2.5A.75.75 0 0 1 8.75 9H9V8H4v1h.25a.75.75 0 0 1 .75.75v2.5a.75.75 0 0 1-.75.75h-3.5A.75.75 0 0 1 0 12.25v-2.5A.75.75 0 0 1 .75 9H1V7.75A.75.75 0 0 1 1.75 7H4V6H2.75A.75.75 0 0 1 2 5.25v-2.5z"/>
          </svg>
          <span>No diagram loaded.</span>
          <span style={{ fontSize: 11, opacity: 0.6 }}>
            Connect to a database and click the diagram icon next to the database name in the sidebar.
          </span>
          {activeConnectionId && (
            <button style={S.refreshBtn} onClick={() => loadERDiagram(activeConnectionId)}>
              Generate Diagram
            </button>
          )}
        </div>
      </div>
    );
  }

  const svgWidth = resolvedTables.reduce((max, t) => Math.max(max, t.x + CARD_WIDTH + 60), 800);
  const svgHeight = resolvedTables.reduce((max, t) => Math.max(max, t.y + tableHeight(t) + 60), 600);

  return (
    <div style={S.root}>
      {/* Toolbar */}
      <div style={S.toolbar}>
        <span style={{ fontWeight: 600, color: 'var(--theme-fg)' }}>{erDiagram.databaseName}</span>
        <span style={{ opacity: 0.5 }}>/</span>
        <span>{erDiagram.tables.length} tables</span>
        <span style={{ opacity: 0.4 }}>·</span>
        <span>{erDiagram.relations.length} relations</span>
        <div style={{ flex: 1 }} />
        <button style={S.toolbarBtn} onClick={handleFit} title="Fit diagram to viewport">
          Fit
        </button>
        <button
          style={S.toolbarBtn}
          onClick={() => setZoom((z) => Math.min(3, z * 1.2))}
          title="Zoom in"
        >
          +
        </button>
        <span style={{ minWidth: 38, textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
        <button
          style={S.toolbarBtn}
          onClick={() => setZoom((z) => Math.max(0.2, z * 0.8))}
          title="Zoom out"
        >
          &minus;
        </button>
        <button
          style={{ ...S.toolbarBtn, background: showMinimap ? 'rgba(88,166,255,0.15)' : undefined }}
          onClick={() => setShowMinimap(v => !v)}
          title="Toggle minimap"
        >
          Map
        </button>
        {/* Export dropdown */}
        <div ref={exportMenuRef} style={{ position: 'relative' }}>
          <button
            style={{ ...S.toolbarBtn, marginLeft: 4 }}
            onClick={() => setShowExportMenu(v => !v)}
            title="Export diagram"
          >
            Export ▾
          </button>
          {showExportMenu && (
            <div style={{
              position: 'absolute', top: '100%', right: 0, zIndex: 100,
              background: 'var(--theme-bg-secondary)', border: '1px solid var(--theme-border)',
              borderRadius: 6, padding: '4px 0', minWidth: 130,
              boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
            }}>
              <button
                style={{ display: 'block', width: '100%', padding: '6px 14px', fontSize: 12,
                  background: 'none', border: 'none', textAlign: 'left', color: 'var(--theme-fg)', cursor: 'pointer' }}
                onClick={() => { setShowExportMenu(false); if (svgRef.current) exportAsSVG(svgRef.current, `${erDiagram.databaseName}-erd.svg`); }}
              >
                Export as SVG
              </button>
              <button
                style={{ display: 'block', width: '100%', padding: '6px 14px', fontSize: 12,
                  background: 'none', border: 'none', textAlign: 'left', color: 'var(--theme-fg)', cursor: 'pointer' }}
                onClick={() => { setShowExportMenu(false); if (svgRef.current) exportAsPNG(svgRef.current, `${erDiagram.databaseName}-erd.png`); }}
              >
                Export as PNG
              </button>
            </div>
          )}
        </div>
        <button
          style={{ ...S.toolbarBtn, marginLeft: 4 }}
          onClick={() => activeConnectionId && loadERDiagram(activeConnectionId)}
          title="Refresh diagram"
        >
          Refresh
        </button>
      </div>

      {/* Canvas */}
      <div ref={containerRef} style={S.canvas}>
        <svg
          ref={svgRef}
          style={S.svg}
          onMouseDown={onSvgMouseDown}
          onWheel={onWheel}
        >
          <defs>
            {/* Arrowhead markers */}
            <marker id="arrow-dim" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
              <path d="M0,0 L0,6 L8,3 z" fill="var(--theme-border, #30363d)" opacity={0.6} />
            </marker>
            <marker id="arrow-hl" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
              <path d="M0,0 L0,6 L8,3 z" fill={FK_COLOR} />
            </marker>
          </defs>

          {/* Pannable / zoomable group */}
          <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>

            {/* Subtle grid */}
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="var(--theme-border, #30363d)" strokeWidth={0.5} opacity={0.3} />
              </pattern>
            </defs>
            <rect
              x={-pan.x / zoom - 200}
              y={-pan.y / zoom - 200}
              width={svgWidth + 400}
              height={svgHeight + 400}
              fill="url(#grid)"
            />

            {/* Relations — render behind cards */}
            {erDiagram.relations.map((rel) => {
              const from = tableMap.get(rel.fromTable);
              const to = tableMap.get(rel.toTable);
              if (!from || !to) return null;
              const isHl = highlightedRelations.has(rel.constraintName);
              return (
                <RelationLine
                  key={rel.constraintName + rel.fromColumn + rel.toColumn}
                  relation={rel}
                  fromTable={from}
                  toTable={to}
                  highlighted={isHl}
                />
              );
            })}

            {/* Table cards */}
            {resolvedTables.map((table) => {
              const isHl = hoveredTable === table.name ||
                (hoveredTable !== null && highlightedTableCols.has(table.name));
              const hlCols = highlightedTableCols.get(table.name) ?? new Set<string>();

              return (
                <TableCard
                  key={table.name}
                  table={table}
                  highlighted={isHl}
                  highlightedCols={hlCols}
                  onMouseEnter={() => setHoveredTable(table.name)}
                  onMouseLeave={() => setHoveredTable(null)}
                  onDragStart={onTableDragStart}
                />
              );
            })}
          </g>
        </svg>

        {/* Minimap */}
        {showMinimap && erDiagram && (
          <Minimap
            tables={resolvedTables}
            relations={erDiagram.relations}
            pan={pan}
            zoom={zoom}
            viewW={viewSize.w}
            viewH={viewSize.h}
            onPanTo={handleMinimapPan}
          />
        )}

        {/* Legend */}
        <div style={S.legend}>
          <div style={S.legendItem}>
            <span style={{ width: 20, height: 2, background: 'rgba(88,166,255,0.6)', display: 'inline-block', borderRadius: 1 }} />
            <span>Foreign Key relation</span>
          </div>
          <div style={S.legendItem}>
            <span style={{ fontSize: 9, fontWeight: 700, color: PK_COLOR, fontFamily: 'monospace', width: 20, display: 'inline-block' }}>PK</span>
            <span>Primary Key</span>
          </div>
          <div style={S.legendItem}>
            <span style={{ fontSize: 9, fontWeight: 700, color: FK_COLOR, fontFamily: 'monospace', width: 20, display: 'inline-block' }}>FK</span>
            <span>Foreign Key column</span>
          </div>
          <div style={{ borderTop: '1px solid var(--theme-border)', paddingTop: 4, marginTop: 2, opacity: 0.6 }}>
            Scroll to zoom · Drag to pan · Move cards to reposition
          </div>
        </div>
      </div>
    </div>
  );
};
