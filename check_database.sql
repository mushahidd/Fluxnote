-- Check if CanvasNode table has any data
SELECT COUNT(*) as total_nodes FROM "CanvasNode";

-- Show recent nodes
SELECT id, type, "roomId", x, y, "createdBy", "updatedAt" 
FROM "CanvasNode" 
ORDER BY "updatedAt" DESC 
LIMIT 10;
