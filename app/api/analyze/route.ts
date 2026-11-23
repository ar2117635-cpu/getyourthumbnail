
import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

export const runtime = "nodejs";
export const maxDuration = 60;

const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : String(error);
}

function isTemporaryError(error: unknown) {
  const message = getErrorMessage(error);

  return /503|UNAVAILABLE|high demand|overload|429|RESOURCE_EXHAUSTED/i.test(
    message
  );
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "Gemini API key is not configured." },
        { status: 500 }
      );
    }

    const body = await request.json();
    const description = String(body.description || "").trim();

    if (!description || description.length > 5000) {
      return NextResponse.json(
        { error: "Please enter a description (maximum 5000 characters)." },
        { status: 400 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });

    const models = [
      "gemini-3.8-flash",
      "gemini-3.6-flash"
    ];

    let lastError: unknown = null;

    for (const model of models) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const interaction = await ai.interactions.create({
            model,
            input: `Create exactly 4 professional, high-CTR YouTube thumbnail concepts for this video:

${description}

For each concept provide:
- headline: 2 to 5 words
- visual_scene: detailed visual description
- emotion: main emotion
- color_style: colors and lighting
- image_prompt: detailed cinematic AI image prompt

Make all 4 concepts visually different.
Return only the requested structured JSON.`,
            response_format: {
              type: "text",
              mime_type: "application/json",
              schema: {
                type: "object",
                properties: {
                  concepts: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        headline: { type: "string" },
                        visual_scene: { type: "string" },
                        emotion: { type: "string" },
                        color_style: { type: "string" },
                        image_prompt: { type: "string" }
                      },
                      required: [
                        "headline",
                        "visual_scene",
                        "emotion",
                        "color_style",
                        "image_prompt"
                      ]
                    }
                  }
                },
                required: ["concepts"]
              }
            }
          });

          const output = interaction.output_text;

          if (!output) {
            throw new Error("AI returned an empty response.");
          }

          const result = JSON.parse(output);

          if (
            !Array.isArray(result.concepts) ||
            result.concepts.length !== 4
          ) {
            throw new Error("AI did not return exactly 4 concepts.");
          }

          return NextResponse.json({
            ...result,
            modelUsed: model
          });

        } catch (error) {
          lastError = error;

          if (isTemporaryError(error) && attempt === 0) {
            await sleep(1500);
            continue;
          }

          break;
        }
      }
    }

    console.error("All Gemini models failed:", lastError);

    return NextResponse.json(
      {
        error: "Both AI attempts failed. Google AI may be temporarily busy.",
        details: getErrorMessage(lastError)
      },
      { status: 503 }
    );

  } catch (error) {
    console.error("Thumbnail API error:", error);

    return NextResponse.json(
      {
        error: getErrorMessage(error)
      },
      { status: 500 }
    );
  }
}
