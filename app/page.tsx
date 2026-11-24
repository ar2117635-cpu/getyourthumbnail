"use client";

import React, { useRef, useState } from "react";

type Concept = {
  title: string;
  description: string;
  prompt: string;
  image?: string;
};

export default function Home() {
  const fileInput = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoURL, setVideoURL] = useState("");
  const [description, setDescription] = useState("");
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [selected, setSelected] = useState(0);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [overlayText, setOverlayText] = useState("EPIC MOMENT!");
  const [fontSize, setFontSize] = useState("48");

  function uploadVideo(file?: File) {
    if (!file) return;

    if (!file.type.startsWith("video/")) {
      setError("Please select a valid video file.");
      return;
    }

    if (file.size > 100 * 1024 * 1024) {
      setError("Please select a video smaller than 100 MB.");
      return;
    }

    if (videoURL) URL.revokeObjectURL(videoURL);

    setVideoFile(file);
    setVideoURL(URL.createObjectURL(file));
    setConcepts([]);
    setError("");
    setMessage("Video uploaded successfully.");
  }

  async function analyzeVideo() {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!videoFile || !video || !canvas) {
      setError("Please upload a video first.");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("Analyzing your video...");

    try {
      if (video.readyState < 2) {
        await new Promise<void>((resolve, reject) => {
          video.onloadeddata = () => resolve();
          video.onerror = () => reject(new Error("Video could not load."));
          video.load();
        });
      }

      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas is not available.");

      canvas.width = 640;
      canvas.height = 360;

      const duration = video.duration;

      if (!Number.isFinite(duration) || duration <= 0) {
        throw new Error("Could not detect video duration.");
      }

      const frames: string[] = [];

      for (let i = 0; i < 6; i++) {
        const time = Math.min(
          (duration * (i + 1)) / 7,
          Math.max(0, duration - 0.2)
        );

        await new Promise<void>((resolve, reject) => {
          const timeout = window.setTimeout(() => {
            cleanup();
            reject(new Error("Video frame timed out. Try another MP4."));
          }, 20000);

          const cleanup = () => {
            clearTimeout(timeout);
            video.removeEventListener("seeked", done);
            video.removeEventListener("error", failed);
          };

          const done = () => {
            cleanup();
            resolve();
          };

          const failed = () => {
            cleanup();
            reject(new Error("Could not read this video frame."));
          };

          video.addEventListener("seeked", done, { once: true });
          video.addEventListener("error", failed, { once: true });
          video.currentTime = time;
        });

        context.drawImage(video, 0, 0, 640, 360);
        frames.push(canvas.toDataURL("image/jpeg", 0.65));
      }

      setMessage("Sending video frames to AI...");

      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          description,
          frames,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "AI analysis failed.");
      }

      const results = data.concepts || data.thumbnails || [];

      if (!Array.isArray(results) || results.length === 0) {
        throw new Error("AI did not return thumbnail concepts.");
      }

      const formatted: Concept[] = results.slice(0, 4).map(
        (item: any, index: number) => ({
          title: item.title || `Thumbnail Concept ${index + 1}`,
          description:
            item.description || item.text || "AI generated thumbnail idea.",
          prompt:
            item.imagePrompt ||
            item.image_prompt ||
            item.prompt ||
            item.description ||
            description,
        })
      );

      setConcepts(formatted);
      setSelected(0);
      setMessage("AI analysis completed successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setMessage("");
    } finally {
      setLoading(false);
    }
  }

  async function generateImage() {
    const concept = concepts[selected];
    if (!concept) return;

    setGenerating(true);
    setError("");
    setMessage("Creating your AI thumbnail...");

    try {
      const response = await fetch("/api/generate-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: concept.prompt,
          description,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Image generation failed.");
      }

      const image =
        data.image ||
        data.imageUrl ||
        data.image_url ||
        data.url;

      if (!image) {
        throw new Error("Image API did not return an image.");
      }

      setConcepts((old) =>
        old.map((item, index) =>
          index === selected ? { ...item, image } : item
        )
      );

      setMessage("Your thumbnail is ready!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Image generation failed.");
      setMessage("");
    } finally {
      setGenerating(false);
    }
  }

  function downloadThumbnail() {
    const concept = concepts[selected];

    if (!concept) {
      setError("Please select a thumbnail concept.");
      return;
    }

    if (concept.image) {
      const link = document.createElement("a");
      link.href = concept.image;
      link.download = "getyourthumbnail.png";
      link.click();
      return;
    }

    const canvas = canvasRef.current;
    const video = videoRef.current;

    if (!canvas || !video || video.readyState < 2) {
      setError("Please generate a thumbnail first.");
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = 1280;
    canvas.height = 720;

    ctx.drawImage(video, 0, 0, 1280, 720);

    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fillRect(0, 0, 1280, 720);

    ctx.font = `900 ${Number(fontSize)}px Arial`;
    ctx.textAlign = "center";
    ctx.lineWidth = 8;
    ctx.strokeStyle = "#000000";
    ctx.fillStyle = "#ffffff";

    ctx.strokeText(overlayText, 640, 620);
    ctx.fillText(overlayText, 640, 620);

    const link = document.createElement("a");
    link.download = "getyourthumbnail.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  const current = concepts[selected];

  return (
    <main>
      <div className="wrap">
        <nav className="nav">
          <a href="#" className="brand">
            <span className="brand-icon">✦</span>
            GetYour<span className="gradient-text">Thumbnail</span>
          </a>

          <div className="nav-links">
            <a href="#studio">Studio</a>
            <a href="#how">How It Works</a>
            <a href="#pricing">Pricing</a>
          </div>

          <div className="nav-actions">
            <a href="#studio" className="btn btn-primary small">
              Open Studio ↗
            </a>
            <button
              className="mobile-toggle"
              onClick={() => document.querySelector(".nav-links")?.classList.toggle("open")}
            >
              ☰
            </button>
          </div>
        </nav>

        <section className="hero">
          <div className="hero-copy">
            <div className="eyebrow">
              <span className="pulse" />
              AI POWERED THUMBNAIL CREATION
            </div>

            <h1>
              Turn Videos Into
              <span className="gradient-text"> Click-Worthy</span>
              Thumbnails.
            </h1>

            <p className="hero-sub">
              Upload your video. Let AI discover the best moments and
              transform them into powerful thumbnail concepts designed
              to capture attention.
            </p>

            <div className="hero-buttons">
              <a href="#studio" className="btn btn-primary">
                Create Thumbnail →
              </a>
              <a href="#how" className="btn btn-ghost">
                How It Works
              </a>
            </div>

            <div className="trust-row">
              <span>✓ AI Video Analysis</span>
              <span>✓ 4 Creative Ideas</span>
              <span>✓ HD Export</span>
            </div>
          </div>

          <div className="hero-art">
            <div className="glow glow-one" />
            <div className="glow glow-two" />

            <div className="mock-window">
              <div className="mock-top">
                <div className="dots"><i /><i /><i /></div>
                <span>THUMBNAIL PREVIEW</span>
                <span className="live-tag">● LIVE</span>
              </div>

              <div className="mock-image">
                <div className="mock-sun" />
                <div className="mock-mountain m1" />
                <div className="mock-mountain m2" />
                <div className="mock-copy">
                  <small>THE ULTIMATE MOMENT</small>
                  <strong>INSANE!</strong>
                  <em>AI THUMBNAIL STUDIO</em>
                </div>
              </div>

              <div className="mock-bottom">
                <span>✦ AI DESIGN ENGINE</span>
                <span className="mock-pill">1280 × 720</span>
              </div>
            </div>

            <div className="float-card">
              <div className="float-icon">✓</div>
              <div>
                <b>AI Concepts Ready</b>
                <small>Creative thumbnail ideas</small>
              </div>
            </div>
          </div>
        </section>

        <section className="stats">
          <div><b>AI Powered</b><span>Video Analysis</span></div>
          <div><b>4 Concepts</b><span>Creative Directions</span></div>
          <div><b>1280 × 720</b><span>HD Thumbnail Export</span></div>
          <div><b>Fast Workflow</b><span>Simple Creation</span></div>
        </section>
      </div>

      <section className="studio-section" id="studio">
        <div className="wrap">
          <div className="section-heading">
            <div className="eyebrow">YOUR CREATIVE WORKSPACE</div>
            <h2>AI Thumbnail <span className="gradient-text">Studio</span></h2>
            <p>Upload your video and let AI find your next winning thumbnail idea.</p>
          </div>

          <div className="studio-grid">
            <div className="panel">
              <div className="panel-title">
                <span className="step">01</span>
                <div>
                  <h3>Upload Your Video</h3>
                  <p>Choose the video you want to turn into a thumbnail.</p>
                </div>
              </div>

              <div
                className="dropzone"
                onClick={() => fileInput.current?.click()}
              >
                <input
                  ref={fileInput}
                  type="file"
                  accept="video/*"
                  onChange={(e) => uploadVideo(e.target.files?.[0])}
                />

                <div className="upload-icon">↑</div>
                <b>{videoFile ? videoFile.name : "Drop your video here or browse"}</b>
                <span>Click to upload your video</span>
                <small>MP4, MOV, WEBM · Maximum 100 MB</small>
              </div>

              {videoURL && (
                <div className="video-box">
                  <video
                    ref={videoRef}
                    src={videoURL}
                    controls
                    playsInline
                    preload="auto"
                  />
                  <button
                    className="btn btn-ghost small"
                    onClick={() => {
                      if (videoURL) URL.revokeObjectURL(videoURL);
                      setVideoURL("");
                      setVideoFile(null);
                      setConcepts([]);
                    }}
                  >
                    Remove Video ×
                  </button>
                </div>
              )}

              <div className="usage">
                <span>Video Analysis</span>
                <b>{loading ? "Processing..." : videoFile ? "Ready" : "Waiting for upload"}</b>
              </div>

              <div className="usage-track">
                <i style={{ width: loading ? "65%" : videoFile ? "35%" : "0%" }} />
              </div>

              <label className="fine-print">
                Describe your video or thumbnail idea (optional)
              </label>

              <div className="edit-controls">
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Example: Gaming, action, cinematic..."
                />
              </div>

              <button
                className="btn btn-primary full generate-btn"
                onClick={analyzeVideo}
                disabled={!videoFile || loading}
              >
                {loading ? "◌ Analyzing Video..." : "✦ Analyze Video With AI"}
              </button>

              <p className="fine-print" style={{ marginTop: 12 }}>
                AI analyzes selected video frames to create thumbnail concepts.
              </p>

              {message && <div className="notice">{message}</div>}
              {error && (
                <div className="notice" style={{ color: "#fca5a5" }}>
                  {error}
                </div>
              )}
            </div>

            <div className="panel">
              <div className="panel-title">
                <span className="step">02</span>
                <div>
                  <h3>Thumbnail Creator</h3>
                  <p>Choose a concept, generate and download your design.</p>
                </div>
              </div>

              {concepts.length === 0 ? (
                <div className="empty-result">
                  <div className="empty-icon">✦</div>
                  <b>Your Thumbnail Will Appear Here</b>
                  <span>
                    Upload a video and click Analyze Video With AI.
                    Your creative concepts will appear here.
                  </span>
                  <div className="empty-preview">
                    <div /><div /><div />
                  </div>
                </div>
              ) : (
                <>
                  <div className="design-tabs">
                    {concepts.map((item, index) => (
                      <button
                        key={index}
                        className={selected === index ? "selected" : ""}
                        onClick={() => setSelected(index)}
                      >
                        Concept {index + 1}
                      </button>
                    ))}
                  </div>

                  <div className="canvas-wrap">
                    {current?.image ? (
                      <img
                        src={current.image}
                        alt="AI generated thumbnail"
                        style={{ width: "100%", display: "block" }}
                      />
                    ) : (
                      <canvas
                        ref={canvasRef}
                        width={1280}
                        height={720}
                        className="hide"
                      />
                    )}

                    {!current?.image && (
                      <div className="empty-result">
                        <div className="empty-icon">▧</div>
                        <b>{current?.title}</b>
                        <span>{current?.description}</span>
                        <span>Generate your image using the button below.</span>
                      </div>
                    )}
                  </div>

                  <div className="edit-controls">
                    <label>
                      Thumbnail Text
                      <input
                        value={overlayText}
                        onChange={(e) => setOverlayText(e.target.value)}
                        placeholder="Enter thumbnail text"
                      />
                    </label>

                    <label>
                      Text Size
                      <input
                        type="number"
                        min="20"
                        max="100"
                        value={fontSize}
                        onChange={(e) => setFontSize(e.target.value)}
                      />
                    </label>

                    <button
                      className="btn btn-primary full"
                      onClick={generateImage}
                      disabled={generating}
                    >
                      {generating ? "Generating Image..." : "✦ Generate AI Thumbnail"}
                    </button>

                    <button
                      className="btn btn-ghost full"
                      onClick={downloadThumbnail}
                    >
                      ↓ Download Thumbnail PNG
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="how-section wrap" id="how">
        <div className="section-heading">
          <div className="eyebrow">SIMPLE CREATION PROCESS</div>
          <h2>How It <span className="gradient-text">Works</span></h2>
          <p>Three simple steps to start creating better thumbnails.</p>
        </div>

        <div className="steps">
          <article>
            <span>01</span>
            <div>↑</div>
            <h3>Upload Your Video</h3>
            <p>Choose your video and tell us what kind of thumbnail you want.</p>
          </article>

          <article>
            <span>02</span>
            <div>✦</div>
            <h3>AI Finds The Ideas</h3>
            <p>AI studies video frames and creates four creative thumbnail concepts.</p>
          </article>

          <article>
            <span>03</span>
            <div>↓</div>
            <h3>Generate & Download</h3>
            <p>Generate your selected design and download your thumbnail.</p>
          </article>
        </div>
      </section>

      <section className="pricing-section" id="pricing">
        <div className="wrap pricing-inner">
          <div>
            <div className="eyebrow">START CREATING TODAY</div>
            <h2>Make Every Thumbnail <span className="gradient-text">Count.</span></h2>
            <p>
              Start exploring AI-powered thumbnail creation.
              Build your next design with GetYourThumbnail.
            </p>
          </div>

          <div className="price-card">
            <div className="price-label">CREATOR STUDIO</div>
            <div className="price">Free <small>/ Starter</small></div>
            <ul>
              <li>✓ Video upload</li>
              <li>✓ AI video analysis</li>
              <li>✓ Four thumbnail concepts</li>
              <li>✓ T
