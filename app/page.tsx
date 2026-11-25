"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";

type Caption = {
  start: number;
  end: number;
  text: string;
};

type Concept = {
  title: string;
  description: string;
  prompt: string;
  emotion?: string;
  color_style?: string;
};

async function readApiResponse(response: Response) {
  const text = await response.text();

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      text.slice(0, 250) || "Server returned an invalid response."
    );
  }
}

function downloadText(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);
}

function formatSrtTime(seconds: number) {
  const safe = Math.max(0, seconds);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = Math.floor(safe % 60);
  const milliseconds = Math.floor((safe % 1) * 1000);

  return (
    String(hours).padStart(2, "0") +
    ":" +
    String(minutes).padStart(2, "0") +
    ":" +
    String(secs).padStart(2, "0") +
    "," +
    String(milliseconds).padStart(3, "0")
  );
}

export default function Home() {
  const [active, setActive] = useState("Dashboard");
  const [dark, setDark] = useState(true);

  const [thumbFile, setThumbFile] = useState<File | null>(null);
  const [thumbDescription, setThumbDescription] = useState("");
  const [thumbLoading, setThumbLoading] = useState(false);
  const [thumbStatus, setThumbStatus] = useState("");
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [selectedConcept, setSelectedConcept] = useState<number>(0);
  const [generatedImage, setGeneratedImage] = useState("");

  const [captionFile, setCaptionFile] = useState<File | null>(null);
  const [captionLanguage, setCaptionLanguage] = useState("Hindi");
  const [captionLoading, setCaptionLoading] = useState(false);
  const [captionStatus, setCaptionStatus] = useState("");
  const [captions, setCaptions] = useState<Caption[]>([]);

  const [message, setMessage] = useState("");

  useEffect(() => {
    return () => {
      if (generatedImage.startsWith("blob:")) {
        URL.revokeObjectURL(generatedImage);
      }
    };
  }, [generatedImage]);

  function chooseThumbVideo(file?: File) {
    if (!file) return;

    if (!file.type.startsWith("video/")) {
      setThumbStatus("Please select a valid video file.");
      return;
    }

    setThumbFile(file);
    setConcepts([]);
    setGeneratedImage("");
    setThumbStatus("Video selected. Ready for analysis.");
  }

  function chooseCaptionVideo(file?: File) {
    if (!file) return;

    if (!file.type.startsWith("video/")) {
      setCaptionStatus("Please select a valid video file.");
      return;
    }

    if (file.size > 4 * 1024 * 1024) {
      setCaptionStatus("Video must be smaller than 4 MB.");
      return;
    }

    setCaptionFile(file);
    setCaptions([]);
    setCaptionStatus("Video selected. Ready for captions.");
  }

  async function extractFrames(file: File): Promise<string[]> {
    const video = document.createElement("video");
    const objectUrl = URL.createObjectURL(file);

    video.preload = "metadata";
    video.muted = true;
    video.src = objectUrl;

    try {
      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => resolve();
        video.onerror = () => reject(new Error("Could not read this video."));
      });

      const duration = video.duration;

      if (!Number.isFinite(duration) || duration <= 0) {
        throw new Error("Video duration could not be detected.");
      }

      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");

      if (!context) {
        throw new Error("Your browser could not prepare video frames.");
      }

      const count = Math.min(6, Math.max(2, Math.ceil(duration / 10)));
      const frames: string[] = [];

      for (let i = 0; i < count; i++) {
        const time = Math.min(
          Math.max(0, duration * ((i + 1) / (count + 1))),
          Math.max(0, duration - 0.1)
        );

        await new Promise<void>((resolve, reject) => {
          video.onseeked = () => resolve();
          video.onerror = () => reject(new Error("Could not read video frame."));
          video.currentTime = time;
        });

        const scale = Math.min(1, 640 / video.videoWidth);
        canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
        canvas.height = Math.max(1, Math.round(video.videoHeight * scale));

        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        frames.push(canvas.toDataURL("image/jpeg", 0.65));
      }

      const totalSize = frames.reduce(
        (total, frame) => total + frame.length,
        0
      );

      if (totalSize > 3500000) {
        throw new Error("Video frames are too large. Try a shorter video.");
      }

      return frames;
    } finally {
      URL.revokeObjectURL(objectUrl);
      video.removeAttribute("src");
      video.load();
    }
  }

  async function analyzeVideo() {
    if (!thumbFile) return;

    setThumbLoading(true);
    setThumbStatus("Preparing video frames...");
    setConcepts([]);
    setGeneratedImage("");

    try {
      const frames = await extractFrames(thumbFile);

      setThumbStatus("AI is analyzing your video...");

      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: thumbDescription,
          frames,
        }),
      });

      const data = await readApiResponse(response);

      if (!response.ok || !data.success) {
        throw new Error(data.error || data.message || "Video analysis failed.");
      }

      if (!Array.isArray(data.concepts) || data.concepts.length === 0) {
        throw new Error("AI did not return any thumbnail concepts.");
      }

      setConcepts(data.concepts);
      setSelectedConcept(0);
      setThumbStatus("Analysis complete. Choose a thumbnail concept below.");
    } catch (error) {
      setThumbStatus(
        error instanceof Error ? error.message : "Something went wrong."
      );
    } finally {
      setThumbLoading(false);
    }
  }

  async function generateThumbnail() {
    const concept = concepts[selectedConcept];

    if (!concept) return;

    setThumbLoading(true);
    setThumbStatus("Generating your thumbnail...");

    try {
      const response = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: concept.prompt,
          description: thumbDescription,
        }),
      });

      const data = await readApiResponse(response);

      if (!response.ok || !data.success) {
        throw new Error(data.error || data.message || "Image generation failed.");
      }

      const image = data.imageUrl || data.image;

      if (!image) {
        throw new Error("The server did not return an image.");
      }

      setGeneratedImage(image);
      setThumbStatus("Your thumbnail is ready!");
    } catch (error) {
      setThumbStatus(
        error instanceof Error ? error.message : "Something went wrong."
      );
    } finally {
      setThumbLoading(false);
    }
  }

  async function generateCaptions() {
    if (!captionFile) return;

    setCaptionLoading(true);
    setCaptionStatus("Uploading video for transcription...");

    try {
      const formData = new FormData();
      formData.append("video", captionFile);
      formData.append("language", captionLanguage);

      const response = await fetch("/api/captions", {
        method: "POST",
        body: formData,
      });

      const data = await readApiResponse(response);

      if (!response.ok) {
        throw new Error(data.error || "Caption generation failed.");
      }

      if (!Array.isArray(data.captions)) {
        throw new Error("The server returned an invalid captions format.");
      }

      setCaptions(data.captions);
      setCaptionStatus("Captions generated successfully.");
    } catch (error) {
      setCaptionStatus(
        error instanceof Error ? error.message : "Something went wrong."
      );
    } finally {
      setCaptionLoading(false);
    }
  }

  function exportSrt() {
    const content = captions
      .map(
        (caption, index) =>
          `${index + 1}\n${formatSrtTime(caption.start)} --> ${formatSrtTime(
            caption.end
          )}\n${caption.text}\n`
      )
      .join("\n");

    downloadText("getyourthumbnail-captions.srt", content);
  }

  function exportVtt() {
    const content =
      "WEBVTT\n\n" +
      captions
        .map(
          (caption) =>
            `${formatSrtTime(caption.start).replace(",", ".")} --> ${formatSrtTime(
              caption.end
            ).replace(",", ".")}\n${caption.text}\n`
        )
        .join("\n");

    downloadText("getyourthumbnail-captions.vtt", content);
  }

  function downloadThumbnail() {
    if (!generatedImage) return;

    const link = document.createElement("a");
    link.href = generatedImage;
    link.download = "getyourthumbnail.jpg";
    link.click();
  }

  return (
    <main className={dark ? "app dark" : "app light"}>
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-icon">✦</span>
          <span>GetYour<span className="brand-highlight">Thumbnail</span></span>
        </div>

        <p className="nav-label">WORKSPACE</p>

        {["Dashboard", "Thumbnail Studio", "AI Caption Studio"].map((item) => (
          <button
            key={item}
            className={`nav-item ${active === item ? "selected" : ""}`}
            onClick={() => setActive(item)}
          >
            <span>{item === "Dashboard" ? "⌂" : item === "Thumbnail Studio" ? "✦" : "CC"}</span>
            {item}
          </button>
        ))}

        <p className="nav-label">YOUR LIBRARY</p>

        {["My Projects", "Download History", "Favorites"].map((item) => (
          <button
            key={item}
            className={`nav-item ${active === item ? "selected" : ""}`}
            onClick={() => setActive(item)}
          >
            <span>◈</span>
            {item}
          </button>
        ))}

        <div className="sidebar-bottom">
          <button
            className={`nav-item ${active === "Settings" ? "selected" : ""}`}
            onClick={() => setActive("Settings")}
          >
            <span>⚙</span>
            Settings
          </button>
          <div className="sidebar-note">
            <span className="online-dot" /> Creator workspace
            <small>Make something extraordinary.</small>
          </div>
        </div>
      </aside>

      <section className="main-area">
        <header className="topbar">
          <div className="breadcrumb">Workspace <span>/</span> {active}</div>
          <div className="top-actions">
            <span className="online-label">● All systems ready</span>
            <button className="theme-button" onClick={() => setDark(!dark)}>
              {dark ? "☀ Light" : "☾ Dark"}
            </button>
          </div>
        </header>

        {active === "Dashboard" && (
          <div className="page">
            <section className="hero">
              <div>
                <span className="eyebrow">YOUR CREATIVE COMMAND CENTER</span>
                <h1>Make something<br /><em>extraordinary.</em></h1>
                <p>Your ideas deserve content that gets noticed.</p>
                <button className="primary hero-button" onClick={() => setActive("Thumbnail Studio")}>
                  ✦ Create a thumbnail →
                </button>
              </div>
              <div className="hero-art">
                <div className="orbit orbit-a" />
                <div className="orbit orbit-b" />
                <div className="hero-gem">✦</div>
                <i>✧</i>
              </div>
            </section>

            <div className="stats">
              <div className="stat"><span>✦</span><small>AI TOOLS</small><strong>03</strong><p>Creative workspaces</p></div>
              <div className="stat"><span>CC</span><small>CAPTION STUDIO</small><strong>Ready</strong><p>Automatic subtitles</p></div>
              <div className="stat"><span>◈</span><small>IMAGE ENHANCER</small><strong>Ready</strong><p>Browser-based enhancement</p></div>
              <div className="stat"><span>◉</span><small>WORKSPACE</small><strong className="active-text">Active</strong><p>Ready to create</p></div>
            </div>

            <div className="section-title">
              <div><h2>Creative workspace</h2><p>Choose a tool to start creating.</p></div>
            </div>

            <div className="tools">
              <button className="tool" onClick={() => setActive("Thumbnail Studio")}>
                <span className="tool-icon purple">✦</span>
                <h3>Thumbnail Studio</h3>
                <p>Analyze your video and generate thumbnail concepts with AI.</p>
                <b>Open studio →</b>
              </button>
              <Link className="tool" href="/enhancer">
                <span className="tool-icon blue">◈</span>
                <h3>Image Enhancer</h3>
                <p>Improve image quality and resolution in your browser.</p>
                <b>Open enhancer →</b>
              </Link>
              <button className="tool" onClick={() => setActive("AI Caption Studio")}>
                <span className="tool-icon pink">CC</span>
                <h3>AI Caption Studio</h3>
                <p>Transcribe speech and export editable subtitle files.</p>
                <b>Open caption studio →</b>
              </button>
            </div>

            <section className="seo-section">
              <span className="eyebrow">GETYOURTHUMBNAIL</span>
              <h2>AI tools for your creator workflow</h2>
              <p>GetYourThumbnail brings video-based thumbnail ideas, AI-assisted image creation, subtitle transcription and image enhancement into one simple creator workspace. Upload content you have the right to use, review AI results, and download your outputs.</p>
              <div className="seo-grid">
                <article><h3>AI Thumbnail Concepts</h3><p>Analyze selected video frames and explore creative thumbnail directions.</p></article>
                <article><h3>Subtitle Export</h3><p>Generate speech captions and export SRT or VTT subtitle files.</p></article>
                <article><h3>Image Enhancement</h3><p>Open the image enhancer to process supported images on your device.</p></article>
              </div>
            </section>
          </div>
        )}
                        {active === "Thumbnail Studio" && (
          <div className="page">
            <div className="heading">
              <div>
                <span className="eyebrow">AI CREATIVE WORKSPACE</span>
                <h1>Thumbnail Studio <em>✦</em></h1>
                <p>Analyze your video, choose a creative direction and generate a thumbnail.</p>
              </div>
              <span className="ready">● AI WORKFLOW</span>
            </div>

            <div className="studio-grid">
              <section className="panel">
                <div className="panel-heading">
                  <b>01</b>
                  <div><h3>Upload your video</h3><p>We sample a few frames in your browser for analysis.</p></div>
                </div>

                <label className="dropzone">
                  <input type="file" accept="video/*" onChange={(e) => chooseThumbVideo(e.target.files?.[0])} />
                  <span className="upload-symbol">↑</span>
                  <strong>{thumbFile ? thumbFile.name : "Choose a video"}</strong>
                  <small>MP4 · MOV · WEBM</small>
                  <small>Frame analysis happens in your browser.</small>
                </label>

                <label className="field-label">Video context (optional)</label>
                <textarea
                  className="text-field"
                  rows={4}
                  value={thumbDescription}
                  onChange={(e) => setThumbDescription(e.target.value)}
                  placeholder="Describe the video topic, main subject, game, mood or important moment..."
                />

                <button className="primary full" disabled={!thumbFile || thumbLoading} onClick={analyzeVideo}>
                  {thumbLoading ? "✦ Working..." : "✦ Analyze video & create concepts"}
                </button>

                {thumbStatus && <div className="status">{thumbStatus}</div>}
              </section>

              <section className="panel">
                <div className="panel-heading">
                  <b>02</b>
                  <div><h3>Choose your concept</h3><p>Select the creative direction you like.</p></div>
                </div>

                {concepts.length === 0 ? (
                  <div className="empty-state">
                    <span>✧</span>
                    <h3>Your concepts will appear here</h3>
                    <p>Upload a video and start the AI analysis.</p>
                  </div>
                ) : (
                  <div className="concept-list">
                    {concepts.map((concept, index) => (
                      <button
                        key={index}
                        className={`concept ${selectedConcept === index ? "concept-active" : ""}`}
                        onClick={() => setSelectedConcept(index)}
                      >
                        <span className="concept-number">0{index + 1}</span>
                        <span className="concept-copy">
                          <strong>{concept.title}</strong>
                          <small>{concept.description}</small>
                        </span>
                        <span className="concept-check">{selectedConcept === index ? "✓" : "○"}</span>
                      </button>
                    ))}
                  </div>
                )}

                <button
                  className="primary full"
                  disabled={concepts.length === 0 || thumbLoading}
                  onClick={generateThumbnail}
                >
                  ✦ Generate thumbnail
                </button>
              </section>
            </div>

            {generatedImage && (
              <section className="panel result-panel">
                <div className="panel-heading">
                  <b>03</b>
                  <div><h3>Your generated thumbnail</h3><p>Review and download your result.</p></div>
                </div>
                <img className="generated-image" src={generatedImage} alt="Generated YouTube thumbnail" />
                <button className="primary" onClick={downloadThumbnail}>↓ Download thumbnail</button>
              </section>
            )}
          </div>
        )}

        {active === "AI Caption Studio" && (
          <div className="page">
            <div className="heading">
              <div>
                <span className="eyebrow">VIDEO SUBTITLE WORKSPACE</span>
                <h1>AI Caption Studio <em>CC</em></h1>
                <p>Transcribe your video and export editable subtitle files.</p>
              </div>
              <span className="ready">● CAPTION WORKFLOW</span>
            </div>

            <section className="panel caption-panel">
              <div className="panel-heading">
                <b>01</b>
                <div><h3>Upload your video</h3><p>Choose a video up to 4 MB for transcription.</p></div>
              </div>

              <label className="dropzone">
                <input type="file" accept="video/*" onChange={(e) => chooseCaptionVideo(e.target.files?.[0])} />
                <span className="upload-symbol">↑</span>
                <strong>{captionFile ? captionFile.name : "Choose a video"}</strong>
                <small>Maximum file size: 4 MB</small>
              </label>

              <label className="field-label" htmlFor="caption-language">Caption language</label>
              <select
                id="caption-language"
                className="text-field"
                value={captionLanguage}
                onChange={(e) => setCaptionLanguage(e.target.value)}
              >
                <option>Hindi</option>
                <option>English</option>
                <option>Hinglish</option>
                <option>Spanish</option>
                <option>French</option>
                <option>German</option>
              </select>

              <button className="primary full" disabled={!captionFile || captionLoading} onClick={generateCaptions}>
                {captionLoading ? "✦ Generating captions..." : "✦ Generate captions"}
              </button>

              {captionStatus && <div className="status">{captionStatus}</div>}
            </section>

            {captions.length > 0 && (
              <section className="panel caption-results">
                <div className="section-title">
                  <div><h2>Your captions</h2><p>Edit the text before exporting.</p></div>
                </div>

                {captions.map((caption, index) => (
                  <div className="caption-row" key={index}>
                    <div className="caption-time">
                      {caption.start.toFixed(2)}s – {caption.end.toFixed(2)}s
                    </div>
                    <textarea
                      className="text-field caption-edit"
                      value={caption.text}
                      onChange={(e) => {
                        setCaptions((previous) =>
                          previous.map((item, i) =>
                            i === index ? { ...item, text: e.target.value } : item
                          )
                        );
                      }}
                    />
                  </div>
                ))}

                <div className="export-actions">
                  <button className="primary" onClick={exportSrt}>↓ Export SRT</button>
                  <button className="secondary" onClick={exportVtt}>↓ Export VTT</button>
                </div>
                <p className="small-note">These files contain subtitles. This version does not burn captions directly into the MP4 video.</p>
              </section>
            )}
          </div>
        )}

        {["My Projects", "Download History", "Favorites", "Settings"].includes(active) && (
          <div className="page">
            <div className="heading">
              <div>
                <span className="eyebrow">YOUR WORKSPACE</span>
                <h1>{active}</h1>
                <p>Manage your creative workspace.</p>
              </div>
            </div>

            <section className="panel empty-state">
              <span>◈</span>
              <h2>{active}</h2>
              <p>Cloud storage and saved project history are not connected in this version.</p>
              <p>Your generated files can be downloaded directly to your device.</p>
              <button className="primary" onClick={() => setActive("Dashboard")}>Back to Dashboard</button>
            </section>
          </div>
        )}

        <footer className="footer">
          <span>© 2026 GetYourThumbnail</span>
          <span>Built for creators ✦</span>
        </footer>
      </section>

      <style jsx global>{`
        * { box-sizing: border-box; }
        body { margin: 0; }
        button, input, textarea, select { font: inherit; }
        button { cursor: pointer; }

        .app {
          --bg: #0b0914;
          --panel: #151122;
          --panel2: #1c172c;
          --text: #f5f1ff;
          --muted: #a39bb7;
          --line: #302741;
          --purple: #a66bff;
          --blue: #62a9ff;
          min-height: 100vh;
          display: flex;
          background: var(--bg);
          color: var(--text);
          font-family: Arial, Helvetica, sans-serif;
        }

        .app.light {
          --bg: #f5f2fa;
          --panel: #ffffff;
          --panel2: #eee8f7;
          --text: #211832;
          --muted: #70677f;
          --line: #ded5e9;
        }

        .sidebar {
          width: 250px;
          min-width: 250px;
          min-height: 100vh;
          padding: 25px 16px;
          background: var(--panel);
          border-right: 1px solid var(--line);
          display: flex;
          flex-direction: column;
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 17px;
          font-weight: 800;
          margin: 4px 8px 48px;
        }

        .brand-icon {
          width: 34px;
          height: 34px;
          display: grid;
          place-items: center;
          border-radius: 10px;
          background: linear-gradient(135deg, #a66bff, #6337d9);
          color: white;
          font-size: 20px;
        }

        .brand-highlight { color: var(--purple); }
        .nav-label { color: var(--muted); font-size: 10px; letter-spacing: 1.5px; margin: 20px 10px 10px; }
        .nav-item {
          border: 0;
          width: 100%;
          display: flex;
          align-items: center;
          gap: 13px;
          text-align: left;
          padding: 12px;
          margin: 3px 0;
          border-radius: 9px;
          background: transparent;
          color: var(--muted);
          font-size: 13px;
        }

        .nav-item span { width: 20px; text-align: center; }
        .nav-item:hover, .nav-item.selected { background: #33234d; color: white; }
        .sidebar-bottom { margin-top: auto; }
        .sidebar-note { margin: 20px 4px 0; padding: 14px; border: 1px solid var(--line); border-radius: 12px; color: var(--muted); font-size: 11px; }
        .sidebar-note small { display: block; margin-top: 8px; }
        .online-dot { display: inline-block; width: 7px; height: 7px; background: #49d99b; border-radius: 50%; margin-right: 6px; }

        .main-area { flex: 1; min-width: 0; }
        .topbar {
          height: 68px;
          padding: 0 35px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid var(--line);
          background: var(--panel);
        }

        .breadcrumb { color: var(--muted); font-size: 12px; }
        .breadcrumb span { margin: 0 10px; }
        .top-actions { display: flex; align-items: center; gap: 18px; }
        .online-label { color: #54d9a0; font-size: 11px; }
        .theme-button, .secondary {
          background: var(--panel2);
          color: var(--text);
          border: 1px solid var(--line);
          padding: 9px 13px;
          border-radius: 8px;
          font-size: 12px;
        }

        .page { max-width: 1400px; margin: auto; padding: 38px 40px 50px; }
        .hero {
          min-height: 270px;
          padding: 38px 45px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          overflow: hidden;
          border: 1px solid #493467;
          border-radius: 18px;
          background: radial-gradient(ellipse at 80% 50%, #46266f 0%, #211534 42%, #171123 100%);
        }

        .eyebrow { color: #bd8aff; font-size: 10px; letter-spacing: 2px; font-weight: 700; }
        .hero h1, .heading h1 { font-size: clamp(30px, 4vw, 46px); line-height: 1.12; margin: 15px 0 10px; letter-spacing: -1.5px; }
        .hero h1 em, .heading h1 em { color: #b98aff; font-style: normal; }
        .hero p, .heading p { color: #b7adc9; font-size: 13px; line-height: 1.7; }
        .primary {
          border: 0;
          border-radius: 9px;
          padding: 13px 19px;
          color: white;
          font-size: 12px;
          font-weight: 700;
          background: linear-gradient(110deg, #a15cf4, #6842df);
          box-shadow: 0 7px 22px #713bc833;
        }

        .primary:hover { filter: brightness(1.12); }
        .primary:disabled { opacity: .45; cursor: not-allowed; }
        .hero-button { margin-top: 14px; }
        .hero-art { width: 240px; height: 190px; position: relative; display: grid; place-items: center; }
        .orbit { position: absolute; border: 1px solid #b98aff55; border-radius: 50%; transform: rotate(-25deg); }
        .orbit-a { width: 210px; height: 90px; }
        .orbit-b { width: 150px; height: 180px; transform: rotate(45deg); }
        .hero-gem { width: 85px; height: 85px; display: grid; place-items: center; border-radius: 25px; transform: rotate(45deg); background: linear-gradient(135deg, #d6aaff, #7135d6); box-shadow: 0 0 65px #a66bff88; color: white; font-size: 42px; }
        .hero-art i { position: absolute; right: 20px; top: 10px; color: #e1c4ff; font-size: 30px; }

        .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin: 24px 0 35px; }
        .stat, .panel, .tool { background: var(--panel); border: 1px solid var(--line); border-radius: 13px; }
        .stat { padding: 18px; }
        .stat span { color: #b98aff; font-size: 17px; }
        .stat small { display: block; color: var(--muted); font-size: 9px; letter-spacing: 1px; margin-top: 12px; }
        .stat strong { display: block; font-size: 22px; margin-top: 5px; }
        .stat p { color: var(--muted); font-size: 11px; margin-bottom: 0; }
        .active-text { color: #54d9a0; }

        .section-title { display: flex; justify-content: space-between; align-items: center; margin: 28px 0 16px; }
        .section-title h2 { font-size: 19px; margin: 0 0 6px; }
        .section-title p { color: var(--muted); font-size: 12px; margin: 0; }
        .tools { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; }
        .tool { display: block; text-align: left; text-decoration: none; color: var(--text); padding: 22px; min-height: 195px; transition: .2s; }
        .tool:hover { border-color: #9a65e8; transform: translateY(-3px); }
        .tool-icon { width: 39px; height: 39px; display: grid; place-items: center; border-radius: 11px; font-weight: 800; }
        .purple { background: #633b8d; color: #e5c7ff; }
        .blue { background: #244d78; color: #a7d5ff; }
        .pink { background: #713b70; color: #ffc4ed; }
        .tool h3 { font-size: 15px; margin: 16px 0 8px; }
        .tool p { color: var(--muted); font-size: 11px; line-height: 1.6; min-height: 35px; }
        .tool b { display: block; color: #bd8aff; font-size: 11px; margin-top: 14px; }

        .seo-section { margin-top: 40px; padding: 27px; border: 1px solid var(--line); border-radius: 14px; background: var(--panel); }
        .seo-section h2 { font-size: 21px; margin: 12px 0; }
        .seo-section > p, .seo-grid p { color: var(--muted); font-size: 12px; line-height: 1.8; }
        .seo-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-top: 22px; }
        .seo-grid h3 { font-size: 13px; }

        .heading { display: flex; justify-content: space-between; align-items: center; gap: 20px; margin-bottom: 28px; }
        .heading h1 { font-size: 34px; }
        .ready { color: #55dba0; font-size: 10px; white-space: nowrap; }
        .studio-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; }
        .panel { padding: 24px; min-width: 0; }
        .panel-heading { display: flex; gap: 13px; align-items: flex-start; margin-bottom: 20px; }
        .panel-heading > b { color: #bd8aff; font-size: 13px; }
        .panel-heading h3 { margin: 0 0 6px; font-size: 15px; }
        .panel-heading p { color: var(--muted); margin: 0; font-size: 11px; line-height: 1.5; }

        .dropzone {
          min-height: 155px;
          border: 1px dashed #725493;
          border-radius: 12px;
          background: var(--panel2);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 9px;
          text-align: center;
          cursor: pointer;
          padding: 18px;
          overflow-wrap: anywhere;
        }

        .dropzone input { display: none; }
        .upload-symbol { width: 36px; height: 36px; border-radius: 50%; display: grid; place-items: center; background: #593783; color: white; font-size: 22px; }
        .dropzone strong { font-size: 12px; }
        .dropzone small { color: var(--muted); font-size: 10px; }
        .field-label { display: block; margin: 19px 0 8px; color: var(--muted); font-size: 11px; }
        .text-field { display: block; width: 100%; padding: 12px; color: var(--text); background: var(--panel2); border: 1px solid var(--line); border-radius: 8px; outline: none; font-size: 12px; resize: vertical; }
        .text-field:focus { border-color: #a66bff; }
        .full { width: 100%; margin-top: 15px; }
        .status { margin-top: 14px; padding: 11px; border-radius: 8px; background: var(--panel2); color: #c8a6ff; font-size: 11px; line-height: 1.6; overflow-wrap: anywhere; }

        .empty-state { min-height: 230px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
        .empty-state > span { color: #bd8aff; font-size: 35px; }
        .empty-state h3, .empty-state h2 { font-size: 16px; }
        .empty-state p { color: var(--muted); font-size: 12px; line-height: 1.7; }
        .concept-list { display: grid; gap: 9px; margin-bottom: 15px; }
        .concept { display: flex; gap: 12px; align-items: center; width: 100%; text-align: left; padding: 13px; border-radius: 9px; border: 1px solid var(--line); background: var(--panel2); color: var(--text); }
        .concept-active { border-color: #a66bff; background: #38244f; }
        .concept-number { color: #bd8aff; font-size: 12px; }
        .concept-copy { flex: 1; min-width: 0; }
        .concept-copy strong, .concept-copy small { display: block; }
        .concept-copy strong { font-size: 12px; }
        .concept-copy small { color: var(--muted); font-size: 10px; line-height: 1.5; margin-top: 5px; }
        .concept-check { color: #bd8aff; }
        .result-panel { margin-top: 20px; }
        .generated-image { display: block; width: 100%; max-width: 850px; aspect-ratio: 16 / 9; object-fit: contain; background: #08070d; border-radius: 10px; margin-bottom: 18px; }

        .caption-panel { max-width: 760px; }
        .caption-results { margin-top: 20px; }
        .caption-row { display: grid; grid-template-columns: 130px 1fr; gap: 12px; align-items: start; margin: 12px 0; }
        .caption-time { color: #bd8aff; font-size: 10px; padding-top: 12px; }
        .caption-edit { min-height: 50px; }
        .export-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 20px; }
        .small-note { color: var(--muted); font-size: 10px; line-height: 1.6; margin-top: 16px; }
        .footer { padding: 20px 40px; display: flex; justify-content: space-between; color: var(--muted); border-top: 1px solid var(--line); font-size: 10px; }

        @media (max-width: 950px) {
          .sidebar { width: 210px; min-width: 210px; }
          .page { padding: 28px 22px; }
          .stats { grid-template-columns: repeat(2, 1fr); }
          .tools { grid-template-columns: 1fr 1fr; }
          .studio-grid { grid-template-columns: 1fr; }
        }

        @media (max-width: 650px) {
          .app { display: block; }
          .sidebar { width: 100%; min-width: 0; min-height: auto; padding: 12px; border-right: 0; border-bottom: 1px solid var(--line); }
          .brand { margin: 3px 6px 12px; }
          .nav-label, .sidebar-bottom, .sidebar-note { display: none; }
          .sidebar > .nav-item { display: inline-flex; width: auto; margin: 2px; padding: 9px; font-size: 10px; }
          .topbar { height: auto; min-height: 55px; padding: 10px 14px; gap: 10px; }
          .online-label { display: none; }
          .page { padding: 20px 14px 30px; }
          .hero { padding: 25px 20px; min-height: 230px; }
          .hero-art { width: 100px; transform: scale(.7); margin-right: -20px; }
          .hero h1 { font-size: 30px; }
          .stats { gap: 9px; margin: 15px 0 25px; }
          .stat { padding: 13px; }
          .tools, .seo-grid { grid-template-columns: 1fr; }
          .heading { align-items: flex-start; flex-direction: column; }
          .heading h1 { font-size: 29px; }
          .panel { padding: 17px; }
          .caption-row { grid-template-columns: 1fr; gap: 5px; }
          .footer { padding: 16px; }
        }
      `}</style>
    </main>
  );
}
