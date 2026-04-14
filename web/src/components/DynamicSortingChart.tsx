"use client";

import { useEffect, useMemo, useRef } from "react";
import * as echarts from "echarts";
import partsData from "./partsData.js";

type PartDatum = {
  id: string;
  name: string;
  initialValue: number;
  color?: string | { type: string; [key: string]: unknown };
};

type DynamicSortingChartProps = {
  title: string;
  maxThreshold?: number;
  speed?: number;
  className?: string;
};

type RuntimeDatum = PartDatum & { value: number };

function toRuntimeData(input: PartDatum[]): RuntimeDatum[] {
  return input.map((item) => ({
    ...item,
    value: item.initialValue,
  }));
}

function sortDesc(data: RuntimeDatum[]): RuntimeDatum[] {
  return [...data].sort((a, b) => b.value - a.value);
}

export function DynamicSortingChart({
  title,
  maxThreshold = 200,
  speed = 1000,
  className,
}: DynamicSortingChartProps) {
  const chartRef = useRef<HTMLDivElement | null>(null);
  const chartInstanceRef = useRef<echarts.ECharts | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const baseData = useMemo(() => toRuntimeData(partsData as PartDatum[]), []);

  useEffect(() => {
    const dom = chartRef.current;
    if (!dom) return;

    const myChart = echarts.init(dom);
    chartInstanceRef.current = myChart;

    let runtime = sortDesc(baseData);

    const render = () => {
      const sorted = sortDesc(runtime);
      myChart.setOption({
        title: {
          text: title,
          left: "center",
          textStyle: {
            fontSize: 16,
            fontWeight: 600,
          },
        },
        grid: {
          top: 56,
          left: 24,
          right: 24,
          bottom: 20,
          containLabel: true,
        },
        xAxis: {
          type: "value",
          max: "dataMax",
          splitLine: { show: true },
        },
        yAxis: {
          type: "category",
          inverse: true,
          data: sorted.map((item) => item.id),
          axisLabel: {
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
          },
          animationDuration: 300,
          animationDurationUpdate: 300,
        },
        series: [
          {
            type: "bar",
            realtimeSort: true,
            data: sorted.map((item) => ({
              value: item.value,
              name: item.id,
              itemStyle: item.color ? { color: item.color } : undefined,
            })),
            label: {
              show: true,
              position: "right",
              valueAnimation: true,
              formatter: "{b}: {c}",
            },
            encode: {
              x: "value",
              y: "name",
            },
          },
        ],
        animationDuration: 0,
        animationDurationUpdate: 500,
        animationEasing: "linear",
        animationEasingUpdate: "linear",
      });
    };

    render();

    timerRef.current = setInterval(() => {
      runtime = runtime.map((item) => ({
        ...item,
        value: item.value + Math.floor(Math.random() * 20),
      }));

      render();

      if (Math.max(...runtime.map((item) => item.value)) >= maxThreshold) {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      }
    }, speed);

    const handleResize = () => myChart.resize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      myChart.dispose();
      chartInstanceRef.current = null;
    };
  }, [baseData, maxThreshold, speed, title]);

  return (
    <div
      className={className ?? "h-[420px] w-full rounded-xl border border-zinc-200 bg-white"}
      ref={chartRef}
    />
  );
}

export default DynamicSortingChart;
