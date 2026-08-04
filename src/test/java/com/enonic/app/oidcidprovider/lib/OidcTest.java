package com.enonic.app.oidcidprovider.lib;

import org.junit.jupiter.api.Test;

import com.enonic.xp.testing.ScriptTestSupport;

public class OidcTest
    extends ScriptTestSupport
{
    private void run( final String function )
    {
        runFunction( "/lib/oidc-test.js", function );
    }

    @Test
    public void testBasicAuthEncodesCredentials()
    {
        run( "testBasicAuthEncodesCredentials" );
    }

    @Test
    public void testBasicAuthEncodesCredentialsAsUtf8()
    {
        run( "testBasicAuthEncodesCredentialsAsUtf8" );
    }
}
