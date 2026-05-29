import { customType } from "drizzle-orm/pg-core";

export type GeoPoint = {
  lng: number;
  lat: number;
};

export const geometryPoint = customType<{
  data: GeoPoint;
  driverData: string;
}>({
  dataType() {
    return "geometry(Point, 4326)";
  },
  toDriver(value: GeoPoint): string {
    return `SRID=4326;POINT(${value.lng} ${value.lat})`;
  },
  fromDriver(value: string): GeoPoint {
    const match = value.match(/POINT\(([-\d.]+) ([-\d.]+)\)/);
    if (!match) {
      throw new Error(`Invalid geometry point: ${value}`);
    }
    return { lng: parseFloat(match[1]), lat: parseFloat(match[2]) };
  },
});

export const geometryPolygon = customType<{
  data: string;
  driverData: string;
}>({
  dataType() {
    return "geometry(Polygon, 4326)";
  },
  toDriver(value: string): string {
    return value;
  },
  fromDriver(value: string): string {
    return value;
  },
});
