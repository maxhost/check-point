"use client";
import { useId, useState } from "react";
import {
  Button as AriaButton,
  Tooltip,
  TooltipTrigger,
} from "react-aria-components";
import { Text } from "./text";

export type LineChartPoint = { x: number; y: number; label?: string };

function ChartNode({ x, y, label }: { x: number; y: number; label: string }) {
  const [open, setOpen] = useState(false);
  return (
    <TooltipTrigger delay={0} isOpen={open} onOpenChange={setOpen}>
      <AriaButton
        aria-label={label}
        onPress={() => setOpen(true)}
        onHoverStart={() => setOpen(true)}
        onHoverEnd={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="absolute size-10 -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-full bg-transparent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        style={{ left: `${(x / 640) * 100}%`, top: `${(y / 220) * 100}%` }}
      />
      <Tooltip
        offset={8}
        className="z-50 max-w-64 rounded-md border border-border bg-surface px-3 py-2 text-sm text-content shadow-md"
      >
        {label}
      </Tooltip>
    </TooltipTrigger>
  );
}
/** Linear geometry uses actual time coordinates; equal values remain a flat line. */
export function lineChartGeometry(points: readonly LineChartPoint[]) {
  if (
    points.length < 2 ||
    points.some(
      ({ x, y }) => !Number.isFinite(x) || !Number.isFinite(y) || y < 0,
    )
  )
    return null;
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs),
    maxX = Math.max(...xs);
  const minY = Math.min(...ys),
    maxY = Math.max(...ys);
  if (minX === maxX) return null;
  // Divide before multiplying to avoid overflow for large, otherwise finite costs.
  const range = maxY - minY;
  const coordinates = points.map(({ x, y }) => ({
    x: 16 + ((x - minX) / (maxX - minX)) * 608,
    y: range === 0 ? 110 : 200 - ((y - minY) / range) * 180,
  }));
  return {
    coordinates,
    path: coordinates
      .map(({ x, y }, index) => `${index ? "L" : "M"}${x},${y}`)
      .join(" "),
  };
}

export function LineChart({
  title,
  description,
  points,
  firstDate,
  lastDate,
  minimum,
  maximum,
}: {
  title: string;
  description: string;
  points: readonly LineChartPoint[];
  firstDate: string;
  lastDate: string;
  minimum: string;
  maximum: string;
}) {
  const id = useId();
  const geometry = lineChartGeometry(points);
  if (!geometry) return null;
  return (
    <div className="grid min-w-0 gap-2">
      <div className="flex flex-wrap justify-between gap-2">
        <Text variant="small">Mín. {minimum}</Text>
        <Text variant="small">Máx. {maximum}</Text>
      </div>
      <div className="relative">
        <svg
          viewBox="0 0 640 220"
          role="img"
          aria-labelledby={`${id}-title ${id}-description`}
          className="block w-full rounded-xl bg-surface-subtle text-chart-lavender"
        >
          <title id={`${id}-title`}>{title}</title>
          <desc id={`${id}-description`}>{description}</desc>
          <defs>
            <linearGradient id={`${id}-area`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.38" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0.03" />
            </linearGradient>
          </defs>
          <path
            d={`${geometry.path} L624,220 L16,220 Z`}
            fill={`url(#${id}-area)`}
            aria-hidden="true"
          />
          <path
            d={geometry.path}
            fill="none"
            stroke="currentColor"
            className="text-info"
            strokeWidth="3"
            vectorEffect="non-scaling-stroke"
          />
          {geometry.coordinates.map(({ x, y }, index) => (
            <circle key={index} cx={x} cy={y} r="6" className="fill-info" />
          ))}
        </svg>
        {geometry.coordinates.map(({ x, y }, index) => (
          <ChartNode
            key={index}
            x={x}
            y={y}
            label={
              points[index].label ?? `${points[index].x}: ${points[index].y}`
            }
          />
        ))}
      </div>
      <div className="flex justify-between gap-4">
        <Text variant="small">{firstDate}</Text>
        <Text variant="small" className="text-right">
          {lastDate}
        </Text>
      </div>
    </div>
  );
}
