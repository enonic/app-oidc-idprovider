const test = require('/lib/xp/testing');
const testUtils = require('/testUtils');

const calls = [];
const state = {scopes: [], clients: []};

const setAuthMocks = testUtils.mockAndGetUpdaterFunc('/lib/xp/auth', {
    getScopes: () => state.scopes,
    createScope: (params) => { calls.push(['createScope', params]); return params; },
    modifyScope: (params) => { calls.push(['modifyScope', params]); return params; },
    getClients: () => state.clients,
    createClient: (params) => { calls.push(['createClient', params]); return params; },
    modifyClient: (params) => { calls.push(['modifyClient', params]); return params; },
});

const lib = require('/lib/consentRegistry');

function reset() {
    calls.length = 0;
    state.scopes = [];
    state.clients = [];
    setAuthMocks({});
}

const CONFIG = {
    _idProviderName: 'myidp',
    consent: {
        scopes: [
            {id: 'content:read', title: 'Read content', description: null, roles: ['role:cms.project.site.viewer'], required: false},
            {id: 'profile', title: null, description: 'Who you are', roles: [], required: true},
        ],
        clients: [
            {
                id: 'claude', displayName: 'Claude', uri: 'https://claude.ai', logoUri: null, policyUri: null, tosUri: null,
                grantTypes: ['authorization_code', 'refresh_token'], redirectUris: ['https://claude.ai/api/mcp/auth_callback'],
                scope: ['content:read'], resource: [], grantTtl: 'P30D', enabled: true,
            },
        ],
    },
};

exports.testSupply_createsWhatIsMissing = () => {
    reset();

    lib.supply(CONFIG);

    test.assertEquals(3, calls.length);
    test.assertEquals('createScope', calls[0][0]);
    test.assertJsonEquals({
        idProvider: 'myidp', id: 'content:read', title: 'Read content', roles: ['role:cms.project.site.viewer'], required: false,
    }, calls[0][1]);
    test.assertEquals('createScope', calls[1][0]);
    test.assertJsonEquals({idProvider: 'myidp', id: 'profile', description: 'Who you are', roles: [], required: true}, calls[1][1]);
    test.assertEquals('createClient', calls[2][0]);
    test.assertJsonEquals({
        idProvider: 'myidp', id: 'claude', displayName: 'Claude', uri: 'https://claude.ai',
        grantTypes: ['authorization_code', 'refresh_token'], redirectUris: ['https://claude.ai/api/mcp/auth_callback'],
        scope: ['content:read'], resource: [], grantTtl: 'P30D', enabled: true,
    }, calls[2][1]);
};

exports.testSupply_bringsWhatExistsUpToDate = () => {
    reset();
    state.scopes = [{id: 'profile'}];
    state.clients = [{id: 'claude'}];

    lib.supply(CONFIG);

    test.assertEquals(3, calls.length);
    test.assertEquals('createScope', calls[0][0]);
    test.assertEquals('content:read', calls[0][1].id);
    test.assertEquals('modifyScope', calls[1][0]);
    test.assertJsonEquals({
        idProvider: 'myidp', id: 'profile', title: null, description: 'Who you are', roles: [], required: true,
    }, calls[1][1]);
    test.assertEquals('modifyClient', calls[2][0]);
    test.assertEquals('Claude', calls[2][1].displayName);
    test.assertEquals(null, calls[2][1].logoUri, 'a link no longer declared is cleared');
};

exports.testSupply_anIdNamedLikeAnObjectProperty_isCreated = () => {
    reset();

    lib.supply({
        _idProviderName: 'myidp',
        consent: {
            scopes: [{id: 'constructor', title: null, description: null, roles: [], required: false}],
            clients: [{
                id: 'toString', displayName: null, uri: null, logoUri: null, policyUri: null, tosUri: null,
                grantTypes: ['authorization_code'], redirectUris: [], scope: [], resource: [], grantTtl: null, enabled: true,
            }],
        },
    });

    test.assertEquals(2, calls.length);
    test.assertEquals('createScope', calls[0][0]);
    test.assertEquals('createClient', calls[1][0]);
};

exports.testSupply_nothingDeclared_touchesNothing = () => {
    reset();

    lib.supply({_idProviderName: 'myidp', consent: {scopes: [], clients: []}});
    lib.supply({_idProviderName: 'myidp'});

    test.assertEquals(0, calls.length);
};
