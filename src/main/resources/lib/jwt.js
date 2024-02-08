exports.validateTokenAndGetPayload = function (jwtToken, idProviderConfig) {
    const jwtHandler = __.newBean('com.enonic.app.oidcidprovider.handler.JwtHandler');
    return __.toNativeObject(jwtHandler.validateTokenAndGetPayload(jwtToken, idProviderConfig._idProviderName,
        idProviderConfig.autoLogin.validationAllowedSubjects));
};

exports.autoLoginFailed = function () {
    const bean = __.newBean('com.enonic.app.oidcidprovider.handler.PortalRequestHandler');
    bean.autoLoginFailed();
};

exports.isAutoLoginFailed = function () {
    const bean = __.newBean('com.enonic.app.oidcidprovider.handler.PortalRequestHandler');
    return bean.isAutoLoginFailed();
};

