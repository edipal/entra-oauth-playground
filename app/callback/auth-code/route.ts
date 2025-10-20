export async function GET(request: Request) {
	const url = new URL(request.url);
	const code = url.searchParams.get('code') || '';
	const state = url.searchParams.get('state') || '';
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
		<p class="muted">code: <code>${code ? code.slice(0, 8) + '…' : '(none)'}</code>, state: <code>${state || '(none)'}</code></p>
		<script>
			(function(){
				try {
					var payload = { type: 'oauth_callback', href: window.location.href };
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
			'content-type': 'text/html; charset=utf-8',
			'cache-control': 'no-store'
		}
	});
}

