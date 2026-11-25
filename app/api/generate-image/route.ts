
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const FORMATS: Record<
  string,
  { width: number; height: number; label: string }
> = {
  "16:9": { width: 1536, height: 864, label: "landscape 16:9" },
  "9:16": { width: 864, height: 1536, label: "portrait 9:16" },
  "1:1": { width: 1024, height: 1024, label: "square 1:1" },
  "4:5": { width: 1024, height: 1280, label: "portrait 4:5" },
  "4:3": { width: 1280, height: 960, label: "landscape 4:3" },
};

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
    const aspectRatio = String(body.aspectRatio || "16:9");

    if (!prompt && !description) {
      return NextResponse.json(
        { error: "Thumbnail prompt is required." },
        { status: 400 }
      );
    }

    const selectedFormat = FORMATS[aspectRatio];

    if (!selectedFormat) {
      return NextResponse.json(
        { error: "Invalid image format selected." },
        { status: 400 }
      );
    }

    const finalPrompt = `
Create a professional, highly clickable thumbnail image.
Exact composition: ${selectedFormat.label}.
Image dimensions: ${selectedFormat.width}x${selectedFormat.height}.
Video context: ${description}
Creative direction: ${prompt}
Use cinematic lighting, vivid colors, strong emotion,
a large recognizable main subject and sharp details.
Fill the entire canvas with a well-composed image.
No watermark, no collage, no borders.
    `.trim().slice(0, 2048);

    const formData = new FormData();
    formData.append("prompt", finalPrompt);
    formData.append("width", String(selectedFormat.width));
    formData.append("height", String(selectedFormat.height));

    const apiUrl =
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/black-forest-labs/flux-2-klein-4b`;

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
      },
      body: formData,
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
      aspectRatio,
      width: selectedFormat.width,
      height: selectedFormat.height,
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
