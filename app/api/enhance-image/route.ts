
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const apiToken = process.env.CLOUDFLARE_API_TOKEN;

    if (!accountId || !apiToken) {
  const missing = [];

  if (!accountId) missing.push("CLOUDFLARE_ACCOUNT_ID");
  if (!apiToken) missing.push("CLOUDFLARE_API_TOKEN");

  return NextResponse.json(
    {
      error: "Missing environment variables",
      missing,
    },
    { status: 500 }
  );
    }

    const body = await request.json();

    const imageData = String(body.image || "");
    const strength = Math.min(
      0.5,
      Math.max(0.1, Number(body.strength) || 0.25)
    );

    if (!imageData.startsWith("data:image/")) {
      return NextResponse.json(
        { error: "Please upload a valid image." },
        { status: 400 }
      );
    }

    const parts = imageData.split(",");

    if (parts.length !== 2) {
      return NextResponse.json(
        { error: "Invalid image format." },
        { status: 400 }
      );
    }

    const imageBase64 = parts[1];

    if (imageBase64.length > 7_000_000) {
      return NextResponse.json(
        { error: "Image is too large. Please use an image under 5 MB." },
        { status: 413 }
      );
    }

    const apiUrl =
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/runwayml/stable-diffusion-v1-5-img2img`;

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt:
          "Enhance this exact image. Improve image clarity, sharpness, lighting, fine details and color quality. Reduce blur and noise. Preserve the original subject, composition, objects, text, facial identity and overall design. Do not add new objects or change the scene.",
        negative_prompt:
          "different composition, changed subject, distorted face, extra objects, blurry, artifacts, watermark, unwanted text",
        image_b64: imageBase64,
        strength,
        num_steps: 20,
        guidance: 7.5,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(50000),
    });

    const contentType = response.headers.get("content-type") || "";

    if (!response.ok) {
      const errorText = await response.text();

      console.error("Cloudflare enhancer error:", response.status, errorText);

      return NextResponse.json(
        {
          error: `Cloudflare AI returned ${response.status}`,
          details: errorText.slice(0, 1000),
        },
        { status: 502 }
      );
    }

    let imageUrl = "";

    if (contentType.includes("application/json")) {
      const data = await response.json();
      const resultImage = data.result?.image;

      if (typeof resultImage !== "string" || !resultImage) {
        throw new Error("AI did not return an enhanced image.");
      }

      imageUrl = resultImage.startsWith("data:")
        ? resultImage
        : `data:image/png;base64,${resultImage}`;
    } else {
      const imageBuffer = Buffer.from(await response.arrayBuffer());

      if (!imageBuffer.length) {
        throw new Error("AI returned an empty image.");
      }

      imageUrl = `data:image/png;base64,${imageBuffer.toString("base64")}`;
    }

    return NextResponse.json({
      success: true,
      imageUrl,
      message: "Image enhanced successfully.",
    });

  } catch (error) {
    console.error("Image enhancer error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Image enhancement failed.",
      },
      { status: 500 }
    );
  }
}
