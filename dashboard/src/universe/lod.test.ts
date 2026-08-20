import { describe, expect, it } from "vitest";
import {
  breadcrumbSegments,
  canSkipL4,
  escBackNav,
  initialNavState,
  lodLabel,
  navFromBreadcrumbIndex,
  navToL1,
  navToL2,
  navToL3,
  navToL4,
  navToL5,
} from "./lodState";

describe("lod navigation L1-L5", () => {
  it("starts at L1 cosmos", () => {
    expect(initialNavState.lod).toBe(1);
    expect(lodLabel(1)).toBe("COSMOS");
  });

  it("enters L2 on community select", () => {
    const s = navToL2(3, "payments");
    expect(s.lod).toBe(2);
    expect(s.communityLabel).toBe("payments");
  });

  it("enters L3 on package select", () => {
    const l2 = navToL2(3, "payments");
    const l3 = navToL3(l2, 9, "com.example.cart");
    expect(l3.lod).toBe(3);
    expect(l3.packageLabel).toBe("com.example.cart");
  });

  it("enters L5 on function select skipping L4", () => {
    const l3 = navToL3(navToL2(1, "core"), 2, "pkg");
    const l5 = navToL5(l3, "OrderService");
    expect(l5.lod).toBe(5);
    expect(l5.symbolName).toBe("OrderService");
  });

  it("canSkipL4 when no units", () => {
    expect(canSkipL4({ id: 1, community_id: 0, label: "x", position: { x: 0, y: 0, z: 0 }, member_indices: [] })).toBe(true);
    expect(canSkipL4(undefined)).toBe(true);
    expect(
      canSkipL4({
        id: 1,
        community_id: 0,
        label: "x",
        position: { x: 0, y: 0, z: 0 },
        member_indices: [1],
        units: [{ id: 0, label: "Foo", kind: "class", member_indices: [1] }],
      }),
    ).toBe(false);
  });

  it("enters L4 when units exist", () => {
    const l3 = navToL3(navToL2(1, "core"), 2, "pkg");
    const l4 = navToL4(l3, 7, "OrderService");
    expect(l4.lod).toBe(4);
    expect(l4.unitLabel).toBe("OrderService");
  });

  it("breadcrumb Universe resets to L1", () => {
    const l3 = navToL3(navToL2(1, "core"), 2, "pkg");
    expect(navFromBreadcrumbIndex(l3, 0, true)).toEqual(navToL1());
  });

  it("breadcrumb community segment returns to L2", () => {
    const l3 = navToL3(navToL2(5, "api"), 7, "handlers");
    const back = navFromBreadcrumbIndex(l3, 1, true);
    expect(back.lod).toBe(2);
    expect(back.packageId).toBeNull();
  });

  it("breadcrumb omits unit when L4 skipped", () => {
    const l5 = navToL5(navToL3(navToL2(1, "c"), 2, "p"), "fn");
    const segs = breadcrumbSegments(l5, true);
    expect(segs.map((s) => s.label)).toEqual(["Universe", "c", "p", "fn"]);
  });

  it("esc backs from L5 to L3 when L4 skipped", () => {
    const l5 = navToL5(navToL3(navToL2(1, "c"), 2, "p"), "fn");
    const back = escBackNav(l5, true);
    expect(back?.lod).toBe(3);
    expect(back?.symbolName).toBeNull();
  });
});
