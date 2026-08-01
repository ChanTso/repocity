import assert from "node:assert/strict";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders a lightweight RepoCity loading shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(
    html,
    /<title>RepoCity — Semantic City Prototype<\/title>/i,
  );
  assert.match(html, /Turn a codebase into an explorable semantic city/i);
  assert.match(html, /RepoCity/);
  assert.match(html, /零号城/);
  assert.match(html, /正在生成零号城/);
  assert.doesNotMatch(html, /数据旅程控制台/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/i);
});

test("keeps WebGL modules out of the server-rendered document", async () => {
  const response = await render();
  const html = await response.text();

  assert.doesNotMatch(html, /<canvas\b/i);
  assert.doesNotMatch(html, /城区图谱|搜索文件、模块或导出符号/);
});
