export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface UniverseCommunity {
  id: number;
  label: string;
  color: string;
  position: Vec3;
  member_count: number;
  glow_radius: number;
}

export interface UniverseBridge {
  source_community_id: number;
  target_community_id: number;
  weight: number;
}

export interface UniversePackage {
  id: number;
  community_id: number;
  label: string;
  position: Vec3;
  member_indices: number[];
}

export interface SearchLandmark {
  node_index: number;
  name: string;
  qualified_name: string;
  community_id?: number | null;
  position: Vec3;
}

export interface SearchLandmarksPayload {
  schema_version: number;
  landmarks: SearchLandmark[];
}

export interface UniverseLayout {
  schema_version: number;
  communities: UniverseCommunity[];
  bridges: UniverseBridge[];
  packages: UniversePackage[];
}

export interface UniverseManifest {
  ui_mode?: string;
  graph?: { node_count?: number; edge_count?: number };
  view?: { community_count?: number };
}
