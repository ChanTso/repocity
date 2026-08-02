import type { AmbientMobilityPlan } from "./ambient-mobility";

export interface EvidenceTokenSource {
  tokens: readonly unknown[];
}

export interface SceneMotionDiagnostics {
  evidenceTokenCount: number;
  plannedVehicleCount: number;
  plannedPedestrianCount: number;
  plannedBoatCount: number;
  enabledVehicleCount: number;
  enabledPedestrianCount: number;
  enabledBoatCount: number;
  visibleCountMeasured: false;
}

export function sceneMotionDiagnostics(
  plan: AmbientMobilityPlan | null | undefined,
  journey: EvidenceTokenSource | null | undefined,
  toggles: {
    showTraffic: boolean;
    showPedestrians: boolean;
    showWaterTraffic: boolean;
  },
): SceneMotionDiagnostics {
  const plannedVehicleCount = plan?.diagnostics.vehicleCount ?? 0;
  const plannedPedestrianCount = plan?.diagnostics.pedestrianCount ?? 0;
  const plannedBoatCount = plan?.diagnostics.boatCount ?? 0;
  return {
    evidenceTokenCount: journey?.tokens.length ?? 0,
    plannedVehicleCount,
    plannedPedestrianCount,
    plannedBoatCount,
    enabledVehicleCount: toggles.showTraffic ? plannedVehicleCount : 0,
    enabledPedestrianCount: toggles.showPedestrians ? plannedPedestrianCount : 0,
    enabledBoatCount: toggles.showWaterTraffic ? plannedBoatCount : 0,
    visibleCountMeasured: false,
  };
}
