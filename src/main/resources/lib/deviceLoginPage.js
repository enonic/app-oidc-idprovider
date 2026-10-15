// The device verification page of XP's device login (RFC 8628), rendered from the data XP hands
// the id provider as req.deviceLogin. XP owns the flow and checks what the form posts back:
// user_code, approve (true/false), _csrf and one scope per kept permission.

const STYLE =
    `body{font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:#f5f6f8;margin:0;padding:0;color:#333;line-height:1.45}` +
    `.card{max-width:420px;margin:8vh auto;background:#fff;border-radius:8px;box-shadow:0 1px 4px rgba(0,0,0,.12);padding:32px}` +
    // One vertical rhythm: every block ends with the same gap, lists sit tight under their lead-in line.
    `h1{font-size:20px;margin:0 0 16px}p{margin:0 0 16px}p.lead{margin-bottom:6px}` +
    `code{font-size:18px;letter-spacing:2px;background:#f0f1f3;padding:3px 8px;border-radius:4px;white-space:nowrap}` +
    `.codeline .k{display:block;color:#777;font-size:13px;margin-bottom:4px}` +
    `ul.scopes,ul.granted{list-style:none;padding:0;margin:0 0 16px;font-size:15px}ul.scopes li,ul.granted li{margin:0 0 8px}` +
    `ul.scopes label{display:flex;gap:10px;align-items:baseline;cursor:pointer}` +
    `ul.granted li{display:flex;gap:10px}ul.granted li::before{content:'\\2713';flex:0 0 13px;text-align:center;font-weight:600}` +
    `details{margin:0 0 16px;font-size:14px}summary{cursor:pointer;color:#777}details[open] summary{margin-bottom:8px}` +
    `.detail{display:flex;gap:12px;margin:0 0 6px}.detail .k{flex:0 0 110px;color:#777}.detail .v{color:#222;word-break:break-word}` +
    `code.id{font-size:12px;background:none;padding:0;letter-spacing:0}.warning{color:#777;font-size:13px}` +
    `input[type=text]{font-size:18px;padding:8px;width:100%;box-sizing:border-box;border:1px solid #ccc;border-radius:4px;letter-spacing:2px;text-transform:uppercase;margin-bottom:16px}` +
    `button{font-size:15px;padding:10px 18px;border:0;border-radius:4px;cursor:pointer}` +
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
    return page('Enter code', `<h1>Enter code</h1>` +
        (context.error ? `<p class="error">${escapeHtml(context.error)}</p>` : '') +
        `<p>Enter the code displayed on your app or device.</p>` +
        `<form method="get" action="">` +
        `<input type="text" name="user_code" placeholder="XXXX-XXXX" autofocus autocomplete="off">` +
        `<button class="approve" type="submit">Continue</button></form>`);
}

function confirm(context) {
    const app = context.clientId || 'this device';
    const scope = context.scope || [];
    // A required scope is granted with the request; only the others are the user's to drop.
    const required = scope.filter(s => s.required === true);
    const optional = scope.filter(s => s.required !== true);
    const granted = required.length === 0 ? '' :
        `<p class="lead">It will be able to:</p><ul class="granted">` + required.map(s => `<li>${escapeHtml(s.id)}</li>`).join('') + `</ul>`;
    const scopes = optional.length === 0 ? '' :
        `<p class="lead">${required.length === 0 ? 'It will be able to:' : 'You can also allow:'}</p><ul class="scopes">` + optional.map(s =>
            `<li><label><input type="checkbox" name="scope" value="${escapeHtml(s.id)}" checked>` +
            `<span>${escapeHtml(s.id)}</span></label></li>`).join('') + `</ul>`;
    // The technical view: the code, the audience and the roles behind each scope, folded away by default.
    const details = `<details><summary>Details</summary>` +
        ((context.audience || []).length ? `<div class="detail"><span class="k">Audience</span><span class="v">${escapeHtml(context.audience.join(', '))}</span></div>` : '') +
        scope.map(s => `<div class="detail"><span class="k"><code class="id">${escapeHtml(s.id)}</code></span>` +
            `<span class="v">${(s.roles || []).length ? escapeHtml(s.roles.join(', ')) : '&ndash;'}</span></div>`).join('') +
        `</details>`;
    return page(`Authorize ${app}`, `<h1>Authorize ${escapeHtml(app)}</h1>` +
        `<p>${escapeHtml(app)} wants to sign in as <strong>${escapeHtml(context.user.displayName || context.user.login)}</strong>.</p>` +
        // RFC 8628: the user confirms the code matches the one the device shows, against a phished link.
        `<p class="codeline"><span class="k">Verification code</span><code>${escapeHtml(context.userCode)}</code></p>` +
        `<form method="post" action="">${granted}${scopes}${details}` +
        `<p class="warning">Only continue if you started this request.</p>` +
        `<input type="hidden" name="user_code" value="${escapeHtml(context.userCode)}">` +
        `<input type="hidden" name="_csrf" value="${escapeHtml(context.csrf)}">` +
        `<button class="approve" type="submit" name="approve" value="true">Authorize</button>` +
        `<button class="deny" type="submit" name="approve" value="false">Cancel</button></form>`);
}

function done(context) {
    return page(context.approved ? 'Request approved' : 'Request denied', context.approved
        ? `<h1>Request approved</h1><p>You may now close this window.</p>`
        : `<h1>Request denied</h1><p>No access was granted. You may now close this window.</p>`);
}

function wrongAccount(context) {
    return page('Wrong account', `<h1>Wrong account</h1><p>You are signed in as <strong>${escapeHtml(context.user.key)}</strong>, ` +
        `but this request is for users of the id provider <strong>${escapeHtml(context.idProvider)}</strong>. Sign out and try again.</p>`);
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
