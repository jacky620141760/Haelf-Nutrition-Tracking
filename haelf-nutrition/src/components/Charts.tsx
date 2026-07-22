import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, G, Line, Polyline, Rect, Text as SvgText } from 'react-native-svg';
import { theme } from '@/src/theme';
import { splitTrendLineIndices, recordedTrendLineIndices } from '@/src/domain/progress';

export type TrendPoint = {
  label: string;
  value: number | null;
};

const WIDTH = 340;
const HEIGHT = 180;
const PLOT = { left: 44, right: 8, top: 10, bottom: 28 };
const CALORIE_PLOT = { left: 50, right: 8, top: 10, bottom: 28 };

function plotWidth(margin = PLOT): number {
  return WIDTH - margin.left - margin.right;
}

function plotHeight(margin = PLOT): number {
  return HEIGHT - margin.top - margin.bottom;
}

function niceStep(span: number, targetTicks: number): number {
  const rough = span / Math.max(targetTicks, 1);
  if (rough <= 0 || !Number.isFinite(rough)) return 1;
  const pow = 10 ** Math.floor(Math.log10(rough));
  const frac = rough / pow;
  let niceFrac = 10;
  if (frac <= 1) niceFrac = 1;
  else if (frac <= 2) niceFrac = 2;
  else if (frac <= 5) niceFrac = 5;
  return niceFrac * pow;
}

function computeYAxis(
  values: number[],
  options?: { floorMin?: number; extra?: number[] }
): { min: number; max: number; ticks: number[] } {
  const all = [...values, ...(options?.extra ?? [])].filter((v) => Number.isFinite(v));
  if (!all.length) {
    return { min: 0, max: 100, ticks: [0, 50, 100] };
  }
  let dataMin = Math.min(...all);
  let dataMax = Math.max(...all);
  if (dataMin === dataMax) {
    const bump = Math.abs(dataMin) * 0.1 || 1;
    dataMin -= bump;
    dataMax += bump;
  }
  const pad = (dataMax - dataMin) * 0.12 || 1;
  let min = dataMin - pad;
  let max = dataMax + pad;
  if (options?.floorMin != null) min = Math.max(options.floorMin, min);
  const step = niceStep(max - min, 4);
  const tickMin = Math.floor(min / step) * step;
  const tickMax = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let t = tickMin; t <= tickMax + step * 0.001; t += step) {
    ticks.push(Math.round(t * 100) / 100);
  }
  return { min: tickMin, max: tickMax, ticks };
}

function xAt(index: number, count: number, margin = PLOT): number {
  const w = plotWidth(margin);
  if (count <= 1) return margin.left + w / 2;
  return margin.left + (index / (count - 1)) * w;
}

function xAtInset(index: number, count: number, margin: typeof PLOT, inset: number): number {
  const w = plotWidth(margin);
  const inner = Math.max(0, w - inset * 2);
  if (count <= 1) return margin.left + w / 2;
  return margin.left + inset + (index / (count - 1)) * inner;
}

function yAt(value: number, yMin: number, yMax: number, margin = PLOT): number {
  const span = yMax - yMin || 1;
  return margin.top + plotHeight(margin) - ((value - yMin) / span) * plotHeight(margin);
}

function yAtInset(
  value: number,
  yMin: number,
  yMax: number,
  margin: typeof PLOT,
  inset: number
): number {
  const h = plotHeight(margin);
  const inner = Math.max(0, h - inset * 2);
  const span = yMax - yMin || 1;
  return margin.top + inset + inner - ((value - yMin) / span) * inner;
}

function labelIndices(count: number, maxLabels = 6): number[] {
  if (count <= maxLabels) return Array.from({ length: count }, (_, i) => i);
  const indices: number[] = [];
  for (let i = 0; i < maxLabels; i++) {
    indices.push(Math.round((i / (maxLabels - 1)) * (count - 1)));
  }
  return [...new Set(indices)];
}

function formatTick(value: number): string {
  if (Math.abs(value) >= 1000) return `${Math.round(value / 100) / 10}k`;
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(1);
}

function formatCalorieTick(value: number): string {
  const rounded = Math.round(value);
  if (rounded >= 1000) return `${Math.round(rounded / 100) / 10}k`;
  return String(rounded);
}

function computeCalorieYAxis(values: number[], goalKcal: number | null): { min: number; max: number; ticks: number[] } {
  const all = [...values, ...(goalKcal != null ? [goalKcal] : [])].filter((v) => Number.isFinite(v));
  if (!all.length) {
    return { min: 0, max: 2000, ticks: [0, 1000, 2000] };
  }
  const dataMax = Math.max(...all);
  const step = dataMax <= 1200 ? 200 : dataMax <= 2500 ? 250 : dataMax <= 4000 ? 500 : 1000;
  const max = Math.max(step * 2, Math.ceil((dataMax * 1.08) / step) * step);
  const ticks: number[] = [];
  for (let t = 0; t <= max + step * 0.001; t += step) {
    ticks.push(t);
  }
  return { min: 0, max, ticks };
}

function caloriePlotLeft(ticks: number[]): number {
  const longest = Math.max(...ticks.map((t) => formatCalorieTick(t).length), 1);
  return Math.max(CALORIE_PLOT.left, longest * 6 + 10);
}

function weekdayShortLabel(isoDate: string, locale: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(new Date(y, m - 1, d));
}

type PlotCoord = { x: number; y: number; label: string; value: number };

function buildPlotCoords(
  points: TrendPoint[],
  yMin: number,
  yMax: number,
  margin = PLOT,
  markerRadius = 0
): (PlotCoord | null)[] {
  const inset = markerRadius;
  return points.map((p, i) => {
    if (p.value == null) return null;
    return {
      x:
        inset > 0
          ? xAtInset(i, points.length, margin, inset)
          : xAt(i, points.length, margin),
      y:
        inset > 0
          ? yAtInset(p.value, yMin, yMax, margin, inset)
          : yAt(p.value, yMin, yMax, margin),
      label: p.label,
      value: p.value,
    };
  });
}

function LineSegments({
  indices,
  coords,
  color,
}: {
  indices: number[][];
  coords: (PlotCoord | null)[];
  color: string;
}) {
  return (
    <>
      {indices.map((segment, index) => {
        if (segment.length < 2) return null;
        const plotted = segment.map((i) => coords[i]).filter((c): c is PlotCoord => c != null);
        if (plotted.length < 2) return null;
        return (
          <Polyline
            key={`seg-${index}`}
            points={plotted.map((c) => `${c.x},${c.y}`).join(' ')}
            fill="none"
            stroke={color}
            strokeWidth="2"
          />
        );
      })}
    </>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <View style={styles.empty} accessibilityLabel={label}>
      <Text style={styles.emptyText}>{label}</Text>
    </View>
  );
}

function WeekdayXLabels({
  points,
  locale,
  margin,
}: {
  points: TrendPoint[];
  locale: string;
  margin: typeof CALORIE_PLOT;
}) {
  return (
    <>
      {points.map((p, i) => (
        <SvgText
          key={`x-${p.label}`}
          x={xAt(i, points.length, margin)}
          y={HEIGHT - 4}
          fontSize="9"
          fill={theme.colors.textMuted}
          textAnchor="middle"
        >
          {weekdayShortLabel(p.label, locale)}
        </SvgText>
      ))}
    </>
  );
}

function XLabels({ points, maxLabels = 6 }: { points: TrendPoint[]; maxLabels?: number }) {
  const indices = labelIndices(points.length, maxLabels);
  return (
    <>
      {indices.map((i) => (
        <SvgText
          key={`x-${points[i].label}-${i}`}
          x={xAt(i, points.length)}
          y={HEIGHT - 4}
          fontSize="9"
          fill={theme.colors.textMuted}
          textAnchor="middle"
        >
          {points[i].label.slice(5).replace('-', '/')}
        </SvgText>
      ))}
    </>
  );
}

/** Daily kcal as dots + line; single horizontal goal line. */
export function CalorieTrendChart({
  points,
  goalKcal,
  locale = 'zh-TW',
  emptyLabel,
  accessibilityLabel,
}: {
  points: TrendPoint[];
  goalKcal: number | null;
  locale?: string;
  emptyLabel: string;
  accessibilityLabel: string;
}) {
  const recorded = points.filter((p) => p.value != null);
  if (!recorded.length && goalKcal == null) {
    return <EmptyChart label={emptyLabel} />;
  }

  const values = recorded.map((p) => p.value as number);
  const { min, max, ticks } = computeCalorieYAxis(values, goalKcal);
  const margin = { ...CALORIE_PLOT, left: caloriePlotLeft(ticks) };

  const coords = buildPlotCoords(points, min, max, margin);
  const lineIndices = splitTrendLineIndices(points);

  return (
    <View accessibilityLabel={accessibilityLabel}>
      <Svg width="100%" height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
        <Defs>
          <ClipPath id="calorie-clip">
            <Rect x={margin.left} y={margin.top} width={plotWidth(margin)} height={plotHeight(margin)} />
          </ClipPath>
        </Defs>
        {ticks.map((tick) => {
          const y = yAt(tick, min, max, margin);
          return (
            <G key={`tick-${tick}`}>
              <Line
                x1={margin.left}
                y1={y}
                x2={WIDTH - margin.right}
                y2={y}
                stroke={theme.colors.border}
                strokeWidth="1"
                strokeDasharray="3 3"
              />
              <SvgText x={margin.left - 4} y={y + 3} fontSize="8" fill={theme.colors.textMuted} textAnchor="end">
                {formatCalorieTick(tick)}
              </SvgText>
            </G>
          );
        })}
        <Line
          x1={margin.left}
          y1={margin.top + plotHeight(margin)}
          x2={WIDTH - margin.right}
          y2={margin.top + plotHeight(margin)}
          stroke={theme.colors.border}
        />
        <G clipPath="url(#calorie-clip)">
          {goalKcal != null ? (
            <Line
              x1={margin.left}
              y1={yAt(goalKcal, min, max, margin)}
              x2={WIDTH - margin.right}
              y2={yAt(goalKcal, min, max, margin)}
              stroke={theme.colors.danger}
              strokeWidth="2"
            />
          ) : null}
          <LineSegments indices={lineIndices} coords={coords} color={theme.colors.chartFood} />
          {coords.map((c, i) =>
            c ? (
              <Circle
                key={`dot-${i}`}
                cx={c.x}
                cy={c.y}
                r={4}
                fill={theme.colors.chartFood}
                accessibilityLabel={`${c.label}: ${c.value}`}
              />
            ) : null
          )}
        </G>
        <WeekdayXLabels points={points} locale={locale} margin={margin} />
      </Svg>
      <Text style={styles.legend}>● 每日攝取　━ 目標 kcal</Text>
    </View>
  );
}

const WEIGHT_MARKER_R = 3.5;
const WEIGHT_PLOT = { left: 44, right: 14, top: 14, bottom: 28 };

/** Daily weight line chart (e.g. 30 days). */
export function WeightDailyChart({
  points,
  emptyLabel,
  accessibilityLabel,
}: {
  points: TrendPoint[];
  emptyLabel: string;
  accessibilityLabel: string;
}) {
  const recorded = points.filter((p) => p.value != null);
  if (!recorded.length) return <EmptyChart label={emptyLabel} />;

  const values = recorded.map((p) => p.value as number);
  const { min, max, ticks } = computeYAxis(values);

  const coords = buildPlotCoords(points, min, max, WEIGHT_PLOT, WEIGHT_MARKER_R);
  const lineIndices = recordedTrendLineIndices(points);

  return (
    <View accessibilityLabel={accessibilityLabel}>
      <Svg width="100%" height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
        <Defs>
          <ClipPath id="weight-daily-clip">
            <Rect
              x={WEIGHT_PLOT.left}
              y={WEIGHT_PLOT.top}
              width={plotWidth(WEIGHT_PLOT)}
              height={plotHeight(WEIGHT_PLOT)}
            />
          </ClipPath>
        </Defs>
        {ticks.map((tick) => {
          const y = yAt(tick, min, max, WEIGHT_PLOT);
          return (
            <G key={`tick-${tick}`}>
              <Line
                x1={WEIGHT_PLOT.left}
                y1={y}
                x2={WIDTH - WEIGHT_PLOT.right}
                y2={y}
                stroke={theme.colors.border}
                strokeWidth="1"
                strokeDasharray="3 3"
              />
              <SvgText
                x={WEIGHT_PLOT.left - 6}
                y={y + 3}
                fontSize="9"
                fill={theme.colors.textMuted}
                textAnchor="end"
              >
                {formatTick(tick)}
              </SvgText>
            </G>
          );
        })}
        <Line
          x1={WEIGHT_PLOT.left}
          y1={WEIGHT_PLOT.top + plotHeight(WEIGHT_PLOT)}
          x2={WIDTH - WEIGHT_PLOT.right}
          y2={WEIGHT_PLOT.top + plotHeight(WEIGHT_PLOT)}
          stroke={theme.colors.border}
        />
        <G clipPath="url(#weight-daily-clip)">
          <LineSegments indices={lineIndices} coords={coords} color={theme.colors.chartWeight} />
          {coords.map((c, i) =>
            c ? (
              <Circle
                key={`dot-${i}`}
                cx={c.x}
                cy={c.y}
                r={WEIGHT_MARKER_R}
                fill={theme.colors.chartWeight}
                accessibilityLabel={`${c.label}: ${c.value}`}
              />
            ) : null
          )}
        </G>
        <XLabels points={points} maxLabels={6} />
      </Svg>
      <Text style={styles.legend}>● 當日最後體重（橫軸為 30 日曆日）</Text>
    </View>
  );
}

/** Weekly average weight — bar chart, up to 12 weeks. */
export function WeightWeeklyChart({
  points,
  emptyLabel,
  accessibilityLabel,
}: {
  points: TrendPoint[];
  emptyLabel: string;
  accessibilityLabel: string;
}) {
  const recorded = points.filter((p) => p.value != null);
  if (!recorded.length) return <EmptyChart label={emptyLabel} />;

  const values = recorded.map((p) => p.value as number);
  const { min, max, ticks } = computeYAxis(values);

  const count = points.length;
  const gap = 4;
  const barW = Math.max(4, (plotWidth() - gap * (count - 1)) / count);

  return (
    <View accessibilityLabel={accessibilityLabel}>
      <Svg width="100%" height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
        <Defs>
          <ClipPath id="weekly-clip">
            <Rect x={PLOT.left} y={PLOT.top} width={plotWidth()} height={plotHeight()} />
          </ClipPath>
        </Defs>
        {ticks.map((tick) => {
          const y = yAt(tick, min, max);
          return (
            <G key={`tick-${tick}`}>
              <Line
                x1={PLOT.left}
                y1={y}
                x2={WIDTH - PLOT.right}
                y2={y}
                stroke={theme.colors.border}
                strokeWidth="1"
                strokeDasharray="3 3"
              />
              <SvgText x={PLOT.left - 6} y={y + 3} fontSize="9" fill={theme.colors.textMuted} textAnchor="end">
                {formatTick(tick)}
              </SvgText>
            </G>
          );
        })}
        <Line
          x1={PLOT.left}
          y1={PLOT.top + plotHeight()}
          x2={WIDTH - PLOT.right}
          y2={PLOT.top + plotHeight()}
          stroke={theme.colors.border}
        />
        <G clipPath="url(#weekly-clip)">
          {points.map((p, i) => {
            if (p.value == null) return null;
            const x = PLOT.left + i * (barW + gap);
            const y = yAt(p.value, min, max);
            const h = PLOT.top + plotHeight() - y;
            return (
              <Rect
                key={`bar-${p.label}`}
                x={x}
                y={y}
                width={barW}
                height={h}
                rx={2}
                fill={theme.colors.chartWeight}
                accessibilityLabel={`${p.label}: ${p.value}`}
              />
            );
          })}
        </G>
        {labelIndices(count, 6).map((i) => (
          <SvgText
            key={`wx-${points[i].label}`}
            x={PLOT.left + i * (barW + gap) + barW / 2}
            y={HEIGHT - 4}
            fontSize="8"
            fill={theme.colors.textMuted}
            textAnchor="middle"
          >
            {points[i].label}
          </SvgText>
        ))}
      </Svg>
      <Text style={styles.legend}>■ 每週平均體重（7 日區間）</Text>
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
