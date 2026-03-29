import type { MealExtractionItem } from "../../types/pipeline";
import type { NutritionKbEntry, NutritionMatchResult } from "./types";

export interface NutritionEmbeddingProvider {
  embedTexts(texts: string[]): Promise<number[][]>;
}

const ACCEPTABLE_EMBEDDING_MATCH_THRESHOLD = 0.75;
const STRONG_EMBEDDING_MATCH_THRESHOLD = 0.88;
const EMBEDDING_REQUEST_TIMEOUT_MS = 8_000;

const embeddingCache = new Map<string, number[]>();

function normalizeName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ");
}

function cosineSimilarity(left: number[], right: number[]): number {
  if (left.length === 0 || left.length !== right.length) {
    return 0;
  }

  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;

  for (let index = 0; index < left.length; index += 1) {
    dot += left[index]! * right[index]!;
    leftNorm += left[index]! * left[index]!;
    rightNorm += right[index]! * right[index]!;
  }

  if (leftNorm === 0 || rightNorm === 0) {
    return 0;
  }

  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
}

function buildAliasIndex(
  kbEntries: NutritionKbEntry[],
): Map<string, { entry: NutritionKbEntry; method: "exact" | "alias" }> {
  const index = new Map<
    string,
    { entry: NutritionKbEntry; method: "exact" | "alias" }
  >();

  for (const entry of kbEntries) {
    index.set(normalizeName(entry.canonical_name), {
      entry,
      method: "exact",
    });

    for (const alias of entry.aliases) {
      const normalizedAlias = normalizeName(alias);
      if (!index.has(normalizedAlias)) {
        index.set(normalizedAlias, {
          entry,
          method: normalizedAlias === normalizeName(entry.canonical_name)
            ? "exact"
            : "alias",
        });
      }
    }
  }

  return index;
}

async function embedTextsWithTimeout(
  provider: NutritionEmbeddingProvider,
  texts: string[],
): Promise<number[][]> {
  let timeoutId: NodeJS.Timeout | undefined;

  try {
    return await Promise.race([
      provider.embedTexts(texts),
      new Promise<number[][]>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error("EMBEDDING_REQUEST_TIMEOUT"));
        }, EMBEDDING_REQUEST_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

async function getEmbedding(
  provider: NutritionEmbeddingProvider,
  text: string,
): Promise<number[]> {
  const cached = embeddingCache.get(text);
  if (cached) {
    return cached;
  }

  const [embedding] = await embedTextsWithTimeout(provider, [text]);
  embeddingCache.set(text, embedding ?? []);
  return embedding ?? [];
}

export async function findNutritionMatch(
  item: MealExtractionItem,
  kbEntries: NutritionKbEntry[],
  embeddingProvider?: NutritionEmbeddingProvider,
): Promise<NutritionMatchResult> {
  const normalizedName = normalizeName(item.name);
  const aliasIndex = buildAliasIndex(kbEntries);
  const exactOrAliasMatch = aliasIndex.get(normalizedName);

  if (exactOrAliasMatch) {
    return {
      extractedItem: item,
      entry: exactOrAliasMatch.entry,
      matchMethod: exactOrAliasMatch.method,
      matchConfidence: exactOrAliasMatch.method === "exact" ? 1 : 0.92,
    };
  }

  if (!embeddingProvider) {
    return {
      extractedItem: item,
      entry: null,
      matchMethod: null,
      matchConfidence: null,
    };
  }

  try {
    const queryEmbedding = await getEmbedding(embeddingProvider, normalizedName);
    let bestEntry: NutritionKbEntry | null = null;
    let bestSimilarity = 0;

    for (const entry of kbEntries) {
      const labels = [entry.canonical_name, ...entry.aliases];
      for (const label of labels) {
        const labelEmbedding = await getEmbedding(
          embeddingProvider,
          normalizeName(label),
        );
        const similarity = cosineSimilarity(queryEmbedding, labelEmbedding);
        if (similarity > bestSimilarity) {
          bestSimilarity = similarity;
          bestEntry = entry;
        }
      }
    }

    if (bestEntry && bestSimilarity >= ACCEPTABLE_EMBEDDING_MATCH_THRESHOLD) {
      return {
        extractedItem: item,
        entry: bestEntry,
        matchMethod: "embedding",
        matchConfidence: Number(bestSimilarity.toFixed(3)),
      };
    }
  } catch {
    // Embedding fallback should not take down the request path.
  }

  return {
    extractedItem: item,
    entry: null,
    matchMethod: null,
    matchConfidence: null,
  };
}

export async function findNutritionMatches(
  items: MealExtractionItem[],
  kbEntries: NutritionKbEntry[],
  embeddingProvider?: NutritionEmbeddingProvider,
): Promise<NutritionMatchResult[]> {
  return Promise.all(
    items.map((item) => findNutritionMatch(item, kbEntries, embeddingProvider)),
  );
}

export function isWeakNutritionMatch(match: NutritionMatchResult): boolean {
  if (!match.entry || !match.matchMethod || match.matchConfidence === null) {
    return true;
  }

  return (
    match.matchMethod === "embedding" &&
    match.matchConfidence < STRONG_EMBEDDING_MATCH_THRESHOLD
  );
}

export function resetNutritionEmbeddingCache(): void {
  embeddingCache.clear();
}
