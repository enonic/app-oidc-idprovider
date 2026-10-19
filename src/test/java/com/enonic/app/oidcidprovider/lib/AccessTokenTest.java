package com.enonic.app.oidcidprovider.lib;

import org.junit.jupiter.api.Test;

import com.enonic.xp.testing.ScriptTestSupport;

public class AccessTokenTest
    extends ScriptTestSupport
{
    private void run( final String function )
    {
        runFunction( "/lib/accessToken-test.js", function );
    }

    @Test
    public void testFullClaims()
    {
        run( "testFullClaims" );
    }

    @Test
    public void testIdTokenShape()
    {
        run( "testIdTokenShape" );
    }

    @Test
    public void testScpListAndNoClient()
    {
        run( "testScpListAndNoClient" );
    }

    @Test
    public void testAudienceDeclared()
    {
        run( "testAudienceDeclared" );
    }

    @Test
    public void testAudienceOnAHostDeclaringNone()
    {
        run( "testAudienceOnAHostDeclaringNone" );
    }

    @Test
    public void testBareClaims()
    {
        run( "testBareClaims" );
    }
}
