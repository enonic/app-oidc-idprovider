const test = require('/lib/xp/testing');

exports.testValidConfig = () => {
    test.mock('/lib/configFile/services/getConfig', {
        getConfigOrEmpty: function () {
            return {
                'idprovider.myidp.displayName': 'displayName',
                'idprovider.myidp.description': 'description',

                'idprovider.myidp.issuer': 'issuer',
                'idprovider.myidp.authorizationUrl': 'authorizationUrl',
                'idprovider.myidp.tokenUrl': 'tokenUrl',
                'idprovider.myidp.userinfoUrl': 'userinfoUrl',
                'idprovider.myidp.method': 'post',
                'idprovider.myidp.scopes': 'name  profile email     nikname',
                'idprovider.myidp.clientId': 'clientId',
                'idprovider.myidp.clientSecret': 'clientSecret',
                'idprovider.myidp.defaultGroups': 'group:myidp:default group:myidp:dev',
                'idprovider.myidp.claimUsername': 'username',
                'idprovider.myidp.handle401.enabled': 'true',

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

                'idprovider.myidp.autoLogin.enabled': 'false',
                'idprovider.myidp.autoLogin.useUserinfo': 'false',
                'idprovider.myidp.autoLogin.claimDisplayName': 'username',
                'idprovider.myidp.autoLogin.claimEmail': 'oid',
                'idprovider.myidp.autoLogin.createUsers': 'true',
                'idprovider.myidp.autoLogin.createSession': 'true',
                'idprovider.myidp.autoLogin.retrievalQueryParameter': 'code',
                'idprovider.myidp.autoLogin.retrievalWsHeader': 'false',
                'idprovider.myidp.autoLogin.validationAllowedSubjects': 'header1 header2   header3      header4',
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

    test.assertTrue(config.handle401.enabled);

    test.assertFalse(config.autoLogin.enabled);
    test.assertFalse(config.autoLogin.useUserinfo);
    test.assertEquals('username', config.autoLogin.claimDisplayName);
    test.assertEquals('oid', config.autoLogin.claimEmail);
    test.assertTrue(config.autoLogin.createUsers);
    test.assertTrue(config.autoLogin.createSession);
    test.assertTrue(config.autoLogin.retrievalQueryParameter);
    test.assertEquals('code', config.autoLogin.retrievalQueryParameter);
    test.assertFalse(config.autoLogin.retrievalWsHeader);
    test.assertJsonEquals(['header1', 'header2', 'header3', 'header4'], config.autoLogin.validationAllowedSubjects);
};

exports.testDefaultConfigWithRequiredOptions = () => {
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

    test.assertNull(config.displayName);
    test.assertNull(config.description);
    test.assertEquals('issuer', config.issuer);
    test.assertEquals('authorizationUrl', config.authorizationUrl);
    test.assertEquals('tokenUrl', config.tokenUrl);
    test.assertNull(config.userinfoUrl);
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

    test.assertTrue(config.handle401.enabled);

    test.assertFalse(config.autoLogin.enabled);
    test.assertFalse(config.autoLogin.useUserinfo);
    test.assertEquals('name', config.autoLogin.claimDisplayName);
    test.assertEquals('email', config.autoLogin.claimEmail);
    test.assertTrue(config.autoLogin.createUsers);
    test.assertFalse(config.autoLogin.createSession);
    test.assertNull(config.autoLogin.retrievalQueryParameter);
    test.assertFalse(config.autoLogin.retrievalWsHeader);
    test.assertJsonEquals([], config.autoLogin.validationAllowedSubjects);
};

exports.testValidateRequiredOptions = () => {
    const options = ['issuer', 'authorizationUrl', 'tokenUrl', 'clientId', 'clientSecret'];
    const idProviderName = 'myidp';
    const configuration = {};

    for (let i = 0; i < options.length; i++) {
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

    test.mock('/lib/configFile/wellKnownService', {
        getWellKnownConfiguration: function (endpoint) {
            return {
                'issuer': 'customIssuer',
                'authorization_endpoint': 'customAuthorizationUrl',
                'token_endpoint': 'customTokenUrl',
                'userinfo_endpoint': 'customUserinfoUrl',
            }
        }
    });

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
};
