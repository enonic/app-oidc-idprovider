const configProvider = __.newBean('com.enonic.app.oidcidprovider.handler.IdProviderConfigHandler');

const wellKnownConfigurationBean = __.newBean('com.enonic.app.oidcidprovider.handler.WellKnowBean');

exports.getWellKnownConfiguration = function (endpoint) {
    return __.toNativeObject(wellKnownConfigurationBean.getWellKnown(endpoint));
};

exports.cacheIdProviderConfig = function (idProviderName, config) {
    configProvider.storeConfig(idProviderName, __.toScriptValue(config));
};

exports.getIdProviderConfig = function (idProviderName) {
    return __.toNativeObject(configProvider.getConfig(idProviderName));
};
