import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Search, Filter, Plus, Tag, Calendar, Grid, List } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PromptCard } from '@/components/library/PromptCard'
import { blink } from '@/blink/client'
import { Prompt, Workspace } from '@/types'
import { useToast } from '@/hooks/use-toast'

interface Category {
  id: string
  name: string
  color: string
  workspace_id: string
  user_id: string
  created_at: string
}

export function Library() {
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedWorkspace, setSelectedWorkspace] = useState<string>('all')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'title'>('newest')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const { toast } = useToast()

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const user = await blink.auth.me()
      
      // Load prompts, workspaces, and categories in parallel
      const [promptsData, workspacesData, categoriesData] = await Promise.all([
        blink.db.prompts.list({ where: { user_id: user.id } }),
        blink.db.workspaces.list({ where: { user_id: user.id } }),
        blink.db.categories.list({ where: { user_id: user.id } })
      ])

      setPrompts(promptsData)
      setWorkspaces(workspacesData)
      setCategories(categoriesData)
    } catch (error) {
      console.error('Failed to load library data:', error)
      toast({
        title: "Failed to load library",
        description: "Could not load your prompt library. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Get all unique tags from prompts
  const allTags = useMemo(() => {
    const tagSet = new Set<string>()
    prompts.forEach(prompt => {
      if (prompt.tags) {
        try {
          const tags = JSON.parse(prompt.tags)
          tags.forEach((tag: string) => tagSet.add(tag))
        } catch {
          // Ignore invalid JSON
        }
      }
    })
    return Array.from(tagSet).sort()
  }, [prompts])

  // Filter and sort prompts
  const filteredPrompts = useMemo(() => {
    const filtered = prompts.filter(prompt => {
      // Search query filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const matchesTitle = prompt.title.toLowerCase().includes(query)
        const matchesContent = prompt.content.toLowerCase().includes(query)
        const matchesDescription = prompt.description?.toLowerCase().includes(query)
        if (!matchesTitle && !matchesContent && !matchesDescription) {
          return false
        }
      }

      // Workspace filter
      if (selectedWorkspace !== 'all' && prompt.workspace_id !== selectedWorkspace) {
        return false
      }

      // Category filter
      if (selectedCategory !== 'all' && prompt.category !== selectedCategory) {
        return false
      }

      // Tags filter
      if (selectedTags.length > 0) {
        try {
          const promptTags = JSON.parse(prompt.tags || '[]')
          const hasSelectedTag = selectedTags.some(tag => promptTags.includes(tag))
          if (!hasSelectedTag) {
            return false
          }
        } catch {
          return false
        }
      }

      return true
    })

    // Sort prompts
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        case 'oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        case 'title':
          return a.title.localeCompare(b.title)
        default:
          return 0
      }
    })

    return filtered
  }, [prompts, searchQuery, selectedWorkspace, selectedCategory, selectedTags, sortBy])

  const handleTagToggle = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    )
  }

  const clearFilters = () => {
    setSearchQuery('')
    setSelectedWorkspace('all')
    setSelectedCategory('all')
    setSelectedTags([])
  }

  const getWorkspaceName = (workspaceId: string) => {
    const workspace = workspaces.find(w => w.id === workspaceId)
    return workspace?.name || 'Unknown Workspace'
  }

  const getCategoryName = (categoryId: string) => {
    const category = categories.find(c => c.name.toLowerCase() === categoryId)
    return category?.name || categoryId
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your prompt library...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Prompt Library</h1>
          <p className="text-gray-600 mt-1">
            Browse and manage your saved prompts across all workspaces
          </p>
        </div>
        <Button className="bg-indigo-600 hover:bg-indigo-700">
          <Plus className="w-4 h-4 mr-2" />
          New Prompt
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Prompts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">{prompts.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Workspaces</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">{workspaces.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Categories</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">{categories.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Tags</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">{allTags.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Search & Filter</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search prompts by title, content, or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Filter Controls */}
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium text-gray-700 mb-1 block">Workspace</label>
              <Select value={selectedWorkspace} onValueChange={setSelectedWorkspace}>
                <SelectTrigger>
                  <SelectValue placeholder="All workspaces" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Workspaces</SelectItem>
                  {workspaces.map(workspace => (
                    <SelectItem key={workspace.id} value={workspace.id}>
                      {workspace.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium text-gray-700 mb-1 block">Category</label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="general">General</SelectItem>
                  <SelectItem value="creative">Creative Writing</SelectItem>
                  <SelectItem value="technical">Technical</SelectItem>
                  <SelectItem value="analysis">Analysis</SelectItem>
                  <SelectItem value="marketing">Marketing</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium text-gray-700 mb-1 block">Sort By</label>
              <Select value={sortBy} onValueChange={(value: 'newest' | 'oldest' | 'title') => setSortBy(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest First</SelectItem>
                  <SelectItem value="oldest">Oldest First</SelectItem>
                  <SelectItem value="title">Title A-Z</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end gap-2">
              <Button
                variant="outline"
                onClick={clearFilters}
                className="whitespace-nowrap"
              >
                <Filter className="w-4 h-4 mr-2" />
                Clear Filters
              </Button>
              <div className="flex border rounded-md">
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                  className="rounded-r-none"
                >
                  <Grid className="w-4 h-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className="rounded-l-none"
                >
                  <List className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Tags Filter */}
          {allTags.length > 0 && (
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Filter by Tags</label>
              <div className="flex flex-wrap gap-2">
                {allTags.map(tag => (
                  <Badge
                    key={tag}
                    variant={selectedTags.includes(tag) ? "default" : "secondary"}
                    className="cursor-pointer hover:bg-indigo-100"
                    onClick={() => handleTagToggle(tag)}
                  >
                    <Tag className="w-3 h-3 mr-1" />
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Active Filters Summary */}
          {(searchQuery || selectedWorkspace !== 'all' || selectedCategory !== 'all' || selectedTags.length > 0) && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>Active filters:</span>
              {searchQuery && <Badge variant="outline">Search: "{searchQuery}"</Badge>}
              {selectedWorkspace !== 'all' && <Badge variant="outline">Workspace: {getWorkspaceName(selectedWorkspace)}</Badge>}
              {selectedCategory !== 'all' && <Badge variant="outline">Category: {getCategoryName(selectedCategory)}</Badge>}
              {selectedTags.map(tag => (
                <Badge key={tag} variant="outline">Tag: {tag}</Badge>
              ))}
              <span className="text-indigo-600">({filteredPrompts.length} results)</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {filteredPrompts.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <Search className="w-12 h-12 mx-auto" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No prompts found</h3>
            <p className="text-gray-600 mb-4">
              {prompts.length === 0 
                ? "You haven't created any prompts yet. Start by creating your first prompt!"
                : "No prompts match your current filters. Try adjusting your search criteria."
              }
            </p>
            {prompts.length > 0 && (
              <Button variant="outline" onClick={clearFilters}>
                Clear all filters
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className={
          viewMode === 'grid' 
            ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            : "space-y-4"
        }>
          {filteredPrompts.map(prompt => (
            <PromptCard
              key={prompt.id}
              prompt={prompt}
              onCopy={() => {
                toast({
                  title: "Copied to clipboard",
                  description: `"${prompt.title}" has been copied to your clipboard.`,
                })
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}