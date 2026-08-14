const express = require('express');
const prisma = require('../db/prisma');

const router = express.Router();

router.get('/data', async (req, res) => {
  const checks = [];
  const results = {};

  async function runCheck(name, fn) {
    try {
      results[name] = await fn();
      checks.push({ name, ok: true });
    } catch (error) {
      checks.push({ name, ok: false, error: error.message });
      results[name] = null;
    }
  }

  await runCheck('db_connected', async () => {
    await prisma.room.count();
    return true;
  });

  await runCheck('rooms_count', async () => prisma.room.count());
  await runCheck('canvas_nodes_count', async () => prisma.canvasNode.count());
  await runCheck('events_count', async () => prisma.event.count());
  await runCheck('tasks_count', async () => prisma.task.count());
  await runCheck('room_shares_count', async () => prisma.roomShare.count());
  await runCheck('room_share_invites_count', async () => prisma.roomShareInvite.count());

  const ok = checks.every((c) => c.ok);

  res.status(ok ? 200 : 500).json({
    status: ok ? 'ok' : 'error',
    checks,
    results,
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
