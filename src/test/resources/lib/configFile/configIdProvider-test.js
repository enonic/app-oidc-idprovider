const test = require('/lib/xp/testing');

function mockWellKnownService() {
    test.mock('/lib/configFile/wellKnownService', {
        cacheIdProviderConfig: function (idProviderName, configAsString) {
            // to do nothing
        },
        getIdProviderConfig: function (idProviderName) {
            return null;
        },
    });
}

function mockWellKnownServiceWithCustomConfig() {
    test.mock('/lib/configFile/wellKnownService', {
        cacheIdProviderConfig: function (idProviderName, configAsString) {
            // to do nothing
        },
        getIdProviderConfig: function (idProviderName) {
            return null;
        },
        getWellKnownConfiguration: function (endpoint) {
            return {
                'issuer': 'customIssuer',
                'authorization_endpoint': 'customAuthorizationUrl',
                'token_endpoint': 'customTokenUrl',
                'userinfo_endpoint': 'customUserinfoUrl',
                'jwks_uri': 'customJwksUri',
            }
        }
    });
}

exports.testValidConfig = () => {
    mockWellKnownService();

    test.mock('/lib/configFile/services/getConfig', {
        getConfigOrEmpty: function () {
            return {
                'idprovider.myidp.displayName': 'displayName',
                'idprovider.myidp.description': 'description',

                'idprovider.myidp.issuer': 'issuer',
                'idprovider.myidp.authorizationUrl': 'authorizationUrl',
                'idprovider.myidp.tokenUrl': 'tokenUrl',
                'idprovider.myidp.userinfoUrl': 'userinfoUrl',
                'idprovider.myidp.useUserinfo': 'false',
                'idprovider.myidp.method': 'post',
                'idprovider.myidp.scopes': 'name  profile email     nikname',
                'idprovider.myidp.clientId': 'clientId',
                'idprovider.myidp.clientSecret': 'clientSecret',
                'idprovider.myidp.defaultGroups': 'group:myidp:default group:myidp:dev',
                'idprovider.myidp.claimUsername': 'username',

                'idprovider.myidp.additionalEndpoints.0.name': 'name0',
                'idprovider.myidp.additionalEndpoints.0.url': 'url0',
                'idprovider.myidp.additionalEndpoints.1.name': 'name1',
                'idprovider.myidp.additionalEndpoints.1.url': 'url1',

                'idprovider.myidp.mappings.displayName': '@@{nikname}',
                'idprovider.myidp.mappings.email': '@@{email}',

                'idprovider.myidp.endSession.url': 'endSessionUrl',
                'idprovider.myidp.endSession.idTokenHintKey': 'idTokenHintKey',
                'idprovider.myidp.endSession.postLogoutRedirectUriKey': 'postLogoutRedirectUriKey',
                'idprovider.myidp.endSession.additionalParameters.0.key': 'k0',
                'idprovider.myidp.endSession.additionalParameters.0.value': 'v0',
                'idprovider.myidp.endSession.additionalParameters.1.key': 'k1',
                'idprovider.myidp.endSession.additionalParameters.1.value': 'v1',

                'idprovider.myidp.rules.forceEmailVerification': 'true',

                'idprovider.myidp.autoLogin.enforce': 'false',
                'idprovider.myidp.autoLogin.createUsers': 'true',
                'idprovider.myidp.autoLogin.createSession': 'true',
                'idprovider.myidp.autoLogin.wsHeader': 'false',
                'idprovider.myidp.autoLogin.allowedAudience': 'audience1 audience2   audience3      audience4',
            }
        }
    });

    const configProvider = require('./configProvider');

    const config = configProvider.getIdProviderConfig('myidp');

    test.assertEquals('displayName', config.displayName);
    test.assertEquals('description', config.description);
    test.assertEquals('issuer', config.issuer);
    test.assertEquals('authorizationUrl', config.authorizationUrl);
    test.assertEquals('tokenUrl', config.tokenUrl);
    test.assertEquals('userinfoUrl', config.userinfoUrl);
    test.assertFalse(config.useUserinfo);
    test.assertNull(config.jwksUri);
    test.assertEquals('post', config.method);
    test.assertEquals('name profile email nikname', config.scopes);
    test.assertEquals('clientId', config.clientId);
    test.assertEquals('clientSecret', config.clientSecret);
    test.assertJsonEquals(['group:myidp:default', 'group:myidp:dev'], config.defaultGroups);
    test.assertNull(config.oidcWellKnownEndpoint);
    test.assertEquals('username', config.claimUsername);

    test.assertJsonEquals([{name: 'name0', url: 'url0'}, {name: 'name1', url: 'url1'}], config.additionalEndpoints);

    test.assertEquals('${nikname}', config.mappings.displayName);
    test.assertEquals('${email}', config.mappings.email);

    test.assertEquals('endSessionUrl', config.endSession.url);
    test.assertEquals('idTokenHintKey', config.endSession.idTokenHintKey);
    test.assertEquals('postLogoutRedirectUriKey', config.endSession.postLogoutRedirectUriKey);
    test.assertJsonEquals([{key: 'k0', value: 'v0'}, {key: 'k1', value: 'v1'}], config.endSession.additionalParameters);

    test.assertTrue(config.rules.forceEmailVerification);

    test.assertFalse(config.autoLogin.enforce);
    test.assertTrue(config.autoLogin.createUser);
    test.assertTrue(config.autoLogin.createSession);
    test.assertFalse(config.autoLogin.wsHeader);
    test.assertJsonEquals(['audience1', 'audience2', 'audience3', 'audience4'], config.autoLogin.allowedAudience);
};

exports.testDefaultConfigWithRequiredOptions = () => {
    mockWellKnownService();

    test.mock('/lib/configFile/services/getConfig', {
        getConfigOrEmpty: function () {
            return {
                'idprovider.myidp.issuer': 'issuer',
                'idprovider.myidp.authorizationUrl': 'authorizationUrl',
                'idprovider.myidp.tokenUrl': 'tokenUrl',
                'idprovider.myidp.clientId': 'clientId',
                'idprovider.myidp.clientSecret': 'clientSecret',
            }
        }
    });

    const configProvider = require('./configProvider');

    const config = configProvider.getIdProviderConfig('myidp');

    test.assertEquals('myidp', config._idProviderName); // internal property

    test.assertNull(config.displayName);
    test.assertNull(config.description);
    test.assertEquals('issuer', config.issuer);
    test.assertEquals('authorizationUrl', config.authorizationUrl);
    test.assertEquals('tokenUrl', config.tokenUrl);
    test.assertNull(config.userinfoUrl);
    test.assertNull(config.jwksUri);
    test.assertTrue(config.useUserinfo);
    test.assertEquals('post', config.method);
    test.assertEquals('clientId', config.clientId);
    test.assertEquals('clientSecret', config.clientSecret);
    test.assertJsonEquals([], config.defaultGroups);
    test.assertEquals('profile email', config.scopes);

    test.assertNull(config.oidcWellKnownEndpoint);
    test.assertEquals('sub', config.claimUsername);

    test.assertJsonEquals([], config.additionalEndpoints);

    test.assertEquals('${preferred_username}', config.mappings.displayName);
    test.assertEquals('${email}', config.mappings.email);

    test.assertNull(config.endSession.url);
    test.assertNull(config.endSession.idTokenHintKey);
    test.assertNull(config.endSession.postLogoutRedirectUriKey);
    test.assertJsonEquals([], config.endSession.additionalParameters);

    test.assertFalse(config.rules.forceEmailVerification);

    test.assertFalse(config.autoLogin.enforce);
    test.assertTrue(config.autoLogin.createUser);
    test.assertFalse(config.autoLogin.createSession);
    test.assertFalse(config.autoLogin.wsHeader);
    test.assertJsonEquals([], config.autoLogin.allowedAudience);
};

exports.testValidateRequiredOptions = () => {
    const options = ['issuer', 'authorizationUrl', 'tokenUrl', 'clientId', 'clientSecret'];
    const idProviderName = 'myidp';
    const configuration = {};

    for (let i = 0; i < options.length; i++) {
        mockWellKnownService();

        test.mock('/lib/configFile/services/getConfig', {
            getConfigOrEmpty: function () {
                return configuration;
            }
        });

        const configProvider = require('./configProvider');

        try {
            configProvider.getIdProviderConfig(idProviderName);
        } catch (e) {
            test.assertEquals(`Missing config '${options[i]}' for ID Provider '${idProviderName}'.`, e);
        }

        configuration[`idprovider.${idProviderName}.${options[i]}`] = 'value';
    }
};

exports.testValidationOfAdditionalEndpoints = () => {
    const idProviderName = 'myidp';

    mockWellKnownService();

    test.mock('/lib/configFile/services/getConfig', {
        getConfigOrEmpty: function () {
            return {
                'idprovider.myidp.issuer': 'issuer',
                'idprovider.myidp.authorizationUrl': 'authorizationUrl',
                'idprovider.myidp.tokenUrl': 'tokenUrl',
                'idprovider.myidp.clientId': 'clientId',
                'idprovider.myidp.clientSecret': 'clientSecret',

                'idprovider.myidp.additionalEndpoints.0.name': 'name0', // url is missing for this endpoint
                'idprovider.myidp.additionalEndpoints.1.name': 'name1',
                'idprovider.myidp.additionalEndpoints.1.url': 'url1',
            }
        }
    });

    const configProvider = require('./configProvider');

    try {
        configProvider.getIdProviderConfig(idProviderName);
    } catch (e) {
        test.assertEquals(`Invalid configuration of 'additionalEndpoints' for ID Provider '${idProviderName}'.`, e);
    }
};

exports.testValidationOfEndSessionAdditionalParameters = () => {
    const idProviderName = 'myidp';

    mockWellKnownService();

    test.mock('/lib/configFile/services/getConfig', {
        getConfigOrEmpty: function () {
            return {
                'idprovider.myidp.issuer': 'issuer',
                'idprovider.myidp.authorizationUrl': 'authorizationUrl',
                'idprovider.myidp.tokenUrl': 'tokenUrl',
                'idprovider.myidp.clientId': 'clientId',
                'idprovider.myidp.clientSecret': 'clientSecret',

                'idprovider.myidp.endSession.additionalParameters.0.key': 'k0',
                'idprovider.myidp.endSession.additionalParameters.0.value': 'v0',
                'idprovider.myidp.endSession.additionalParameters.1.value': 'v1',  // key is missing for this parameter
            }
        }
    });

    const configProvider = require('./configProvider');

    try {
        configProvider.getIdProviderConfig(idProviderName);
    } catch (e) {
        test.assertEquals(`Invalid configuration of 'endSession.additionalParameters' for ID Provider '${idProviderName}'.`, e);
    }
};

exports.testWhenOidcWellKnownEndpointSet = () => {
    require('/lib/configFile/wellKnownService');

    mockWellKnownServiceWithCustomConfig();

    test.mock('/lib/configFile/services/getConfig', {
        getConfigOrEmpty: function () {
            return {
                'idprovider.myidp.oidcWellKnownEndpoint': 'endpoint',
                'idprovider.myidp.issuer': 'issuer',
                'idprovider.myidp.authorizationUrl': 'authorizationUrl',
                'idprovider.myidp.tokenUrl': 'tokenUrl',
                'idprovider.myidp.userinfoUrl': 'userinfoUrl',

                'idprovider.myidp.clientId': 'clientId',
                'idprovider.myidp.clientSecret': 'clientSecret',
            }
        }
    });

    const configProvider = require('./configProvider');

    const config = configProvider.getIdProviderConfig('myidp');

    test.assertEquals('customIssuer', config.issuer);
    test.assertEquals('customAuthorizationUrl', config.authorizationUrl);
    test.assertEquals('customTokenUrl', config.tokenUrl);
    test.assertEquals('customUserinfoUrl', config.userinfoUrl);
    test.assertEquals('customJwksUri', config.jwksUri);
};
