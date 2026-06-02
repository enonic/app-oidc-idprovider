const test = require('/lib/xp/testing');
const testUtils = require('/testUtils');

const calls = {
    created: [],
    added: [],
    removed: [],
};
let existingGroups = {};
let memberships = [];

const defaultCreateGroup = (params) => {
    calls.created.push(params);
    const key = `group:${params.idProvider}:${params.name}`;
    existingGroups[key] = { key: key };
    return existingGroups[key];
};
const defaultAddMembers = (groupKey, members) => {
    calls.added.push({ group: groupKey, members: members });
};
const defaultRemoveMembers = (groupKey, members) => {
    calls.removed.push({ group: groupKey, members: members });
};

const setAuthMocks = testUtils.mockAndGetUpdaterFunc('/lib/xp/auth', {
    getPrincipal: (key) => existingGroups[key] || null,
    createGroup: defaultCreateGroup,
    addMembers: defaultAddMembers,
    removeMembers: defaultRemoveMembers,
    getMemberships: () => memberships.map(key => ({ key: key })),
});

function resetAuth(opts) {
    opts = opts || {};
    calls.created = [];
    calls.added = [];
    calls.removed = [];
    existingGroups = {};
    (opts.existing || []).forEach(key => { existingGroups[key] = { key: key }; });
    memberships = opts.memberships || [];
    setAuthMocks({
        getPrincipal: (key) => existingGroups[key] || null,
        createGroup: opts.createGroup || defaultCreateGroup,
        addMembers: opts.addMembers || defaultAddMembers,
        removeMembers: opts.removeMembers || defaultRemoveMembers,
        getMemberships: () => memberships.map(key => ({ key: key })),
    });
}

const groupSync = require('./groupSync');

function oktaConfig(extra) {
    const groups = {
        claim: 'groups',
        syncMode: 'add',
        createGroups: true,
        mapping: [
            { value: 'Admins', group: 'group:okta:admins' },
            { value: 'QA-Team', group: 'group:okta:qa' },
            { value: 'Developers', group: 'group:okta:devs' },
        ],
    };
    Object.keys(extra || {}).forEach(k => { groups[k] = extra[k]; });
    return { _idProviderName: 'okta', groups: groups };
}

//-------------------------------------------------------
// resolveGroupKeysFromClaims
//-------------------------------------------------------

exports.testResolve_disabledFeature_returnsEmpty = () => {
    const config = { _idProviderName: 'okta', groups: null };
    test.assertJsonEquals([], groupSync.resolveGroupKeysFromClaims(config, { userinfo: { groups: ['Admins'] } }));
};

exports.testResolve_missingPath_returnsEmpty = () => {
    test.assertJsonEquals([], groupSync.resolveGroupKeysFromClaims(oktaConfig(), { userinfo: { other: ['Admins'] } }));
};

exports.testResolve_topLevelArray_returnsMappedKeys = () => {
    const result = groupSync.resolveGroupKeysFromClaims(oktaConfig(), { userinfo: { groups: ['Admins', 'Developers'] } });
    test.assertJsonEquals(['group:okta:admins', 'group:okta:devs'], result);
};

exports.testResolve_singleString_treatedAsSingleton = () => {
    const result = groupSync.resolveGroupKeysFromClaims(oktaConfig(), { userinfo: { groups: 'Admins' } });
    test.assertJsonEquals(['group:okta:admins'], result);
};

exports.testResolve_nestedDottedPath = () => {
    const config = {
        _idProviderName: 'keycloak',
        groups: {
            claim: 'realm_access.roles',
            syncMode: 'add',
            createGroups: true,
            mapping: [{ value: 'admin', group: 'group:keycloak:admins' }],
        },
    };
    const result = groupSync.resolveGroupKeysFromClaims(config, { userinfo: { realm_access: { roles: ['admin', 'other'] } } });
    test.assertJsonEquals(['group:keycloak:admins'], result);
};

exports.testResolve_uriClaim_usedAsLiteralKey = () => {
    const config = {
        _idProviderName: 'auth0',
        groups: {
            claim: 'https://app.example.com/groups',
            syncMode: 'add',
            createGroups: true,
            mapping: [{ value: 'admins', group: 'group:auth0:admins' }],
        },
    };
    const result = groupSync.resolveGroupKeysFromClaims(config, { userinfo: { 'https://app.example.com/groups': ['admins'] } });
    test.assertJsonEquals(['group:auth0:admins'], result);
};

exports.testResolve_urnClaim_usedAsLiteralKey = () => {
    const config = {
        _idProviderName: 'auth0',
        groups: {
            claim: 'urn:example:groups',
            syncMode: 'add',
            createGroups: true,
            mapping: [{ value: 'admins', group: 'group:auth0:admins' }],
        },
    };
    const result = groupSync.resolveGroupKeysFromClaims(config, { userinfo: { 'urn:example:groups': ['admins'] } });
    test.assertJsonEquals(['group:auth0:admins'], result);
};

exports.testResolve_unmappedValues_dropped = () => {
    const result = groupSync.resolveGroupKeysFromClaims(oktaConfig(), { userinfo: { groups: ['Unknown', 'Admins'] } });
    test.assertJsonEquals(['group:okta:admins'], result);
};

exports.testResolve_deduplicates = () => {
    const result = groupSync.resolveGroupKeysFromClaims(oktaConfig(), { userinfo: { groups: ['Admins', 'Admins'] } });
    test.assertJsonEquals(['group:okta:admins'], result);
};

exports.testResolve_nonArrayObject_returnsEmpty = () => {
    // Entra overage indirection shape; should be silently ignored.
    const result = groupSync.resolveGroupKeysFromClaims(oktaConfig(), {
        userinfo: { groups: { _claim_names: { groups: 'src1' }, hasgroups: true } },
    });
    test.assertJsonEquals([], result);
};

//-------------------------------------------------------
// applyGroups
//-------------------------------------------------------

exports.testApply_addMode_addsMissingMemberships = () => {
    resetAuth({ existing: ['group:okta:admins', 'group:okta:devs'] });
    groupSync.applyGroups(oktaConfig(), 'user:okta:bob', ['group:okta:admins', 'group:okta:devs']);

    test.assertEquals(2, calls.added.length);
    test.assertEquals('group:okta:admins', calls.added[0].group);
    test.assertEquals('group:okta:devs', calls.added[1].group);
    test.assertEquals(0, calls.removed.length);
};

exports.testApply_addMode_neverRevokes = () => {
    resetAuth({
        existing: ['group:okta:admins', 'group:okta:qa'],
        memberships: ['group:okta:qa'],
    });
    // 'add' mode with desired=admins only; qa membership must remain untouched.
    groupSync.applyGroups(oktaConfig(), 'user:okta:bob', ['group:okta:admins']);
    test.assertEquals(0, calls.removed.length);
};

exports.testApply_syncMode_revokesMappedNotDesired = () => {
    resetAuth({
        existing: ['group:okta:admins', 'group:okta:qa'],
        memberships: ['group:okta:qa', 'group:okta:admins'],
    });
    groupSync.applyGroups(oktaConfig({ syncMode: 'sync' }), 'user:okta:bob', ['group:okta:admins']);

    test.assertEquals(1, calls.removed.length);
    test.assertEquals('group:okta:qa', calls.removed[0].group);
};

exports.testApply_syncMode_leavesNonMappedUntouched = () => {
    resetAuth({
        existing: ['group:okta:admins'],
        memberships: ['group:okta:admins', 'group:okta:manual', 'group:system:authenticated'],
    });
    groupSync.applyGroups(oktaConfig({ syncMode: 'sync' }), 'user:okta:bob', ['group:okta:admins']);

    // Only mapped-but-not-desired groups may be revoked; here all desired present, none mapped extra.
    test.assertEquals(0, calls.removed.length);
};

exports.testApply_createGroups_true_createsMissingGroup = () => {
    resetAuth({ existing: [] });
    groupSync.applyGroups(oktaConfig(), 'user:okta:bob', ['group:okta:admins']);

    test.assertEquals(1, calls.created.length);
    test.assertEquals('okta', calls.created[0].idProvider);
    test.assertEquals('admins', calls.created[0].name);
    test.assertEquals('admins', calls.created[0].displayName);
    test.assertEquals(1, calls.added.length);
};

exports.testApply_createGroups_false_skipsWithWarning = () => {
    resetAuth({ existing: [] });
    groupSync.applyGroups(oktaConfig({ createGroups: false }), 'user:okta:bob', ['group:okta:admins']);

    test.assertEquals(0, calls.created.length);
    test.assertEquals(0, calls.added.length);
    test.assertEquals(0, calls.removed.length);
};

exports.testApply_addMembersThrows_continuesOtherGroups = () => {
    resetAuth({
        existing: ['group:okta:admins', 'group:okta:devs'],
        addMembers: (groupKey, members) => {
            if (groupKey === 'group:okta:admins') {
                throw 'boom';
            }
            calls.added.push({ group: groupKey, members: members });
        },
    });
    groupSync.applyGroups(oktaConfig(), 'user:okta:bob', ['group:okta:admins', 'group:okta:devs']);

    // admins threw, devs still processed.
    test.assertEquals(1, calls.added.length);
    test.assertEquals('group:okta:devs', calls.added[0].group);
};

exports.testApply_createGroupThrows_continuesOtherGroups = () => {
    resetAuth({
        existing: ['group:okta:devs'],
        createGroup: (params) => {
            if (params.name === 'admins') {
                throw 'cannot create';
            }
            calls.created.push(params);
            return { key: `group:${params.idProvider}:${params.name}` };
        },
    });
    groupSync.applyGroups(oktaConfig(), 'user:okta:bob', ['group:okta:admins', 'group:okta:devs']);

    // admins create threw; devs already existed and was added.
    test.assertEquals(1, calls.added.length);
    test.assertEquals('group:okta:devs', calls.added[0].group);
};