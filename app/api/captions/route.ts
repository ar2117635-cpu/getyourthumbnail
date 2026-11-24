
import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  let tempPath = "";

  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY is missing in Vercel." },
        { status: 500 }
      );
    }

    const form = await request.formData();
    const file = form.get("video");
    const language = String(form.get("language") || "auto");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Please upload a video." },
        { status: 400 }
      );
    }

    if (!file.type.startsWith("video/")) {
      return NextResponse.json(
        { error: "Invalid video format." },
        { status: 400 }
      );
    }

    if (file.size > 4 * 1024 * 1024) {
      return NextResponse.json(
        { error: "For this Vercel MVP, please use a video under 4 MB." },
        { status: 413 }
      );
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    tempPath = path.join(
      os.tmpdir(),
      `${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`
    );

    await writeFile(tempPath, bytes);

    const ai = new GoogleGenAI({ apiKey });

    const uploaded = await ai.files.upload({
      file: tempPath,
      config: { mimeType: file.type },
    });

    if (!uploaded.uri) {
      throw new Error("Gemini could not upload this video.");
    }

    let state = uploaded.state;

    for (let i = 0; state === "PROCESSING" && i < 20; i++) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      const current = await ai.files.get({ name: uploaded.name! });
      state = current.state;
    }

    if (state !== "ACTIVE") {
      throw new Error("Video processing is not ready. Please try again.");
    }

    const prompt = `
Transcribe all spoken dialogue in this video.

Language preference: ${language === "auto" ? "Automatically detect the spoken language" : language}.

Return ONLY valid JSON in this exact structure:
{
  "captions": [
    {
      "start": 0.0,
      "end": 2.5,
      "text": "Spoken words here"
    }
  ]
}

Rules:
- Include only words actually spoken.
- Preserve the original spoken language.
- Divide speech into short readable subtitle segments.
- Use seconds for start and end timestamps.
- Keep timestamps in chronological order.
- Estimate timing carefully from the audio.
- Do not invent dialogue.
- Do not include explanations or Markdown.
`;

    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              fileData: {
                fileUri: uploaded.uri,
                mimeType: uploaded.mimeType || file.type,
              },
            },
            { text: prompt },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
      },
    });

    const raw = result.text || "";
    const parsed = JSON.parse(raw);
    const captions = parsed.captions;

    if (!Array.isArray(captions) || captions.length === 0) {
      throw new Error("No speech captions were detected.");
    }

    const clean = captions
      .filter(
        (c: any) =>
          typeof c.text === "string" &&
          Number.isFinite(Number(c.start)) &&
          Number.isFinite(Number(c.end)) &&
          Number(c.end) > Number(c.start)
      )
      .map((c: any) => ({
        start: Number(c.start),
        end: Number(c.end),
        text: c.text.trim(),
      }))
      .filter((c: any) => c.text.length > 0);

    if (clean.length === 0) {
      throw new Error("No valid caption segments were returned.");
    }

    return NextResponse.json({ captions: clean });
  } catch (error) {
    console.error("Caption API error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Caption generation failed.",
      },
      { status: 500 }
    );
  } finally {
    if (tempPath) {
      await unlink(tempPath).catch(() => {});
    }
  }
}
