require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env'), override: true });

const prisma = require('./prisma');

async function migrate() {
  const existsResult = await prisma.$queryRaw`
    SELECT to_regclass('public."CanvasNode"')::text AS table_name
  `;

  const hasLegacyTable = Array.isArray(existsResult) && existsResult[0]?.table_name;
  if (!hasLegacyTable) {
    console.log('No legacy CanvasNode table found. Skipping.');
    return;
  }

  const insertSql = `
  INSERT INTO public.canvas_nodes (
    id,
    room_id,
    parent_id,
    created_by,
    type,
    content,
    position,
    style,
    ai_label,
    z_index,
    locked,
    version,
    created_at,
    updated_at
  )
  SELECT
    gen_random_uuid() as id,
    "roomId"::uuid as room_id,
    NULL::uuid as parent_id,
    "createdBy"::uuid as created_by,
    COALESCE("type", 'sticky') as type,
    jsonb_set(
      jsonb_set(
        COALESCE("content", '{}'::jsonb),
        '{__legacy_id}',
        to_jsonb("id"::text),
        true
      ),
      '{__extra}',
      jsonb_strip_nulls(jsonb_build_object(
        'points', "points",
        'taskStatus', "taskStatus",
        'assignee', "assignee",
        'text', ("content"->>'text')
      )),
      true
    ) as content,
    jsonb_build_object(
      'x', COALESCE("x", 0),
      'y', COALESCE("y", 0),
      'width', COALESCE("width", 200),
      'height', COALESCE("height", 150),
      'rotation', COALESCE("rotation", 0)
    ) as position,
    jsonb_strip_nulls(jsonb_build_object(
      'color', "color"
    )) as style,
    CASE lower(COALESCE("intent", ''))
      WHEN 'action' THEN 'action_item'
      WHEN 'question' THEN 'open_question'
      ELSE NULLIF("intent", '')
    END as ai_label,
    0 as z_index,
    COALESCE("locked", false) as locked,
    1 as version,
    COALESCE("createdAt", now()) as created_at,
    COALESCE("updatedAt", now()) as updated_at
  FROM public."CanvasNode" old
  WHERE
    "roomId" ~* '^[0-9a-f-]{36}$'
    AND "createdBy" ~* '^[0-9a-f-]{36}$'
    AND NOT EXISTS (
      SELECT 1 FROM public.canvas_nodes cn
      WHERE cn.content->>'__legacy_id' = old."id"::text
    );
  `;

  await prisma.$executeRawUnsafe(insertSql);
}

migrate()
  .then(() => {
    console.log('Legacy CanvasNode migration complete.');
  })
  .catch((error) => {
    console.error('Legacy CanvasNode migration failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
