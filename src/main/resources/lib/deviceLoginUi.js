/**
 * The id provider's device/native login UI, in the Plan B model: rendering the human-facing pages.
 *
 * XP core owns the endpoints, the OAuth protocol, the device-code lifecycle, token issuance,
 * PKCE / redirect validation and the per-vhost flow gating. It calls the predefined hooks (the same
 * way it calls `autoLogin`), passing a context object as the second argument. These functions only
 * render HTML; they never route, issue tokens, or read flow config.
 *
 *   deviceVerification -> renderDeviceVerification(context)
 *     status          'need_code' | 'confirm' | 'invalid' | 'approved' | 'denied'
 *     actionUrl       where the form must POST back (core processes the decision)
 *     userDisplayName the signed-in user (already authenticated by the interactive login)
 *     userCode        the code being confirmed
 *
 *   authorizeConsent -> renderConsent(context)
 *     actionUrl       where the consent form must POST back
 *     userDisplayName the signed-in user
 *     redirect_uri, code_challenge, code_challenge_method, scope, state, client_id, resource
 *                     echoed back as hidden fields so the POST carries the original request
 */

const ECHOED_NATIVE_PARAMS =
    ['redirect_uri', 'code_challenge', 'code_challenge_method', 'scope', 'state', 'client_id', 'resource'];

function renderDeviceVerification(context) {
    switch (context.status) {
    case 'need_code':
        return page('Device sign-in', enterCodeForm(context.actionUrl));
    case 'confirm':
        return page('Confirm device sign-in', confirmForm(context));
    case 'approved':
        return page('You’re all set',
            `<h1>You’re all set</h1><p>The device has been approved. You can return to your application.</p>`);
    case 'denied':
        return page('Request denied', `<h1>Request denied</h1><p>The sign-in request was denied.</p>`);
    case 'invalid':
    default:
        return page('Device sign-in', `<h1>Device sign-in</h1><p>This code is invalid or has expired.</p>`);
    }
}

function renderConsent(context) {
    return page('Authorize application', consentForm(context));
}

function enterCodeForm(actionUrl) {
    return `<h1>Device sign-in</h1>` +
           `<p>Enter the code shown by your application.</p>` +
           `<form method="get" action="${escapeAttr(actionUrl)}">` +
           `<input type="text" name="user_code" placeholder="XXXX-XXXX" autofocus>` +
           `<div><button class="approve" type="submit">Continue</button></div>` +
           `</form>`;
}

function confirmForm(context) {
    return `<h1>Confirm device sign-in</h1>` +
           `<p>You are signed in as <strong>${escapeHtml(context.userDisplayName)}</strong>.</p>` +
           `<p>A device is requesting access using code <code>${escapeHtml(context.userCode)}</code>.</p>` +
           `<p>Approve only if you started this sign-in.</p>` +
           `<form method="post" action="${escapeAttr(context.actionUrl)}">` +
           `<input type="hidden" name="user_code" value="${escapeAttr(context.userCode)}">` +
           `<button class="approve" type="submit" name="approve" value="true">Approve</button>` +
           `<button class="deny" type="submit" name="approve" value="false">Deny</button>` +
           `</form>`;
}

function consentForm(context) {
    let hidden = '';
    ECHOED_NATIVE_PARAMS.forEach(name => {
        if (context[name] != null) {
            hidden += `<input type="hidden" name="${name}" value="${escapeAttr(context[name])}">`;
        }
    });
    return `<h1>Authorize application</h1>` +
           `<p>You are signed in as <strong>${escapeHtml(context.userDisplayName)}</strong>.</p>` +
           `<p>An application is requesting permission to sign in as you.</p>` +
           `<form method="post" action="${escapeAttr(context.actionUrl)}">` + hidden +
           `<button class="approve" type="submit" name="approve" value="true">Allow</button>` +
           `<button class="deny" type="submit" name="approve" value="false">Deny</button>` +
           `</form>`;
}

function page(title, bodyHtml) {
    const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">` +
                 `<meta name="viewport" content="width=device-width, initial-scale=1">` +
                 `<title>${escapeHtml(title)}</title>` +
                 `<style>body{font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;` +
                 `background:#f5f6f8;margin:0;padding:0;color:#333}` +
                 `.card{max-width:420px;margin:8vh auto;background:#fff;border-radius:8px;` +
                 `box-shadow:0 1px 4px rgba(0,0,0,.12);padding:32px}` +
                 `h1{font-size:20px;margin:0 0 16px}` +
                 `code{font-size:22px;letter-spacing:2px;background:#f0f1f3;padding:4px 8px;border-radius:4px}` +
                 `input[type=text]{font-size:18px;padding:8px;width:100%;box-sizing:border-box;` +
                 `border:1px solid #ccc;border-radius:4px;letter-spacing:2px;text-transform:uppercase}` +
                 `button{font-size:15px;padding:10px 18px;border:0;border-radius:4px;cursor:pointer;margin-top:16px}` +
                 `.approve{background:#2c76e0;color:#fff}.deny{background:#e6e8eb;color:#333;margin-left:8px}` +
                 `</style></head><body><div class="card">${bodyHtml}</div></body></html>`;
    return {status: 200, contentType: 'text/html; charset=utf-8', body: html, headers: {'Cache-Control': 'no-store'}};
}

function escapeHtml(value) {
    return String(value == null ? '' : value)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function escapeAttr(value) {
    return escapeHtml(value);
}

exports.renderDeviceVerification = renderDeviceVerification;
exports.renderConsent = renderConsent;
