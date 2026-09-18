export interface BarChartPoint {
  date: string;
  value: number;
}

export default function BarChart({
  data,
  limit,
  color = '#4834a3',
  overColor = '#d64545',
  label = 'תרשים נתונים יומי'
}: {
  data: BarChartPoint[];
  limit?: number;
  color?: string;
  overColor?: string;
  label?: string;
}) {
  const max = Math.max(limit || 0, ...data.map((d) => d.value), 1);
  const width = 640;
  const height = 180;
  const barGap = 8;
  const barWidth = data.length ? (width - barGap * (data.length - 1)) / data.length : 0;

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height + 24}`} role="img" aria-label={label}>
      {limit ? (
        <line
          x1={0}
          x2={width}
          y1={height - (limit / max) * height}
          y2={height - (limit / max) * height}
          stroke={overColor}
          strokeDasharray="4 4"
          strokeWidth={1.5}
        />
      ) : null}
      {data.map((d, i) => {
        const barHeight = max > 0 ? (d.value / max) * height : 0;
        const x = i * (barWidth + barGap);
        const dateLabel = d.date.slice(5); // MM-DD
        return (
          <g key={d.date}>
            <rect
              x={x}
              y={height - barHeight}
              width={barWidth}
              height={barHeight}
              rx={4}
              fill={d.value > (limit || Infinity) ? overColor : color}
            />
            <text x={x + barWidth / 2} y={height + 16} fontSize={11} textAnchor="middle" fill="#6b7386">
              {dateLabel}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
