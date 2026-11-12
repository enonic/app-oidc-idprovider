/**
 * Translates the payload of a verified bearer token into the `accessToken` option of
 * `authLib.login()`, so XP records the token on the login and applies its own audience and scope
 * policy to it: the audience must be one the virtual host declares, and the scopes map to roles
 * through the ID provider's scopes. Nothing here verifies anything; the
 * caller has.
 *
 * `scope` is read from `scp` (a list or a string) or `scope` (space-separated); `aud` may be a
 * single string or a list; the client is `azp`, or `client_id` when there is no `azp`.
 */
function accessTokenFromClaims(claims) {
    const accessToken = {
        issuer: claims.iss,
        scope: scopes(claims),
        audience: [].concat(claims.aud || []),
    };
    const clientId = claims.azp || claims.client_id;
    if (clientId) {
        accessToken.clientId = clientId;
    }
    return accessToken;
}

function scopes(claims) {
    const raw = claims.scp != null ? claims.scp : claims.scope;
    if (raw == null) {
        return [];
    }
    const list = Array.isArray(raw) ? raw : String(raw).split(' ');
    return list.filter((s) => s);
}

/**
 * The check XP will make at login, made first, before any user is created, any profile saved or
 * any group synchronised: with `allowedAudience=@@{vhost.audience}` the token must name an
 * audience the virtual host accepts (`request.idProviderSettings.audience`: the audiences it
 * declares and its own URL), or a URL under one of them that the request is at or below, which is
 * what a client asks for when it names the endpoint it calls. A token naming no audience is
 * refused, and XP's own issuer name is not an audience for an upstream token. XP has the last word.
 */
function isAudienceAccepted(claims, req) {
    const accepted = (req.idProviderSettings && req.idProviderSettings.audience) || [];
    const named = [].concat(claims.aud || []);
    const requestUrl = withoutQuery(req.url);
    return named.some((aud) => accepted.indexOf(aud) >= 0 ||
                               accepted.some((url) => isUnder(aud, url)) && (requestUrl === aud || isUnder(requestUrl, aud)));
}

function isUnder(url, base) {
    return typeof url === 'string' && url.indexOf(base.charAt(base.length - 1) === '/' ? base : base + '/') === 0;
}

function withoutQuery(url) {
    return typeof url === 'string' ? url.split(/[?#]/)[0] : null;
}

exports.accessTokenFromClaims = accessTokenFromClaims;
exports.isAudienceAccepted = isAudienceAccepted;
