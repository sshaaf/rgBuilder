import { useEffect, useRef } from "preact/hooks";
import * as THREE from "three";
import { resolveNodeTypeColor } from "../graphColors";
import {
  easeInOutCubic,
  flyCameraPose,
  flyDurationMs,
  lerpVec3,
} from "./cameraController";
import {
  layoutCallNeighborhood3d,
  neighborhoodEdges,
} from "./callNeighborhood3d";
import type { L2Neighborhood } from "./l2Subgraph";
import type { LodLevel } from "./lodState";
import {
  layoutSubgraphNodes3d,
  L2_LAZY_DISTANCE,
  shouldShowL2Nodes,
} from "./nodeLayout3d";
import type { FlyTarget } from "./SearchBar";
import type { UniverseLayout } from "./types";

export type SceneNavApi = {
  flyTo: (target: FlyTarget) => void;
  setHighlight: (communityId: number | null) => void;
  zoom: (factor: number) => void;
  recenter: () => void;
  getL2NodeCount: () => number;
};

interface CosmosSceneProps {
  layout: UniverseLayout;
  flyTarget: FlyTarget | null;
  highlightCommunityId: number | null;
  migrationCommunityIds: number[];
  taintCommunityIds: number[];
  bridgeEmphasis: boolean;
  lod: LodLevel;
  selectedCommunityId: number | null;
  selectedPackageId: number | null;
  selectedUnitId: number | null;
  l2Neighborhood: L2Neighborhood | null;
  onCommunityClick: (communityId: number, label: string) => void;
  onPackageClick: (packageId: number, label: string) => void;
  onUnitClick: (unitId: number, label: string) => void;
  onFunctionClick: (nodeIndex: number, name: string) => void;
  onSceneReady: (api: SceneNavApi | null) => void;
}

type SceneApi = SceneNavApi & {
  setLod: (lod: LodLevel, communityId: number | null, packageId: number | null) => void;
  setL2Neighborhood: (neighborhood: L2Neighborhood | null) => void;
  updateAnalysisOverlays: (migration: number[], taint: number[]) => void;
};

export function CosmosScene({
  layout,
  flyTarget,
  highlightCommunityId,
  migrationCommunityIds,
  taintCommunityIds,
  bridgeEmphasis,
  lod,
  selectedCommunityId,
  selectedPackageId,
  selectedUnitId,
  l2Neighborhood,
  onCommunityClick,
  onPackageClick,
  onUnitClick,
  onFunctionClick,
  onSceneReady,
}: CosmosSceneProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<SceneApi | null>(null);
  const lodRef = useRef(lod);
  const communityRef = useRef(selectedCommunityId);
  const packageRef = useRef(selectedPackageId);
  const unitRef = useRef(selectedUnitId);
  const bridgeEmphasisRef = useRef(bridgeEmphasis);
  const onCommunityRef = useRef(onCommunityClick);
  const onPackageRef = useRef(onPackageClick);
  const onUnitRef = useRef(onUnitClick);
  const onFunctionRef = useRef(onFunctionClick);
  const migrationRef = useRef(migrationCommunityIds);
  const taintRef = useRef(taintCommunityIds);

  lodRef.current = lod;
  communityRef.current = selectedCommunityId;
  packageRef.current = selectedPackageId;
  unitRef.current = selectedUnitId;
  bridgeEmphasisRef.current = bridgeEmphasis;
  onCommunityRef.current = onCommunityClick;
  onPackageRef.current = onPackageClick;
  onUnitRef.current = onUnitClick;
  onFunctionRef.current = onFunctionClick;
  migrationRef.current = migrationCommunityIds;
  taintRef.current = taintCommunityIds;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x07080f);
    scene.fog = new THREE.FogExp2(0x07080f, 0.0012);

    const camera = new THREE.PerspectiveCamera(55, 1, 1, 5000);
    const homeEye = new THREE.Vector3(0, 120, 680);
    const homeLook = new THREE.Vector3(0, 0, 0);
    camera.position.copy(homeEye);
    camera.lookAt(homeLook);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    host.appendChild(renderer.domElement);
    renderer.domElement.id = "universe-canvas";

    const positions = new Map<number, THREE.Vector3>();
    for (const c of layout.communities) {
      positions.set(
        c.id,
        new THREE.Vector3(c.position.x, c.position.y, c.position.z),
      );
    }

    const communityMeshes = new Map<number, THREE.Mesh>();
    const communityGroup = new THREE.Group();
    const clickables: THREE.Object3D[] = [];
    for (const c of layout.communities) {
      const color = new THREE.Color(c.color);
      const core = new THREE.Mesh(
        new THREE.SphereGeometry(Math.max(8, c.glow_radius * 0.08), 24, 24),
        new THREE.MeshBasicMaterial({ color }),
      );
      core.position.set(c.position.x, c.position.y, c.position.z);
      core.userData = { kind: "community", id: c.id, label: c.label };
      communityGroup.add(core);
      communityMeshes.set(c.id, core);
      clickables.push(core);

      const glow = new THREE.Mesh(
        new THREE.SphereGeometry(Math.max(16, c.glow_radius * 0.14), 16, 16),
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0.12,
        }),
      );
      glow.position.copy(core.position);
      communityGroup.add(glow);
    }
    scene.add(communityGroup);

    const packageGroup = new THREE.Group();
    const packageMeshes = new Map<number, THREE.Mesh>();
    for (const pkg of layout.packages) {
      const community = layout.communities.find((c) => c.id === pkg.community_id);
      if (!community) continue;
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(10, 10, 10),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color(community.color),
          transparent: true,
          opacity: 0.85,
        }),
      );
      mesh.position.set(
        community.position.x + pkg.position.x,
        community.position.y + pkg.position.y,
        community.position.z + pkg.position.z,
      );
      mesh.userData = { kind: "package", id: pkg.id, label: pkg.label };
      mesh.visible = false;
      packageGroup.add(mesh);
      packageMeshes.set(pkg.id, mesh);
      clickables.push(mesh);
    }
    scene.add(packageGroup);

    const unitGroup = new THREE.Group();
    unitGroup.visible = false;
    const unitMeshes = new Map<number, THREE.Mesh>();
    scene.add(unitGroup);

    const functionGroup = new THREE.Group();
    functionGroup.visible = false;
    scene.add(functionGroup);

    const edgeGroup = new THREE.Group();
    edgeGroup.visible = false;
    scene.add(edgeGroup);

    let l2Anchor: THREE.Vector3 | null = null;
    let l2Built = false;
    let l2Shown = false;
    let l2CallMode = false;

    const disposeMesh = (mesh: THREE.Mesh) => {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    };

    const clearL2Meshes = () => {
      while (functionGroup.children.length > 0) {
        const child = functionGroup.children[0];
        functionGroup.remove(child);
        if (child instanceof THREE.Mesh) disposeMesh(child);
      }
      while (edgeGroup.children.length > 0) {
        const child = edgeGroup.children[0];
        edgeGroup.remove(child);
        if (child instanceof THREE.Line) {
          child.geometry.dispose();
          (child.material as THREE.Material).dispose();
        }
      }
      for (let i = clickables.length - 1; i >= 0; i -= 1) {
        if (clickables[i].userData.kind === "function") clickables.splice(i, 1);
      }
      l2Anchor = null;
      l2Built = false;
      l2Shown = false;
      l2CallMode = false;
      functionGroup.visible = false;
      edgeGroup.visible = false;
    };

    const clearUnitMeshes = () => {
      while (unitGroup.children.length > 0) {
        const child = unitGroup.children[0];
        unitGroup.remove(child);
        if (child instanceof THREE.Mesh) disposeMesh(child);
      }
      for (let i = clickables.length - 1; i >= 0; i -= 1) {
        if (clickables[i].userData.kind === "unit") clickables.splice(i, 1);
      }
      unitMeshes.clear();
      unitGroup.visible = false;
    };

    const rebuildUnitMeshes = (packageId: number) => {
      clearUnitMeshes();
      const pkg = layout.packages.find((p) => p.id === packageId);
      if (!pkg?.units?.length) return;
      const community = layout.communities.find((c) => c.id === pkg.community_id);
      if (!community) return;
      const anchor = new THREE.Vector3(
        community.position.x + pkg.position.x,
        community.position.y + pkg.position.y,
        community.position.z + pkg.position.z,
      );
      const units = pkg.units;
      for (let i = 0; i < units.length; i += 1) {
        const unit = units[i];
        const angle = (i / units.length) * Math.PI * 2 + packageId * 0.13;
        const r = 16 + Math.sqrt(i + 1) * 2.5;
        const mesh = new THREE.Mesh(
          new THREE.SphereGeometry(4.2, 12, 12),
          new THREE.MeshBasicMaterial({
            color: new THREE.Color(community.color),
            transparent: true,
            opacity: 0.78,
          }),
        );
        mesh.position.set(
          anchor.x + Math.cos(angle) * r,
          anchor.y + ((i % 4) - 1.5) * 2,
          anchor.z + Math.sin(angle) * r,
        );
        mesh.userData = { kind: "unit", id: unit.id, label: unit.label };
        mesh.visible = false;
        unitGroup.add(mesh);
        unitMeshes.set(unit.id, mesh);
        clickables.push(mesh);
      }
    };

    const buildL2Meshes = (neighborhood: L2Neighborhood) => {
      clearL2Meshes();
      l2Anchor = new THREE.Vector3(
        neighborhood.anchor.x,
        neighborhood.anchor.y,
        neighborhood.anchor.z,
      );
      l2CallMode = neighborhood.mode === "call" && neighborhood.seedIndex != null;
      const filterSet = neighborhood.filterIndices
        ? new Set(neighborhood.filterIndices)
        : null;
      const nodes = neighborhood.payload.nodes.filter(
        (n) => !filterSet || filterSet.has(n.index),
      );
      const payloadForLayout =
        l2CallMode && neighborhood.seedIndex != null
          ? neighborhood.payload
          : { nodes, edges: neighborhood.payload.edges };

      const placements =
        l2CallMode && neighborhood.seedIndex != null
          ? layoutCallNeighborhood3d(
              payloadForLayout,
              neighborhood.seedIndex,
              neighborhood.anchor,
            )
          : layoutSubgraphNodes3d(nodes, neighborhood.anchor, neighborhood.packageId).map((p) => ({
              node: p.node,
              position: p.position,
              isSeed: false as const,
            }));

      const positionMap = new Map<number, { x: number; y: number; z: number }>();
      for (const p of placements) {
        const color = new THREE.Color(resolveNodeTypeColor(p.node.node_type));
        const mesh = new THREE.Mesh(
          new THREE.SphereGeometry(p.isSeed ? 4.2 : 2.8, 10, 10),
          new THREE.MeshBasicMaterial({
            color: p.isSeed ? new THREE.Color(0xffffff) : color,
            transparent: true,
            opacity: p.isSeed ? 1 : 0.92,
          }),
        );
        mesh.position.set(p.position.x, p.position.y, p.position.z);
        mesh.userData = {
          kind: "function",
          index: p.node.index,
          name: p.node.name,
        };
        mesh.visible = false;
        functionGroup.add(mesh);
        clickables.push(mesh);
        positionMap.set(p.node.index, {
          x: p.position.x,
          y: p.position.y,
          z: p.position.z,
        });
      }

      if (l2CallMode) {
        for (const seg of neighborhoodEdges(neighborhood.payload, positionMap)) {
          const line = new THREE.Line(
            new THREE.BufferGeometry().setFromPoints([
              new THREE.Vector3(seg.from.x, seg.from.y, seg.from.z),
              new THREE.Vector3(seg.to.x, seg.to.y, seg.to.z),
            ]),
            new THREE.LineBasicMaterial({
              color: 0x8b7cff,
              transparent: true,
              opacity: 0.55,
            }),
          );
          edgeGroup.add(line);
        }
      }

      l2Built = placements.length > 0;
    };

    const setL2Neighborhood = (neighborhood: L2Neighborhood | null) => {
      clearL2Meshes();
      if (neighborhood && neighborhood.payload.nodes.length > 0) {
        buildL2Meshes(neighborhood);
      }
    };

    const pulseRing = new THREE.Mesh(
      new THREE.RingGeometry(18, 26, 48),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
      }),
    );
    pulseRing.rotation.x = -Math.PI / 2;
    scene.add(pulseRing);

    const bridgeMat = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.08,
    });
    const bridgeLines: {
      line: THREE.Line;
      source: number;
      target: number;
      defaultMat: THREE.LineBasicMaterial;
    }[] = [];
    for (const b of layout.bridges) {
      const a = positions.get(b.source_community_id);
      const d = positions.get(b.target_community_id);
      if (!a || !d) continue;
      const mat = bridgeMat.clone();
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, d]), mat);
      scene.add(line);
      bridgeLines.push({
        line,
        source: b.source_community_id,
        target: b.target_community_id,
        defaultMat: mat,
      });
    }

    const migrationRingGroup = new THREE.Group();
    scene.add(migrationRingGroup);
    const migrationRings = new Map<number, THREE.Mesh>();
    const taintGlows = new Map<number, THREE.Mesh>();

    const applyAnalysisOverlays = (
      migrationIds: number[],
      taintIds: number[],
    ) => {
      const migrationSet = new Set(migrationIds);
      const taintSet = new Set(taintIds);

      for (const [id, ring] of migrationRings) {
        if (!migrationSet.has(id)) {
          migrationRingGroup.remove(ring);
          ring.geometry.dispose();
          (ring.material as THREE.Material).dispose();
          migrationRings.delete(id);
        }
      }
      for (const id of migrationSet) {
        if (migrationRings.has(id)) continue;
        const mesh = communityMeshes.get(id);
        if (!mesh) continue;
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(28, 1.2, 8, 48),
          new THREE.MeshBasicMaterial({
            color: 0xf5a623,
            transparent: true,
            opacity: 0.55,
          }),
        );
        ring.position.copy(mesh.position);
        ring.rotation.x = Math.PI / 2;
        migrationRingGroup.add(ring);
        migrationRings.set(id, ring);
      }

      for (const [id, glow] of taintGlows) {
        if (!taintSet.has(id)) {
          glow.parent?.remove(glow);
          glow.geometry.dispose();
          (glow.material as THREE.Material).dispose();
          taintGlows.delete(id);
        }
      }
      for (const id of taintSet) {
        if (taintGlows.has(id)) continue;
        const mesh = communityMeshes.get(id);
        if (!mesh) continue;
        const glow = new THREE.Mesh(
          new THREE.SphereGeometry(22, 16, 16),
          new THREE.MeshBasicMaterial({
            color: 0xff3355,
            transparent: true,
            opacity: 0.18,
          }),
        );
        glow.position.copy(mesh.position);
        communityGroup.add(glow);
        taintGlows.set(id, glow);
      }

      for (const entry of bridgeLines) {
        const taintEdge =
          taintSet.has(entry.source) && taintSet.has(entry.target);
        const mat = entry.line.material as THREE.LineBasicMaterial;
        if (taintEdge) {
          mat.color.setHex(0xff4455);
          mat.opacity = 0.35;
        } else {
          mat.color.copy(entry.defaultMat.color);
          mat.opacity = entry.defaultMat.opacity;
        }
      }
    };

    const starsGeom = new THREE.BufferGeometry();
    const starCount = 800;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i += 1) {
      starPositions[i * 3] = (Math.random() - 0.5) * 2400;
      starPositions[i * 3 + 1] = (Math.random() - 0.5) * 1600;
      starPositions[i * 3 + 2] = (Math.random() - 0.5) * 2400;
    }
    starsGeom.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
    scene.add(
      new THREE.Points(
        starsGeom,
        new THREE.PointsMaterial({
          color: 0xffffff,
          size: 1.2,
          transparent: true,
          opacity: 0.45,
        }),
      ),
    );

    let flyFromEye = homeEye.clone();
    let flyFromLook = homeLook.clone();
    let flyToEye = homeEye.clone();
    let flyToLook = homeLook.clone();
    let flyStart = 0;
    let flyDuration = 0;
    let pulseCommunity: number | null = null;
    let pulsePhase = 0;

    const currentLookAt = () => {
      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      return camera.position.clone().add(dir.multiplyScalar(120));
    };

    const flyTo = (target: FlyTarget) => {
      flyFromEye.copy(camera.position);
      flyFromLook.copy(currentLookAt());
      const pose = flyCameraPose(target.position, target.distance ?? 260);
      flyToEye.set(pose.eye.x, pose.eye.y, pose.eye.z);
      flyToLook.set(pose.lookAt.x, pose.lookAt.y, pose.lookAt.z);
      flyDuration = flyDurationMs();
      flyStart = performance.now();
      pulseCommunity = target.communityId ?? null;
      if (flyDuration === 0) {
        camera.position.copy(flyToEye);
        camera.lookAt(flyToLook);
      }
    };

    const flyHome = () => {
      flyFromEye.copy(camera.position);
      flyFromLook.copy(currentLookAt());
      flyToEye.copy(homeEye);
      flyToLook.copy(homeLook);
      flyDuration = flyDurationMs();
      flyStart = performance.now();
      pulseCommunity = null;
      if (flyDuration === 0) {
        camera.position.copy(homeEye);
        camera.lookAt(homeLook);
      }
    };

    const setHighlight = (communityId: number | null) => {
      pulseCommunity = communityId;
      if (communityId != null) {
        const mesh = communityMeshes.get(communityId);
        if (mesh) pulseRing.position.copy(mesh.position);
      }
    };

    const zoom = (factor: number) => {
      const look = currentLookAt();
      const offset = camera.position.clone().sub(look);
      offset.multiplyScalar(1 / factor);
      camera.position.copy(look.add(offset));
    };

    const recenter = () => {
      const cid = communityRef.current;
      if (cid != null && lodRef.current >= 2) {
        const community = layout.communities.find((c) => c.id === cid);
        if (community) {
          flyTo({
            key: `recenter:${cid}`,
            position: community.position,
            communityId: cid,
            distance: 260 / 2.5,
          });
          return;
        }
      }
      flyHome();
    };

    const getL2NodeCount = () =>
      functionGroup.children.filter((c) => c instanceof THREE.Mesh && c.visible).length;

    const setLod = (nextLod: LodLevel, communityId: number | null, packageId: number | null) => {
      for (const mesh of packageMeshes.values()) {
        mesh.visible = false;
      }
      clearUnitMeshes();
      if (nextLod >= 2 && communityId != null) {
        for (const pkg of layout.packages) {
          if (pkg.community_id !== communityId) continue;
          packageMeshes.get(pkg.id)!.visible = true;
        }
      }
      if (nextLod === 3 && packageId != null) {
        rebuildUnitMeshes(packageId);
        for (const mesh of unitMeshes.values()) {
          mesh.visible = true;
        }
        unitGroup.visible = unitMeshes.size > 0;
      } else {
        unitGroup.visible = false;
      }
      if (nextLod < 3) clearL2Meshes();
    };

    setLod(lodRef.current, communityRef.current, packageRef.current);

    const api: SceneApi = {
      flyTo,
      setHighlight,
      zoom,
      recenter,
      getL2NodeCount,
      setLod,
      setL2Neighborhood,
      updateAnalysisOverlays: applyAnalysisOverlays,
    };
    apiRef.current = api;
    onSceneReady(api);
    applyAnalysisOverlays(migrationRef.current, taintRef.current);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const onPointerDown = (ev: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(clickables, false);
      const hit = hits[0]?.object;
      if (!hit?.userData?.kind) return;
      if (hit.userData.kind === "community" && lodRef.current === 1) {
        onCommunityRef.current(hit.userData.id as number, hit.userData.label as string);
      } else if (hit.userData.kind === "package" && lodRef.current === 2) {
        onPackageRef.current(hit.userData.id as number, hit.userData.label as string);
      } else if (hit.userData.kind === "unit" && lodRef.current === 3) {
        onUnitRef.current(hit.userData.id as number, hit.userData.label as string);
      } else if (hit.userData.kind === "function") {
        const fnLod = lodRef.current;
        if (fnLod === 3 || fnLod === 4 || fnLod === 5) {
          onFunctionRef.current(hit.userData.index as number, hit.userData.name as string);
        }
      }
    };
    renderer.domElement.addEventListener("pointerdown", onPointerDown);

    const resize = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      camera.aspect = w / Math.max(h, 1);
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host);

    let frame = 0;
    let raf = 0;
    const animate = () => {
      frame += 1;

      if (flyDuration > 0) {
        const t = Math.min(1, (performance.now() - flyStart) / flyDuration);
        const e = easeInOutCubic(t);
        const eye = lerpVec3(
          { x: flyFromEye.x, y: flyFromEye.y, z: flyFromEye.z },
          { x: flyToEye.x, y: flyToEye.y, z: flyToEye.z },
          e,
        );
        const look = lerpVec3(
          { x: flyFromLook.x, y: flyFromLook.y, z: flyFromLook.z },
          { x: flyToLook.x, y: flyToLook.y, z: flyToLook.z },
          e,
        );
        camera.position.set(eye.x, eye.y, eye.z);
        camera.lookAt(look.x, look.y, look.z);
        if (t >= 1) flyDuration = 0;
      } else if (lodRef.current === 1) {
        communityGroup.rotation.y = frame * 0.00012;
      }

      if (lodRef.current >= 3 && l2Built && l2Anchor) {
        const show = l2CallMode
          ? lodRef.current >= 5
          : shouldShowL2Nodes(
              { x: camera.position.x, y: camera.position.y, z: camera.position.z },
              { x: l2Anchor.x, y: l2Anchor.y, z: l2Anchor.z },
              L2_LAZY_DISTANCE,
            );
        if (show !== l2Shown) {
          l2Shown = show;
          functionGroup.visible = show;
          edgeGroup.visible = show && l2CallMode;
          for (const child of functionGroup.children) {
            if (child instanceof THREE.Mesh) child.visible = show;
          }
        }
      }

      const bridgePulse = bridgeEmphasisRef.current ? 0.08 + Math.sin(frame * 0.04) * 0.06 : 0;
      for (const entry of bridgeLines) {
        const mat = entry.line.material as THREE.LineBasicMaterial;
        mat.opacity = bridgeEmphasisRef.current
          ? entry.defaultMat.opacity * 2 + bridgePulse
          : entry.defaultMat.opacity;
      }

      if (labelsRef.current && lodRef.current >= 2) {
        const labelsHost = labelsRef.current;
        labelsHost.innerHTML = "";
        const w = host.clientWidth;
        const h = host.clientHeight;
        for (const c of layout.communities) {
          if (communityRef.current != null && c.id !== communityRef.current) continue;
          const pos = new THREE.Vector3(c.position.x, c.position.y + c.glow_radius * 0.12, c.position.z);
          pos.project(camera);
          if (pos.z > 1) continue;
          const el = document.createElement("div");
          el.className = "universe-scene-label";
          el.textContent = `${c.label} · ${c.member_count}`;
          el.style.left = `${((pos.x + 1) / 2) * w}px`;
          el.style.top = `${((1 - pos.y) / 2) * h}px`;
          labelsHost.appendChild(el);
        }
      } else if (labelsRef.current) {
        labelsRef.current.innerHTML = "";
      }

      if (pulseCommunity != null) {
        const mesh = communityMeshes.get(pulseCommunity);
        if (mesh) {
          pulsePhase += 0.04;
          pulseRing.position.copy(mesh.position);
          pulseRing.position.y += 2;
          (pulseRing.material as THREE.MeshBasicMaterial).opacity =
            0.35 + Math.sin(pulsePhase) * 0.25;
          pulseRing.scale.setScalar(1 + Math.sin(pulsePhase) * 0.08);
        }
      } else {
        (pulseRing.material as THREE.MeshBasicMaterial).opacity = 0;
      }

      for (const glow of taintGlows.values()) {
        glow.scale.setScalar(1 + Math.sin(frame * 0.03) * 0.06);
      }

      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      clearL2Meshes();
      clearUnitMeshes();
      apiRef.current = null;
      onSceneReady(null);
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.dispose();
      host.removeChild(renderer.domElement);
    };
  }, [layout, onSceneReady]);

  useEffect(() => {
    if (flyTarget) apiRef.current?.flyTo(flyTarget);
  }, [flyTarget]);

  useEffect(() => {
    apiRef.current?.setHighlight(highlightCommunityId);
  }, [highlightCommunityId]);

  useEffect(() => {
    apiRef.current?.setLod(lod, selectedCommunityId, selectedPackageId);
  }, [lod, selectedCommunityId, selectedPackageId]);

  useEffect(() => {
    apiRef.current?.setL2Neighborhood(l2Neighborhood);
  }, [l2Neighborhood]);

  useEffect(() => {
    apiRef.current?.updateAnalysisOverlays(migrationCommunityIds, taintCommunityIds);
  }, [migrationCommunityIds, taintCommunityIds]);

  return (
    <div
      ref={hostRef}
      class="universe-canvas-host"
      data-testid="universe-scene"
      data-l2-count={l2Neighborhood?.payload.nodes.length ?? 0}
    >
      <div ref={labelsRef} class="universe-scene-labels" aria-hidden="true" />
    </div>
  );
}
