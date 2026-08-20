import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { DEFAULT_GRAPH_TYPE_MASK, loadManifest, type DashboardManifest } from "../types";
import { useEngineWorker } from "../useEngineWorker";
import { Breadcrumb } from "./Breadcrumb";
import { ContextPanel, type SelectedSymbol } from "./ContextPanel";
import { CommandsPanel } from "./CommandsPanel";
import { SideNav } from "./Chrome";
import { CosmosScene, type SceneNavApi } from "./CosmosScene";
import type { L2Neighborhood } from "./l2Subgraph";
import { loadCommunitiesJson, loadSearchLandmarks, loadUniverseLayout } from "./loadData";
import {
  loadMigrationGraph,
  loadTaintIndex,
  migrationHotspotCommunityIds,
  taintCommunityIds,
} from "./analysisOverlays";
import {
  initialNavState,
  navFromBreadcrumbIndex,
  navToL1,
  navToL2,
  navToL3,
  type UniverseNavState,
} from "./lodState";
import { NavigationControls } from "./NavigationControls";
import { SearchBar, type FlyTarget } from "./SearchBar";
import type { SearchLandmark, UniverseLayout } from "./types";

const GALAXY_FOCUS_DISTANCE = 260 / 2.5;

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
  const [migrationCommunityIds, setMigrationCommunityIds] = useState<number[]>([]);
  const [taintCommunityIds, setTaintCommunityIds] = useState<number[]>([]);
  const { engine, error: workerError, wasmReady, expand, blastRadius } = useEngineWorker();
  const navRef = useRef(nav);
  navRef.current = nav;
  const l2Ref = useRef(l2Neighborhood);
  l2Ref.current = l2Neighborhood;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [m, u, lm, comm] = await Promise.all([
          loadManifest(),
          loadUniverseLayout(),
          loadSearchLandmarks(),
          loadCommunitiesJson(),
        ]);
        if (!cancelled) {
          setManifest(m);
          setLayout(u);
          setLandmarks(lm);
          setCommunities(comm.communities ?? []);
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
          setTaintCommunityIds(taintCommunityIds(taint, landmarks));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [manifest, landmarks]);

  useEffect(() => {
    if (nav.lod < 2) setL2Neighborhood(null);
    if (nav.lod < 3) setSelectedSymbol(null);
  }, [nav.lod]);

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

  const onCommunityClick = useCallback(
    (communityId: number, communityLabel: string) => {
      const community = layout?.communities.find((c) => c.id === communityId);
      if (!community) return;
      setL2Neighborhood(null);
      setNav(navToL1(communityId, communityLabel));
      flyToPosition(community.position, communityId, GALAXY_FOCUS_DISTANCE);
    },
    [flyToPosition, layout],
  );

  const onPackageClick = useCallback(
    async (packageId: number, packageLabel: string) => {
      const pkg = layout?.packages.find((p) => p.id === packageId);
      if (!pkg || !navRef.current.communityId) return;
      setNav((prev) => navToL2(prev, packageId, packageLabel));
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
      if (!wasmReady) return;
      try {
        const payload = await expand(pkg.member_indices, DEFAULT_GRAPH_TYPE_MASK);
        if (payload.nodes.length > 0) {
          setL2Neighborhood({ packageId, anchor, payload });
        }
      } catch {
        /* expand errors surface via workerError */
      }
    },
    [expand, flyToPosition, layout, wasmReady],
  );

  const onFunctionClick = useCallback((nodeIndex: number, name: string) => {
    setNav((prev) => navToL3(prev, name));
    setSelectedSymbol({ nodeIndex, name });
  }, []);

  const onBreadcrumbNavigate = (index: number) => {
    const next = navFromBreadcrumbIndex(nav, index);
    setNav(next);
    if (next.lod === 0) {
      setHighlightCommunityId(null);
      setL2Neighborhood(null);
      setSelectedSymbol(null);
      sceneApi?.recenter();
      return;
    }
    if (next.lod < 2) setL2Neighborhood(null);
    if (next.lod < 3) setSelectedSymbol(null);
    const community = layout?.communities.find((c) => c.id === next.communityId);
    if (community) {
      flyToPosition(
        community.position,
        community.id,
        next.lod >= 2 ? GALAXY_FOCUS_DISTANCE / 1.6 : GALAXY_FOCUS_DISTANCE,
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
        onFunctionClick(nodeIndex, name);
      },
      firstL2Function: () => {
        const node = l2Ref.current?.payload.nodes[0];
        return node ? { nodeIndex: node.index, name: node.name } : null;
      },
      l2NodeCount: () => sceneApi?.getL2NodeCount() ?? 0,
      lod: () => navRef.current.lod,
      panelVisible: () =>
        document.querySelector('[data-testid="universe-context-panel"]') != null,
    };
    return () => {
      delete window.__universeE2e;
    };
  }, [layout, onCommunityClick, onPackageClick, onFunctionClick, sceneApi]);

  const err = bootError ?? workerError;

  return (
    <div class="universe-root">
      <SideNav onOpenCommands={() => setCommandsOpen(true)} />
      <CommandsPanel open={commandsOpen} onClose={() => setCommandsOpen(false)} />
      <main class="universe-main">
        {layout ? (
          <SearchBar
            landmarks={landmarks}
            communities={communities}
            layoutCommunities={layout.communities}
            onFlyTo={onFlyTo}
          />
        ) : (
          <div class="universe-search" role="search">
            <input
              type="search"
              class="universe-search-input"
              placeholder="Search functions, communities…"
              disabled
            />
          </div>
        )}
        <NavigationControls
          onZoomIn={() => sceneApi?.zoom(1.15)}
          onZoomOut={() => sceneApi?.zoom(1 / 1.15)}
          onRecenter={() => sceneApi?.recenter()}
        />
        <Breadcrumb nav={nav} onNavigate={onBreadcrumbNavigate} />
        {err ? (
          <div class="universe-error" role="alert">
            {err}
          </div>
        ) : null}
        {!layout ? (
          <div class="universe-loading" role="status">
            Loading cosmos…
          </div>
        ) : (
          <CosmosScene
            layout={layout}
            flyTarget={flyTarget}
            highlightCommunityId={highlightCommunityId}
            migrationCommunityIds={migrationCommunityIds}
            taintCommunityIds={taintCommunityIds}
            lod={nav.lod}
            selectedCommunityId={nav.communityId}
            l2Neighborhood={l2Neighborhood}
            onCommunityClick={onCommunityClick}
            onPackageClick={onPackageClick}
            onFunctionClick={onFunctionClick}
            onSceneReady={setSceneApi}
          />
        )}
        <ContextPanel
          lod={nav.lod}
          manifest={manifest}
          symbol={selectedSymbol}
          wasmReady={wasmReady}
          blastRadius={blastRadius}
        />
        <footer class="universe-status">
          {manifest ? (
            <span>
              {manifest.view?.community_count ?? layout?.communities.length ?? 0} communities ·{" "}
              {manifest.graph?.node_count ?? engine?.nodeCount ?? "…"} nodes
              {l2Neighborhood ? ` · ${l2Neighborhood.payload.nodes.length} in view` : ""}
            </span>
          ) : null}
          {wasmReady ? <span class="universe-wasm-ok">WASM ready</span> : null}
        </footer>
      </main>
    </div>
  );
}
