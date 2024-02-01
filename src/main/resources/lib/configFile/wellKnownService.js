exports.getWellKnownConfiguration = function (endpoint) {
    const wellKnownConfigurationBean = __.newBean('com.enonic.app.oidcidprovider.WellKnowBean');
    return wellKnownConfigurationBean.getWellKnown(endpoint);
};
