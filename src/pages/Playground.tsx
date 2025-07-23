import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Play, Copy, Download, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { blink } from '@/blink/client'
import type { User, LLMModel, Prompt } from '@/types'

const models: { value: LLMModel; label: string; description: string }[] = [
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini', description: 'Fast and efficient for most tasks' },
  { value: 'gpt-4o', label: 'GPT-4o', description: 'Most capable model for complex reasoning' },
  { value: 'claude-3-sonnet', label: 'Claude 3 Sonnet', description: 'Balanced performance and speed' },
  { value: 'claude-3-haiku', label: 'Claude 3 Haiku', description: 'Fastest response times' },
]

export function Playground() {
  const [searchParams] = useSearchParams()
  const [user, setUser] = useState<User | null>(null)
  const [prompt, setPrompt] = useState('')
  const [selectedModel, setSelectedModel] = useState<LLMModel>('gpt-4o-mini')
  const [output, setOutput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [testHistory, setTestHistory] = useState<Array<{
    id: string
    prompt: string
    model: string
    output: string
    timestamp: string
  }>>([])

  const loadPromptFromId = async (promptId: string) => {
    try {
      const promptData = await blink.db.prompts.list({
        where: { id: promptId },
        limit: 1
      })
      
      if (promptData.length > 0) {
        const promptItem = promptData[0]
        setPrompt(promptItem.content || '')
      }
    } catch (error) {
      console.error('Failed to load prompt:', error)
    }
  }

  useEffect(() => {
    const unsubscribe = blink.auth.onAuthStateChanged((state) => {
      setUser(state.user)
    })
    return unsubscribe
  }, [])

  // Load prompt from URL parameter if provided
  useEffect(() => {
    const promptId = searchParams.get('promptId')
    if (promptId && user) {
      loadPromptFromId(promptId)
    }
  }, [searchParams, user])

  const runTest = async () => {
    if (!prompt.trim() || !user) return

    setIsLoading(true)
    setOutput('')

    try {
      // Use Blink AI to generate response
      const { text } = await blink.ai.generateText({
        prompt: prompt,
        model: selectedModel === 'gpt-4o-mini' ? 'gpt-4o-mini' : 'gpt-4o'
      })

      setOutput(text)

      // Save to test history
      const testResult = {
        id: `test_${Date.now()}`,
        prompt,
        model: selectedModel,
        output: text,
        timestamp: new Date().toISOString()
      }

      setTestHistory(prev => [testResult, ...prev.slice(0, 9)]) // Keep last 10 tests

      // Save to database
      await blink.db.test_results.create({
        id: testResult.id,
        prompt_id: 'playground', // Special ID for playground tests
        model: selectedModel,
        input: prompt,
        output: text,
        user_id: user.id
      })

    } catch (error) {
      console.error('Failed to run test:', error)
      setOutput('Error: Failed to generate response. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const exportResult = () => {
    const data = {
      prompt,
      model: selectedModel,
      output,
      timestamp: new Date().toISOString()
    }
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `prompt-test-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Testing Playground</h1>
          <p className="text-muted-foreground mt-1">
            Test your prompts against different language models.
          </p>
        </div>
        <Button variant="outline" size="sm">
          <Settings className="h-4 w-4 mr-2" />
          Settings
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Input Panel */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Prompt Input</CardTitle>
              <CardDescription>
                Enter your prompt to test against the selected model.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-4">
                <div className="flex-1">
                  <Select value={selectedModel} onValueChange={(value) => setSelectedModel(value as LLMModel)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {models.map((model) => (
                        <SelectItem key={model.value} value={model.value}>
                          <div>
                            <div className="font-medium">{model.label}</div>
                            <div className="text-xs text-muted-foreground">{model.description}</div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={runTest} disabled={!prompt.trim() || isLoading}>
                  <Play className="h-4 w-4 mr-2" />
                  {isLoading ? 'Running...' : 'Run Test'}
                </Button>
              </div>
              
              <Textarea
                placeholder="Enter your prompt here..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="min-h-[200px] font-mono text-sm"
              />
            </CardContent>
          </Card>

          {/* Output Panel */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Output</CardTitle>
                  <CardDescription>
                    Response from {models.find(m => m.value === selectedModel)?.label}
                  </CardDescription>
                </div>
                {output && (
                  <div className="flex items-center space-x-2">
                    <Button variant="outline" size="sm" onClick={() => copyToClipboard(output)}>
                      <Copy className="h-4 w-4 mr-2" />
                      Copy
                    </Button>
                    <Button variant="outline" size="sm" onClick={exportResult}>
                      <Download className="h-4 w-4 mr-2" />
                      Export
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-muted-foreground">Generating response...</p>
                  </div>
                </div>
              ) : output ? (
                <div className="bg-muted rounded-lg p-4">
                  <pre className="whitespace-pre-wrap text-sm font-mono">{output}</pre>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <p>Run a test to see the output here.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* History Panel */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Test History</CardTitle>
              <CardDescription>
                Recent test runs from this session.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {testHistory.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p className="text-sm">No tests run yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {testHistory.map((test, index) => (
                    <div key={test.id}>
                      <div 
                        className="p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => {
                          setPrompt(test.prompt)
                          setSelectedModel(test.model as LLMModel)
                          setOutput(test.output)
                        }}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <Badge variant="outline" className="text-xs">
                            {models.find(m => m.value === test.model)?.label}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(test.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="text-sm line-clamp-2 mb-2">
                          {test.prompt}
                        </p>
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          {test.output}
                        </p>
                      </div>
                      {index < testHistory.length - 1 && <Separator className="my-2" />}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}