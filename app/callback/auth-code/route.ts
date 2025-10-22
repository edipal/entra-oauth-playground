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

export async function POST(request: Request) {
	// Handle response_mode=form_post where the identity provider POSTs the
	// code/state in the request body (application/x-www-form-urlencoded).
	try {
		const form = await request.formData();
		const code = (form.get('code') as string) || '';
		const state = (form.get('state') as string) || '';

		// Inject the code/state into the client-side script safely by using
		// JSON.stringify to produce a valid JS string literal.
		const jsCode = JSON.stringify(code);
		const jsState = JSON.stringify(state);

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
			<p class="muted">code: <code>${code ? code.slice(0,8) + '…' : '(none)'}</code>, state: <code>${state || '(none)'}</code></p>
			<script>
				(function(){
					try {
						// Build an href-like string on the client using the page origin and
						// the current pathname, then append the code/state as query params.
						// We inject the raw code/state values as JS strings (escaped above).
						var code = ${jsCode};
						var state = ${jsState};
						var href = window.location.origin + window.location.pathname;
						var sep = href.indexOf('?') === -1 ? '?' : '&';
						href = href + sep + 'code=' + encodeURIComponent(code) + (state ? '&state=' + encodeURIComponent(state) : '');
						var payload = { type: 'oauth_callback', href: href };
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
				'content-type': 'text/html; charset=utf-8',
				'cache-control': 'no-store'
			}
		});
	} catch (e) {
		return new Response('Invalid request', { status: 400 });
	}
}

