"use client";
import { useId } from "react";
import { Text } from "./text";

export type LineChartPoint = { x: number; y: number };
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
          <circle key={index} cx={x} cy={y} r="3" className="fill-info" />
        ))}
      </svg>
      <div className="flex justify-between gap-4">
        <Text variant="small">{firstDate}</Text>
        <Text variant="small" className="text-right">
          {lastDate}
        </Text>
      </div>
    </div>
  );
}
