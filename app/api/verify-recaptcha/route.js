export async function POST(request) {
  try {
    const { token } = await request.json()
    const secret = process.env.RECAPTCHA_SECRET_KEY || process.env.NEXT_PRIVATE_RECAPTCHA_SECRET
    if (!secret) {
      return new Response(JSON.stringify({ success: false, error: 'missing_secret' }), { status: 500 })
    }

    const params = new URLSearchParams()
    params.append('secret', secret)
    params.append('response', token)

    const r = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      body: params,
    })
    const data = await r.json()

    // Return the verification result directly (includes score for v3)
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('verify-recaptcha error:', err)
    return new Response(JSON.stringify({ success: false, error: 'server_error' }), { status: 500 })
  }
}
