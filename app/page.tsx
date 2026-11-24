
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
  const [activeTab, setActiveTab] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
          prompt: String(
            item.prompt || item.description || item.title || ""
          ),
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

  function navigate(tab: string) {
    setActiveTab(tab);
    setSidebarOpen(false);
  }

  const menuItems = [
    { id: "dashboard", icon: "⌂", label: "Dashboard" },
    { id: "studio", icon: "✦", label: "Thumbnail Studio" },
    { id: "projects", icon: "▣", label: "My Projects" },
    { id: "history", icon: "◷", label: "Download History" },
    { id: "favorites", icon: "♡", label: "Favorites" },
    { id: "settings", icon: "⚙", label: "Settings" },
  ];

  const pageTitles: Record<string, string> = {
    dashboard: "Dashboard",
    studio: "Thumbnail Studio",
    projects: "My Projects",
    history: "Download History",
    favorites: "Favorite Designs",
    settings: "Settings",
  };

  return (
    <main className="app-shell">
      <style jsx global>{`
        * {
          box-sizing: border-box;
        }

        html, body {
          margin: 0;
          padding: 0;
          background: #080711;
          color: #f8f5ff;
          font-family: Arial, Helvetica, sans-serif;
        }

        button, input, textarea {
          font: inherit;
        }

        button {
          cursor: pointer;
        }

        .app-shell {
          min-height: 100vh;
          background:
            radial-gradient(ellipse at 65% 0%, #251348 0%, transparent 35%),
            radial-gradient(ellipse at 100% 65%, #101d43 0%, transparent 35%),
            #080711;
        }

        .sidebar {
          position: fixed;
          top: 0;
          bottom: 0;
          left: 0;
          width: 255px;
          padding: 25px 17px;
          background: rgba(12, 10, 24, .96);
          border-right: 1px solid #29203e;
          display: flex;
          flex-direction: column;
          z-index: 20;
          backdrop-filter: blur(20px);
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 11px;
          padding: 5px 8px 30px;
          border-bottom: 1px solid #282039;
        }

        .brand-icon {
          width: 39px;
          height: 39px;
          display: grid;
          place-items: center;
          border-radius: 12px;
          background: linear-gradient(135deg, #7545e8, #b44fe5);
          box-shadow: 0 0 25px #8549e955;
          font-size: 22px;
        }

        .brand-name {
          font-size: 16px;
          font-weight: 900;
          letter-spacing: -.5px;
        }

        .brand-name span {
          color: #bb8aff;
        }

        .nav-label {
          margin: 27px 10px 12px;
          color: #746b8b;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 1.8px;
        }

        .nav-item {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 13px;
          padding: 13px 12px;
          margin-bottom: 5px;
          border: 1px solid transparent;
          border-radius: 11px;
          background: transparent;
          color: #a9a1ba;
          text-align: left;
          font-size: 13px;
          transition: .2s;
        }

        .nav-item:hover {
          background: #1a1429;
          color: white;
        }

        .nav-item.active {
          color: white;
          border-color: #6943a3;
          background: linear-gradient(100deg, #37205e, #251638);
          box-shadow: inset 3px 0 #b17aff, 0 0 20px #8545c522;
        }

        .nav-icon {
          width: 21px;
          text-align: center;
          font-size: 18px;
        }

        .sidebar-bottom {
          margin-top: auto;
        }

        .upgrade-card {
          padding: 16px;
          border: 1px solid #49326c;
          border-radius: 14px;
          background: linear-gradient(140deg, #26183f, #171329);
        }

        .upgrade-card strong {
          display: block;
          font-size: 13px;
          margin-bottom: 7px;
        }

        .upgrade-card p {
          color: #a69ab9;
          font-size: 11px;
          line-height: 1.6;
          margin: 0 0 12px;
        }

        .upgrade-card button {
          width: 100%;
          padding: 9px;
          border: 0;
          border-radius: 8px;
          color: white;
          background: linear-gradient(100deg, #7546dc, #b34ed5);
          font-size: 11px;
          font-weight: bold;
        }

        .main-area {
          min-height: 100vh;
          margin-left: 255px;
          padding: 25px 32px 50px;
        }

        .topbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 15px;
          padding-bottom: 23px;
          border-bottom: 1px solid #292039;
        }

        .topbar-left {
          display: flex;
          align-items: center;
          gap: 13px;
        }

        .topbar h2 {
          font-size: 19px;
          margin: 0;
        }

        .topbar p {
          color: #8e849f;
          font-size: 11px;
          margin: 5px 0 0;
        }

        .top-actions {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .icon-button {
          width: 37px;
          height: 37px;
          border: 1px solid #342746;
          border-radius: 10px;
          background: #171222;
          color: #d8c7f5;
          font-size: 16px;
        }

        .avatar {
          width: 37px;
          height: 37px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          background: linear-gradient(135deg, #7545e8, #d15bce);
          font-weight: 900;
        }

        .mobile-menu {
          display: none;
          width: 38px;
          height: 38px;
          border: 1px solid #45315f;
          border-radius: 10px;
          color: white;
          background: #1a1428;
          font-size: 19px;
        }

        .content {
          max-width: 1450px;
          margin: auto;
        }

        .welcome {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 20px;
          flex-wrap: wrap;
          margin: 29px 0 24px;
        }

        .welcome h1 {
          margin: 0;
          font-size: clamp(25px, 3vw, 35px);
          letter-spacing: -1.2px;
        }

        .welcome p {
          margin: 9px 0 0;
          color: #9b91ad;
          font-size: 13px;
        }

        .gradient-text {
          background: linear-gradient(100deg, #a78aff, #ed8bff);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }

        .primary-button {
          padding: 12px 17px;
          border: 0;
          border-radius: 10px;
          color: white;
          font-weight: bold;
          font-size: 12px;
          background: linear-gradient(100deg, #7043dc, #b34ed4);
          box-shadow: 0 5px 22px #9146db44;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
          margin-bottom: 22px;
        }

        .stat-card {
          padding: 19px;
          border: 1px solid #302542;
          border-radius: 15px;
          background: linear-gradient(145deg, #191428, #100e1c);
          box-shadow: 0 12px 35px #0003;
        }

        .stat-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          color: #a59ab7;
          font-size: 11px;
        }

        .stat-symbol {
          width: 34px;
          height: 34px;
          display: grid;
          place-items: center;
          border-radius: 10px;
          background: #38235a;
          color: #d2a8ff;
          font-size: 17px;
        }

        .stat-card strong {
          display: block;
          margin-top: 16px;
          font-size: 25px;
        }

        .stat-card small {
          display: block;
          margin-top: 5px;
          color: #827991;
          font-size: 10px;
        }

        .section-heading {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          margin: 27px 0 15px;
        }

        .section-heading h2 {
          font-size: 17px;
          margin: 0;
        }

        .section-heading span {
          color: #9c87c1;
          font-size: 11px;
        }

        .tool-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 17px;
        }

        .tool-card {
          position: relative;
          overflow: hidden;
          min-height: 205px;
          padding: 23px;
          border: 1px solid #493365;
          border-radius: 17px;
          background: linear-gradient(135deg, #211637, #141124);
          transition: .25s;
        }

        .tool-card:hover {
          transform: translateY(-4px);
          border-color: #b17aff;
          box-shadow: 0 12px 35px #9146db22;
        }

        .tool-card.blue {
          background: linear-gradient(135deg, #14223d, #111426);
          border-color: #30466b;
        }

        .tool-card h3 {
          margin: 15px 0 8px;
          font-size: 18px;
        }

        .tool-card p {
          max-width: 420px;
          color: #a59bb6;
          font-size: 12px;
          line-height: 1.7;
        }

        .tool-emoji {
          width: 45px;
          height: 45px;
          display: grid;
          place-items: center;
          border-radius: 13px;
          background: #51327d;
          font-size: 23px;
        }

        .blue .tool-emoji {
          background: #263d66;
        }

        .tool-open {
          margin-top: 15px;
          padding: 0;
          border: 0;
          color: #d0a5ff;
          background: transparent;
          font-size: 11px;
          font-weight: 900;
        }

        .blue .tool-open {
          color: #9fc7ff;
        }

        .lower-grid {
          display: grid;
          grid-template-columns: 1.3fr .7fr;
          gap: 16px;
          margin-top: 20px;
        }

        .panel {
          min-width: 0;
          padding: 21px;
          border: 1px solid #302542;
          border-radius: 15px;
          background: linear-gradient(145deg, #171327, #100e1b);
        }

        .panel h3 {
          margin: 0 0 7px;
          font-size: 15px;
        }

        .muted {
          color: #978da8;
          font-size: 12px;
          line-height: 1.7;
        }

        .activity-row {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 13px 0;
          border-bottom: 1px solid #292039;
        }

        .activity-row:last-child {
          border-bottom: 0;
        }

        .activity-icon {
          width: 35px;
          height: 35px;
          display: grid;
          place-items: center;
          border-radius: 10px;
          background: #2a1d43;
          color: #d1a6ff;
        }

        .activity-row strong {
          display: block;
          font-size: 12px;
        }

        .activity-row small {
          display: block;
          margin-top: 4px;
          color: #81778f;
          font-size: 10px;
        }

        .studio-grid {
          display: grid;
          grid-template-columns: minmax(0, .9fr) minmax(0, 1.1fr);
          gap: 18px;
          align-items: start;
          margin-top: 25px;
        }

        .upload {
          margin-top: 20px;
          padding: 34px 14px;
          text-align: center;
          border: 1.5px dashed #8858bb;
          background: #1c1530;
          border-radius: 15px;
          cursor: pointer;
        }

        .upload:hover {
          border-color: #d19cff;
          box-shadow: 0 0 20px #a34bca22;
        }

        .upload-emoji {
          font-size: 38px;
          margin-bottom: 12px;
        }

        .video-preview {
          width: 100%;
          max-height: 280px;
          border-radius: 12px;
          background: #000;
          margin-top: 15px;
        }

        .description-input {
          width: 100%;
          min-height: 105px;
          resize: vertical;
          background: #0c0a15;
          border: 1px solid #403252;
          color: white;
          border-radius: 11px;
          padding: 13px;
          margin-top: 10px;
          outline: none;
        }

        .description-input:focus {
          border-color: #a878ed;
        }

        .full-button {
          width: 100%;
          margin-top: 15px;
        }

        .message {
          margin-top: 15px;
          padding: 13px;
          border-radius: 10px;
          border: 1px solid #68418a;
          background: #21152f;
          color: #d9c1fa;
          font-size: 12px;
          overflow-wrap: anywhere;
        }

        .concept {
          border: 1px solid #3a2a50;
          background: #100e1d;
          border-radius: 13px;
          padding: 15px;
          margin-top: 13px;
        }

        .concept h4 {
          margin: 0;
          font-size: 14px;
        }

        .concept p {
          color: #a59bb5;
          font-size: 12px;
          line-height: 1.65;
        }

        .concept img {
          width: 100%;
          border-radius: 10px;
          display: block;
          margin: 12px 0;
        }

        .concept button {
          width: 100%;
          padding: 12px;
          border-radius: 9px;
          border: 1px solid #8c59bc;
          color: white;
          background: linear-gradient(100deg, #5831a4, #823eaf);
          font-weight: bold;
          font-size: 11px;
        }
