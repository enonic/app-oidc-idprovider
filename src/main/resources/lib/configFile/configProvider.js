const getConfigService = require('/lib/configFile/services/getConfig');
const wellKnownService = require('/lib/configFile/wellKnownService');

const END_SESSION_ADDITIONAL_PARAMETERS_PATTERN = '^idprovider\.[a-zA-Z0-9_-]+\.endSession\.additionalParameters\.(\\d+)\.(key|value)$';
const ADDITIONAL_ENDPOINTS = "^idprovider\.[a-zA-Z0-9_-]+\.additionalEndpoints\.(\\d+)\.(name|url)$";

const parseStringArray = value => value ? value.split(' ').filter(v => !!v) : [];
const firstAtsToDollar = value => value ? value.replace(/@@\{/, '${') : value;

const defaultBooleanTrue = value => value !== 'false';

exports.getIdProviderConfig = function (idProviderName) {
    const cachedConfig = wellKnownService.getIdProviderConfig(idProviderName);
    if (cachedConfig) {
        return cachedConfig;
    }

    const idProviderKeyBase = `idprovider.${idProviderName}`;

    const rawIdProviderConfig = getRawIdProviderConfig(idProviderKeyBase);

    const config = {
        _idProviderName: idProviderName,

        displayName: rawIdProviderConfig[`${idProviderKeyBase}.displayName`] || null,
        description: rawIdProviderConfig[`${idProviderKeyBase}.description`] || null,

        oidcWellKnownEndpoint: rawIdProviderConfig[`${idProviderKeyBase}.oidcWellKnownEndpoint`] || null,
        issuer: rawIdProviderConfig[`${idProviderKeyBase}.issuer`] || null,
        authorizationUrl: rawIdProviderConfig[`${idProviderKeyBase}.authorizationUrl`] || null,
        tokenUrl: rawIdProviderConfig[`${idProviderKeyBase}.tokenUrl`] || null,
        userinfoUrl: rawIdProviderConfig[`${idProviderKeyBase}.userinfoUrl`] || null,
        useUserinfo: defaultBooleanTrue(rawIdProviderConfig[`${idProviderKeyBase}.useUserinfo`]),
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
        autoLogin: {
            enforce: rawIdProviderConfig[`${idProviderKeyBase}.autoLogin.enforce`] === 'true' || false,
            createUsers: defaultBooleanTrue(rawIdProviderConfig[`${idProviderKeyBase}.autoLogin.createUsers`]),
            createSession: rawIdProviderConfig[`${idProviderKeyBase}.autoLogin.createSession`] === 'true' || false,
            retrievalWsHeader: rawIdProviderConfig[`${idProviderKeyBase}.autoLogin.retrievalWsHeader`] === 'true' || false,
            validationAllowedAudience: parseStringArray(rawIdProviderConfig[`${idProviderKeyBase}.autoLogin.validationAllowedAudience`]),
        },
    };

    if (config.oidcWellKnownEndpoint) {
        overrideConfig(config);
    }

    validate(config, idProviderName);

    wellKnownService.cacheIdProviderConfig(idProviderName, config);

    return config;
};

function getRawIdProviderConfig(idProviderKeyBase) {
    const result = {};
    const appConfig = getConfigService.getConfigOrEmpty();

    Object.keys(appConfig).filter(k => k && (k.startsWith(idProviderKeyBase))).forEach(k => result[k] = appConfig[k]);

    return result;
}

function overrideConfig(config) {
    const wellKnownConfiguration = wellKnownService.getWellKnownConfiguration(config.oidcWellKnownEndpoint);

    config.issuer = wellKnownConfiguration.issuer;
    config.authorizationUrl = wellKnownConfiguration.authorization_endpoint;
    config.tokenUrl = wellKnownConfiguration.token_endpoint;
    config.userinfoUrl = wellKnownConfiguration.userinfo_endpoint;
    config.jwksUri = wellKnownConfiguration.jwks_uri;
}

function validate(config, idProviderName) {
    checkConfig(config, 'issuer', idProviderName);
    checkConfig(config, 'authorizationUrl', idProviderName);
    checkConfig(config, 'tokenUrl', idProviderName);

    if (!config.autoLogin.enforce) {
        checkConfig(config, 'clientId', idProviderName);
        checkConfig(config, 'clientSecret', idProviderName);
    }

    if (config.autoLogin.enforce && !config.oidcWellKnownEndpoint) {
        throw `Auto login is enforced but 'oidcWellKnownEndpoint' is not configured for ID Provider '${idProviderName}'.`;
    }

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
