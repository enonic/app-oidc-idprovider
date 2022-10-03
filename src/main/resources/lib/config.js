const authLib = require('/lib/xp/auth');
const preconditions = require('/lib/preconditions');

function getIdProviderConfig() {
    const idProviderConfig = authLib.getIdProviderConfig();
    preconditions.checkConfig(idProviderConfig, 'issuer');
    preconditions.checkConfig(idProviderConfig, 'authorizationUrl');
    preconditions.checkConfig(idProviderConfig, 'tokenUrl');
    preconditions.checkConfig(idProviderConfig, 'clientId');
    preconditions.checkConfig(idProviderConfig, 'clientSecret');
    preconditions.checkConfig(idProviderConfig, 'method');

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
