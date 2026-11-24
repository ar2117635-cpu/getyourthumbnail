
"use client";

import React, { useRef, useState } from "react";
import Link from "next/link";

type Caption = {
  start: number;
  end: number;
  text: string;
};

export default function Home() {
  const [active, setActive] = useState("Dashboard");
  const [dark, setDark] = useState(true);
  const [video, setVideo] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [language, setLanguage] = useState("auto");
  const [style, setStyle] = useState("bold");
  const [captions, setCaptions] = useState<Caption[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [currentTime, setCurrentTime] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  function uploadVideo(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("video/")) {
      setStatus("Please select a valid video.");
      return;
    }
    if (file.size > 100 * 1024 * 1024) {
      setStatus("Video size must be below 100 MB.");
      return;
    }

    if (videoUrl) URL.revokeObjectURL(videoUrl);
    setVideo(file);
    setVideoUrl(URL.createObjectURL(file));
    setCaptions([]);
    setStatus("Video uploaded successfully.");
  }

  async function generateCaptions() {
    if (!video) {
      setStatus("Please upload a video first.");
      return;
    }

    setLoading(true);
    setStatus("AI is preparing your captions...");

    try {
      const form = new FormData();
      form.append("video", video);
      form.append("language", language);

      const response = await fetch("/api/captions", {
        method: "POST",
        body: form,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Caption generation failed.");
      }

      if (!Array.isArray(data.captions)) {
        throw new Error("Invalid caption response from server.");
      }

      setCaptions(data.captions);
      setStatus("Captions generated successfully!");
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }

  function updateCaption(index: number, text: string) {
    setCaptions((old) =>
      old.map((item, i) => (i === index ? { ...item, text } : item))
    );
  }

  function downloadSRT() {
    const time = (seconds: number) => {
      const ms = Math.floor((seconds % 1) * 1000);
      const total = Math.floor(seconds);
      const h = Math.floor(total / 3600);
      const m = Math.floor((total % 3600) / 60);
      const s = total % 60;

      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
    };

    const content = captions
      .map(
        (c, i) =>
          `${i + 1}\n${time(c.start)} --> ${time(c.end)}\n${c.text}\n`
      )
      .join("\n");

    const blob = new Blob([content], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "getyourthumbnail-captions.srt";
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadVTT() {
    const time = (seconds: number) => {
      const ms = Math.floor((seconds % 1) * 1000);
      const total = Math.floor(seconds);
      const h = Math.floor(total / 3600);
      const m = Math.floor((total % 3600) / 60);
      const s = total % 60;

      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(ms).padStart(3, "0")}`;
    };

    const content =
      "WEBVTT\n\n" +
      captions
        .map(
          (c) =>
            `${time(c.start)} --> ${time(c.end)}\n${c.text}\n`
        )
        .join("\n");

    const blob = new Blob([content], { type: "text/vtt" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "getyourthumbnail-captions.vtt";
    a.click();
    URL.revokeObjectURL(url);
  }

  const activeCaption = captions.find(
    (c) => currentTime >= c.start && currentTime <= c.end
  );

  const menu = [
    ["Dashboard", "⌂"],
    ["Thumbnail Studio", "✦"],
    ["AI Caption Studio", "CC"],
    ["My Projects", "▣"],
    ["Download History", "↓"],
    ["Favorites", "♡"],
    ["Settings", "⚙"],
  ];

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
              className={`nav-item ${active === name ? "active" : ""}`}
              onClick={() => setActive(name)}
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
            <button
              className="theme-toggle"
              onClick={() => setDark(!dark)}
            >
              {dark ? "☀ Light mode" : "☾ Dark mode"}
            </button>
          </div>
        </header>

        {active === "AI Caption Studio" ? (
          <div className="page">
            <div className="heading">
              <div>
                <span className="eyebrow">AI VIDEO WORKSPACE</span>
                <h1>AI Caption <em>Studio.</em></h1>
                <p>Turn spoken words into perfectly timed subtitles.</p>
              </div>
              <span className="ready">● CAPTION WORKSPACE</span>
            </div>

            <div className="studio-grid">
              <section className="panel">
                <div className="panel-heading">
                  <b>01</b>
                  <div>
                    <h3>Upload your video</h3>
                    <p>Choose a video for automatic transcription.</p>
                  </div>
                </div>

                <label className="dropzone">
                  <input
                    type="file"
                    accept="video/*"
                    onChange={(e) => uploadVideo(e.target.files?.[0])}
                  />
                  <span className="upload-symbol">↑</span>
                  <strong>{video ? video.name : "Upload your video"}</strong>
                  <small>Tap to browse files</small>
                  <small>MP4 · MOV · WEBM · Max 100 MB</small>
                </label>

                {videoUrl && (
                  <div className="video-box">
                    <div className="preview-wrap">
                      <video
                        ref={videoRef}
                        src={videoUrl}
                        controls
                        onTimeUpdate={(e) =>
                          setCurrentTime(e.currentTarget.currentTime)
                        }
                      />
                      {activeCaption && (
                        <div className={`caption-overlay ${style}`}>
                          {activeCaption.text}
                        </div>
                      )}
                    </div>
                    <button
                      className="plain"
                      onClick={() => {
                        URL.revokeObjectURL(videoUrl);
                        setVideo(null);
                        setVideoUrl("");
                        setCaptions([]);
                        setStatus("");
                      }}
                    >
                      Remove video
                    </button>
                    .seo-grid article {
  text-align: center;
}

.seo-grid article button,
.seo-grid article a {
  display: inline-block;
  text-align: center;
  margin-top: 8px;
}

.seo-faq {
  text-align: center;
}

.seo-faq details {
  text-align: left;
                    }
                  </div>
                )}

                <label className="field-label">Caption language</label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                >
                  <option value="auto">Auto detect language</option>
                  <option value="Hindi">Hindi</option>
                  <option value="English">English</option>
                  <option value="Hinglish">Hinglish</option>
                  <option value="Spanish">Spanish</option>
                  <option value="French">French</option>
                  <option value="Other">Other / Multilingual</option>
                </select>

                <label className="field-label">Caption style</label>
                <select
                  value={style}
                  onChange={(e) => setStyle(e.target.value)}
                >
                  <option value="bold">Bold Creator</option>
                  <option value="neon">Neon Glow</option>
                  <option value="karaoke">Karaoke Highlight</option>
                  <option value="classic">Classic Subtitle</option>
                </select>

                <button
                  className="primary"
                  disabled={!video || loading}
                  onClick={generateCaptions}
                >
                  {loading ? "✦ Generating captions..." : "✦ Generate AI Captions"}
                </button>

                {status && <div className="status">{status}</div>}
              </section>

              <section className="panel">
                <div className="panel-heading">
                  <b>02</b>
                  <div>
                    <h3>Caption Editor</h3>
                    <p>Edit the generated subtitles.</p>
                  </div>
                </div>

                {captions.length === 0 ? (
                  <div className="empty">
                    <span>CC</span>
                    <h3>Your captions appear here</h3>
                    <p>Upload a video and generate captions to begin.</p>
                  </div>
                ) : (
                  <>
                    <div className="caption-list">
                      {captions.map((caption, i) => (
                        <div className="caption-item" key={i}>
                          <small>
                            {caption.start.toFixed(2)}s – {caption.end.toFixed(2)}s
                          </small>
                          <textarea
                            value={caption.text}
                            rows={2}
                            onChange={(e) =>
                              updateCaption(i, e.target.value)
                            }
                          />
                        </div>
                      ))}
                    </div>

                    <div className="export-row">
                      <button className="secondary" onClick={downloadSRT}>
                        ↓ Download SRT
                      </button>
                      <button className="secondary" onClick={downloadVTT}>
                        ↓ Download VTT
                      </button>
                    </div>
                  </>
                )}
              </section>
            </div>

            <section className="panel output-panel">
              <div className="panel-heading">
                <b>03</b>
                <div>
                  <h3>Export workspace</h3>
                  <p>Subtitle files can be exported separately.</p>
                </div>
              </div>
              <div className="output-empty">
                ✦
                <p>MP4 video rendering with permanently embedded captions is the next processing step.</p>
              </div>
            </section>
          </div>
        ) : active === "Thumbnail Studio" ? (
          <div className="page">
            <div className="heading">
              <div>
                <span className="eyebrow">AI CREATIVE WORKSPACE</span>
                <h1>Thumbnail Studio <em>✦</em></h1>
                <p>Your thumbnail creation workspace.</p>
              </div>
            </div>
            <section className="panel">
              <h3>Thumbnail Studio</h3>
              <p>Open the existing thumbnail tools from the dashboard while we reconnect the full studio workflow.</p>
              <Link className="primary link-button" href="/">
                Dashboard
              </Link>
            </section>
          </div>
        ) : active === "Dashboard" ? (
          <div className="page">
            <section className="hero">
              <div>
                <span className="eyebrow">YOUR CREATIVE COMMAND CENTER</span>
                <h1>Make something<br /><em>extraordinary.</em></h1>
                <p>Your ideas deserve content that gets noticed.</p>
                <button
                  className="primary hero-button"
                  onClick={() => setActive("AI Caption Studio")}
                >
                  CC Create Captions →
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
                <small>AI TOOLS</small>
                <strong>03</strong>
                <p>Creative workspaces</p>
              </div>
              <div className="stat">
                <span>CC</span>
                <small>CAPTION STUDIO</small>
                <strong>New</strong>
                <p>Automatic subtitles</p>
              </div>
              <div className="stat">
                <span>◈</span>
                <small>IMAGE ENHANCER</small>
                <strong>Ready</strong>
                <p>Image improvement</p>
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
                <p>Choose a tool to start creating.</p>
              </div>
            </div>

            <div className="tools">
              <button className="tool" onClick={() => setActive("Thumbnail Studio")}>
                <span className="tool-icon purple">✦</span>
                <h3>Thumbnail Studio</h3>
                <p>AI thumbnail creation workspace.</p>
                <b>Open studio →</b>
              </button>

              <Link className="tool" href="/enhancer">
                <span className="tool-icon blue">◈</span>
                <h3>Image Enhancer</h3>
                <p>Improve image quality and resolution.</p>
                <b>Open enhancer →</b>
              </Link>

              <button className="tool" onClick={() => setActive("AI Caption Studio")}>
                <span className="tool-icon pink">CC</span>
                <h3>AI Caption Studio</h3>
                <p>Automatically transcribe videos and create subtitles.</p>
                <b>Open caption studio →</b>
              </button>
            </div>
          </div>
        ) : (
          <div className="page other-page">
            <span className="eyebrow">YOUR WORKSPACE</span>
            <h1>{active}</h1>
            <div className="recent-empty">
              ✧
              <p>This workspace section is ready for a future update.</p>
            </div>
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
        button, select, textarea { font: inherit; }
        button { cursor: pointer; }
        .app {
          --bg:#090811; --panel:#12111e; --panel2:#191729;
          --text:#f5f2ff; --muted:#958da9; --line:rgba(255,255,255,.09);
          min-height:100vh; display:flex; background:var(--bg); color:var(--text);
        }
        .app.light {
          --bg:#f3f1fa; --panel:#fff; --panel2:#f6f2ff;
          --text:#211a32; --muted:#777087; --line:rgba(30,20,50,.12);
        }
        .sidebar {
          width:245px; min-width:245px; height:100vh; position:sticky; top:0;
          padding:25px 16px 18px; background:var(--panel);
          border-right:1px solid var(--line); display:flex; flex-direction:column;
        }
        .brand { display:flex; align-items:center; gap:11px; padding:0 7px 38px; }
        .brand-mark {
          width:40px; height:40px; border-radius:13px; display:grid; place-items:center;
          font-size:24px; color:white; background:linear-gradient(135deg,#743bce,#3987ff);
          box-shadow:0 0 24px #864dce66;
        }
        .brand strong { font-size:14px; }
        .brand strong span { color:#a78bfa; }
        .brand small,.profile small { display:block; color:var(--muted); font-size:9px; margin-top:5px; letter-spacing:1.2px; }
        .nav-label { color:var(--muted); font-size:10px; letter-spacing:1.6px; padding:0 12px 12px; }
        nav { display:grid; gap:6px; }
        .nav-item {
          position:relative; display:flex; align-items:center; gap:13px; width:100%;
          border:0; border-radius:10px; background:transparent; color:var(--muted);
          padding:13px 12px; text-align:left; font-size:13px;
        }
        .nav-item span { width:20px; text-align:center; }
        .nav-item.active { background:linear-gradient(100deg,#743bce33,#3987ff1c); color:var(--text); }
        .nav-item i { position:absolute; right:0; height:23px; width:3px; border-radius:5px; background:#9b70ff; }
        .sidebar-bottom { margin-top:auto; }
        .upgrade { padding:17px; border-radius:13px; background:var(--panel2); border:1px solid var(--line); }
        .upgrade span { color:#b28aff; font-size:22px; }
        .upgrade strong { display:block; margin-top:7px; font-size:13px; }
        .upgrade p { color:var(--muted); font-size:11px; line-height:1.5; }
        .upgrade small { color:#ad8bff; font-size:9px; letter-spacing:1px; }
        .profile { display:flex; gap:10px; align-items:center; padding:20px 5px 0; }
        .avatar { width:35px; height:35px; display:grid; place-items:center; border-radius:50%; background:#6336a6; font-size:12px; }
        .profile strong { font-size:11px; }
        .profile small { letter-spacing:0; font-size:10px; }
        .main { flex:1; min-width:0; }
        .topbar {
          height:65px; padding:0 34px; display:flex; align-items:center; justify-content:space-between;
          border-bottom:1px solid var(--line); color:var(--muted); font-size:12px;
        }
        .topbar span { padding:0 9px; }
        .top-right { display:flex; align-items:center; gap:20px; }
        .top-right small { color:#63d9a0; }
        .theme-toggle { background:var(--panel2); color:var(--text); border:1px solid var(--line); padding:9px 12px; border-radius:8px; font-size:11px; }
        .page { max-
width:1450px; margin:auto; padding:34px; }
.eyebrow { color:#a98aff; font-size:10px; letter-spacing:2px; font-weight:bold; }
h1 { font-size:clamp(30px,4vw,45px); letter-spacing:-1.8px; margin:12px 0; }
h1 em { color:#a78bfa; font-style:normal; }
.heading { display:flex; justify-content:space-between; align-items:center; margin-bottom:27px; }
.heading p,.hero p { color:var(--muted); font-size:13px; }
.ready { color:#67dca5; font-size:10px; }
.hero {
  min-height:270px; border:1px solid var(--line); border-radius:19px;
  background:radial-gradient(ellipse at 80% 40%,#693bb333,transparent 40%),var(--panel);
  padding:35px; display:flex; justify-content:space-between; align-items:center; overflow:hidden;
}
.hero h1 { font-size:clamp(36px,5vw,55px); }
.hero-art { width:230px; height:200px; position:relative; display:grid; place-items:center; }
.hero-gem { width:100px; height:100px; border-radius:30px; display:grid; place-items:center; font-size:55px; color:white; background:linear-gradient(135deg,#8548d6,#347dff); transform:rotate(12deg); box-shadow:0 0 65px #874bdc88; }
.orbit { position:absolute; border:1px solid #a77aff55; border-radius:50%; }
.orbit-a { width:180px; height:180px; }
.orbit-b { width:225px; height:125px; transform:rotate(-35deg); }
.hero-art i { position:absolute; right:8px; top:15px; color:#d7b6ff; font-size:30px; }
.primary {
  display:inline-block; border:0; border-radius:9px; padding:13px 17px;
  background:linear-gradient(100deg,#783ed0,#3978ed); color:white; font-weight:bold; font-size:12px;
  box-shadow:0 5px 22px #6938b944;
}
.primary:disabled { opacity:.5; cursor:not-allowed; }
.hero-button { margin-top:14px; }
.stats { display:grid; grid-template-columns:repeat(4,1fr); gap:13px; margin:23px 0 35px; }
.stat,.panel,.tool { background:var(--panel); border:1px solid var(--line); border-radius:13px; }
.stat { padding:18px; }
.stat span { color:#a78bfa; font-size:20px; }
.stat small { display:block; color:var(--muted); font-size:9px; letter-spacing:1px; margin-top:12px; }
.stat strong { display:block; font-size:23px; margin-top:7px; }
.stat p { color:var(--muted); font-size:10px; }
.active-text { color:#62dba0; }
.section-title { margin:30px 0 16px; }
.section-title h2 { font-size:19px; margin:0; }
.section-title p { color:var(--muted); font-size:11px; }
.tools { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:15px; }
.tool { display:block; text-align:left; padding:20px; color:var(--text); text-decoration:none; transition:.2s; }
.tool:hover { transform:translateY(-3px); border-color:#9868e8; }
.tool-icon { width:39px; height:39px; display:grid; place-items:center; border-radius:11px; font-size:20px; }
.purple { background:#7944ce33; color:#b38aff; }
.blue { background:#3978ed33; color:#75a9ff; }
.pink { background:#d14f9d33; color:#f18ac8; }
.tool h3 { font-size:14px; margin:16px 0 8px; }
.tool p { min-height:32px; color:var(--muted); font-size:11px; line-height:1.5; }
.tool b { color:#ae8aff; font-size:11px; }
.studio-grid { display:grid; grid-template-columns:1fr 1fr; gap:17px; align-items:start; }
.panel { padding:21px; }
.panel-heading { display:flex; gap:13px; align-items:center; margin-bottom:20px; }
.panel-heading>b { color:#a78bfa; font-size:18px; }
.panel-heading h3 { margin:0; font-size:14px; }
.panel-heading p { color:var(--muted); font-size:11px; margin:5px 0 0; }
.dropzone {
  display:flex; flex-direction:column; align-items:center; justify-content:center;
  gap:10px; min-height:160px; border:1px dashed #8e69c777; border-radius:12px;
  background:var(--panel2); cursor:pointer; text-align:center; padding:18px;
}
.dropzone input { display:none; }
.upload-symbol { font-size:28px; color:#ae8aff; }
.dropzone strong { font-size:12px; overflow-wrap:anywhere; }
.dropzone small { color:var(--muted); font-size:10px; }
.video-box { margin-top:15px; }
.preview-wrap { position:relative; }
.video-box video { width:100%; border-radius:10px; display:block; background:#000; }
.caption-overlay {
  position:absolute; bottom:45px; left:5%; width:90%; text-align:center;
  color:white; font-size:clamp(16px,3vw,26px); font-weight:900;
  text-shadow:2px 2px 3px black; pointer-events:none;
}
.caption-overlay.neon { color:#8ffcff; text-shadow:0 0 10px #00d9ff,2px 2px 3px #000; }
.caption-overlay.karaoke { color:#ffe35a; }
.caption-overlay.classic { font-weight:500; background:#000a; padding:7px; }
.plain { background:transparent; border:0; color:#b49aff; font-size:11px; padding:10px 0; }
.field-label { display:block; margin:17px 0 8px; color:var(--muted); font-size:11px; }
select,.panel textarea {
  width:100%; background:var(--panel2); color:var(--text);
  border:1px solid var(--line); border-radius:8px; padding:12px; font-size:12px;
}
.panel textarea { resize:vertical; }
.panel>.primary { width:100%; margin-top:18px; }
.empty,.output-empty {
  min-height:230px; display:flex; flex-direction:column; align-items:center;
  justify-content:center; text-align:center; color:var(--muted); padding:20px;
}
.empty span,.output-empty { color:#a78bfa; font-size:27px; }
.empty h3 { color:var(--text); font-size:14px; }
.empty p,.output-empty p { color:var(--muted); font-size:11px; line-height:1.6; }
.caption-list { max-height:470px; overflow:auto; display:grid; gap:12px; }
.caption-item { padding:12px; border:1px solid var(--line); border-radius:9px; background:var(--panel2); }
.caption-item small { color:#ad8aff; display:block; margin-bottom:8px; font-size:10px; }
.caption-item textarea { min-height:55px; }
.export-row { display:flex; gap:10px; margin-top:15px; flex-wrap:wrap; }
.secondary {
  background:var(--panel2); color:var(--text); border:1px solid var(--line);
  padding:11px 13px; border-radius:8px; font-size:11px;
}
.output-panel { margin-top:17px; }
.output-panel .output-empty { min-height:120px; font-size:23px; }
.status { margin-top:14px; color:#b99aff; font-size:11px; line-height:1.5; overflow-wrap:anywhere; }
.other-page { min-height:65vh; }
.recent-empty { min-height:170px; border:1px dashed var(--line); border-radius:13px; display:grid; place-items:center; align-content:center; color:var(--muted); text-align:center; padding:20px; }
footer { padding:20px 34px; border-top:1px solid var(--line); color:#a78bfa; font-size:11px; }
footer span { float:right; color:var(--muted); }
.link-button { text-decoration:none; margin-top:15px; }
@media(max-width:900px) {
  .sidebar { width:205px; min-width:205px; }
  .stats { grid-template-columns:repeat(2,1fr); }
  .tools { grid-template-columns:1fr 1fr; }
  .studio-grid { grid-template-columns:1fr; }
}
@media(max-width:600px) {
  .app { display:block; }
  .sidebar { width:100%; min-width:0; height:auto; position:relative; padding:13px; border-right:0; border-bottom:1px solid var(--line); }
  .brand { padding:0 4px 12px; }
  .nav-label,.sidebar-bottom { display:none; }
  nav { display:flex; overflow-x:auto; gap:6px; padding-bottom:3px; }
  .nav-item { flex:0 0 auto; width:auto; padding:10px; font-size:10px; gap:7px; }
  .nav-item i { display:none; }
  .topbar { height:52px; padding:0 14px; font-size:10px; }
  .top-right { gap:8px; }
  .top-right small { display:none; }
  .page { padding:19px 14px; }
  .hero { padding:22px; min-height:220px; }
  .hero-art { width:90px; transform:scale(.65); margin-right:-20px; }
  .hero h1 { font-size:34px; }
  .stats { gap:9px; margin:15px 0 25px; }
  .stat { padding:13px; }
  .tools { grid-template-columns:1fr; }
  .heading { align-items:flex-start; gap:10px; }
  .ready { font-size:8px; padding-top:8px; }
  .panel { padding:15px; }
  footer { padding:17px 14px; font-size:10px; }
  footer span { float:none; display:block; margin-top:7px; }
}
`}</style>
</main>
);
}
