export interface Prompt {
  id: string;
  title: string;
  created_at: string;
  latest_content?: string;
}

export interface PromptVersion {
  id: string;
  prompt_id: string;
  content: string;
  created_at: string;
}
