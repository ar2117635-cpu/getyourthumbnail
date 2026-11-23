
import { NextResponse } from "next/server";
import { GoogleGenAI, Type } from "@google/genai";

export const runtime = "nodejs";
export const maxDuration = 60;

const schema = {
  type: Type.OBJECT,
  properties: {
    concepts: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          headline: { type: Type.STRING },
          visual_scene: { type: Type.STRING },
          emotion: { type: Type.STRING },
          color_style: { type: Type.STRING },
          image_prompt: { type: Type.STRING }
        },
        required: [
          "headline",
          "visual_scene",
          "emotion",
          "color_style",
          "image_prompt"
        ]
      }
    }
  },
  required: ["concepts"]
};

export async function POST(request: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY is missing." },
        { status: 500 }
      );
    }

    const body = await request.json();
    const description = String(body.description || "").trim();

    if (!description || description.length > 5000) {
      return NextResponse.json(
        { error: "Enter a description up to 5000 characters." },
        { status: 400 }
      );
    }

    const ai = new GoogleGenAI({
      enterprise: true,
      apiKey
    });

    const interaction = await ai.interactions.create({
      model: "gemini-3.8-flash",
      input: `Create exactly 4 different, high-CTR YouTube thumbnail concepts.

Video description:
${description}

For every concept create:
- headline (2-5 powerful words)
- visual_scene
- emotion
- color_style
- image_prompt

Make each concept visually unique.
Return the four concepts in the required JSON format.`,
      response_format: schema,
      store: false
    });

    const output = interaction.output_text;

    if (!output) {
      throw new Error("Gemini returned an empty response.");
    }

    const result = JSON.parse(output);

    if (
      !Array.isArray(result.concepts) ||
      result.concepts.length !== 4
    ) {
      throw new Error("Gemini did not return exactly 4 concepts.");
    }

    return NextResponse.json({
      success: true,
      model: "gemini-3.8-flash",
      concepts: result.concepts
    });

  } catch (error) {
    console.error("GetYourThumbnail API error:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error
          ? error.message
          : "Unknown server error"
      },
      { status: 500 }
    );
  }
}
