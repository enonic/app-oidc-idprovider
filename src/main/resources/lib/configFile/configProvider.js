const getConfigService = require('/lib/configFile/services/getConfig');
const wellKnownService = require('/lib/configFile/wellKnownService');

const END_SESSION_ADDITIONAL_PARAMETERS_PATTERN = '^idprovider\.[a-zA-Z0-9_-]+\.endSession\.additionalParameters\.(\\d+)\.(key|value)$';
const ADDITIONAL_ENDPOINTS = "^idprovider\.[a-zA-Z0-9_-]+\.additionalEndpoints\.(\\d+)\.(name|url)$";

const parseStringArray = value => value ? value.split(' ').filter(v => !!v) : [];
const firstAtsToDollar = value => value ? value.replace(/@@\{/, '${') : value;

exports.getIdProviderConfig = function (idProviderName) {
    const idProviderKeyBase = `idprovider.${idProviderName}`;

    const rawIdProviderConfig = {};
    const appConfig = getConfigService.getConfigOrEmpty();
    Object.keys(appConfig).filter(k => k && (k.startsWith(idProviderKeyBase))).forEach(k => rawIdProviderConfig[k] = appConfig[k]);

    const config = {
        displayName: rawIdProviderConfig[`${idProviderKeyBase}.displayName`] || null,
        description: rawIdProviderConfig[`${idProviderKeyBase}.description`] || null,

        oidcWellKnownEndpoint: rawIdProviderConfig[`${idProviderKeyBase}.oidcWellKnownEndpoint`],
        issuer: rawIdProviderConfig[`${idProviderKeyBase}.issuer`] || null,
        authorizationUrl: rawIdProviderConfig[`${idProviderKeyBase}.authorizationUrl`] || null,
        tokenUrl: rawIdProviderConfig[`${idProviderKeyBase}.tokenUrl`] || null,
        userinfoUrl: rawIdProviderConfig[`${idProviderKeyBase}.userinfoUrl`] || null,
        method: rawIdProviderConfig[`${idProviderKeyBase}.method`] || 'post',
        scopes: parseStringArray(rawIdProviderConfig[`${idProviderKeyBase}.scopes`]).join(' ') || 'profile email',
        clientId: rawIdProviderConfig[`${idProviderKeyBase}.clientId`] || null,
        clientSecret: rawIdProviderConfig[`${idProviderKeyBase}.clientSecret`] || null,
        defaultGroups: parseStringArray(rawIdProviderConfig[`${idProviderKeyBase}.defaultGroups`]),
        claimUsername: rawIdProviderConfig[`${idProviderKeyBase}.claimUsername`] || 'sub',
        mappings: {
            displayName: firstAtsToDollar(rawIdProviderConfig[`${idProviderKeyBase}.mappings.displayName`]) || '${preferred_username}',
            email: firstAtsToDollar(rawIdProviderConfig[`${idProviderKeyBase}.mappings.email`]) || '${email}',
        },
        endSession: {
            url: rawIdProviderConfig[`${idProviderKeyBase}.endSession.url`] || null,
            idTokenHintKey: rawIdProviderConfig[`${idProviderKeyBase}.endSession.idTokenHintKey`] || null,
            postLogoutRedirectUriKey: rawIdProviderConfig[`${idProviderKeyBase}.endSession.postLogoutRedirectUriKey`] || null,
            additionalParameters: extractPropertiesToArray(rawIdProviderConfig, `${idProviderKeyBase}.endSession.additionalParameters.`,
                END_SESSION_ADDITIONAL_PARAMETERS_PATTERN),
        },
        rules: {
            forceEmailVerification: rawIdProviderConfig[`${idProviderKeyBase}.rules.forceEmailVerification`] === 'true',
        },
        additionalEndpoints: extractPropertiesToArray(rawIdProviderConfig, `${idProviderKeyBase}.additionalEndpoints.`,
            ADDITIONAL_ENDPOINTS),
        handle401: {
            enabled: rawIdProviderConfig[`${idProviderKeyBase}.handle401.enabled`] === 'true' || true,
        },
        autoLogin: {
            enabled: rawIdProviderConfig[`${idProviderKeyBase}.autoLogin.enabled`] === 'true' || false,
            useUserinfo: rawIdProviderConfig[`${idProviderKeyBase}.autoLogin.useUserinfo`] === 'true' || false,
            claimDisplayName: rawIdProviderConfig[`${idProviderKeyBase}.autoLogin.claimDisplayName`] || 'name',
            claimEmail: rawIdProviderConfig[`${idProviderKeyBase}.autoLogin.claimEmail`] || 'email',
            createUsers: rawIdProviderConfig[`${idProviderKeyBase}.autoLogin.createUsers`] === 'true' || true,
            createSession: rawIdProviderConfig[`${idProviderKeyBase}.autoLogin.createSession`] === 'true' || false,
            retrievalQueryParameter: rawIdProviderConfig[`${idProviderKeyBase}.autoLogin.retrievalQueryParameter`] || null,
            retrievalWsHeader: rawIdProviderConfig[`${idProviderKeyBase}.autoLogin.retrievalWsHeader`] === 'true' || false,
            validationAllowedSubjects: parseStringArray(rawIdProviderConfig[`${idProviderKeyBase}.autoLogin.validationAllowedSubjects`]),
        },
    };

    if (config.oidcWellKnownEndpoint) {
        overrideConfig(config);
    }

    validate(config, idProviderName);

    return config;
};

function overrideConfig(config) {
    const wellKnownConfigurationBean = wellKnownService.getWellKnownConfiguration(config.oidcWellKnownEndpoint);

    config.issuer = wellKnownConfigurationBean.issuer;
    config.authorizationUrl = wellKnownConfigurationBean.authorization_endpoint;
    config.tokenUrl = wellKnownConfigurationBean.token_endpoint;
    config.userinfoUrl = wellKnownConfigurationBean.userinfo_endpoint;
    config.jwksUri = wellKnownConfigurationBean.jwks_uri;
}

function validate(config, idProviderName) {
    checkConfig(config, 'issuer', idProviderName);
    checkConfig(config, 'authorizationUrl', idProviderName);
    checkConfig(config, 'tokenUrl', idProviderName);
    checkConfig(config, 'clientId', idProviderName);
    checkConfig(config, 'clientSecret', idProviderName);

    checkArrayConfig(config.additionalEndpoints, 'additionalEndpoints', idProviderName);
    checkArrayConfig(config.endSession.additionalParameters, 'endSession.additionalParameters', idProviderName);
}

function extractPropertiesToArray(rawConfig, basePropertyPath, propertyPattern) {
    const options = Object.keys(rawConfig).filter(k => k && k.startsWith(basePropertyPath));

    const result = [];

    options.forEach(option => {
        const match = option.match(propertyPattern);
        if (match) {
            const index = parseInt(match[1], 10);
            const propertyName = match[2];
            if (!result[index]) {
                result[index] = {};
            }
            result[index][propertyName] = rawConfig[option];
        }
    });

    return result;
}

function checkConfig(params, name, idProviderName) {
    const value = params[name];
    if (value == null) {
        throw `Missing config '${name}' for ID Provider '${idProviderName}'.`;
    }
    return value;
}

function checkArrayConfig(items, name, idProviderName) {
    items.forEach(item => {
        if (Object.keys(item).length !== 2) {
            throw `Invalid configuration of '${name}' for ID Provider '${idProviderName}'.`;
        }
    })
}
