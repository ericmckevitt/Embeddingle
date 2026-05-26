import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Embeddingle",
  description: "Embedding-based word guessing proof of concept"
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
