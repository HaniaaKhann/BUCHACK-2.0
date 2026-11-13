import type { WalkTimeDefaults } from './schemas.js';

export type BuildingRef = { id: string; campus: string };
export type VendorRef = { id: string; buildingId: string };

export type WalkTimeRow = {
  fromBuildingId: string;
  toBuildingId: string | null;
  toVendorId: string | null;
  type: 'b2b' | 'b2v';
  minutes: number;
  source: WalkTimeDefaults['source'];
};

export function estimateMinutes(
  from: BuildingRef,
  to: BuildingRef,
  defaults: WalkTimeDefaults,
): number {
  if (from.id === to.id) return defaults.sameBuildingMinutes;
  if (from.campus === defaults.jc3Campus || to.campus === defaults.jc3Campus) {
    return defaults.jc3Minutes;
  }
  if (from.campus === to.campus) return defaults.sameCampusMinutes;
  return defaults.betweenMainCampusesMinutes;
}

export function buildWalkTimeRows(
  buildings: BuildingRef[],
  vendors: VendorRef[],
  defaults: WalkTimeDefaults,
): WalkTimeRow[] {
  const byId = new Map(buildings.map((b) => [b.id, b]));
  const rows: WalkTimeRow[] = [];

  for (const from of buildings) {
    for (const to of buildings) {
      if (from.id === to.id) continue;
      rows.push({
        fromBuildingId: from.id,
        toBuildingId: to.id,
        toVendorId: null,
        type: 'b2b',
        minutes: estimateMinutes(from, to, defaults),
        source: defaults.source,
      });
    }
    for (const vendor of vendors) {
      const vendorBuilding = byId.get(vendor.buildingId);
      if (!vendorBuilding) continue;
      rows.push({
        fromBuildingId: from.id,
        toBuildingId: null,
        toVendorId: vendor.id,
        type: 'b2v',
        minutes: estimateMinutes(from, vendorBuilding, defaults),
        source: defaults.source,
      });
    }
  }
  return rows;
}
