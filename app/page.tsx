
"use client";

import React, { useRef, useState } from "react";

type Concept = {
  title: string;
  description: string;
  prompt: string;
  imageUrl?: string;
};

export default function Home() {
  const fileRef = useRef<HTMLInputElement>(null);

  const [video, setVideo] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [description, setDescription] = useState("");
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [activeTab, setActiveTab] = useState("studio");

  function uploadVideo(file?: File) {
    if (!file) return;

    if (!file.type.startsWith("video/")) {
      setMessage("Please select a valid video.");
      return;
    }

    if (videoUrl) URL.revokeObjectURL(videoUrl);

    setVideo(file);
    setVideoUrl(URL.createObjectURL(file));
    setConcepts([]);
    setMessage("");
  }

  async function captureFrames(file: File): Promise<string[]> {
    const element = document.createElement("video");
    const url = URL.createObjectURL(file);

    element.src = url;
    element.preload = "auto";
    element.muted = true;
    element.playsInline = true;

    try {
      await new Promise<void>((resolve, reject) => {
        const timer = window.setTimeout(
          () => reject(new Error("Video loading timed out.")),
          20000
        );

        element.onloadedmetadata = () => {
          clearTimeout(timer);
          resolve();
        };

        element.onerror = () => {
          clearTimeout(timer);
          reject(new Error("Unable to read video."));
        };

        element.load();
      });

      const duration = element.duration;

      if (!Number.isFinite(duration) || duration <= 0) {
        throw new Error("Invalid video duration.");
      }

      const frames: string[] = [];
      const times = [
        duration * 0.2,
        duration * 0.45,
        duration * 0.7,
        duration * 0.9,
      ];

      for (const time of times) {
        await new Promise<void>((resolve, reject) => {
          const timer = window.setTimeout(
            () => reject(new Error("Frame capture timed out.")),
            10000
          );

          element.onseeked = () => {
            clearTimeout(timer);
            resolve();
          };

          element.onerror = () => {
            clearTimeout(timer);
            reject(new Error("Unable to capture video frame."));
          };

          element.currentTime = Math.min(
            time,
            Math.max(0, duration - 0.1)
          );
        });

        const canvas = document.createElement("canvas");
        const scale = Math.min(1, 512 / element.videoWidth);

        canvas.width = Math.max(1, Math.round(element.videoWidth * scale));
        canvas.height = Math.max(1, Math.round(element.videoHeight * scale));

        const context = canvas.getContext("2d");

        if (!context) throw new Error("Canvas unavailable.");

        context.drawImage(element, 0, 0, canvas.width, canvas.height);
        frames.push(canvas.toDataURL("image/jpeg", 0.65));
      }

      return frames;
    } finally {
      element.pause();
      element.removeAttribute("src");
      element.load();
      URL.revokeObjectURL(url);
    }
  }

  async function analyzeVideo() {
    if (!video) {
      setMessage("Upload a video first.");
      return;
    }

    setLoading(true);
    setConcepts([]);
    setMessage("Preparing video scenes...");

    try {
      const frames = await captureFrames(video);

      setMessage("AI is analyzing your video...");

      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description, frames }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          typeof data.details === "string"
            ? data.details
            : data.error || "Video analysis failed."
        );
      }

      const results = data.concepts || data.result?.concepts;

      if (!Array.isArray(results) || results.length === 0) {
        throw new Error("No thumbnail concepts received.");
      }

      setConcepts(
        results.map((item: Record<string, unknown>, index: number) => ({
          title: String(item.title || `Concept ${index + 1}`),
          description: String(item.description || ""),
          prompt: String(item.prompt || item.description || item.title || ""),
        }))
      );

      setMessage("Your thumbnail concepts are ready!");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Analysis failed."
      );
    } finally {
      setLoading(false);
    }
  }

  async function generateThumbnail(index: number) {
    const concept = concepts[index];
    if (!concept) return;

    setGenerating(index);
    setMessage("Creating your thumbnail...");

    try {
      const response = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: concept.prompt,
          description: concept.description || description,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          typeof data.details === "string"
            ? data.details
            : data.error || "Image generation failed."
        );
      }

      const image =
        data.imageUrl || data.image_url || data.url || data.image;

      if (!image) throw new Error("No image returned by AI.");

      setConcepts((previous) =>
        previous.map((item, i) =>
          i === index ? { ...item, imageUrl: image } : item
        )
      );

      setMessage("Thumbnail generated successfully!");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Image generation failed."
      );
    } finally {
      setGenerating(null);
    }
  }

  function downloadImage(url: string, index: number) {
    const link = document.createElement("a");
    link.href = url;
    link.download = `getyourthumbnail-${index + 1}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  return (
    <main className="studio">
      <style jsx>{`
        * { box-sizing: border-box; }

        .studio {
          min-height: 100vh;
          background:
            radial-gradient(ellipse at 15% 0%, #30205b 0%, transparent 38%),
            radial-gradient(ellipse at 95% 25%, #211044 0%, transparent 35%),
            #080711;
          color: #fff;
          font-family: Arial, sans-serif;
          padding: 22px;
        }

        .shell { max-width: 1250px; margin: auto; }

        .topbar {
          display: flex; justify-content: space-between;
          align-items: center; gap: 15px; flex-wrap: wrap;
          padding: 15px 0 25px;
          border-bottom: 1px solid #30234c;
        }

        .brand { font-size: 23px; font-weight: 900; letter-spacing: -1px; }
        .brand span { color: #b58aff; }

        .nav { display: flex; gap: 9px; flex-wrap: wrap; }

        button, a { font: inherit; }

        .nav button {
          border: 1px solid #40305e; color: #c9b9e8;
          background: #151023; padding: 10px 15px;
          border-radius: 10px; cursor: pointer;
        }

        .nav button.active {
          color: white; border-color: #a77aff;
          background: linear-gradient(110deg,#663bd0,#9d4bd1);
          box-shadow: 0 0 18px #8d4bca55;
        }

        .hero { padding: 45px 0 30px; text-align: center; }

        .eyebrow {
          display: inline-block; color: #d0a8ff;
          border: 1px solid #65418a; background: #27163c;
          border-radius: 30px; padding: 8px 14px;
          font-size: 11px; letter-spacing: 2px;
        }

        .hero h1 {
          font-size: clamp(34px,6vw,61px);
          line-height: 1.08; letter-spacing: -2px;
          margin: 18px 0 12px;
        }

        .gradient {
          background: linear-gradient(100deg,#9f7aff,#ee8bff);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }

        .hero p { color: #aaa1bc; line-height: 1.7; max-width: 650px; margin: auto; }

        .stats {
          display: grid; grid-template-columns: repeat(3,1fr);
          gap: 12px; margin: 18px 0 28px;
        }

        .stat {
          border: 1px solid #33264c; background: #120f20;
          padding: 16px; border-radius: 14px; text-align: center;
        }

        .stat strong { display: block; font-size: 21px; color: #c59aff; }
        .stat span { font-size: 11px; color: #9188a4; }

        .grid {
          display: grid; grid-template-columns: minmax(0, .9fr) minmax(0, 1.1fr);
          gap: 19px; align-items: start;
        }

        .panel {
          background: linear-gradient(145deg,#171327,#100e1c);
          border: 1px solid #382850; border-radius: 19px;
          padding: 22px; box-shadow: 0 12px 45px #0005;
          min-width: 0;
        }

        .panel h2 { font-size: 19px; margin: 0 0 7px; }
        .muted { color: #958ba8; font-size: 13px; line-height: 1.6; }

        .upload {
          margin-top: 20px; padding: 34px 14px;
          text-align: center; border: 1.5px dashed #8858bb;
          background: #1c1530; border-radius: 15px;
          cursor: pointer; transition: .2s;
        }

        .upload:hover { border-color: #d19cff; box-shadow: 0 0 20px #a34bca22; }
        .upload .emoji { font-size: 40px; margin-bottom: 12px; }

        .video {
          width: 100%; max-height: 280px; border-radius: 12px;
          background: #000; margin-top: 15px;
        }

        textarea {
          width: 100%; min-height: 100px; resize: vertical;
          background: #0c0a15; border: 1px solid #403252;
          color: white; border-radius: 11px; padding: 13px;
          margin-top: 9px; outline: none;
        }

        textarea:focus { border-color: #a878ed; }

        .primary {
          width: 100%; padding: 14px; border: 0;
          color: white; font-weight: bold; border-radius: 11px;
          cursor: pointer; margin-top: 16px;
          background: linear-gradient(100deg,#7446db,#bd4ed0);
          box-shadow: 0 5px 22px #9146db44;
        }

        .primary:disabled { opacity: .45; cursor: not-allowed; }

        .secondary {
          display: inline-block; text-decoration: none;
          color: #d5b5ff; border: 1px solid #78539e;
          background: #20152f; padding: 11px 15px;
          border-radius: 10px; cursor: pointer;
        }

        .message {
          margin-top: 16px; padding: 13px;
          border-radius: 10px; border: 1px solid #68418a;
          background: #21152f; color: #d9c1fa;
          font-size: 13px; overflow-wrap: anywhere;
        }

        .concept {
          border: 1px solid #3a2a50; background: #100e1d;
          border-radius: 14px; padding: 16px; margin-top: 14px;
        }

        .concept h3 { margin: 0; font-size: 16px; }
        .concept p { color: #a59bb5; font-size: 13px; line-height: 1.65; }
        .concept img { width: 100%; border-radius: 10px; display: block; margin: 12px 0; }

        .concept button {
          width: 100%; padding: 12px; border-radius: 9px;
          border: 1px solid #8c59bc; color: white;
          background: linear-gradient(100deg,#5831a4,#823eaf);
          cursor: pointer; font-weight: bold;
        }

        .concept button:disabled { opacity: .5; cursor: not-allowed; }

        .empty {
          border: 1px dashed #443252; background: #100d1b;
          border-radius: 14px; padding: 50px 15px;
          text-align: center; margin-top: 18px;
        }

        .empty .emoji { font-size: 42px; }
        .toolcards {
          display: grid; grid-template-columns: 1fr 1fr;
          gap: 15px; margin-top: 30px;
        }

        .toolcard {
          display: block; text-decoration: none; color: white;
          padding: 22px; border-radius: 16px;
          border: 1px solid #48305e;
          background: linear-gradient(135deg,#1b1530,#171025);
          transition: .2s;
        }

        .toolcard:hover { border-color: #c18aff; transform: translateY(-2px); }
        .toolcard .emoji { font-size: 30px; }
        .toolcard h3 { margin: 12px 0 6px; }
        .toolcard p { color: #a69bb8; font-size: 12px; line-height: 1.6; }

        footer {
          text-align: center; color: #71677f;
          font-size: 12px; padding: 35px 0 12px;
        }

        @media(max-width:800px) {
          .grid { grid-template-columns: 1fr; }
        }

        @media(max-width:500px) {
          .studio { padding: 14px; }
          .panel { padding: 16px; }
          .stats { gap: 7px; }
          .stat { padding: 12px 5px; }
          .stat strong { font-size: 17px; }
          .stat span { font-size: 10px; }
          .toolcards { grid-template-columns: 1fr; }
          .hero { padding-top: 32px; }
        }
      `}</style>

      <div className="shell">
        <nav className="topbar">
          <div className="brand">
            GETYOUR<span>THUMBNAIL</span>
          </div>

          <div className="nav">
            <button
              className={activeTab === "studio" ? "active" : ""}
              onClick={() => setActiveTab("studio")}
            >
              ✦ Thumbnail Studio
            </button>

            <button onClick={() => (window.location.href = "/enhancer")}>
              ✨ Image Enhancer
            </button>
          </div>
        </nav>

        <header className="hero">
          <span className="eyebrow">AI CREATIVE STUDIO</span>

          <h1>
            Turn Videos Into
            <br />
            <span className="gradient">Click-Worthy Thumbnails</span>
          </h1>

          <p>
            Your creative workspace for AI-powered video analysis,
            thumbnail concepts and image enhancement.
          </p>
        </header>

        <div className="stats">
          <div className="stat">
            <strong>AI</strong>
            <span>VIDEO ANALYSIS</span>
          </div>
          <div className="stat">
            <strong>04</strong>
            <span>THUMBNAIL CONCEPTS</span>
          </div>
          <div className="stat">
            <strong>HD</strong>
            <span>IMAGE WORKSPACE</span>
          </div>
        </div>

        <div className="grid">
          <section className="panel">
            <h2>01 / Video Workspace</h2>
            <p className="muted">
              Upload your video and let AI discover its best thumbnail moments.
            </p>

            <div
              className="upload"
              onClick={() => fileRef.current?.click()}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                uploadVideo(event.dataTransfer.files[0]);
              }}
            >
              <div className="emoji">🎬</div>
              <strong>Drop your video here</strong>
              <p className="muted">Or click to browse your files</p>
              <p className="muted">MP4 and supported video formats</p>

              <input
                ref={fileRef}
                hidden
                type="file"
                accept="video/*"
                onChange={(event) => uploadVideo(event.target.files?.[0])}
              />
            </div>

            {videoUrl && (
              <>
                <video className="video" src={videoUrl} controls playsInline />
                <p className="muted">{video?.name}</p>
              </>
            )}

            <label className="muted" htmlFor="description">
              VIDEO DESCRIPTION / CREATIVE DIRECTION
            </label>

            <textarea
              id="description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Describe your video, its characters, action or thumbnail idea..."
            />

            <button
              className="primary"
              onClick={analyzeVideo}
              disabled={!video || loading}
            >
              {loading ? "◌ ANALYZING VIDEO..." : "✦ ANALYZE VIDEO WITH AI"}
            </button>

            {message && <div className="message">{message}</div>}
          </section>

          <section className="panel">
            <h2>02 / Creative Concepts</h2>
            <p className="muted">
              Generate thumbnail ideas and turn your favourite concept into an image.
            </p>

            {concepts.length === 0 ? (
              <div className="empty">
                <div className="emoji">✧</div>
                <h3>Your creative ideas appear here</h3>
                <p className="muted">
                  Upload a video and start AI analysis to see your concepts.
                </p>
              </div>
            ) : (
              concepts.map((concept, index) => (
                <article className="concept" key={index}>
                  <h3>
                    <span className="gradient">
                      CONCEPT 0{index + 1}
                    </span>{" "}
                    · {concept.title}
                  </h3>

                  <p>{concept.description}</p>

                  {concept.imageUrl && (
                    <img src={concept.imageUrl} alt={concept.title} />
                  )}

                  <button
                    onClick={() => generateThumbnail(index)}
                    disabled={generating !== null}
                  >
                    {generating === index
                      ? "GENERATING IMAGE..."
                      : concept.imageUrl
                        ? "REGENERATE THUMBNAIL"
                        : "✦ GENERATE THUMBNAIL"}
                  </button>

                  {concept.imageUrl && (
                    <button
                      style={{ marginTop: 9 }}
                      onClick={() => downloadImage(concept.imageUrl!, index)}
                    >
                      ↓ DOWNLOAD IMAGE
                    </button>
                  )}
                </article>
              ))
            )}
          </section>
        </div>

        <section style={{ marginTop: 32 }}>
          <h2 className="gradient">03 / Creative Tools</h2>
          <p className="muted">
            Choose the tool you want to work with.
          </p>

          <div className="toolcards">
            <a className="toolcard" href="#top">
              <div className="emoji">🎨</div>
              <h3>AI Thumbnail Studio</h3>
              <p>
                Analyze video scenes, explore four creative concepts,
                generate thumbnail images and download your results.
              </p>
              <span className="gradient">OPEN STUDIO →</span>
            </a>

            <a className="toolcard" href="/enhancer">
              <div className="emoji">✨</div>
              <h3>AI Image Enhancer</h3>
              <p>
                Upload an image, enhance it with AI, adjust brightness,
                contrast and saturation, compare and download.
              </p>
              <span className="gradient">OPEN ENHANCER →</span>
            </a>
          </div>
        </section>

        <footer>
          GETYOURTHUMBNAIL · YOUR AI CREATIVE WORKSPACE
        </footer>
      </div>
    </main>
  );
}
  
