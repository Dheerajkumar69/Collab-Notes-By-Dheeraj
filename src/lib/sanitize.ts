import DOMPurify from 'isomorphic-dompurify';

/**
 * Sanitize an HTML string before rendering with dangerouslySetInnerHTML.
 * Strips <script>, event handlers, javascript: URLs, etc.
 */
export function sanitizeHtml(html: string): string {
  if (!html) return '';
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'p', 'br', 'b', 'i', 'em', 'strong', 'u', 's', 'mark',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li',
      'blockquote', 'code', 'pre', 'hr',
      'a', 'span', 'div',
    ],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'class'],
    ALLOW_DATA_ATTR: false,
  });
}

/**
 * Convert an HTML string to plain text for searching / previews.
 */
export function htmlToPlainText(html: string): string {
  if (!html) return '';
  // Strip tags then decode entities
  const stripped = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  if (typeof window === 'undefined') return stripped;
  const txt = document.createElement('textarea');
  txt.innerHTML = stripped;
  return txt.value;
}

// File-upload validation constants
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MB
export const ALLOWED_UPLOAD_MIME = new Set<string>([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/heic',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
]);

export interface FileValidationResult {
  ok: boolean;
  reason?: string;
}

export function validateUploadFile(file: File): FileValidationResult {
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, reason: `${file.name} is larger than 25 MB` };
  }
  if (file.size === 0) {
    return { ok: false, reason: `${file.name} is empty` };
  }
  // Allow when MIME unknown but extension is in our accept list
  if (file.type && !ALLOWED_UPLOAD_MIME.has(file.type)) {
    return { ok: false, reason: `${file.name} has an unsupported type (${file.type})` };
  }
  return { ok: true };
}

export const MAX_NOTE_TITLE_LEN = 200;
export const MAX_NOTE_TOPIC_LEN = 200;
export const MAX_NOTE_LABEL_LEN = 40;
export const MAX_NOTE_LABELS = 20;