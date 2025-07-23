import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Copy, Edit, Play, Calendar, User } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '@/hooks/use-toast'
import { Prompt } from '@/types'

interface PromptCardProps {
  prompt: Prompt
  onCopy?: (content: string) => void
}

const categoryColors: Record<string, string> = {
  general: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  creative: 'bg-amber-100 text-amber-800 border-amber-200',
  technical: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  analysis: 'bg-purple-100 text-purple-800 border-purple-200',
  marketing: 'bg-red-100 text-red-800 border-red-200'
}

export function PromptCard({ prompt, onCopy }: PromptCardProps) {
  const navigate = useNavigate()
  const { toast } = useToast()

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(prompt.content)
      toast({
        title: "Copied to clipboard",
        description: "Prompt content has been copied to your clipboard.",
      })
      onCopy?.(prompt.content)
    } catch (error) {
      toast({
        title: "Failed to copy",
        description: "Could not copy prompt to clipboard.",
        variant: "destructive",
      })
    }
  }

  const handleEdit = () => {
    navigate(`/editor/${prompt.id}`)
  }

  const handleTest = () => {
    navigate(`/playground?promptId=${prompt.id}`)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const parseTags = (tagsString: string | null): string[] => {
    if (!tagsString) return []
    try {
      return JSON.parse(tagsString)
    } catch {
      return []
    }
  }

  const tags = parseTags(prompt.tags)
  const categoryClass = categoryColors[prompt.category || 'general'] || categoryColors.general

  return (
    <Card className="group hover:shadow-lg transition-all duration-200 border-gray-200 hover:border-indigo-300">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg font-semibold text-gray-900 truncate">
              {prompt.title}
            </CardTitle>
            {prompt.description && (
              <CardDescription className="mt-1 text-sm text-gray-600 line-clamp-2">
                {prompt.description}
              </CardDescription>
            )}
          </div>
          <Badge className={`ml-2 ${categoryClass} capitalize`}>
            {prompt.category || 'general'}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {/* Prompt Preview */}
        <div className="mb-4">
          <div className="bg-gray-50 rounded-lg p-3 border">
            <pre className="text-sm text-gray-700 font-mono whitespace-pre-wrap line-clamp-4 overflow-hidden">
              {prompt.content}
            </pre>
          </div>
        </div>

        {/* Tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-4">
            {tags.map((tag, index) => (
              <Badge key={index} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        )}

        {/* Metadata */}
        <div className="flex items-center justify-between text-xs text-gray-500 mb-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              <span>{formatDate(prompt.created_at)}</span>
            </div>
            <div className="flex items-center gap-1">
              <User className="w-3 h-3" />
              <span>v{prompt.version}</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="flex-1 group-hover:border-indigo-300"
          >
            <Copy className="w-4 h-4 mr-2" />
            Copy
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleEdit}
            className="flex-1 group-hover:border-indigo-300"
          >
            <Edit className="w-4 h-4 mr-2" />
            Edit
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={handleTest}
            className="flex-1 bg-indigo-600 hover:bg-indigo-700"
          >
            <Play className="w-4 h-4 mr-2" />
            Test
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}