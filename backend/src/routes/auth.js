// POST /api/auth/register → create Supabase user, return access token
// POST /api/auth/login    → verify password, return access token + role
// Roles are stored in user metadata

const express = require('express');
const router = express.Router();
const { supabase } = require('../utils/supabase');
const { syncUserProfile } = require('../services/profileService');
const { ensureWorkspaceForUser } = require('../services/workspaceService');
const { logAuthEvent } = require('../services/auditService');
const { authenticateToken } = require('../middleware/auth');

// Register new user
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // Validate input
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'name, email, and password required' });
    }

    // Validate role
    const validRoles = ['Lead', 'Contributor', 'Viewer'];
    const userRole = role || 'Contributor'; // Default to Contributor
    
    if (!validRoles.includes(userRole)) {
      return res.status(400).json({ 
        error: 'Invalid role',
        valid: validRoles,
      });
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: name,
          role: userRole,
        },
      },
    });

    if (error) {
      if (error.message?.toLowerCase().includes('already registered')) {
        return res.status(409).json({ error: 'User already exists' });
      }
      return res.status(400).json({ error: error.message || 'Registration failed' });
    }

    const session = data?.session;
    const user = data?.user;

    if (!session?.access_token) {
      return res.status(202).json({
        message: 'Check your email to confirm your account before signing in.',
        user: user
          ? {
              id: user.id,
              name: user.user_metadata?.display_name || name,
              email: user.email,
              role: user.user_metadata?.role || userRole,
            }
          : null,
      });
    }

    res.status(201).json({
      token: session.access_token,
      user: {
        id: user.id,
        name: user.user_metadata?.display_name || name,
        email: user.email,
        role: user.user_metadata?.role || userRole,
      },
    });

    // Create workspace and sync profile in background
    Promise.all([
      syncUserProfile(user, session.access_token),
      ensureWorkspaceForUser(user, session.access_token),
      logAuthEvent({
        accessToken: session.access_token,
        userId: user.id,
        eventType: 'signup',
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        success: true,
      })
    ]).catch(err => console.error('Background tasks error:', err));
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login user
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password required' });
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data?.session || !data?.user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const { user, session } = data;

    res.json({
      token: session.access_token,
      user: {
        id: user.id,
        name: user.user_metadata?.display_name || user.user_metadata?.full_name || user.email,
        email: user.email,
        role: user.user_metadata?.role || 'Contributor',
      },
    });

    // Create workspace and sync profile in background
    Promise.all([
      syncUserProfile(user, session.access_token),
      ensureWorkspaceForUser(user, session.access_token),
      logAuthEvent({
        accessToken: session.access_token,
        userId: user.id,
        eventType: 'login',
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        success: true,
      })
    ]).catch(err => console.error('Background tasks error:', err));
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Sync profile metadata after OAuth login
router.post('/sync-profile', authenticateToken, async (req, res) => {
  try {
    const { data, error } = await supabase.auth.getUser(req.accessToken);

    if (error || !data?.user) {
      return res.status(401).json({ error: 'Invalid access token' });
    }

    const profile = await syncUserProfile(data.user, req.accessToken);
    const workspace = await ensureWorkspaceForUser(data.user, req.accessToken);
    
    res.json({ success: true, profile, workspace });
  } catch (error) {
    console.error('Sync profile error:', error);
    res.status(500).json({ error: 'Failed to sync profile' });
  }
});

router.post('/logout', authenticateToken, async (req, res) => {
  try {
    await logAuthEvent({
      accessToken: req.accessToken,
      userId: req.user.id,
      eventType: 'logout',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      success: true,
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

module.exports = router;
