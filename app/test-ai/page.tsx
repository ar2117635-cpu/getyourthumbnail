
"use client";

import { useState } from "react";

export default function TestAI() {
  const [description, setDescription] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  async function testAI() {
    setLoading(true);
    setResult("");

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ description })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "AI request failed");
      }

      setResult(JSON.stringify(data, null, 2));
    } catch (error) {
      setResult(
        error instanceof Error
          ? error.message
          : "Something went wrong"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{
      minHeight: "100vh",
      background: "#090914",
      color: "white",
      padding: "30px 18px",
      fontFamily: "Arial"
    }}>
      <div style={{ maxWidth: 650, margin: "auto" }}>
        <h1>GetYourThumbnail AI Studio</h1>

        <p>
          Enter your video description and generate
          4 AI thumbnail concepts.
        </p>

        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe your video here..."
          style={{
            width: "100%",
            minHeight: 150,
            padding: 15,
            borderRadius: 10,
            background: "#19192a",
            color: "white",
            border: "1px solid #555",
            boxSizing: "border-box"
          }}
        />

        <button
          onClick={testAI}
          disabled={loading || !description.trim()}
          style={{
            marginTop: 15,
            padding: "14px 22px",
            borderRadius: 10,
            background: "#7655ff",
            color: "white",
            border: 0,
            fontWeight: "bold",
            cursor: "pointer"
          }}
        >
          {loading ? "Analyzing..." : "Generate AI Concepts"}
        </button>

        {result && (
          <pre style={{
            marginTop: 25,
            padding: 15,
            background: "#19192a",
            borderRadius: 10,
            whiteSpace: "pre-wrap",
            overflowWrap: "anywhere"
          }}>
            {result}
          </pre>
        )}
      </div>
    </main>
  );
}
