"use client";

import React, { useRef, useState } from "react";

type Concept = {
  headline: string;
  visual_scene: string;
  emotion: string;
  color_style: string;
  image_prompt: string;
};

type GeneratedImage = {
  headline: string;
  image: string;
  loading: boolean;
  error: string;
};

export default function Home() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoURL, setVideoURL] = useState("");
  const [description, setDescription] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState("");
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [selected, setSelected] = useState(0);

  function uploadVideo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (videoURL) URL.revokeObjectURL(videoURL);

    setVideoURL(URL.createObjectURL(file));
    setConcepts([]);
    setImages([]);
    setSummary("");
    setError("");
  }

  async function waitForSeek(video: HTMLVideoElement) {
    return new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => {
        cleanup();
        reject(new Error("Video frame loading timed out."));
      }, 12000);

      const cleanup = () => {
        clearTimeout(timer);
        video.removeEventListener("seeked", done);
      };

      const done = () => {
        cleanup();
        resolve();
      };

      video.addEventListener("seeked", done, { once: true });
    });
  }

  async function analyzeVideo() {
    const video = videoRef.current;

    if (!video || !video.videoWidth || !video.duration) {
      setError("Please upload and load a video first.");
      return;
    }

    setAnalyzing(true);
    setError("");
    setConcepts([]);
    setImages([]);

    const originalTime = video.currentTime;
    const wasPaused = video.paused;

    try {
      const canvas = document.createElement("canvas");
      canvas.width = 640;
      canvas.height = 360;

      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Cannot prepare video frames.");

      const frames: string[] = [];
      const maxTime = Math.max(0, video.duration - 0.2);

      for (let i = 0; i < 6; i++) {
        const time = maxTime * (i / 5);

        if (Math.abs(video.currentTime - time) > 0.05) {
          const seeking = waitForSeek(video);
          video.currentTime = time;
          await seeking;
        }

        ctx.drawImage(video, 0, 0, 640, 360);
        frames.push(canvas.toDataURL("image/jpeg", 0.65));
      }

      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description, frames })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.details || data.error || "AI analysis failed.");
      }

      setSummary(data.video_summary || "");
      setConcepts(data.concepts);

      setImages(
        data.concepts.map((concept: Concept) => ({
          headline: concept.headline,
          image: "",
          loading: false,
          error: ""
        }))
      );

    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed.");
    } finally {
      try {
        if (Math.abs(video.currentTime - originalTime) > 0.05) {
          const seeking = waitForSeek(video);
          video.currentTime = originalTime;
          await seeking;
        }
      } catch {}

      if (!wasPaused) video.play().catch(() => {});
      setAnalyzing(false);
    }
  }

  async function generateImage(index: number) {
    const concept = concepts[index];
    if (!concept) return;

    setSelected(index);

    setImages(old =>
      old.map((item, i) =>
        i === index ? { ...item, loading: true, error: "" } : item
      )
    );

    try {
      const response = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: concept.image_prompt,
          headline: concept.headline
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.details || data.error || "Image generation failed.");
      }

      setImages(old =>
        old.map((item, i) =>
          i === index
            ? { ...item, image: data.image, loading: false }
            : item
        )
      );

    } catch (err) {
      setImages(old =>
        old.map((item, i) =>
          i === index
            ? {
                ...item,
                loading: false,
                error: err instanceof Error ? err.message : "Image failed."
              }
            : item
        )
      );
    }
  }

  function downloadImage(index: number) {
    const image = images[index];
    if (!image?.image) return;

    const link = document.createElement("a");
    link.href = image.image;
    link.download = `GetYourThumbnail-${index + 1}.png`;
    link.click();
  }

  return (
    <main className="app">
      <header className="header">
        <a className="logo" href="/">GET<span>YOUR</span>THUMBNAIL</a>
        <div className="headerTag">✦ AI CREATIVE STUDIO</div>
      </header>

      <section className="hero">
        <div className="pill">YOUR PERSONAL AI THUMBNAIL DESIGNER</div>
        <h1>Turn Videos Into <span>Viral Thumbnails.</span></h1>
        <p>
          Upload your video. Let AI understand the story.
          Generate cinematic thumbnails made to get clicks.
        </p>
      </section>

      <section className="workspace">
        <div className="left">
          <div className="card">
            <div className="sectionTitle">
              <span>01</span>
              <div>
                <h2>Upload your video</h2>
                <p>Start with your original video.</p>
              </div>
            </div>

            <label className="upload">
              <div className="uploadIcon">↑</div>
              <strong>Choose video file</strong>
              <small>MP4 · MOV · WebM</small>
              <input
                type="file"
                accept="video/*"
                onChange={uploadVideo}
              />
            </label>

            {videoURL && (
              <div className="videoPreview">
                <video
                  ref={videoRef}
                  src={videoURL}
                  controls
                  playsInline
                />
                <span>VIDEO READY</span>
              </div>
            )}
          </div>

          <div className="card">
            <div className="sectionTitle">
              <span>02</span>
              <div>
                <h2>Tell AI about your video</h2>
                <p>Optional details for better results.</p>
              </div>
            </div>

            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Example: A warrior fights a giant dragon in a burning castle..."
              maxLength={1000}
            />

            <button
              className="mainButton"
              onClick={analyzeVideo}
              disabled={!videoURL || analyzing}
            >
              {analyzing ? "✦ ANALYZING VIDEO..." : "✦ ANALYZE VIDEO WITH AI"}
            </button>

            {error && <div className="error">{error}</div>}

            <p className="note">
              AI analyzes 6 frames from your video to understand its scenes.
            </p>
          </div>

          <div className="card info">
            <div className="sectionTitle">
              <span>03</span>
              <div>
                <h2>Your export settings</h2>
                <p>Designed for YouTube thumbnails.</p>
              </div>
            </div>
            <div className="setting">
              <span>Aspect Ratio</span>
              <strong>16:9</strong>
            </div>
            <div className="setting">
              <span>Target Resolution</span>
              <strong>1280 × 720</strong>
            </div>
            <div className="setting">
              <span>Export Format</span>
              <strong>PNG</strong>
            </div>
          </div>
        </div>

        <div className="right">
          <div className="card resultsCard">
            <div className="resultsHeading">
              <div>
                <div className="eyebrow">AI WORKSPACE</div>
                <h2>Thumbnail Studio</h2>
                <p>Your AI-generated design concepts appear here.</p>
              </div>
              <div className="magic">✦</div>
            </div>

            {!concepts.length && (
              <div className="empty">
                <div className="emptyArt">
                  <div className="artIcon">✧</div>
                  <div className="artLine"></div>
                  <div className="artLine short"></div>
                </div>
                <h3>Your creativity starts here</h3>
                <p>Upload a video and click Analyze Video With AI.</p>
              </div>
            )}

            {summary && (
              <div className="summary">
                <strong>AI VIDEO SUMMARY</strong>
                <p>{summary}</p>
              </div>
            )}

            {concepts.length > 0 && (
              <>
                <div className="galleryTitle">
                  <h3>Four thumbnail concepts</h3>
                  <span>{concepts.length} CONCEPTS</span>
                </div>

                <div className="conceptGrid">
                  {concepts.map((concept, index) => (
                    <article
                      key={index}
                      className={selected === index ? "concept active" : "concept"}
                    >
                      <div className="conceptNumber">
                        CONCEPT 0{index + 1}
                      </div>
                      <h3>{concept.headline}</h3>
                      <p>{concept.visual_scene}</p>
                      <div className="conceptMeta">
                        <span>Emotion</span>
                        <strong>{concept.emotion}</strong>
                      </div>
                      <button
                        className="generateButton"
                        onClick={() => generateImage(index)}
                        disabled={images[index]?.loading}
                      >
                        {images[index]?.loading
                          ? "GENERATING..."
                          : images[index]?.image
                            ? "REGENERATE IMAGE ↻"
                            : "✦ GENERATE IMAGE"}
                      </button>

                      {images[index]?.error && (
                        <div className="error">
                          {images[index].error}
                        </div>
                      )}

                      {images[index]?.image && (
                        <div className="generated">
                          <img
                            src={images[index].image}
                            alt={concept.headline}
                          />
                          <button
                            className="downloadButton"
                            onClick={() => downloadImage(index)}
                          >
                            ↓ DOWNLOAD IMAGE
                          </button>
                        </div>
                      )}

                      <details>
                        <summary>View image prompt</summary>
                        <p>{concept.image_prompt}</p>
                      </details>
                    </article>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      <footer>
        GETYOURTHUMBNAIL · CREATE SOMETHING CLICK-WORTHY
      </footer>

      <style jsx global>{`
        * { box-sizing: border-box; }
        body {
          margin: 0;
          background: #090911;
          color: #fff;
          font-family: Arial, sans-serif;
        }
        button, textarea { font: inherit; }
        .app { min-height: 100vh; padding: 20px 5%; }
        .header {
          max-width: 1450px;
          margin: auto;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 14px 0 24px;
          border-bottom: 1px solid #28283b;
        }
        .logo {
          color: white;
          font-weight: 900;
          font-size: 20px;
          text-decoration: none;
          letter-spacing: -.5px;
        }
        .logo span { color: #aa83ff; }
        .headerTag {
          color: #bca3ff;
          font-size: 11px;
          letter-spacing: 2px;
          font-weight: bold;
        }
        .hero {
          text-align: center;
          max-width: 850px;
          margin: 55px auto 48px;
        }
        .pill {
          display: inline-block;
          border: 1px solid #49366f;
          background: #211834;
          color: #c9b5ff;
          border-radius: 30px;
          padding: 9px 15px;
          font-size: 10px;
          letter-spacing: 1.6px;
          font-weight: bold;
        }
        .hero h1 {
          font-size: clamp(34px, 5vw, 61px);
          line-height: 1.12;
          margin: 23px 0 15px;
          letter-spacing: -2px;
        }
        .hero h1 span {
          display: block;
          color: #ad8aff;
        }
        .hero p {
          color: #a7a6bd;
          line-height: 1.7;
          font-size: 15px;
        }
        .workspace {
          max-width: 1450px;
          margin: auto;
          display: grid;
          grid-template-columns: minmax(280px, .72fr) minmax(0, 1.5fr);
          gap: 22px;
          align-items: start;
        }
        .left { display: grid; gap: 18px; }
        .card {
          background: #141422;
          border: 1px solid #2d2b40;
          border-radius: 17px;
          padding: 22px;
          min-width: 0;
        }
        .sectionTitle {
          display: flex;
          gap: 13px;
          align-items: flex-start;
          margin-bottom: 22px;
        }
        .sectionTitle > span {
          width: 34px;
          height: 34px;
          flex: 0 0 34px;
          border-radius: 10px;
          background: #302248;
          display: grid;
          place-items: center;
          color: #c7aaff;
          font-size: 12px;
          font-weight: bold;
        }
        h2 { font-size: 17px; margin: 0 0 7px; }
        .sectionTitle p, .resultsHeading p {
          color: #89899f;
          font-size: 12px;
          margin: 0;
          line-height: 1.5;
        }
        .upload {
          min-height: 165px;
          border: 1px dashed #66528e;
          border-radius: 13px;
          background: #1c1a2d;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 10px;
          cursor: pointer;
        }
        .upload input { display: none; }
        .uploadIcon {
          width: 45px;
          height: 45px;
          display: grid;
          place-items: center;
          border-radius: 13px;
          background: #3a285a;
          color: #c9adff;
          font-size: 30px;
        }
        .upload small { color: #89899f; font-size: 11px; }
        .videoPreview { margin-top: 16px; }
        video { width: 100%; border-radius: 10px; background: #000; }
        .videoPreview span {
          display: block;
          margin-top: 7px;
          color: #a98aff;
          font-size: 10px;
          letter-spacing: 1px;
        }
        textarea {
          display: block;
          width: 100%;
          min-height: 115px;
          resize: vertical;
          padding: 14px;
          border-radius: 10px;
          background: #0c0c17;
          border: 1px solid #38364c;
          color: white;
          outline: none;
          font-size: 13px;
          line-height: 1.6;
        }
        textarea:focus { border-color: #a98aff; }
        .mainButton, .generateButton, .downloadButton {
          width: 100%;
          border: 0;
          border-radius: 10px;
          padding: 15px 10px;
          margin-top: 14px;
          cursor: pointer;
          color: white;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: .6px;
          background: linear-gradient(100deg, #7046db, #aa55e9);
        }
        button:disabled { opacity: .5; cursor: not-allowed; }
        .note {
          color: #85859a;
          font-size: 11px;
          line-height: 1.6;
          margin: 13px 0 0;
        }
        .setting {
          display: flex;
          justify-content: space-between;
          border-top: 1px solid #302e42;
          padding: 13px 0;
          font-size: 12px;
        }
        .setting span { color: #9291a7; }
        .setting strong { color: #ded8ef; }
        .resultsCard { padding: 26px; }
        .resultsHeading {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-bottom: 20px;
          border-bottom: 1px solid #302e42;
        }
        .eyebrow {
          color: #b79bff;
          font-size: 10px;
          letter-spacing: 2px;
          font-weight: bold;
          margin-bottom: 10px;
        }
        .resultsHeading h2 { font-size: 23px; }
        .magic {
          width: 46px;
          height: 46px;
          display: grid;
          place-items: center;
          background: #35244f;
          color: #d3baff;
          border-radius: 14px;
          font-size: 24px;
        }
        .empty {
          min-height: 350px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          text-align: center;
        }
        .emptyArt {
          width: 190px;
          height: 125px;
          border: 1px solid #51406e;
          border-radius: 14px;
          background: linear-gradient(140deg, #28203d, #11111d);
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          gap: 12px;
          transform: rotate(-3deg);
          margin-bottom: 25px;
        }
        .artIcon { color: #c5a6ff; font-size: 45px; }
        .artLine { width: 90px; height: 6px; border-radius: 10px; background: #69518c; }
        .artLine.short { width: 55px; background: #403652; }
        .empty h3 { margin: 0 0 9px; }
        .empty p { color: #88889d; font-size: 12px; }
        .summary {
          background: #211a34;
          border: 1px solid #49366a;
          border-radius: 12px;
          padding: 16px;
          margin: 18px 0;
        }
        .summary strong { color: #c5a7ff; font-size: 10px; letter-spacing: 1.5px; }
        .summary p { color: #d1c9e3; font-size: 13px; line-height: 1.6; }
        .galleryTitle {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin: 23px 0 15px;
          gap: 10px;
        }
        .galleryTitle h3 { margin: 0; font-size: 16px; }
        .galleryTitle span { color: #b89aff; font-size: 10px; }
        .conceptGrid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
        .concept {
          border: 1px solid #363349;
          background: #1b1a2a;
          border-radius: 13px;
          padding: 17px;
          min-width: 0;
          overflow-wrap: anywhere;
        }
        .concept.active { border-color: #9165dc; }
        .conceptNumber { color: #b89aff; font-size: 9px; letter-spacing: 1.5px; font-weight: bold; }
        .concept h3 { font-size: 19px; m
