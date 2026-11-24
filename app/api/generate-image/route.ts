
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const apiToken = process.env.CLOUDFLARE_API_TOKEN;

    if (!accountId || !apiToken) {
      return NextResponse.json(
        { error: "Cloudflare Account ID or API Token is missing." },
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
Create a professional, highly clickable YouTube thumbnail.
Landscape widescreen 16:9 composition.
Video context: ${description}
Creative direction: ${prompt}
Use cinematic lighting, vivid colors, strong emotion,
a large recognizable main subject and sharp details.
Make the composition suitable for a YouTube thumbnail.
No watermark, no collage.
    `.trim().slice(0, 2048);

    const apiUrl =
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/black-forest-labs/flux-1-schnell`;

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: finalPrompt,
        steps: 4,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(50000),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      console.error("Cloudflare API error:", data);

      return NextResponse.json(
        {
          error: `Cloudflare AI returned ${response.status}`,
          details: data.errors || data.messages || data,
        },
        { status: 502 }
      );
    }

    const image = data.result?.image;

    if (!image || typeof image !== "string") {
      throw new Error("Cloudflare did not return an image.");
    }

    const imageUrl = `data:image/jpeg;base64,${image}`;

    return NextResponse.json({
      success: true,
      imageUrl,
      image: imageUrl,
      mimeType: "image/jpeg",
      message: "Thumbnail generated successfully.",
    });

  } catch (error) {
    console.error("Cloudflare image generation error:", error);

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
