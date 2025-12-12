-- Fix Calibration: Add Missing 7th Segment (G - Middle) to Each Digit
-- This script updates the calibration_settings table to ensure each digit has exactly 7 segments

-- Backup current calibration first
-- Run this before making changes:
-- SELECT * FROM calibration_settings WHERE id = 1;

-- Update calibration with complete 7-segment data
-- Each digit now has all 7 segments: A, B, C, D, E, F, G
UPDATE calibration_settings
SET segment_boxes = '[
  [
    {"x":290.66666666666663,"y":64.8,"width":49.33333333333337,"height":41.760000000000005},
    {"x":385.3333333333333,"y":146.88,"width":48,"height":72},
    {"x":380,"y":403.2,"width":37.333333333333314,"height":67.68},
    {"x":265.3333333333333,"y":535.68,"width":56,"height":51.84000000000003},
    {"x":186.66666666666666,"y":394.56,"width":34.66666666666666,"height":74.88},
    {"x":196,"y":152.64,"width":44,"height":73.44},
    {"x":296,"y":299.52,"width":30.66666666666663,"height":37.44}
  ],
  [
    {"x":613.3333333333333,"y":61.919999999999995,"width":29.33333333333337,"height":43.199999999999996},
    {"x":696,"y":161.28,"width":44,"height":86.39999999999998},
    {"x":690.6666666666666,"y":403.2,"width":54.66666666666663,"height":90.71999999999997},
    {"x":582.6666666666666,"y":541.4399999999999,"width":70.66666666666663,"height":48.960000000000036},
    {"x":489.3333333333333,"y":383.03999999999996,"width":62.666666666666686,"height":90.72000000000003},
    {"x":501.3333333333333,"y":146.88,"width":57.333333333333314,"height":86.4},
    {"x":600,"y":308.15999999999997,"width":48,"height":17.28000000000003}
  ],
  [
    {"x":913.3333333333333,"y":59.04,"width":69.33333333333337,"height":50.4},
    {"x":1029.3333333333333,"y":132.48,"width":42.66666666666674,"height":95.03999999999999},
    {"x":1010.6666666666666,"y":408.96,"width":65.33333333333337,"height":83.51999999999998},
    {"x":914.6666666666666,"y":537.12,"width":72,"height":70.55999999999995},
    {"x":821.3333333333333,"y":406.08,"width":58.66666666666674,"height":82.07999999999998},
    {"x":805.3333333333333,"y":131.04,"width":77.33333333333337,"height":123.84},
    {"x":900,"y":300,"width":50,"height":30}
  ]
]'
WHERE id = 1;

-- Verify the fix
SELECT
    id,
    setting_type,
    device_name,
    num_digits,
    has_decimal_point,
    decimal_position,
    JSON_LENGTH(segment_boxes) as total_digits,
    JSON_LENGTH(JSON_EXTRACT(segment_boxes, '$[0]')) as digit1_segments,
    JSON_LENGTH(JSON_EXTRACT(segment_boxes, '$[1]')) as digit2_segments,
    JSON_LENGTH(JSON_EXTRACT(segment_boxes, '$[2]')) as digit3_segments
FROM calibration_settings
WHERE id = 1;

-- Expected output:
-- digit1_segments: 7
-- digit2_segments: 7
-- digit3_segments: 7

-- Alternative: If you want to recalibrate from scratch, delete the old one:
-- DELETE FROM calibration_settings WHERE id = 1;
-- Then use the calibration wizard in Settings > Moisture Settings to create a new calibration

-- Note: The 7th segment (G - Middle) has been added to each digit
-- Segment order: A (Top), B (Top-Right), C (Bottom-Right), D (Bottom),
--                E (Bottom-Left), F (Top-Left), G (Middle)
