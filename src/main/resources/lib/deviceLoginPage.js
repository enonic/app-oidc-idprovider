// The device verification page of XP's device login (RFC 8628), rendered from the data XP hands
// the id provider as req.deviceLogin. XP owns the flow and checks what the form posts back:
// user_code, approve (true/false), _csrf and one scope per kept permission.

const STYLE =
    `body{font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:#f5f6f8;margin:0;padding:0;color:#333}` +
    `.card{max-width:420px;margin:8vh auto;background:#fff;border-radius:8px;box-shadow:0 1px 4px rgba(0,0,0,.12);padding:32px}` +
    `h1{font-size:20px;margin:0 0 16px}` +
    `code{font-size:22px;letter-spacing:2px;background:#f0f1f3;padding:4px 8px;border-radius:4px;white-space:nowrap}` +
    `.codeline{text-align:center;margin:16px 0}` +
    `.detail{display:flex;margin:6px 0;font-size:14px}` +
    `.detail .k{flex:0 0 92px;color:#777}.detail .v{color:#222;word-break:break-word}` +
    `ul.scopes{list-style:none;padding:0;margin:8px 0}ul.scopes li{margin:6px 0;font-size:14px}` +
    `ul.scopes label{display:flex;gap:8px;align-items:baseline}ul.scopes .id{color:#777;font-size:12px}` +
    `input[type=text]{font-size:18px;padding:8px;width:100%;box-sizing:border-box;border:1px solid #ccc;border-radius:4px;letter-spacing:2px;text-transform:uppercase}` +
    `button{font-size:15px;padding:10px 18px;border:0;border-radius:4px;cursor:pointer;margin-top:16px}` +
    `.approve{background:#2c76e0;color:#fff}.deny{background:#e6e8eb;color:#333;margin-left:8px}.error{color:#b00020}`;

function escapeHtml(value) {
    return String(value == null ? '' : value)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function page(title, bodyHtml) {
    const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">` +
                 `<meta name="viewport" content="width=device-width, initial-scale=1">` +
                 `<title>${escapeHtml(title)}</title>` +
                 `<style>${STYLE}</style></head><body><div class="card">${bodyHtml}</div></body></html>`;
    return {
        status: 200,
        contentType: 'text/html; charset=utf-8',
        body: html,
        headers: {
            'Cache-Control': 'no-store',
            'Content-Security-Policy': `default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'`,
            'Referrer-Policy': 'no-referrer',
        },
    };
}

function enter(context) {
    return page('Device sign-in', `<h1>Device sign-in</h1>` +
        (context.error ? `<p class="error">${escapeHtml(context.error)}</p>` : '') +
        `<p>Enter the code shown by your application.</p>` +
        `<form method="get" action="">` +
        `<input type="text" name="user_code" placeholder="XXXX-XXXX" autofocus autocomplete="off">` +
        `<div><button class="approve" type="submit">Continue</button></div></form>`);
}

function confirm(context) {
    const scope = context.scope || [];
    const scopes = scope.length === 0
        ? `<div class="detail"><span class="k">Permissions</span><span class="v">(none specified)</span></div>`
        : `<div class="detail"><span class="k">Permissions</span><span class="v">Keep the ones you allow</span></div>` +
          `<ul class="scopes">` + scope.map(s =>
              `<li><label><input type="checkbox" name="scope" value="${escapeHtml(s.id)}" checked>` +
              `<span>${escapeHtml(s.description)}` +
              (s.id === s.description ? '' : ` <span class="id">${escapeHtml(s.id)}</span>`) +
              `</span></label></li>`).join('') + `</ul>`;
    const audience = (context.audience || []).length ? context.audience.join(', ') : '(none specified)';
    return page('Confirm device sign-in', `<h1>Confirm device sign-in</h1>` +
        `<p>You are signed in as <strong>${escapeHtml(context.user.displayName || context.user.login)}</strong>.</p>` +
        `<p>A device is requesting access using code:</p>` +
        `<p class="codeline"><code>${escapeHtml(context.userCode)}</code></p>` +
        `<div class="detail"><span class="k">Application</span><span class="v">${context.clientId ? escapeHtml(context.clientId) : 'an unidentified client'}</span></div>` +
        `<div class="detail"><span class="k">Audience</span><span class="v">${escapeHtml(audience)}</span></div>` +
        `<form method="post" action="">${scopes}` +
        `<p>Approve only if you started this sign-in and recognise this application.</p>` +
        `<input type="hidden" name="user_code" value="${escapeHtml(context.userCode)}">` +
        `<input type="hidden" name="_csrf" value="${escapeHtml(context.csrf)}">` +
        `<button class="approve" type="submit" name="approve" value="true">Approve</button>` +
        `<button class="deny" type="submit" name="approve" value="false">Deny</button></form>`);
}

function done(context) {
    return page('Device sign-in', context.approved
        ? `<h1>You're all set</h1><p>The device has been approved. You can return to your application.</p>`
        : `<h1>Request denied</h1><p>The device sign-in request was denied.</p>`);
}

function wrongAccount(context) {
    return page('Wrong account', `<h1>Wrong account</h1><p>You are signed in as <strong>${escapeHtml(context.user.key)}</strong>, ` +
        `but this device sign-in is for users of the <strong>${escapeHtml(context.idProvider)}</strong> id provider. Sign out and sign in again.</p>`);
}

exports.render = function (context) {
    switch (context.action) {
    case 'enter':
        return enter(context);
    case 'confirm':
        return confirm(context);
    case 'done':
        return done(context);
    case 'wrongAccount':
        return wrongAccount(context);
    default:
        throw new Error('Unknown device login action: ' + context.action);
    }
};
