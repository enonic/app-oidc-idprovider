/**
 * Translates the payload of a verified bearer token into the `accessToken` option of
 * `authLib.login()`, so XP records the token on the login and applies its own audience and scope
 * policy to it: the audience must be one the virtual host declares, and the scopes map to roles
 * through the host's scope catalogue for this ID provider. Nothing here verifies anything; the
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
 * audience the virtual host declares (`request.idProviderSettings.audience`). A token naming no
 * audience is refused, and a host declaring none accepts no upstream token, as in XP.
 */
function isAudienceDeclared(claims, req) {
    const declared = (req.idProviderSettings && req.idProviderSettings.audience) || [];
    const named = [].concat(claims.aud || []);
    return named.some((aud) => declared.indexOf(aud) >= 0);
}

exports.accessTokenFromClaims = accessTokenFromClaims;
exports.isAudienceDeclared = isAudienceDeclared;
