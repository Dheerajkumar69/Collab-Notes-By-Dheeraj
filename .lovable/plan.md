
# Bulletproofing Plan — 5 Passes

Scope confirmed: Batches 1–4 + mobile polish, with DB migrations allowed. I'll ship each pass as a self-contained working slice so the app stays usable throughout.

---

## Pass 1 — Search + Notifications inbox

**DB migration**
- Add `search_vector tsvector` to `notes` and `messages`, GIN index on each, trigger to keep it in sync (title+content / content).
- Backfill existing rows.
- Add `notifications.group_key text` and `notifications.count int default 1` for grouping; index on `(recipient_email, group_key, read)`.
- RPC `search_all(q text)` — SECURITY DEFINER, respects group membership, returns notes + messages ranked by `ts_rank`.
- RPC `mark_all_notifications_read()`.

**Frontend**
- Replace `GlobalSearch.tsx` ILIKE calls with the new RPC; keep debounce, add ranking, highlight matches.
- Rewrite notifications dropdown → real inbox page/panel: grouped rows ("5 new messages in Finance"), filters (All / Unread / Mentions), mark-all-read, per-row dismiss.
- Notification insert trigger uses `group_key = <type>:<group_id>` and increments count when an unread row with the same key exists.

## Pass 2 — Onboarding wizard + Empty/Error states

**Onboarding**
- New `profiles.onboarded_at timestamptz`. On login, if null and user has 0 groups → route to `/onboarding`.
- 4-step wizard: welcome → create OR join group → pick template (uses existing `note_templates`) → invite teammates by email (reuses invite code + optional email notification). Sets `onboarded_at` on finish; skip button also sets it.

**Empty/Error states**
- Audit Dashboard, GroupPage (Notes/Chat/Members tabs), AllNotes, Notifications, Search results, Archived section.
- Every empty list gets an illustrated `EmptyState` with a primary CTA. Every fetch error gets `ErrorState` with retry wired to React Query's `refetch`.

## Pass 3 — Command palette power-ups + ? cheatsheet

- Extend `CommandPalette` to fuzzy-search across ALL notes, groups, and members (not just first 5 groups). Debounced Supabase query, keyed sections.
- Quick-create actions: "New note in <group>", "New group", "Invite to <group>".
- Recent items section (localStorage-backed MRU).
- Global `?` handler → dedicated `ShortcutsCheatsheet` modal (extract from CommandPalette, richer layout, grouped by category).

## Pass 4 — Rich note previews + Inline comments

**Note previews**
- `NoteCard` shows: first image thumbnail (extracted from HTML on save into `notes.preview_image_url`), first ~120 chars stripped snippet (into `notes.preview_snippet`), attachment count badge, label chips.
- Migration adds those two columns + backfill.

**Inline comments**
- New table `note_comments` (id, note_id, author_id, author_email, body, anchor jsonb {from,to,quoted_text}, resolved bool, parent_id for threads, timestamps). RLS: group members read/write, author can edit/delete, group creator can resolve any.
- Tiptap: add selection-based "Comment" button in bubble menu; opens right-side panel with threaded discussion, resolve, reply. Highlight anchored ranges with a decoration plugin.
- Realtime subscription for new comments.

## Pass 5 — Mobile polish

- Bottom nav bar (Home / Search / New / Inbox / Profile) rendered under `md:` breakpoint; hides on scroll down.
- Swipe-to-archive on `NoteCard` using framer-motion drag + threshold; undo toast.
- Pull-to-refresh wrapper on Dashboard, GroupPage, AllNotes (touch-only, no-op on desktop).
- Native share sheet: `navigator.share` on note actions with graceful fallback to existing copy-link.
- Safe-area padding for iOS notch.

---

## Technical notes

- All new RPCs: `SECURITY DEFINER`, `SET search_path = public`, membership check via `get_current_user_email() = ANY(members) OR created_by = auth.uid()`.
- All new tables: GRANT to authenticated + service_role, RLS enabled, policies scoped to group membership.
- No breaking API changes to existing components — new columns are additive with defaults.
- Critical-path tests added for: search RPC ranking, notification grouping trigger, comment RLS.

---

## Delivery order

I'll execute Pass 1 → 5 sequentially, each landing as a working batch. **Reply "go" and I'll start with Pass 1 (Search + Notifications migration + UI).** Or say which pass to start with / skip.
