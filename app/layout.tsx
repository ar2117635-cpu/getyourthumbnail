
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "GetYourThumbnail – AI Thumbnail Studio",
  description:
    "Create engaging YouTube thumbnails from your videos with GetYourThumbnail.",
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
