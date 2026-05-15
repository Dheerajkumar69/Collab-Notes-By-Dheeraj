
## Phase 1: Database Schema (Migration)
Add tables for:
- **user_presence** — tracks online status per group (user_id, group_id, last_seen, is_online)
- **message_read_receipts** — tracks who read which message (message_id, user_id, read_at)
- **activity_log** — tracks group activity (group_id, user_id, action_type, target_type, target_id, metadata)
- **note_reminders** — due dates & reminders (note_id, user_id, due_date, reminded)
- **note_templates** — pre-built templates (name, content, category, is_system)
- Add `due_date` column to notes table

Enable realtime on user_presence. Add RLS policies for all tables.

## Phase 2: Backend (Edge Functions)
- **ai-summarize** — Edge function calling Lovable AI to summarize note content
- Update existing export to support PDF generation

## Phase 3: UI Components
1. **Presence indicators** — Green dots on avatars in group member lists & chat
2. **Read receipts** — Small avatars/checkmarks under messages showing who read them
3. **Activity feed** — Timeline component in group page showing recent actions
4. **AI Summarize button** — On NotePage, one-click summarization
5. **Global search** — Search bar on Dashboard searching across all groups/notes
6. **Note templates** — Template picker in CreateNoteDialog
7. **Reminders** — Due date picker on notes, notification when due
8. **Export** — PDF & Markdown export buttons on NotePage

## Shipped (gap-fill pass)
- PDF export (single + bulk) via lazy-loaded jspdf+html2canvas.
- Mobile camera capture for OCR (input capture="environment").
- Reminders fire via process-reminders edge function on pg_cron every 5 min, with snooze + recurrence.
- Soft co-editing (Path A): Realtime presence avatars + editing broadcast + version-based conflict detection on save (no Yjs/Hocuspocus).

## Shipped (production-grade collab pass)
- **Real CRDT live cursors**: Yjs + custom `SupabaseYjsProvider` over Realtime broadcast; awareness-based remote cursors via `@tiptap/extension-collaboration-cursor`. No Hocuspocus needed.
- **Local-first**: `y-indexeddb` persists every keystroke locally; `notesOutbox` (IndexedDB) queues offline metadata writes and auto-flushes on reconnect.
- **Slash-menu Notion-lite editor** (`CollabEditor`): tables (resizable), task lists, code blocks (lowlight syntax highlighting), images, links, callouts (4 variants), drag-handles, character count, slash menu.
- **Lazy migration**: existing HTML notes seed a Y.Doc the first time they're opened; `notes.yjs_state bytea` + `format` columns store the CRDT snapshot. Old notes keep working.
- **RLS**: group members (not just authors) can now update notes — required for true co-edit.
