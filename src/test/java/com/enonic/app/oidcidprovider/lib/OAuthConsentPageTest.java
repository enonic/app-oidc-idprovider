package com.enonic.app.oidcidprovider.lib;

import org.junit.jupiter.api.Test;

import com.enonic.xp.testing.ScriptTestSupport;

public class OAuthConsentPageTest
    extends ScriptTestSupport
{
    @Test
    public void testConfirm_deviceFlow_showsAndPostsTheCode()
    {
        runFunction( "/lib/oauthConsentPage-test.js", "testConfirm_deviceFlow_showsAndPostsTheCode" );
    }

    @Test
    public void testConfirm_codeFlow_postsTheRequestAndNamesTheClient()
    {
        runFunction( "/lib/oauthConsentPage-test.js", "testConfirm_codeFlow_postsTheRequestAndNamesTheClient" );
    }

    @Test
    public void testConfirm_codeFlow_allowsTheClientsOriginOnly()
    {
        runFunction( "/lib/oauthConsentPage-test.js", "testConfirm_codeFlow_allowsTheClientsOriginOnly" );
    }

    @Test
    public void testConfirm_scriptRunsByTheBuildersNonce()
    {
        runFunction( "/lib/oauthConsentPage-test.js", "testConfirm_scriptRunsByTheBuildersNonce" );
    }
}
