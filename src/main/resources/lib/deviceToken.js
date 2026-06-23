const BEAN = 'com.enonic.app.oidcidprovider.handler.DeviceTokenHandler';

/**
 * The key-resolution seam. In this (app) implementation the signing key is the
 * configured shared secret and the kid is a stable, per-id-provider name.
 *
 * When this feature is promoted to XP core, only this function changes: the kid
 * is resolved against the managed keyring and the secret is derived from the
 * stored key material + the configured encryption key. The token wire format
 * (and this module's API) stays identical.
 */
function resolveKey(idProviderConfig) {
    return {
        kid: idProviderConfig.deviceLogin.kid,
        secret: idProviderConfig.deviceLogin.secret,
    };
}

function getIssuer(idProviderConfig) {
    return idProviderConfig.deviceLogin.issuer;
}

/**
 * Mints a self-issued HS512 access token (RFC 9068 'at+jwt') for the given subject.
 */
function mint(idProviderConfig, params) {
    const key = resolveKey(idProviderConfig);
    return __.newBean(BEAN).sign(
        key.secret,
        key.kid,
        getIssuer(idProviderConfig),
        params.subject,
        params.audience || '',
        params.clientId || '',
        params.scope || '',
        params.expiresInSeconds
    );
}

/**
 * Verifies a self-issued token (signature pinned to HS512, issuer, expiry, audience).
 * Returns the decoded payload, or null.
 */
function verify(idProviderConfig, token, allowedAudience) {
    const key = resolveKey(idProviderConfig);
    const payload = __.newBean(BEAN).verify(token, key.secret, getIssuer(idProviderConfig), allowedAudience || []);
    return payload ? __.toNativeObject(payload) : null;
}

/**
 * Returns true if the bearer token claims to be issued by this id provider.
 * Based on the unverified 'iss' claim - used only to route to the right verifier.
 */
function isSelfIssued(idProviderConfig, token) {
    if (!idProviderConfig.deviceLogin.secret) {
        return false;
    }
    const issuer = __.newBean(BEAN).peekIssuer(token);
    return !!issuer && issuer === getIssuer(idProviderConfig);
}

exports.mint = mint;
exports.verify = verify;
exports.isSelfIssued = isSelfIssued;
