
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = "gemini-3.8-flash";

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY is missing." },
        { status: 500 }
      );
    }

    const body = await request.json();

    const fileName =
      typeof body.fileName === "string" ? body.fileName : "";

    const language =
      typeof body.language === "string" ? body.language : "Hindi";

    if (!/^files\/[a-z0-9-]+$/i.test(fileName)) {
      return NextResponse.json(
        { error: "Invalid Gemini file name." },
        { status: 400 }
      );
    }

    const baseUrl = "https://generativelanguage.googleapis.com/v1beta";

    // Check video processing status.
    let fileData: any = null;

    for (let attempt = 0; attempt < 10; attempt++) {
      const fileResponse = await fetch(
        `${baseUrl}/${fileName}`,
        {
          headers: {
            "x-goog-api-key": apiKey,
          },
          cache: "no-store",
        }
      );

      if (!fileResponse.ok) {
        const errorText = await fileResponse.text();
        throw new Error(errorText.slice(0, 1000));
      }

      fileData = await fileResponse.json();

      if (fileData.state === "ACTIVE") {
        break;
      }

      if (fileData.state === "FAILED") {
        throw new Error("Gemini could not process this video.");
      }

      if (attempt === 9) {
        throw new Error(
          "Video is still processing. Please try again shortly."
        );
      }

      await new Promise((resolve) => setTimeout(resolve, 5000));
    }

    if (!fileData?.uri || !fileData?.mimeType) {
      throw new Error("Gemini video file information is missing.");
    }

    const prompt = `
You are an expert video transcription and subtitle generator.

Watch and listen to the complete uploaded video.

Generate accurate subtitles in ${language}.
Preserve the spoken words as closely as possible.
Do not invent dialogue.
If there is no speech, return an empty captions array.

Return ONLY valid JSON in this exact format:

{
  "captions": [
    {
      "start": 0,
      "end": 3.5,
      "text": "Spoken words here"
    }
  ]
}

Rules:
- start and end must be seconds as numbers.
- Each caption should be short and readable.
- Keep timestamps in chronological order.
- Do not include Markdown or explanations.
`;

    const generateResponse = await fetch(
      `${baseUrl}/models/${MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
                {
                  file_data: {
                    mime_type: fileData.mimeType,
                    file_uri: fileData.uri,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.2,
          },
        }),
      }
    );

    const result = await generateResponse.json();

    if (!generateResponse.ok) {
      throw new Error(
        result.error?.message || "Gemini caption generation failed."
      );
    }

    const output = result.candidates?.[0]?.content?.parts
      ?.map((part: any) => part.text || "")
      .join("")
      .trim();

    if (!output) {
      throw new Error("Gemini returned an empty response.");
    }

    const parsed = JSON.parse(output);

    if (!Array.isArray(parsed.captions)) {
      throw new Error("Invalid captions format returned by Gemini.");
    }

    const captions = parsed.captions
      .filter(
        (item: any) =>
          typeof item.start === "number" &&
          typeof item.end === "number" &&
          typeof item.text === "string" &&
          item.end > item.start
      )
      .map((item: any) => ({
        start: item.start,
        end: item.end,
        text: item.text,
      }));

    return NextResponse.json({
      success: true,
      captions,
    });
  } catch (error) {
    console.error("Caption generation error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Something went wrong.",
      },
      { status: 500 }
    );
  }
}
