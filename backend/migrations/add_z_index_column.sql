-- Migration: Add z_index column to canvas_objects table
-- This migration adds z-index support for object layering

-- Add z_index column with default value 0
ALTER TABLE canvas_objects ADD COLUMN IF NOT EXISTS z_index INTEGER DEFAULT 0 NOT NULL;

-- Update existing objects to have sequential z-index values
-- This ensures existing objects have proper layering
UPDATE canvas_objects 
SET z_index = subquery.row_number - 1
FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY canvas_id ORDER BY created_at) as row_number
    FROM canvas_objects
) AS subquery
WHERE canvas_objects.id = subquery.id;

-- Create index on z_index for better performance
CREATE INDEX IF NOT EXISTS idx_canvas_objects_z_index ON canvas_objects(z_index);

-- Create composite index for canvas_id and z_index for efficient queries
CREATE INDEX IF NOT EXISTS idx_canvas_objects_canvas_z_index ON canvas_objects(canvas_id, z_index);

-- Log the migration
DO $$
BEGIN
    RAISE NOTICE 'Z-index column added to canvas_objects table successfully';
END $$;
