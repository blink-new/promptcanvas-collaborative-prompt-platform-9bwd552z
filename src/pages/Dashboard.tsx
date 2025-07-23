import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Clock, Users, FileText, Edit, Play, Crown } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { blink } from '../blink/client'
import type { Prompt, User, WorkspaceWithMembers } from '../types'
import { getUserWorkspaces, addWorkspaceMember } from '../utils/workspace-access'

export function Dashboard() {
  const navigate = useNavigate()
  const [user, setUser] = useState<User | null>(null)
  const [workspaces, setWorkspaces] = useState<WorkspaceWithMembers[]>([])
  const [recentPrompts, setRecentPrompts] = useState<Prompt[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = async (userId: string) => {
    try {
      // Load workspaces that user has access to
      const workspacesData = await getUserWorkspaces(userId)
      setWorkspaces(workspacesData.slice(0, 6)) // Limit to 6 for dashboard

      // Load recent prompts from accessible workspaces
      if (workspacesData.length > 0) {
        const workspaceIds = workspacesData.map(w => w.id)
        const promptsData = await blink.db.prompts.list({
          where: { 
            workspaceId: { in: workspaceIds }
          },
          orderBy: { updatedAt: 'desc' },
          limit: 8
        })
        setRecentPrompts(promptsData)
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const unsubscribe = blink.auth.onAuthStateChanged((state) => {
      setUser(state.user)
      if (state.user) {
        loadData(state.user.id)
      }
    })
    return unsubscribe
  }, [])

  const createWorkspace = async () => {
    if (!user) return
    
    try {
      const newWorkspace = await blink.db.workspaces.create({
        id: `ws_${Date.now()}`,
        name: 'New Workspace',
        description: 'A new workspace for collaborative prompt engineering',
        userId: user.id,
        ownerId: user.id
      })

      // Add the creator as owner
      await addWorkspaceMember(newWorkspace.id, user.id, 'owner')
      
      // Reload data to show the new workspace
      loadData(user.id)
    } catch (error) {
      console.error('Failed to create workspace:', error)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            Welcome back{user?.displayName ? `, ${user.displayName}` : ''}!
          </h1>
          <p className="text-muted-foreground mt-1">
            Continue working on your prompts or start something new.
          </p>
        </div>
        <Button onClick={createWorkspace}>
          <Plus className="h-4 w-4 mr-2" />
          New Workspace
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Workspaces</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{workspaces.length}</div>
            <p className="text-xs text-muted-foreground">
              Active collaborative spaces
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Prompts</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{recentPrompts.length}</div>
            <p className="text-xs text-muted-foreground">
              Prompts created this month
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {recentPrompts.length > 0 ? 'Active' : 'Quiet'}
            </div>
            <p className="text-xs text-muted-foreground">
              Last updated today
            </p>
          </CardContent>
        </Card>
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Your Workspaces</h2>
          <Button variant="outline" size="sm" onClick={() => navigate('/workspaces')}>
            View All
          </Button>
        </div>
        
        {workspaces.length === 0 ? (
          <Card className="p-8 text-center">
            <div className="mx-auto w-12 h-12 bg-muted rounded-lg flex items-center justify-center mb-4">
              <Users className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium mb-2">No workspaces yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first workspace to start collaborating on prompts.
            </p>
            <Button onClick={createWorkspace}>
              <Plus className="h-4 w-4 mr-2" />
              Create Workspace
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {workspaces.map((workspace) => (
              <Card 
                key={workspace.id} 
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => navigate(`/workspace/${workspace.id}`)}
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{workspace.name}</CardTitle>
                    {workspace.user_role === 'owner' && (
                      <Crown className="h-4 w-4 text-amber-500" />
                    )}
                  </div>
                  <CardDescription>{workspace.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">Active</Badge>
                      <Badge 
                        variant={workspace.user_role === 'owner' ? 'default' : 'outline'}
                        className="text-xs"
                      >
                        {workspace.user_role}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(workspace.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Recent Prompts</h2>
          <Button variant="outline" size="sm" onClick={() => navigate('/library')}>
            View All
          </Button>
        </div>
        
        {recentPrompts.length === 0 ? (
          <Card className="p-8 text-center">
            <div className="mx-auto w-12 h-12 bg-muted rounded-lg flex items-center justify-center mb-4">
              <FileText className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium mb-2">No prompts yet</h3>
            <p className="text-muted-foreground mb-4">
              Start creating prompts in your workspaces.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {recentPrompts.map((prompt) => (
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
                      <Badge variant="outline">Latest</Badge>
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
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => navigate(`/playground?promptId=${prompt.id}`)}
                      className="flex-1"
                    >
                      <Play className="h-4 w-4 mr-2" />
                      Test
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}