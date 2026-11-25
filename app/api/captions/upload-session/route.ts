
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_FILE_SIZE = 300 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY is missing in environment variables." },
        { status: 500 }
      );
    }

    const body = await request.json();

    const fileName =
      typeof body.fileName === "string" ? body.fileName : "video";

    const mimeType =
      typeof body.mimeType === "string" ? body.mimeType : "";

    const fileSize = Number(body.fileSize);

    if (!mimeType.startsWith("video/")) {
      return NextResponse.json(
        { error: "Please select a valid video file." },
        { status: 400 }
      );
    }

    if (
      !Number.isFinite(fileSize) ||
      fileSize <= 0 ||
      fileSize > MAX_FILE_SIZE
    ) {
      return NextResponse.json(
        { error: "Video size must be between 1 byte and 300 MB." },
        { status: 413 }
      );
    }

    const safeName = fileName
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .slice(0, 100);

    const headers: Record<string, string> = {
      "x-goog-api-key": apiKey,
      "X-Goog-Upload-Protocol": "resumable",
      "X-Goog-Upload-Command": "start",
      "X-Goog-Upload-Header-Content-Length": String(fileSize),
      "X-Goog-Upload-Header-Content-Type": mimeType,
      "Content-Type": "application/json",
    };

    const origin = request.headers.get("origin");

    if (origin) {
      headers.Origin = origin;
    }

    const response = await fetch(
      "https://generativelanguage.googleapis.com/upload/v1beta/files",
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          file: {
            display_name: safeName,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();

      return NextResponse.json(
        {
          error: "Gemini upload session could not be created.",
          details: errorText.slice(0, 1000),
        },
        { status: response.status }
      );
    }

    const uploadUrl = response.headers.get("x-goog-upload-url");

    if (!uploadUrl) {
      return NextResponse.json(
        { error: "Gemini did not return an upload URL." },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      uploadUrl,
    });
  } catch (error) {
    console.error("Upload session error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not create upload session.",
      },
      { status: 500 }
    );
  }
}
