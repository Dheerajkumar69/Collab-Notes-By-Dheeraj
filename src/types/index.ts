// Shared types for the application

export interface Attachment {
  url: string;
  name: string;
  type: string;
}

export interface Reaction {
  emoji: string;
  user_email: string;
  user_name: string;
}

export interface EditRequest {
  id: string;
  status: 'pending' | 'approved' | 'rejected';
  requester_email: string;
  requester_name: string;
  message: string;
  proposed_title: string;
  proposed_content: string;
  created_at: string;
}

export interface Note {
  id: string;
  title: string;
  content?: string | null;
  color?: string | null;
  labels?: string[];
  attachments?: Attachment[];
  reactions?: Reaction[];
  edit_requests?: EditRequest[];
  is_pinned?: boolean;
  author_name?: string | null;
  created_by: string;
  group_id?: string;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface Group {
  id: string;
  name: string;
  description?: string | null;
  color?: string | null;
  members?: string[];
  invite_code: string;
  background_image_url?: string | null;
  created_by: string;
  created_at?: string | null;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  created_at?: string | null;
}

export interface Notification {
  id: string;
  user_id: string;
  message: string;
  link?: string | null;
  is_read?: boolean;
  created_at?: string | null;
  recipient_email?: string | null;
}
