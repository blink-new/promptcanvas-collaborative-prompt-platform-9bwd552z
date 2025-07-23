import { blink } from '../blink/client'
import type { WorkspaceMember, WorkspaceWithMembers } from '../types'

export class WorkspaceAccessError extends Error {
  constructor(message: string, public code: 'FORBIDDEN' | 'NOT_FOUND' = 'FORBIDDEN') {
    super(message)
    this.name = 'WorkspaceAccessError'
  }
}

/**
 * Check if user has access to a workspace and return their role
 */
export async function checkWorkspaceAccess(
  workspaceId: string, 
  userId: string
): Promise<'owner' | 'editor' | 'viewer'> {
  try {
    // Check if user is a member of the workspace
    const members = await blink.db.workspaceMembers.list({
      where: {
        AND: [
          { workspaceId: workspaceId },
          { userId: userId }
        ]
      }
    })

    if (members.length === 0) {
      throw new WorkspaceAccessError('Access denied: You are not a member of this workspace', 'FORBIDDEN')
    }

    return members[0].role as 'owner' | 'editor' | 'viewer'
  } catch (error) {
    if (error instanceof WorkspaceAccessError) {
      throw error
    }
    throw new WorkspaceAccessError('Failed to check workspace access', 'NOT_FOUND')
  }
}

/**
 * Get all workspaces that a user has access to
 */
export async function getUserWorkspaces(userId: string): Promise<WorkspaceWithMembers[]> {
  try {
    // Get all workspace memberships for the user
    const memberships = await blink.db.workspaceMembers.list({
      where: { userId: userId }
    })

    if (memberships.length === 0) {
      return []
    }

    // Get workspace details for each membership
    const workspaceIds = memberships.map(m => m.workspaceId)
    const workspaces = await blink.db.workspaces.list({
      where: {
        id: { in: workspaceIds }
      }
    })

    // Combine workspace data with user role
    return workspaces.map(workspace => {
      const membership = memberships.find(m => m.workspaceId === workspace.id)
      return {
        ...workspace,
        user_role: membership?.role as 'owner' | 'editor' | 'viewer'
      }
    })
  } catch (error) {
    console.error('Failed to get user workspaces:', error)
    return []
  }
}

/**
 * Get workspace members with their details
 */
export async function getWorkspaceMembers(workspaceId: string): Promise<WorkspaceMember[]> {
  try {
    const members = await blink.db.workspaceMembers.list({
      where: { workspaceId: workspaceId },
      orderBy: { createdAt: 'asc' }
    })

    return members
  } catch (error) {
    console.error('Failed to get workspace members:', error)
    return []
  }
}

/**
 * Add a user to a workspace
 */
export async function addWorkspaceMember(
  workspaceId: string,
  userId: string,
  role: 'owner' | 'editor' | 'viewer',
  invitedBy?: string
): Promise<WorkspaceMember> {
  try {
    const member = await blink.db.workspaceMembers.create({
      workspaceId,
      userId,
      role,
      invitedBy,
      invitedAt: new Date().toISOString(),
      joinedAt: new Date().toISOString()
    })

    return member
  } catch (error) {
    console.error('Failed to add workspace member:', error)
    throw new WorkspaceAccessError('Failed to add member to workspace')
  }
}

/**
 * Remove a user from a workspace
 */
export async function removeWorkspaceMember(
  workspaceId: string,
  userId: string,
  requestingUserId: string
): Promise<void> {
  try {
    // Check if requesting user has permission (owner or removing themselves)
    const requestingUserRole = await checkWorkspaceAccess(workspaceId, requestingUserId)
    
    if (requestingUserRole !== 'owner' && requestingUserId !== userId) {
      throw new WorkspaceAccessError('Only workspace owners can remove other members')
    }

    // Don't allow removing the last owner
    if (requestingUserId === userId && requestingUserRole === 'owner') {
      const owners = await blink.db.workspaceMembers.list({
        where: {
          AND: [
            { workspaceId: workspaceId },
            { role: 'owner' }
          ]
        }
      })

      if (owners.length <= 1) {
        throw new WorkspaceAccessError('Cannot remove the last owner from workspace')
      }
    }

    // Remove the member
    const members = await blink.db.workspaceMembers.list({
      where: {
        AND: [
          { workspaceId: workspaceId },
          { userId: userId }
        ]
      }
    })

    if (members.length > 0) {
      await blink.db.workspaceMembers.delete(members[0].id)
    }
  } catch (error) {
    if (error instanceof WorkspaceAccessError) {
      throw error
    }
    console.error('Failed to remove workspace member:', error)
    throw new WorkspaceAccessError('Failed to remove member from workspace')
  }
}

/**
 * Check if user can perform an action based on their role
 */
export function canPerformAction(
  userRole: 'owner' | 'editor' | 'viewer',
  action: 'read' | 'write' | 'admin'
): boolean {
  switch (action) {
    case 'read':
      return ['owner', 'editor', 'viewer'].includes(userRole)
    case 'write':
      return ['owner', 'editor'].includes(userRole)
    case 'admin':
      return userRole === 'owner'
    default:
      return false
  }
}