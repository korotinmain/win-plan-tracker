import { Injectable } from '@angular/core';
import type { EChartsOption } from 'echarts';

interface WeekDay {
  label: string;
  dayNum: string;
  isToday: boolean;
  weekend: boolean;
  total: number;
  working: number;
  onVacation: number;
  availPct: number;
}

interface VelocityPoint {
  week: string;
  pct: number;
  personDays: number;
}

interface CapacityData {
  days: { label: string; working: number; vacation: number }[];
  total: number;
}

/** Tooltip colour tokens derived from the current theme flag. */
interface TooltipTokens {
  bg: string;
  border: string;
  text: string;
}

function tooltipTokens(dark: boolean): TooltipTokens {
  return {
    bg: dark ? '#1e293b' : '#ffffff',
    border: dark ? 'rgba(255,255,255,0.1)' : '#e2e8f0',
    text: dark ? '#f1f5f9' : '#0f172a',
  };
}

@Injectable({ providedIn: 'root' })
export class DashboardChartsService {
  sprintGaugeOpts(pct: number, dark: boolean): EChartsOption {
    return {
      backgroundColor: 'transparent',
      series: [
        {
          type: 'gauge',
          startAngle: 205,
          endAngle: -25,
          min: 0,
          max: 100,
          pointer: { show: false },
          progress: {
            show: true,
            overlap: false,
            roundCap: true,
            width: 14,
            itemStyle: {
              color: {
                type: 'linear',
                x: 0,
                y: 0,
                x2: 1,
                y2: 0,
                colorStops: [
                  { offset: 0, color: '#4f46e5' },
                  { offset: 1, color: '#818cf8' },
                ],
              } as any,
            },
          },
          axisLine: {
            roundCap: true,
            lineStyle: {
              width: 14,
              color: [
                [1, dark ? 'rgba(99,102,241,0.18)' : 'rgba(99,102,241,0.1)'],
              ],
            },
          },
          axisTick: { show: false },
          splitLine: { show: false },
          axisLabel: { show: false },
          anchor: { show: false } as any,
          detail: {
            valueAnimation: true,
            formatter: (val: number) => Math.round(val) + '%',
            color: dark ? '#818cf8' : '#4f46e5',
            fontSize: 30,
            fontWeight: 'bold',
            fontFamily: 'Inter, sans-serif',
            offsetCenter: [0, '-5%'],
          },
          title: { show: false },
          data: [{ value: pct }],
        },
      ] as any,
    };
  }

  weekBarOpts(days: WeekDay[], dark: boolean): EChartsOption {
    const tt = tooltipTokens(dark);
    const textColor = dark ? '#94a3b8' : '#64748b';
    const total = days[0]?.total || 1;

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'shadow',
          shadowStyle: {
            color: dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
          },
        },
        backgroundColor: tt.bg,
        borderColor: tt.border,
        textStyle: {
          color: tt.text,
          fontFamily: 'Inter, sans-serif',
          fontSize: 12,
        },
        formatter: (params: any) => {
          const d = days[params[0].dataIndex];
          if (d.weekend) return `<b>${d.label} ${d.dayNum}</b><br/>Weekend`;
          let html = `<b>${d.label}, ${d.dayNum}</b><br/>`;
          if (d.working > 0)
            html += `<span style="color:#10b981">●</span> Available: ${d.working}<br/>`;
          if (d.onVacation > 0)
            html += `<span style="color:#7c3aed">●</span> Vacation: ${d.onVacation}<br/>`;
          return html;
        },
      },
      grid: { left: 4, right: 4, top: 4, bottom: 20, containLabel: false },
      xAxis: {
        type: 'category',
        data: days.map((d) => `${d.label}\n${d.dayNum}`),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: textColor,
          fontSize: 11,
          fontFamily: 'Inter, sans-serif',
          fontWeight: 'bold',
          interval: 0,
        },
      },
      yAxis: { type: 'value', max: total, show: false },
      series: [
        {
          name: 'Available',
          type: 'bar',
          stack: 'total',
          barMaxWidth: 40,
          barCategoryGap: '30%',
          itemStyle: { color: '#6366f1', borderRadius: [0, 0, 4, 4] },
          data: days.map((d) => ({
            value: d.working,
            itemStyle: d.weekend
              ? {
                  color: dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                  borderRadius: [4, 4, 4, 4],
                }
              : d.isToday
                ? {
                    color: '#6366f1',
                    borderColor: '#818cf8',
                    borderWidth: 1,
                    borderRadius: [0, 0, 4, 4],
                  }
                : {},
          })),
        },
        {
          name: 'Vacation',
          type: 'bar',
          stack: 'total',
          barMaxWidth: 40,
          itemStyle: { color: '#7c3aed', borderRadius: [4, 4, 0, 0] },
          data: days.map((d) => ({
            value: d.onVacation,
            itemStyle: d.weekend ? { color: 'transparent' } : {},
          })),
        },
      ] as any,
    };
  }

  velocityChartOpts(data: VelocityPoint[], dark: boolean): EChartsOption {
    const tt = tooltipTokens(dark);
    const textColor = dark ? '#94a3b8' : '#64748b';
    const gridColor = dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';

    return {
      backgroundColor: 'transparent',
      grid: { left: 40, right: 16, top: 12, bottom: 24 },
      tooltip: {
        trigger: 'axis',
        backgroundColor: tt.bg,
        borderColor: tt.border,
        textStyle: {
          color: tt.text,
          fontFamily: 'Inter, sans-serif',
          fontSize: 12,
        },
        formatter: (params: any) => {
          const p = params[0];
          return `<b>${p.name}</b><br/>Availability: <b>${p.value}%</b><br/>Person-days: <b>${data[p.dataIndex]?.personDays}</b>`;
        },
      },
      xAxis: {
        type: 'category',
        data: data.map((d) => d.week),
        axisLine: { lineStyle: { color: gridColor } },
        axisTick: { show: false },
        axisLabel: {
          color: textColor,
          fontSize: 11,
          fontFamily: 'Inter, sans-serif',
          fontWeight: 'bold',
        },
      },
      yAxis: {
        type: 'value',
        min: 0,
        max: 100,
        interval: 25,
        splitLine: { lineStyle: { color: gridColor } },
        axisLabel: {
          color: textColor,
          fontSize: 10,
          fontFamily: 'Inter, sans-serif',
          formatter: '{value}%',
        },
      },
      series: [
        {
          name: 'Availability',
          type: 'line',
          smooth: true,
          symbolSize: 8,
          symbol: 'circle',
          data: data.map((d) => d.pct),
          itemStyle: {
            color: '#10b981',
            borderWidth: 2,
            borderColor: dark ? '#111827' : '#ffffff',
          },
          lineStyle: { color: '#10b981', width: 3 },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                {
                  offset: 0,
                  color: dark
                    ? 'rgba(16,185,129,0.40)'
                    : 'rgba(16,185,129,0.22)',
                },
                { offset: 1, color: 'rgba(16,185,129,0.02)' },
              ],
            } as any,
          },
          markLine: {
            silent: true,
            symbol: 'none',
            data: [{ type: 'average', name: 'Avg' }],
            lineStyle: {
              color: '#10b981',
              type: 'dashed',
              width: 1,
              opacity: 0.5,
            },
            label: {
              formatter: 'avg {c}%',
              color: '#10b981',
              fontSize: 10,
              fontFamily: 'Inter, sans-serif',
            },
          },
        },
      ] as any,
    };
  }

  capacityChartOpts(cap: CapacityData, dark: boolean): EChartsOption {
    const tt = tooltipTokens(dark);
    const textColor = dark ? '#94a3b8' : '#64748b';

    return {
      backgroundColor: 'transparent',
      grid: { left: 4, right: 4, top: 4, bottom: 22, containLabel: false },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: tt.bg,
        borderColor: tt.border,
        textStyle: {
          color: tt.text,
          fontFamily: 'Inter, sans-serif',
          fontSize: 12,
        },
        formatter: (params: any) => {
          const d = cap.days[params[0].dataIndex];
          let html = `<b>${d.label}</b><br/>`;
          if (d.working > 0)
            html += `<span style="color:#10b981">●</span> Working: ${d.working}<br/>`;
          if (d.vacation > 0)
            html += `<span style="color:#7c3aed">●</span> Vacation: ${d.vacation}<br/>`;
          return html;
        },
      },
      xAxis: {
        type: 'category',
        data: cap.days.map((d) => d.label),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: textColor,
          fontSize: 10,
          fontFamily: 'Inter, sans-serif',
          fontWeight: 'bold',
          interval: 0,
        },
      },
      yAxis: { type: 'value', max: cap.total, show: false },
      series: [
        {
          name: 'Working',
          type: 'bar',
          stack: 'cap',
          barMaxWidth: 44,
          barCategoryGap: '28%',
          itemStyle: { color: '#10b981', borderRadius: [0, 0, 4, 4] },
          data: cap.days.map((d) => d.working),
        },
        {
          name: 'Vacation',
          type: 'bar',
          stack: 'cap',
          barMaxWidth: 44,
          itemStyle: { color: '#7c3aed', borderRadius: [4, 4, 0, 0] },
          data: cap.days.map((d) => d.vacation),
        },
      ] as any,
    };
  }
}
