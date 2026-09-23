import { createEmailWebhookHandler } from 'npm:@lovable.dev/email-js@0.1.0'
import { createClient } from 'npm:@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

async function recordEvent(
  event: { event_id: string; data: { recipient: string; message_id?: string } },
  status: 'bounced' | 'complained' | 'suppressed',
  reason: 'bounce' | 'complaint' | 'unsubscribe',
) {
  const recipient = event.data.recipient.toLowerCase()
  const { error: suppressionError } = await supabase.from('suppressed_emails').upsert({
    email: recipient,
    reason,
    metadata: null,
  }, { onConflict: 'email' })
  if (suppressionError) {
    console.error('Failed to record email event', {
      event_id: event.event_id,
      code: suppressionError.code,
      message: suppressionError.message,
    })
    throw suppressionError
  }

  const { error: logError } = await supabase.from('email_send_log').insert({
    message_id: event.data.message_id ?? null,
    template_name: 'system',
    recipient_email: recipient,
    status,
    error_message: reason === 'unsubscribe'
      ? 'Recipient unsubscribed'
      : reason === 'complaint'
        ? 'Recipient reported email as spam'
        : 'Email bounced',
  })
  if (logError) {
    console.error('Failed to log email event', {
      event_id: event.event_id,
      code: logError.code,
      message: logError.message,
    })
    throw logError
  }
}

const handler = createEmailWebhookHandler({
  apiKey: Deno.env.get('LOVABLE_API_KEY')!,
  on: {
    'email.bounced': async (event) => {
      await recordEvent(event, 'bounced', 'bounce')
    },
    'email.complaint': async (event) => {
      await recordEvent(event, 'complained', 'complaint')
    },
    'email.unsubscribed': async (event) => {
      await recordEvent(event, 'suppressed', 'unsubscribe')
    },
  },
})

Deno.serve((req) => handler(req))
