function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code") || "";
  const state = url.searchParams.get("state") || "";
  const safeCode = code ? escapeHtml(code.slice(0, 8) + "…") : "(none)";
  const safeState = state ? escapeHtml(state) : "(none)";
  const html = `<!DOCTYPE html>
	<html lang="en">
	<head>
		<meta charset="utf-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1" />
		<title>OAuth Callback</title>
		<style>
			body{font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; padding: 2rem; color: #e5e7eb; background: #111827;}
			code{background: #1f2937; padding: .25rem .375rem; border-radius: .25rem;}
			.muted{opacity:.8}
		</style>
	</head>
	<body>
		<h1>Processing sign-in…</h1>
		<p class="muted">If this window does not close automatically, you can close it.</p>
		<p class="muted">code: <code>${safeCode}</code>, state: <code>${safeState}</code></p>
		<script>
			(function(){
				try {
					var url = window.location.href;
					var payload = { type: 'oauth_callback', url: url, body: '' };
					// Back-compat: also include href
					payload.href = url;
					if (window.opener && !window.opener.closed) {
						// Post back only to same-origin opener
						window.opener.postMessage(payload, window.location.origin);
					}
					// Give the parent a brief moment to receive the message, then close
					setTimeout(function(){ window.close(); }, 100);
				} catch (e) {
					// ignore
				}
			})();
		</script>
	</body>
	</html>`;
  return new Response(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export async function POST(request: Request) {
  // Handle response_mode=form_post where the identity provider POSTs the
  // code/state in the request body (application/x-www-form-urlencoded).
  try {
    const form = await request.formData();
    // Reconstruct the original x-www-form-urlencoded body exactly (order preserved)
    const params = new URLSearchParams();
    for (const [k, v] of form.entries()) {
      params.append(k, String(v));
    }
    const jsBody = JSON.stringify(params.toString());

    const html = `<!DOCTYPE html>
		<html lang="en">
		<head>
			<meta charset="utf-8" />
			<meta name="viewport" content="width=device-width, initial-scale=1" />
			<title>OAuth Callback</title>
			<style>
				body{font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; padding: 2rem; color: #e5e7eb; background: #111827;}
				code{background: #1f2937; padding: .25rem .375rem; border-radius: .25rem;}
				.muted{opacity:.8}
			</style>
		</head>
		<body>
			<h1>Processing sign-in…</h1>
			<p class="muted">If this window does not close automatically, you can close it.</p>
			<p class="muted">Body posted: <code>
				<script>document.write((${jsBody}).slice(0, 64) + ((${jsBody}).length > 64 ? '…' : ''))</script>
			</code></p>
			<script>
				(function(){
					try {
						// Build payload with the actual callback URL (no query) and raw POST body
						var url = window.location.origin + window.location.pathname;
						var body = ${jsBody};
						var payload = { type: 'oauth_callback', url: url, body: body };
						// Back-compat: also include href combining url and body
						payload.href = body ? (url + '?' + body) : url;
						if (window.opener && !window.opener.closed) {
							window.opener.postMessage(payload, window.location.origin);
						}
						setTimeout(function(){ window.close(); }, 100);
					} catch (e) {
						// ignore
					}
				})();
			</script>
		</body>
		</html>`;

    return new Response(html, {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  } catch (e) {
    return new Response("Invalid request", { status: 400 });
  }
}
