const getConfigService = require('/lib/configFile/services/getConfig');
const wellKnownService = require('/lib/configFile/wellKnownService');

const END_SESSION_ADDITIONAL_PARAMETERS_PATTERN = '^idprovider\.[a-zA-Z0-9_-]+\.endSession\.additionalParameters\.(\\d+)\.(key|value)$';
const ADDITIONAL_ENDPOINTS = "^idprovider\.[a-zA-Z0-9_-]+\.additionalEndpoints\.(\\d+)\.(name|url)$";
const GROUPS_MAPPING_PATTERN = '^idprovider\.[a-zA-Z0-9_-]+\.groups\.mapping\.(\\d+)\.(value|group)$';
const NATIVE_CLIENTS_PATTERN = '^idprovider\.[a-zA-Z0-9_-]+\.native\.clients\.(\\d+)\.(clientId|redirectUris)$';

const parseStringArray = value => value ? value.split(' ').filter(v => !!v) : [];
const firstAtsToDollar = value => value ? value.replace(/@@\{/g, '${') : value;
const defaultBooleanTrue = value => value !== 'false';
const parseLong = (value, defaultValue) => /^-?\d+$/.test(value) ? +value : defaultValue;

exports.getIdProviderConfig = function (idProviderName) {
    const cachedConfig = wellKnownService.getIdProviderConfig(idProviderName);
    if (cachedConfig) {
        return cachedConfig;
    }

    const idProviderKeyBase = `idprovider.${idProviderName}`;

    const rawIdProviderConfig = getRawIdProviderConfig(idProviderKeyBase);

    const parsedClientSecrets = parseStringArray(rawIdProviderConfig[`${idProviderKeyBase}.clientSecret`]);

    const config = {
        _idProviderName: idProviderName,

        usePkce: defaultBooleanTrue(rawIdProviderConfig[`${idProviderKeyBase}.usePkce`]),
        displayName: rawIdProviderConfig[`${idProviderKeyBase}.displayName`] || null,
        description: rawIdProviderConfig[`${idProviderKeyBase}.description`] || null,

        oidcWellKnownEndpoint: rawIdProviderConfig[`${idProviderKeyBase}.oidcWellKnownEndpoint`] || null,
        issuer: rawIdProviderConfig[`${idProviderKeyBase}.issuer`] || null,
        authorizationUrl: rawIdProviderConfig[`${idProviderKeyBase}.authorizationUrl`] || null,
        tokenUrl: rawIdProviderConfig[`${idProviderKeyBase}.tokenUrl`] || null,
        userinfoUrl: rawIdProviderConfig[`${idProviderKeyBase}.userinfoUrl`] || null,
        jwksUri: rawIdProviderConfig[`${idProviderKeyBase}.jwksUri`] || null,
        useUserinfo: defaultBooleanTrue(rawIdProviderConfig[`${idProviderKeyBase}.useUserinfo`]),
        method: rawIdProviderConfig[`${idProviderKeyBase}.method`] || 'post',
        scopes: parseStringArray(rawIdProviderConfig[`${idProviderKeyBase}.scopes`]).join(' ') || 'profile email',
        clientId: rawIdProviderConfig[`${idProviderKeyBase}.clientId`] || null,
        clientSecret: parsedClientSecrets && parsedClientSecrets.length ? parsedClientSecrets : null,
        defaultGroups: parseStringArray(rawIdProviderConfig[`${idProviderKeyBase}.defaultGroups`]),
        claimUsername: rawIdProviderConfig[`${idProviderKeyBase}.claimUsername`] || 'sub',
        mappings: {
            displayName: firstAtsToDollar(rawIdProviderConfig[`${idProviderKeyBase}.mappings.displayName`]) ||
                         '${userinfo.preferred_username}',
            email: firstAtsToDollar(rawIdProviderConfig[`${idProviderKeyBase}.mappings.email`]) || '${userinfo.email}',
        },
        rules: {
            forceEmailVerification: rawIdProviderConfig[`${idProviderKeyBase}.rules.forceEmailVerification`] === 'true',
        },
        additionalEndpoints: extractPropertiesToArray(rawIdProviderConfig, `${idProviderKeyBase}.additionalEndpoints.`,
            ADDITIONAL_ENDPOINTS),
        autoLogin: {
            createUser: defaultBooleanTrue(rawIdProviderConfig[`${idProviderKeyBase}.autoLogin.createUser`]),
            createSession: rawIdProviderConfig[`${idProviderKeyBase}.autoLogin.createSession`] === 'true' || false,
            wsHeader: rawIdProviderConfig[`${idProviderKeyBase}.autoLogin.wsHeader`] === 'true' || false,
            allowedAudience: parseStringArray(rawIdProviderConfig[`${idProviderKeyBase}.autoLogin.allowedAudience`]),
            applyGroups: rawIdProviderConfig[`${idProviderKeyBase}.autoLogin.applyGroups`] === 'true' || false,
        },
        native: {
            // Per-client redirect-URI registry for the native flow (RFC 8252). Each client (matched
            // by client_id) registers its own redirect URIs; the allowRedirectUri hook only accepts a
            // redirect_uri registered for the request's client_id. Entries are matched exactly, except
            // the special token "(_loopback_)", which grants any RFC 8252 loopback redirect.
            clients: parseNativeClients(rawIdProviderConfig, idProviderKeyBase),
        },
        groups: parseGroups(rawIdProviderConfig, idProviderKeyBase, idProviderName),
        userEventPrefix: rawIdProviderConfig[`${idProviderKeyBase}.userEventPrefix`] || app.name,
        userEventMode: rawIdProviderConfig[`${idProviderKeyBase}.userEventMode`] || 'local',
        acceptLeeway: parseLong(rawIdProviderConfig[`${idProviderKeyBase}.acceptLeeway`], 1),
    };

    if (hasProperty(rawIdProviderConfig, idProviderKeyBase, 'endSession')) {
        config.endSession = {
            url: rawIdProviderConfig[`${idProviderKeyBase}.endSession.url`] || null,
            idTokenHintKey: rawIdProviderConfig[`${idProviderKeyBase}.endSession.idTokenHintKey`] || null,
            postLogoutRedirectUriKey: rawIdProviderConfig[`${idProviderKeyBase}.endSession.postLogoutRedirectUriKey`] || null,
            additionalParameters: extractPropertiesToArray(rawIdProviderConfig, `${idProviderKeyBase}.endSession.additionalParameters.`,
                END_SESSION_ADDITIONAL_PARAMETERS_PATTERN),
        }
    }

    if (config.oidcWellKnownEndpoint != null) {
        takeConfigurationFromWellKnownEndpoint(config);
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

function hasProperty(idProviderConfig, idProviderKeyBase, property) {
    const properties = Object.keys(idProviderConfig).filter(k => k.startsWith(`${idProviderKeyBase}.${property}`));
    return properties.length > 0;
}

function takeConfigurationFromWellKnownEndpoint(config) {
    const wellKnownConfiguration = wellKnownService.getWellKnownConfiguration(config.oidcWellKnownEndpoint);

    config.issuer = wellKnownConfiguration.issuer;
    config.authorizationUrl = wellKnownConfiguration.authorization_endpoint;
    config.tokenUrl = wellKnownConfiguration.token_endpoint;
    config.userinfoUrl = wellKnownConfiguration.userinfo_endpoint;
    config.jwksUri = wellKnownConfiguration.jwks_uri;

    if (wellKnownConfiguration.end_session_endpoint) {
        if (!config.endSession) {
            config.endSession = {
                url: wellKnownConfiguration.end_session_endpoint,
                idTokenHintKey: null,
                postLogoutRedirectUriKey: null,
                additionalParameters: [],
            };
        } else if (!config.endSession.url) {
            config.endSession.url = wellKnownConfiguration.end_session_endpoint;
        }
    }
}

// Note: device/native login (token shape, code lifetimes, the OAuth protocol) is owned by XP core
// now. The app keeps only the per-client native redirect registry (native.clients, consulted by the
// allowRedirectUri hook) and renders the UI via the deviceVerification / authorizeConsent hooks.

// Parses the per-client native redirect registry:
//   idprovider.<name>.native.clients.0.clientId     = my-native-app
//   idprovider.<name>.native.clients.0.redirectUris = (_loopback_) com.example.app:/oauth
// Entries without a clientId are ignored.
function parseNativeClients(rawConfig, idProviderKeyBase) {
    return extractPropertiesToArray(rawConfig, `${idProviderKeyBase}.native.clients.`, NATIVE_CLIENTS_PATTERN)
        .filter(entry => entry && entry.clientId)
        .map(entry => ({
            clientId: entry.clientId,
            redirectUris: parseStringArray(entry.redirectUris),
        }));
}

function validate(config, idProviderName) {
    checkConfig(config, 'issuer', idProviderName);
    checkConfig(config, 'authorizationUrl', idProviderName);
    checkConfig(config, 'tokenUrl', idProviderName);

    if (config.clientId != null) {
        checkConfig(config, 'clientSecret', idProviderName);
    }
    if (config.clientSecret != null) {
        checkConfig(config, 'clientId', idProviderName);
    }

    checkArrayConfig(config.additionalEndpoints, 'additionalEndpoints', idProviderName);
    if (config.endSession) {
        required(config.endSession.url, 'endSession.url', idProviderName);
        checkArrayConfig(config.endSession.additionalParameters, 'endSession.additionalParameters', idProviderName);
    }
}

function parseGroups(rawConfig, idProviderKeyBase, idProviderName) {
    const claim = rawConfig[`${idProviderKeyBase}.groups.claim`] || null;
    if (!claim) {
        return null;
    }

    const rawSyncMode = rawConfig[`${idProviderKeyBase}.groups.syncMode`];
    let syncMode = 'add';
    if (rawSyncMode === 'sync') {
        syncMode = 'sync';
    } else if (rawSyncMode && rawSyncMode !== 'add') {
        log.warning(`Unknown groups.syncMode '${rawSyncMode}' for ID Provider '${idProviderName}'; falling back to 'add'.`);
    }

    const groupKeyPrefix = `group:${idProviderName}:`;
    const mapping = extractPropertiesToArray(rawConfig, `${idProviderKeyBase}.groups.mapping.`, GROUPS_MAPPING_PATTERN)
        .filter(entry => {
            if (!entry || !entry.value || !entry.group) {
                if (entry) {
                    log.warning(`Ignoring incomplete groups.mapping entry for ID Provider '${idProviderName}'; both 'value' and 'group' are required.`);
                }
                return false;
            }
            const parts = entry.group.split(':');
            if (parts.length !== 3 || parts[0] !== 'group' || parts[2] === '') {
                log.warning(`Ignoring groups.mapping entry with malformed group key '${entry.group}' for ID Provider '${idProviderName}'; must be in the format 'group:${idProviderName}:<name>'.`);
                return false;
            }
            if (parts[1] !== idProviderName) {
                log.warning(`Ignoring groups.mapping entry with cross-IDP group key '${entry.group}' for ID Provider '${idProviderName}'; must start with '${groupKeyPrefix}'.`);
                return false;
            }
            return true;
        });

    if (mapping.length === 0) {
        log.warning(`groups.claim is configured but no valid mapping entries for ID Provider '${idProviderName}'; feature has no effect.`);
    }

    return {
        claim: claim,
        syncMode: syncMode,
        mapping: mapping,
    };
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

function required(value, name, idProviderName) {
    if (value == null) {
        throw `Missing config '${name}' for ID Provider '${idProviderName}'.`;
    }
    return value;
}

function checkConfig(params, name, idProviderName) {
    const value = params[name];
    return required(value, name, idProviderName);
}

function checkArrayConfig(items, name, idProviderName) {
    items.forEach(item => {
        if (Object.keys(item).length !== 2) {
            throw `Invalid configuration of '${name}' for ID Provider '${idProviderName}'.`;
        }
    })
}
