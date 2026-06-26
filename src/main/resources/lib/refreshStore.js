const authLib = require('/lib/xp/auth');
const contextLib = require('/lib/context');
const oidcLib = require('/lib/oidc');

const HANDLER_BEAN = 'com.enonic.app.oidcidprovider.handler.DeviceTokenHandler';
const PROFILE_SCOPE = 'deviceauth';

const REFRESH_TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 days
const ROTATE_INTERVAL_MS = 54 * 60 * 1000; // 54 min
const MAX_TOKENS_PER_CLIENT = 50;
const UNKNOWN_BUCKET = '<unknown>';

function bean() {
    return __.newBean(HANDLER_BEAN);
}

function hashToken(rawToken) {
    return oidcLib.generateChallenge(rawToken); // SHA-256, base64url
}

function mintToken(userKey) {
    return bean().generateDeviceCode() + '.' + bean().base64UrlEncode(userKey);
}

function subjectOf(rawToken) {
    const i = rawToken.indexOf('.');
    if (i <= 0) {
        return null;
    }
    try {
        return bean().base64UrlDecode(rawToken.substring(i + 1));
    } catch (e) {
        return null;
    }
}

function toArray(value) {
    if (value == null) {
        return [];
    }
    return Array.isArray(value) ? value : [value];
}

function readTokens(userKey) {
    const profile = contextLib.runAsSu(() => authLib.getProfile({key: userKey, scope: PROFILE_SCOPE}));
    return toArray(profile && profile.tokens);
}

function writeTokens(userKey, editor) {
    contextLib.runAsSu(() => authLib.modifyProfile({
        key: userKey,
        scope: PROFILE_SCOPE,
        editor: function (profile) {
            return {tokens: editor(toArray(profile && profile.tokens))};
        },
    }));
}

function grantOf(entry, userKey, refreshToken) {
    return {
        sub: userKey,
        clientId: entry.clientId,
        scope: entry.scope,
        audience: entry.audience,
        refreshToken: refreshToken,
    };
}

function newEntry(userKey, now, clientId, scope, audience, family, parent) {
    const rawToken = mintToken(userKey);
    return {
        rawToken: rawToken,
        entry: {
            hash: hashToken(rawToken),
            parent: parent || null,
            family: family || bean().generateDeviceCode(),
            clientId: clientId || '',
            scope: scope || '',
            audience: audience || '',
            createdAt: now,
            expiresAt: now + REFRESH_TOKEN_TTL_MS,
            rotateAfter: now + ROTATE_INTERVAL_MS,
        },
    };
}

function isKnownClient(clientId) {
    return false;
}

function bucketOf(clientId) {
    return isKnownClient(clientId) ? clientId : UNKNOWN_BUCKET;
}

function issue(params) {
    const now = Date.now();
    const created = newEntry(params.sub, now, params.clientId, params.scope, params.audience, null, null);
    const bucket = bucketOf(created.entry.clientId);
    const byAge = (a, b) => a.createdAt - b.createdAt;
    writeTokens(params.sub, tokens => {
        const active = tokens.filter(t => t.expiresAt > now);
        const others = active.filter(t => bucketOf(t.clientId) !== bucket);
        const sameBucket = active.filter(t => bucketOf(t.clientId) === bucket).sort(byAge);
        const keptSame = sameBucket.slice(Math.max(0, sameBucket.length - (MAX_TOKENS_PER_CLIENT - 1)));
        return others.concat(keptSame, created.entry);
    });
    return created.rawToken;
}

function redeem(idProvider, rawToken) {
    const userKey = subjectOf(rawToken);
    if (!userKey || userKey.split(':')[1] !== idProvider) {
        return null;
    }
    const h = hashToken(rawToken);
    const now = Date.now();

    const peek = readTokens(userKey).filter(t => t.hash === h)[0];
    if (!peek || peek.expiresAt <= now) {
        return null;
    }
    if (now < peek.rotateAfter) {
        return grantOf(peek, userKey, rawToken);
    }

    let out = null;
    writeTokens(userKey, tokens => {
        const kept = tokens.filter(t => t.expiresAt > now);
        const entry = kept.filter(t => t.hash === h)[0];
        if (!entry) {
            return kept;
        }
        const rotated = newEntry(userKey, now, entry.clientId, entry.scope, entry.audience, entry.family, entry.hash);
        out = grantOf(entry, userKey, rotated.rawToken);
        return kept.filter(t => t.hash !== entry.hash).concat(rotated.entry);
    });
    return out;
}

function listBySubject(userKey) {
    const now = Date.now();
    return readTokens(userKey).filter(t => t.expiresAt > now).map(t => ({
        family: t.family,
        clientId: t.clientId,
        scope: t.scope,
        createdAt: t.createdAt,
        expiresAt: t.expiresAt,
    }));
}

function revokeFamily(userKey, family) {
    writeTokens(userKey, tokens => tokens.filter(t => t.family !== family));
}

exports.issue = issue;
exports.redeem = redeem;
exports.listBySubject = listBySubject;
exports.revokeFamily = revokeFamily;
