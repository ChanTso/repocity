import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ??
    requestHeaders.get("host") ??
    "localhost:3000";
  const protocol =
    requestHeaders.get("x-forwarded-proto") ??
    (host.startsWith("localhost") || host.startsWith("127.0.0.1")
      ? "http"
      : "https");
  const metadataBase = new URL(`${protocol}://${host}`);
  const socialImage = new URL("/og.png", metadataBase).toString();

  return {
    metadataBase,
    title: {
      default: "RepoCity — Semantic City Prototype",
      template: "%s · RepoCity",
    },
    description:
      "Turn a codebase into an explorable semantic city with evidence-backed journeys.",
    applicationName: "RepoCity",
    keywords: [
      "RepoCity",
      "Git visualization",
      "codebase explorer",
      "Three.js",
      "semantic city",
      "代码可视化",
    ],
    openGraph: {
      title: "RepoCity — Public Semantic City Prototype",
      description: "Explore repository structure and evidence-backed journeys as an interactive 3D city.",
      type: "website",
      locale: "zh_CN",
      images: [
        {
          url: socialImage,
          width: 1280,
          height: 640,
          alt: "RepoCity semantic city beside a river and bridge",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "RepoCity — Public Semantic City Prototype",
      description: "Turn a codebase into an explorable semantic city.",
      images: [socialImage],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
