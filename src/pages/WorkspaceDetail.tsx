import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Settings, Users, FileText, Plus } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { toast } from '../hooks/use-toast'
import { blink } from '../blink/client'
import type { Workspace, Prompt, User } from '../types'
import { checkWorkspaceAccess, canPerformAction } from '../utils/workspace-access'
import { WorkspaceMembers } from '../components/workspace/WorkspaceMembers'

export function WorkspaceDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [user, setUser] = useState<User | null>(null)
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [userRole, setUserRole] = useState<'owner' | 'editor' | 'viewer' | null>(null)
  const [loading, setLoading] = useState(true)

  const loadWorkspaceData = useCallback(async (userId: string, workspaceId: string) => {
    try {
      // Check access and get user role
      const role = await checkWorkspaceAccess(workspaceId, userId)
      setUserRole(role)

      // Load workspace details
      const workspaceData = await blink.db.workspaces.list({
        where: { id: workspaceId }
      })

      if (workspaceData.length === 0) {
        toast({
          title: 'Workspace not found',
          description: 'The workspace you are looking for does not exist.',
          variant: 'destructive'
        })
        navigate('/dashboard')
        return
      }

      setWorkspace(workspaceData[0])

      // Load workspace prompts
      const promptsData = await blink.db.prompts.list({
        where: { workspaceId: workspaceId },
        orderBy: { updatedAt: 'desc' }
      })
      setPrompts(promptsData)

    } catch (error: any) {
      console.error('Failed to load workspace:', error)
      toast({
        title: 'Access denied',
        description: error.message || 'You do not have access to this workspace.',
        variant: 'destructive'
      })
      navigate('/dashboard')
    } finally {
      setLoading(false)
    }
  }, [navigate])

  useEffect(() => {
    const unsubscribe = blink.auth.onAuthStateChanged((state) => {
      setUser(state.user)
      if (state.user && id) {
        loadWorkspaceData(state.user.id, id)
      }
    })
    return unsubscribe
  }, [id, loadWorkspaceData])

  const createPrompt = async () => {
    if (!user || !workspace || !canPerformAction(userRole!, 'write')) {
      toast({
        title: 'Permission denied',
        description: 'You do not have permission to create prompts in this workspace.',
        variant: 'destructive'
      })
      return
    }

    try {
      const newPrompt = await blink.db.prompts.create({
        id: `prompt_${Date.now()}`,
        title: 'New Prompt',
        content: 'Start writing your prompt here...',
        workspaceId: workspace.id,
        userId: user.id,
        version: 1
      })

      setPrompts(prev => [newPrompt, ...prev])
      navigate(`/editor/${newPrompt.id}`)
    } catch (error) {
      console.error('Failed to create prompt:', error)
      toast({
        title: 'Error',
        description: 'Failed to create new prompt.',
        variant: 'destructive'
      })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading workspace...</p>
        </div>
      </div>
    )
  }

  if (!workspace || !user || !userRole) {
    return null
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{workspace.name}</h1>
            <p className="text-muted-foreground mt-1">{workspace.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={userRole === 'owner' ? 'default' : 'outline'}>
            {userRole}
          </Badge>
          {canPerformAction(userRole, 'write') && (
            <Button onClick={createPrompt}>
              <Plus className="h-4 w-4 mr-2" />
              New Prompt
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Prompts</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{prompts.length}</div>
            <p className="text-xs text-muted-foreground">
              In this workspace
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Your Role</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold capitalize">{userRole}</div>
            <p className="text-xs text-muted-foreground">
              {canPerformAction(userRole, 'write') ? 'Can edit prompts' : 'View only'}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last Updated</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Date(workspace.updatedAt).toLocaleDateString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Workspace activity
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="prompts" className="space-y-4">
        <TabsList>
          <TabsTrigger value="prompts">Prompts</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
        </TabsList>

        <TabsContent value="prompts" className="space-y-4">
          {prompts.length === 0 ? (
            <Card className="p-8 text-center">
              <div className="mx-auto w-12 h-12 bg-muted rounded-lg flex items-center justify-center mb-4">
                <FileText className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium mb-2">No prompts yet</h3>
              <p className="text-muted-foreground mb-4">
                {canPerformAction(userRole, 'write') 
                  ? 'Create your first prompt to get started.'
                  : 'No prompts have been created in this workspace yet.'
                }
              </p>
              {canPerformAction(userRole, 'write') && (
                <Button onClick={createPrompt}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Prompt
                </Button>
              )}
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {prompts.map((prompt) => (
                <Card key={prompt.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <CardTitle className="text-lg">{prompt.title}</CardTitle>
                    <CardDescription className="line-clamp-2">
                      {prompt.content.substring(0, 100)}...
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline">v{prompt.version}</Badge>
                        {prompt.tags && JSON.parse(prompt.tags).map((tag: string) => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(prompt.updatedAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button 
                        size="sm" 
                        onClick={() => navigate(`/editor/${prompt.id}`)}
                        className="flex-1"
                        disabled={!canPerformAction(userRole, 'write')}
                      >
                        {canPerformAction(userRole, 'write') ? 'Edit' : 'View'}
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => navigate(`/playground?promptId=${prompt.id}`)}
                        className="flex-1"
                      >
                        Test
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="members">
          <WorkspaceMembers 
            workspaceId={workspace.id}
            userRole={userRole}
            userId={user.id}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}