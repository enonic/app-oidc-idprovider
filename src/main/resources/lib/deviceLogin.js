const authLib = require('/lib/xp/auth');
const configLib = require('/lib/config');
const store = require('/lib/deviceStore');
const oidcLib = require('/lib/oidc');

const DEVICE_CODE_GRANT = 'urn:ietf:params:oauth:grant-type:device_code';
const AUTH_CODE_GRANT = 'authorization_code';

const ACCESS_TOKEN_BEAN = 'com.enonic.app.oidcidprovider.handler.AccessTokenHandler';
const DEVICE_AUTH_BEAN = 'com.enonic.app.oidcidprovider.handler.DeviceAuthHandler';
const VHOST_BEAN = 'com.enonic.app.oidcidprovider.handler.VirtualHostFlowHandler';

// RFC 8252 native-app redirects come in three kinds: loopback IP, private-use URI scheme, and
// claimed HTTPS. Loopback (any port) needs no registration and is always allowed; private-use-scheme
// and claimed-https redirects must be registered exactly via native.allowedRedirectUris, since
// they cannot be implicitly trusted. PKCE is mandatory for all of them.
const LOOPBACK_REDIRECT_PATTERN = /^http:\/\/(127\.0\.0\.1|\[::1\]|localhost)(:\d+)?(\/.*)?$/;

// ---------------------------------------------------------------------------
// Enablement
// ---------------------------------------------------------------------------

// With Plan B in place, which flows an id provider exposes is decided per virtual host by XP core
// (the vhost mapping value, e.g. 'enabled=login,autologin,device'). The issuance endpoints below
// are served only when their flow is enabled here. Token *acceptance* (autologin) and interactive
// login gating are enforced by core, not by this app.
function flowEnabled(config, flow) {
    return __.newBean(VHOST_BEAN).isFlowEnabled(config._idProviderName, flow);
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
    if (!flowEnabled(config, 'device')) {
        return {status: 404};
    }

    const device = config.device;
    // The device-code / user-code pair and the cluster-shared pending state are created and owned
    // by XP core (DeviceAuthService).
    const auth = __.newBean(DEVICE_AUTH_BEAN).start(
        config._idProviderName,
        req.params.client_id || '',
        req.params.scope || '',
        resolveAudience(config.accessToken, req.params.resource),
        device.codeExpiresIn,
        device.pollInterval
    );

    const verificationUri = baseUrl(req) + '/device';
    return json(200, {
        device_code: auth.deviceCode,
        user_code: auth.userCode,
        verification_uri: verificationUri,
        verification_uri_complete: verificationUri + '?user_code=' + encodeURIComponent(auth.userCode),
        expires_in: auth.expiresIn,
        interval: auth.interval,
    });
}

// POST .../token  (RFC 6749 token endpoint: device_code and authorization_code grants)
function tokenEndpoint(req) {
    const config = configLib.getIdProviderConfig();

    switch (req.params.grant_type) {
    case DEVICE_CODE_GRANT:
        if (!flowEnabled(config, 'device')) {
            return {status: 404};
        }
        return deviceCodeGrant(req, config);
    case AUTH_CODE_GRANT:
        if (!flowEnabled(config, 'native')) {
            return {status: 404};
        }
        return authorizationCodeGrant(req, config);
    default:
        return oauthError(400, 'unsupported_grant_type');
    }
}

// RFC 8628 device_code grant (polling). The poll - including the minimum-interval (slow_down) and
// single-use semantics - is enforced by core.
function deviceCodeGrant(req, config) {
    const deviceCode = req.params.device_code;
    if (!deviceCode) {
        return oauthError(400, 'invalid_request', 'Missing device_code');
    }

    const result = __.newBean(DEVICE_AUTH_BEAN).poll(config._idProviderName, deviceCode);

    switch (result.state) {
    case 'pending':
        return oauthError(400, 'authorization_pending');
    case 'slow_down':
        return oauthError(400, 'slow_down');
    case 'denied':
        return oauthError(400, 'access_denied');
    case 'approved':
        return tokenResponse(config, result);
    case 'expired':
    default:
        return oauthError(400, 'expired_token');
    }
}

// RFC 6749 / RFC 8252 authorization_code grant (native-app redirect) with mandatory PKCE.
function authorizationCodeGrant(req, config) {
    const code = req.params.code;
    const redirectUri = req.params.redirect_uri;
    const codeVerifier = req.params.code_verifier;
    if (!code || !redirectUri || !codeVerifier) {
        return oauthError(400, 'invalid_request', 'Missing code, redirect_uri or code_verifier');
    }

    const record = store.consumeAuthCode(config._idProviderName, code);
    if (!record) {
        return oauthError(400, 'invalid_grant', 'Invalid or expired code');
    }
    if (record.redirectUri !== redirectUri) {
        return oauthError(400, 'invalid_grant', 'redirect_uri mismatch');
    }
    if (oidcLib.generateChallenge(codeVerifier) !== record.challenge) {
        return oauthError(400, 'invalid_grant', 'PKCE verification failed');
    }

    return tokenResponse(config, record);
}

// Mints the access token via XP core (AccessTokenService) and shapes the RFC 6749 token response.
function tokenResponse(config, record) {
    const expiresIn = config.accessToken.expiresIn;
    const token = __.newBean(ACCESS_TOKEN_BEAN).issue(
        record.sub,
        config.accessToken.issuer,
        record.audience || '',
        record.clientId || '',
        record.scope || '',
        expiresIn
    );
    const body = {
        access_token: token,
        token_type: 'Bearer',
        expires_in: expiresIn,
    };
    if (record.scope) {
        body.scope = record.scope;
    }
    return json(200, body);
}

// GET .../authorize  (RFC 8252 native-app authorization endpoint, PKCE required)
function authorizeEndpoint(req) {
    const config = configLib.getIdProviderConfig();
    if (!flowEnabled(config, 'native')) {
        return {status: 404};
    }

    const redirectUri = req.params.redirect_uri;
    // An invalid redirect target must not be redirected to (open-redirect / code-leak guard).
    if (!redirectUri || !isAllowedRedirectUri(redirectUri, config.native)) {
        return oauthError(400, 'invalid_request', 'redirect_uri is not allowed');
    }
    if (!req.params.code_challenge || req.params.code_challenge_method !== 'S256') {
        return oauthError(400, 'invalid_request', 'code_challenge with S256 is required');
    }

    const user = authLib.getUser();
    if (!user) {
        // Trigger interactive login (handle401 -> authorization endpoint); the user returns here.
        return {status: 401};
    }

    // The authorization-code grant is not (yet) owned by core, so its one-time code is kept by the app.
    const code = oidcLib.generateToken();
    store.createAuthCode(config._idProviderName, {
        code: code,
        challenge: req.params.code_challenge,
        redirectUri: redirectUri,
        sub: user.key,
        clientId: req.params.client_id,
        scope: req.params.scope,
        audience: resolveAudience(config.accessToken, req.params.resource),
        ttlSeconds: config.native.codeExpiresIn,
    });

    let location = redirectUri + (redirectUri.indexOf('?') >= 0 ? '&' : '?') + 'code=' + encodeURIComponent(code);
    if (req.params.state) {
        location += '&state=' + encodeURIComponent(req.params.state);
    }
    return {redirect: location};
}

function resolveAudience(accessToken, requestedResource) {
    if (requestedResource &&
        (accessToken.audience.length === 0 || accessToken.audience.indexOf(requestedResource) !== -1)) {
        return requestedResource;
    }
    return accessToken.audience.join(' ');
}

// RFC 8252: loopback (any port) needs no registration; private-use-scheme and claimed-https
// redirects must match a registered redirect URI exactly.
function isAllowedRedirectUri(redirectUri, nativeConfig) {
    if (LOOPBACK_REDIRECT_PATTERN.test(redirectUri)) {
        return true;
    }
    return nativeConfig.allowedRedirectUris.indexOf(redirectUri) !== -1;
}

// GET .../device  (human verification page = verification_uri)
function verificationPage(req) {
    const config = configLib.getIdProviderConfig();
    if (!flowEnabled(config, 'device')) {
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

    const deviceCode = __.newBean(DEVICE_AUTH_BEAN).findByUserCode(config._idProviderName, userCode.toUpperCase());
    if (!deviceCode) {
        return htmlPage('Device sign-in', `<h1>Device sign-in</h1>` +
                                          `<p>The code <code>${escapeHtml(userCode)}</code> is invalid or has expired.</p>` +
                                          enterCodeForm(''));
    }

    return htmlPage('Confirm device sign-in', confirmForm(userCode.toUpperCase(), user));
}

// POST .../device  (approve / deny submission)
function verificationSubmit(req) {
    const config = configLib.getIdProviderConfig();
    if (!flowEnabled(config, 'device')) {
        return {status: 404};
    }

    const user = authLib.getUser();
    if (!user) {
        return {status: 401};
    }

    const userCode = (req.params.user_code || '').toUpperCase();
    const approve = req.params.approve === 'true';

    const deviceCode = __.newBean(DEVICE_AUTH_BEAN).findByUserCode(config._idProviderName, userCode);
    if (!deviceCode) {
        return htmlPage('Device sign-in', `<h1>Device sign-in</h1><p>This code is invalid or has expired.</p>`);
    }

    // The subject is the full principal key (user:<idprovider>:<name>); it identifies the id provider.
    __.newBean(DEVICE_AUTH_BEAN).resolve(config._idProviderName, deviceCode, approve, approve ? user.key : null);

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
    switch (endpointSubPath(req)) {
    case '/device':
        return verificationPage(req);
    case '/authorize':
        return authorizeEndpoint(req);
    default:
        return null;
    }
}

exports.handlePost = handlePost;
exports.handleGet = handleGet;
