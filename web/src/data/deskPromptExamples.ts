export const PERSONA_IDS = [
  "dealer",
  "mine",
  "fleet",
  "workshop",
  "contractor",
] as const;

export type DeskPersonaId = (typeof PERSONA_IDS)[number];

export function pickRandomPersona(exclude?: DeskPersonaId | null): DeskPersonaId {
  const pool =
    exclude && PERSONA_IDS.length > 1
      ? PERSONA_IDS.filter((id) => id !== exclude)
      : [...PERSONA_IDS];
  return pool[Math.floor(Math.random() * pool.length)]!;
}

/** i18n keys under desk.examples.personas.{id}.* */
export function getPersonaPromptKeys(id: DeskPersonaId): {
  labelKey: string;
  promptKeys: [string, string, string];
} {
  const base = `desk.examples.personas.${id}`;
  return {
    labelKey: `${base}.label`,
    promptKeys: [`${base}.p1`, `${base}.p2`, `${base}.p3`],
  };
}
