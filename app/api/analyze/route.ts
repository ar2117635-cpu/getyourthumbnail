
import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "Gemini API key is not configured." },
        { status: 500 }
      );
    }

    const body = await request.json();
    const description = String(body.description || "").trim();

    if (!description || description.length > 5000) {
      return NextResponse.json(
        { error: "Please provide a video description (max 5000 characters)." },
        { status: 400 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Analyze this video description for a YouTube thumbnail:
${description}

Return exactly 4 distinct thumbnail concepts.
For each include:
- headline (2-5 words)
- visual_scene
- emotion
- color_style
- image_prompt

Return valid JSON with a concepts array.`,
      config: {
        responseMimeType: "application/json"
      }
    });

    const result = JSON.parse(response.text || "{}");

    return NextResponse.json(result);

  } catch (error) {
    console.error("Thumbnail analysis error:", error);

    return NextResponse.json(
      {
        error: error instanceof Error
          ? error.message
          : "Unknown AI error"
      },
      { status: 500 }
    );
  }}
  
