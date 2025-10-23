import { buildClientAssertion } from '@/utils/jwtSign';

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const {
      tenantId,
      clientId,
      redirectUri,
      authCode,
      scopes,
      pkceEnabled,
      codeVerifier,
      clientAuthMethod,
      clientSecret,
      privateKeyPem,
      clientAssertionKid,
      tokenEndpoint
    } = json || {};

    if (!tenantId || !clientId || !redirectUri || !authCode || !tokenEndpoint) {
      return Response.json({ error: 'missing_parameters' }, { status: 400, headers: { 'cache-control': 'no-store' } });
    }

    const url = String(tokenEndpoint).replace('{tenant}', String(tenantId).trim());

    const body = new URLSearchParams();
    body.set('grant_type', 'authorization_code');
    body.set('client_id', String(clientId));
    body.set('code', String(authCode));
    body.set('redirect_uri', String(redirectUri));
    if (pkceEnabled && codeVerifier) body.set('code_verifier', String(codeVerifier));
    if (scopes && String(scopes).trim()) body.set('scope', String(scopes).trim());

    if (clientAuthMethod === 'secret') {
      if (!clientSecret) return Response.json({ error: 'missing_client_secret' }, { status: 400, headers: { 'cache-control': 'no-store' } });
      body.set('client_secret', String(clientSecret));
    } else if (clientAuthMethod === 'certificate') {
      if (!privateKeyPem) return Response.json({ error: 'missing_private_key' }, { status: 400, headers: { 'cache-control': 'no-store' } });
      const assertion = await buildClientAssertion({
        clientId: String(clientId),
        tokenEndpoint: url,
        privateKeyPem: String(privateKeyPem),
        kid: clientAssertionKid ? String(clientAssertionKid) : undefined,
        lifetimeSec: 60
      });
      body.set('client_assertion_type', 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer');
      body.set('client_assertion', assertion);
    } else {
      return Response.json({ error: 'invalid_client_auth_method' }, { status: 400, headers: { 'cache-control': 'no-store' } });
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      cache: 'no-store'
    });

    const contentType = res.headers.get('content-type') || '';
    const txt = contentType.includes('application/json') ? JSON.stringify(await res.json(), null, 2) : await res.text();

    return new Response(txt, {
      status: res.status,
      headers: {
        'content-type': contentType.includes('application/json') ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8',
        'cache-control': 'no-store'
      }
    });
  } catch (e: any) {
    return Response.json({ error: 'exception', message: String(e) }, { status: 500, headers: { 'cache-control': 'no-store' } });
  }
}
