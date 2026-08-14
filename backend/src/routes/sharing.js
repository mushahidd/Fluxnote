// Sharing API Routes
//
// GET    /api/rooms/:roomId/share          → get share settings + invites
// POST   /api/rooms/:roomId/share          → create/update share settings
// POST   /api/rooms/:roomId/share/invites  → add email invites
// DELETE /api/rooms/:roomId/share/invites/:inviteId → revoke invite
// GET    /api/share/validate/:token        → validate a share token (public)
// GET    /api/share/shared-with-me         → rooms shared with current user

const express = require('express');
const router = express.Router({ mergeParams: true });
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const shareService = require('../services/shareService');

// ── GET share settings for a room ──────────────────────────────────────────
router.get('/:roomId/share', authenticateToken, async (req, res) => {
  try {
    const { roomId } = req.params;
    const settings = await shareService.getShareSettings(roomId, req.accessToken, req.user.id);
    res.json(settings || { share: null, invites: [] });
  } catch (err) {
    console.error('getShareSettings error:', err);
    res.status(500).json({ error: 'Failed to get share settings' });
  }
});

// ── Create / update share settings ─────────────────────────────────────────
// Body: { accessType: 'anyone_with_link'|'restricted', linkRole: 'viewer'|'contributor'|'lead' }
router.post('/:roomId/share', authenticateToken, requireRole('lead', 'owner'), async (req, res) => {
  try {
    const { roomId } = req.params;
    const { accessType, linkRole } = req.body;

    if (accessType && !['anyone_with_link', 'restricted'].includes(accessType)) {
      return res.status(400).json({ error: 'Invalid accessType' });
    }
    if (linkRole && !['viewer', 'contributor', 'lead'].includes(linkRole)) {
      return res.status(400).json({ error: 'Invalid linkRole' });
    }

    const share = await shareService.updateShareSettings(
      roomId, req.user.id, { accessType, linkRole }, req.accessToken
    );
    res.json({ share });
  } catch (err) {
    console.error('updateShareSettings error:', err);
    res.status(500).json({ error: 'Failed to update share settings' });
  }
});

// ── Add email invites ───────────────────────────────────────────────────────
// Body: { emails: string[], role: 'viewer'|'contributor'|'lead' }
router.post('/:roomId/share/invites', authenticateToken, requireRole('lead', 'owner'), async (req, res) => {
  try {
    const { roomId } = req.params;
    const { emails, role = 'viewer' } = req.body;

    if (!Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({ error: 'emails array required' });
    }
    if (!['viewer', 'contributor', 'lead'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalid = emails.filter(e => !emailRegex.test(e));
    if (invalid.length > 0) {
      return res.status(400).json({ error: `Invalid emails: ${invalid.join(', ')}` });
    }

    const invites = await shareService.addInvites(roomId, req.user.id, emails, role, req.accessToken);
    res.status(201).json({ invites });
  } catch (err) {
    console.error('addInvites error:', err);
    res.status(500).json({ error: 'Failed to add invites' });
  }
});

// ── Revoke an invite ────────────────────────────────────────────────────────
router.delete('/:roomId/share/invites/:inviteId', authenticateToken, requireRole('lead', 'owner'), async (req, res) => {
  try {
    await shareService.revokeInvite(req.params.inviteId, req.accessToken);
    res.json({ success: true });
  } catch (err) {
    console.error('revokeInvite error:', err);
    res.status(500).json({ error: 'Failed to revoke invite' });
  }
});

// ── Validate a share token (public — no auth required) ─────────────────────
router.get('/validate/:token', async (req, res) => {
  try {
    const result = await shareService.validateShareToken(req.params.token);
    if (!result) return res.status(404).json({ error: 'Invalid or expired share link' });
    res.json(result); // { roomId, role }
  } catch (err) {
    res.status(500).json({ error: 'Failed to validate token' });
  }
});

// ── Rooms shared with me ────────────────────────────────────────────────────
router.get('/shared-with-me', authenticateToken, async (req, res) => {
  try {
    const rooms = await shareService.getSharedWithMe(req.user.id, req.user.email, req.accessToken);
    res.json({ rooms });
  } catch (err) {
    console.error('getSharedWithMe error:', err);
    res.status(500).json({ error: 'Failed to fetch shared rooms' });
  }
});

module.exports = router;
