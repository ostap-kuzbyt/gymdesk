import type { ReactNode } from "react";
import type { TooltipContentProps } from "recharts";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatDate, formatMoney } from "@/lib/format";
import { periodLabel } from "./shape";
import type { SeriesPoint } from "./shape";

const AXIS = { fill: "var(--muted-foreground)", fontSize: 12 };
const GRID = "var(--border)";
const AXIS_LINE = "var(--input)";
const HOVER_CURSOR = { fill: "var(--foreground)", fillOpacity: 0.08 };
const SERIES_COLORS = [
  "var(--plate-blue)",
  "var(--plate-green)",
  "var(--plate-yellow)",
  "var(--plate-red)",
  "var(--muted-foreground)",
];

function legendLabel(value: string) {
  return <span className="text-foreground">{value}</span>;
}

export function seriesColor(index: number): string {
  return SERIES_COLORS[index % SERIES_COLORS.length] ?? "var(--plate-blue)";
}

function Frame({ label, children }: { label: string; children: ReactNode }) {
  return (
    <figure role="img" aria-label={label} className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        {children as React.ReactElement}
      </ResponsiveContainer>
    </figure>
  );
}

function TooltipBox({
  title,
  lines,
}: {
  title: string;
  lines: { label: string; value: string; color?: string }[];
}) {
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-none">
      <div className="mb-1 font-medium">{title}</div>
      {lines.map((line) => (
        <div key={line.label} className="flex items-center gap-2">
          {line.color ? (
            <span
              aria-hidden
              className="size-2.5 rounded-full"
              style={{ background: line.color }}
            />
          ) : null}
          <span className="text-muted-foreground">{line.label}</span>
          <span className="ml-auto tabular-nums">{line.value}</span>
        </div>
      ))}
    </div>
  );
}

export function RevenueChart({
  rows,
  currency,
  label,
}: {
  rows: { period: string; revenueCents: number; subscriptions: number }[];
  currency: string;
  label: string;
}) {
  const data = rows.map((row) => ({
    ...row,
    name: periodLabel(row.period),
    revenue: row.revenueCents / 100,
  }));

  return (
    <Frame label={label}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="name" tick={AXIS} tickLine={false} axisLine={{ stroke: AXIS_LINE }} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} width={56} />
        <Tooltip
          cursor={HOVER_CURSOR}
          content={({ active, payload }: TooltipContentProps) => {
            const point = payload?.[0]?.payload as (typeof data)[number] | undefined;
            if (!active || !point) return null;
            return (
              <TooltipBox
                title={point.name}
                lines={[
                  {
                    label: "Revenue",
                    value: formatMoney(point.revenueCents, currency),
                    color: "var(--plate-blue)",
                  },
                  { label: "Subscriptions", value: String(point.subscriptions) },
                ]}
              />
            );
          }}
        />
        <Bar
          dataKey="revenue"
          fill="var(--plate-blue)"
          radius={[3, 3, 0, 0]}
          isAnimationActive={false}
        />
      </BarChart>
    </Frame>
  );
}

export function CoachHoursChart({
  points,
  series,
  label,
}: {
  points: SeriesPoint[];
  series: { id: string; name: string }[];
  label: string;
}) {
  return (
    <Frame label={label}>
      <BarChart data={points} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis
          dataKey="date"
          tick={AXIS}
          tickLine={false}
          axisLine={{ stroke: AXIS_LINE }}
          tickFormatter={(value: string) => String(Number(value.slice(8)))}
          interval="preserveStartEnd"
        />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} width={40} unit=" h" />
        <Tooltip
          cursor={HOVER_CURSOR}
          content={({ active, label: date, payload }: TooltipContentProps) => {
            if (!active || !payload) return null;
            const lines = payload
              .filter((item) => Number(item.value) > 0)
              .map((item) => ({
                label: String(item.name),
                value: `${item.value} h`,
                ...(item.color ? { color: item.color } : {}),
              }));
            return (
              <TooltipBox
                title={formatDate(String(date))}
                lines={lines.length > 0 ? lines : [{ label: "No workouts", value: "" }]}
              />
            );
          }}
        />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} formatter={legendLabel} />
        {series.map((item, index) => (
          <Bar
            key={item.id}
            dataKey={item.id}
            name={item.name}
            stackId="hours"
            fill={seriesColor(index)}
            stroke="var(--card)"
            strokeWidth={1.5}
            isAnimationActive={false}
          />
        ))}
      </BarChart>
    </Frame>
  );
}

export function StudioBookingsChart({
  points,
  label,
}: {
  points: { date: string; booked: number; capacity: number }[];
  label: string;
}) {
  return (
    <Frame label={label}>
      <BarChart data={points} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis
          dataKey="date"
          tick={AXIS}
          tickLine={false}
          axisLine={{ stroke: AXIS_LINE }}
          tickFormatter={(value: string) => String(Number(value.slice(8)))}
          interval="preserveStartEnd"
        />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} width={40} />
        <Tooltip
          cursor={HOVER_CURSOR}
          content={({ active, label: date, payload }: TooltipContentProps) => {
            const point = payload?.[0]?.payload as { booked: number; capacity: number } | undefined;
            if (!active || !point) return null;
            return (
              <TooltipBox
                title={formatDate(String(date))}
                lines={[
                  { label: "Booked", value: String(point.booked), color: "var(--plate-green)" },
                  {
                    label: "Places offered",
                    value: String(point.capacity),
                    color: "var(--muted-foreground)",
                  },
                ]}
              />
            );
          }}
        />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} formatter={legendLabel} />
        <Bar
          dataKey="capacity"
          name="Places offered"
          fill="var(--muted-foreground)"
          fillOpacity={0.35}
          stroke="var(--muted-foreground)"
          strokeWidth={1.5}
          isAnimationActive={false}
        />
        <Bar dataKey="booked" name="Booked" fill="var(--plate-green)" isAnimationActive={false} />
      </BarChart>
    </Frame>
  );
}
