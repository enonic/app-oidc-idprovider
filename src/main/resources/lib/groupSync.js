const authLib = require('/lib/xp/auth');

// Resolve the value at the configured claim path against the userinfo object.
// A path containing ':' (URI scheme or URN) is treated as a single literal key;
// otherwise it is split on '.' and walked as a dotted path.
function resolveClaimValue(userinfo, claimPath) {
    if (claimPath.indexOf(':') !== -1) {
        return userinfo[claimPath];
    }

    let current = userinfo;
    const keys = claimPath.split('.');
    for (const key of keys) {
        if (current == null || typeof current !== 'object') {
            return undefined;
        }
        current = current[key];
    }
    return current;
}

function normalizeToArray(raw, claimPath) {
    if (raw == null) {
        return [];
    }
    if (Array.isArray(raw)) {
        return raw;
    }
    if (typeof raw === 'string') {
        return [raw];
    }
    // Non-array, non-string (object, number, ...). Notably Entra's groups overage
    // indirection (_claim_names / hasgroups) lands here and is silently skipped;
    // the Entra fork is responsible for resolving overage before this point.
    log.debug(`Groups claim [${claimPath}] resolved to a non-array, non-string value; ignoring`);
    return [];
}

// Parse the local part ('name') out of a 'group:<idp>:<name>' key.
function localPart(groupKey) {
    const parts = groupKey.split(':');
    return parts[parts.length - 1];
}

// Resolve the configured claim path against the merged claims object and return
// the deduplicated list of Enonic group keys the user should be a member of,
// according to the mapping. Returns [] when the feature is disabled, the claim
// is missing or non-array, or no values match the mapping.
exports.resolveGroupKeysFromClaims = function (idProviderConfig, claims) {
    const groups = idProviderConfig.groups;
    if (!groups) {
        return [];
    }

    const userinfo = (claims && claims.userinfo) || {};
    const raw = resolveClaimValue(userinfo, groups.claim);
    const values = normalizeToArray(raw, groups.claim);

    const mapping = groups.mapping || [];
    const result = [];
    mapping.forEach(m => {
        if (values.indexOf(m.value) !== -1 && result.indexOf(m.group) === -1) {
            result.push(m.group);
        }
    });
    return result;
};

// Ensure every group referenced by the ID Provider's groups.mapping exists,
// creating any that are missing. Groups are provisioned eagerly (at app start /
// config change) rather than lazily at login. Must be called under SU, after the
// ID Provider's userstore exists. Idempotent: existing groups are skipped. On
// per-group failures, logs a warning and continues. Never throws.
exports.ensureGroupsExist = function (idProviderConfig) {
    const groups = idProviderConfig.groups;
    if (!groups) {
        return;
    }

    const idProviderName = idProviderConfig._idProviderName;
    const mappedKeys = [];
    (groups.mapping || []).forEach(m => {
        if (mappedKeys.indexOf(m.group) === -1) {
            mappedKeys.push(m.group);
        }
    });

    mappedKeys.forEach(groupKey => {
        try {
            if (authLib.getPrincipal(groupKey)) {
                return;
            }
            const name = localPart(groupKey);
            authLib.createGroup({
                idProvider: idProviderName,
                name: name,
                displayName: name,
            });
            log.debug(`Group [${groupKey}] created in ID Provider [${idProviderName}]`);
        } catch (e) {
            log.warning(`Could not create group [${groupKey}] in ID Provider [${idProviderName}]: ${e}`);
        }
    });
};

// Reconcile the user's memberships in MAPPED groups according to syncMode.
// - 'add': add the user to each desired group not yet a member of.
// - 'sync': same, plus remove the user from mapped groups not in desired.
// Groups are provisioned eagerly elsewhere (see ensureGroupsExist); a desired
// group that is still missing is skipped with a warning, never created here.
// On per-group failures, logs a warning and continues. Never throws.
exports.applyGroups = function (idProviderConfig, userKey, desiredGroupKeys) {
    const groups = idProviderConfig.groups;
    if (!groups) {
        return;
    }

    const desired = desiredGroupKeys || [];
    const mapped = (groups.mapping || []).map(m => m.group);

    desired.forEach(groupKey => {
        try {
            if (!authLib.getPrincipal(groupKey)) {
                log.warning(`Group [${groupKey}] does not exist; skipping membership for user [${userKey}]`);
                return;
            }
            authLib.addMembers(groupKey, [userKey]);
            log.debug(`User [${userKey}] added to group [${groupKey}]`);
        } catch (e) {
            log.warning(`Could not add user [${userKey}] to group [${groupKey}]: ${e}`);
        }
    });

    if (groups.syncMode === 'sync') {
        let currentKeys = [];
        try {
            currentKeys = authLib.getMemberships(userKey).map(principal => principal.key);
        } catch (e) {
            log.warning(`Could not resolve memberships for user [${userKey}]: ${e}`);
            return;
        }

        currentKeys
            .filter(key => mapped.indexOf(key) !== -1 && desired.indexOf(key) === -1)
            .forEach(groupKey => {
                try {
                    authLib.removeMembers(groupKey, [userKey]);
                    log.debug(`User [${userKey}] removed from group [${groupKey}]`);
                } catch (e) {
                    log.warning(`Could not remove user [${userKey}] from group [${groupKey}]: ${e}`);
                }
            });
    }
};
