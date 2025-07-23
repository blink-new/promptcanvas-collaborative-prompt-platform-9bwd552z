export interface User {
  id: string
  email: string
  displayName?: string
  avatar?: string
}

export interface Workspace {
  id: string
  name: string
  description?: string
  user_id: string
  owner_id: string
  created_at: string
  updated_at: string
}

export interface WorkspaceMember {
  id: string
  workspace_id: string
  user_id: string
  role: 'owner' | 'editor' | 'viewer'
  invited_by?: string
  invited_at: string
  joined_at: string
  created_at: string
  updated_at: string
}

export interface WorkspaceInvitation {
  id: string
  workspace_id: string
  email: string
  role: 'editor' | 'viewer'
  invited_by: string
  token: string
  expires_at: string
  accepted_at?: string
  created_at: string
}

export interface WorkspaceWithMembers extends Workspace {
  members?: WorkspaceMember[]
  member_count?: number
  user_role?: 'owner' | 'editor' | 'viewer'
}

export interface Prompt {
  id: string
  title: string
  content: string
  workspace_id: string
  user_id: string
  version: number
  created_at: string
  updated_at: string
  tags?: string | null
  category?: string | null
  description?: string | null
}

export interface PromptVersion {
  id: string
  prompt_id: string
  version: number
  content: string
  title: string
  created_at: string
  user_id: string
}

export interface PromptSession {
  id: string
  prompt_id: string
  user_id: string
  user_name: string
  user_avatar?: string
  cursor_position: number
  last_seen: string
}

export interface Category {
  id: string
  name: string
  color: string
  workspace_id: string
  user_id: string
  created_at: string
}

export interface TestResult {
  id: string
  prompt_id: string
  model: string
  input: string
  output: string
  user_id: string
  created_at: string
  duration_ms?: number
  tokens_used?: number
}