"use client";

import React, { useRef, useState } from "react";

export default function ImageEnhancer() {
  const fileRef = useRef<HTMLInputElement>(null);

  const [original, setOriginal] = useState("");
  const [enhanced, setEnhanced] = useState("");
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);
  const [sharpness, setSharpness] = useState(0);
  const [strength, setStrength] = useState(25);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const activeImage = enhanced || original;

  const filters = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;

  function uploadImage(file?: File) {
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setMessage("Please upload JPG, PNG or WEBP image.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setMessage("Image size must be under 5 MB.");
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      setOriginal(String(reader.result));
      setEnhanced("");
      setBrightness(100);
      setContrast(100);
      setSaturation(100);
      setSharpness(0);
      setMessage("");
    };

    reader.readAsDataURL(file);
  }

  async function enhanceWithAI() {
    if (!original) return;

    setLoading(true);
    setMessage("AI is enhancing your image. Please wait...");

    try {
      const response = await fetch("/api/enhance-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          image: original,
          strength: strength / 100,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.details || data.error || "Enhancement failed.");
      }

      setEnhanced(data.imageUrl);
      setMessage("AI enhancement completed successfully!");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }

  function downloadImage() {
    if (!activeImage) return;

    const image = new Image();

    image.onload = () => {
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");

      if (!context) return;

      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;

      context.filter = filters;
      context.drawImage(image, 0, 0);

      if (sharpness > 0) {
        setMessage(
          "Download includes brightness, contrast and saturation. Sharpness preview is not applied to exported pixels yet."
        );
      }

      canvas.toBlob((blob) => {
        if (!blob) return;

        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");

        link.href = url;
        link.download = "enhanced-image.png";
        link.click();

        URL.revokeObjectURL(url);
      }, "image/png");
    };

    image.src = activeImage;
  }

  function resetControls() {
    setBrightness(100);
    setContrast(100);
    setSaturation(100);
    setSharpness(0);
  }

  const sliders = [
    {
      label: "Brightness",
      value: brightness,
      set: setBrightness,
      min: 0,
      max: 200,
    },
    {
      label: "Contrast",
      value: contrast,
      set: setContrast,
      min: 0,
      max: 200,
    },
    {
      label: "Saturation",
      value: saturation,
      set: setSaturation,
      min: 0,
      max: 200,
    },
    {
      label: "Sharpness",
      value: sharpness,
      set: setSharpness,
      min: 0,
      max: 100,
    },
  ];

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#090914",
        color: "white",
        padding: "25px 16px 60px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div style={{ maxWidth: 1100, margin: "auto" }}>
        <a
          href="/"
          style={{
            color: "#aaa5ff",
            textDecoration: "none",
            fontSize: 14,
          }}
        >
          ← Back to GetYourThumbnail
        </a>

        <header style={{ textAlign: "center", margin: "35px 0" }}>
          <h1 style={{ fontSize: 36, margin: 0 }}>
            AI Image <span style={{ color: "#a78bfa" }}>Enhancer</span>
          </h1>
          <p style={{ color: "#aaa", lineHeight: 1.6 }}>
            Improve image quality with AI and manual editing tools.
          </p>
        </header>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
            gap: 22,
          }}
        >
          <section
            style={{
              background: "#141323",
              border: "1px solid #29263d",
              borderRadius: 18,
              padding: 20,
            }}
          >
            <h2 style={{ fontSize: 19 }}>Upload Image</h2>

            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                uploadImage(e.dataTransfer.files[0]);
              }}
              style={{
                border: "2px dashed #6555b8",
                borderRadius: 14,
                padding: "35px 12px",
                textAlign: "center",
                cursor: "pointer",
                background: "#1b1930",
              }}
            >
              <div style={{ fontSize: 40 }}>📸</div>
              <strong>Click or drop your image here</strong>
              <p style={{ color: "#999", fontSize: 12 }}>
                JPG, PNG, WEBP · Maximum 5 MB
              </p>

              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                hidden
                onChange={(e) => uploadImage(e.target.files?.[0])}
              />
            </div>

            <h2 style={{ fontSize: 19, marginTop: 28 }}>
              Manual Adjustments
            </h2>

            {sliders.map((item) => (
              <div key={item.label} style={{ marginBottom: 22 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 8,
                  }}
                >
                  <label>{item.label}</label>
                  <span style={{ color: "#b5a6ff" }}>{item.value}</span>
                </div>

                <input
                  type="range"
                  min={item.min}
                  max={item.max}
                  value={item.value}
                  disabled={!original}
                  onChange={(e) => item.set(Number(e.target.value))}
                  style={{ width: "100%", accentColor: "#9b7aff" }}
                />
              </div>
            ))}

            <button
              onClick={resetControls}
              disabled={!original}
              style={secondaryButton}
            >
              Reset Adjustments
            </button>

            <hr style={{ borderColor: "#302c45", margin: "25px 0" }} />

            <h2 style={{ fontSize: 19 }}>AI Enhancement</h2>
            <p style={{ color: "#aaa", fontSize: 13 }}>
              Choose how strongly AI should transform your original image.
            </p>

            <input
              type="range"
              min="10"
              max="50"
              value={strength}
              disabled={!original || loading}
              onChange={(e) => setStrength(Number(e.target.value))}
              style={{ width: "100%", accentColor: "#9b7aff" }}
            />

            <p style={{ color: "#b5a6ff" }}>
              AI Strength: {strength}%
            </p>

            <button
              onClick={enhanceWithAI}
              disabled={!original || loading}
              style={{
                ...primaryButton,
                opacity: !original || loading ? 0.5 : 1,
              }}
            >
              {loading ? "Enhancing..." : "✨ Enhance with AI"}
            </button>

            <button
              onClick={downloadImage}
              disabled={!activeImage}
              style={secondaryButton}
            >
              ↓ Download Image
            </button>

            {message && (
              <p
                style={{
                  color: message.includes("successfully")
                    ? "#65e6a3"
                    : "#f0c477",
                  fontSize: 13,
                  lineHeight: 1.5,
                  overflowWrap: "anywhere",
                }}
              >
                {message}
              </p>
            )}
          </section>

          <section
            style={{
              background: "#141323",
              border: "1px solid #29263d",
              borderRadius: 18,
              padding: 20,
            }}
          >
            <h2 style={{ fontSize: 19 }}>Image Preview</h2>

            {!original ? (
              <div
                style={{
                  minHeight: 320,
                  display: "grid",
                  placeItems: "center",
                  color: "#777",
                  textAlign: "center",
                  background: "#0d0c17",
                  borderRadius: 12,
                }}
              >
                Your image preview will appear here.
              </div>
            ) : (
              <>
                <div
                  style={{
                    background: "#090914",
                    borderRadius: 12,
                    padding: 8,
                    minHeight: 260,
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  <img
                    src={activeImage}
                    alt="Enhanced preview"
                    style={{
                      maxWidth: "100%",
                      maxHeight: 500,
                      objectFit: "contain",
                      filter: filters,
                      borderRadius: 6,
                    }}
                  />
                </div>

                <p style={{ color: "#aaa", fontSize: 12 }}>
                  {enhanced ? "AI enhanced image" : "Original image with manual preview adjustments"}
                </p>

                <h3 style={{ fontSize: 16, marginTop: 25 }}>
                  Before / After
                </h3>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 10,
                  }}
                >
                  <div>
                    <img
                      src={original}
                      alt="Original"
                      style={{
                        width: "100%",
                        borderRadius: 8,
                        display: "block",
                      }}
                    />
                    <p style={{ color: "#aaa", fontSize: 12 }}>Original</p>
                  </div>

                  <div>
                    <img
                      src={activeImage}
                      alt="After enhancement"
                      style={{
                        width: "100%",
                        borderRadius: 8,
                        filter: filters,
                        display: "block",
                      }}
                    />
                    <p style={{ color: "#aaa", fontSize: 12 }}>After</p>
                  </div>
                </div>
              </>
            )}
          </section>
        </div>

        <p
          style={{
            color: "#666",
            textAlign: "center",
            fontSize: 12,
            marginTop: 35,
          }}
        >
          GetYourThumbnail · Image Enhancer
        </p>
      </div>
    </main>
  );
}

const primaryButton: React.CSSProperties = {
  width: "100%",
  padding: 14,
  border: 0,
  borderRadius: 10,
  background: "linear-gradient(100deg,#7655ed,#ad65e9)",
  color: "white",
  fontWeight: 700,
  cursor: "pointer",
  marginTop: 10,
};

const secondaryButton: React.CSSProperties = {
  width: "100%",
  padding: 13,
  border: "1px solid #51476f",
  borderRadius: 10,
  background: "#211e35",
  color: "white",
  cursor: "pointer",
  marginTop: 10,
};
