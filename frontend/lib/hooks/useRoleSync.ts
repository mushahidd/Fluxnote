import { useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { toast } from '@/hooks/use-toast';

/**
 * Hook to sync user role changes from WebSocket messages
 * Listens for 'role:changed' messages and updates the auth context
 * 
 * @param ws - WebSocket connection (from useCanvas or custom hook)
 */
export function useRoleSync(ws: WebSocket | null) {
  const { user, updateUser } = useAuth();
  
  useEffect(() => {
    if (!ws || !user) return;
    
    const handleMessage = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data);
        
        // Check if this is a role change message for the current user
        if (msg.type === 'role:changed' && msg.userId === user.id) {
          console.log('[useRoleSync] Role changed:', msg.newRole);
          
          // Update user role in auth context
          updateUser({ role: msg.newRole });
          
          // Notify user with appropriate message
          const roleLabels: Record<string, string> = {
            viewer: 'Viewer (Read-Only)',
            contributor: 'Contributor',
            lead: 'Lead',
          };
          
          toast({
            title: "Role Updated",
            description: `Your role has been changed to ${roleLabels[msg.newRole] || msg.newRole}`,
          });
          
          // If downgraded to viewer, show additional warning
          if (msg.newRole === 'viewer' || msg.newRole === 'Viewer') {
            setTimeout(() => {
              toast({
                title: "View-Only Mode",
                description: "You can no longer edit the canvas. Contact the room owner to regain edit access.",
                variant: "destructive",
              });
            }, 1000);
          }
        }
      } catch (err) {
        console.error('[useRoleSync] Failed to parse WebSocket message:', err);
      }
    };
    
    ws.addEventListener('message', handleMessage);
    return () => ws.removeEventListener('message', handleMessage);
  }, [ws, user, updateUser]);
}
