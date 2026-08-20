export type LodLevel = 0 | 1 | 2 | 3;

export interface UniverseNavState {
  lod: LodLevel;
  communityId: number | null;
  communityLabel: string | null;
  packageId: number | null;
  packageLabel: string | null;
  symbolName: string | null;
}

export const initialNavState: UniverseNavState = {
  lod: 0,
  communityId: null,
  communityLabel: null,
  packageId: null,
  packageLabel: null,
  symbolName: null,
};

export function navToL0(): UniverseNavState {
  return { ...initialNavState };
}

export function navToL1(communityId: number, communityLabel: string): UniverseNavState {
  return {
    lod: 1,
    communityId,
    communityLabel,
    packageId: null,
    packageLabel: null,
    symbolName: null,
  };
}

export function navToL2(
  prev: UniverseNavState,
  packageId: number,
  packageLabel: string,
): UniverseNavState {
  return {
    ...prev,
    lod: 2,
    packageId,
    packageLabel,
    symbolName: null,
  };
}

export function navToL3(prev: UniverseNavState, symbolName: string): UniverseNavState {
  return {
    ...prev,
    lod: 3,
    symbolName,
  };
}

export function navFromBreadcrumbIndex(state: UniverseNavState, index: number): UniverseNavState {
  if (index <= 0) return navToL0();
  if (index === 1) {
    return navToL1(state.communityId ?? 0, state.communityLabel ?? "Community");
  }
  if (index === 2) {
    return {
      ...state,
      lod: 2,
      symbolName: null,
    };
  }
  return state;
}
