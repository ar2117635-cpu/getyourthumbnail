import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const FORMATS: Record<
  string,
  { width: number; height: number; label: string }
> = {
  "16:9": { width: 1536, height: 864, label: "wide landscape 16:9" },
  "9:16": { width: 864, height: 1536, label: "vertical portrait 9:16" },
  "1:1": { width: 1024, height: 1024, label: "square 1:1" },
  "4:5": { width: 1024, height: 1280, label: "portrait 4:5" },
  "4:3": { width: 1280, height: 960, label: "landscape 4:3" },
};

function getImageDimensions(base64: string) {
  const bytes = Buffer.from(base64, "base64");

  // PNG dimensions
  if (
    bytes.length >= 24 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return {
      width: bytes.readUInt32BE(16),
      height: bytes.readUInt32BE(20),
    };
  }

  // JPEG dimensions
  if (bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;

    while (offset < bytes.length) {
      if (bytes[offset] !== 0xff) {
        offset++;
        continue;
      }

      const marker = bytes[offset + 1];
      const segmentLength = bytes.readUInt16BE(offset + 2);

      const isStartOfFrame = [
        0xc0, 0xc1, 0xc2, 0xc3,
        0xc5, 0xc6, 0xc7,
        0xc9, 0xca, 0xcb,
        0xcd, 0xce, 0xcf,
      ].includes(marker);

      if (isStartOfFrame) {
        return {
          height: bytes.readUInt16BE(offset + 5),
          width: bytes.readUInt16BE(offset + 7),
        };
      }

      if (segmentLength < 2) break;
      offset += 2 + segmentLength;
    }
  }

  return null;
}

export async function POST(request: Request) {
  try {
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const apiToken = process.env.CLOUDFLARE_API_TOKEN;

    if (!accountId || !apiToken) {
      return NextResponse.json(
        { success: false, error: "Cloudflare Account ID or API Token is missing." },
        { status: 500 }
      );
    }

    const body = await request.json();

    const prompt = String(body.prompt || "").trim();
    const description = String(body.description || "").trim();
    const aspectRatio = String(body.aspectRatio || "16:9");

    if (!prompt && !description) {
      return NextResponse.json(
        { success: false, error: "Thumbnail prompt is required." },
        { status: 400 }
      );
    }

    const selectedFormat = FORMATS[aspectRatio];

    if (!selectedFormat) {
      return NextResponse.json(
        { success: false, error: "Invalid image format selected." },
        { status: 400 }
      );
    }

    const finalPrompt = `
Create one professional, highly clickable YouTube-style thumbnail.
The required image format is ${selectedFormat.label}.
The canvas MUST be landscape or portrait according to the requested dimensions.
Do not create a square composition unless the selected format is 1:1.
Use the full canvas. Do not add borders, frames, or empty margins.
Video context: ${description}
Creative direction: ${prompt}
Use cinematic lighting, vivid colors, strong emotion,
a large recognizable main subject and sharp details.
No watermark. No collage.
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
        if (!response.ok || !data.success) {
      console.error("Cloudflare API error:", data);

      return NextResponse.json(
        {
          success: false,
          error: `Cloudflare AI returned ${response.status}`,
          details: data.errors || data.messages || data,
        },
        { status: 502 }
      );
    }

    const image = data.result?.image;

    if (!image || typeof image !== "string") {
      throw new Error("Cloudflare did not return a valid image.");
    }

    const dimensions = getImageDimensions(image);

    if (dimensions) {
      const actualRatio = dimensions.width / dimensions.height;
      const expectedRatio =
        selectedFormat.width / selectedFormat.height;

      if (Math.abs(actualRatio - expectedRatio) > 0.01) {
        return NextResponse.json(
          {
            success: false,
            error: "Cloudflare returned an image with the wrong aspect ratio.",
            selectedFormat: aspectRatio,
            requestedDimensions: {
              width: selectedFormat.width,
              height: selectedFormat.height,
            },
            actualDimensions: dimensions,
            message:
              "The generated image dimensions do not match the selected format.",
          },
          { status: 502 }
        );
      }
    }

    const imageUrl = `data:image/png;base64,${image}`;

    return NextResponse.json({
      success: true,
      imageUrl,
      image: imageUrl,
      mimeType: "image/png",
      aspectRatio,
      width: dimensions?.width || selectedFormat.width,
      height: dimensions?.height || selectedFormat.height,
      message: "Thumbnail generated successfully.",
    });

  } catch (error) {
    console.error("Cloudflare image generation error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown image generation error.",
      },
      { status: 500 }
    );
  }
}

    const data = await response.json();
