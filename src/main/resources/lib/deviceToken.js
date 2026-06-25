const store = require('/lib/deviceStore');

const BEAN = 'com.enonic.app.oidcidprovider.handler.DeviceTokenHandler';

const keyCache = {};

function resolveKey(idProviderConfig) {
    const name = idProviderConfig._idProviderName;
    let key = keyCache[name];
    if (!key) {
        key = store.getOrCreateSigningKey(name, function () {
            const handler = __.newBean(BEAN);
            return {
                secret: handler.generateDeviceCode(),
                kid: `${name}-hs512-${String(handler.generateDeviceCode()).substring(0, 8)}`,
            };
        });
        keyCache[name] = key;
    }
    return key;
}

function getIssuer(idProviderConfig) {
    return `${app.name}:${idProviderConfig._idProviderName}`;
}

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

function verify(idProviderConfig, token, allowedAudience) {
    const key = resolveKey(idProviderConfig);
    const payload = __.newBean(BEAN).verify(token, key.secret, getIssuer(idProviderConfig), allowedAudience || []);
    return payload ? __.toNativeObject(payload) : null;
}

function isSelfIssued(idProviderConfig, token) {
    const issuer = __.newBean(BEAN).peekIssuer(token);
    return !!issuer && issuer === getIssuer(idProviderConfig);
}

exports.mint = mint;
exports.verify = verify;
exports.isSelfIssued = isSelfIssued;
