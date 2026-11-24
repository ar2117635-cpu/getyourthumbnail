
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
  const videoRef = useRef<HTMLVideoElement>(null);

  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [description, setDescription] = useState("");
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState<number | null>(null);
  const [message, setMessage] = useState("");

  function handleVideoUpload(file?: File) {
    if (!file) return;

    if (!file.type.startsWith("video/")) {
      setMessage("Please upload a valid video.");
      return;
    }

    if (videoUrl) URL.revokeObjectURL(videoUrl);

    const url = URL.createObjectURL(file);

    setVideoFile(file);
    setVideoUrl(url);
    setConcepts([]);
    setDescription("");
    setMessage("");
  }

  async function captureVideoFrames(file: File): Promise<string[]> {
    const video = document.createElement("video");
    const url = URL.createObjectURL(file);

    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
    video.src = url;

    try {
      await new Promise<void>((resolve, reject) => {
        const timeout = window.setTimeout(() => {
          reject(new Error("Video loading timed out. Try a smaller video."));
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

      const duration = video.duration;

      if (!Number.isFinite(duration) || duration <= 0) {
        throw new Error("Unable to detect video duration.");
      }

      const times = [
        Math.min(duration * 0.2, Math.max(0, duration - 0.2)),
        Math.min(duration * 0.7, Math.max(0, duration - 0.1)),
      ];

      const frames: string[] = [];

      for (const time of times) {
        await new Promise<void>((resolve, reject) => {
          const timeout = window.setTimeout(() => {
            reject(new Error("Unable to capture video frame."));
          }, 10000);

          video.onseeked = () => {
            window.clearTimeout(timeout);
            resolve();
          };

          video.onerror = () => {
            window.clearTimeout(timeout);
            reject(new Error("Video frame capture failed."));
          };

          video.currentTime = time;
        });

        const canvas = document.createElement("canvas");
        const maxWidth = 512;
        const scale = Math.min(1, maxWidth / video.videoWidth);

        canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
        canvas.height = Math.max(1, Math.round(video.videoHeight * scale));

        const context = canvas.getContext("2d");

        if (!context) {
          throw new Error("Could not process video frame.");
        }

        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        frames.push(canvas.toDataURL("image/jpeg", 0.65));
      }

      return frames;
    } finally {
      video.pause();
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(url);
    }
  }

  async function analyzeVideo() {
    if (!videoFile) {
      setMessage("Please upload a video first.");
      return;
    }

    setLoading(true);
    setConcepts([]);
    setMessage("Reading video scenes...");

    try {
      const frames = await captureVideoFrames(videoFile);

      setMessage("AI is analyzing your video...");

      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          description: description,
          frames,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.details || data.error || "Video analysis failed."
        );
      }

      const results = data.concepts || data.result?.concepts;

      if (!Array.isArray(results) || results.length === 0) {
        throw new Error("AI did not return any thumbnail concepts.");
      }

      const formatted: Concept[] = results.map(
        (item: Record<string, unknown>, index: number) => ({
          title: String(item.title || `Thumbnail Concept ${index + 1}`),
          description: String(item.description || ""),
          prompt: String(item.prompt || item.description || item.title || ""),
          imageUrl: undefined,
        })
      );

      setConcepts(formatted);
      setMessage(`${formatted.length} thumbnail concepts created!`);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }

  async function generateImage(index: number) {
    const concept = concepts[index];

    if (!concept) return;

    setGenerating(index);
    setMessage(`Generating image for ${concept.title}...`);

    try {
      const response = await fetch("/api/generate-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: concept.prompt,
          description: concept.description || description,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.details || data.error || "Image generation failed."
        );
      }

      const imageUrl =
        data.imageUrl || data.image_url || data.url || data.image;

      if (!imageUrl) {
        throw new Error("No image was returned by the AI.");
      }

      setConcepts((previous) =>
        previous.map((item, i) =>
          i === index ? { ...item, imageUrl } : item
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
    link.download = `thumbnail-concept-${index + 1}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <main className="min-h-screen bg-[#090914] text-white px-4 py-8">
      <div className="max-w-6xl mx-auto">

        <header className="text-center mb-10">
          <div className="text-purple-400 font-bold tracking-widest text-sm mb-3">
            GETYOURTHUMBNAIL
          </div>

          <h1 className="text-4xl md:text-6xl font-extrabold mb-4">
            Create Stunning
            <span className="text-purple-400"> Thumbnails</span>
          </h1>

          <p className="text-gray-400 max-w-2xl mx-auto">
            Upload your video, let AI analyze your scenes and create
            attractive YouTube thumbnail concepts.
          </p>
        </header>

        <div className="grid md:grid-cols-2 gap-6">

          <section className="bg-[#141323] border border-[#302c45] rounded-2xl p-6">

            <h2 className="text-xl font-bold mb-5">
              01. Upload Your Video
            </h2>

            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                handleVideoUpload(event.dataTransfer.files[0]);
              }}
              className="border-2 border-dashed border-purple-500/50 bg-[#1b1930] rounded-xl p-8 text-center cursor-pointer hover:border-purple-400 transition"
            >
              <div className="text-5xl mb-3">🎬</div>

              <p className="font-semibold">
                Click or drag your video here
              </p>

              <p className="text-gray-500 text-sm mt-2">
                Upload MP4 or another supported video format
              </p>

              <input
                ref={fileRef}
                type="file"
                accept="video/*"
                hidden
                onChange={(event) =>
                  handleVideoUpload(event.target.files?.[0])
                }
              />
            </div>

            {videoUrl && (
              <div className="mt-5">
                <video
                  ref={videoRef}
                  src={videoUrl}
                  controls
                  playsInline
                  className="w-full rounded-xl max-h-72 bg-black"
                />

                <p className="text-sm text-green-400 mt-2 break-all">
                  {videoFile?.name}
                </p>
              </div>
            )}

            <h3 className="font-semibold mt-7 mb-3">
              Video Description (Optional)
            </h3>

            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Describe your video or tell AI what kind of thumbnail you want..."
              className="w-full min-h-28 bg-[#0d0c18] border border-[#37314e] rounded-xl p-4 outline-none focus:border-purple-500 resize-y"
            />

            <button
              onClick={analyzeVideo}
              disabled={!videoFile || loading}
              className="w-full mt-5 rounded-xl p-4 font-bold bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? "Analyzing Video..." : "✨ Analyze Video"}
            </button>

            <p className="text-xs text-gray-500 mt-3">
              AI analyzes selected frames from your video to suggest
              thumbnail concepts.
            </p>
          </section>

          <section className="bg-[#141323] border border-[#302c45] rounded-2xl p-6">

            <h2 className="text-xl font-bold mb-5">
              02. AI Thumbnail Concepts
            </h2>

            {concepts.length === 0 ? (
              <div className="min-h-72 flex flex-col items-center justify-center text-center bg-[#0d0c18] rounded-xl p-6">
                <div className="text-5xl mb-4">🎨</div>

                <p className="text-gray-300 font-semibold">
                  Your concepts will appear here
                </p>

                <p className="text-gray-500 text-sm mt-2">
                  Upload a video and click Analyze Video.
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                {concepts.map((concept, index) => (
                  <div
                    key={index}
                    className="bg-[#1b1930] border border-[#37314e] rounded-xl p-4"
                  >
                    <div className="flex justify-between items-center gap-3 mb-3">
                      <h3 className="font-bold">
                        {index + 1}. {concept.title}
                      </h3>

                      <span className="text-xs text-purple-300">
                        CONCEPT
                      </span>
                    </div>

                    <p className="text-gray-400 text-sm leading-6 mb-4">
                      {concept.description}
                    </p>

                    {concept.imageUrl && (
                      <img
                        src={concept.imageUrl}
                        alt={concept.title}
                        className="w-full rounded-lg mb-4"
                      />
                    )}

                    <button
                      onClick={() => generateImage(index)}
                      disabled={generating !== null}
                      className="w-full p-3 rounded-lg bg-purple-600 hover:bg-purple-500 font-semibold disabled:opacity-40"
                    >
                      {generating === index
                        ? "Generating Image..."
                        : concept.imageUrl
                          ? "Regenerate Image"
                          : "Generate Thumbnail Image"}
                    </button>

                    {concept.imageUrl && (
                      <button
                        onClick={() =>
                          downloadImage(concept.imageUrl!, index)
                        }
                        className="w-full p-3 mt-2 rounded-lg border border-purple-400 text-purple-300 hover:bg-purple-500/10"
                      >
                        ↓ Download Thumbnail
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {message && (
          <div className="mt-6 p-4 rounded-xl bg-[#1b1930] border border-purple-500/30 text-center text-sm break-words">
            {message}
          </div>
        )}

        <section className="mt-10 bg-gradient-to-r from-[#21183d] to-[#17152b] border border-purple-500/30 rounded-2xl p-6 text-center">
          <h2 className="text-2xl font-bold mb-2">
            Need to enhance an existing image?
          </h2>

          <p className="text-gray-400 text-sm mb-5">
            Improve image quality with AI and manual editing tools.
          </p>

          <a
            href="/enhancer"
            className="inline-block bg-purple-600 hover:bg-purple-500 rounded-xl px-8 py-3 font-bold"
          >
            Open Image Enhancer →
          </a>
        </section>

        <footer className="text-center text-gray-600 text-xs mt-12">
          © 2026 GetYourThumbnail. All rights reserved.
        </footer>

      </div>
    </main>
  );
          }
