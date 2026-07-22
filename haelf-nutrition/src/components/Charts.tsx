import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline, Rect, Text as SvgText } from 'react-native-svg';
import { theme } from '@/src/theme';
import { splitContinuousSegments } from '@/src/domain/progress';

export type BarPoint = {
  label: string;
  value: number | null; // null = 未記錄
  goal?: number | null;
};

export function SimpleBarChart({
  points,
  emptyLabel,
  accessibilityLabel,
}: {
  points: BarPoint[];
  emptyLabel: string;
  accessibilityLabel: string;
}) {
  const hasAny = points.some((p) => p.value != null);
  if (!hasAny) {
    return (
      <View style={styles.empty} accessibilityLabel={emptyLabel}>
        <Text style={styles.emptyText}>{emptyLabel}</Text>
      </View>
    );
  }
  const width = 340;
  const height = 180;
  const pad = 28;
  const values = points.map((p) => p.value ?? 0);
  const goals = points.map((p) => p.goal ?? 0);
  const max = Math.max(...values, ...goals, 1);
  const barW = (width - pad * 2) / points.length - 8;

  return (
    <View accessibilityLabel={accessibilityLabel}>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        {points.map((p, i) => {
          const x = pad + i * ((width - pad * 2) / points.length) + 4;
          if (p.value == null) {
            return (
              <SvgText
                key={p.label}
                x={x + barW / 2}
                y={height - 8}
                fontSize="10"
                fill={theme.colors.textMuted}
                textAnchor="middle"
              >
                —
              </SvgText>
            );
          }
          const h = ((p.value / max) * (height - pad * 2)) | 0;
          const y = height - pad - h;
          return (
            <Rect
              key={p.label}
              x={x}
              y={y}
              width={barW}
              height={h}
              fill={theme.colors.chartFood}
              accessibilityLabel={`${p.label}: ${p.value}`}
            />
          );
        })}
        {points.map((p, i) => {
          if (p.goal == null) return null;
          const x = pad + i * ((width - pad * 2) / points.length) + 2;
          const y = height - pad - (p.goal / max) * (height - pad * 2);
          return (
            <Line
              key={`g-${p.label}`}
              x1={x}
              y1={y}
              x2={x + barW + 4}
              y2={y}
              stroke={theme.colors.danger}
              strokeWidth="2"
              accessibilityLabel={`${p.label} 目標: ${p.goal}`}
            />
          );
        })}
        {points.map((p, i) => (
          <SvgText
            key={`l-${p.label}`}
            x={pad + i * ((width - pad * 2) / points.length) + barW / 2 + 4}
            y={height - 4}
            fontSize="9"
            fill={theme.colors.textMuted}
            textAnchor="middle"
          >
            {p.label.slice(5)}
          </SvgText>
        ))}
      </Svg>
      <Text style={styles.legend}>■ 攝取　━ 目標　— 未記錄</Text>
    </View>
  );
}

export type LinePoint = { label: string; value: number | null };

export function SimpleLineChart({
  points,
  emptyLabel,
  accessibilityLabel,
}: {
  points: LinePoint[];
  emptyLabel: string;
  accessibilityLabel: string;
}) {
  const present = points.filter((p) => p.value != null);
  if (!present.length) {
    return (
      <View style={styles.empty} accessibilityLabel={emptyLabel}>
        <Text style={styles.emptyText}>{emptyLabel}</Text>
      </View>
    );
  }
  const width = 340;
  const height = 180;
  const pad = 28;
  const vals = present.map((p) => p.value as number);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const coords = points.map((p, i) => {
    const x = pad + (i / Math.max(points.length - 1, 1)) * (width - pad * 2);
    if (p.value == null) return null;
    const y = height - pad - ((p.value - min) / span) * (height - pad * 2);
    return { x, y, label: p.label, value: p.value };
  });
  const segments = splitContinuousSegments(coords);

  return (
    <View accessibilityLabel={accessibilityLabel}>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        {segments.map((segment, index) =>
          segment.length >= 2 ? (
            <Polyline
              key={`segment-${index}`}
              points={segment.map((coordinate) => `${coordinate.x},${coordinate.y}`).join(' ')}
              fill="none"
              stroke={theme.colors.chartWeight}
              strokeWidth="2"
            />
          ) : null
        )}
        {coords.map((c, i) =>
          c ? (
            <Circle
              key={i}
              cx={c.x}
              cy={c.y}
              r={4}
              fill={theme.colors.chartWeight}
              accessibilityLabel={`${c.label}: ${c.value}`}
            />
          ) : null
        )}
        {points.map((p, i) => (
          <SvgText
            key={p.label}
            x={pad + (i / Math.max(points.length - 1, 1)) * (width - pad * 2)}
            y={height - 4}
            fontSize="9"
            fill={theme.colors.textMuted}
            textAnchor="middle"
          >
            {p.label.slice(5)}
          </SvgText>
        ))}
        <Line
          x1={pad}
          y1={height - pad}
          x2={width - pad}
          y2={height - pad}
          stroke={theme.colors.border}
        />
      </Svg>
      <Text style={styles.legend}>● 當日最後體重（缺口＝無紀錄）</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.space.md,
  },
  emptyText: {
    color: theme.colors.textMuted,
    fontSize: theme.font.body,
    textAlign: 'center',
  },
  legend: {
    fontSize: theme.font.small,
    color: theme.colors.textMuted,
    marginTop: theme.space.sm,
  },
});
