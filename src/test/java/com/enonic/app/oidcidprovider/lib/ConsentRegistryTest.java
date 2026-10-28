package com.enonic.app.oidcidprovider.lib;

import org.junit.jupiter.api.Test;

import com.enonic.xp.testing.ScriptTestSupport;

public class ConsentRegistryTest
    extends ScriptTestSupport
{
    private void run( final String function )
    {
        runFunction( "/lib/consentRegistry-test.js", function );
    }

    @Test
    public void testSupply_createsWhatIsMissing()
    {
        run( "testSupply_createsWhatIsMissing" );
    }

    @Test
    public void testSupply_bringsWhatExistsUpToDate()
    {
        run( "testSupply_bringsWhatExistsUpToDate" );
    }

    @Test
    public void testSupply_anIdNamedLikeAnObjectProperty_isCreated()
    {
        run( "testSupply_anIdNamedLikeAnObjectProperty_isCreated" );
    }

    @Test
    public void testSupply_nothingDeclared_touchesNothing()
    {
        run( "testSupply_nothingDeclared_touchesNothing" );
    }
}
