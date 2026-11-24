
"use client";

import React, { useRef, useState } from "react";
import Link from "next/link";

type Concept = {
  title: string;
  description: string;
  prompt: string;
};

type Project = {
  id: number;
  title: string;
  image: string;
};

export default function Home() {
  const [active, setActive] = useState("Dashboard");
  const [dark, setDark] = useState(true);
  const [video, setVideo] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [description, setDescription] = useState("");
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [generated, setGenerated] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);

  const menu = [
    ["Dashboard", "⌂"],
    ["Thumbnail Studio", "✦"],
    ["My Projects", "▣"],
    ["Download History", "↓"],
    ["Favorites", "♡"],
    ["Settings", "⚙"],
  ];

  function selectVideo(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("video/")) {
      setStatus("Please select a video file.");
      return;
    }
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    setVideo(file);
    setVideoUrl(URL.createObjectURL(file));
    setConcepts([]);
    setGenerated("");
    setStatus("Video uploaded. Ready for analysis.");
  }

  async function captureFrames(): Promise<string[]> {
    const element = videoRef.current;
    if (!element) throw new Error("Video preview is not ready.");

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not process video.");

    canvas.width = 640;
    canvas.height = 360;

    if (!Number.isFinite(element.duration) || element.duration <= 0) {
      throw new Error("Could not read video duration.");
    }

    const times = [
      Math.min(1, element.duration * 0.15),
      element.duration * 0.5,
      Math.max(0, element.duration - 0.5),
    ];
    const frames: string[] = [];

    for (const time of times) {
      await new Promise<void>((resolve, reject) => {
        const timeout = window.setTimeout(() => {
          element.removeEventListener("seeked", onSeeked);
          reject(new Error("Video frame capture timed out."));
        }, 10000);

        const onSeeked = () => {
          window.clearTimeout(timeout);
          try {
            ctx.drawImage(element, 0, 0, canvas.width, canvas.height);
            frames.push(canvas.toDataURL("image/jpeg", 0.75));
            resolve();
          } catch {
            reject(new Error("Unable to capture video frame."));
          }
        };

        element.addEventListener("seeked", onSeeked, { once: true });
        try {
          element.currentTime = time;
        } catch {
          window.clearTimeout(timeout);
          element.removeEventListener("seeked", onSeeked);
          reject(new Error("Unable to read this video file."));
        }
      });
    }
    return frames;
  }

  async function analyzeVideo() {
    if (!video) {
      setStatus("Upload a video first.");
      return;
    }
    setLoading(true);
    setStatus("Analyzing video...");
    setConcepts([]);
    setGenerated("");

    try {
      const frames = await captureFrames();
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: description || "Create attractive YouTube thumbnail concepts.",
          frames,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Video analysis failed.");

      const result = data.concepts || data.result?.concepts || data.result;
      if (!Array.isArray(result) || result.length === 0) {
        throw new Error("AI did not return concepts. Please try again.");
      }

      const items: Concept[] = result.map((item: any, index: number) => ({
        title: item.title || `Concept ${index + 1}`,
        description: item.description || item.summary || "",
        prompt: item.prompt || item.imagePrompt || item.description || "",
      }));
      setConcepts(items);
      setSelected(0);
      setActive("Thumbnail Studio");
      setStatus("Analysis complete. Choose a concept.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Analysis failed.");
    } finally {
      setLoading(false);
    }
  }

  async function generateThumbnail(index: number) {
    const concept = concepts[index];
    if (!concept) return;
    setSelected(index);
    setLoading(true);
    setStatus("Generating thumbnail...");
    setGenerated("");

    try {
      const response = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: concept.prompt,
          description: concept.description,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Image generation failed.");

      let image = data.imageUrl || data.image_url || data.url || data.image;
      if (typeof image === "string" && image.startsWith("/")) {
        image = `${window.location.origin}${image}`;
      }
      if (typeof image !== "string" || !image) {
        throw new Error("Image API did not return an image.");
      }

      setGenerated(image);
      setProjects((old) => [
        { id: Date.now(), title: concept.title, image },
        ...old,
      ]);
      setStatus("Thumbnail generated successfully.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Image generation failed.");
    } finally {
      setLoading(false);
    }
  }

  function downloadImage() {
    if (!generated) return;
    const a = document.createElement("a");
    a.href = generated;
    a.download = `getyourthumbnail-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function Studio() {
    return (
      <div className="page">
        <div className="heading">
          <div>
            <span className="eyebrow">AI CREATIVE WORKSPACE</span>
            <h1>Thumbnail Studio <em>✦</em></h1>
            <p>Turn your video into a powerful thumbnail.</p>
          </div>
          <span className="ready">● AI WORKSPACE</span>
        </div>

        <div className="studio-grid">
          <section className="panel">
            <div className="panel-heading">
              <b>01</b>
              <div>
                <h3>Upload your video</h3>
                <p>Choose a video to analyze</p>
              </div>
            </div>

            <label className="dropzone">
              <input
                type="file"
                accept="video/*"
                onChange={(e) => selectVideo(e.target.files?.[0])}
              />
              <span className="upload-symbol">↑</span>
              <strong>{video ? video.name : "Drop your video here"}</strong>
              <small>or tap to browse files</small>
              <small>MP4 · MOV · WEBM</small>
            </label>

            {videoUrl && (
              <div className="video-box">
                <video ref={videoRef} src={videoUrl} controls />
                <button
                  className="plain"
                  onClick={() => {
                    URL.revokeObjectURL(videoUrl);
                    setVideo(null);
                    setVideoUrl("");
                    setConcepts([]);
                    setGenerated("");
                  }}
                >
                  Remove video
                </button>
              </div>
            )}

            <label className="field-label">Video description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Describe your video, game, story or main moment..."
            />
            <button
              className="primary"
              disabled={!video || loading}
              onClick={analyzeVideo}
            >
              {loading ? "Please wait..." : "✦ Analyze Video"}
            </button>
          </section>

          <section className="panel">
            <div className="panel-heading">
              <b>02</b>
              <div>
                <h3>AI Thumbnail Concepts</h3>
                <p>Choose your favorite creative direction</p>
              </div>
            </div>

            {concepts.length === 0 ? (
              <div className="empty">
                <span>✧</span>
                <h3>Your ideas appear here</h3>
                <p>Upload a video and run AI analysis to discover concepts.</p>
              </div>
            ) : (
              <div className="concept-list">
                {concepts.map((concept, i) => (
                  <article
                    className={`concept ${selected === i ? "chosen" : ""}`}
                    key={`${concept.title}-${i}`}
                  >
                    <div className="concept-title">
                      <b>0{i + 1}</b>
                      <h4>{concept.title}</h4>
                    </div>
                    <p>{concept.description}</p>
                    <button
                      className="secondary"
                      disabled={loading}
                      onClick={() => generateThumbnail(i)}
                    >
                      Generate this thumbnail →
                    </button>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>

        <section className="panel output-panel">
          <div className="panel-heading">
            <b>03</b>
            <div>
              <h3>Generated Thumbnail</h3>
              <p>Your final AI-generated design</p>
            </div>
          </div>

          {generated ? (
            <div className="output">
              <img src={generated} alt="Generated thumbnail" />
              <button className="primary" onClick={downloadImage}>
                ↓ Download Thumbnail
              </button>
            </div>
          ) : (
            <div className="output-empty">
              ✦
              <p>Your generated thumbnail will appear here.</p>
            </div>
          )}
        </section>

        {status && <div className="status">{status}</div>}
      </div>
    );
  }

  return (
    <main className={`app ${dark ? "dark" : "light"}`}>
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">✦</div>
          <div>
            <strong>GetYour<span>Thumbnail</span></strong>
            <small>AI CREATIVE STUDIO</small>
          </div>
        </div>

        <div className="nav-label">WORKSPACE</div>
        <nav>
          {menu.map(([name, icon]) => (
            <button
              key={name}
              onClick={() => setActive(name)}
              className={`nav-item ${active === name ? "active" : ""}`}
            >
              <span>{icon}</span>
              {name}
              {active === name && <i />}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="upgrade">
            <span>✧</span>
            <strong>Creative mode</strong>
            <p>Build something amazing with AI.</p>
            <small>FREE MVP</small>
          </div>
          <div className="profile">
            <div className="avatar">GY</div>
            <div>
              <strong>Creator Account</strong>
              <small>Free workspace</small>
            </div>
          </div>
        </div>
      </aside>

      <section className="main">
        <header className="topbar">
          <div>Workspace <span>/</span> {active}</div>
          <div className="top-right">
            <small>● System online</small>
            <button className="theme-toggle" onClick={() => setDark(!dark)}>
              {dark ? "☀ Light mode" : "☾ Dark mode"}
            </button>
          </div>
        </header>

        {active === "Thumbnail Studio" ? (
          <Studio />
        ) : active === "Dashboard" ? (
          <div className="page">
            <section className="hero">
              <div>
                <span className="eyebrow">YOUR CREATIVE COMMAND CENTER</span>
                <h1>Make something<br /><em>extraordinary.</em></h1>
                <p>Your ideas deserve thumbnails that get noticed.</p>
                <button
                  className="primary hero-button"
                  onClick={() => setActive("Thumbnail Studio")}
                >
                  ✦ Create a Thumbnail　→
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
              <div className="stat">
                <span>✦</span>
                <small>GENERATED THUMBNAILS</small>
                <strong>{projects.length}</strong>
                <p>Your created designs</p>
              </div>
              <div className="stat">
                <span>▣</span>
                <small>SAVED PROJECTS</small>
                <strong>{projects.length}</strong>
                <p>This session</p>
              </div>
              <div className="stat">
                <span>♡</span>
                <small>FAVORITES</small>
                <strong>0</strong>
                <p>Saved favorite designs</p>
              </div>
              <div className="stat">
                <span>◉</span>
                <small>WORKSPACE STATUS</small>
                <strong className="active-text">Active</strong>
                <p>Ready to create</p>
              </div>
            </div>

            <div className="section-title">
              <div>
                <h2>Creative workspace</h2>
                <p>Everything you need to create better thumbnails.</p>
              </div>
            </div>

            <div className="tools">
              <button
                className="tool"
                onClick={() => setActive("Thumbnail Studio")}
              >
                <span className="tool-icon purple">✦</span>
                <h3>Thumbnail Studio</h3>
                <p>Analyze videos and generate AI thumbnail concepts.</p>
                <b>Open studio →</b>
              </button>

              <Link className="tool" href="/enhancer">
                <span className="tool-icon blue">◈</span>
                <h3>Image Enhancer</h3>
                <p>Improve image quality and adjust your designs.</p>
                <b>Open enhancer →</b>
              </Link>

              <button
                className="tool"
                onClick={() => setActive("My Projects")}
              >
                <span className="tool-icon pink">▣</span>
                <h3>My Projects</h3>
                <p>View thumbnails generated in this session.</p>
                <b>View projects →</b>
              </button>
            </div>

            <div className="section-title recent-title">
              <div>
                <h2>Recent creations</h2>
                <p>Your latest generated thumbnails.</p>
              </div>
              <button
                className="view-all"
                onClick={() => setActive("My Projects")}
              >
                View all →
              </button>
            </div>

            {projects.length ? (
              <div className="projects">
                {projects.slice(0, 4).map((p) => (
                  <div className="project" key={p.id}>
                    <img src={p.image} alt={p.title} />
                    <strong>{p.title}</strong>
                  </div>
                ))}
              </div>
            ) : (
              <div className="recent-empty">
                ✧
                <p>No creations yet. Your next great thumbnail starts here.</p>
              </div>
            )}
          </div>
        ) : (
          <div className="page other-page">
            <span className="eyebrow">YOUR WORKSPACE</span>
            <h1>{active}</h1>

            {active === "My Projects" &&
              (projects.length ? (
                <div className="projects">
                  {projects.map((p) => (
                    <div className="project" key={p.id}>
                      <img src={p.image} alt={p.title} />
                      <strong>{p.title}</strong>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="recent-empty">
                  ▣
                  <p>Your generated projects will appear here during this session.</p>
                </div>
              ))}

            {active === "Download History" && (
              <div className="recent-empty">
                ↓
                <p>Download a generated thumbnail to save it to your device.</p>
              </div>
            )}

            {active === "Favorites" && (
              <div className="recent-empty">
                ♡
                <p>Favorites feature is planned for a future update.</p>
              </div>
            )}

            {active === "Settings" && (
              <div className="panel settings">
                <h3>Workspace settings</h3>
                <p>Appearance</p>
                <button
                  className="secondary"
                  onClick={() => setDark(!dark)}
                >
                  Switch to {dark ? "Light" : "Dark"} mode
                </button>
                <p className="note">
                  This MVP does not yet include cloud accounts, billing, or permanent project storage.
                </p>
              </div>
            )}
          </div>
        )}

        <footer>
          ✦ GetYourThumbnail
          <span>Designed for creators · AI Creative Studio</span>
        </footer>
      </section>

      <style jsx global>{`
        * { box-sizing: border-box; }
        body { margin: 0; font-family: Arial, Helvetica, sans-serif; }
        .app {
          --bg: #090811;
          --panel: #12111e;
          --panel2: #191729;
          --text: #f5f2ff;
          --muted: #958da9;
          --line: rgba(255,255,255,.09);
          min-height: 100vh;
          display: flex;
          background: var(--bg);
          color: var(--text);
        }
        .app.light {
          --bg: #f3f1fa;
          --panel: #fff;
          --panel2: #f6f2ff;
          --text: #211a32;
          --muted: #777087;
          --line: rgba(30,20,50,.12);
        }
        button { font: inherit; cursor: pointer; }
        .sidebar {
          width: 245px;
          min-width: 245px;
          height: 100vh;
          position: sticky;
          top: 0;
          padding: 25px 16px 18px;
          background: var(--panel);
          border-right: 1px solid var(--line);
          display: flex;
          flex-direction: column;
        }
        .brand {
          display: flex;
          align-items: center;
          gap: 11px;
          padding: 0 7px 38px;
        }
        .brand-mark {
          width: 40px;
          height: 40px;
          border-radius: 13px;
          display: grid;
          place-items: center;
          font-size: 24px;
          color: white;
          background: linear-gradient(135deg,#743bce,#3987ff);
          box-shadow: 0 0 24px #864dce66;
        }
        .brand strong { font-size: 14px; }
        .brand strong span {color: #ad79ff;
}
.brand small {
  display: block;
  color: var(--muted);
  font-size: 8px;
  letter-spacing: 1.5px;
  margin-top: 5px;
}
.nav-label {
  font-size: 10px;
  letter-spacing: 1.5px;
  color: var(--muted);
  padding: 0 12px 12px;
}
nav {
  display: grid;
  gap: 6px;
}
.nav-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 13px;
  width: 100%;
  padding: 13px 12px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--muted);
  text-align: left;
  font-size: 12px;
}
.nav-item>span {
  font-size: 19px;
  width: 20px;
  text-align: center;
}
.nav-item:hover {
  background: var(--panel2);
  color: var(--text);
}
.nav-item.active {
  background: linear-gradient(100deg,#6839a833,#4385ff20);
  color: var(--text);
  border: 1px solid #9662df44;
}
.nav-item i {
  position: absolute;
  right: 0;
  top: 10px;
  bottom: 10px;
  width: 3px;
  border-radius: 5px;
  background: #a76aff;
}
.sidebar-bottom { margin-top: auto; }
.upgrade {
  padding: 15px;
  border-radius: 13px;
  border: 1px solid #9864e544;
  background: linear-gradient(145deg,#6333a522,#3479c91a);
  margin-bottom: 18px;
}
.upgrade>span { font-size: 22px; color: #bc8cff; }
.upgrade strong {
  display: block;
  font-size: 12px;
  margin-top: 8px;
}
.upgrade p { font-size: 10px; color: var(--muted); }
.upgrade small {
  font-size: 9px;
  color: #b98aff;
  letter-spacing: 1px;
}
.profile {
  display: flex;
  align-items: center;
  gap: 10px;
  border-top: 1px solid var(--line);
  padding: 17px 3px 0;
}
.avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: linear-gradient(135deg,#7240bb,#357ee1);
  font-size: 11px;
  font-weight: bold;
}
.profile strong { font-size: 10px; }
.profile small {
  display: block;
  color: var(--muted);
  font-size: 9px;
  margin-top: 4px;
}
.main { flex: 1; min-width: 0; }
.topbar {
  height: 70px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 35px;
  border-bottom: 1px solid var(--line);
  font-size: 11px;
  color: var(--muted);
}
.topbar>div:first-child span {
  color: #a66aff;
  padding: 0 8px;
}
.top-right {
  display: flex;
  align-items: center;
  gap: 20px;
}
.top-right small { font-size: 10px; }
.theme-toggle {
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 9px 12px;
  background: var(--panel);
  color: var(--text);
  font-size: 10px;
}
.page {
  max-width: 1450px;
  margin: auto;
  padding: 34px 35px 45px;
}
.hero {
  min-height: 245px;
  border: 1px solid #9862df44;
  border-radius: 18px;
  padding: 35px 40px;
  position: relative;
  overflow: hidden;
  background: radial-gradient(ellipse at 78% 50%,#6235a744,transparent 38%),linear-gradient(110deg,#1a142b,#101426 65%,#15132b);
}
.eyebrow {
  color: #b68aff;
  font-size: 9px;
  letter-spacing: 2px;
  font-weight: bold;
}
.hero h1 {
  font-size: clamp(28px,4vw,43px);
  letter-spacing: -1.7px;
  margin: 15px 0 9px;
}
.hero h1 em,.heading h1 em {
  color: #b17aff;
  font-style: normal;
}
.hero p,.heading p { color: #a69db8; font-size: 12px; }
.primary {
  border: 0;
  border-radius: 9px;
  padding: 13px 18px;
  color: white;
  font-weight: bold;
  font-size: 11px;
  background: linear-gradient(100deg,#713bc0,#347de0);
  box-shadow: 0 7px 24px #6b42bb44;
}
.primary:hover { filter: brightness(1.12); transform: translateY(-1px); }
.primary:disabled,.secondary:disabled {
  opacity: .5;
  cursor: not-allowed;
  transform: none;
}
.hero-button { margin-top: 15px; }
.hero-art {
  position: absolute;
  right: 12%;
  top: 50%;
  transform: translateY(-50%);
  width: 180px;
  height: 180px;
  display: grid;
  place-items: center;
}
.orbit { position: absolute; border: 1px solid #a16bff66; border-radius: 50%; }
.orbit-a {
  width: 150px;
  height: 150px;
  box-shadow: 0 0 35px #8546ce33,inset 0 0 30px #8546ce22;
}
.orbit-b {
  width: 105px;
  height: 105px;
  border-style: dashed;
  animation: spin 22s linear infinite;
}
.hero-gem {
  width: 68px;
  height: 68px;
  display: grid;
  place-items: center;
  border-radius: 22px;
  font-size: 34px;
  color: white;
  background: linear-gradient(135deg,#8a4ddd,#3887f2);
  box-shadow: 0 0 40px #9558e988;
}
.hero-art i {
  position: absolute;
  right: 4px;
  top: 5px;
  color: #c69aff;
  font-size: 25px;
}
@keyframes spin { to { transform: rotate(360deg); } }
.stats {
  display: grid;
  grid-template-columns: repeat(4,minmax(0,1fr));
  gap: 14px;
  margin: 22px 0 30px;
}
.stat {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 13px;
  padding: 17px;
}
.stat>span {
  width: 31px;
  height: 31px;
  display: grid;
  place-items: center;
  border-radius: 9px;
  background: #8c54d522;
  color: #b98aff;
  margin-bottom: 14px;
}
.stat small {
  display: block;
  color: var(--muted);
  font-size: 9px;
  letter-spacing: .5px;
}
.stat strong { display: block; font-size: 25px; margin-top: 8px; }
.stat p { font-size: 10px; color: var(--muted); margin-bottom: 0; }
.active-text { color: #3ed49b; }
.section-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 25px 0 15px;
}
.section-title h2 { font-size: 17px; margin: 0 0 6px; }
.section-title p { font-size: 10px; color: var(--muted); margin: 0; }
.tools {
  display: grid;
  grid-template-columns: repeat(3,minmax(0,1fr));
  gap: 14px;
}
.tool {
  display: block;
  text-align: left;
  text-decoration: none;
  color: var(--text);
  border: 1px solid var(--line);
  border-radius: 13px;
  background: var(--panel);
  padding: 19px;
  min-height: 180px;
  transition: .2s;
}
.tool:hover { border-color: #9662df88; transform: translateY(-3px); }
.tool-icon {
  width: 39px;
  height: 39px;
  border-radius: 11px;
  display: grid;
  place-items: center;
  font-size: 20px;
}
.tool-icon.purple { background: #8c54d522; color: #b98aff; }
.tool-icon.blue { background: #438dff22; color: #70adff; }
.tool-icon.pink { background: #e05ba522; color: #ff91c8; }
.tool h3 { font-size: 13px; margin: 15px 0 8px; }
.tool p {
  font-size: 10px;
  color: var(--muted);
  line-height: 1.6;
  min-height: 32px;
}
.tool b { font-size: 10px; color: #b98aff; }
.recent-title { margin-top: 30px; }
.view-all {
  border: 0;
  background: none;
  color: #b98aff;
  font-size: 10px;
}
.recent-empty,.empty,.output-empty {
  border: 1px dashed var(--line);
  border-radius: 13px;
  text-align: center;
  padding: 27px;
  color: #b98aff;
  font-size: 24px;
}
.recent-empty p,.empty p,.output-empty p {
  font-size: 11px;
  color: var(--muted);
}
.projects {
  display: grid;
  grid-template-columns: repeat(4,minmax(0,1fr));
  gap: 14px;
}
.project {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 10px;
}
.project img {
  width: 100%;
  aspect-ratio: 16/9;
  object-fit: cover;
  border-radius: 8px;
}
.project strong {
  display: block;
  font-size: 11px;
  margin-top: 9px;
}
.heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
}
.heading h1 { font-size: 30px; margin: 9px 0; }
.heading p { margin: 0; }
.ready {
  font-size: 9px;
  color: #45dca7;
  border: 1px solid #45dca744;
  padding: 9px 12px;
  border-radius: 20px;
}
.studio-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
.panel {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 21px;
  min-width: 0;
}
.panel-heading {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 20px;
}
.panel-heading>b {
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border-radius: 9px;
  background: #8c54d522;
  color: #bb8aff;
  font-size: 11px;
}
.panel-heading h3 { font-size: 13px; margin: 0 0 5px; }
.panel-heading p { font-size: 10px; color: var(--muted); margin: 0; }
.dropzone {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 170px;
  border: 1px dashed #9662df88;
  border-radius: 12px;
  background: #8655ca0c;
  cursor: pointer;
  text-align: center;
  padding: 15px;
}
.dropzone input { display: none; }
.upload-symbol { font-size: 28px; color: #b98aff; margin-bottom: 9px; }
.dropzone strong { font-size: 12px; max-width: 100%; overflow-wrap: anywhere; }
.dropzone small { font-size: 10px; color: var(--muted); margin-top: 7px; }
.video-box { margin-top: 13px; }
.video-box video {
  width: 100%;
  max-height: 220px;
  background: #000;
  border-radius: 9px;
}
.plain {
  display: block;
  margin: 7px 0 12px auto;
  border: 0;
  background: none;
  color: #b98aff;
  font-size: 10px;
}
.field-label {
  display: block;
  font-size: 10px;
  color: var(--muted);
  margin: 16px 0 8px;
}
.studio textarea {
  width: 100%;
  resize: vertical;
  border: 1px solid var(--line);
  border-radius: 9px;
  background: var(--bg);
  color: var(--text);
  padding: 12px;
  font-size: 11px;
  outline: none;
}
.studio textarea:focus { border-color: #9662df; }
.studio .panel>.primary { width: 100%; margin-top: 13px; }
.empty { margin-top: 15px; padding: 35px 18px; }
.empty>span { font-size: 32px; }
.empty h3 { font-size: 13px; color: var(--text); margin: 12px 0 6px; }
.empty p { line-height: 1.6; }
.concept-list {
  display: grid;
  gap: 10px;
  max-height: 440px;
  overflow: auto;
}
.concept {
  padding: 13px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--panel2);
}
.concept.chosen { border-color: #a66aff; }
.concept-title { display: flex; align-items: center; gap: 9px; }
.concept-title>b { color: #b98aff; font-size: 10px; }
.concept h4 { font-size: 12px; margin: 0; }
.concept p { font-size: 10px; color: var(--muted); line-height: 1.6; }
.secondary {
  width: 100%;
  padding: 10px;
  border-radius: 8px;
  border: 1px solid #8c59bc;
  color: white;
  background: linear-gradient(100deg,#5831a4,#823eaf);
  font-size: 10px;
  font-weight: bold;
}
.output-panel { margin-top: 16px; }
.output { max-width: 720px; margin: auto; text-align: center; }
.output img {
  display: block;
  width: 100%;
  border-radius: 10px;
  margin: 0 auto 14px;
}
.output .primary { min-width: 200px; }
.output-empty { padding: 25px; }
.status {
  margin-top: 15px;
  padding: 12px 15px;
  border: 1px solid #9662df55;
  background: #8a50c817;
  color: var(--text);
  border-radius: 9px;
  font-size: 11px;
}
.other-page h1 { font-size: 30px; margin: 12px 0 25px; }
.settings { max-width: 550px; }
.settings h3 { font-size: 14px; }
.settings p { font-size: 11px; color: var(--muted); }
.settings .secondary { max-width: 200px; }
.settings .note { margin-top: 20px; line-height: 1.6; }
footer {
  display: flex;
  justify-content: space-between;
  padding: 20px 35px;
  border-top: 1px solid var(--line);
  font-size: 9px;
  color: var(--muted);
}
footer span { color: var(--muted); }

@media(max-width:900px) {
  .sidebar { width: 205px; min-width: 205px; }
  .stats { grid-template-columns: repeat(2,1fr); }
  .tools { grid-template-columns: 1fr 1fr; }
  .projects { grid-template-columns: repeat(2,1fr); }
  .hero-art { right: 4%; }
}
@media(max-width:650px) {
  .app { display: block; }
  .sidebar {
    position: relative;
    width: 100%;
    height: auto;
    min-height: 0;
    padding: 13px;
    border-right: 0;
    border-bottom: 1px solid var(--line);
  }
  .brand { padding: 0 5px 13px; }
  .nav-label,.sidebar-bottom { display: none; }
  nav {
    display: flex;
    overflow-x: auto;
    gap: 5px;
    padding-bottom: 2px;
  }
  .nav-item {
    width: auto;
    min-width: max-content;
    padding: 10px;
    font-size: 10px;
    gap: 7px;
  }
  .nav-item>span { font-size: 15px; width: auto; }
  .nav-item i { display: none; }
  .topbar { height: 55px; padding: 0 14px; }
  .top-right { gap: 8px; }
  .top-right small { display: none; }
  .page { padding: 22px 14px 30px; }
  .hero { padding: 25px 20px; min-height: 230px; }
  .hero h1 { font-size: 29px; max-width: 75%; }
  .hero-art {
    right: -30px;
    opacity: .65;
    transform: translateY(-50%) scale(.75);
  }
  .stats { gap: 9px; }
  .stat { padding: 13px; }
  .stat small { font-size: 8px; }
  .stat strong { font-size: 21px; }
  .tools { grid-template-columns: 1fr; }
  .tool { min-height: 0; }
  .tool p { min-height: 0; }
  .studio-grid { grid-template-columns: 1fr; }
  .heading { align-items: flex-start; gap: 10px; }
  .heading h1 { font-size: 25px; }
  .ready { white-space: nowrap; font-size: 8px; }
  .panel { padding: 15px; }
  .projects { grid-template-columns: 1fr 1fr; }
  footer { padding: 17px 14px; gap: 10px; flex-wrap: wrap; }
  .other-page h1 { font-size: 25px; }
}
      `}</style>
    </main>
  );
}
