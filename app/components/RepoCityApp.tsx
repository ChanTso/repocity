"use client";

import {
  ArrowUpRight,
  Box,
  Braces,
  Check,
  ChevronDown,
  CircleDot,
  Code2,
  Command,
  Copy,
  FileCode2,
  Focus,
  GitBranch,
  GitCommitHorizontal,
  History,
  Layers3,
  Map,
  Maximize2,
  Network,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Search,
  Settings2,
  Sparkles,
  SquareCode,
  X,
  Zap,
} from "lucide-react";
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { CityScene } from "./CityScene";
import {
  demoProject,
  getEntityById,
  getEntityHistory,
  getEntityRelations,
  type DemoEntity,
  type FileRole,
  type ViewerProject,
} from "../lib/demo-data";

type Mode = "explore" | "replay";
type InspectorTab = "overview" | "relations" | "history";

const roleLabels: Record<FileRole, string> = {
  source: "源码",
  test: "测试",
  docs: "文档",
  config: "配置",
  script: "脚本",
  other: "其他",
};

const roleColors: Record<FileRole, string> = {
  source: "#73b9ff",
  test: "#f5d76e",
  docs: "#ef8db2",
  config: "#ff9a6c",
  script: "#8fe0c7",
  other: "#b49cff",
};

const speedOptions = [0.5, 1, 2, 4];

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

function metric(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function findInitialEntity(entities: readonly DemoEntity[]) {
  return (
    entities.find((entity) => entity.path.includes("repo-shell")) ??
    entities[0]
  );
}

function ProjectDialog({
  onClose,
  onLoadDemo,
  onLoadTiny,
  loadState,
  loadError,
}: {
  onClose: () => void;
  onLoadDemo: () => void;
  onLoadTiny: () => void;
  loadState: "idle" | "loading" | "ready" | "error";
  loadError?: string;
}) {
  const [source, setSource] = useState("");
  const [copied, setCopied] = useState(false);
  const command = `npx repocity build ${source || "./my-repo"} --out ./public/projects/my-city`;

  async function copyCommand() {
    await navigator.clipboard.writeText(command);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void copyCommand();
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="project-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="dialog-orbit dialog-orbit-one" />
        <div className="dialog-orbit dialog-orbit-two" />
        <button
          className="icon-button dialog-close"
          type="button"
          onClick={onClose}
          aria-label="关闭"
        >
          <X size={17} />
        </button>
        <div className="dialog-kicker">
          <Plus size={13} />
          编译一座新城市
        </div>
        <h2 id="project-dialog-title">把仓库坐标交给 RepoCity</h2>
        <p>
          分析过程完全在本地完成。Viewer 只读取生成后的指标与历史数据，不包含源码正文。
        </p>
        <div className="project-presets">
          <button type="button" onClick={onLoadDemo}>
            <span className="preset-city preset-city-large">
              <i />
              <i />
              <i />
            </span>
            <span>
              <strong>产品演示城</strong>
              <small>254 栋建筑 · 完整交互</small>
            </span>
          </button>
          <button type="button" onClick={onLoadTiny} disabled={loadState === "loading"}>
            <span className="preset-city">
              <i />
              <i />
            </span>
            <span>
              <strong>{loadState === "loading" ? "正在读取…" : "Tiny Git 城市"}</strong>
              <small>5 commits · CLI 真实产物</small>
            </span>
          </button>
        </div>
        {loadError && <div className="bundle-error">{loadError}</div>}
        <div className="dialog-divider">
          <span>或编译你自己的仓库</span>
        </div>
        <form onSubmit={submit}>
          <label htmlFor="repo-source">本地路径或公开 Git URL</label>
          <div className="source-input">
            <GitBranch size={17} />
            <input
              id="repo-source"
              value={source}
              onChange={(event) => setSource(event.target.value)}
              placeholder="./projects/acme-web 或 https://github.com/acme/web"
              autoFocus
            />
          </div>
          <div className="privacy-note">
            <span className="privacy-pulse" />
            私有代码不会离开你的设备
          </div>
          <div className="command-preview">
            <code>{command}</code>
            <button
              type="button"
              onClick={copyCommand}
              aria-label="复制命令"
            >
              {copied ? <Check size={15} /> : <Copy size={15} />}
            </button>
          </div>
          <button className="primary-button dialog-submit" type="submit">
            <SquareCode size={16} />
            {copied ? "命令已复制" : "复制构建命令"}
          </button>
        </form>
      </section>
    </div>
  );
}

function EmptyInspector({
  onOpenProject,
}: {
  onOpenProject: () => void;
}) {
  return (
    <div className="empty-inspector">
      <div className="empty-building" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div className="eyebrow">CITY INSPECTOR</div>
      <h2>选择一栋建筑</h2>
      <p>点击城市中的建筑，查看它的职责、指标、依赖和关键历史。</p>
      <button className="quiet-button" type="button" onClick={onOpenProject}>
        <Plus size={15} />
        导入其他仓库
      </button>
    </div>
  );
}

function Inspector({
  entity,
  tab,
  onTab,
  onClose,
  onFocus,
  onSelect,
  currentCommitIndex,
  project,
}: {
  entity: DemoEntity;
  tab: InspectorTab;
  onTab: (tab: InspectorTab) => void;
  onClose: () => void;
  onFocus: () => void;
  onSelect: (entityId: string) => void;
  currentCommitIndex: number;
  project: ViewerProject;
}) {
  const relations = useMemo(
    () => getEntityRelations(entity.id, project.relations),
    [entity.id, project.relations],
  );
  const history = getEntityHistory(
    entity.id,
    project.entities,
    project.commits,
  );
  const latestCommit =
    history.filter((commit) => commit.index <= currentCommitIndex).at(-1) ??
    project.commits[Math.min(entity.bornAt, project.commits.length - 1)];
  const remoteUrl = project.manifest.repo.remoteUrl?.replace(/\.git\/?$/, "");
  const sourceUrl = remoteUrl
    ? `${remoteUrl}/blob/${project.manifest.repo.defaultBranch}/${entity.path}`
    : undefined;
  const diffUrl = remoteUrl
    ? `${remoteUrl}/commit/${latestCommit.sha}`
    : undefined;

  const relatedEntities = useMemo(() => {
    const seen = new Set<string>();
    return [
      ...relations.outgoing.map((relation) => ({
        direction: "uses" as const,
        relation,
        entity: getEntityById(relation.targetId, project.entities),
      })),
      ...relations.incoming.map((relation) => ({
        direction: "usedBy" as const,
        relation,
        entity: getEntityById(relation.sourceId, project.entities),
      })),
    ]
      .filter((item) => {
        if (!item.entity || seen.has(item.entity.id)) return false;
        seen.add(item.entity.id);
        return true;
      })
      .slice(0, 8);
  }, [project.entities, relations]);

  return (
    <div className="inspector-content">
      <div className="inspector-topline">
        <span
          className="role-badge"
          style={{
            color: roleColors[entity.role],
            borderColor: `${roleColors[entity.role]}55`,
            background: `${roleColors[entity.role]}14`,
          }}
        >
          <FileCode2 size={12} />
          {roleLabels[entity.role]}
        </span>
        <div className="inspector-actions">
          <button
            className="icon-button"
            type="button"
            onClick={onFocus}
            aria-label="聚焦建筑"
            title="聚焦建筑 · F"
          >
            <Focus size={16} />
          </button>
          <button
            className="icon-button"
            type="button"
            onClick={onClose}
            aria-label="关闭检查器"
          >
            <X size={16} />
          </button>
        </div>
      </div>
      <div className="file-heading">
        <div className="file-icon">
          <Braces size={21} />
        </div>
        <div>
          <h2>{entity.name}</h2>
          <p title={entity.path}>{entity.path}</p>
        </div>
      </div>
      <nav className="inspector-tabs" aria-label="检查器分区">
        {(
          [
            ["overview", "概览"],
            ["relations", `关系 ${relations.outgoing.length + relations.incoming.length}`],
            ["history", `历史 ${history.length}`],
          ] as const
        ).map(([value, label]) => (
          <button
            type="button"
            key={value}
            className={tab === value ? "active" : ""}
            onClick={() => onTab(value)}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === "overview" && (
        <div className="inspector-section-stack">
          <section className="inspector-section">
            <div className="section-label">
              <Sparkles size={13} />
              职责
            </div>
            <p className="summary-copy">{entity.summary}</p>
            <div className="fact-note">
              <CircleDot size={12} />
              基于路径与导出事实生成 · 非质量评分
            </div>
          </section>
          <section className="metric-grid" aria-label="文件指标">
            <div>
              <span>LOC</span>
              <strong>{metric(entity.maxMetrics.loc)}</strong>
              <small>历史峰值</small>
            </div>
            <div>
              <span>导出</span>
              <strong>{entity.maxMetrics.exports}</strong>
              <small>公开符号</small>
            </div>
            <div>
              <span>被依赖</span>
              <strong>{entity.maxMetrics.fanIn}</strong>
              <small>Fan in</small>
            </div>
            <div>
              <span>变更</span>
              <strong>{entity.maxMetrics.churn}</strong>
              <small>历史次数</small>
            </div>
          </section>
          <section className="inspector-section">
            <div className="section-label">
              <Code2 size={13} />
              导出符号
              <span>{entity.exportNames.length}</span>
            </div>
            <div className="symbol-list">
              {entity.exportNames.length ? (
                entity.exportNames
                  .slice(0, 5)
                  .map((name) => <code key={name}>{name}</code>)
              ) : (
                <span className="no-symbol-names">
                  {entity.maxMetrics.exports
                    ? `${entity.maxMetrics.exports} 个名称见 knowledge 文档`
                    : "无公开导出"}
                </span>
              )}
            </div>
          </section>
          <section className="inspector-section last-change">
            <div className="section-label">
              <GitCommitHorizontal size={13} />
              最近一次施工
            </div>
            <div className="commit-card">
              <div className="commit-dot" />
              <div>
                <strong>{latestCommit.message}</strong>
                <p>
                  <code>{latestCommit.sha.slice(0, 7)}</code>
                  <span>{latestCommit.authorName}</span>
                  <span>{formatDate(latestCommit.authoredAt)}</span>
                </p>
              </div>
            </div>
          </section>
        </div>
      )}

      {tab === "relations" && (
        <div className="inspector-section-stack relation-stack">
          <div className="relation-summary">
            <Network size={17} />
            当前只展开一阶关系，避免整座城市变成线团。
          </div>
          {relatedEntities.map((item) => (
            <button
              type="button"
              className="relation-row"
              key={`${item.direction}-${item.entity?.id}`}
              onClick={() => item.entity && onSelect(item.entity.id)}
            >
              <span
                className="relation-role-dot"
                style={{
                  background: item.entity
                    ? roleColors[item.entity.role]
                    : "#789",
                }}
              />
              <span>
                <strong>{item.entity?.name}</strong>
                <small>
                  {item.direction === "uses" ? "依赖" : "被此文件依赖"} · 权重{" "}
                  {item.relation.weight}
                </small>
              </span>
              <ArrowUpRight size={14} />
            </button>
          ))}
        </div>
      )}

      {tab === "history" && (
        <div className="history-list">
          {history.length === 0 ? (
            <p className="muted-copy">当前展示区间没有关键变更。</p>
          ) : (
            history
              .slice()
              .reverse()
              .map((commit) => (
                <button
                  type="button"
                  className="history-row"
                  key={commit.sha}
                  onClick={() => onTab("overview")}
                >
                  <span className="history-index">{commit.index + 1}</span>
                  <span>
                    <strong>{commit.message}</strong>
                    <small>
                      {commit.sha.slice(0, 7)} · {formatDate(commit.authoredAt)}
                    </small>
                  </span>
                </button>
              ))
          )}
        </div>
      )}

      <div className="inspector-footer">
        <a
          href={sourceUrl}
          target={sourceUrl ? "_blank" : undefined}
          rel={sourceUrl ? "noreferrer" : undefined}
          className={sourceUrl ? undefined : "is-disabled"}
          aria-disabled={!sourceUrl}
          onClick={(event) => {
            if (!sourceUrl) event.preventDefault();
          }}
        >
          <Code2 size={15} />
          {sourceUrl ? "打开源码" : "本地源码"}
          {sourceUrl && <ArrowUpRight size={13} />}
        </a>
        <a
          href={diffUrl}
          target={diffUrl ? "_blank" : undefined}
          rel={diffUrl ? "noreferrer" : undefined}
          className={diffUrl ? undefined : "is-disabled"}
          aria-disabled={!diffUrl}
          onClick={(event) => {
            if (!diffUrl) event.preventDefault();
          }}
        >
          <History size={15} />
          {diffUrl ? "查看 Diff" : "本地历史"}
        </a>
      </div>
    </div>
  );
}

export function RepoCityApp() {
  const [project, setProject] = useState<ViewerProject>(demoProject);
  const initialEntity = findInitialEntity(demoProject.entities);
  const [mode, setMode] = useState<Mode>("explore");
  const [commitIndex, setCommitIndex] = useState(
    demoProject.commits.length - 1,
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [selectedEntityId, setSelectedEntityId] = useState(initialEntity.id);
  const [focusEntityId, setFocusEntityId] = useState<string>();
  const [inspectorTab, setInspectorTab] =
    useState<InspectorTab>("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [projectOpen, setProjectOpen] = useState(false);
  const [projectLoadState, setProjectLoadState] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [projectLoadError, setProjectLoadError] = useState<string>();
  const [layersOpen, setLayersOpen] = useState(false);
  const [followConstruction, setFollowConstruction] = useState(true);
  const [hiddenDistricts, setHiddenDistricts] = useState<Set<string>>(
    new Set(),
  );
  const [copiedSha, setCopiedSha] = useState(false);
  const searchInput = useRef<HTMLInputElement>(null);

  const { manifest, districts, entities, relations, commits, chapters } =
    project;
  const selectedEntity = getEntityById(selectedEntityId, entities);
  const currentCommit =
    commits[commitIndex] ?? commits.at(-1) ?? demoProject.commits[0];
  const currentChapter =
    chapters.find(
      (chapter) =>
        commitIndex >= chapter.start && commitIndex <= chapter.end,
    ) ??
    chapters[0] ??
    demoProject.chapters[0];

  const filteredEntities = useMemo(
    () =>
      entities.filter(
        (entity) => !hiddenDistricts.has(entity.districtId),
      ),
    [entities, hiddenDistricts],
  );

  const activateProject = useCallback(
    (nextProject: ViewerProject, projectKey?: string | null) => {
      setProject(nextProject);
      const firstEntity = findInitialEntity(nextProject.entities);
      setSelectedEntityId(firstEntity?.id ?? "");
      setCommitIndex(Math.max(0, nextProject.commits.length - 1));
      setMode("explore");
      setIsPlaying(false);
      setHiddenDistricts(new Set());
      setInspectorTab("overview");
      setProjectLoadState("ready");
      setProjectLoadError(undefined);

      if (projectKey !== undefined) {
        const url = new URL(window.location.href);
        if (projectKey) url.searchParams.set("project", projectKey);
        else url.searchParams.delete("project");
        url.searchParams.delete("bundle");
        window.history.replaceState({}, "", url);
      }
    },
    [],
  );

  const loadStaticProject = useCallback(
    async (baseUrl: string, projectKey?: string) => {
      setProjectLoadState("loading");
      setProjectLoadError(undefined);
      try {
        const { loadProjectBundle } = await import("../lib/project-bundle");
        const nextProject = await loadProjectBundle(baseUrl);
        activateProject(nextProject, projectKey);
        setProjectOpen(false);
      } catch (error) {
        setProjectLoadState("error");
        setProjectLoadError(
          error instanceof Error
            ? error.message
            : "无法读取这个 RepoCity 数据包。",
        );
      }
    },
    [activateProject],
  );

  useEffect(() => {
    const parameters = new URLSearchParams(window.location.search);
    const projectKey = parameters.get("project");
    const bundleUrl = parameters.get("bundle");
    if (!projectKey && !bundleUrl) return;

    const controller = new AbortController();
    const baseUrl =
      bundleUrl ?? `/projects/${encodeURIComponent(projectKey ?? "")}`;

    void import("../lib/project-bundle")
      .then(({ loadProjectBundle }) =>
        loadProjectBundle(baseUrl, { signal: controller.signal }),
      )
      .then((nextProject) => activateProject(nextProject))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setProjectLoadState("error");
        setProjectLoadError(
          error instanceof Error
            ? error.message
            : "无法读取这个 RepoCity 数据包。",
        );
        setProjectOpen(true);
      });

    return () => controller.abort();
  }, [activateProject]);

  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return [];
    return entities
      .map((entity) => {
        const name = entity.name.toLowerCase();
        const path = entity.path.toLowerCase();
        const symbols = entity.exportNames.join(" ").toLowerCase();
        const score = name.startsWith(query)
          ? 0
          : name.includes(query)
            ? 1
            : path.includes(query)
              ? 2
              : symbols.includes(query)
                ? 3
                : 9;
        return { entity, score };
      })
      .filter((item) => item.score < 9)
      .sort((a, b) => a.score - b.score || a.entity.path.localeCompare(b.entity.path))
      .slice(0, 7);
  }, [entities, searchQuery]);

  useEffect(() => {
    if (!isPlaying || mode !== "replay") return;
    const timer = window.setInterval(
      () =>
        setCommitIndex((current) => {
          if (current >= commits.length - 1) {
            setIsPlaying(false);
            return current;
          }
          return current + 1;
        }),
      1050 / speed,
    );
    return () => window.clearInterval(timer);
  }, [commits.length, isPlaying, mode, speed]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const isTyping =
        target?.tagName === "INPUT" || target?.tagName === "TEXTAREA";
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchInput.current?.focus();
        setSearchOpen(true);
      }
      if (!isTyping && event.key.toLowerCase() === "f" && selectedEntityId) {
        setFocusEntityId(undefined);
        window.requestAnimationFrame(() =>
          setFocusEntityId(selectedEntityId),
        );
      }
      if (!isTyping && event.code === "Space" && mode === "replay") {
        event.preventDefault();
        setIsPlaying((value) => !value);
      }
      if (event.key === "Escape") {
        setSearchOpen(false);
        setProjectOpen(false);
        setLayersOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mode, selectedEntityId]);

  function selectEntity(entityId: string) {
    setSelectedEntityId(entityId);
    setInspectorTab("overview");
  }

  function focusEntity(entityId: string) {
    selectEntity(entityId);
    setFocusEntityId(undefined);
    window.requestAnimationFrame(() => setFocusEntityId(entityId));
  }

  function chooseSearchResult(entityId: string) {
    focusEntity(entityId);
    setSearchQuery("");
    setSearchOpen(false);
  }

  function switchMode(nextMode: Mode) {
    setMode(nextMode);
    setIsPlaying(false);
    if (nextMode === "explore") {
      setCommitIndex(commits.length - 1);
    } else if (mode !== "replay") {
      setCommitIndex(0);
    }
  }

  function toggleDistrict(districtId: string) {
    setHiddenDistricts((current) => {
      const next = new Set(current);
      if (next.has(districtId)) next.delete(districtId);
      else next.add(districtId);
      return next;
    });
  }

  async function copySha() {
    await navigator.clipboard.writeText(currentCommit.sha);
    setCopiedSha(true);
    window.setTimeout(() => setCopiedSha(false), 1200);
  }

  return (
    <main className="repo-app">
      <header className="topbar">
        <button
          type="button"
          className="brand"
          onClick={() => setProjectOpen(true)}
          aria-label="RepoCity 项目选择"
        >
          <span className="brand-mark" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span className="brand-copy">
            <strong>RepoCity</strong>
            <small>零号城</small>
          </span>
        </button>

        <button
          className="repo-selector"
          type="button"
          onClick={() => setProjectOpen(true)}
        >
          <span className="repo-avatar">
            <Box size={15} />
          </span>
          <span>
            <small>当前城市</small>
            <strong>{manifest.repo.name}</strong>
          </span>
          <span className="branch-label">
            <GitBranch size={12} />
            main
          </span>
          <ChevronDown size={14} />
        </button>

        <div className="global-search" data-open={searchOpen}>
          <Search size={16} />
          <input
            ref={searchInput}
            value={searchQuery}
            onChange={(event) => {
              setSearchQuery(event.target.value);
              setSearchOpen(true);
            }}
            onFocus={() => setSearchOpen(true)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && searchResults[0]) {
                chooseSearchResult(searchResults[0].entity.id);
              }
            }}
            placeholder="搜索文件、模块或导出符号…"
            aria-label="搜索城市"
          />
          <kbd>
            <Command size={11} />K
          </kbd>
          {searchOpen && searchQuery && (
            <div className="search-results">
              <div className="search-result-meta">
                <span>{searchResults.length} 个城市坐标</span>
                <small>ENTER 直达</small>
              </div>
              {searchResults.length ? (
                searchResults.map(({ entity }) => {
                  const district = districts.find(
                    (item) => item.id === entity.districtId,
                  );
                  return (
                    <button
                      type="button"
                      key={entity.id}
                      onClick={() => chooseSearchResult(entity.id)}
                    >
                      <span
                        className="search-file-icon"
                        style={{
                          color: roleColors[entity.role],
                          background: `${roleColors[entity.role]}16`,
                        }}
                      >
                        <FileCode2 size={15} />
                      </span>
                      <span>
                        <strong>{entity.name}</strong>
                        <small>{entity.path}</small>
                      </span>
                      <em>{district?.name}</em>
                    </button>
                  );
                })
              ) : (
                <div className="no-results">
                  城市里没有找到“{searchQuery}”
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mode-switch" aria-label="浏览模式">
          <button
            type="button"
            className={mode === "explore" ? "active" : ""}
            onClick={() => switchMode("explore")}
          >
            <Map size={14} />
            探索
          </button>
          <button
            type="button"
            className={mode === "replay" ? "active" : ""}
            onClick={() => switchMode("replay")}
          >
            <History size={14} />
            回放
          </button>
        </div>

        <div className="topbar-actions">
          <div className="layer-menu-wrap">
            <button
              className={`toolbar-button ${layersOpen ? "active" : ""}`}
              type="button"
              onClick={() => setLayersOpen((value) => !value)}
            >
              <Layers3 size={15} />
              视图
            </button>
            {layersOpen && (
              <div className="layer-popover">
                <div>
                  <span>城区图层</span>
                  <small>{districts.length - hiddenDistricts.size}/{districts.length} 可见</small>
                </div>
                {districts.map((district) => (
                  <label key={district.id}>
                    <input
                      type="checkbox"
                      checked={!hiddenDistricts.has(district.id)}
                      onChange={() => toggleDistrict(district.id)}
                    />
                    <span
                      className="district-swatch"
                      style={{ background: district.color }}
                    />
                    {district.name}
                  </label>
                ))}
              </div>
            )}
          </div>
          <button
            className="icon-button settings-button"
            type="button"
            aria-label="设置"
          >
            <Settings2 size={17} />
          </button>
          <button
            className="add-project-button"
            type="button"
            onClick={() => setProjectOpen(true)}
          >
            <Plus size={15} />
            新城市
          </button>
        </div>
      </header>

      <section className="workspace">
        <aside className="map-panel">
          <div className="map-panel-head">
            <div>
              <span className="eyebrow">CITY ATLAS</span>
              <h2>城区图谱</h2>
            </div>
            <button
              className="mini-icon-button"
              type="button"
              aria-label="重置图层"
              onClick={() => setHiddenDistricts(new Set())}
            >
              <RotateCcw size={13} />
            </button>
          </div>
          <div className="district-list">
            {districts.map((district) => {
              const count = entities.filter(
                (entity) => entity.districtId === district.id,
              ).length;
              const hidden = hiddenDistricts.has(district.id);
              return (
                <button
                  type="button"
                  key={district.id}
                  className={hidden ? "is-hidden" : ""}
                  onClick={() => toggleDistrict(district.id)}
                >
                  <span
                    className="district-beacon"
                    style={{
                      color: district.color,
                      background: `${district.color}18`,
                    }}
                  >
                    <span style={{ background: district.color }} />
                  </span>
                  <span>
                    <strong>{district.name}</strong>
                    <small>{district.eyebrow}</small>
                  </span>
                  <em>{count}</em>
                </button>
              );
            })}
          </div>
          <div className="legend">
            <div className="section-label">
              <Zap size={13} />
              城市图例
            </div>
            <p>
              <span className="legend-height" />
              高度 = 当前 LOC / 历史峰值
            </p>
            <p>
              <span className="legend-footprint" />
              占地 = log(历史最大 LOC)
            </p>
            <div className="role-legend">
              {(Object.keys(roleLabels) as FileRole[])
                .slice(0, 5)
                .map((role) => (
                  <span key={role}>
                    <i style={{ background: roleColors[role] }} />
                    {roleLabels[role]}
                  </span>
                ))}
            </div>
          </div>
          <div className="privacy-card">
            <span className="privacy-pulse" />
            <div>
              <strong>LOCAL FACTS ONLY</strong>
              <small>当前城市不依赖 AI</small>
            </div>
          </div>
        </aside>

        <div className="city-stage">
          <CityScene
            entities={filteredEntities}
            relations={relations}
            districts={districts.filter(
              (district) => !hiddenDistricts.has(district.id),
            )}
            commitIndex={commitIndex}
            changedEntityIds={currentCommit.changedEntityIds}
            selectedEntityId={selectedEntityId}
            onSelectEntity={selectEntity}
            focusEntityId={focusEntityId}
            followConstruction={mode === "replay" && followConstruction}
          />
          <div className="stage-vignette" />
          <div className="city-status">
            <span className="live-dot" />
            <span>
              <small>{mode === "replay" ? "REPLAY STATE" : "HEAD SNAPSHOT"}</small>
              <strong>
                {mode === "replay"
                  ? `建设阶段 ${commitIndex + 1}/${commits.length}`
                  : "城市已同步"}
              </strong>
            </span>
          </div>
          <div className="camera-hint">
            <span>左键旋转</span>
            <i />
            <span>滚轮缩放</span>
            <i />
            <span>右键平移</span>
            <kbd>F</kbd>
            <span>聚焦</span>
          </div>
          <div className="city-stats">
            <div>
              <strong>{manifest.stats.entityCount}</strong>
              <span>建筑</span>
            </div>
            <div>
              <strong>{manifest.stats.districtCount}</strong>
              <span>城区</span>
            </div>
            <div>
              <strong>{metric(relations.length)}</strong>
              <span>关系</span>
            </div>
          </div>
          {mode === "replay" && (
            <label className="follow-toggle">
              <input
                type="checkbox"
                checked={followConstruction}
                onChange={(event) =>
                  setFollowConstruction(event.target.checked)
                }
              />
              <span />
              <Focus size={13} />
              跟随施工
            </label>
          )}
        </div>

        <aside className="inspector-panel">
          {selectedEntity ? (
            <Inspector
              entity={selectedEntity}
              tab={inspectorTab}
              onTab={setInspectorTab}
              onClose={() => setSelectedEntityId("")}
              onFocus={() => focusEntity(selectedEntity.id)}
              onSelect={focusEntity}
              currentCommitIndex={commitIndex}
              project={project}
            />
          ) : (
            <EmptyInspector onOpenProject={() => setProjectOpen(true)} />
          )}
        </aside>
      </section>

      <footer className={`timeline ${mode === "replay" ? "is-active" : ""}`}>
        <div className="playback-controls">
          <button
            className="play-button"
            type="button"
            onClick={() => {
              if (mode !== "replay") switchMode("replay");
              else setIsPlaying((value) => !value);
            }}
            aria-label={isPlaying ? "暂停回放" : "播放回放"}
          >
            {isPlaying ? <Pause size={18} /> : <Play size={18} fill="currentColor" />}
          </button>
          <div className="speed-control">
            {speedOptions.map((value) => (
              <button
                type="button"
                className={speed === value ? "active" : ""}
                onClick={() => setSpeed(value)}
                key={value}
              >
                {value}×
              </button>
            ))}
          </div>
        </div>

        <div className="timeline-main">
          <div className="timeline-heading">
            <div>
              <span className="chapter-number">
                0{chapters.indexOf(currentChapter) + 1}
              </span>
              <span>
                <small>当前章节 · DIRECTOR CUT</small>
                <strong>{currentChapter.title}</strong>
              </span>
              <em>{currentChapter.subtitle}</em>
            </div>
            <button
              type="button"
              className="head-button"
              onClick={() => {
                setCommitIndex(commits.length - 1);
                setIsPlaying(false);
              }}
            >
              <Maximize2 size={12} />
              返回 HEAD
            </button>
          </div>
          <div className="timeline-track">
            <div className="chapter-labels" aria-hidden="true">
              {chapters.map((chapter) => (
                <span
                  key={chapter.id}
                  style={{
                    left: `${(chapter.start / Math.max(1, commits.length - 1)) * 100}%`,
                    width: `${((chapter.end - chapter.start + 1) / Math.max(1, commits.length)) * 100}%`,
                  }}
                >
                  {chapter.title}
                </span>
              ))}
            </div>
            <div className="track-line">
              <span
                className="track-progress"
                style={{
                  width: `${(commitIndex / Math.max(1, commits.length - 1)) * 100}%`,
                }}
              />
              {commits.map((commit) => (
                <button
                  type="button"
                  key={commit.sha}
                  className={`${commit.index <= commitIndex ? "passed" : ""} ${
                    commit.index === commitIndex ? "current" : ""
                  } ${commit.tags.length ? "release" : ""}`}
                  style={{
                    left: `${(commit.index / Math.max(1, commits.length - 1)) * 100}%`,
                  }}
                  onClick={() => {
                    setMode("replay");
                    setCommitIndex(commit.index);
                    setIsPlaying(false);
                  }}
                  aria-label={`跳到提交 ${commit.message}`}
                  title={commit.message}
                >
                  <span />
                </button>
              ))}
              <input
                aria-label="Git 历史时间轴"
                type="range"
                min={0}
                max={Math.max(0, commits.length - 1)}
                value={commitIndex}
                onChange={(event) => {
                  setMode("replay");
                  setCommitIndex(Number(event.target.value));
                  setIsPlaying(false);
                }}
              />
            </div>
          </div>
        </div>

        <div className="commit-detail">
          <div className="commit-meta-row">
            <span>
              <GitCommitHorizontal size={13} />
              COMMIT {commitIndex + 1}/{commits.length}
            </span>
            <span>{formatDate(currentCommit.authoredAt)}</span>
          </div>
          <strong>{currentCommit.message}</strong>
          <div className="commit-bottom-row">
            <button type="button" onClick={copySha}>
              {copiedSha ? <Check size={12} /> : <Copy size={12} />}
              <code>{currentCommit.sha.slice(0, 7)}</code>
            </button>
            <span className="additions">+{currentCommit.additions}</span>
            <span className="deletions">−{currentCommit.deletions}</span>
            {currentCommit.tags.map((tag) => (
              <span className="release-tag" key={tag}>
                {tag}
              </span>
            ))}
          </div>
        </div>
      </footer>

      {projectOpen && (
        <ProjectDialog
          onClose={() => setProjectOpen(false)}
          onLoadDemo={() => {
            activateProject(demoProject, null);
            setProjectOpen(false);
          }}
          onLoadTiny={() =>
            void loadStaticProject("/projects/tiny", "tiny")
          }
          loadState={projectLoadState}
          loadError={projectLoadError}
        />
      )}
      {searchOpen && (
        <button
          className="search-dismiss"
          type="button"
          aria-label="关闭搜索结果"
          onClick={() => setSearchOpen(false)}
        />
      )}
    </main>
  );
}
