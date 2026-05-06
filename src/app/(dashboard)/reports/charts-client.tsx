"use client";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

export type DailyPoint = {
  date: string;
  approvals: number;
  issues: number;
  health: number;
};

export function HealthTrendChart({ data }: { data: DailyPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <defs>
          <linearGradient id="qc-health" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: "#64748b" }}
          tickLine={false}
          axisLine={{ stroke: "#e2e8f0" }}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fontSize: 11, fill: "#64748b" }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `${v}%`}
        />
        <Tooltip
          contentStyle={{
            borderRadius: 8,
            border: "1px solid #e2e8f0",
            fontSize: 12,
          }}
          formatter={(v: unknown) => [
            typeof v === "number" ? `${v.toFixed(1)}%` : `${v}`,
            "Health",
          ]}
        />
        <Area
          type="monotone"
          dataKey="health"
          stroke="#2563eb"
          strokeWidth={2.5}
          fill="url(#qc-health)"
          isAnimationActive
          animationDuration={800}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function ApprovalsIssuesChart({ data }: { data: DailyPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: "#64748b" }}
          tickLine={false}
          axisLine={{ stroke: "#e2e8f0" }}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "#64748b" }}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{
            borderRadius: 8,
            border: "1px solid #e2e8f0",
            fontSize: 12,
          }}
        />
        <Legend
          wrapperStyle={{ fontSize: 12, paddingTop: 6 }}
          iconType="circle"
        />
        <Line
          type="monotone"
          dataKey="approvals"
          stroke="#10b981"
          strokeWidth={2.5}
          dot={{ r: 3, fill: "#10b981" }}
          activeDot={{ r: 5 }}
          name="Approvals"
          isAnimationActive
          animationDuration={800}
        />
        <Line
          type="monotone"
          dataKey="issues"
          stroke="#ef4444"
          strokeWidth={2.5}
          dot={{ r: 3, fill: "#ef4444" }}
          activeDot={{ r: 5 }}
          name="Issues"
          isAnimationActive
          animationDuration={900}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
