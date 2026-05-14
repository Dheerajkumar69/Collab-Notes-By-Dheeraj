import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

/**
 * Cron-invoked function. Finds reminders due in the last 24h that have not been
 * "reminded" yet, creates an in-app notification for the owner, and marks them.
 * For recurring reminders, schedules the next occurrence.
 *
 * Idempotent: safe to call repeatedly. The 24h lookback prevents spam after
 * downtime.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const nowIso = new Date().toISOString();
    const cutoffIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: due, error } = await supabase
      .from('note_reminders')
      .select('id, user_id, group_id, note_id, title, due_date, recurrence')
      .eq('is_completed', false)
      .eq('reminded', false)
      .lte('due_date', nowIso)
      .gte('due_date', cutoffIso)
      .limit(200);

    if (error) throw error;

    let processed = 0;
    for (const r of due || []) {
      try {
        // In-app notification (uses existing RPC).
        await supabase.rpc('create_notification', {
          p_user_id: r.user_id,
          p_message: `⏰ Reminder: ${r.title}`,
          p_link: `/group/${r.group_id}/note/${r.note_id}`,
        });

        // Mark as reminded.
        await supabase
          .from('note_reminders')
          .update({ reminded: true })
          .eq('id', r.id);

        // Schedule next occurrence for recurring reminders.
        if (r.recurrence && r.recurrence !== 'none') {
          const next = new Date(r.due_date);
          if (r.recurrence === 'daily') next.setDate(next.getDate() + 1);
          else if (r.recurrence === 'weekly') next.setDate(next.getDate() + 7);
          else if (r.recurrence === 'monthly') next.setMonth(next.getMonth() + 1);

          await supabase.from('note_reminders').insert({
            user_id: r.user_id,
            group_id: r.group_id,
            note_id: r.note_id,
            title: r.title,
            due_date: next.toISOString(),
            recurrence: r.recurrence,
          });
        }

        processed += 1;
      } catch (innerErr) {
        console.error('reminder failed', r.id, innerErr);
      }
    }

    return new Response(
      JSON.stringify({ ok: true, processed, found: due?.length ?? 0 }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('process-reminders error', err);
    return new Response(
      JSON.stringify({ ok: false, error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});