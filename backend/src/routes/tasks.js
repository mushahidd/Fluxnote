// Tasks API Routes
// GET    /api/tasks/:roomId          → get all tasks for a room
// PATCH  /api/tasks/:taskId          → update task status
// DELETE /api/tasks/:taskId          → delete a task

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { getSupabaseServiceClient } = require('../utils/supabase');
const { broadcast } = require('../ws/wsServer');
const prisma = require('../db/prisma');

// Get all tasks for a room
router.get('/:roomId', authenticateToken, async (req, res) => {
  try {
    const { roomId } = req.params;
    
    // Try Prisma first (faster and more reliable)
    try {
      const tasks = await prisma.task.findMany({
        where: { roomId },
        include: {
          author: {
            select: {
              id: true,
              name: true,
              email: true,
            }
          }
        },
        orderBy: { createdAt: 'desc' },
      });

      const formattedTasks = tasks.map(task => ({
        id: task.id,
        text: task.text,
        status: task.status,
        nodeId: task.nodeId,
        authorId: task.authorId,
        authorName: task.author?.name || task.author?.email || 'Unknown',
        roomId: task.roomId,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
      }));

      return res.json({ tasks: formattedTasks });
    } catch (prismaError) {
      console.warn('[Tasks] Prisma failed, falling back to Supabase:', prismaError.message);
    }

    // Fallback to Supabase
    const serviceClient = getSupabaseServiceClient();
    
    if (!serviceClient) {
      return res.status(500).json({ error: 'Database client not available' });
    }

    // Fetch tasks with author information
    const { data: tasks, error } = await serviceClient
      .from('tasks')
      .select(`
        id,
        text,
        status,
        node_id,
        author_id,
        room_id,
        created_at,
        updated_at,
        users:author_id (
          id,
          email,
          user_metadata
        )
      `)
      .eq('room_id', roomId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch tasks:', error);
      return res.status(500).json({ error: 'Failed to fetch tasks' });
    }

    // Format tasks with author name
    const formattedTasks = (tasks || []).map(task => ({
      id: task.id,
      text: task.text,
      status: task.status,
      nodeId: task.node_id,
      authorId: task.author_id,
      authorName: task.users?.user_metadata?.display_name || 
                  task.users?.user_metadata?.full_name || 
                  task.users?.email || 
                  'Unknown',
      roomId: task.room_id,
      createdAt: task.created_at,
      updatedAt: task.updated_at,
    }));

    res.json({ tasks: formattedTasks });
  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// Update task status (supports both /api/tasks/:taskId and /api/tasks/:taskId/status)
router.patch('/:taskId/status', authenticateToken, updateTaskStatusHandler);
router.patch('/:taskId', authenticateToken, updateTaskStatusHandler);

async function updateTaskStatusHandler(req, res) {
  try {
    const { taskId } = req.params;
    const { status } = req.body;

    if (!['todo', 'in_progress', 'done'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    // Try Prisma first
    try {
      const task = await prisma.task.update({
        where: { id: taskId },
        data: { 
          status,
          updatedAt: new Date(),
        },
        include: {
          author: {
            select: {
              id: true,
              name: true,
              email: true,
            }
          }
        }
      });

      const formattedTask = {
        id: task.id,
        text: task.text,
        status: task.status,
        nodeId: task.nodeId,
        authorId: task.authorId,
        authorName: task.author?.name || task.author?.email || 'Unknown',
        roomId: task.roomId,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
      };

      // Broadcast update to all users in room via WebSocket
      broadcast(task.roomId, {
        type: 'task:updated',
        task: formattedTask,
      });

      return res.json({ task: formattedTask });
    } catch (prismaError) {
      console.warn('[Tasks] Prisma update failed, falling back to Supabase:', prismaError.message);
    }

    // Fallback to Supabase
    const serviceClient = getSupabaseServiceClient();
    
    if (!serviceClient) {
      return res.status(500).json({ error: 'Database client not available' });
    }

    const { data, error } = await serviceClient
      .from('tasks')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', taskId)
      .select()
      .single();

    if (error) {
      console.error('Failed to update task status:', error);
      return res.status(500).json({ error: 'Failed to update task status' });
    }

    // Broadcast update via WebSocket
    if (data && data.room_id) {
      broadcast(data.room_id, {
        type: 'task:updated',
        task: {
          id: data.id,
          text: data.text,
          status: data.status,
          nodeId: data.node_id,
          roomId: data.room_id,
          updatedAt: data.updated_at,
        },
      });
    }

    res.json({ task: data });
  } catch (error) {
    console.error('Update task status error:', error);
    res.status(500).json({ error: 'Failed to update task status' });
  }
}

// Delete a task
router.delete('/:taskId', authenticateToken, async (req, res) => {
  try {
    const { taskId } = req.params;
    const serviceClient = getSupabaseServiceClient();
    
    if (!serviceClient) {
      return res.status(500).json({ error: 'Database client not available' });
    }

    const { error } = await serviceClient
      .from('tasks')
      .delete()
      .eq('id', taskId);

    if (error) {
      console.error('Failed to delete task:', error);
      return res.status(500).json({ error: 'Failed to delete task' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

module.exports = router;
