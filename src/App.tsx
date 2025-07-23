import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { Layout } from '@/components/layout/Layout'
import { Dashboard } from '@/pages/Dashboard'
import { Workspaces } from '@/pages/Workspaces'
import { Playground } from '@/pages/Playground'
import { PromptEditor } from '@/pages/PromptEditor'
import { Library } from '@/pages/Library'
import { Toaster } from '@/components/ui/toaster'

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/workspaces" element={<Workspaces />} />
          <Route path="/library" element={<Library />} />
          <Route path="/playground" element={<Playground />} />
          <Route path="/editor/:promptId" element={<PromptEditor />} />
          <Route path="/settings" element={<div className="p-6"><h1 className="text-3xl font-bold">Settings</h1><p className="text-muted-foreground mt-1">Coming soon...</p></div>} />
        </Routes>
      </Layout>
      <Toaster />
    </Router>
  )
}

export default App