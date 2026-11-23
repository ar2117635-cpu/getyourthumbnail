
"use client";

import React, { useRef, useState } from "react";

type Concept = {
  title: string;
  text: string;
  imagePrompt: string;
  image?: string;
};

export default function Home() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [video, setVideo] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [description, setDescription] = useState("");
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [selected, setSelected] = useState(0);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  function uploadVideo(file?: File) {
    if (!file) return;

    if (!file.type.startsWith("video/")) {
      setError("Please select a video file.");
      return;
    }

    if (file.size > 100 * 1024 * 1024) {
      setError("Video must be smaller than 100 MB.");
      return;
    }

    if (videoUrl) URL.revokeObjectURL(videoUrl);

    setVideo(file);
    setVideoUrl(URL.createObjectURL(file));
    setConcepts([]);
    setError("");
    setStatus("Video uploaded successfully.");
  }

  async function analyzeVideo() {
    const videoElement = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !videoElement || !canvas) {
      setError("Please upload a video first.");
      return;
    }

    setLoading(true);
    setError("");
    setStatus("Preparing video frames...");

    try {
      await new Promise<void>((resolve, reject) => {
        if (videoElement.readyState >= 2) {
          resolve();
          return;
        }

        videoElement.onloadeddata = () => resolve();
        videoElement.onerror = () => reject(new Error("Video could not load."));
        videoElement.load();
      });

      const context = canvas.getContext("2d");

      if (!context) throw new Error("Canvas is unavailable.");

      canvas.width = 640;
      canvas.height = 360;

      const duration = videoElement.duration;

      if (!Number.isFinite(duration) || duration <= 0) {
        throw new Error("Video duration could not be detected.");
      }

      const frames: string[] = [];

      for (let i = 0; i < 6; i++) {
        const time = Math.min(
          Math.max(0, (duration * (i + 1)) / 7),
          Math.max(0, duration - 0.2)
        );

        await new Promise<void>((resolve, reject) => {
          const timeout = window.setTimeout(() => {
            cleanup();
            reject(new Error("Video frame loading timed out. Try another MP4."));
          }, 15000);

          const cleanup = () => {
            clearTimeout(timeout);
            videoElement.removeEventListener("seeked", done);
            videoElement.removeEventListener("error", failed);
          };

          const done = () => {
            cleanup();
            resolve();
          };

          const failed = () => {
            cleanup();
            reject(new Error("Could not read video frame."));
          };

          videoElement.addEventListener("seeked", done, { once: true });
          videoElement.addEventListener("error", failed, { once: true });
          videoElement.currentTime = time;
        });

        context.drawImage(videoElement, 0, 0, 640, 360);
        frames.push(canvas.toDataURL("image/jpeg", 0.65));
      }

      setStatus("AI is analyzing your video...");

      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description, frames }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "AI analysis failed.");
      }

      const rawConcepts = data.concepts || data.thumbnails || [];

      if (!Array.isArray(rawConcepts) || rawConcepts.length === 0) {
        throw new Error("AI did not return thumbnail concepts.");
      }

      const formatted = rawConcepts.slice(0, 4).map((item: any, index: number) => ({
        title: item.title || `Concept ${index + 1}`,
        text: item.text || item.description || "",
        imagePrompt:
          item.imagePrompt ||
          item.image_prompt ||
          item.prompt ||
          item.description ||
          description,
      }));

      setConcepts(formatted);
      setSelected(0);
      setStatus("Analysis complete. Choose a concept.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setStatus("");
    } finally {
      setLoading(false);
    }
  }

  async function generateImage() {
    const concept = concepts[selected];

    if (!concept) return;

    setGenerating(true);
    setError("");
    setStatus("Generating thumbnail...");

    try {
      const response = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: concept.imagePrompt,
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
        throw new Error("No image was returned by the image API.");
      }

      setConcepts((previous) =>
        previous.map((item, index) =>
          index === selected ? { ...item, image } : item
        )
      );

      setStatus("Thumbnail generated successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Image generation failed.");
      setStatus("");
    } finally {
      setGenerating(false);
    }
  }

  function downloadThumbnail() {
    const image = concepts[selected]?.image;

    if (!image) {
      setError("Generate a thumbnail first.");
      return;
    }

    const link = document.createElement("a");
    link.href = image;
    link.download = "getyourthumbnail.png";
    link.click();
  }

  const current = concepts[selected];

  return (
    <main className="min-h-screen bg-[#080914] text-white">
      <header className="border-b border-white/10 px-5 py-5">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <h1 className="text-2xl font-black tracking-tight">
            GetYour<span className="text-violet-400">Thumbnail</span>
          </h1>
          <span className="rounded-full border border-violet-400/30 px-4 py-2 text-xs text-violet-300">
            AI THUMBNAIL STUDIO
          </span>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-5 py-12">
        <div className="mb-10 text-center">
          <p className="mb-3 text-sm font-bold tracking-[0.3em] text-violet-400">
            CREATE. DESIGN. GROW.
          </p>
          <h2 className="text-4xl font-black md:text-6xl">
            Create Thumbnails That
            <span className="block text-violet-400">Get More Clicks.</span>
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-gray-400">
            Upload your video, let AI analyze the best moments, and create
            powerful thumbnail concepts.
          </p>
        </div>

        <div className="grid gap-7 lg:grid-cols-2">
          <section className="rounded-3xl border border-white/10 bg-[#111225] p-6">
            <h3 className="mb-5 text-xl font-bold">1. Upload Your Video</h3>

            <input
              ref={fileRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(event) => uploadVideo(event.target.files?.[0])}
            />

            <button
              onClick={() => fileRef.current?.click()}
              className="w-full rounded-2xl border-2 border-dashed border-violet-400/40 bg-violet-400/5 p-10 text-center hover:bg-violet-400/10"
            >
              <div className="mb-3 text-4xl">↑</div>
              <div className="font-bold">Choose Video</div>
              <div className="mt-2 text-sm text-gray-400">
                MP4, MOV and other video formats · Max 100 MB
              </div>
            </button>

            {video && (
              <div className="mt-5">
                <video
                  ref={videoRef}
                  src={videoUrl}
                  controls
                  playsInline
                  preload="auto"
                  className="max-h-64 w-full rounded-xl bg-black"
                />
                <p className="mt-2 break-all text-sm text-gray-400">
                  {video.name}
                </p>
              </div>
            )}

            <div className="mt-6">
              <label className="mb-2 block text-sm font-bold">
                Describe Your Thumbnail (Optional)
              </label>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Example: Make an exciting gaming thumbnail with a dramatic action scene..."
                className="min-h-28 w-full rounded-xl border border-white/10 bg-[#080914] p-4 text-sm outline-none focus:border-violet-400"
              />
            </div>

            <button
              onClick={analyzeVideo}
              disabled={!video || loading}
              className="mt-6 w-full rounded-xl bg-violet-600 px-5 py-4 font-bold hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Analyzing Video..." : "Analyze Video With AI"}
            </button>

            <p className="mt-3 text-center text-xs text-gray-500">
              AI will study video frames and suggest four concepts.
            </p>

            {status && (
              <p className="mt-4 text-center text-sm text-green-400">
                {status}
              </p>
            )}

            {error && (
              <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
                {error}
              </p>
            )}
          </section>

          <section className="rounded-3xl border border-white/10 bg-[#111225] p-6">
            <h3 className="mb-5 text-xl font-bold">2. Thumbnail Studio</h3>

            {concepts.length === 0 ? (
              <div className="flex min-h-80 flex-col items-center justify-center rounded-2xl border border-white/10 bg-[#080914] p-8 text-center">
                <div className="mb-4 text-6xl">🎨</div>
                <h4 className="text-xl font-bold">Your Studio Is Ready</h4>
                <p className="mt-3 max-w-sm text-sm text-gray-400">
                  Upload a video and analyze it to see four AI thumbnail ideas
                  here.
                </p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  {concepts.map((concept, index) => (
                    <button
                      key={index}
                      onClick={() => setSelected(index)}
                      className={`rounded-xl border p-3 text-left ${
                        selected === index
                          ? "border-violet-400 bg-violet-400/10"
                          : "border-white/10 bg-[#080914]"
                      }`}
                    >
                      <div className="mb-2 text-xs font-bold text-violet-300">
                        CONCEPT {index + 1}
                      </div>
                      <div className="font-bold">{concept.title}</div>
                      <p className="mt-2 line-clamp-3 text-xs text-gray-400">
                        {concept.text}
                      </p>
                    </button>
                  ))}
                </div>

                <div className="mt-5 overflow-hidden rounded-xl border border-white/10 bg-[#080914]">
                  {current?.image ? (
                    <img
                      src={current.image}
                      alt="Generated thumbnail"
                      className="aspect-video w-full object-cover"
                    />
                  ) : (
                    <div className="flex aspect-video items-center justify-center text-center text-gray-500">
                      <div>
                        <div className="mb-3 text-5xl">🖼️</div>
                        <p>Your generated thumbnail will appear here.</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-4">
                  <h4 className="font-bold">{current?.title}</h4>
                  <p className="mt-2 text-sm text-gray-400">
                    {current?.text}
                  </p>
                </div>

                <button
                  onClick={generateImage}
                  disabled={generating}
                  className="mt-5 w-full rounded-xl bg-violet-600 px-5 py-4 font-bold hover:bg-violet-500 disabled:opacity-50"
                >
                  {generating ? "Generating..." : "Generate AI Thumbnail"}
                </button>

                <button
                  onClick={downloadThumbnail}
                  className="mt-3 w-full rounded-xl border border-white/15 px-5 py-4 font-bold hover:bg-white/5"
                >
                  Download Thumbnail PNG
                </button>
              </>
            )}
          </section>
        </div>

        <div className="mt-8 text-center text-xs text-gray-500">
          GetYourThumbnail · AI-powered thumbnail creation studio
        </div>
      </section>

      <canvas ref={canvasRef} className="hidden" />
    </main>
  );
                               }
