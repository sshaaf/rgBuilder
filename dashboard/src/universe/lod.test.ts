import { describe, expect, it } from "vitest";
import {
  initialNavState,
  navFromBreadcrumbIndex,
  navToL0,
  navToL1,
  navToL2,
} from "./lodState";

describe("lod navigation", () => {
  it("starts at L0", () => {
    expect(initialNavState.lod).toBe(0);
  });

  it("enters L1 on community select", () => {
    const s = navToL1(3, "payments");
    expect(s.lod).toBe(1);
    expect(s.communityLabel).toBe("payments");
  });

  it("enters L2 on package select", () => {
    const l1 = navToL1(3, "payments");
    const l2 = navToL2(l1, 9, "com.example.cart");
    expect(l2.lod).toBe(2);
    expect(l2.packageLabel).toBe("com.example.cart");
  });

  it("breadcrumb Universe resets to L0", () => {
    const l2 = navToL2(navToL1(1, "core"), 2, "pkg");
    expect(navFromBreadcrumbIndex(l2, 0)).toEqual(navToL0());
  });

  it("breadcrumb community segment returns to L1", () => {
    const l2 = navToL2(navToL1(5, "api"), 7, "handlers");
    const back = navFromBreadcrumbIndex(l2, 1);
    expect(back.lod).toBe(1);
    expect(back.packageId).toBeNull();
  });
});
