const SECTOR_KEYWORDS = {
  episodic: [
    "today",
    "yesterday",
    "session",
    "transcript",
    "summary",
    "worked on",
    "fixed",
    "debugged",
    "discussed",
    "conversation",
    "hoje",
    "ontem",
    "sessao",
    "resumo",
    "transcricao",
    "trabalhei",
    "corrigi",
    "debuguei",
    "conversa",
  ],
  semantic: [
    "architecture",
    "convention",
    "uses",
    "requires",
    "stack",
    "definition",
    "concept",
    "config",
    "setup",
    "arquitetura",
    "convencao",
    "usa",
    "requer",
    "configuracao",
    "padrao",
    "conceito",
  ],
  procedural: [
    "how to",
    "steps",
    "workflow",
    "procedure",
    "run",
    "install",
    "deploy",
    "command",
    "commands",
    "como",
    "passo a passo",
    "etapas",
    "procedimento",
    "executar",
    "instalar",
    "comando",
    "comandos",
  ],
  emotional: [
    "feel",
    "felt",
    "frustrated",
    "happy",
    "sad",
    "angry",
    "excited",
    "gostei",
    "frustrado",
    "feliz",
    "triste",
    "animado",
    "irritado",
  ],
  reflective: [
    "learned",
    "realized",
    "insight",
    "pattern",
    "noticed",
    "understood",
    "aprendi",
    "percebi",
    "insight",
    "padrao",
    "notei",
    "entendi",
  ],
};

function countMatches(text, phrases) {
  return phrases.reduce((count, phrase) => {
    return count + (text.includes(phrase) ? 1 : 0);
  }, 0);
}

export function guessMemorySector(
  content,
  { scope = "personal", fallbackSector = "semantic" } = {},
) {
  const normalized = typeof content === "string" ? content.toLowerCase() : "";

  if (!normalized.trim()) {
    return fallbackSector;
  }

  const scores = {
    episodic: countMatches(normalized, SECTOR_KEYWORDS.episodic),
    semantic: countMatches(normalized, SECTOR_KEYWORDS.semantic),
    procedural: countMatches(normalized, SECTOR_KEYWORDS.procedural),
    emotional: countMatches(normalized, SECTOR_KEYWORDS.emotional),
    reflective: countMatches(normalized, SECTOR_KEYWORDS.reflective),
  };

  if (scope === "repo") {
    scores.semantic += 1;
    scores.procedural += 1;
  }

  if (
    normalized.includes("session id:") ||
    normalized.includes("transcript:") ||
    normalized.includes("summary:")
  ) {
    scores.episodic += 4;
  }

  const ranked = Object.entries(scores).sort(([, left], [, right]) => right - left);
  const [sector, score] = ranked[0] ?? [fallbackSector, 0];

  return score > 0 ? sector : fallbackSector;
}

export default guessMemorySector;
