CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE bookings
ADD COLUMN time_range tstzrange;

CREATE OR REPLACE FUNCTION bookings_set_time_range()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.time_range := tstzrange(NEW.starts_at, NEW.ends_at, '[)');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bookings_time_range_trigger ON bookings;

CREATE TRIGGER bookings_time_range_trigger
BEFORE INSERT OR UPDATE OF starts_at, ends_at
ON bookings
FOR EACH ROW
EXECUTE FUNCTION bookings_set_time_range();

UPDATE bookings
SET time_range = tstzrange(starts_at, ends_at, '[)')
WHERE time_range IS NULL;

ALTER TABLE bookings
ALTER COLUMN time_range SET NOT NULL;

ALTER TABLE bookings
ADD CONSTRAINT bookings_no_overlap
EXCLUDE USING gist (
  barber_id WITH =,
  time_range WITH &&
)
WHERE (status = 'confirmed');
