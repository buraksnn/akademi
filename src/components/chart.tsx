'use client';
import {
  LineChart,
  Line,
  ResponsiveContainer,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
export default function Chart({ data }: { data: { name: string; net: number }[] }) {
  return (
    <div
      className="chart"
      role="img"
      aria-label={data.map((v) => v.name + ': ' + v.net + ' net').join(', ')}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 12, right: 20, bottom: 0, left: -22 }}>
          <CartesianGrid stroke="#eeeeee" vertical={false} />
          <XAxis dataKey="name" fontSize={11} tickLine={false} axisLine={false} minTickGap={25} />
          <YAxis fontSize={11} tickLine={false} axisLine={false} />
          <Tooltip
            formatter={(v) => [v + ' net', 'Toplam']}
            contentStyle={{ border: '1px solid #e8e8e8', borderRadius: 6, fontSize: 12 }}
          />
          <Line
            type="linear"
            dataKey="net"
            stroke="#2563eb"
            strokeWidth={2}
            isAnimationActive={false}
            dot={{ r: 3, fill: '#fff', strokeWidth: 2 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
