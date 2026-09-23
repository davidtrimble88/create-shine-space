import { EmailAPIError, sendLovableEmail } from 'npm:@lovable.dev/email-js@0.1.0'

const SENDER_DOMAIN = 'notify.learntoridevc.com'
const FROM = 'Learn to Ride VC <notifications@learntoridevc.com>'

export type ManagedEmailInput = {
  to: string
  subject: string
  html: string
  text: string
  label: string
  idempotencyKey: string
}

export async function sendManagedEmail(supabase: any, input: ManagedEmailInput) {
  const apiKey = Deno.env.get('LOVABLE_API_KEY')
  if (!apiKey) throw new Error('LOVABLE_API_KEY is not configured')

  const writeLog = async (status: 'sent' | 'suppressed' | 'failed', errorMessage?: string) => {
    const { error } = await supabase.from('email_send_log').insert({
      message_id: input.idempotencyKey,
      template_name: input.label,
      recipient_email: input.to,
      status,
      error_message: errorMessage?.slice(0, 1000) ?? null,
    })
    if (error) console.error('Failed to write email send log', { code: error.code, message: error.message })
  }

  try {
    await sendLovableEmail({
      to: input.to,
      from: FROM,
      sender_domain: SENDER_DOMAIN,
      subject: input.subject,
      html: input.html,
      text: input.text,
      purpose: 'transactional',
      label: input.label,
      idempotency_key: input.idempotencyKey,
    }, { apiKey, sendUrl: Deno.env.get('LOVABLE_SEND_URL') })
    await writeLog('sent')
    return { sent: true } as const
  } catch (error) {
    if (error instanceof EmailAPIError && error.code === 'recipient_suppressed') {
      await writeLog('suppressed', 'Recipient suppressed')
      return { sent: false, reason: 'recipient_suppressed' } as const
    }
    const message = error instanceof Error ? error.message : String(error)
    await writeLog('failed', message)
    throw error
  }
}