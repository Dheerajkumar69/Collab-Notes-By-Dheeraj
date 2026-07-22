import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface NotePayload {
  id: string
  title: string
  content?: string | null
  color?: string | null
  labels?: string[]
  attachments?: Array<{ url: string; name: string; type: string }>
  author_name?: string | null
  group_id: string
  created_at?: string | null
  updated_at?: string | null
}

interface TelegramResponse {
  ok: boolean
  result?: {
    message_id: number
    document?: { file_id: string }
  }
  description?: string
}

const TELEGRAM_API = 'https://api.telegram.org/bot'

async function authenticateRequest(req: Request, supabaseUrl: string, supabaseAnonKey: string): Promise<string> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('UNAUTHORIZED')
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  })

  const token = authHeader.replace('Bearer ', '')
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data?.user) {
    throw new Error('UNAUTHORIZED')
  }

  return data.user.id
}

async function verifyNoteAccess(
  supabase: ReturnType<typeof createClient>,
  noteId: string,
  userId: string
): Promise<boolean> {
  const { data } = await supabase
    .from('notes')
    .select('group_id')
    .eq('id', noteId)
    .single()

  if (!data) return false

  const { data: group } = await supabase
    .from('groups')
    .select('created_by, members')
    .eq('id', data.group_id)
    .single()

  if (!group) return false

  if (group.created_by === userId) return true

  // Get user email to check membership
  const { data: profile } = await supabase
    .from('profiles')
    .select('email')
    .eq('id', userId)
    .single()

  if (!profile) return false

  return (group.members || []).includes(profile.email)
}

async function verifyGroupAccess(
  supabase: ReturnType<typeof createClient>,
  groupId: string,
  userId: string
): Promise<boolean> {
  if (!groupId || !userId) return false

  const { data, error } = await supabase.rpc('is_group_accessible', { gid: groupId })
  if (error) {
    console.error('verifyGroupAccess failed:', error)
    return false
  }

  return data === true
}

async function sendToTelegram(
  botToken: string,
  channelId: string,
  note: NotePayload
): Promise<{ messageId: string; fileId?: string }> {
  const metadata = {
    note_id: note.id,
    title: note.title,
    group_id: note.group_id,
    author: note.author_name,
    labels: note.labels || [],
    color: note.color,
    created_at: note.created_at,
    updated_at: note.updated_at,
    has_content: !!note.content,
    attachment_count: note.attachments?.length || 0,
  }

  const metadataResponse = await fetch(`${TELEGRAM_API}${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: channelId,
      text: `📝 Note: ${note.title}\n\n` +
        `🔑 ID: ${note.id}\n` +
        `👤 Author: ${note.author_name || 'Unknown'}\n` +
        `🏷️ Labels: ${(note.labels || []).join(', ') || 'None'}\n` +
        `📅 Created: ${note.created_at}\n\n` +
        `---METADATA---\n${JSON.stringify(metadata)}`,
      parse_mode: 'HTML',
    }),
  })

  const metadataResult: TelegramResponse = await metadataResponse.json()

  if (!metadataResult.ok) {
    throw new Error(`Telegram API error: ${metadataResult.description}`)
  }

  const messageId = metadataResult.result!.message_id.toString()
  let fileId: string | undefined

  if (note.content) {
    const contentBlob = new Blob([note.content], { type: 'text/markdown' })
    const formData = new FormData()
    formData.append('chat_id', channelId)
    formData.append('document', contentBlob, `note_${note.id}.md`)
    formData.append('caption', `Content for note: ${note.id}`)
    formData.append('reply_to_message_id', messageId)

    const contentResponse = await fetch(`${TELEGRAM_API}${botToken}/sendDocument`, {
      method: 'POST',
      body: formData,
    })

    const contentResult: TelegramResponse = await contentResponse.json()

    if (contentResult.ok && contentResult.result?.document) {
      fileId = contentResult.result.document.file_id
    }
  }

  if (note.attachments && note.attachments.length > 0) {
    const attachmentInfo = note.attachments.map(a => `• ${a.name} (${a.type}): ${a.url}`).join('\n')

    await fetch(`${TELEGRAM_API}${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: channelId,
        text: `📎 Attachments for note ${note.id}:\n${attachmentInfo}`,
        reply_to_message_id: messageId,
      }),
    })
  }

  return { messageId, fileId }
}

async function getFromTelegram(
  botToken: string,
  fileId: string
): Promise<string> {
  const fileResponse = await fetch(`${TELEGRAM_API}${botToken}/getFile?file_id=${fileId}`)
  const fileResult = await fileResponse.json()

  if (!fileResult.ok) {
    throw new Error(`Failed to get file: ${fileResult.description}`)
  }

  const filePath = fileResult.result.file_path
  const downloadUrl = `https://api.telegram.org/file/bot${botToken}/${filePath}`
  const contentResponse = await fetch(downloadUrl)

  return await contentResponse.text()
}

async function deleteFromTelegram(
  botToken: string,
  channelId: string,
  messageId: string
): Promise<boolean> {
  const response = await fetch(`${TELEGRAM_API}${botToken}/deleteMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: channelId,
      message_id: parseInt(messageId),
    }),
  })

  const result = await response.json()
  return result.ok
}

async function sendImageToTelegram(
  botToken: string,
  channelId: string,
  imageUrl: string,
  caption: string,
): Promise<{ messageId: string; fileId?: string }> {
  // Fetch the image bytes server-side (works for signed URLs)
  const imgRes = await fetch(imageUrl)
  if (!imgRes.ok) throw new Error(`Failed to fetch image: ${imgRes.status}`)
  const blob = await imgRes.blob()

  const form = new FormData()
  form.append('chat_id', channelId)
  form.append('caption', caption.slice(0, 1000))
  // Use sendDocument to preserve original quality; sendPhoto compresses.
  form.append('document', blob, 'inline-image')

  const res = await fetch(`${TELEGRAM_API}${botToken}/sendDocument`, {
    method: 'POST',
    body: form,
  })
  const json: TelegramResponse = await res.json()
  if (!json.ok) throw new Error(`Telegram sendDocument error: ${json.description}`)
  return {
    messageId: String(json.result!.message_id),
    fileId: json.result?.document?.file_id,
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN')
    const channelId = Deno.env.get('TELEGRAM_CHANNEL_ID')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    if (!botToken || !channelId) {
      throw new Error('Telegram credentials not configured')
    }

    // Authenticate the caller
    let userId: string
    try {
      userId = await authenticateRequest(req.clone(), supabaseUrl, supabaseAnonKey)
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Use service role client for DB operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    // Use anon client for access checks (respects RLS)
    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: req.headers.get('Authorization')! } },
    })

    const payload = await req.json()
    const { action, note, noteId, fileId, groupId, imageUrl, filename } = payload as {
      action: string
      note?: NotePayload
      noteId?: string
      fileId?: string
      groupId?: string
      imageUrl?: string
      filename?: string
    }

    console.log(`Telegram sync action: ${action} by user: ${userId}`)

    switch (action) {
      case 'sync': {
        if (!note) throw new Error('Note data required for sync')

        // Verify user has access to the note's group
        if (!(await verifyGroupAccess(anonClient, note.group_id, userId))) {
          return new Response(
            JSON.stringify({ success: false, error: 'Access denied' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        const { messageId, fileId: newFileId } = await sendToTelegram(botToken, channelId, note)

        const { error } = await supabase
          .from('notes')
          .update({
            telegram_message_id: messageId,
            telegram_file_id: newFileId || null,
          })
          .eq('id', note.id)

        if (error) throw error

        return new Response(
          JSON.stringify({ success: true, messageId, fileId: newFileId }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'retrieve': {
        if (!fileId) throw new Error('File ID required for retrieval')

        const content = await getFromTelegram(botToken, fileId)

        return new Response(
          JSON.stringify({ success: true, content }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'archive': {
        if (!noteId) throw new Error('Note ID required for archive')

        if (!(await verifyNoteAccess(anonClient, noteId, userId))) {
          return new Response(
            JSON.stringify({ success: false, error: 'Access denied' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        const { data: noteData, error: fetchError } = await supabase
          .from('notes')
          .select('*')
          .eq('id', noteId)
          .single()

        if (fetchError || !noteData) throw new Error('Note not found')

        let messageId = noteData.telegram_message_id
        let telegramFileId = noteData.telegram_file_id

        if (!messageId) {
          const syncResult = await sendToTelegram(botToken, channelId, noteData as NotePayload)
          messageId = syncResult.messageId
          telegramFileId = syncResult.fileId
        }

        const { error: updateError } = await supabase
          .from('notes')
          .update({
            telegram_message_id: messageId,
            telegram_file_id: telegramFileId,
            is_archived: true,
            content: null,
          })
          .eq('id', noteId)

        if (updateError) throw updateError

        return new Response(
          JSON.stringify({ success: true, archived: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'unarchive': {
        if (!noteId) throw new Error('Note ID required for unarchive')

        if (!(await verifyNoteAccess(anonClient, noteId, userId))) {
          return new Response(
            JSON.stringify({ success: false, error: 'Access denied' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        const { data: noteData, error: fetchError } = await supabase
          .from('notes')
          .select('telegram_file_id')
          .eq('id', noteId)
          .single()

        if (fetchError || !noteData) throw new Error('Note not found')

        if (!noteData.telegram_file_id) {
          throw new Error('No Telegram file ID - content cannot be restored')
        }

        const content = await getFromTelegram(botToken, noteData.telegram_file_id)

        const { error: updateError } = await supabase
          .from('notes')
          .update({
            content,
            is_archived: false,
          })
          .eq('id', noteId)

        if (updateError) throw updateError

        return new Response(
          JSON.stringify({ success: true, content }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'delete': {
        if (!noteId) throw new Error('Note ID required')

        if (!(await verifyNoteAccess(anonClient, noteId, userId))) {
          return new Response(
            JSON.stringify({ success: false, error: 'Access denied' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        const { data: noteData } = await supabase
          .from('notes')
          .select('telegram_message_id')
          .eq('id', noteId)
          .single()

        if (noteData?.telegram_message_id) {
          await deleteFromTelegram(botToken, channelId, noteData.telegram_message_id)
        }

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'bulk-sync': {
        // Only allow bulk-sync for the user's own notes
        const { data: notes, error: fetchError } = await supabase
          .from('notes')
          .select('*')
          .eq('created_by', userId)
          .is('telegram_message_id', null)
          .limit(50)

        if (fetchError) throw fetchError

        let synced = 0
        for (const n of notes || []) {
          try {
            const { messageId, fileId: newFileId } = await sendToTelegram(botToken, channelId, n as NotePayload)

            await supabase
              .from('notes')
              .update({
                telegram_message_id: messageId,
                telegram_file_id: newFileId || null,
              })
              .eq('id', n.id)

            synced++
            await new Promise(resolve => setTimeout(resolve, 100))
          } catch (e) {
            console.error(`Failed to sync note ${n.id}:`, e)
          }
        }

        return new Response(
          JSON.stringify({ success: true, synced, total: notes?.length || 0 }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'auto-archive': {
        // Only auto-archive the user's own notes
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

        const { data: oldNotes, error: fetchError } = await supabase
          .from('notes')
          .select('*')
          .eq('created_by', userId)
          .eq('is_archived', false)
          .lt('created_at', thirtyDaysAgo.toISOString())
          .limit(20)

        if (fetchError) throw fetchError

        let archived = 0
        for (const n of oldNotes || []) {
          try {
            let messageId = n.telegram_message_id
            let telegramFileId = n.telegram_file_id

            if (!messageId) {
              const syncResult = await sendToTelegram(botToken, channelId, n as NotePayload)
              messageId = syncResult.messageId
              telegramFileId = syncResult.fileId
            }

            await supabase
              .from('notes')
              .update({
                telegram_message_id: messageId,
                telegram_file_id: telegramFileId,
                is_archived: true,
                content: null,
              })
              .eq('id', n.id)

            archived++
            await new Promise(resolve => setTimeout(resolve, 100))
          } catch (e) {
            console.error(`Failed to archive note ${n.id}:`, e)
          }
        }

        return new Response(
          JSON.stringify({ success: true, archived }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'archive-image': {
        if (!groupId || !imageUrl) {
          return new Response(
            JSON.stringify({ success: false, error: 'groupId and imageUrl required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        if (!(await verifyGroupAccess(anonClient, groupId, userId))) {
          return new Response(
            JSON.stringify({ success: false, error: 'Access denied' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        try {
          const caption = `🖼️ Inline image\n📁 Group: ${groupId}\n📝 Note: ${noteId || 'n/a'}\n📎 ${filename || 'image'}`
          const { messageId, fileId: tgFileId } = await sendImageToTelegram(
            botToken, channelId, imageUrl, caption,
          )
          return new Response(
            JSON.stringify({ success: true, messageId, fileId: tgFileId }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        } catch (e) {
          console.error('archive-image failed:', e)
          return new Response(
            JSON.stringify({ success: false, error: 'archive_failed' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      }

      default:
        throw new Error(`Unknown action: ${action}`)
    }
  } catch (error) {
    console.error('Telegram sync error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ success: false, error: 'An error occurred' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
