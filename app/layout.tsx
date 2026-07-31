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
      default: "RepoCity / 零号城",
      template: "%s · RepoCity",
    },
    description:
      "把 JS/TS 仓库编译成可探索的 3D 城市，并将 Git 历史回放为城市建设纪录片。",
    applicationName: "RepoCity",
    keywords: [
      "RepoCity",
      "Git visualization",
      "codebase explorer",
      "Three.js",
      "代码可视化",
    ],
    openGraph: {
      title: "RepoCity / 零号城",
      description: "走进你的代码库，看一座城市如何从第一行代码长成。",
      type: "website",
      locale: "zh_CN",
      images: [
        {
          url: socialImage,
          width: 1200,
          height: 628,
          alt: "RepoCity 零号城 — 一座由代码长成的城市",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "RepoCity / 零号城",
      description: "把仓库变成一座有空间记忆与时间因果的 3D 城市。",
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
