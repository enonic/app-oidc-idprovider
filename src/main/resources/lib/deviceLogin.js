const authLib = require('/lib/xp/auth');
const configLib = require('/lib/config');
const store = require('/lib/deviceStore');
const deviceToken = require('/lib/deviceToken');
const vhostFlags = require('/lib/vhostFlags');

const DEVICE_CODE_GRANT = 'urn:ietf:params:oauth:grant-type:device_code';
const HANDLER_BEAN = 'com.enonic.app.oidcidprovider.handler.DeviceTokenHandler';

// ---------------------------------------------------------------------------
// Enablement
// ---------------------------------------------------------------------------

function isEnabled(config) {
    return !!(config.deviceLogin && config.deviceLogin.secret);
}

function issuanceEnabled(config) {
    return isEnabled(config) && vhostFlags.isFlowEnabled(config, 'issue', true);
}

function acceptanceEnabled(config) {
    return isEnabled(config) && vhostFlags.isFlowEnabled(config, 'accept', true);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function endpointSubPath(req) {
    const contextPath = req.contextPath || '';
    const path = req.path || '';
    return path.indexOf(contextPath) === 0 ? path.substring(contextPath.length) : path;
}

function baseUrl(req) {
    let url = req.scheme + '://' + req.host;
    const port = req.port;
    if (port && port !== 80 && port !== 443) {
        url += ':' + port;
    }
    return url + req.contextPath;
}

function usernameOf(user) {
    return user.key.substring(user.key.lastIndexOf(':') + 1);
}

function json(status, body, extraHeaders) {
    const headers = {'Cache-Control': 'no-store', 'Pragma': 'no-cache'};
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

function htmlPage(title, bodyHtml) {
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

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------

// POST .../device/code  (RFC 8628 device authorization endpoint)
function deviceAuthorization(req) {
    const config = configLib.getIdProviderConfig();
    if (!issuanceEnabled(config)) {
        return {status: 404};
    }

    const dl = config.deviceLogin;
    const handler = __.newBean(HANDLER_BEAN);
    const deviceCode = handler.generateDeviceCode();
    const userCode = handler.generateUserCode();

    let audience = dl.allowedAudience.join(' ');
    const requestedResource = req.params.resource;
    if (requestedResource && (dl.allowedAudience.length === 0 || dl.allowedAudience.indexOf(requestedResource) !== -1)) {
        audience = requestedResource;
    }

    store.createPending(config._idProviderName, {
        deviceCode: deviceCode,
        userCode: userCode,
        clientId: req.params.client_id,
        scope: req.params.scope,
        audience: audience,
        ttlSeconds: dl.codeExpiresIn,
    });

    const verificationUri = baseUrl(req) + '/device';
    return json(200, {
        device_code: deviceCode,
        user_code: userCode,
        verification_uri: verificationUri,
        verification_uri_complete: verificationUri + '?user_code=' + encodeURIComponent(userCode),
        expires_in: dl.codeExpiresIn,
        interval: dl.pollInterval,
    });
}

// POST .../token  (RFC 8628 / RFC 6749 token endpoint, device_code grant)
function tokenEndpoint(req) {
    const config = configLib.getIdProviderConfig();
    if (!issuanceEnabled(config)) {
        return {status: 404};
    }

    if (req.params.grant_type !== DEVICE_CODE_GRANT) {
        return oauthError(400, 'unsupported_grant_type');
    }

    const deviceCode = req.params.device_code;
    if (!deviceCode) {
        return oauthError(400, 'invalid_request', 'Missing device_code');
    }

    const dl = config.deviceLogin;
    const result = store.poll(config._idProviderName, deviceCode, dl.pollInterval);

    switch (result.state) {
    case 'pending':
        return oauthError(400, 'authorization_pending');
    case 'slow_down':
        return oauthError(400, 'slow_down');
    case 'denied':
        return oauthError(400, 'access_denied');
    case 'approved': {
        const record = result.record;
        const token = deviceToken.mint(config, {
            subject: record.sub,
            idProvider: record.idProvider,
            audience: record.audience,
            clientId: record.clientId,
            scope: record.scope,
            expiresInSeconds: dl.tokenExpiresIn,
        });
        const body = {
            access_token: token,
            token_type: 'Bearer',
            expires_in: dl.tokenExpiresIn,
        };
        if (record.scope) {
            body.scope = record.scope;
        }
        return json(200, body);
    }
    case 'expired':
    default:
        return oauthError(400, 'expired_token');
    }
}

// GET .../device  (human verification page = verification_uri)
function verificationPage(req) {
    const config = configLib.getIdProviderConfig();
    if (!issuanceEnabled(config)) {
        return {status: 404};
    }

    const user = authLib.getUser();
    if (!user) {
        // Trigger interactive login (handle401 -> authorization endpoint); the user
        // returns to this exact URL afterwards.
        return {status: 401};
    }

    const userCode = req.params.user_code;
    if (!userCode) {
        return htmlPage('Device sign-in', enterCodeForm(''));
    }

    const found = store.findByUserCode(config._idProviderName, userCode.toUpperCase());
    if (!found || found.record.status !== 'pending') {
        return htmlPage('Device sign-in', `<h1>Device sign-in</h1>` +
                                           `<p>The code <code>${escapeHtml(userCode)}</code> is invalid or has expired.</p>` +
                                           enterCodeForm(''));
    }

    return htmlPage('Confirm device sign-in', confirmForm(userCode.toUpperCase(), user));
}

// POST .../device  (approve / deny submission)
function verificationSubmit(req) {
    const config = configLib.getIdProviderConfig();
    if (!issuanceEnabled(config)) {
        return {status: 404};
    }

    const user = authLib.getUser();
    if (!user) {
        return {status: 401};
    }

    const userCode = (req.params.user_code || '').toUpperCase();
    const approve = req.params.approve === 'true';

    const found = store.findByUserCode(config._idProviderName, userCode);
    if (!found || found.record.status !== 'pending') {
        return htmlPage('Device sign-in', `<h1>Device sign-in</h1><p>This code is invalid or has expired.</p>`);
    }

    const principal = {sub: usernameOf(user), idProvider: config._idProviderName};
    store.resolve(config._idProviderName, found.deviceCode, approve, principal, config.deviceLogin.codeExpiresIn);

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

function confirmForm(userCode, user) {
    return `<h1>Confirm device sign-in</h1>` +
           `<p>You are signed in as <strong>${escapeHtml(user.displayName || user.login)}</strong>.</p>` +
           `<p>A device is requesting access using code <code>${escapeHtml(userCode)}</code>.</p>` +
           `<p>Approve only if you started this sign-in.</p>` +
           `<form method="post" action="">` +
           `<input type="hidden" name="user_code" value="${escapeHtml(userCode)}">` +
           `<button class="approve" type="submit" name="approve" value="true">Approve</button>` +
           `<button class="deny" type="submit" name="approve" value="false">Deny</button>` +
           `</form>`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

// Routes a POST to the idprovider controller. Returns null if the path is not a
// device-login endpoint (so the caller can fall back to default handling).
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

// Routes a GET. Returns null if the path is not a device-login endpoint.
function handleGet(req) {
    if (endpointSubPath(req) === '/device') {
        return verificationPage(req);
    }
    return null;
}

// Verifies a self-issued bearer token and logs the principal in. Used by autoLogin.
function accept(token, config) {
    if (!acceptanceEnabled(config)) {
        return false;
    }

    const payload = deviceToken.verify(config, token, config.deviceLogin.allowedAudience);
    if (!payload || !payload.sub) {
        return false;
    }

    const result = authLib.login({
        user: payload.sub,
        idProvider: payload.idp || config._idProviderName,
        skipAuth: true,
        scope: config.deviceLogin.createSession ? 'SESSION' : 'REQUEST',
    });

    return !!(result && result.authenticated);
}

exports.handlePost = handlePost;
exports.handleGet = handleGet;
exports.accept = accept;
exports.isSelfIssued = deviceToken.isSelfIssued;
