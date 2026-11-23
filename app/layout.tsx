
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GetYourThumbnail - AI Thumbnail Studio",
  description: "Create powerful AI thumbnails from your videos.",
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
