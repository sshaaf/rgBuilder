import type { UniversePackage } from "./types";

export type LodLevel = 1 | 2 | 3 | 4 | 5;

export interface UniverseNavState {
  lod: LodLevel;
  communityId: number | null;
  communityLabel: string | null;
  packageId: number | null;
  packageLabel: string | null;
  unitId: number | null;
  unitLabel: string | null;
  symbolName: string | null;
}

export const initialNavState: UniverseNavState = {
  lod: 1,
  communityId: null,
  communityLabel: null,
  packageId: null,
  packageLabel: null,
  unitId: null,
  unitLabel: null,
  symbolName: null,
};

const LOD_LABELS: Record<LodLevel, string> = {
  1: "COSMOS",
  2: "COMMUNITY",
  3: "PACKAGE",
  4: "UNIT",
  5: "FUNCTION",
};

export function lodLabel(lod: LodLevel): string {
  return LOD_LABELS[lod];
}

export function navToL1(): UniverseNavState {
  return { ...initialNavState };
}

export function navToL2(communityId: number, communityLabel: string): UniverseNavState {
  return {
    lod: 2,
    communityId,
    communityLabel,
    packageId: null,
    packageLabel: null,
    unitId: null,
    unitLabel: null,
    symbolName: null,
  };
}

export function navToL3(
  prev: UniverseNavState,
  packageId: number,
  packageLabel: string,
): UniverseNavState {
  return {
    ...prev,
    lod: 3,
    packageId,
    packageLabel,
    unitId: null,
    unitLabel: null,
    symbolName: null,
  };
}

export function navToL4(
  prev: UniverseNavState,
  unitId: number,
  unitLabel: string,
): UniverseNavState {
  return {
    ...prev,
    lod: 4,
    unitId,
    unitLabel,
    symbolName: null,
  };
}

export function navToL5(prev: UniverseNavState, symbolName: string): UniverseNavState {
  return {
    ...prev,
    lod: 5,
    symbolName,
  };
}

/** Skip L4 when `universe.json` has no units for the package. */
export function canSkipL4(pkg: UniversePackage | undefined): boolean {
  if (!pkg) return true;
  const units = pkg.units;
  return !units || units.length === 0;
}

export interface BreadcrumbSegment {
  label: string;
  navIndex: number;
}

export function breadcrumbSegments(
  state: UniverseNavState,
  skipL4: boolean,
): BreadcrumbSegment[] {
  const segments: BreadcrumbSegment[] = [{ label: "Universe", navIndex: 0 }];
  if (state.lod >= 2 && state.communityLabel) {
    segments.push({ label: state.communityLabel, navIndex: 1 });
  }
  if (state.lod >= 3 && state.packageLabel) {
    segments.push({ label: state.packageLabel, navIndex: 2 });
  }
  if (!skipL4 && state.lod >= 4 && state.unitLabel) {
    segments.push({ label: state.unitLabel, navIndex: 3 });
  }
  if (state.lod >= 5 && state.symbolName) {
    segments.push({
      label: state.symbolName,
      navIndex: skipL4 ? 3 : 4,
    });
  }
  return segments;
}

export function navFromBreadcrumbIndex(
  state: UniverseNavState,
  segmentIndex: number,
  skipL4: boolean,
): UniverseNavState {
  if (segmentIndex <= 0) return navToL1();
  if (segmentIndex === 1) {
    return navToL2(state.communityId ?? 0, state.communityLabel ?? "Community");
  }
  if (segmentIndex === 2) {
    return {
      ...state,
      lod: 3,
      unitId: null,
      unitLabel: null,
      symbolName: null,
    };
  }
  if (segmentIndex === 3) {
    if (!skipL4 && state.unitId != null) {
      return {
        ...state,
        lod: 4,
        symbolName: null,
      };
    }
    return state;
  }
  return state;
}

/** One LOD level up; returns null at L1 (caller may close panel). */
export function escBackNav(state: UniverseNavState, skipL4: boolean): UniverseNavState | null {
  if (state.lod === 5) {
    if (!skipL4 && state.unitId != null) {
      return { ...state, lod: 4, symbolName: null };
    }
    return {
      ...state,
      lod: 3,
      symbolName: null,
    };
  }
  if (state.lod === 4) {
    return {
      ...state,
      lod: 3,
      unitId: null,
      unitLabel: null,
      symbolName: null,
    };
  }
  if (state.lod === 3) {
    return navToL2(state.communityId ?? 0, state.communityLabel ?? "Community");
  }
  if (state.lod === 2) {
    return navToL1();
  }
  return null;
}
