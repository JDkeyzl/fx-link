import type { Metadata } from "next";
import { DynamicSortingChart } from "@/components/DynamicSortingChart";

export const metadata: Metadata = {
  title: "Dynamic Sorting Chart",
  description: "Live OEM part sales sorting chart",
};

export default function DynamicSortingChartPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[#002d54] md:text-3xl">
          Dynamic Sorting Chart
        </h1>
        <p className="mt-2 text-sm text-zinc-600 md:text-base">
          Real-time ranking demo for Sinotruk and Shacman OEM part sales.
        </p>
      </div>
      <DynamicSortingChart
        title="Top OEM Parts Sales"
        maxThreshold={2000}
        speed={800}
        className="h-[520px] w-full rounded-2xl border border-zinc-200 bg-white p-2"
      />
    </main>
  );
}
