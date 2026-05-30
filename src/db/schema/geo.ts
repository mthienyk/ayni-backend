export type GeoPoint = {
  lng: number;
  lat: number;
};

export function geoPointFromColumns(
  lng: number | null,
  lat: number | null,
): GeoPoint | null {
  if (lng === null || lat === null) return null;
  return { lng, lat };
}
