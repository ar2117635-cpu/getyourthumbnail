
"use client";

import React, { useRef, useState } from "react";

const MODEL_URL =
  "https://huggingface.co/thisismert/real-esrgan-onnx/resolve/main/onnx/realesr-general-x4v3.onnx";

let sessionPromise: Promise<any> | null = null;

async function getModel() {
  if (!sessionPromise) {
    sessionPromise = (async () => {
      const ort = await import("onnxruntime-web");
      ort.env.wasm.wasmPaths =
        "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.31.1/dist/";

      return ort.InferenceSession.create(MODEL_URL, {
        executionProviders: ["wasm"],
        graphOptimizationLevel: "all",
      });
    })();
  }

  try {
    return await sessionPromise;
  } catch (error) {
    sessionPromise = null;
    throw error;
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Image could not be loaded."));
    image.src = src;
  });
}

export default function ImageEnhancer() {
  const fileRef = useRef<HTMLInputElement>(null);

  const [original, setOriginal] = useState("");
  const [enhanced, setEnhanced] = useState("");
  const [scale, setScale] = useState<2 | 4>(2);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [device, setDevice] = useState("");

  const activeImage = enhanced || original;
  const filters =
    `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;

  function uploadImage(file?: File) {
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setMessage("Please upload JPG, PNG or WEBP.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setMessage("Image must be under 5 MB.");
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      setOriginal(String(reader.result));
      setEnhanced("");
      setBrightness(100);
      setContrast(100);
      setSaturation(100);
      setProgress(0);
      setMessage("");
    };

    reader.readAsDataURL(file);
  }

  async function enhanceImage() {
    if (!original || loading) return;

    setLoading(true);
    setProgress(0);

    let outputUrl = "";

    try {
      const isMobile =
        /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);

      const maxPixels = isMobile ? 500000 : 1500000;
      const tileSize = isMobile ? 96 : 160;
      const overlap = 8;

      setDevice(isMobile ? "Mobile optimized" : "Desktop optimized");
      setMessage("Loading AI model...");

      const image = await loadImage(original);

      let width = image.naturalWidth;
      let height = image.naturalHeight;

      const totalPixels = width * height;

      if (totalPixels > maxPixels) {
        const ratio = Math.sqrt(maxPixels / totalPixels);
        width = Math.max(1, Math.floor(width * ratio));
        height = Math.max(1, Math.floor(height * ratio));
      }

      const sourceCanvas = document.createElement("canvas");
      sourceCanvas.width = width;
      sourceCanvas.height = height;

      const sourceContext = sourceCanvas.getContext("2d", {
        willReadFrequently: true,
      });

      if (!sourceContext) throw new Error("Canvas unavailable.");

      sourceContext.drawImage(image, 0, 0, width, height);

      const source = sourceContext.getImageData(
        0, 0, width, height
      ).data;

      setMessage("Loading Real-ESRGAN AI...");

      const session = await getModel();
      const ort = await import("onnxruntime-web");

      const outputScale = scale;
      const finalCanvas = document.createElement("canvas");

      finalCanvas.width = width * outputScale;
      finalCanvas.height = height * outputScale;

      const finalContext = finalCanvas.getContext("2d");

      if (!finalContext) throw new Error("Output canvas unavailable.");

      finalContext.imageSmoothingEnabled = true;
      finalContext.imageSmoothingQuality = "high";

      const tilesX = Math.ceil(width / tileSize);
      const tilesY = Math.ceil(height / tileSize);
      const totalTiles = tilesX * tilesY;
      let completed = 0;

      for (let y = 0; y < height; y += tileSize) {
        for (let x = 0; x < width; x += tileSize) {
          const coreW = Math.min(tileSize, width - x);
          const coreH = Math.min(tileSize, height - y);

          const x0 = Math.max(0, x - overlap);
          const y0 = Math.max(0, y - overlap);
          const x1 = Math.min(width, x + coreW + overlap);
          const y1 = Math.min(height, y + coreH + overlap);

          const tileW = x1 - x0;
          const tileH = y1 - y0;

          const planeSize = tileW * tileH;
          const inputData = new Float32Array(3 * planeSize);

          for (let ty = 0; ty < tileH; ty++) {
            for (let tx = 0; tx < tileW; tx++) {
              const sourceIndex =
                ((y0 + ty) * width + (x0 + tx)) * 4;
              const index = ty * tileW + tx;

              inputData[index] = source[sourceIndex] / 255;
              inputData[planeSize + index] =
                source[sourceIndex + 1] / 255;
              inputData[2 * planeSize + index] =
                source[sourceIndex + 2] / 255;
            }
          }

          const tensor = new ort.Tensor(
            "float32",
            inputData,
            [1, 3, tileH, tileW]
          );

          const result = await session.run({
            [session.inputNames[0]]: tensor,
          });

          const output = result[session.outputNames[0]];
          const outputH = output.dims[2];
          const outputW = output.dims[3];
          const outputPlane = outputH * outputW;
          const outputData = output.data as Float32Array;

          const cropX = (x - x0) * 4;
          const cropY = (y - y0) * 4;

          const tileCanvas = document.createElement("canvas");
          tileCanvas.width = coreW * 4;
          tileCanvas.height = coreH * 4;

          const tileContext = tileCanvas.getContext("2d");

          if (!tileContext) throw new Error("Tile canvas unavailable.");

          const tilePixels = new ImageData(
            coreW * 4,
            coreH * 4
          );

          for (let py = 0; py < coreH * 4; py++) {
            for (let px = 0; px < coreW * 4; px++) {
              const sourceIndex =
                (cropY + py) * outputW + cropX + px;

              const targetIndex =
                (py * coreW * 4 + px) * 4;

              tilePixels.data[targetIndex] = Math.max(
                0,
                Math.min(255, Math.round(outputData[sourceIndex] * 255))
              );

              tilePixels.data[targetIndex + 1] = Math.max(
                0,
                Math.min(
                  255,
                  Math.round(
                    outputData[outputPlane + sourceIndex] * 255
                  )
                )
              );

              tilePixels.data[targetIndex + 2] = Math.max(
                0,
                Math.min(
                  255,
                  Math.round(
                    outputData[2 * outputPlane + sourceIndex] * 255
                  )
                )
              );

              tilePixels.data[targetIndex + 3] = 255;
            }
          }

          tileContext.putImageData(tilePixels, 0, 0);

          finalContext.drawImage(
            tileCanvas,
            x * outputScale,
            y * outputScale,
            coreW * outputScale,
            coreH * outputScale
          );

          completed++;
          setProgress(Math.round((completed / totalTiles) * 100));
          setMessage(`AI processing: ${completed}/${totalTiles} tiles`);

          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }

      outputUrl = finalCanvas.toDataURL("image/png");
      setEnhanced(outputUrl);
      setMessage(
        `AI enhancement complete! ${width * outputScale} × ${height * outputScale} pixels.`
      );
    } catch (error) {
      console.error(error);

      setMessage(
        error instanceof Error
          ? error.message
          : "AI enhancement failed. Please try a smaller image."
      );
    } finally {
      setLoading(false);
    }
  }

  async function downloadImage() {
    if (!activeImage) return;

    try {
      const image = await loadImage(activeImage);
      const canvas = document.createElement("canvas");

      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;

      const context = canvas.getContext("2d");

      if (!context) throw new Error("Canvas unavailable.");

      context.filter = filters;
      context.drawImage(image, 0, 0);

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png")
      );

      if (!blob) throw new Error("Download creation failed.");

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = `getyourthumbnail-${scale}x.png`;
      link.click();

      setTimeout(() => URL.revokeObjectURL(url), 3000);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Download failed."
      );
    }
  }

  function resetAdjustments() {
    setBrightness(100);
    setContrast(100);
    setSaturation(100);
  }

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <a href="/" style={styles.back}>
          ← Back to GetYourThumbnail
        </a>

        <header style={styles.header}>
          <h1 style={styles.heading}>
            AI Image <span style={{ color: "#ad8cff" }}>Enhancer</span>
          </h1>
          <p style={styles.muted}>
            Professional AI Upscaling powered by Real-ESRGAN
          </p>
          <p style={styles.device}>{device}</p>
        </header>

        <div style={styles.grid}>
          <section style={styles.panel}>
            <h2>Upload Image</h2>

            <div
              style={styles.upload}
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                uploadImage(e.dataTransfer.files[0]);
              }}
            >
              <div style={{ fontSize: 38 }}>📸</div>
              <strong>Click or drop image here</strong>
              <p style={styles.muted}>JPG, PNG, WEBP · Maximum 5 MB</p>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                hidden
                onChange={(e) => uploadImage(e.target.files?.[0])}
              />
            </div>

            <h2 style={styles.sectionTitle}>AI Upscaling</h2>
            <p style={styles.muted}>Choose output resolution</p>

            <div style={styles.scaleGrid}>
              {[2, 4].map((value) => (
                <button
                  key={value}
                  onClick={() => setScale(value as 2 | 4)}
                  disabled={loading}
                  style={{
                    ...styles.scaleButton,
                    borderColor: scale === value ? "#ad8cff" : "#51476f",
                    background: scale === value ? "#30234f" : "#211e35",
                  }}
                >
                  {value}x
                  <small style={{ display: "block", color: "#aaa" }}>
                    {value === 2 ? "Double resolution" : "Quadruple resolution"}
                  </small>
                </button>
              ))}
            </div>

            <h2 style={styles.sectionTitle}>Manual Adjustments</h2>

            {[
              ["Brightness", brightness, setBrightness],
              ["Contrast", contrast, setContrast],
              ["Saturation", saturation, setSaturation],
            ].map(([label, value, setter]: any) => (
              <div key={label} style={styles.sliderRow}>
                <div style={styles.sliderLabel}>
                  <span>{label}</span>
                  <span style={{ color: "#b5a6ff" }}>{value}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="200"
                  value={value}
                  disabled={!original || loading}
                  onChange={(e) => setter(Number(e.target.value))}
                  style={{ width: "100%", accentColor: "#9b7aff" }}
                />
              </div>
            ))}

            <button
              onClick={resetAdjustments}
              disabled={!original || loading}
              style={styles.secondary}
            >
              Reset Adjustments
            </button>

            <button
              onClick={enhanceImage}
              disabled={!original || loading}
              style={{
                ...styles.primary,
                opacity: !original || loading ? 0.5 : 1,
              }}
            >
              {loading ? "Processing AI..." : `✨ Enhance Image ${scale}x`}
            </button>

            {loading && (
              <div style={styles.progressOuter}>
                <div
                  style={{
                    ...styles.progressInner,
                    width: `${progress}%`,
                  }}
                />
              </div>
            )}

            {message && <p style={styles.message}>{message}</p>}

            <button
              onClick={downloadImage}
              disabled={!activeImage}
              style={styles.secondary}
            >
              ↓ Download Enhanced Image
            </button>
          </section>

          <section style={styles.panel}>
            <h2>Image Preview</h2>

            {!original ? (
              <div style={styles.empty}>
                Your image preview will appear here.
              </div>
            ) : (
              <>
                <div style={styles.preview}>
                  <img
                    src={activeImage}
                    alt="Enhanced preview"
                    style={{
                      maxWidth: "100%",
                      maxHeight: 500,
                      objectFit: "contain",
                      filter: filters,
                    }}
                  />
                </div>

                {enhanced && (
                  <p style={styles.success}>
                    AI Upscaled · {scale}x Resolution
                  </p>
                )}

                <h3>Before / After</h3>

                <div style={styles.compare}>
                  <div>
                    <img
                      src={original}
                      alt="Original"
                      style={styles.compareImage}
                    />
                    <p style={styles.muted}>Original</p>
                  </div>

                  <div>
                    <img
                      src={activeImage}
                      alt="Enhanced"
                      style={{
                        ...styles.compareImage,
                        filter: filters,
                      }}
                    />
                    <p style={styles.muted}>After</p>
                  </div>
                </div>
              </>
            )}
          </section>
        </div>

        <p style={styles.footer}>
          GetYourThumbnail · Real-ESRGAN Image Enhancer
        </p>
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#090914",
    color: "white",
    padding: "25px 16px 60px",
    fontFamily: "Arial, sans-serif",
  },
  container: { maxWidth: 1100, margin: "auto" },
  back: { color: "#aaa5ff", textDecoration: "none", fontSize: 14 },
  header: { textAlign: "center", margin: "35px 0" },
  heading: { fontSize: 36, margin: 0 },
  muted: { color: "#aaa", fontSize: 13, lineHeight: 1.6 },
  device: { color: "#a78bfa", fontSize: 12 },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,320px),1fr))",
    gap: 22,
  },
  panel: {
    background: "#141323",
    border: "1px solid #29263d",
    borderRadius: 18,
    padding: 20,
    minWidth: 0,
  },
  upload: {
    border: "2px dashed #6555b8",
    borderRadius: 14,
    padding: "30px 12px",
    textAlign: "center",
    cursor: "pointer",
    background: "#1b1930",
  },
  sectionTitle: { fontSize: 19, marginTop: 28 },
  scaleGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  scaleButton: {
    padding: 15,
    border: "2px solid",
    borderRadius: 10,
    color: "white",
    cursor: "pointer",
    fontSize: 20,
    fontWeight: 700,
  },
  sliderRow: { marginBottom: 20 },
  sliderLabel: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  primary: {
    width: "100%",
    padding: 14,
    border: 0,
    borderRadius: 10,
    background: "linear-gradient(100deg,#7655ed,#ad65e9)",
    color: "white",
    fontWeight: 700,
    cursor: "pointer",
    marginTop: 12,
  },
  secondary: {
    width: "100%",
    padding: 13,
    border: "1px solid #51476f",
    borderRadius: 10,
    background: "#211e35",
    color: "white",
    cursor: "pointer",
    marginTop: 10,
  },
  progressOuter: {
    height: 8,
    background: "#302c45",
    borderRadius: 10,
    overflow: "hidden",
    marginTop: 16,
  },
  progressInner: {
    height: "100%",
    background: "linear-gradient(90deg,#7655ed,#ad65e9)",
    transition: "width .2s",
  },
  message: {
    color: "#d0c4ff",
    fontSize: 13,
    lineHeight: 1.5,
    overflowWrap: "anywhere",
  },
  success: { color: "#65e6a3", fontSize: 13 },
  preview: {
    background: "#090914",
    borderRadius: 12,
    padding: 8,
    minHeight: 260,
    display: "grid",
    placeItems: "center",
  },
  empty: {
    minHeight: 320,
    display: "grid",
    placeItems: "center",
    color: "#777",
    background: "#0d0c17",
    borderRadius: 12,
  },
  compare: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
  },
  compareImage: {
    width: "100%",
    borderRadius: 8,
    display: "block",
  },
  footer: {
    color: "#666",
    textAlign: "center",
    fontSize: 12,
    marginTop: 35,
  },
}
