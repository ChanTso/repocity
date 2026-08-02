import { describe, expect, it } from "vitest";
import { sceneMotionDiagnostics } from "./scene-motion-diagnostics";

const plan = {
  diagnostics: { vehicleCount: 12, pedestrianCount: 18, boatCount: 2 },
} as Parameters<typeof sceneMotionDiagnostics>[0];

describe("scene motion diagnostics", () => {
  it.each([
    [null, 0],
    [{ tokens: [{}] }, 1],
    [{ tokens: [{}, {}, {}] }, 3],
  ])("reports the exact evidence token count", (journey, expected) => {
    expect(
      sceneMotionDiagnostics(plan, journey, {
        showTraffic: true,
        showPedestrians: true,
        showWaterTraffic: true,
      }).evidenceTokenCount,
    ).toBe(expected);
  });

  it("keeps evidence counts independent from pause state and ambient toggles", () => {
    const journey = { tokens: [{}, {}] };
    const enabled = sceneMotionDiagnostics(plan, journey, {
      showTraffic: true,
      showPedestrians: true,
      showWaterTraffic: true,
    });
    const disabled = sceneMotionDiagnostics(plan, journey, {
      showTraffic: false,
      showPedestrians: false,
      showWaterTraffic: false,
    });
    expect(enabled.evidenceTokenCount).toBe(2);
    expect(disabled.evidenceTokenCount).toBe(2);
    expect(disabled).toMatchObject({
      plannedVehicleCount: 12,
      plannedPedestrianCount: 18,
      plannedBoatCount: 2,
      enabledVehicleCount: 0,
      enabledPedestrianCount: 0,
      enabledBoatCount: 0,
      visibleCountMeasured: false,
    });
  });
});
