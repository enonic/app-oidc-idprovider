const requestLib = require('/lib/request');

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
 * audience the virtual host accepts. XP's own rule decides: an audience the host declares, or a
 * URL at or under the host's own that the request is at or below, which is what a client asks for
 * when it names the endpoint it calls. A token naming no audience is refused, and XP's issuer name
 * is not an audience for an upstream token.
 */
function isAudienceAccepted(claims) {
    return requestLib.acceptsAudience([].concat(claims.aud || []).filter((aud) => typeof aud === 'string'));
}

exports.accessTokenFromClaims = accessTokenFromClaims;
exports.isAudienceAccepted = isAudienceAccepted;
