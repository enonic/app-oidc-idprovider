exports.validateTokenAndGetPayload = function (jwtToken, idProviderConfig) {
    const jwtHandler = __.newBean('com.enonic.app.oidcidprovider.handler.JwtHandler');
    return __.toNativeObject(jwtHandler.validateTokenAndGetPayload(jwtToken, idProviderConfig._idProviderName,
        idProviderConfig.autoLogin.allowedAudience));
};
