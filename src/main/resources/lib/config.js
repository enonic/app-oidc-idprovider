const portalLib = require('/lib/xp/portal');

const configFile = require('/lib/configFile/configFile');

function getIdProviderConfig() {
    const idProviderName = portalLib.getIdProviderKey();
    return configFile.getConfigForIdProvider(idProviderName);
}

exports.getIdProviderConfig = getIdProviderConfig;
