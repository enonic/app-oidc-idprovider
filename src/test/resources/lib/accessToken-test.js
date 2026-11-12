const test = require('/lib/xp/testing');
const accessTokenLib = require('/lib/accessToken');

exports.testFullClaims = function () {
    const accessToken = accessTokenLib.accessTokenFromClaims({
        iss: 'https://provider.example.com',
        sub: 'alice',
        aud: ['https://service.example.com/api', 'my-client'],
        azp: 'my-client',
        client_id: 'ignored-when-azp-is-set',
        scope: 'content:read  profile',
    });
    test.assertJsonEquals({
        issuer: 'https://provider.example.com',
        scope: ['content:read', 'profile'],
        audience: ['https://service.example.com/api', 'my-client'],
        clientId: 'my-client',
    }, accessToken);
};

exports.testIdTokenShape = function () {
    const accessToken = accessTokenLib.accessTokenFromClaims({
        iss: 'https://provider.example.com',
        sub: 'alice',
        aud: 'my-client',
        client_id: 'my-client',
    });
    test.assertJsonEquals({
        issuer: 'https://provider.example.com',
        scope: [],
        audience: ['my-client'],
        clientId: 'my-client',
    }, accessToken);
};

exports.testScpListAndNoClient = function () {
    const accessToken = accessTokenLib.accessTokenFromClaims({
        iss: 'https://provider.example.com',
        sub: 'alice',
        aud: ['api'],
        scp: ['content:read', '', 'content:write'],
    });
    test.assertJsonEquals({
        issuer: 'https://provider.example.com',
        scope: ['content:read', 'content:write'],
        audience: ['api'],
    }, accessToken);
};

exports.testBareClaims = function () {
    const accessToken = accessTokenLib.accessTokenFromClaims({iss: 'https://provider.example.com', sub: 'alice'});
    test.assertJsonEquals({issuer: 'https://provider.example.com', scope: [], audience: []}, accessToken);
};

exports.testAudienceDeclared = function () {
    const req = {idProviderSettings: {flows: ['autologin'], audience: ['https://service.example.com/api', 'my-client']}};
    test.assertTrue(accessTokenLib.isAudienceAccepted({aud: 'my-client'}, req));
    test.assertTrue(accessTokenLib.isAudienceAccepted({aud: ['other', 'https://service.example.com/api']}, req));
    test.assertFalse(accessTokenLib.isAudienceAccepted({aud: ['other']}, req));
    test.assertFalse(accessTokenLib.isAudienceAccepted({aud: []}, req));
    test.assertFalse(accessTokenLib.isAudienceAccepted({}, req));
};

exports.testAudienceOnAHostDeclaringNone = function () {
    test.assertFalse(accessTokenLib.isAudienceAccepted({aud: 'my-client'}, {idProviderSettings: {flows: [], audience: []}}));
    test.assertFalse(accessTokenLib.isAudienceAccepted({aud: 'my-client'}, {}));
};

// XP hands over the audiences the host declares and the host's own URL
exports.testAudienceIsTheEndpointTheClientCalls = function () {
    const settings = {flows: ['autologin'], audience: ['https://api.example.com']};
    const at = (url) => ({url: url, idProviderSettings: settings});
    const endpoint = {aud: ['https://api.example.com/api/mcp', 'https://tenant.auth0.com/userinfo']};

    test.assertTrue(accessTokenLib.isAudienceAccepted(endpoint, at('https://api.example.com/api/mcp')));
    test.assertTrue(accessTokenLib.isAudienceAccepted(endpoint, at('https://api.example.com/api/mcp/tools?x=1')));
    test.assertTrue(accessTokenLib.isAudienceAccepted({aud: 'https://api.example.com/api/'}, at('https://api.example.com/api/mcp')));

    // the request is not at or below what the token is for
    test.assertFalse(accessTokenLib.isAudienceAccepted(endpoint, at('https://api.example.com/api/other')));
    test.assertFalse(accessTokenLib.isAudienceAccepted(endpoint, at('https://api.example.com/api/mcp-admin')));
    test.assertFalse(accessTokenLib.isAudienceAccepted(endpoint, at('https://api.example.com/api')));
    // the token is for another host, or for a name that only begins like this one
    test.assertFalse(accessTokenLib.isAudienceAccepted({aud: 'https://other.example.com/api/mcp'}, at('https://other.example.com/api/mcp')));
    test.assertFalse(accessTokenLib.isAudienceAccepted({aud: 'https://api.example.com.evil.test/x'}, at('https://api.example.com/x')));
    // the request URL is unknown
    test.assertFalse(accessTokenLib.isAudienceAccepted(endpoint, {idProviderSettings: settings}));
};
