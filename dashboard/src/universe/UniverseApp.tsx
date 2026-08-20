import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { DEFAULT_GRAPH_TYPE_MASK, loadManifest, type DashboardManifest, type Metanode } from "../types";
import { useEngineWorker } from "../useEngineWorker";
import { AnalysisDrawer } from "./AnalysisDrawer";
import { availableAnalysisTools, type AnalysisToolId } from "./analysisTools";
import { Breadcrumb } from "./Breadcrumb";
import { LeftRail } from "./Chrome";
import { CommandsPanel } from "./CommandsPanel";
import { CosmosScene, type SceneNavApi } from "./CosmosScene";
import { HelpOverlay } from "./HelpOverlay";
import { HudChrome, UniverseBrand } from "./HudChrome";
import { filterOneHopNeighborhood } from "./callNeighborhood3d";
import type { L2Neighborhood } from "./l2Subgraph";
import { LodChip } from "./LodChip";
import {
  loadCommunitiesJson,
  loadMetagraph,
  loadSearchLandmarks,
  loadUniverseLayout,
} from "./loadData";
import {
  loadMigrationGraph,
  loadTaintIndex,
  migrationHotspotCommunityIds,
  taintCommunityIds as computeTaintCommunityIds,
} from "./analysisOverlays";
import {
  canSkipL4,
  escBackNav,
  initialNavState,
  navFromBreadcrumbIndex,
  navToL1,
  navToL2,
  navToL3,
  navToL4,
  navToL5,
  type UniverseNavState,
} from "./lodState";
import { NavigationControls } from "./NavigationControls";
import { SearchBar, type FlyTarget } from "./SearchBar";
import { SelectionPanel } from "./SelectionPanel";
import { findPackage, findUnit } from "./selectionPanelHelpers";
import { Toast, useToast } from "./Toast";
import type { SearchLandmark, UniverseLayout } from "./types";

const GALAXY_FOCUS_DISTANCE = 260 / 2.5;

interface SelectedSymbol {
  nodeIndex: number;
  name: string;
}

declare global {
  interface Window {
    __universeE2e?: {
      selectCommunity: (communityId: number) => void;
      selectPackage: (packageId: number) => Promise<void>;
      selectFunction: (nodeIndex: number, name: string) => void;
      firstL2Function: () => { nodeIndex: number; name: string } | null;
      l2NodeCount: () => number;
      lod: () => number;
      panelVisible: () => boolean;
    };
  }
}

export function UniverseApp() {
  const [manifest, setManifest] = useState<DashboardManifest | null>(null);
  const [layout, setLayout] = useState<UniverseLayout | null>(null);
  const [metanodes, setMetanodes] = useState<Metanode[]>([]);
  const [landmarks, setLandmarks] = useState<SearchLandmark[]>([]);
  const [communities, setCommunities] = useState<{ id: number; label: string; color: string }[]>(
    [],
  );
  const [nav, setNav] = useState<UniverseNavState>(initialNavState);
  const [flyTarget, setFlyTarget] = useState<FlyTarget | null>(null);
  const [highlightCommunityId, setHighlightCommunityId] = useState<number | null>(null);
  const [l2Neighborhood, setL2Neighborhood] = useState<L2Neighborhood | null>(null);
  const [selectedSymbol, setSelectedSymbol] = useState<SelectedSymbol | null>(null);
  const [sceneApi, setSceneApi] = useState<SceneNavApi | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const [commandsOpen, setCommandsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [migrationCommunityIds, setMigrationCommunityIds] = useState<number[]>([]);
  const [taintCommunityIds, setTaintCommunityIds] = useState<number[]>([]);
  const [bridgeEmphasis, setBridgeEmphasis] = useState(false);
  const [showSecurityOverlays, setShowSecurityOverlays] = useState(true);
  const [analysisTool, setAnalysisTool] = useState<AnalysisToolId | null>(null);
  const {
    engine,
    error: workerError,
    wasmReady,
    expand,
    listNodes,
    computeSlice,
    blastRadius,
    loadCfgDetail,
    computeDataflow,
  } = useEngineWorker();
  const analysisTools = availableAnalysisTools(manifest);
  const { message: toastMessage, showToast } = useToast();
  const searchFocusRef = useRef<(() => void) | null>(null);
  const navRef = useRef(nav);
  navRef.current = nav;
  const l2Ref = useRef(l2Neighborhood);
  l2Ref.current = l2Neighborhood;
  const helpOpenRef = useRef(helpOpen);
  helpOpenRef.current = helpOpen;
  const analysisToolRef = useRef(analysisTool);
  analysisToolRef.current = analysisTool;

  const toggleAnalysisTool = useCallback((id: AnalysisToolId) => {
    setAnalysisTool((prev) => (prev === id ? null : id));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [m, u, lm, comm, meta] = await Promise.all([
          loadManifest(),
          loadUniverseLayout(),
          loadSearchLandmarks(),
          loadCommunitiesJson(),
          loadMetagraph(),
        ]);
        if (!cancelled) {
          setManifest(m);
          setLayout(u);
          setLandmarks(lm);
          setCommunities(comm.communities ?? []);
          setMetanodes(meta?.nodes ?? []);
        }
      } catch (e) {
        if (!cancelled) {
          setBootError(e instanceof Error ? e.message : String(e));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!manifest) return;
    let cancelled = false;
    (async () => {
      if (manifest.analysis?.migration_available) {
        const graph = await loadMigrationGraph();
        if (graph && !cancelled) {
          setMigrationCommunityIds(migrationHotspotCommunityIds(graph));
        }
      }
      if (manifest.analysis?.taint_available) {
        const taint = await loadTaintIndex();
        if (taint && !cancelled) {
          setTaintCommunityIds(computeTaintCommunityIds(taint, landmarks));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [manifest, landmarks]);

  useEffect(() => {
    if (nav.lod < 3) setL2Neighborhood(null);
    if (nav.lod < 5) setSelectedSymbol(null);
  }, [nav.lod]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "?" && !e.metaKey && !e.ctrlKey) {
        setHelpOpen(true);
        return;
      }
      if (e.key !== "Escape") return;
      if (helpOpenRef.current) {
        setHelpOpen(false);
        return;
      }
      if (analysisToolRef.current) {
        setAnalysisTool(null);
        return;
      }
      const state = navRef.current;
      const pkg =
        state.packageId != null && layout
          ? findPackage(layout, state.packageId)
          : undefined;
      const back = escBackNav(state, canSkipL4(pkg));
      if (back) {
        setNav(back);
        if (back.lod <= 1) {
          setHighlightCommunityId(null);
          setL2Neighborhood(null);
          setSelectedSymbol(null);
          if (back.lod === 1) sceneApi?.recenter();
        }
        if (back.lod < 3) setL2Neighborhood(null);
        if (back.lod < 5) setSelectedSymbol(null);
        return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [layout, sceneApi]);

  const flyToPosition = useCallback(
    (position: FlyTarget["position"], communityId?: number, distance?: number) => {
      setFlyTarget({
        key: `${communityId ?? "x"}:${Date.now()}`,
        position,
        communityId,
        distance,
      });
      setHighlightCommunityId(communityId ?? null);
    },
    [],
  );

  const onFlyTo = (target: FlyTarget) => {
    setFlyTarget(target);
    setHighlightCommunityId(target.communityId ?? null);
  };

  const resetCosmos = useCallback(() => {
    setNav(navToL1());
    setHighlightCommunityId(null);
    setL2Neighborhood(null);
    setSelectedSymbol(null);
    sceneApi?.recenter();
  }, [sceneApi]);

  const onCommunityClick = useCallback(
    (communityId: number, communityLabel: string) => {
      const community = layout?.communities.find((c) => c.id === communityId);
      if (!community) return;
      setL2Neighborhood(null);
      setSelectedSymbol(null);
      setNav(navToL2(communityId, communityLabel));
      flyToPosition(community.position, communityId, GALAXY_FOCUS_DISTANCE);
    },
    [flyToPosition, layout],
  );

  const onPackageClick = useCallback(
    async (packageId: number, packageLabel: string) => {
      const pkg = layout?.packages.find((p) => p.id === packageId);
      if (!pkg || !navRef.current.communityId) return;
      setNav((prev) => navToL3(prev, packageId, packageLabel));
      setL2Neighborhood(null);
      const community = layout?.communities.find((c) => c.id === pkg.community_id);
      const anchor = community
        ? {
            x: community.position.x + pkg.position.x,
            y: community.position.y + pkg.position.y,
            z: community.position.z + pkg.position.z,
          }
        : pkg.position;
      if (community) {
        flyToPosition(anchor, community.id, GALAXY_FOCUS_DISTANCE / 1.6);
      }
      if (pkg.member_indices.length === 0) return;
      if (pkg.units && pkg.units.length > 0) return;
      if (!wasmReady) return;
      try {
        const payload = await expand(pkg.member_indices, DEFAULT_GRAPH_TYPE_MASK);
        if (payload.nodes.length > 0) {
          setL2Neighborhood({
            packageId,
            anchor,
            payload,
            mode: "package",
          });
        }
      } catch {
        /* expand errors surface via workerError */
      }
    },
    [expand, flyToPosition, layout, wasmReady],
  );

  const onUnitClick = useCallback(
    async (unitId: number, unitLabel: string) => {
      const pkg =
        navRef.current.packageId != null && layout
          ? findPackage(layout, navRef.current.packageId)
          : undefined;
      if (!pkg) return;
      const unit = findUnit(pkg, unitId);
      if (!unit) return;
      setNav((prev) => navToL4(prev, unitId, unitLabel));
      const community = layout?.communities.find((c) => c.id === pkg.community_id);
      const anchor = community
        ? {
            x: community.position.x + pkg.position.x,
            y: community.position.y + pkg.position.y,
            z: community.position.z + pkg.position.z,
          }
        : pkg.position;
      if (!wasmReady || unit.member_indices.length === 0) return;
      try {
        const payload = await expand(unit.member_indices, DEFAULT_GRAPH_TYPE_MASK);
        if (payload.nodes.length > 0) {
          setL2Neighborhood({
            packageId: pkg.id,
            unitId,
            anchor,
            payload,
            mode: "unit",
            filterIndices: unit.member_indices,
          });
        }
      } catch {
        /* workerError */
      }
    },
    [expand, layout, wasmReady],
  );

  const onFunctionClick = useCallback(
    async (nodeIndex: number, name: string) => {
      setNav((prev) => navToL5(prev, name));
      setSelectedSymbol({ nodeIndex, name });

      const state = navRef.current;
      const pkg =
        state.packageId != null && layout ? findPackage(layout, state.packageId) : undefined;
      if (!pkg || !wasmReady) return;

      const unit =
        state.unitId != null ? findUnit(pkg, state.unitId) : undefined;
      const indices = unit?.member_indices ?? pkg.member_indices;
      const anchor = l2Ref.current?.anchor;
      if (!anchor) return;

      try {
        const full = await expand(indices, DEFAULT_GRAPH_TYPE_MASK);
        const payload = filterOneHopNeighborhood(full, nodeIndex);
        setL2Neighborhood({
          packageId: pkg.id,
          unitId: state.unitId,
          anchor,
          payload,
          seedIndex: nodeIndex,
          mode: "call",
        });
      } catch {
        /* workerError */
      }
    },
    [expand, layout, wasmReady],
  );

  const onBreadcrumbNavigate = (index: number) => {
    const pkg =
      nav.packageId != null && layout ? findPackage(layout, nav.packageId) : undefined;
    const next = navFromBreadcrumbIndex(nav, index, canSkipL4(pkg));
    setNav(next);
    if (next.lod === 1) {
      setHighlightCommunityId(null);
      setL2Neighborhood(null);
      setSelectedSymbol(null);
      sceneApi?.recenter();
      return;
    }
    if (next.lod < 3) setL2Neighborhood(null);
    if (next.lod < 5) setSelectedSymbol(null);
    const community = layout?.communities.find((c) => c.id === next.communityId);
    if (community) {
      flyToPosition(
        community.position,
        community.id,
        next.lod >= 3 ? GALAXY_FOCUS_DISTANCE / 1.6 : GALAXY_FOCUS_DISTANCE,
      );
    }
  };

  useEffect(() => {
    if (!layout || !new URLSearchParams(window.location.search).has("e2e")) return;
    window.__universeE2e = {
      selectCommunity: (communityId: number) => {
        const c = layout.communities.find((x) => x.id === communityId);
        if (c) onCommunityClick(c.id, c.label);
      },
      selectPackage: async (packageId: number) => {
        const pkg = layout.packages.find((p) => p.id === packageId);
        if (pkg) await onPackageClick(pkg.id, pkg.label);
      },
      selectFunction: (nodeIndex: number, name: string) => {
        void onFunctionClick(nodeIndex, name);
      },
      firstL2Function: () => {
        const node = l2Ref.current?.payload.nodes[0];
        return node ? { nodeIndex: node.index, name: node.name } : null;
      },
      l2NodeCount: () => sceneApi?.getL2NodeCount() ?? 0,
      lod: () => navRef.current.lod,
      panelVisible: () =>
        document.querySelector('[data-testid="universe-selection-panel"]') != null,
    };
    return () => {
      delete window.__universeE2e;
    };
  }, [layout, onCommunityClick, onPackageClick, onFunctionClick, sceneApi]);

  const err = bootError ?? workerError;

  return (
    <div class="universe-root">
      {!layout ? (
        <div class="universe-loading" role="status">
          Loading cosmos…
        </div>
      ) : (
        <CosmosScene
          layout={layout}
          flyTarget={flyTarget}
          highlightCommunityId={highlightCommunityId}
          migrationCommunityIds={showSecurityOverlays ? migrationCommunityIds : []}
          taintCommunityIds={showSecurityOverlays ? taintCommunityIds : []}
          bridgeEmphasis={bridgeEmphasis}
          lod={nav.lod}
          selectedCommunityId={nav.communityId}
          selectedPackageId={nav.packageId}
          selectedUnitId={nav.unitId}
          l2Neighborhood={l2Neighborhood}
          onCommunityClick={onCommunityClick}
          onPackageClick={onPackageClick}
          onUnitClick={onUnitClick}
          onFunctionClick={onFunctionClick}
          onSceneReady={setSceneApi}
        />
      )}

      <HudChrome
        brand={<UniverseBrand />}
        search={
          layout ? (
            <SearchBar
              landmarks={landmarks}
              communities={communities}
              layoutCommunities={layout.communities}
              onFlyTo={onFlyTo}
              onFlyToast={(label) => showToast(`fly-to → ${label}`)}
              focusRef={searchFocusRef}
            />
          ) : (
            <div class="universe-search glass" role="search">
              <input type="search" class="universe-search-input" placeholder="Loading…" disabled />
            </div>
          )
        }
        leftRail={
          <LeftRail
            onHome={resetCosmos}
            onFocusSearch={() => searchFocusRef.current?.()}
            onOpenCommands={() => setCommandsOpen(true)}
            onOpenHelp={() => setHelpOpen(true)}
            bridgeEmphasis={bridgeEmphasis}
            onToggleBridgeEmphasis={() => setBridgeEmphasis((v) => !v)}
            showSecurityOverlays={showSecurityOverlays}
            onToggleSecurityOverlays={() => setShowSecurityOverlays((v) => !v)}
            onStub={(label) => showToast(label)}
            analysisTools={analysisTools}
            activeAnalysisTool={analysisTool}
            onToggleAnalysisTool={toggleAnalysisTool}
          />
        }
        lodChip={<LodChip nav={nav} />}
        breadcrumb={
          <Breadcrumb nav={nav} layout={layout} onNavigate={onBreadcrumbNavigate} />
        }
        navControls={
          <NavigationControls
            onZoomIn={() => sceneApi?.zoom(1.15)}
            onZoomOut={() => sceneApi?.zoom(1 / 1.15)}
            onRecenter={() => sceneApi?.recenter()}
          />
        }
        status={
          manifest ? (
            <>
              <span>
                {manifest.view?.community_count ?? layout?.communities.length ?? 0} communities ·{" "}
                {manifest.graph?.node_count ?? engine?.nodeCount ?? "…"} nodes
                {l2Neighborhood ? ` · ${l2Neighborhood.payload.nodes.length} in view` : ""}
              </span>
              {wasmReady ? <span class="universe-wasm-ok">WASM ready</span> : null}
            </>
          ) : null
        }
      />

      <SelectionPanel nav={nav} layout={layout} manifest={manifest} metanodes={metanodes} />

      <AnalysisDrawer
        tool={analysisTool}
        onClose={() => setAnalysisTool(null)}
        manifest={manifest}
        wasmReady={wasmReady}
        functionCount={engine?.nodeCount ?? manifest?.graph?.node_count ?? 0}
        listNodes={listNodes}
        blastRadius={blastRadius}
        loadCfgDetail={loadCfgDetail}
        computeDataflow={computeDataflow}
        computeSlice={computeSlice}
      />

      <CommandsPanel open={commandsOpen} onClose={() => setCommandsOpen(false)} />
      <HelpOverlay open={helpOpen} onClose={() => setHelpOpen(false)} />
      <Toast message={toastMessage} />

      {err ? (
        <div class="universe-error" role="alert">
          {err}
        </div>
      ) : null}
    </div>
  );
}
