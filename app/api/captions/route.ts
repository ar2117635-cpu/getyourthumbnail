
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = "gemini-3.8-flash";
const BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

async function generateWithRetry(
  url: string,
  apiKey: string,
  payload: object
) {
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    const responseText = await response.text();

    let result: any;

    try {
      result = responseText ? JSON.parse(responseText) : {};
    } catch {
      result = {};
    }

    if (response.ok) {
      return result;
    }

    const retryable = [429, 500, 502, 503, 504].includes(
      response.status
    );

    if (!retryable || attempt === maxAttempts) {
      const error: any = new Error(
        result.error?.message ||
          `Gemini request failed with status ${response.status}.`
      );

      error.status = response.status;
      throw error;
    }

    const retryAfter = Number(response.headers.get("retry-after"));

    const delay =
      Number.isFinite(retryAfter) && retryAfter > 0
        ? Math.min(retryAfter * 1000, 4000)
        : attempt * 1500;

    await sleep(delay);
  }

  throw new Error("Gemini request failed after retries.");
}

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

   
    // Check Gemini video processing status without blocking the function.
    const fileResponse = await fetch(
      `${BASE_URL}/${fileName}`,
      {
        headers: {
          "x-goog-api-key": apiKey,
        },
        cache: "no-store",
      }
    );

    if (!fileResponse.ok) {
      const errorText = await fileResponse.text();

      return NextResponse.json(
        {
          error: `Gemini file check failed: ${errorText.slice(0, 500)}`,
        },
        { status: fileResponse.status }
      );
    }

    const fileData = await fileResponse.json();

    if (fileData.state === "FAILED") {
      throw new Error("Gemini could not process this video.");
    }

    if (fileData.state !== "ACTIVE") {
      return NextResponse.json(
        {
          error: "Video is still processing. Please wait.",
          retryAfterSeconds: 3,
        },
        { status: 503 }
      );
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

    const result = await generateWithRetry(
      `${BASE_URL}/models/${MODEL}:generateContent`,
      apiKey,
      {
        contents: [
          {
            parts: [
              { text: prompt },
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
      }
    );

    const output = result.candidates?.[0]?.content?.parts
      ?.map((part: any) => part.text || "")
      .join("")
      .trim();

    if (!output) {
      throw new Error(
        result.promptFeedback?.blockReason
          ? `Gemini blocked the request: ${result.promptFeedback.blockReason}`
          : "Gemini returned an empty response."
      );
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

    const status =
      typeof error === "object" &&
      error !== null &&
      "status" in error &&
      typeof error.status === "number"
        ? error.status
        : 500;

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Something went wrong.",
      },
      { status }
    );
  }
}
