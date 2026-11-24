
"use client";

import React, { ChangeEvent, useRef, useState } from "react";

type Concept = {
  title: string;
  description: string;
  prompt: string;
  imageUrl?: string;
};

const DEFAULT_CONCEPTS: Concept[] = [
  {
    title: "Cinematic",
    description: "Dramatic lighting and cinematic composition",
    prompt: "Create a cinematic YouTube thumbnail with dramatic lighting, strong subject focus, vibrant colors and a professional composition.",
  },
  {
    title: "High CTR",
    description: "Bold colors and an attention-grabbing layout",
    prompt: "Create a high click-through-rate YouTube thumbnail with bold colors, strong contrast, an expressive subject and a clear visual story.",
  },
  {
    title: "Professional",
    description: "Clean and premium thumbnail design",
    prompt: "Create a premium professional YouTube thumbnail with clean composition, sharp details, balanced colors and a clear focal point.",
  },
  {
    title: "Gaming Style",
    description: "Energetic gaming-inspired design",
    prompt: "Create an exciting gaming YouTube thumbnail with dynamic action, dramatic effects, vivid colors and a powerful focal subject.",
  },
];

function waitForMetadata(video: HTMLVideoElement): Promise<void> {
  return new Promise((resolve, reject) => {
    let finished = false;

    const cleanup = () => {
      window.clearTimeout(timeout);
      video.removeEventListener("loadedmetadata", onLoaded);
      video.removeEventListener("error", onError);
    };

    const onLoaded = () => {
      if (finished) return;
      finished = true;
      cleanup();
      resolve();
    };

    const onError = () => {
      if (finished) return;
      finished = true;
      cleanup();

      const code = video.error?.code;
      const reason =
        code === 3
          ? "Video decoding failed. This MP4 codec may not be supported."
          : code === 4
            ? "This video format or codec is not supported by your browser."
            : "Unable to read this video file.";

      reject(new Error(reason));
    };

    const timeout = window.setTimeout(() => {
      if (finished) return;
      finished = true;
      cleanup();
      reject(new Error("Video loading timed out. Please try another video."));
    }, 30000);

    video.addEventListener("loadedmetadata", onLoaded);
    video.addEventListener("error", onError);

    if (video.readyState >= 1) {
      onLoaded();
    }
  });
}

    const timeout = window.setTimeout(() => {
      reject(new Error("Video loading timed out. Please try another video."));
    }, 20000);

    video.onloadedmetadata = () => {
      window.clearTimeout(timeout);
      resolve();
    };

    video.onerror = () => {
      window.clearTimeout(timeout);
      reject(new Error("Unable to read this video file."));
    };
  });
}

function seekVideo(
  video: HTMLVideoElement,
  time: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      reject(new Error("Video frame loading timed out."));
    }, 15000);

    const finish = () => {
      window.clearTimeout(timeout);
      video.removeEventListener("seeked", finish);
      resolve();
    };

    video.addEventListener("seeked", finish, { once: true });
    video.currentTime = time;
  });
}


async function captureVideoFrames(file: File): Promise<string[]> {
  const video = document.createElement("video");
  const objectUrl = URL.createObjectURL(file);

  video.preload = "metadata";
  video.muted = true;
  video.playsInline = true;

  try {
    const metadataPromise = waitForMetadata(video);

    video.src = objectUrl;
    video.load();

    await metadataPromise;

    const duration = video.duration;

    if (!Number.isFinite(duration) || duration <= 0) {
      throw new Error("This video has an invalid duration.");
    }

    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 360;

    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Could not prepare the video frame.");
    }

    const frames: string[] = [];
    const sampleCount = Math.min(4, Math.max(2, Math.floor(duration)));

    for (let i = 0; i < sampleCount; i++) {
      const time = Math.min(
        (duration * (i + 1)) / (sampleCount + 1),
        Math.max(0, duration - 0.2)
      );

      await seekVideo(video, time);

      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      frames.push(canvas.toDataURL("image/jpeg", 0.75));
    }

    return frames;
  } finally {
    video.pause();
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(objectUrl);
  }
}

  const video = document.createElement("video");
  const objectUrl = URL.createObjectURL(file);
  video.preload = "auto";
  video.muted = true;
  video.playsInline = true;
  video.src = objectUrl;

  try {
    await waitForMetadata(video);

    const duration = video.duration;
    if (!Number.isFinite(duration) || duration <= 0) {
      throw new Error("This video has an invalid duration.");
    }

    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 360;

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Could not prepare the video frame.");
    }

    const frames: string[] = [];
    const sampleCount = Math.min(4, Math.max(2, Math.floor(duration)));

    for (let i = 0; i < sampleCount; i++) {
      const time =
        sampleCount === 1
          ? 0
          : Math.min(
              Math.max(0, (duration * (i + 1)) / (sampleCount + 1)),
              Math.max(0, duration - 0.2)
            );

      await seekVideo(video, time);

      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      frames.push(canvas.toDataURL("image/jpeg", 0.75));
    }

    return frames;
  } finally {
    video.pause();
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(objectUrl);
  }
}

export default function Home() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [description, setDescription] = useState("");
  const [concepts, setConcepts] = useState<Concept[]>(DEFAULT_CONCEPTS);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const selectedConcept = concepts[selectedIndex];

  function handleVideoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("video/")) {
      setError("Please select a valid video file.");
      return;
    }

    if (videoUrl) {
      URL.revokeObjectURL(videoUrl);
    }

    setVideoFile(file);
    setVideoUrl(URL.createObjectURL(file));
    setError("");
    setMessage("Video uploaded successfully.");
    setConcepts(DEFAULT_CONCEPTS);
    setSelectedIndex(0);
  }

  async function analyzeVideo() {
    if (!videoFile) {
      setError("Please upload a video first.");
      return;
    }

    setIsAnalyzing(true);
    setError("");
    setMessage("");

    try {
      const frames = await captureVideoFrames(videoFile);

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
        throw new Error(data.error || data.message || "AI analysis failed.");
      }

      const receivedConcepts = Array.isArray(data.concepts)
        ? data.concepts
        : Array.isArray(data.thumbnails)
          ? data.thumbnails
          : [];

      if (receivedConcepts.length > 0) {
        const formattedConcepts: Concept[] = receivedConcepts
          .slice(0, 4)
          .map((item: Record<string, unknown>, index: number) => ({
            title: String(item.title || item.name || `Concept ${index + 1}`),
            description: String(
              item.description || item.reason || "AI-generated thumbnail concept"
            ),
            prompt: String(
              item.image_prompt ||
                item.prompt ||
                item.description ||
                DEFAULT_CONCEPTS[index]?.prompt ||
                DEFAULT_CONCEPTS[0].prompt
            ),
            imageUrl: String(item.imageUrl || item.image_url || "") || undefined,
          }));

        setConcepts(formattedConcepts);
        setSelectedIndex(0);
      }

      setMessage(
        data.video_summary
          ? `Analysis complete: ${data.video_summary}`
          : "Video analysis completed."
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong during analysis."
      );
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function generateImage() {
    if (!selectedConcept) {
      setError("Please select a thumbnail concept.");
      return;
    }

    setIsGenerating(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/generate-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: selectedConcept.prompt,
          description,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || data.message || "Image generation failed."
        );
      }

      let imageUrl =
        data.imageUrl ||
        data.image_url ||
        data.url ||
        data.image ||
        "";

      if (typeof imageUrl === "string" && imageUrl && !imageUrl.startsWith("data:") && !imageUrl.startsWith("http")) {
        imageUrl = `data:image/png;base64,${imageUrl}`;
      }

      if (!imageUrl) {
        throw new Error("The image API did not return an image.");
      }

      setConcepts((previous) =>
        previous.map((concept, index) =>
          index === selectedIndex
            ? { ...concept, imageUrl: String(imageUrl) }
            : concept
        )
      );

      setMessage("Thumbnail image generated successfully.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not generate the image."
      );
    } finally {
      setIsGenerating(false);
    }
  }

  function downloadImage() {
    if (!selectedConcept?.imageUrl) {
      setError("Generate a thumbnail image before downloading.");
      return;
    }

    const link = document.createElement("a");
    link.href = selectedConcept.imageUrl;
    link.download = "getyourthumbnail.png";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <main className="wrap">
      <nav className="nav">
        <a href="#" className="logo">
          GetYour<span>Thumbnail</span>
        </a>

        <div className="nav-links">
          <a href="#studio">Studio</a>
          <a href="#how-it-works">How it works</a>
          <a href="#pricing">Pricing</a>
        </div>

        <a href="#studio" className="nav-button">
          Open Studio
        </a>
      </nav>

      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow">AI POWERED THUMBNAIL STUDIO</div>

          <h1>
            Turn Videos Into
            <br />
            <span>Click-Worthy</span>
            <br />
            Thumbnails.
          </h1>

          <p>
            Upload your video, let AI understand your content, and create
            powerful thumbnail concepts designed to make people stop scrolling.
          </p>

          <a href="#studio" className="nav-button">
            Create Your Thumbnail →
          </a>
        </div>

        <div className="hero-art">
          <div className="glow" />
          <div className="mock-window">
            <div className="eyebrow">YOUR NEXT BIG THUMBNAIL</div>
            <h2>Make Every Click Count.</h2>
            <p>
              Analyze. Create. Download.
              <br />
              Your thumbnail workflow starts here.
            </p>
            <div className="notice">AI Thumbnail Creation Studio</div>
          </div>
        </div>
      </section>

      <section className="stats">
        <div>
          <strong>AI</strong>
          <span>Video Analysis</span>
        </div>
        <div>
          <strong>4</strong>
          <span>Creative Concepts</span>
        </div>
        <div>
          <strong>HD</strong>
          <span>Thumbnail Workflow</span>
        </div>
      </section>

      <section className="studio-section" id="studio">
        <div className="section-heading">
          <h2>Your Thumbnail Studio</h2>
          <p>Upload your video and start creating your next thumbnail.</p>
        </div>

        <div className="studio-grid">
          <div className="panel">
            <h3 className="panel-title">01. Upload Your Video</h3>

            <label className="dropzone">
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                onChange={handleVideoChange}
              />
              <strong>＋ Choose a video</strong>
              <span>Tap here to upload your video</span>
              <span>Supported formats depend on your browser</span>
            </label>

            {videoUrl && (
              <div className="video-box">
                <video src={videoUrl} controls />
              </div>
            )}

            {videoFile && (
              <div className="notice">
                Selected: {videoFile.name}
              </div>
            )}

            <h3 className="panel-title" style={{ marginTop: 25 }}>
              02. Describe Your Video
            </h3>

            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Example: A gaming video where I defeat a powerful enemy..."
              rows={4}
              style={{
                width: "100%",
                resize: "vertical",
                color: "white",
                background: "#171526",
                border: "1px solid rgba(255,255,255,.12)",
                borderRadius: 12,
                padding: 14,
                outline: "none",
              }}
            />

            <div className="usage">
              <strong>Ready to analyze?</strong>
              <div className="usage-track">
                <span />
              </div>
            </div>

            <button
              className="generate-btn"
              onClick={analyzeVideo}
              disabled={!videoFile || isAnalyzing}
            >
              {isAnalyzing ? "Analyzing Video..." : "Analyze Video With AI →"}
            </button>

            {error && <div className="notice">{error}</div>}
            {message && <div className="notice">{message}</div>}
          </div>

          <div className="panel">
            <h3 className="panel-title">03. Thumbnail Concepts</h3>

            <div
              className="concepts-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: 10,
                marginBottom: 20,
              }}
            >
              {concepts.map((concept, index) => (
                <button
                  key={`${concept.title}-${index}`}
                  onClick={() => setSelectedIndex(index)}
                  className="concept-card"
                  style={{
                    textAlign: "left",
                    padding: 13,
                    borderRadius: 12,
                    border:
                      selectedIndex === index
                        ? "1px solid #a78bfa"
                        : "1px solid rgba(255,255,255,.1)",
                    background:
                      selectedIndex === index
                        ? "rgba(139,92,246,.2)"
                        : "#171526",
                    color: "white",
                  }}
                >
                  <strong>{concept.title}</strong>
                  <p
                    style={{
                      color: "#a6a1b8",
                      fontSize: 12,
                      lineHeight: 1.5,
                      marginBottom: 0,
                    }}
                  >
                    {concept.description}
                  </p>
                </button>
              ))}
            </div>

            <h3 className="panel-title">04. Preview</h3>

            <div className="canvas-wrap">
              {selectedConcept?.imageUrl ? (
                <img
                  src={selectedConcept.imageUrl}
                  alt={selectedConcept.title}
                />
              ) : (
                <div className="empty-result">
                  <div>
                    <strong>Your thumbnail preview will appear here</strong>
                    <span>
                      Select a concept and generate your thumbnail image.
                    </span>
                  </div>
                </div>
              )}
            </div>

            <button
              className="generate-btn"
              onClick={generateImage}
              disabled={isGenerating || !selectedConcept}
            >
              {isGenerating ? "Generating Image..." : "Generate Thumbnail Image →"}
            </button>

            <div className="edit-controls">
              <button onClick={downloadImage}>↓ Download PNG</button>
              <button
                onClick={() => {
                  setConcepts(DEFAULT_CONCEPTS);
                  setSelectedIndex(0);
                  setMessage("Concepts reset.");
                  setError("");
                }}
              >
                Reset Concepts
              </button>
            </div>

            <div className="notice">
              Final image generation requires a working image-generation API
              route. The concept preview is available even before an image is
              generated.
            </div>
          </div>
        </div>
      </section>

      <section className="how-section" id="how-it-works">
        <div className="section-heading">
          <h2>How It Works</h2>
          <p>Three simple steps to start your thumbnail workflow.</p>
        </div>

        <div className="steps">
          <div className="step-card">
            <div className="step-number">01</div>
            <strong>Upload Your Video</strong>
            <p>
              Select a video from your device and tell us what your content is
              about.
            </p>
          </div>

          <div className="step-card">
            <div className="step-number">02</div>
            <strong>Analyze With AI</strong>
            <p>
              AI analyzes video frames and helps prepare creative thumbnail
              concepts.
            </p>
          </div>

          <div className="step-card">
            <div className="step-number">03</div>
            <strong>Create And Download</strong>
            <p>
              Generate an image from your selected concept and download it when
              ready.
            </p>
          </div>
        </div>
      </section>

      <section className="pricing-section" id="pricing">
        <div className="section-heading">
          <h2>Simple Pricing</h2>
          <p>Start exploring the thumbnail studio.</p>
        </div>

        <div className="pricing-inner">
          <div className="price-card featured">
            <div className="price-label">CREATOR STUDIO</div>
            <div className="price">
              Free <small>/ Starter</small>
            </div>
            <ul>
              <li>✓ Video upload</li>
              <li>✓ AI video analysis</li>
              <li>✓ Four thumbnail concepts</li>
              <li>✓ Thumbnail preview</li>
              <li>✓ PNG download for generated images</li>
            </ul>
            <a href="#studio" className="nav-button">
              Start Creating
            </a>
          </div>

          <div className="price-card">
            <div className="price-label">COMING LATER</div>
            <div className="price">
              Pro <small>/ Future Plan</small>
            </div>
            <ul>
              <li>✓ More creative styles</li>
              <li>✓ Advanced editing tools</li>
              <li>✓ More export options</li>
              <li>✓ Higher generation limits</li>
              <li>✓ Project history</li>
            </ul>
            <p>Pro features are planned for a future release.</p>
          </div>
        </div>
      </section>

      <footer className="footer">
        <p>© 2026 GetYourThumbnail. Create better thumbnails with AI.</p>
      </footer>
    </main>
  );
    }
