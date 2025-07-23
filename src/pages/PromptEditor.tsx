import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { CollaborativeEditor } from '@/components/editor/CollaborativeEditor'
import { blink } from '@/blink/client'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { toast } from '@/hooks/use-toast'

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

export function PromptEditor() {
  const { promptId } = useParams<{ promptId: string }>()
  const navigate = useNavigate()
  const [prompt, setPrompt] = useState<Prompt | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadPrompt = async () => {
      if (!promptId) {
        navigate('/dashboard')
        return
      }

      try {
        setIsLoading(true)
        
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
          navigate('/dashboard')
          return
        }

        setPrompt(promptData[0])
      } catch (error) {
        console.error('Error loading prompt:', error)
        toast({
          title: "Error",
          description: "Failed to load prompt",
          variant: "destructive"
        })
        navigate('/dashboard')
      } finally {
        setIsLoading(false)
      }
    }

    loadPrompt()
  }, [promptId, navigate])

  const handleClose = () => {
    navigate('/dashboard')
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading prompt editor...</p>
        </div>
      </div>
    )
  }

  if (!prompt || !promptId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Prompt not found</p>
          <Button onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <CollaborativeEditor 
        promptId={promptId} 
        onClose={handleClose}
      />
    </div>
  )
}