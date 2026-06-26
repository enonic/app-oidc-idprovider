const gridLib = require('/lib/xp/grid');

const SIGNING_KEY = 'signingKey';

function getMap(idProviderName) {
    return gridLib.getMap(`com.enonic.app.oidcidprovider.deviceauth.${idProviderName}`);
}

function withUpdates(record, updates) {
    const next = {
        status: record.status,
        userCode: record.userCode,
        clientId: record.clientId,
        scope: record.scope,
        audience: record.audience,
        sub: record.sub,
        createdAt: record.createdAt,
        lastPolledAt: record.lastPolledAt,
    };
    Object.keys(updates).forEach(function (key) {
        next[key] = updates[key];
    });
    return next;
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
                return withUpdates(record, {});
            }
            return approved
                ? withUpdates(record, {status: 'approved', sub: principal.sub})
                : withUpdates(record, {status: 'denied'});
        }
    });
}

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

            // A resolved request is reported immediately; the rate-limit only throttles pending polls.
            if (record.status === 'denied') {
                result = {state: 'denied'};
                return null;
            }
            if (record.status === 'approved') {
                result = {state: 'approved', record: record};
                return null;
            }

            const now = Date.now();
            if (record.lastPolledAt && (now - record.lastPolledAt) < (intervalSeconds * 1000)) {
                result = {state: 'slow_down'};
                return withUpdates(record, {});
            }
            result = {state: 'pending'};
            return withUpdates(record, {lastPolledAt: now});
        }
    });
    return result;
}

function getOrCreateSigningKey(idProviderName, generate) {
    return getMap(idProviderName).modify({
        key: SIGNING_KEY,
        ttlSeconds: 0,
        func: function (existing) {
            return existing ? {secret: existing.secret, kid: existing.kid} : generate();
        }
    });
}

exports.createPending = createPending;
exports.findByUserCode = findByUserCode;
exports.resolve = resolve;
exports.poll = poll;
exports.getOrCreateSigningKey = getOrCreateSigningKey;
