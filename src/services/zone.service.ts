import { and, eq, isNull, sql } from "drizzle-orm";
import type { Database } from "../db/index.js";
import { users, zones } from "../db/schema/index.js";
import type { GeoPoint } from "../db/schema/geo.js";
import { geoPointFromColumns } from "../db/schema/geo.js";
import { env } from "../lib/config.js";
import { AppError } from "../lib/errors.js";

export type ZoneNearbyDto = {
  zone: {
    id: string;
    name: string;
    h3Index: string | null;
    currentUserCount: number;
    threshold: number;
    isUnlocked: boolean;
    thresholdUnlockedAt: string | null;
  } | null;
  userCountInZone: number;
};

export class ZoneService {
  constructor(private readonly db: Database) {}

  async getNearby(userId: string, location?: GeoPoint): Promise<ZoneNearbyDto> {
    const user = await this.db.query.users.findFirst({
      where: and(eq(users.id, userId), isNull(users.deletedAt)),
    });

    if (!user) {
      throw new AppError("USER_NOT_FOUND", "User not found", 404);
    }

    const point =
      location ?? geoPointFromColumns(user.homeLng, user.homeLat);
    if (!point) {
      return { zone: null, userCountInZone: 0 };
    }

    if (location) {
      await this.db
        .update(users)
        .set({ homeLat: location.lat, homeLng: location.lng })
        .where(eq(users.id, userId));
    }

    const zoneRows = await this.db.execute<{
      id: string;
      name: string;
      h3_index: string | null;
      current_user_count: number;
      threshold_unlocked_at: Date | null;
    }>(sql`
      SELECT id, name, h3_index, current_user_count, threshold_unlocked_at
      FROM zones
      WHERE deleted_at IS NULL
        AND (
          6371000 * acos(
            cos(radians(${point.lat})) * cos(radians(center_lat))
            * cos(radians(center_lng) - radians(${point.lng}))
            + sin(radians(${point.lat})) * sin(radians(center_lat))
          )
        ) <= radius_meters
      ORDER BY (
        6371000 * acos(
          cos(radians(${point.lat})) * cos(radians(center_lat))
          * cos(radians(center_lng) - radians(${point.lng}))
          + sin(radians(${point.lat})) * sin(radians(center_lat))
        )
      )
      LIMIT 1
    `);

    const zoneRow = zoneRows[0];
    if (!zoneRow) {
      return { zone: null, userCountInZone: 0 };
    }

    await this.db
      .update(users)
      .set({ homeZoneId: zoneRow.id })
      .where(eq(users.id, userId));

    const threshold = env.ZONE_UNLOCK_THRESHOLD;
    const isUnlocked =
      zoneRow.current_user_count >= threshold ||
      zoneRow.threshold_unlocked_at !== null;

    return {
      zone: {
        id: zoneRow.id,
        name: zoneRow.name,
        h3Index: zoneRow.h3_index,
        currentUserCount: zoneRow.current_user_count,
        threshold,
        isUnlocked,
        thresholdUnlockedAt:
          zoneRow.threshold_unlocked_at?.toISOString() ?? null,
      },
      userCountInZone: zoneRow.current_user_count,
    };
  }

  async recomputeZoneStats(): Promise<number> {
    const allZones = await this.db
      .select({ id: zones.id })
      .from(zones)
      .where(isNull(zones.deletedAt));

    let updated = 0;
    for (const zone of allZones) {
      const countResult = await this.db.execute<{ count: number }>(sql`
        SELECT COUNT(*)::int AS count
        FROM users
        WHERE home_zone_id = ${zone.id}
          AND deleted_at IS NULL
          AND status = 'active'
      `);
      const count = countResult[0]?.count ?? 0;

      const current = await this.db.query.zones.findFirst({
        where: eq(zones.id, zone.id),
      });

      await this.db
        .update(zones)
        .set({
          currentUserCount: count,
          thresholdUnlockedAt:
            count >= env.ZONE_UNLOCK_THRESHOLD && !current?.thresholdUnlockedAt
              ? new Date()
              : current?.thresholdUnlockedAt ?? null,
        })
        .where(eq(zones.id, zone.id));

      updated += 1;
    }
    return updated;
  }
}
