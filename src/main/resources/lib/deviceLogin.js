const authLib = require('/lib/xp/auth');
const configLib = require('/lib/config');
const store = require('/lib/deviceStore');
const deviceToken = require('/lib/deviceToken');
const refreshStore = require('/lib/refreshStore');
const portalLib = require('/lib/xp/portal');

const DEVICE_CODE_GRANT = 'urn:ietf:params:oauth:grant-type:device_code';
const REFRESH_TOKEN_GRANT = 'refresh_token';
const HANDLER_BEAN = 'com.enonic.app.oidcidprovider.handler.DeviceTokenHandler';

const TOKEN_EXPIRES_IN = 3600;       // self-issued access token lifetime, seconds
const DEVICE_CODE_EXPIRES_IN = 600;  // device / user code lifetime, seconds
const DEVICE_POLL_INTERVAL = 5;      // minimum client poll interval, seconds

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function endpointSubPath(req) {
    const contextPath = req.contextPath || '';
    const path = req.path || '';
    return path.indexOf(contextPath) === 0 ? path.substring(contextPath.length) : path;
}

function json(status, body, extraHeaders) {
    const headers = {'Cache-Control': 'no-store'};
    if (extraHeaders) {
        Object.keys(extraHeaders).forEach(k => headers[k] = extraHeaders[k]);
    }
    return {status: status, contentType: 'application/json', body: JSON.stringify(body), headers: headers};
}

function oauthError(status, code, description) {
    const body = {error: code};
    if (description) {
        body.error_description = description;
    }
    return json(status, body);
}

const STYLE =
    `body{font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:#f5f6f8;margin:0;padding:0;color:#333}` +
    `.card{max-width:420px;margin:8vh auto;background:#fff;border-radius:8px;box-shadow:0 1px 4px rgba(0,0,0,.12);padding:32px}` +
    `h1{font-size:20px;margin:0 0 16px}` +
    `code{font-size:22px;letter-spacing:2px;background:#f0f1f3;padding:4px 8px;border-radius:4px;white-space:nowrap}` +
    `.codeline{text-align:center;margin:16px 0}` +
    `.detail{display:flex;margin:6px 0;font-size:14px}` +
    `.detail .k{flex:0 0 92px;color:#777}.detail .v{color:#222;word-break:break-word}` +
    `input[type=text]{font-size:18px;padding:8px;width:100%;box-sizing:border-box;border:1px solid #ccc;border-radius:4px;letter-spacing:2px;text-transform:uppercase}` +
    `button{font-size:15px;padding:10px 18px;border:0;border-radius:4px;cursor:pointer;margin-top:16px}` +
    `.approve{background:#2c76e0;color:#fff}.deny{background:#e6e8eb;color:#333;margin-left:8px}`;

// CSP style-src source pinned to the exact stylesheet above (computed from STYLE, so it never drifts).
let styleCspSource = null;
function styleCsp() {
    if (!styleCspSource) {
        styleCspSource = "'sha256-" + __.newBean(HANDLER_BEAN).sha256Base64(STYLE) + "'";
    }
    return styleCspSource;
}

function htmlPage(title, bodyHtml) {
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
            'Content-Security-Policy': `default-src 'none'; style-src ${styleCsp()}; form-action 'self'; base-uri 'none'; frame-ancestors 'none'`,
            'Referrer-Policy': 'no-referrer',
        },
    };
}

function escapeHtml(value) {
    return String(value == null ? '' : value)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function firstParam(value) {
    return Array.isArray(value) ? value[0] : value;
}

function scopeList(scope) {
    const scopes = String(scope || '').split(/\s+/).filter(s => s.length > 0);
    return scopes.length ? scopes.join(', ') : '(none specified)';
}

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------

// POST .../device/code  (RFC 8628 device authorization endpoint)
function deviceAuthorization(req) {
    const config = configLib.getIdProviderConfig();
    const handler = __.newBean(HANDLER_BEAN);
    const deviceCode = handler.generateDeviceCode();
    const userCode = handler.generateUserCode();

    store.createPending(config._idProviderName, {
        deviceCode: deviceCode,
        userCode: userCode,
        clientId: req.params.client_id,
        scope: req.params.scope,
        audience: req.params.resource || '',
        ttlSeconds: DEVICE_CODE_EXPIRES_IN,
    });

    const verificationUri = portalLib.idProviderUrl({idProvider: config._idProviderName, type: 'absolute'}) + '/device';
    return json(200, {
        device_code: deviceCode,
        user_code: userCode,
        verification_uri: verificationUri,
        verification_uri_complete: verificationUri + '?user_code=' + encodeURIComponent(userCode),
        expires_in: DEVICE_CODE_EXPIRES_IN,
        interval: DEVICE_POLL_INTERVAL,
    });
}

// POST .../token  (RFC 6749 token endpoint: device_code and refresh_token grants)
function tokenEndpoint(req) {
    const config = configLib.getIdProviderConfig();
    switch (req.params.grant_type) {
    case DEVICE_CODE_GRANT:
        return deviceCodeGrant(req, config);
    case REFRESH_TOKEN_GRANT:
        return refreshTokenGrant(req, config);
    default:
        return oauthError(400, 'unsupported_grant_type');
    }
}

// RFC 8628 device_code grant (polling).
function deviceCodeGrant(req, config) {
    const deviceCode = req.params.device_code;
    if (!deviceCode) {
        return oauthError(400, 'invalid_request', 'Missing device_code');
    }

    const result = store.poll(config._idProviderName, deviceCode, DEVICE_POLL_INTERVAL);

    switch (result.state) {
    case 'pending':
        return oauthError(400, 'authorization_pending');
    case 'slow_down':
        return oauthError(400, 'slow_down');
    case 'denied':
        return oauthError(400, 'access_denied');
    case 'approved': {
        const grant = result.record;
        const refreshToken = refreshStore.issue({
            sub: grant.sub,
            clientId: grant.clientId,
            scope: grant.scope,
            audience: grant.audience,
        });
        return tokenResponse(config, grant, refreshToken);
    }
    case 'expired':
    default:
        return oauthError(400, 'expired_token');
    }
}

// RFC 6749 section 6 refresh_token grant.
function refreshTokenGrant(req, config) {
    const refreshToken = req.params.refresh_token;
    if (!refreshToken) {
        return oauthError(400, 'invalid_request', 'Missing refresh_token');
    }

    const grant = refreshStore.redeem(config._idProviderName, refreshToken);
    if (!grant) {
        return oauthError(400, 'invalid_grant', 'Invalid or expired refresh_token');
    }
    // RFC 6749 section 6: a public client must present the same client_id the grant was issued to.
    if (req.params.client_id && grant.clientId && req.params.client_id !== grant.clientId) {
        return oauthError(400, 'invalid_grant', 'client_id mismatch');
    }

    return tokenResponse(config, grant, grant.refreshToken);
}

function tokenResponse(config, grant, refreshToken) {
    const token = deviceToken.mint(config, {
        subject: grant.sub,
        audience: grant.audience,
        clientId: grant.clientId,
        scope: grant.scope,
        expiresInSeconds: TOKEN_EXPIRES_IN,
    });
    const body = {
        access_token: token,
        token_type: 'Bearer',
        expires_in: TOKEN_EXPIRES_IN,
        refresh_token: refreshToken,
    };
    if (grant.scope) {
        body.scope = grant.scope;
    }
    return json(200, body);
}

// GET .../device  (human verification page = verification_uri)
function verificationPage(req) {
    const config = configLib.getIdProviderConfig();
    const user = authLib.getUser();
    if (!user) {
        return {status: 401};
    }

    const userCode = firstParam(req.params.user_code);
    if (!userCode) {
        return htmlPage('Device sign-in', enterCodeForm(''));
    }

    const found = store.findByUserCode(config._idProviderName, userCode.toUpperCase());
    if (!found || found.record.status !== 'pending') {
        return htmlPage('Device sign-in', `<h1>Device sign-in</h1>` +
                                           `<p>The code <code>${escapeHtml(userCode)}</code> is invalid or has expired.</p>` +
                                           enterCodeForm(''));
    }

    return htmlPage('Confirm device sign-in', confirmForm(userCode.toUpperCase(), user, found.record));
}

// POST .../device  (approve / deny submission)
function verificationSubmit(req) {
    const config = configLib.getIdProviderConfig();
    const user = authLib.getUser();
    if (!user) {
        return {status: 401};
    }

    const userCode = (firstParam(req.params.user_code) || '').toUpperCase();
    const approve = firstParam(req.params.approve) === 'true';

    const found = store.findByUserCode(config._idProviderName, userCode);
    if (!found || found.record.status !== 'pending') {
        return htmlPage('Device sign-in', `<h1>Device sign-in</h1><p>This code is invalid or has expired.</p>`);
    }

    store.resolve(config._idProviderName, found.deviceCode, approve, {sub: user.key}, DEVICE_CODE_EXPIRES_IN);

    const message = approve
        ? `<h1>You're all set</h1><p>The device has been approved. You can return to your application.</p>`
        : `<h1>Request denied</h1><p>The device sign-in request was denied.</p>`;
    return htmlPage('Device sign-in', message);
}

function enterCodeForm(userCode) {
    return `<h1>Device sign-in</h1>` +
           `<p>Enter the code shown by your application.</p>` +
           `<form method="get" action="">` +
           `<input type="text" name="user_code" value="${escapeHtml(userCode)}" placeholder="XXXX-XXXX" autofocus>` +
           `<div><button class="approve" type="submit">Continue</button></div>` +
           `</form>`;
}

function confirmForm(userCode, user, record) {
    const application = record.clientId ? escapeHtml(record.clientId) : 'an unidentified client';
    return `<h1>Confirm device sign-in</h1>` +
           `<p>You are signed in as <strong>${escapeHtml(user.displayName || user.login)}</strong>.</p>` +
           `<p>A device is requesting access using code:</p>` +
           `<p class="codeline"><code>${escapeHtml(userCode)}</code></p>` +
           `<div class="detail"><span class="k">Application</span><span class="v">${application}</span></div>` +
           `<div class="detail"><span class="k">Permissions</span><span class="v">${escapeHtml(scopeList(record.scope))}</span></div>` +
           `<p>Approve only if you started this sign-in and recognise this application.</p>` +
           `<form method="post" action="">` +
           `<input type="hidden" name="user_code" value="${escapeHtml(userCode)}">` +
           `<button class="approve" type="submit" name="approve" value="true">Approve</button>` +
           `<button class="deny" type="submit" name="approve" value="false">Deny</button>` +
           `</form>`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

function handlePost(req) {
    switch (endpointSubPath(req)) {
    case '/device/code':
        return deviceAuthorization(req);
    case '/token':
        return tokenEndpoint(req);
    case '/device':
        return verificationSubmit(req);
    default:
        return null;
    }
}

function handleGet(req) {
    if (endpointSubPath(req) === '/device') {
        return verificationPage(req);
    }
    return null;
}

function accept(token, config) {
    const payload = deviceToken.verify(config, token);
    if (!payload || !payload.sub) {
        return false;
    }

    const parts = payload.sub.split(':');
    if (parts.length < 3 || parts[0] !== 'user') {
        return false;
    }

    const result = authLib.login({
        user: parts.slice(2).join(':'),
        idProvider: parts[1],
        skipAuth: true,
        scope: 'REQUEST',
    });

    return !!(result && result.authenticated);
}

exports.handlePost = handlePost;
exports.handleGet = handleGet;
exports.accept = accept;
exports.isSelfIssued = deviceToken.isSelfIssued;
