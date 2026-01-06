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

async function sendToTelegram(
  botToken: string,
  channelId: string,
  note: NotePayload
): Promise<{ messageId: string; fileId?: string }> {
  // Create note metadata message
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

  // Send metadata as a message
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

  // If note has content, send it as a document
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

  // Handle attachments - send info about them
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
  // Get file path
  const fileResponse = await fetch(`${TELEGRAM_API}${botToken}/getFile?file_id=${fileId}`)
  const fileResult = await fileResponse.json()
  
  if (!fileResult.ok) {
    throw new Error(`Failed to get file: ${fileResult.description}`)
  }

  const filePath = fileResult.result.file_path
  
  // Download file content
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

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN')
    const channelId = Deno.env.get('TELEGRAM_CHANNEL_ID')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    if (!botToken || !channelId) {
      throw new Error('Telegram credentials not configured')
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    const { action, note, noteId, fileId } = await req.json()

    console.log(`Telegram sync action: ${action}`)

    switch (action) {
      case 'sync': {
        // Sync a note to Telegram
        if (!note) throw new Error('Note data required for sync')
        
        const { messageId, fileId: newFileId } = await sendToTelegram(botToken, channelId, note)
        
        // Update note with Telegram IDs
        const { error } = await supabase
          .from('notes')
          .update({
            telegram_message_id: messageId,
            telegram_file_id: newFileId || null,
          })
          .eq('id', note.id)

        if (error) throw error

        console.log(`Note ${note.id} synced to Telegram: message ${messageId}`)
        
        return new Response(
          JSON.stringify({ success: true, messageId, fileId: newFileId }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'retrieve': {
        // Retrieve content from Telegram
        if (!fileId) throw new Error('File ID required for retrieval')
        
        const content = await getFromTelegram(botToken, fileId)
        
        return new Response(
          JSON.stringify({ success: true, content }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'archive': {
        // Archive a note - sync to Telegram and mark as archived
        if (!noteId) throw new Error('Note ID required for archive')
        
        // Get the note data
        const { data: noteData, error: fetchError } = await supabase
          .from('notes')
          .select('*')
          .eq('id', noteId)
          .single()

        if (fetchError || !noteData) throw new Error('Note not found')

        // Sync to Telegram if not already synced
        let messageId = noteData.telegram_message_id
        let telegramFileId = noteData.telegram_file_id

        if (!messageId) {
          const syncResult = await sendToTelegram(botToken, channelId, noteData as NotePayload)
          messageId = syncResult.messageId
          telegramFileId = syncResult.fileId
        }

        // Mark as archived and clear content to save space
        const { error: updateError } = await supabase
          .from('notes')
          .update({
            telegram_message_id: messageId,
            telegram_file_id: telegramFileId,
            is_archived: true,
            content: null, // Clear content to save Supabase space
          })
          .eq('id', noteId)

        if (updateError) throw updateError

        console.log(`Note ${noteId} archived to Telegram`)
        
        return new Response(
          JSON.stringify({ success: true, archived: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'unarchive': {
        // Restore note content from Telegram
        if (!noteId) throw new Error('Note ID required for unarchive')
        
        // Get note with file ID
        const { data: noteData, error: fetchError } = await supabase
          .from('notes')
          .select('telegram_file_id')
          .eq('id', noteId)
          .single()

        if (fetchError || !noteData) throw new Error('Note not found')
        
        if (!noteData.telegram_file_id) {
          throw new Error('No Telegram file ID - content cannot be restored')
        }

        // Get content from Telegram
        const content = await getFromTelegram(botToken, noteData.telegram_file_id)

        // Restore to Supabase
        const { error: updateError } = await supabase
          .from('notes')
          .update({
            content,
            is_archived: false,
          })
          .eq('id', noteId)

        if (updateError) throw updateError

        console.log(`Note ${noteId} unarchived from Telegram`)
        
        return new Response(
          JSON.stringify({ success: true, content }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'delete': {
        // Delete note from Telegram
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
        // Sync all existing notes to Telegram
        const { data: notes, error: fetchError } = await supabase
          .from('notes')
          .select('*')
          .is('telegram_message_id', null)
          .limit(50) // Process in batches

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
            // Rate limit to avoid Telegram API limits
            await new Promise(resolve => setTimeout(resolve, 100))
          } catch (e) {
            console.error(`Failed to sync note ${n.id}:`, e)
          }
        }

        console.log(`Bulk synced ${synced} notes to Telegram`)
        
        return new Response(
          JSON.stringify({ success: true, synced, total: notes?.length || 0 }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'auto-archive': {
        // Archive notes older than 30 days
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

        const { data: oldNotes, error: fetchError } = await supabase
          .from('notes')
          .select('*')
          .eq('is_archived', false)
          .lt('created_at', thirtyDaysAgo.toISOString())
          .limit(20)

        if (fetchError) throw fetchError

        let archived = 0
        for (const n of oldNotes || []) {
          try {
            // Sync to Telegram if not synced
            let messageId = n.telegram_message_id
            let telegramFileId = n.telegram_file_id

            if (!messageId) {
              const syncResult = await sendToTelegram(botToken, channelId, n as NotePayload)
              messageId = syncResult.messageId
              telegramFileId = syncResult.fileId
            }

            // Archive
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

        console.log(`Auto-archived ${archived} old notes`)
        
        return new Response(
          JSON.stringify({ success: true, archived }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      default:
        throw new Error(`Unknown action: ${action}`)
    }
  } catch (error) {
    console.error('Telegram sync error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
