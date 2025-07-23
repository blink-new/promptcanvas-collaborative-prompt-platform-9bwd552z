import { useState, useEffect } from 'react'
import { Plus, Search, MoreHorizontal, Users, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { blink } from '@/blink/client'
import type { Workspace, User } from '@/types'

export function Workspaces() {
  const [user, setUser] = useState<User | null>(null)
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)

  const loadWorkspaces = async (userId: string) => {
    try {
      const data = await blink.db.workspaces.list({
        where: { user_id: userId },
        orderBy: { updated_at: 'desc' }
      })
      setWorkspaces(data)
    } catch (error) {
      console.error('Failed to load workspaces:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const unsubscribe = blink.auth.onAuthStateChanged((state) => {
      setUser(state.user)
      if (state.user) {
        loadWorkspaces(state.user.id)
      }
    })
    return unsubscribe
  }, [])

  const createWorkspace = async () => {
    if (!user) return
    
    try {
      const newWorkspace = await blink.db.workspaces.create({
        id: `ws_${Date.now()}`,
        name: `Workspace ${workspaces.length + 1}`,
        description: 'A new collaborative workspace for prompt engineering',
        user_id: user.id
      })
      setWorkspaces(prev => [newWorkspace, ...prev])
    } catch (error) {
      console.error('Failed to create workspace:', error)
    }
  }

  const deleteWorkspace = async (workspaceId: string) => {
    try {
      await blink.db.workspaces.delete(workspaceId)
      setWorkspaces(prev => prev.filter(w => w.id !== workspaceId))
    } catch (error) {
      console.error('Failed to delete workspace:', error)
    }
  }

  const filteredWorkspaces = workspaces.filter(workspace =>
    workspace.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    workspace.description?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading workspaces...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Workspaces</h1>
          <p className="text-muted-foreground mt-1">
            Manage your collaborative prompt engineering spaces.
          </p>
        </div>
        <Button onClick={createWorkspace}>
          <Plus className="h-4 w-4 mr-2" />
          New Workspace
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search workspaces..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Workspaces Grid */}
      {filteredWorkspaces.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="mx-auto w-16 h-16 bg-muted rounded-lg flex items-center justify-center mb-6">
            <Users className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-xl font-medium mb-2">
            {searchQuery ? 'No workspaces found' : 'No workspaces yet'}
          </h3>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            {searchQuery 
              ? 'Try adjusting your search terms or create a new workspace.'
              : 'Create your first workspace to start collaborating on prompts with your team.'
            }
          </p>
          <Button onClick={createWorkspace}>
            <Plus className="h-4 w-4 mr-2" />
            Create Workspace
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredWorkspaces.map((workspace) => (
            <Card key={workspace.id} className="hover:shadow-md transition-shadow group">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg mb-1">{workspace.name}</CardTitle>
                    <CardDescription className="line-clamp-2">
                      {workspace.description}
                    </CardDescription>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>Edit</DropdownMenuItem>
                      <DropdownMenuItem>Duplicate</DropdownMenuItem>
                      <DropdownMenuItem 
                        className="text-destructive"
                        onClick={() => deleteWorkspace(workspace.id)}
                      >
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <Badge variant="secondary">Active</Badge>
                    <div className="flex items-center text-xs text-muted-foreground">
                      <Users className="h-3 w-3 mr-1" />
                      1 member
                    </div>
                  </div>
                  <div className="flex items-center text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3 mr-1" />
                    {new Date(workspace.updated_at).toLocaleDateString()}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}