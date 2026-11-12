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

// The rule is XP's; here the host of the test accepts 'accepted' and nothing else.
exports.testAudienceIsAskedOfTheVirtualHost = function () {
    test.assertTrue(accessTokenLib.isAudienceAccepted({aud: 'accepted'}));
    test.assertTrue(accessTokenLib.isAudienceAccepted({aud: ['other', 'accepted']}));
    test.assertFalse(accessTokenLib.isAudienceAccepted({aud: ['other']}));
    test.assertFalse(accessTokenLib.isAudienceAccepted({aud: 'other'}));
};

exports.testNoAudienceIsRefused = function () {
    test.assertFalse(accessTokenLib.isAudienceAccepted({aud: []}));
    test.assertFalse(accessTokenLib.isAudienceAccepted({}));
    test.assertFalse(accessTokenLib.isAudienceAccepted({aud: [42, null]}));
};
