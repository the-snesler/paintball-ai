import type { ImageScorecard, ScorecardCriterion, ScorecardScores } from "~/types";

export const SCORECARD_CRITERIA: Array<{
  key: ScorecardCriterion;
  label: string;
  shortLabel: string;
}> = [
  { key: "likeness", label: "Likeness", shortLabel: "Like" },
  { key: "promptAdherence", label: "Prompt adherence", shortLabel: "Prompt" },
  { key: "aesthetics", label: "Aesthetics", shortLabel: "Aesthetic" },
  { key: "textAccuracy", label: "Text accuracy", shortLabel: "Text" },
  { key: "speed", label: "Speed", shortLabel: "Speed" },
  { key: "cost", label: "Cost", shortLabel: "Cost" },
];

export const EMPTY_SCORECARD_SCORES: ScorecardScores = {
  likeness: null,
  promptAdherence: null,
  aesthetics: null,
  textAccuracy: null,
  speed: null,
  cost: null,
};

export function createScorecard(
  scores: Partial<ScorecardScores>,
  updatedAt = Date.now()
): ImageScorecard {
  return {
    scores: { ...EMPTY_SCORECARD_SCORES, ...scores },
    updatedAt,
  };
}

export function getScorecardAverage(scorecard?: ImageScorecard): number | null {
  if (!scorecard) return null;
  const values = SCORECARD_CRITERIA.map(({ key }) => scorecard.scores[key]).filter(
    (value): value is number => typeof value === "number"
  );
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function getScorecardRatingCount(scorecard?: ImageScorecard): number {
  if (!scorecard) return 0;
  return SCORECARD_CRITERIA.reduce(
    (count, { key }) => count + (typeof scorecard.scores[key] === "number" ? 1 : 0),
    0
  );
}
