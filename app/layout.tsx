
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://getyourthumbnail-pi.vercel.app"),

  title: "Free AI Thumbnail Maker | GetYourThumbnail",

  description:
    "Create eye-catching YouTube thumbnails with AI. Design professional thumbnails, enhance images, and create captions with GetYourThumbnail.",

  applicationName: "GetYourThumbnail",

  keywords: [
    "AI thumbnail maker",
    "YouTube thumbnail maker",
    "free thumbnail maker",
    "AI thumbnail generator",
    "thumbnail editor",
    "image enhancer",
    "AI caption generator",
  ],

  alternates: {
    canonical: "/",
  },

  robots: {
    index: true,
    follow: true,
  },

  openGraph: {
    type: "website",
    url: "https://getyourthumbnail-pi.vercel.app/",
    siteName: "GetYourThumbnail",
    title: "Free AI Thumbnail Maker | GetYourThumbnail",
    description:
      "Create eye-catching YouTube thumbnails with AI. Design professional thumbnails and enhance images.",
    locale: "en_US",
  },

  twitter: {
    card: "summary",
    title: "Free AI Thumbnail Maker | GetYourThumbnail",
    description:
      "Create professional AI thumbnails, enhance images, and generate captions.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
