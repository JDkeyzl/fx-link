"use client";

import {
  useCallback,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import Image from "next/image";
import { SinWaveBackdrop } from "@/components/SinWaveBackdrop";
import { useI18n } from "@/context/LocaleContext";
import {
  COMPANY_SECTIONS,
  companyBodyForLocale,
} from "@/data/companyInfo";

type SectionId = (typeof COMPANY_SECTIONS)[number]["id"];

/** Local assets under public/img (copied from source/img via copy-assets). */
const SECTION_MEDIA: Record<
  SectionId,
  { src: string; width: number; height: number }
> = {
  profile: { src: "/img/company.jpg", width: 1707, height: 1280 },
  development: { src: "/img/develop.png", width: 1820, height: 880 },
  culture: { src: "/img/rewards.jpg", width: 1707, height: 1280 },
  network: { src: "/img/worldmap.png", width: 1246, height: 840 },
};

export function CompanyIntro() {
  const { t, locale } = useI18n();
  const baseId = useId();
  const [tabId, setTabId] = useState<SectionId>("profile");
  const [stablePanelMinH, setStablePanelMinH] = useState(0);
  const panelMeasureRef = useRef<HTMLDivElement>(null);
  const prevLocaleRef = useRef(locale);

  const tabIds = COMPANY_SECTIONS.map((s) => s.id);

  const focusTab = useCallback(
    (id: SectionId) => {
      setTabId(id);
      requestAnimationFrame(() => {
        document.getElementById(`${baseId}-tab-${id}`)?.focus();
      });
    },
    [baseId]
  );

  const onTabKeyDown = useCallback(
    (e: React.KeyboardEvent, index: number) => {
      const last = tabIds.length - 1;

      const go = (nextIndex: number) => {
        const i = ((nextIndex % tabIds.length) + tabIds.length) % tabIds.length;
        focusTab(tabIds[i]!);
        e.preventDefault();
      };

      switch (e.key) {
        case "ArrowDown":
          go(index + 1);
          break;
        case "ArrowUp":
          go(index - 1);
          break;
        case "Home":
          go(0);
          break;
        case "End":
          go(last);
          break;
        default:
          break;
      }
    },
    [focusTab, tabIds]
  );

  const active = COMPANY_SECTIONS.find((s) => s.id === tabId)!;
  const text = companyBodyForLocale(active.body, locale);
  const media = SECTION_MEDIA[tabId];

  useLayoutEffect(() => {
    const el = panelMeasureRef.current;
    if (!el) return;
    const h = Math.ceil(el.getBoundingClientRect().height);
    if (h <= 0) return;
    const localeChanged = prevLocaleRef.current !== locale;
    prevLocaleRef.current = locale;
    setStablePanelMinH((prev) => {
      if (localeChanged) return h;
      return Math.max(prev, h);
    });
  }, [tabId, locale, text]);

  return (
    <section
      id="company"
      className="relative scroll-mt-20 overflow-hidden border-t border-[#e8e4df] py-0"
    >
      <SinWaveBackdrop variant="company" />
      <div
        className="pointer-events-none absolute inset-0 z-[1] bg-[linear-gradient(180deg,rgba(255,255,255,0.55)_0%,rgba(252,250,247,0.88)_30%,rgba(240,246,252,0.9)_100%)]"
        aria-hidden
      />
      <div className="relative z-10 mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8 md:py-12">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-stretch lg:gap-10">
          <div
            role="tablist"
            aria-label={t("company.tablistAriaLabel")}
            aria-orientation="vertical"
            className="flex shrink-0 flex-col gap-0.5 border-b border-[#002d54]/15 pb-6 lg:w-56 lg:border-b-0 lg:border-e lg:pb-0 lg:pe-8"
          >
            {COMPANY_SECTIONS.map(({ id, titleKey }, index) => {
              const selected = tabId === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  id={`${baseId}-tab-${id}`}
                  aria-selected={selected}
                  aria-controls={`${baseId}-panel`}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => setTabId(id)}
                  onKeyDown={(e) => onTabKeyDown(e, index)}
                  className={`rounded-s-md py-2.5 ps-3 pe-2 text-start text-sm font-medium transition-colors md:text-base ${
                    selected
                      ? "border-s-2 border-[#002d54] text-[#002d54]"
                      : "border-s-2 border-transparent text-zinc-600 hover:border-zinc-300 hover:text-[#002d54]"
                  } `}
                >
                  {t(titleKey)}
                </button>
              );
            })}
          </div>

          <div
            id={`${baseId}-panel`}
            role="tabpanel"
            aria-labelledby={`${baseId}-tab-${tabId}`}
            className="min-h-0 min-w-0 flex-1"
            style={
              stablePanelMinH > 0
                ? { minHeight: stablePanelMinH }
                : undefined
            }
          >
            <div ref={panelMeasureRef}>
              <div className="flex flex-col gap-6 lg:flex-row lg:items-stretch lg:gap-8">
                <p
                  className="min-w-0 flex-1 whitespace-pre-line text-start text-sm leading-relaxed text-zinc-800 md:text-base"
                  dir={locale === "ar" ? "ltr" : undefined}
                >
                  {text}
                </p>
                <div className="relative flex min-h-0 w-full min-w-0 shrink-0 items-center justify-center lg:max-w-[min(560px,48%)] lg:flex-[0_1_48%] lg:min-w-[220px]">
                  <Image
                    src={media.src}
                    alt=""
                    width={media.width}
                    height={media.height}
                    className="h-auto max-h-[min(36rem,70vh)] w-full object-contain object-center opacity-[0.88] lg:max-h-full lg:min-h-0"
                    sizes="(max-width: 1024px) 96vw, 48vw"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
