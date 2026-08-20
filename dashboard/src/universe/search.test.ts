import { afterEach, describe, expect, it, vi } from "vitest";
import { flyCameraPose, lerpVec3, easeInOutCubic } from "./cameraController";
import { mapSemanticHitToResult, searchLocal } from "./search";
import { semanticQuery } from "../semanticSearch";
import type { SearchLandmark, UniverseCommunity } from "./types";

const communities = [{ id: 1, label: "payments", color: "#f97316" }];
const layoutCommunities: UniverseCommunity[] = [
  {
    id: 1,
    label: "payments",
    color: "#f97316",
    position: { x: 100, y: 0, z: 50 },
    member_count: 80,
    glow_radius: 55,
  },
];
const landmarks: SearchLandmark[] = [
  {
    node_index: 12,
    name: "OrderService",
    qualified_name: "com.example.ecommerce.service.OrderService",
    community_id: 1,
    position: { x: 100, y: 0, z: 50 },
  },
];

describe("searchLocal", () => {
  it("matches landmark name and returns fly position", () => {
    const hits = searchLocal("orderservice", landmarks, communities, layoutCommunities);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].position).toEqual({ x: 100, y: 0, z: 50 });
    expect(hits[0].nodeIndex).toBe(12);
  });

  it("matches community label", () => {
    const hits = searchLocal("pay", landmarks, communities, layoutCommunities);
    expect(hits.some((h) => h.kind === "community")).toBe(true);
  });
});

describe("semantic search", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("maps semantic hit to landmark coordinates", () => {
    const hit = {
      name: "OrderService",
      qualified_name: "com.example.ecommerce.service.OrderService",
    };
    const result = mapSemanticHitToResult(hit, landmarks, layoutCommunities);
    expect(result?.kind).toBe("semantic");
    expect(result?.position).toEqual({ x: 100, y: 0, z: 50 });
    expect(result?.nodeIndex).toBe(12);
  });

  it("populates results from mocked POST handler", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: RequestInfo) => {
        const path = String(url);
        if (path.includes("/api/semantic/query")) {
          return new Response(
            JSON.stringify({
              schema_version: 1,
              query: "checkout flow",
              model_id: "mock",
              dimensions: 8,
              hits: [
                {
                  node_id: "n12",
                  name: "OrderService",
                  qualified_name: "com.example.ecommerce.service.OrderService",
                  distance: 0.12,
                  score: 0.91,
                },
              ],
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }
        return new Response(JSON.stringify({ available: true }), { status: 200 });
      }),
    );

    const resp = await semanticQuery("checkout flow", { limit: 8 });
    expect(resp.hits).toHaveLength(1);
    const mapped = mapSemanticHitToResult(resp.hits[0], landmarks, layoutCommunities);
    expect(mapped?.label).toBe("OrderService");
    expect(mapped?.position.z).toBe(50);
  });
});

describe("cameraController", () => {
  it("lerps between vectors", () => {
    expect(lerpVec3({ x: 0, y: 0, z: 0 }, { x: 10, y: 20, z: 30 }, 0.5)).toEqual({
      x: 5,
      y: 10,
      z: 15,
    });
  });

  it("computes fly pose offset from target", () => {
    const pose = flyCameraPose({ x: 0, y: 0, z: 0 }, 200);
    expect(pose.lookAt).toEqual({ x: 0, y: 0, z: 0 });
    expect(pose.eye.z).toBeGreaterThan(pose.lookAt.z);
  });

  it("ease is monotonic at endpoints", () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(1)).toBe(1);
  });
});
