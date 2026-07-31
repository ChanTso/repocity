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
  assert.match(html, /数据交通图例/);
  assert.match(html, /一个仓库如何变成一座城市/);
  assert.match(html, /数据旅程控制台/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/i);
});

test("exposes the core exploration and replay controls", async () => {
  const response = await render();
  const html = await response.text();

  assert.match(html, />探索</);
  assert.match(html, />流动</);
  assert.match(html, />回放</);
  assert.match(html, /打开源码/);
  assert.match(html, /查看 Diff/);
  assert.match(html, /STRUCTURAL SIMULATION/);
  assert.match(html, /跟随数据/);
  assert.match(html, /CLI \/ buildProject 编译城门/);
  assert.match(html, /Git 历史分析厂/);
  assert.match(html, /LOCAL FACTS ONLY/);
  // Flow mode names the same HEAD count as repository facts rather than
  // falsely claiming that every source file is a standalone building.
  assert.match(html, /<strong>244<\/strong><span>文件事实<\/span>/);
  assert.match(html, /<strong>6<\/strong><span>职责园区<\/span>/);
});
