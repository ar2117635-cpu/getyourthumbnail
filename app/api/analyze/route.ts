
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = "gemini-2.5-flash";

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
    const frames = body.frames;

    if (!Array.isArray(frames) || frames.length < 2 || frames.length > 8) {
      return NextResponse.json(
        { error: "Please provide 2 to 8 video frames." },
        { status: 400 }
      );
    }

    let totalSize = 0;

    const imageParts = frames.map((frame: unknown) => {
      if (
        typeof frame !== "string" ||
        !frame.startsWith("data:image/jpeg;base64,")
      ) {
        throw new Error("Invalid video frame format.");
      }

      const data = frame.split(",")[1];
      totalSize += data.length;

      return {
        inline_data: {
          mime_type: "image/jpeg",
          data,
        },
      };
    });

    if (totalSize > 4_000_000) {
      return NextResponse.json(
        { error: "Frames are too large. Please use a shorter video." },
        { status: 413 }
      );
    }

    const prompt = `
You are the professional AI thumbnail director of GetYourThumbnail.

Analyze these video frames in chronological order.

${description ? `Video description: ${description}` : ""}

Understand the characters, actions, setting, story and exciting moments.

Create exactly 4 visually different YouTube thumbnail concepts.

Styles:
1. Extreme cinematic action
2. Emotional close-up
3. Mystery and unexpected moment
4. Premium cinematic poster

Keep concepts faithful to the actual video.
Do not invent characters or events.

Return ONLY valid JSON:
{
  "video_summary": "Short summary",
  "concepts": [
    {
      "headline": "2-5 words",
      "visual_scene": "Detailed visual scene",
      "emotion": "Main emotion",
      "color_style": "Colors and lighting",
      "image_prompt": "Detailed image generation prompt"
    }
  ]
}
`;

    const requestBody = {
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            ...imageParts,
          ],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.8,
        maxOutputTokens: 3000,
      },
    };

    let response: Response | null = null;
    let raw = "";

    // Retry up to 3 times for temporary server overload.
    for (let attempt = 1; attempt <= 3; attempt++) {
      const controller = new AbortController();

      const timeout = setTimeout(() => {
        controller.abort();
      }, 15000);

      try {
        response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": apiKey,
            },
            body: JSON.stringify(requestBody),
            signal: controller.signal,
            cache: "no-store",
          }
        );

        raw = await response.text();

      } catch (error) {
        if (attempt === 3) {
          throw new Error(
            error instanceof Error
              ? error.message
              : "Gemini connection failed."
          );
        }

        await sleep(attempt * 1200);
        continue;

      } finally {
        clearTimeout(timeout);
      }

      if (response.ok) {
        break;
      }

      if (response.status === 503 && attempt < 3) {
        await sleep(attempt * 1500);
        continue;
      }

      return NextResponse.json(
        {
          error: `Gemini API returned ${response.status}`,
          details: raw.slice(0, 1200),
        },
        { status: 502 }
      );
    }

    if (!response || !response.ok) {
      return NextResponse.json(
        { error: "Gemini could not process the request." },
        { status: 502 }
      );
    }

    let data;

    try {
      data = JSON.parse(raw);
    } catch {
      throw new Error("Gemini returned an invalid JSON response.");
    }

    const outputText = data.candidates?.[0]?.content?.parts
      ?.map((part: { text?: string }) => part.text || "")
      .join("\n");

    if (!outputText) {
      throw new Error(
        data.candidates?.[0]?.finishReason ||
          "Gemini returned no analysis."
      );
    }

    const cleaned = outputText
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();

    let result;

    try {
      result = JSON.parse(cleaned);
    } catch {
      throw new Error("Gemini returned invalid thumbnail concepts.");
    }

    if (
      !Array.isArray(result.concepts) ||
      result.concepts.length !== 4
    ) {
      throw new Error("AI did not return exactly 4 concepts.");
    }

    const concepts = result.concepts.map(
      (concept: Record<string, unknown>, index: number) => ({
        title: String(concept.headline || `Concept ${index + 1}`),
        description: String(concept.visual_scene || ""),
        prompt: String(concept.image_prompt || ""),
        emotion: String(concept.emotion || ""),
        color_style: String(concept.color_style || ""),
      })
    );

    return NextResponse.json({
      success: true,
      video_summary: String(result.video_summary || ""),
      concepts,
    });

  } catch (error) {
    console.error("GetYourThumbnail AI error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unknown server error",
      },
      { status: 500 }
    );
  }
        }
