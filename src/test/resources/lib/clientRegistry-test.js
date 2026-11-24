const test = require('/lib/xp/testing');
const testUtils = require('/testUtils');

const calls = [];
const state = {clients: []};

const setAuthMocks = testUtils.mockAndGetUpdaterFunc('/lib/xp/auth', {
    getClients: () => state.clients,
    createClient: (params) => { calls.push(['createClient', params]); return params; },
    modifyClient: (params) => { calls.push(['modifyClient', params]); return params; },
});

const lib = require('/lib/clientRegistry');

function reset() {
    calls.length = 0;
    state.clients = [];
    setAuthMocks({});
}

const CONFIG = {
    _idProviderName: 'myidp',
    clients: [
        {
            id: 'claude', displayName: 'Claude', uri: 'https://claude.ai', logoUri: null, policyUri: null, tosUri: null,
            grantTypes: ['authorization_code', 'refresh_token'], redirectUris: ['https://claude.ai/api/mcp/auth_callback'],
            scope: ['com.example.app:orders:read'], resource: [], grantTtl: 'P30D', enabled: true,
        },
    ],
};

exports.testSupply_createsWhatIsMissing = () => {
    reset();

    lib.supply(CONFIG);

    test.assertEquals(1, calls.length);
    test.assertEquals('createClient', calls[0][0]);
    test.assertJsonEquals({
        idProvider: 'myidp', id: 'claude', displayName: 'Claude', uri: 'https://claude.ai',
        grantTypes: ['authorization_code', 'refresh_token'], redirectUris: ['https://claude.ai/api/mcp/auth_callback'],
        scope: ['com.example.app:orders:read'], resource: [], grantTtl: 'P30D', enabled: true,
    }, calls[0][1]);
};

exports.testSupply_bringsWhatExistsUpToDate = () => {
    reset();
    state.clients = [{id: 'claude'}];

    lib.supply(CONFIG);

    test.assertEquals(1, calls.length);
    test.assertEquals('modifyClient', calls[0][0]);
    test.assertEquals('Claude', calls[0][1].displayName);
    test.assertEquals(null, calls[0][1].logoUri, 'a link no longer declared is cleared');
};

exports.testSupply_anIdNamedLikeAnObjectProperty_isCreated = () => {
    reset();

    lib.supply({
        _idProviderName: 'myidp',
        clients: [{
            id: 'toString', displayName: null, uri: null, logoUri: null, policyUri: null, tosUri: null,
            grantTypes: ['authorization_code'], redirectUris: [], scope: [], resource: [], grantTtl: null, enabled: true,
        }],
    });

    test.assertEquals(1, calls.length);
    test.assertEquals('createClient', calls[0][0]);
};

exports.testSupply_nothingDeclared_touchesNothing = () => {
    reset();

    lib.supply({_idProviderName: 'myidp', clients: []});
    lib.supply({_idProviderName: 'myidp'});

    test.assertEquals(0, calls.length);
};
