import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog'
import { Badge } from '../ui/badge'
import { Avatar, AvatarFallback } from '../ui/avatar'
import { Trash2, UserPlus, Mail, Crown, Edit, Eye } from 'lucide-react'
import { toast } from '../../hooks/use-toast'
import { blink } from '../../blink/client'
import type { WorkspaceMember, WorkspaceInvitation } from '../../types'
import { getWorkspaceMembers, removeWorkspaceMember, canPerformAction } from '../../utils/workspace-access'

interface WorkspaceMembersProps {
  workspaceId: string
  userRole: 'owner' | 'editor' | 'viewer'
  userId: string
}

export function WorkspaceMembers({ workspaceId, userRole, userId }: WorkspaceMembersProps) {
  const [members, setMembers] = useState<WorkspaceMember[]>([])
  const [invitations, setInvitations] = useState<WorkspaceInvitation[]>([])
  const [loading, setLoading] = useState(true)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'editor' | 'viewer'>('editor')
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)
  const [inviting, setInviting] = useState(false)

  const loadMembers = useCallback(async () => {
    try {
      const membersList = await getWorkspaceMembers(workspaceId)
      setMembers(membersList)
    } catch (error) {
      console.error('Failed to load members:', error)
      toast({
        title: 'Error',
        description: 'Failed to load workspace members',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }, [workspaceId])

  const loadInvitations = useCallback(async () => {
    try {
      const invitesList = await blink.db.workspaceInvitations.list({
        where: { 
          AND: [
            { workspaceId: workspaceId },
            { acceptedAt: null }
          ]
        },
        orderBy: { createdAt: 'desc' }
      })
      setInvitations(invitesList)
    } catch (error) {
      console.error('Failed to load invitations:', error)
    }
  }, [workspaceId])

  useEffect(() => {
    loadMembers()
    loadInvitations()
  }, [loadMembers, loadInvitations])

  const handleInviteMember = async () => {
    if (!inviteEmail.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter an email address',
        variant: 'destructive'
      })
      return
    }

    if (!canPerformAction(userRole, 'admin')) {
      toast({
        title: 'Error',
        description: 'Only workspace owners can invite members',
        variant: 'destructive'
      })
      return
    }

    setInviting(true)
    try {
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 7)

      await blink.db.workspaceInvitations.create({
        workspaceId,
        email: inviteEmail.toLowerCase().trim(),
        role: inviteRole,
        invitedBy: userId,
        expiresAt: expiresAt.toISOString()
      })

      toast({
        title: 'Invitation sent',
        description: `Invitation sent to ${inviteEmail}`
      })

      setInviteEmail('')
      setInviteDialogOpen(false)
      loadInvitations()
    } catch (error) {
      console.error('Failed to invite member:', error)
      toast({
        title: 'Error',
        description: 'Failed to send invitation. User may already be invited.',
        variant: 'destructive'
      })
    } finally {
      setInviting(false)
    }
  }

  const handleRemoveMember = async (memberUserId: string) => {
    try {
      await removeWorkspaceMember(workspaceId, memberUserId, userId)
      toast({
        title: 'Member removed',
        description: 'Member has been removed from the workspace'
      })
      loadMembers()
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to remove member',
        variant: 'destructive'
      })
    }
  }

  const handleCancelInvitation = async (invitationId: string) => {
    try {
      await blink.db.workspaceInvitations.delete(invitationId)
      toast({
        title: 'Invitation cancelled',
        description: 'Invitation has been cancelled'
      })
      loadInvitations()
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to cancel invitation',
        variant: 'destructive'
      })
    }
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner':
        return <Crown className="h-4 w-4" />
      case 'editor':
        return <Edit className="h-4 w-4" />
      case 'viewer':
        return <Eye className="h-4 w-4" />
      default:
        return null
    }
  }

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'owner':
        return 'default'
      case 'editor':
        return 'secondary'
      case 'viewer':
        return 'outline'
      default:
        return 'outline'
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4 text-muted-foreground">
            Loading members...
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Members ({members.length})</CardTitle>
        {canPerformAction(userRole, 'admin') && (
          <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <UserPlus className="h-4 w-4 mr-2" />
                Invite Member
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invite Member</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Email Address</label>
                  <Input
                    type="email"
                    placeholder="Enter email address"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Role</label>
                  <Select value={inviteRole} onValueChange={(value: 'editor' | 'viewer') => setInviteRole(value)}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="editor">
                        <div className="flex items-center gap-2">
                          <Edit className="h-4 w-4" />
                          Editor - Can edit prompts
                        </div>
                      </SelectItem>
                      <SelectItem value="viewer">
                        <div className="flex items-center gap-2">
                          <Eye className="h-4 w-4" />
                          Viewer - Can only view prompts
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleInviteMember} disabled={inviting}>
                    {inviting ? 'Sending...' : 'Send Invitation'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {members.map((member) => (
            <div key={member.id} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarFallback>
                    {member.userId.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-medium">{member.userId}</div>
                  <div className="text-sm text-muted-foreground">
                    Joined {new Date(member.joinedAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={getRoleBadgeVariant(member.role) as any} className="flex items-center gap-1">
                  {getRoleIcon(member.role)}
                  {member.role}
                </Badge>
                {canPerformAction(userRole, 'admin') && member.userId !== userId && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveMember(member.userId)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}

          {invitations.length > 0 && (
            <>
              <div className="border-t pt-3 mt-4">
                <h4 className="font-medium text-sm text-muted-foreground mb-3">
                  Pending Invitations ({invitations.length})
                </h4>
                {invitations.map((invitation) => (
                  <div key={invitation.id} className="flex items-center justify-between p-3 border rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                        <Mail className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="font-medium">{invitation.email}</div>
                        <div className="text-sm text-muted-foreground">
                          Invited {new Date(invitation.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={getRoleBadgeVariant(invitation.role) as any} className="flex items-center gap-1">
                        {getRoleIcon(invitation.role)}
                        {invitation.role}
                      </Badge>
                      {canPerformAction(userRole, 'admin') && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCancelInvitation(invitation.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {members.length === 0 && invitations.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <UserPlus className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No members in this workspace yet.</p>
              {canPerformAction(userRole, 'admin') && (
                <p className="text-sm mt-1">Click "Invite Member" to add team members.</p>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}