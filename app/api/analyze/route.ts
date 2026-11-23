
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
    const frames = body.frames;

    if (!Array.isArray(frames) || frames.length < 2 || frames.length > 8) {
      return NextResponse.json(
        { error: "Please provide 2 to 8 video frames." },
        { status: 400 }
      );
    }

    let totalSize = 0;

    const imageParts = frames.map((frame: any) => {
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
          data
        }
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

Analyze these frames sampled from one video in chronological order.

${description ? `Additional video description: ${description}` : ""}

Understand the characters, actions, setting, story and most exciting moments.

Create exactly 4 visually different, high-click-through-rate YouTube thumbnail concepts.

Concept styles:
1. Extreme cinematic action
2. Emotional close-up
3. Mystery and unexpected moment
4. Premium cinematic poster

Keep the concepts faithful to the actual video.
Do not invent characters or events that are not supported by the frames.

Return ONLY valid JSON:
{
  "video_summary": "Short summary of the video",
  "concepts": [
    {
      "headline": "2-5 words",
      "visual_scene": "Detailed scene",
      "emotion": "Main emotion",
      "color_style": "Colors and lighting",
      "image_prompt": "Detailed cinematic image generation prompt"
    }
  ]
}
`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 50000);

    let response: Response;

    try {
      response = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey
          },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [
                  { text: prompt },
                  ...imageParts
                ]
              }
            ],
            generationConfig: {
              responseMimeType: "application/json",
              temperature: 0.8
            }
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
          details: raw.slice(0, 1200)
        },
        { status: 502 }
      );
    }

    const data = JSON.parse(raw);

    const outputText = data.candidates?.[0]?.content?.parts
      ?.map((part: any) => part.text || "")
      .join("\n");

    if (!outputText) {
      throw new Error("Gemini returned no analysis.");
    }

    const cleaned = outputText
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
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
      video_summary: result.video_summary || "",
      concepts: result.concepts
    });

  } catch (error) {
    console.error("GetYourThumbnail AI error:", error);

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
