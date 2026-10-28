// The scopes and clients the configuration declares for an ID provider are registered with it in
// XP, where the consent page and the token endpoints read them. Registration is idempotent: a
// declared entry is created if missing and brought up to date if present; entries not declared
// are left alone, so the registry can also be managed elsewhere.

const authLib = require('/lib/xp/auth');

function supplyScopes(idProviderName, scopes) {
    if (scopes.length === 0) {
        return;
    }
    const existing = Object.create(null);
    authLib.getScopes({idProvider: idProviderName}).forEach(scope => existing[scope.id] = scope);
    scopes.forEach(scope => {
        const params = {
            idProvider: idProviderName,
            id: scope.id,
            title: scope.title || undefined,
            description: scope.description || undefined,
            roles: scope.roles,
            required: scope.required,
        };
        if (existing[scope.id]) {
            authLib.modifyScope({
                idProvider: idProviderName,
                id: scope.id,
                title: scope.title,
                description: scope.description,
                roles: scope.roles,
                required: scope.required,
            });
        } else {
            log.info(`Registering scope '${scope.id}' with ID Provider '${idProviderName}'`);
            authLib.createScope(params);
        }
    });
}

function supplyClients(idProviderName, clients) {
    if (clients.length === 0) {
        return;
    }
    const existing = Object.create(null);
    authLib.getClients({idProvider: idProviderName}).forEach(client => existing[client.id] = client);
    clients.forEach(client => {
        const values = {
            displayName: client.displayName,
            uri: client.uri,
            logoUri: client.logoUri,
            policyUri: client.policyUri,
            tosUri: client.tosUri,
            grantTypes: client.grantTypes,
            redirectUris: client.redirectUris,
            scope: client.scope,
            resource: client.resource,
            grantTtl: client.grantTtl,
            enabled: client.enabled,
        };
        if (existing[client.id]) {
            authLib.modifyClient(forClient(idProviderName, client.id, values, true));
        } else {
            log.info(`Registering client '${client.id}' with ID Provider '${idProviderName}'`);
            authLib.createClient(forClient(idProviderName, client.id, values, false));
        }
    });
}

// The parameters of a client call: a change names every value, nulls included, so what the
// configuration no longer declares is cleared; a creation names only what is declared.
function forClient(idProviderName, id, values, withNulls) {
    const params = {idProvider: idProviderName, id: id};
    Object.keys(values).forEach(key => {
        if (withNulls || values[key] != null) {
            params[key] = values[key];
        }
    });
    return params;
}

/**
 * Registers the scopes and clients the configuration declares for the ID provider.
 *
 * @param {object} config the ID provider's configuration, with its `consent` section
 */
exports.supply = function (config) {
    const consent = config.consent || {scopes: [], clients: []};
    supplyScopes(config._idProviderName, consent.scopes || []);
    supplyClients(config._idProviderName, consent.clients || []);
};
