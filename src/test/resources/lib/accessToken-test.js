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
