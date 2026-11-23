
"use client";

import React, { useRef, useState } from "react";

type Concept = {
  headline: string;
  visual_scene: string;
  emotion: string;
  color_style: string;
  image_prompt: string;
};

export default function Home() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [videoURL, setVideoURL] = useState("");
  const [headline, setHeadline] = useState("MAKE YOUR VIDEO VIRAL!");
  const [subtitle, setSubtitle] = useState("CREATE AMAZING THUMBNAILS");
  const [design, setDesign] = useState(1);
  const [captured, setCaptured] = useState(false);

  const [description, setDescription] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState("");
  const [summary, setSummary] = useState("");
  const [concepts, setConcepts] = useState<Concept[]>([]);

  function uploadVideo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (videoURL) URL.revokeObjectURL(videoURL);

    setVideoURL(URL.createObjectURL(file));
    setCaptured(false);
    setConcepts([]);
    setSummary("");
    setAnalysisError("");
  }

  function drawText(ctx: CanvasRenderingContext2D) {
    const gradient = ctx.createLinearGradient(0, 400, 0, 720);
    gradient.addColorStop(0, "rgba(0,0,0,0)");
    gradient.addColorStop(1, "rgba(0,0,0,0.9)");

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 400, 1280, 320);

    if (design === 1) {
      ctx.textAlign = "center";
      ctx.font = "bold 76px Arial";
      ctx.lineWidth = 9;
      ctx.strokeStyle = "#000";
      ctx.fillStyle = "#FFE600";
      ctx.strokeText(headline.toUpperCase(), 640, 590, 1160);
      ctx.fillText(headline.toUpperCase(), 640, 590, 1160);

      ctx.font = "bold 34px Arial";
      ctx.fillStyle = "#FFFFFF";
      ctx.fillText(subtitle.toUpperCase(), 640, 655, 1100);
    } else {
      ctx.textAlign = "left";
      ctx.font = "bold 72px Arial";
      ctx.lineWidth = 8;
      ctx.strokeStyle = "#000";
      ctx.fillStyle = "#FFFFFF";
      ctx.strokeText(headline.toUpperCase(), 65, 580, 1120);
      ctx.fillText(headline.toUpperCase(), 65, 580, 1120);

      ctx.font = "bold 34px Arial";
      ctx.fillStyle = "#00E5FF";
      ctx.fillText(subtitle.toUpperCase(), 70, 645, 1100);
    }
  }

  function captureFrame() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !video.videoWidth) return;

    canvas.width = 1280;
    canvas.height = 720;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, 1280, 720);
    setCaptured(true);
    drawText(ctx);
  }

  function updateDesign(value: number) {
    setDesign(value);

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");

    if (captured && video && canvas && ctx && video.videoWidth) {
      ctx.drawImage(video, 0, 0, 1280, 720);

      const gradient = ctx.createLinearGradient(0, 400, 0, 720);
      gradient.addColorStop(0, "rgba(0,0,0,0)");
      gradient.addColorStop(1, "rgba(0,0,0,0.9)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 400, 1280, 320);
    }
  }

  function updateThumbnailText() {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    const ctx = canvas?.getContext("2d");

    if (!canvas || !ctx || !captured) return;

    if (video && video.videoWidth) {
      ctx.drawImage(video, 0, 0, 1280, 720);
    }

    drawText(ctx);
  }

  function waitForSeek(video: HTMLVideoElement): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = window.setTimeout(() => {
        cleanup();
        reject(new Error("Video frame loading timed out."));
      }, 12000);

      const cleanup = () => {
        clearTimeout(timer);
        video.removeEventListener("seeked", onSeeked);
      };

      const onSeeked = () => {
        cleanup();
        resolve();
      };

      video.addEventListener("seeked", onSeeked, { once: true });
    });
  }

  async function analyzeVideo() {
    const video = videoRef.current;

    if (!video || !video.videoWidth || !video.duration) {
      setAnalysisError("Please upload a video first.");
      return;
    }

    if (video.duration < 1) {
      setAnalysisError("Please select a video at least 1 second long.");
      return;
    }

    setAnalyzing(true);
    setAnalysisError("");
    setConcepts([]);
    setSummary("");

    const originalTime = video.currentTime;
    const wasPaused = video.paused;
    const frames: string[] = [];

    try {
      const sampleCount = 6;
      const maxTime = Math.max(0, video.duration - 0.2);

      const sampleTimes = Array.from(
        { length: sampleCount },
        (_, i) => maxTime * (i / (sampleCount - 1))
      );

      const canvas = document.createElement("canvas");
      canvas.width = 640;
      canvas.height = 360;

      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not prepare video frames.");

      for (const time of sampleTimes) {
        if (Math.abs(video.currentTime - time) > 0.05) {
          const seekPromise = waitForSeek(video);
          video.currentTime = time;
          await seekPromise;
        }

        ctx.drawImage(video, 0, 0, 640, 360);

        const frame = canvas.toDataURL("image/jpeg", 0.65);
        frames.push(frame);
      }

      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          description,
          frames
        })
      });

      const raw = await response.text();

      let data: any;
      try {
        data = JSON.parse(raw);
      } catch {
        throw new Error(
          `Server returned an unexpected response: ${raw.slice(0, 250)}`
        );
      }

      if (!response.ok) {
        throw new Error(
          data.details || data.error || "AI analysis failed."
        );
      }

      if (!Array.isArray(data.concepts) || data.concepts.length !== 4) {
        throw new Error("AI did not return four concepts.");
      }

      setSummary(data.video_summary || "");
      setConcepts(data.concepts);

    } catch (error) {
      setAnalysisError(
        error instanceof Error ? error.message : "Something went wrong."
      );
    } finally {
      try {
        if (Math.abs(video.currentTime - originalTime) > 0.05) {
          const seekPromise = waitForSeek(video);
          video.currentTime = originalTime;
          await seekPromise;
        }
      } catch {
        // Keep the original analysis result even if restoring the video fails.
      }

      if (!wasPaused) {
        video.play().catch(() => {});
      }

      setAnalyzing(false);
    }
  }

  function useConcept(concept: Concept) {
    setHeadline(concept.headline);
    setSubtitle(concept.emotion);
  }

  function downloadThumbnail() {
    const canvas = canvasRef.current;

    if (!canvas || !captured) {
      alert("Please capture a video frame first.");
      return;
    }

    const ctx = canvas.getContext("2d");
    if (ctx) drawText(ctx);

    const link = document.createElement("a");
    link.download = "GetYourThumbnail.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  return (
    <main className="page">
      <header className="header">
        <div className="logo">GET<span>YOUR</span>THUMBNAIL</div>
        <div className="tag">AI THUMBNAIL STUDIO</div>
      </header>

      <section className="hero">
        <p className="eyebrow">YOUR CREATIVE STUDIO</p>
        <h1>Create Thumbnails That <span>Get Clicks.</span></h1>
        <p className="description">
          Upload your video, let AI understand its scenes,
          and create professional thumbnail concepts.
        </p>
      </section>

      <section className="studio">
        <div className="panel">
          <h2>01. Upload your video</h2>

          <label className="upload">
            <span className="uploadIcon">＋</span>
            <strong>Choose video</strong>
            <small>MP4, MOV or WebM</small>
            <input
              type="file"
              accept="video/mp4,video/webm,video/quicktime,video/*"
              onChange={uploadVideo}
            />
          </label>

          {videoURL && (
            <div className="videoBox">
              <video
                ref={videoRef}
                src={videoURL}
                controls
                playsInline
                onLoadedMetadata={() => setCaptured(false)}
              />

              <button className="primary" onClick={captureFrame}>
                Capture current frame
              </button>
            </div>
          )}

          <h2>02. AI Video Analyzer</h2>

          <label className="fieldLabel">
            Optional video description
          </label>

          <textarea
            className="textInput descriptionInput"
            value={description}
            maxLength={1000}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Tell AI anything important about your video..."
          />

          <button
            className="aiButton"
            onClick={analyzeVideo}
            disabled={!videoURL || analyzing}
          >
            {analyzing ? "AI IS ANALYZING YOUR VIDEO..." : "✦ ANALYZE VIDEO WITH AI"}
          </button>

          <p className="hint">
            AI samples 6 frames from your video. Keep the video open while
            analysis is running.
          </p>

          {analysisError && (
            <div className="errorBox">{analysisError}</div>
          )}

          <h2>03. Customize thumbnail</h2>

          <label className="fieldLabel">Main headline</label>
          <input
            className="textInput"
            value={headline}
            maxLength={55}
            onChange={(e) => setHeadline(e.target.value)}
          />

          <label className="fieldLabel">Subtitle</label>
          <input
            className="textInput"
            value={subtitle}
            maxLength={65}
            onChange={(e) => setSubtitle(e.target.value)}
          />

          <h2>04. Select design</h2>

          <div className="designs">
            <button
              className={design === 1 ? "design active" : "design"}
              onClick={() => updateDesign(1)}
            >
              Design 01
            </button>

            <button
              className={design === 2 ? "design active" : "design"}
              onClick={() => updateDesign(2)}
            >
              Design 02
            </button>
          </div>

          <button
            className="secondary"
            onClick={updateThumbnailText}
            disabled={!captured}
          >
            Update thumbnail text
          </button>

          <button
            className="primary download"
            onClick={downloadThumbnail}
            disabled={!captured}
          >
            Download PNG ↓
          </button>
        </div>

        <div className="previewPanel">
          <div className="previewHeading">
            <h2>Live Preview</h2>
            <span>16:9 · 1280 × 720</span>
          </div>

          <div className="canvasWrap">
            <canvas ref={canvasRef} />

            {!captured && (
              <div className="empty">
                <div className="emptyIcon">▶</div>
                <strong>Your thumbnail appears here</strong>
                <small>Upload a video and capture a frame.</small>
              </div>
            )}
          </div>

          <p className="hint">
            Choose a clear and exciting video frame for your thumbnail.
          </p>

          {summary && (
            <div className="summaryBox">
              <h3>AI Video Summary</h3>
              <p>{summary}</p>
            </div>
          )}

          {concepts.length > 0 && (
            <div className="results">
              <h2>✦ Your 4 AI Thumbnail Concepts</h2>

              {concepts.map((concept, index) => (
                <article className="concept" key={index}>
                  <div className="conceptTop">
                    <span>CONCEPT 0{index + 1}</span>
                    <strong>{concept.headline}</strong>
                  </div>

                  <p><b>Scene:</b> {concept.visual_scene}</p>
                  <p><b>Emotion:</b> {concept.emotion}</p>
                  <p><b>Colors:</b> {concept.color_style}</p>

                  <button
                    className="secondary"
                    onClick={() => useConcept(concept)}
                  >
                    Use this headline
                  </button>

                  <details>
                    <summary>View AI image prompt</summary>
                    <p>{concept.image_prompt}</p>
                  </details>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      <footer>
        © 2026 GetYourThumbnail · Create. Design. Download.
      </footer>

      <style jsx global>{`
        * { box-sizing: border-box; }
        body {
          margin: 0;
          background: #090914;
          color: #fff;
          font-family: Arial, sans-serif;
        }
        button, input, textarea { font: inherit; }
        .page { min-height: 100vh; padding: 22px 5%; }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 0 25px;
          border-bottom: 1px solid #28283b;
        }
        .logo { font-size: 19px; font-weight: 900; }
        .logo span { color: #a78bfa; }
        .tag, .eyebrow {
          color: #a78bfa;
          font-size: 11px;
          letter-spacing: 2px;
          font-weight: bold;
        }
        .hero { text-align: center; padding: 45px 10px; }
        .hero h1 { font-size: clamp(30px, 5vw, 54px); margin: 12px 0; }
        .hero h1 span { color: #a78bfa; }
        .description { color: #a6a6bd; line-height: 1.6; }
        .studio {
          max-width: 1200px;
          margin: auto;
          display: grid;
          grid-template-columns: minmax(260px, 0.8fr) minmax(300px, 1.2fr);
          gap: 24px;
        }
        .panel, .previewPanel {
          background: #141426;
          border: 1px solid #292940;
          border-radius: 18px;
          padding: 23px;
          min-width: 0;
        }
        h2 { font-size: 17px; margin: 20px 0 17px; }
        .upload {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 9px;
          padding: 25px;
          border: 1px dashed #7770b6;
          border-radius: 12px;
          background: #1c1b35;
          cursor: pointer;
          margin-bottom: 28px;
        }
        .upload input { display: none; }
        .uploadIcon { font-size: 32px; color: #b49aff; }
        small, .hint { color: #a6a6bd; font-size: 12px; }
        .videoBox { margin: -12px 0 25px; }
        video { width: 100%; border-radius: 10px; background: #000; }
        .fieldLabel {
          display: block;
          color: #c8c8dc;
          font-size: 13px;
          margin: 12px 0 7px;
        }
        .textInput {
          width: 100%;
          padding: 13px;
          border-radius: 9px;
          border: 1px solid #383852;
          background: #0d0d1b;
          color: white;
          outline: none;
        }
        .textInput:focus { border-color: #a78bfa; }
        .descriptionInput {
          min-height: 85px;
          resize: vertical;
        }
        .designs { display: flex; gap: 10px; margin: 12px 0 18px; }
        .design {
          flex: 1;
          padding: 13px 5px;
          border: 1px solid #383852;
          border-radius: 9px;
          background: #202039;
          color: white;
        }
        .design.active { border-color: #a78bfa; background: #38285c; }
        .primary, .secondary, .aiButton {
          width: 100%;
          padding: 14px;
          border: 0;
          border-radius: 9px;
          font-weight: bold;
          cursor: pointer;
          margin-top: 12px;
        }
        .primary {
          background: linear-gradient(100deg, #7548e8, #a855f7);
          color: white;
        }
        .secondary { background: #282843; color: white; }
        .aiButton {
          background: linear-gradient(100deg, #6335d4, #bd45d9);
          color: white;
          min-height: 50px;
        }
        button:disabled { opacity: .45; cursor: not-allowed; }
        .download { margin-top: 10px; }
        .previewHeading {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          align-items: center;
        }
        .previewHeading span { color: #a6a6bd; font-size: 11px; }
        .canvasWrap {
          position: relative;
          width: 100%;
          aspect-ratio: 16 / 9;
          background: #090914;
          border: 1px solid #34344c;
          border-radius: 12px;
          overflow: hidden;
          display: grid;
          place-items: center;
        }
        canvas { width: 100%; height: 100%; object-fit: contain; }
        .empty {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          color: #c5c2d8;
          text-align: center;
          pointer-events: none;
        }
        .emptyIcon {
          width: 55px;
          height: 55px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          background: #30234c;
          color: #c4a8ff;
          font-size: 23px;
        }
        .hint { line-height: 1.6; }
        .errorBox {
          margin-top: 15px;
          padding: 13px;
          border: 1px solid #9d414b;
          border-radius: 9px;
          background: #381c29;
          color: #ffb5bd;
          font-size: 13px;
          overflow-wrap: anywhere;
        }
        .summaryBox, .concept {
          margin-top: 18px;
          padding: 16px;
          border: 1px solid #383852;
          border-radius: 12px;
          background: #1b1b32;
          overflow-wrap: anywhere;
        }
        .summaryBox h3 { margin: 0 0 10px; font-size: 15px; }
        .summaryBox p, .concept p {
          color: #c5c5d8;
          font-size: 13px;
          line-height: 1.6;
        }
        .conceptTop {
          display: flex;
          flex-direction: column;
          gap: 9px;
        }
        .conceptTop span {
          color: #a78bfa;
          font-size: 10px;
          letter-spacing: 2px;
          font-weight: bold;
        }
        .conceptTop strong { font-size: 19px; }
        details {
          margin-top: 13px;
          color: #c5c5d8;
          font-size: 12px;
        }
        summary { cursor: pointer; color: #bca5ff; }
        footer {
          text-align: center;
          color: #77778e;
          padding: 35px 0 15px;
          font-size: 12px;
        }
        @media (max-width: 760px) {
          .studio { grid-template-columns: 1fr; }
          .header {
            align-items: flex-start;
            gap: 10px;
            flex-direction: column;
          }
          .hero { padding: 35px 5px; }
          .panel, .previewPanel { padding: 17px; }
        }
      `}</style>
    </main>
  );
                                  }
