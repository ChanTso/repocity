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

test("server-renders the RepoCity product shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>RepoCity \/ 零号城<\/title>/i);
  assert.match(html, /RepoCity/);
  assert.match(html, /零号城/);
  assert.match(html, /城区图谱/);
  assert.match(html, /搜索文件、模块或导出符号/);
  assert.match(html, /Git 历史时间轴/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/i);
});

test("exposes the core exploration and replay controls", async () => {
  const response = await render();
  const html = await response.text();

  assert.match(html, />探索</);
  assert.match(html, />回放</);
  assert.match(html, /打开源码/);
  assert.match(html, /查看 Diff/);
  assert.match(html, /返回 HEAD/);
  assert.match(html, /LOCAL FACTS ONLY/);
  assert.match(html, /256|254/);
});
