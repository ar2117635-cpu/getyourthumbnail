
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = "gemini-3.1-flash-image";

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

    const prompt = String(body.prompt || "").trim();
    const description = String(body.description || "").trim();

    if (!prompt && !description) {
      return NextResponse.json(
        { error: "Thumbnail prompt is required." },
        { status: 400 }
      );
    }

    const finalPrompt = `
You are a professional YouTube thumbnail designer.

Create one extremely clickable, premium-quality YouTube thumbnail.

VIDEO CONTEXT:
${description}

THUMBNAIL DESIGN:
${prompt}

IMPORTANT REQUIREMENTS:
- Landscape 16:9 aspect ratio.
- Professional cinematic composition.
- Extremely clear main subject.
- Strong facial expressions and emotions when appropriate.
- High contrast and vibrant colors.
- Dramatic but natural lighting.
- Sharp details and professional quality.
- Make the main subject large and recognizable.
- Avoid unnecessary objects and visual clutter.
- Do not create a collage or multiple thumbnails.
- Do not add watermarks or logos.
- Create one complete finished thumbnail image.
`;

    const requestBody = {
      contents: [
        {
          role: "user",
          parts: [{ text: finalPrompt }],
        },
      ],
      generationConfig: {
        responseModalities: ["TEXT", "IMAGE"],
        imageConfig: {
          aspectRatio: "16:9",
          imageSize: "1K",
        },
      },
    };

    let response: Response | null = null;
    let raw = "";

    for (let attempt = 1; attempt <= 3; attempt++) {
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          body: JSON.stringify(requestBody),
          cache: "no-store",
          signal: AbortSignal.timeout(45000),
        }
      );

      raw = await response.text();

      if (response.ok) {
        break;
      }

      if (response.status === 503 && attempt < 3) {
        await sleep(attempt * 2000);
        continue;
      }

      return NextResponse.json(
        {
          error: `Gemini Image API returned ${response.status}`,
          details: raw.slice(0, 1500),
        },
        { status: 502 }
      );
    }

    if (!response || !response.ok) {
      return NextResponse.json(
        { error: "Image generation failed." },
        { status: 502 }
      );
    }

    let data;

    try {
      data = JSON.parse(raw);
    } catch {
      throw new Error("Gemini returned invalid JSON.");
    }

    const parts =
      data.candidates?.[0]?.content?.parts || [];

    const imagePart = parts.find(
      (part: any) => part.inlineData?.data || part.inline_data?.data
    );

    if (!imagePart) {
      const message = parts
        .map((part: any) => part.text || "")
        .join(" ");

      throw new Error(
        message || "Gemini did not return an image."
      );
    }

    const imageData =
      imagePart.inlineData || imagePart.inline_data;

    const mimeType =
      imageData.mimeType ||
      imageData.mime_type ||
      "image/png";

    const imageUrl = `data:${mimeType};base64,${imageData.data}`;

    return NextResponse.json({
      success: true,
      imageUrl,
      image: imageUrl,
      mimeType,
      message: "Thumbnail generated successfully.",
    });

  } catch (error) {
    console.error("Thumbnail generation error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unknown image generation error.",
      },
      { status: 500 }
    );
  }
}
 
