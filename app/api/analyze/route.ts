
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY is missing in Vercel." },
        { status: 500 }
      );
    }

    const body = await request.json();
    const description = String(body.description || "").trim();

    if (!description || description.length > 5000) {
      return NextResponse.json(
        { error: "Enter a description up to 5000 characters." },
        { status: 400 }
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 40000);

    let response: Response;

    try {
      response = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/interactions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey
          },
          body: JSON.stringify({
            model: "gemini-3.8-flash",
            input: `Create exactly 4 different high-CTR YouTube thumbnail concepts for this video:

${description}

Return ONLY valid JSON in this exact structure:
{
  "concepts": [
    {
      "headline": "2-5 words",
      "visual_scene": "Detailed scene",
      "emotion": "Main emotion",
      "color_style": "Colors and lighting",
      "image_prompt": "Detailed cinematic image prompt"
    }
  ]
}

All 4 concepts must be visually different.`
          }),
          signal: controller.signal,
          cache: "no-store"
        }
      );
    } finally {
      clearTimeout(timeout);
    }

    const raw = await response.text();

    if (!response.ok) {
      return NextResponse.json(
        {
          error: `Gemini API returned ${response.status}`,
          details: raw.slice(0, 1500)
        },
        { status: 502 }
      );
    }

    const data = JSON.parse(raw);

    const outputText =
      data.output_text ||
      (data.steps || [])
        .filter((step: any) => step.type === "model_output")
        .flatMap((step: any) => step.content || [])
        .filter((item: any) => item.type === "text")
        .map((item: any) => item.text)
        .join("\n");

    if (!outputText) {
      throw new Error("Gemini returned no text.");
    }

    const cleaned = outputText
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/, "")
      .replace(/\s*```$/, "")
      .trim();

    const result = JSON.parse(cleaned);

    if (
      !Array.isArray(result.concepts) ||
      result.concepts.length !== 4
    ) {
      throw new Error("AI did not return exactly 4 concepts.");
    }

    return NextResponse.json({
      success: true,
      concepts: result.concepts
    });

  } catch (error) {
    console.error("GetYourThumbnail error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unknown server error"
      },
      { status: 500 }
    );
  }
}
