package com.enonic.app.oidcidprovider.lib;

import org.junit.jupiter.api.Test;

import com.enonic.xp.testing.ScriptTestSupport;

public class GroupSyncTest
    extends ScriptTestSupport
{
    private void run( final String function )
    {
        runFunction( "/lib/groupSync-test.js", function );
    }

    @Test
    public void testResolve_disabledFeature_returnsEmpty()
    {
        run( "testResolve_disabledFeature_returnsEmpty" );
    }

    @Test
    public void testResolve_missingPath_returnsEmpty()
    {
        run( "testResolve_missingPath_returnsEmpty" );
    }

    @Test
    public void testResolve_topLevelArray_returnsMappedKeys()
    {
        run( "testResolve_topLevelArray_returnsMappedKeys" );
    }

    @Test
    public void testResolve_singleString_treatedAsSingleton()
    {
        run( "testResolve_singleString_treatedAsSingleton" );
    }

    @Test
    public void testResolve_nestedDottedPath()
    {
        run( "testResolve_nestedDottedPath" );
    }

    @Test
    public void testResolve_uriClaim_usedAsLiteralKey()
    {
        run( "testResolve_uriClaim_usedAsLiteralKey" );
    }

    @Test
    public void testResolve_urnClaim_usedAsLiteralKey()
    {
        run( "testResolve_urnClaim_usedAsLiteralKey" );
    }

    @Test
    public void testResolve_unmappedValues_dropped()
    {
        run( "testResolve_unmappedValues_dropped" );
    }

    @Test
    public void testResolve_deduplicates()
    {
        run( "testResolve_deduplicates" );
    }

    @Test
    public void testResolve_nonArrayObject_returnsEmpty()
    {
        run( "testResolve_nonArrayObject_returnsEmpty" );
    }

    @Test
    public void testApply_addMode_addsMissingMemberships()
    {
        run( "testApply_addMode_addsMissingMemberships" );
    }

    @Test
    public void testApply_addMode_neverRevokes()
    {
        run( "testApply_addMode_neverRevokes" );
    }

    @Test
    public void testApply_syncMode_revokesMappedNotDesired()
    {
        run( "testApply_syncMode_revokesMappedNotDesired" );
    }

    @Test
    public void testApply_syncMode_leavesNonMappedUntouched()
    {
        run( "testApply_syncMode_leavesNonMappedUntouched" );
    }

    @Test
    public void testApply_missingGroup_skipsWithWarning()
    {
        run( "testApply_missingGroup_skipsWithWarning" );
    }

    @Test
    public void testApply_addMembersThrows_continuesOtherGroups()
    {
        run( "testApply_addMembersThrows_continuesOtherGroups" );
    }

    @Test
    public void testEnsure_createsMissingMappedGroups()
    {
        run( "testEnsure_createsMissingMappedGroups" );
    }

    @Test
    public void testEnsure_idempotent_skipsExisting()
    {
        run( "testEnsure_idempotent_skipsExisting" );
    }

    @Test
    public void testEnsure_deduplicatesMappedGroups()
    {
        run( "testEnsure_deduplicatesMappedGroups" );
    }

    @Test
    public void testEnsure_nullGroups_noop()
    {
        run( "testEnsure_nullGroups_noop" );
    }

    @Test
    public void testEnsure_createThrows_continuesOtherGroups()
    {
        run( "testEnsure_createThrows_continuesOtherGroups" );
    }
}