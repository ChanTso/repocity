"use client";

import dynamic from "next/dynamic";

const RepoCityApp = dynamic(
  () => import("./RepoCityApp").then((module) => module.RepoCityApp),
  {
    ssr: false,
    loading: () => (
      <main className="repo-loading" aria-busy="true" aria-live="polite">
        <div className="repo-loading__mark" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <p className="eyebrow">SEMANTIC CITY</p>
        <h1>RepoCity</h1>
        <p>正在生成零号城…</p>
      </main>
    ),
  },
);

export function RepoCityClient() {
  return <RepoCityApp />;
}
