import React, { useState, useEffect, useRef, useCallback } from 'react'
import { blink } from '@/blink/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Users, Clock, Save, History, Eye } from 'lucide-react'
import { toast } from '@/hooks/use-toast'

interface User {
  id: string
  email: string
  display_name?: string
}

interface PromptSession {
  id: string
  prompt_id: string
  user_id: string
  cursor_position: number
  selection_start: number
  selection_end: number
  last_seen: string
  user_color: string
}

interface PromptVersion {
  id: string
  prompt_id: string
  version_number: number
  content: string
  title?: string
  description?: string
  user_id: string
  created_at: string
}

interface Prompt {
  id: string
  title: string
  content: string
  description?: string
  workspace_id: string
  user_id: string
  created_at: string
  updated_at: string
}

interface CollaborativeEditorProps {
  promptId: string
  onClose: () => void
}

const USER_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', 
  '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'
]

export function CollaborativeEditor({ promptId, onClose }: CollaborativeEditorProps) {
  const [prompt, setPrompt] = useState<Prompt | null>(null)
  const [content, setContent] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [activeSessions, setActiveSessions] = useState<PromptSession[]>([])
  const [versions, setVersions] = useState<PromptVersion[]>([])
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [showVersions, setShowVersions] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const saveTimeoutRef = useRef<NodeJS.Timeout>()
  const currentSessionId = useRef<string>()

  // Generate user color
  const getUserColor = useCallback((userId: string) => {
    const hash = userId.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0)
      return a & a
    }, 0)
    return USER_COLORS[Math.abs(hash) % USER_COLORS.length]
  }, [])

  // Load versions
  const loadVersions = useCallback(async () => {
    try {
      const versionData = await blink.db.prompt_versions.list({
        where: { prompt_id: promptId },
        orderBy: { version_number: 'desc' },
        limit: 20
      })
      setVersions(versionData)
    } catch (error) {
      console.error('Error loading versions:', error)
    }
  }, [promptId])

  // Save prompt and create version
  const savePrompt = useCallback(async (newContent: string, newTitle: string, newDescription: string) => {
    if (!prompt || !currentUser) return

    try {
      setIsSaving(true)

      // Update prompt
      await blink.db.prompts.update(promptId, {
        content: newContent,
        title: newTitle,
        description: newDescription,
        updated_at: new Date().toISOString()
      })

      // Create new version
      const nextVersionNumber = Math.max(...versions.map(v => v.version_number), 0) + 1
      
      await blink.db.prompt_versions.create({
        id: `version_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        prompt_id: promptId,
        version_number: nextVersionNumber,
        content: newContent,
        title: newTitle,
        description: newDescription,
        user_id: currentUser.id,
        created_at: new Date().toISOString()
      })

      setLastSaved(new Date())
      await loadVersions()

      toast({
        title: "Saved",
        description: "Changes saved automatically",
      })

    } catch (error) {
      console.error('Error saving prompt:', error)
      toast({
        title: "Error",
        description: "Failed to save changes",
        variant: "destructive"
      })
    } finally {
      setIsSaving(false)
    }
  }, [prompt, currentUser, promptId, versions, loadVersions])

  // Start real-time updates using Blink realtime
  const startRealtimeUpdates = useCallback(() => {
    const channel = blink.realtime.channel(`prompt_${promptId}`)
    
    channel.subscribe({
      userId: currentUser?.id || 'anonymous',
      metadata: { 
        displayName: currentUser?.display_name || currentUser?.email || 'Anonymous',
        color: getUserColor(currentUser?.id || 'anonymous')
      }
    })

    // Listen for content changes
    channel.onMessage((message) => {
      if (message.type === 'content_change' && message.userId !== currentUser?.id) {
        setContent(message.data.content)
        setTitle(message.data.title || '')
        setDescription(message.data.description || '')
      }
    })

    // Listen for presence changes
    channel.onPresence((users) => {
      // Convert presence users to sessions format
      const sessions = users
        .filter(u => u.userId !== currentUser?.id)
        .map(u => ({
          id: `session_${u.userId}`,
          prompt_id: promptId,
          user_id: u.userId,
          cursor_position: 0,
          selection_start: 0,
          selection_end: 0,
          last_seen: new Date().toISOString(),
          user_color: u.metadata?.color || getUserColor(u.userId)
        }))
      setActiveSessions(sessions)
    })

    return () => {
      channel.unsubscribe()
    }
  }, [promptId, currentUser, getUserColor])

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true)
        
        // Get current user
        const user = await blink.auth.me()
        setCurrentUser(user)

        // Load prompt
        const promptData = await blink.db.prompts.list({
          where: { id: promptId },
          limit: 1
        })
        
        if (promptData.length === 0) {
          toast({
            title: "Error",
            description: "Prompt not found",
            variant: "destructive"
          })
          onClose()
          return
        }

        const promptItem = promptData[0]
        setPrompt(promptItem)
        setContent(promptItem.content || '')
        setTitle(promptItem.title || '')
        setDescription(promptItem.description || '')

        // Load versions
        await loadVersions()

        // Create or update session
        const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        currentSessionId.current = sessionId
        
        await blink.db.prompt_sessions.create({
          id: sessionId,
          prompt_id: promptId,
          user_id: user.id,
          cursor_position: 0,
          selection_start: 0,
          selection_end: 0,
          user_color: getUserColor(user.id),
          last_seen: new Date().toISOString()
        })

        // Start real-time updates
        startRealtimeUpdates()
        
      } catch (error) {
        console.error('Error loading data:', error)
        toast({
          title: "Error",
          description: "Failed to load prompt data",
          variant: "destructive"
        })
      } finally {
        setIsLoading(false)
      }
    }

    loadData()

    // Cleanup on unmount
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
      if (currentSessionId.current) {
        // Remove session on cleanup
        blink.db.prompt_sessions.delete(currentSessionId.current).catch(console.error)
      }
    }
  }, [promptId, onClose, getUserColor, loadVersions, startRealtimeUpdates])

  // Handle content changes
  const handleContentChange = (newContent: string) => {
    setContent(newContent)
    
    // Broadcast change to other users
    blink.realtime.publish(`prompt_${promptId}`, 'content_change', {
      content: newContent,
      title,
      description,
      timestamp: Date.now()
    })

    // Auto-save with debounce
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    
    saveTimeoutRef.current = setTimeout(() => {
      savePrompt(newContent, title, description)
    }, 2000) // Save after 2 seconds of inactivity
  }

  // Handle title/description changes
  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle)
    
    // Broadcast change
    blink.realtime.publish(`prompt_${promptId}`, 'content_change', {
      content,
      title: newTitle,
      description,
      timestamp: Date.now()
    })

    // Auto-save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    
    saveTimeoutRef.current = setTimeout(() => {
      savePrompt(content, newTitle, description)
    }, 2000)
  }

  const handleDescriptionChange = (newDescription: string) => {
    setDescription(newDescription)
    
    // Broadcast change
    blink.realtime.publish(`prompt_${promptId}`, 'content_change', {
      content,
      title,
      description: newDescription,
      timestamp: Date.now()
    })

    // Auto-save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    
    saveTimeoutRef.current = setTimeout(() => {
      savePrompt(content, title, newDescription)
    }, 2000)
  }

  // Manual save
  const handleManualSave = () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    savePrompt(content, title, description)
  }

  // Restore version
  const restoreVersion = async (version: PromptVersion) => {
    try {
      setContent(version.content)
      setTitle(version.title || '')
      setDescription(version.description || '')
      
      // Broadcast change
      blink.realtime.publish(`prompt_${promptId}`, 'content_change', {
        content: version.content,
        title: version.title || '',
        description: version.description || '',
        timestamp: Date.now()
      })

      await savePrompt(version.content, version.title || '', version.description || '')
      
      toast({
        title: "Version Restored",
        description: `Restored to version ${version.version_number}`,
      })
    } catch (error) {
      console.error('Error restoring version:', error)
      toast({
        title: "Error",
        description: "Failed to restore version",
        variant: "destructive"
      })
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading collaborative editor...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-white">
        <div className="flex items-center space-x-4">
          <h2 className="text-lg font-semibold text-gray-900">Collaborative Editor</h2>
          
          {/* Active users */}
          <div className="flex items-center space-x-2">
            <Users className="h-4 w-4 text-gray-500" />
            <div className="flex -space-x-2">
              {/* Current user */}
              <div 
                className="w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-xs font-medium text-white"
                style={{ backgroundColor: getUserColor(currentUser?.id || '') }}
                title={currentUser?.display_name || currentUser?.email}
              >
                {(currentUser?.display_name || currentUser?.email || 'U')[0].toUpperCase()}
              </div>
              
              {/* Other users */}
              {activeSessions.map((session) => (
                <div
                  key={session.id}
                  className="w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-xs font-medium text-white"
                  style={{ backgroundColor: session.user_color }}
                  title={session.user_id}
                >
                  {session.user_id[0].toUpperCase()}
                </div>
              ))}
            </div>
            <span className="text-sm text-gray-500">
              {activeSessions.length + 1} online
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* Save status */}
          <div className="flex items-center space-x-2 text-sm text-gray-500">
            {isSaving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600"></div>
                <span>Saving...</span>
              </>
            ) : lastSaved ? (
              <>
                <Save className="h-4 w-4" />
                <span>Saved {lastSaved.toLocaleTimeString()}</span>
              </>
            ) : (
              <span>Unsaved changes</span>
            )}
          </div>

          <Button variant="outline" size="sm" onClick={handleManualSave} disabled={isSaving}>
            <Save className="h-4 w-4 mr-2" />
            Save Now
          </Button>

          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setShowVersions(!showVersions)}
          >
            <History className="h-4 w-4 mr-2" />
            Versions
          </Button>

          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>

      <div className="flex-1 flex">
        {/* Main editor */}
        <div className="flex-1 flex flex-col p-4 space-y-4">
          {/* Title */}
          <Input
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder="Prompt title..."
            className="text-lg font-medium"
          />

          {/* Description */}
          <Input
            value={description}
            onChange={(e) => handleDescriptionChange(e.target.value)}
            placeholder="Brief description (optional)..."
            className="text-sm"
          />

          {/* Content editor */}
          <div className="flex-1 relative">
            <Textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => handleContentChange(e.target.value)}
              placeholder="Start writing your prompt here..."
              className="h-full resize-none font-mono text-sm leading-relaxed"
              style={{ minHeight: '400px' }}
            />
            
            {/* Collaborative cursors would be rendered here in a more advanced implementation */}
          </div>
        </div>

        {/* Version history sidebar */}
        {showVersions && (
          <div className="w-80 border-l bg-gray-50">
            <Card className="h-full rounded-none border-0">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center">
                  <Clock className="h-4 w-4 mr-2" />
                  Version History
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-full">
                  <div className="space-y-2 p-4">
                    {versions.map((version) => (
                      <div
                        key={version.id}
                        className="p-3 border rounded-lg bg-white hover:bg-gray-50 cursor-pointer transition-colors"
                        onClick={() => restoreVersion(version)}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <Badge variant="secondary" className="text-xs">
                            v{version.version_number}
                          </Badge>
                          <span className="text-xs text-gray-500">
                            {new Date(version.created_at).toLocaleString()}
                          </span>
                        </div>
                        
                        {version.title && (
                          <p className="font-medium text-sm text-gray-900 mb-1">
                            {version.title}
                          </p>
                        )}
                        
                        <p className="text-xs text-gray-600 line-clamp-3">
                          {version.content.substring(0, 100)}...
                        </p>
                        
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-xs text-gray-500">
                            by {version.user_id}
                          </span>
                          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs">
                            <Eye className="h-3 w-3 mr-1" />
                            Restore
                          </Button>
                        </div>
                      </div>
                    ))}
                    
                    {versions.length === 0 && (
                      <p className="text-sm text-gray-500 text-center py-8">
                        No versions yet. Changes will be saved automatically.
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}