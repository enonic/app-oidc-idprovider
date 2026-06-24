const gridLib = require('/lib/xp/grid');

/**
 * Short-lived store for the native-app (RFC 8252) authorization codes, backed by the XP shared
 * grid (lib-grid). Entries auto-expire via TTL, so there is no cleanup job and no secret material
 * left at rest.
 *
 * The device-grant (RFC 8628) pending store is NOT here anymore: with Plan B in place the
 * device-code / user-code lifecycle lives in the XP-core DeviceAuthService (see DeviceAuthHandler).
 * Only the authorization-code grant - which core does not own yet - still keeps its one-time codes
 * in the app. This is the natural candidate for a future core AuthorizationCodeService.
 */
function getMap(idProviderName) {
    return gridLib.getMap(`com.enonic.app.oidcidprovider.authcode.${idProviderName}`);
}

/**
 * Stores a one-time authorization code (RFC 8252 native flow) with its PKCE challenge and the
 * approved principal.
 */
function createAuthCode(idProviderName, params) {
    getMap(idProviderName).set({
        key: params.code,
        value: {
            challenge: params.challenge,
            redirectUri: params.redirectUri,
            sub: params.sub,
            clientId: params.clientId || '',
            scope: params.scope || '',
            audience: params.audience || '',
        },
        ttlSeconds: params.ttlSeconds,
    });
}

/**
 * Atomically reads and removes an authorization code (single use). Returns the record or null.
 */
function consumeAuthCode(idProviderName, code) {
    let record = null;
    getMap(idProviderName).modify({
        key: code,
        func: function (value) {
            record = value || null;
            return null; // always remove
        }
    });
    return record;
}

exports.createAuthCode = createAuthCode;
exports.consumeAuthCode = consumeAuthCode;
