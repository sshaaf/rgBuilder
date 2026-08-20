import { describe, expect, it } from "vitest";
import {
  migrationHotspotCommunityIds,
  taintBridgePairs,
  taintCommunityIds,
} from "./analysisOverlays";
import type { MigrationGraphPayload } from "../migration/types";
import type { SearchLandmark } from "./types";
import type { TaintIndexPayload } from "../types";

describe("analysisOverlays", () => {
  it("picks migration hotspots by max_blast", () => {
    const graph: MigrationGraphPayload = {
      schema_version: 2,
      modularity: 0.4,
      communities: [
        { id: 1, label: "a", member_count: 1, avg_pagerank: 0, avg_harmonic: 0, avg_betweenness: 0, max_blast: 2 },
        { id: 2, label: "b", member_count: 1, avg_pagerank: 0, avg_harmonic: 0, avg_betweenness: 0, max_blast: 9 },
        { id: 3, label: "c", member_count: 1, avg_pagerank: 0, avg_harmonic: 0, avg_betweenness: 0, max_blast: 5 },
      ],
      edges: [],
    };
    expect(migrationHotspotCommunityIds(graph, 2)).toEqual([2, 3]);
  });

  it("maps taint functions to landmark communities", () => {
    const taint: TaintIndexPayload = {
      schema_version: 1,
      available: true,
      detail_dir: "taint",
      function_count: 1,
      total_flows: 1,
      vulnerable_flows: 1,
      functions: [{ function_id: "f1", name: "sink", flow_count: 1, vulnerable_count: 1 }],
    };
    const landmarks: SearchLandmark[] = [
      { node_index: 1, name: "sink", qualified_name: "com.example.sink", community_id: 7, position: { x: 0, y: 0, z: 0 } },
      { node_index: 2, name: "safe", qualified_name: "com.example.safe", community_id: 3, position: { x: 0, y: 0, z: 0 } },
    ];
    expect(taintCommunityIds(taint, landmarks)).toEqual([7]);
  });

  it("finds taint bridge pairs", () => {
    expect(
      taintBridgePairs([1, 2], [
        { source_community_id: 1, target_community_id: 2 },
        { source_community_id: 1, target_community_id: 9 },
      ]),
    ).toEqual([[1, 2]]);
  });
});
