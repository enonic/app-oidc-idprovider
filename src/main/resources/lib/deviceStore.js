const gridLib = require('/lib/xp/grid');

/**
 * Short-lived, cluster-shared store for pending device-authorization requests,
 * backed by the XP shared grid (lib-grid). Entries auto-expire via TTL, so there
 * is no cleanup job and no secret material left at rest. In-flight (not yet
 * completed) logins are lost on a full cluster restart - which is acceptable for
 * ephemeral pending state; issued tokens are stateless and unaffected.
 *
 * Two key spaces share one map:
 *   - device_code            -> the pending record
 *   - 'uc:' + user_code      -> the device_code (index for the verification page)
 */
function getMap(idProviderName) {
    return gridLib.getMap(`com.enonic.app.oidcidprovider.deviceauth.${idProviderName}`);
}

function createPending(idProviderName, params) {
    const map = getMap(idProviderName);
    const record = {
        status: 'pending',
        userCode: params.userCode,
        clientId: params.clientId || '',
        scope: params.scope || '',
        audience: params.audience || '',
        createdAt: Date.now(),
        lastPolledAt: 0,
    };
    map.set({key: params.deviceCode, value: record, ttlSeconds: params.ttlSeconds});
    map.set({key: `uc:${params.userCode}`, value: params.deviceCode, ttlSeconds: params.ttlSeconds});
}

function findByUserCode(idProviderName, userCode) {
    const map = getMap(idProviderName);
    const deviceCode = map.get(`uc:${userCode}`);
    if (!deviceCode) {
        return null;
    }
    const record = map.get(deviceCode);
    return record ? {deviceCode: deviceCode, record: record} : null;
}

/**
 * Atomically binds the resolved principal to the pending request and marks it
 * approved (or denied). Returns the updated record, or null if it no longer exists.
 */
function resolve(idProviderName, deviceCode, approved, principal, ttlSeconds) {
    const map = getMap(idProviderName);
    return map.modify({
        key: deviceCode,
        ttlSeconds: ttlSeconds,
        func: function (record) {
            if (!record) {
                return null;
            }
            if (record.status !== 'pending') {
                return record;
            }
            if (approved) {
                record.status = 'approved';
                record.sub = principal.sub;
            } else {
                record.status = 'denied';
            }
            return record;
        }
    });
}

/**
 * Atomically reads a pending record for polling, enforcing the minimum poll
 * interval and consuming the entry once it is approved (single-use).
 *
 * Returns one of:
 *   { state: 'pending' | 'denied' | 'expired' | 'slow_down' }
 *   { state: 'approved', record }
 */
function poll(idProviderName, deviceCode, intervalSeconds) {
    const map = getMap(idProviderName);
    let result = {state: 'expired'};
    map.modify({
        key: deviceCode,
        func: function (record) {
            if (!record) {
                result = {state: 'expired'};
                return null;
            }

            const now = Date.now();
            if (record.lastPolledAt && (now - record.lastPolledAt) < (intervalSeconds * 1000)) {
                result = {state: 'slow_down'};
                return record; // keep, do not advance
            }
            record.lastPolledAt = now;

            if (record.status === 'denied') {
                result = {state: 'denied'};
                return null; // consume
            }
            if (record.status === 'approved') {
                result = {state: 'approved', record: record};
                return null; // consume - single use
            }
            result = {state: 'pending'};
            return record;
        }
    });
    return result;
}

/**
 * Stores a one-time authorization code (RFC 8252 loopback flow) with its PKCE challenge and the
 * approved principal. Keyed separately from device codes in the same map.
 */
function createAuthCode(idProviderName, params) {
    getMap(idProviderName).set({
        key: `ac:${params.code}`,
        value: {
            challenge: params.challenge,
            redirectUri: params.redirectUri,
            sub: params.sub,
            clientId: params.clientId || '',
            scope: params.scope || '',
            audience: params.audience || '',
        },
        ttlSeconds: params.ttlSeconds,
    });
}

/**
 * Atomically reads and removes an authorization code (single use). Returns the record or null.
 */
function consumeAuthCode(idProviderName, code) {
    let record = null;
    getMap(idProviderName).modify({
        key: `ac:${code}`,
        func: function (value) {
            record = value || null;
            return null; // always remove
        }
    });
    return record;
}

exports.createPending = createPending;
exports.findByUserCode = findByUserCode;
exports.resolve = resolve;
exports.poll = poll;
exports.createAuthCode = createAuthCode;
exports.consumeAuthCode = consumeAuthCode;
