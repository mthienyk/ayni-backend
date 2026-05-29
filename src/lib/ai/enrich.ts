import OpenAI from "openai";
import { env } from "../config.js";

export type EnrichmentResult = {
  title: string;
  description: string;
  priceMin: number;
  priceMax: number;
  aiMetadata: Record<string, unknown>;
};

const FALLBACK: EnrichmentResult = {
  title: "",
  description: "",
  priceMin: 0,
  priceMax: 0,
  aiMetadata: { source: "fallback", enriched_at: new Date().toISOString() },
};

export async function enrichItemFromImage(
  imageBuffer: Buffer,
  mimeType: string,
): Promise<EnrichmentResult> {
  if (!env.OPENAI_API_KEY) {
    return {
      title: "Objet à troquer",
      description: "Décris ton objet pour attirer les bons matches.",
      priceMin: 10,
      priceMax: 50,
      aiMetadata: {
        source: "stub",
        model_version: "dev-stub",
        enriched_at: new Date().toISOString(),
      },
    };
  }

  const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  const base64 = imageBuffer.toString("base64");
  const dataUrl = `data:${mimeType};base64,${base64}`;

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    env.AI_ENRICH_TIMEOUT_MS,
  );

  try {
    const response = await client.chat.completions.create(
      {
        model: env.OPENAI_VISION_MODEL,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "Tu analyses une photo d'objet pour une app de troc local. " +
              "Réponds en JSON: title (court, accrocheur), description (1-2 phrases), " +
              "priceMin, priceMax (fourchette EUR estimation seconde main, entiers), " +
              "category, tags (array). Pas de prix de vente, juste une estimation équitable.",
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Analyse cet objet pour un troc local entre voisins.",
              },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
      },
      { signal: controller.signal },
    );

    const raw = response.choices[0]?.message?.content;
    if (!raw) return FALLBACK;

    const parsed = JSON.parse(raw) as {
      title?: string;
      description?: string;
      priceMin?: number;
      priceMax?: number;
      category?: string;
      tags?: string[];
    };

    return {
      title: parsed.title ?? "",
      description: parsed.description ?? "",
      priceMin: Math.max(0, Math.round(parsed.priceMin ?? 0)),
      priceMax: Math.max(0, Math.round(parsed.priceMax ?? 0)),
      aiMetadata: {
        category: parsed.category,
        tags: parsed.tags ?? [],
        model_version: env.OPENAI_VISION_MODEL,
        enriched_at: new Date().toISOString(),
      },
    };
  } catch {
    return FALLBACK;
  } finally {
    clearTimeout(timeout);
  }
}
