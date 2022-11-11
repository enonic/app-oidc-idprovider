const authLib = require('/lib/xp/auth');
const preconditions = require('/lib/preconditions');

const portalLib = require('/lib/xp/portal');

/** Read out and return config from this-app.cfg that apply to the relevant id provider key.
 *  That is, the config keys are dot-separated with exactly two subfields, and the first subfield is the id provider key, eg. 'oidc.authorizationUrl'.
 *  Skips keys that don't match this pattern, and log-warns about mismatched keys starting with the id provider key.
 *  Returns an object where the keys are the second subfield from well-formed configs, eg. { authorizationUrl: 'http://something', clientSecret: 'vs12jn56bn2ai4sjf' }, etc
 */
function getIdProviderConfigFromFile() {
    const idProviderKey = portalLib.getIdProviderKey();
    const idProviderKeyDot = `${idProviderKey}.`;
    const rawConfigKeys = Object.keys(app.config || {}).filter( k =>
        k && (
            k === idProviderKey ||
            k.startsWith(idProviderKeyDot)
        )
    );

    if (!rawConfigKeys || !rawConfigKeys.length) {
        return null;
    }

    const skipped = [];
    const idProviderConfigKeys = (rawConfigKeys || [])
        .map( rawKey => {
            const keyArr = rawKey.trim().split('.');
            if (!keyArr || keyArr.length !== 2) {
                skipped.push(`${rawKey} = ${app.config[rawKey] || ''}`);
                return null;
            }
            const key = keyArr[1].trim();
            if (!key) {
                skipped.push(`${rawKey} = ${app.config[rawKey] || ''}`);
                return null;
            }
            return key;
        })
        .filter( key => key);

    if (skipped.length) {
        log.warning(`${app.name}.cfg contains invalid config key(s) for the '${idProviderKey}' ID provider. They should only be on this shape: '${idProviderKey}.oneSingleSubkey = value'. Skipping config(s): ${JSON.stringify(skipped)}`);
    }

    if (!idProviderConfigKeys || !idProviderConfigKeys.length) {
        return null;
    }

    const idProviderConfig = {};
    idProviderConfigKeys.forEach(key => {
        idProviderConfig[key] = app.config[`${idProviderKey}.${key}`];
    });

    log.debug(`Found config for the '${idProviderKey}' ID provider in ${app.name}.cfg. Using that instead of node-stored config from authLib.`);
    return idProviderConfig;
}

function getIdProviderConfig() {

    let idProviderConfig = getIdProviderConfigFromFile() || authLib.getIdProviderConfig();
    preconditions.checkConfig(idProviderConfig, 'issuer');
    preconditions.checkConfig(idProviderConfig, 'authorizationUrl');
    preconditions.checkConfig(idProviderConfig, 'tokenUrl');
    preconditions.checkConfig(idProviderConfig, 'clientId');
    preconditions.checkConfig(idProviderConfig, 'clientSecret');

    //Handle backward compatibility
    if (idProviderConfig.scopes == null) {
        idProviderConfig.scopes = 'profile email';
    }
    if (!idProviderConfig.mappings) {
        idProviderConfig.mappings = {};
    }
    if (!idProviderConfig.mappings.displayName) {
        idProviderConfig.mappings.displayName = '${preferred_username}';
    }
    if (idProviderConfig.mappings.email == null) {
        idProviderConfig.mappings.email = '${email}';
    }
    if (idProviderConfig.method == null) {
        idProviderConfig.method = 'post';
    }

    idProviderConfig.scopes = idProviderConfig.scopes.trim();
    idProviderConfig.mappings.displayName = idProviderConfig.mappings.displayName.trim();
    idProviderConfig.mappings.email = idProviderConfig.mappings.email.trim();

    return idProviderConfig;
}

exports.getIdProviderConfig = getIdProviderConfig;
