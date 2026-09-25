-- =============================================================================
-- ROUTE GEOMETRY: the drawn shape of a marshrut, cached
--
-- Run after: migration_distribution.sql
-- Safe to run multiple times.
--
-- distribution_route_stops.position already says WHAT ORDER the agent visits
-- the customers in — until now a human set it with the up/down arrows in the
-- route form. Mapbox's Optimization API can set it against real road times
-- instead, and its Directions API can hand back the road geometry between the
-- stops so the round can be drawn as a line rather than as loose pins.
--
-- Both of those are METERED (100 000 requests/month free, then $2/1000), so
-- what comes back is stored here rather than re-fetched. A route is re-solved
-- when someone presses "optimise" or edits the stops — not when the page is
-- opened, which is the difference between a handful of requests a day and one
-- per page view.
--
-- Nothing here is authoritative: geometry is a picture of what the stops
-- already say. Clearing these columns costs a redraw, never data.
--
--   geometry      GeoJSON LineString, [lng, lat] pairs, as Mapbox returns it.
--                 JSONB and not PostGIS on purpose — it is only ever read back
--                 out whole and handed to Leaflet; nothing queries inside it.
--   distance_m    Metres along the ROAD, from Directions — not crow-flight.
--   duration_s    Seconds of driving, free-flow.
--   optimized_at  When the shape was last solved. NULL = never drawn; the UI
--                 shows the stops as a plain list, exactly as it does today.
--   optimized_by  Which solver produced the ORDER: 'mapbox' when Optimization
--                 v1 did it (≤ 12 stops), 'local' when the route was too long
--                 for it and src/lib/mapbox.ts ordered it itself. Worth
--                 recording because the two are not the same quality, and a
--                 route that says 'local' is one a human may want to check.
-- =============================================================================

ALTER TABLE distribution_routes ADD COLUMN IF NOT EXISTS geometry     JSONB;
ALTER TABLE distribution_routes ADD COLUMN IF NOT EXISTS distance_m   INTEGER;
ALTER TABLE distribution_routes ADD COLUMN IF NOT EXISTS duration_s   INTEGER;
ALTER TABLE distribution_routes ADD COLUMN IF NOT EXISTS optimized_at TIMESTAMPTZ;
ALTER TABLE distribution_routes ADD COLUMN IF NOT EXISTS optimized_by TEXT;

DO $$ BEGIN
  ALTER TABLE distribution_routes
    ADD CONSTRAINT distribution_routes_optimized_by_check
    CHECK (optimized_by IS NULL OR optimized_by IN ('mapbox', 'local'));
EXCEPTION WHEN duplicate_object THEN null; END $$;

COMMENT ON COLUMN distribution_routes.geometry IS
  'GeoJSON LineString ([lng,lat]) of the road path through the stops. Cached Mapbox Directions output — a picture of distribution_route_stops.position, never the source of truth.';
COMMENT ON COLUMN distribution_routes.distance_m IS 'Road metres along the whole round.';
COMMENT ON COLUMN distribution_routes.duration_s IS 'Free-flow driving seconds along the whole round.';
COMMENT ON COLUMN distribution_routes.optimized_by IS 'mapbox = Optimization v1 solved the order (<=12 stops); local = ordered by src/lib/mapbox.ts nearest-neighbour + 2-opt.';

-- The stops are what the geometry describes, so changing them invalidates it.
-- Doing this in the database rather than in the form means ANY write that
-- touches the stops — the form, an import, a fix applied by hand in the SQL
-- editor — leaves the route honestly marked as "not drawn yet" instead of
-- showing a line through customers who are no longer on it.
CREATE OR REPLACE FUNCTION clear_route_geometry() RETURNS TRIGGER AS $$
BEGIN
  UPDATE distribution_routes
     SET geometry = NULL, distance_m = NULL, duration_s = NULL,
         optimized_at = NULL, optimized_by = NULL
   WHERE id = COALESCE(NEW.route_id, OLD.route_id)
     AND optimized_at IS NOT NULL;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

DROP TRIGGER IF EXISTS distribution_route_stops_clear_geometry ON distribution_route_stops;
CREATE TRIGGER distribution_route_stops_clear_geometry
  AFTER INSERT OR UPDATE OR DELETE ON distribution_route_stops
  FOR EACH ROW EXECUTE FUNCTION clear_route_geometry();
