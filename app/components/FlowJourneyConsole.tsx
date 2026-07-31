"use client";

import {
  Car,
  ChevronLeft,
  ChevronRight,
  Eye,
  Footprints,
  Network,
  Pause,
  Play,
  Radio,
  Ship,
  TrainFront,
  Truck,
} from "lucide-react";
import { useState } from "react";
import type {
  FlowJourneyMode,
  FlowJourneyView,
} from "./city/FlowJourneyLayer";

const MODE_LABELS: Record<FlowJourneyMode, string> = {
  pedestrian: "建筑内人流",
  car: "同步请求车流",
  transit: "历史 / 流水线列车",
  freight: "数据货运",
  boat: "静态产物 / 异步水运",
};

function ModeIcon({
  mode,
  size = 14,
}: {
  mode: FlowJourneyMode;
  size?: number;
}) {
  switch (mode) {
    case "pedestrian":
      return <Footprints size={size} />;
    case "car":
      return <Car size={size} />;
    case "transit":
      return <TrainFront size={size} />;
    case "freight":
      return <Truck size={size} />;
    case "boat":
      return <Ship size={size} />;
  }
}

export interface FlowJourneyConsoleProps {
  activeStepIndex: number;
  follow: boolean;
  journey: FlowJourneyView;
  playing: boolean;
  onSelectStep: (index: number) => void;
  onStep: (direction: -1 | 1) => void;
  onToggleFollow: () => void;
  onTogglePlaying: () => void;
}

export function FlowJourneyConsole({
  activeStepIndex,
  follow,
  journey,
  playing,
  onSelectStep,
  onStep,
  onToggleFollow,
  onTogglePlaying,
}: FlowJourneyConsoleProps) {
  const [evidenceExpanded, setEvidenceExpanded] = useState(false);
  const safeIndex = Math.max(
    0,
    Math.min(journey.steps.length - 1, activeStepIndex),
  );
  const step = journey.steps[safeIndex];
  const activeLegs = step
    ? journey.legs.filter((candidate) =>
        safeIndex === 0
          ? candidate.sourceEntityId === step.entityId
          : candidate.targetEntityId === step.entityId,
      )
    : [];
  const leg = activeLegs[0];
  const evidence = (journey.evidence ?? []).find((candidate) =>
    leg?.evidenceIds.includes(candidate.id),
  );
  const activeTokens = (journey.tokens ?? []).filter((token) =>
    activeLegs.some((candidate) => candidate.id === token.legId),
  );
  const returnTokenCount = activeTokens.filter(
    (token) => token.direction === "return",
  ).length;
  const mode = leg?.mode ?? "pedestrian";
  const progress =
    journey.steps.length <= 1
      ? 100
      : (safeIndex / (journey.steps.length - 1)) * 100;

  return (
    <section
      className="flow-console"
      aria-label="数据旅程控制台"
      data-playing={playing}
    >
      <div className="flow-console-controls">
        <button
          className="flow-play-button"
          type="button"
          onClick={onTogglePlaying}
          aria-label={playing ? "暂停数据旅程" : "播放数据旅程"}
        >
          {playing ? (
            <Pause size={18} fill="currentColor" />
          ) : (
            <Play size={18} fill="currentColor" />
          )}
        </button>
        <div className="flow-step-buttons">
          <button
            type="button"
            onClick={() => onStep(-1)}
            aria-label="上一个处理站"
          >
            <ChevronLeft size={14} />
          </button>
          <span>
            {safeIndex + 1}/{journey.steps.length}
          </span>
          <button
            type="button"
            onClick={() => onStep(1)}
            aria-label="下一个处理站"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      <div className="flow-console-main">
        <div className="flow-console-heading">
          <span className="flow-provenance">
            <Radio size={11} />
            {journey.provenance === "observed"
              ? "OBSERVED RUNTIME"
              : journey.provenance === "inferred"
                ? "INFERRED ROUTE"
                : "STRUCTURAL SIMULATION"}
          </span>
          <span className="flow-console-current">
            <small className="flow-journey-context">{journey.title}</small>
            <strong>
              {String(safeIndex + 1).padStart(2, "0")} ·{" "}
              {step?.label ?? "准备旅程"}
            </strong>
            <span className="flow-current-meta">
              <span className={`flow-mode flow-mode-${mode}`}>
                <ModeIcon mode={mode} />
                {MODE_LABELS[mode]}
              </span>
              {step ? (
                <code title={step.sourcePath}>{step.sourcePath}</code>
              ) : null}
            </span>
          </span>
          <button
            aria-label="跟随数据"
            className={follow ? "is-active" : ""}
            type="button"
            onClick={onToggleFollow}
            aria-pressed={follow}
          >
            <Eye size={12} />
            <span className="flow-follow-label">跟随数据</span>
          </button>
        </div>

        <div className="flow-station-track">
          <span
            className="flow-station-progress"
            style={{ width: `${progress}%` }}
          />
          {journey.steps.map((candidate, index) => (
            <button
              aria-current={index === safeIndex ? "step" : undefined}
              className={`${index < safeIndex ? "is-complete" : ""} ${
                index === safeIndex ? "is-current" : ""
              }`}
              key={candidate.id}
              onClick={() => onSelectStep(index)}
              style={{
                left: `${
                  (index / Math.max(1, journey.steps.length - 1)) * 100
                }%`,
              }}
              title={candidate.label}
              type="button"
            >
              <i />
              <span>{candidate.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flow-console-evidence">
        <div>
          <span className="flow-evidence-kicker">
            <Network size={11} />
            ROUTE EVIDENCE
          </span>
          <span className="flow-relative-density">
            模拟密度{" "}
            {Math.max(
              1,
              activeLegs.reduce(
                (sum, candidate) => sum + candidate.weight,
                0,
              ),
            )}
          </span>
        </div>
        <strong>
          {leg?.label ?? "旅程入口"}
        </strong>
        <p>{step?.detail ?? "选择一个处理站查看数据如何通过这座城市。"}</p>
        <button
          aria-expanded={evidenceExpanded}
          aria-label="查看当前路线证据"
          className="flow-evidence-note"
          onClick={() => setEvidenceExpanded((value) => !value)}
          type="button"
        >
          <Network size={11} />
          {activeLegs.length > 1
            ? `${activeLegs.length} 路${
                safeIndex === 0 ? "分流" : "汇流"
              } · ${activeLegs.map((candidate) => candidate.label).join(" / ")}`
            : leg
              ? `${leg.label} · ${
                  evidence?.label ??
                  (leg.relationIds.length > 0
                    ? `${leg.relationIds.length} 条静态关系`
                    : "场景规则")
                }${returnTokenCount > 0 ? ` · ${returnTokenCount} 辆响应车` : ""}`
              : "旅程入口 · 点击任意站点可验证来源"}
        </button>
        {evidence && evidenceExpanded ? (
          <span className="flow-evidence-reason">
            {evidence.provenance === "inferred"
              ? "静态推导"
              : "结构模拟"}{" "}
            · {evidence.confidence === "high" ? "高" : "中"}置信度 ·{" "}
            {evidence.relationIds.length > 0
              ? `${evidence.relationIds.length} 条 relation · `
              : "显式场景规则 · "}
            {evidence.reason}
          </span>
        ) : null}
      </div>
    </section>
  );
}
