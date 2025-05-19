package com.enonic.app.oidcidprovider.lib.configFile;


import com.enonic.xp.script.ScriptValue;
import com.enonic.xp.security.CreateIdProviderParams;
import com.enonic.xp.security.IdProvider;
import com.enonic.xp.security.IdProviderKey;
import com.enonic.xp.security.acl.IdProviderAccessControlList;

public final class CreateIdProviderHandler
        extends AbstractIdProviderHandler
{
    private String name;

    private String displayName;

    private String description;

    private IdProviderAccessControlList permissions;

    public void setName( final String name )
    {
        this.name = name;
    }

    public void setDisplayName( final String displayName )
    {
        this.displayName = displayName;
    }

    public void setDescription( final String description )
    {
        this.description = description;
    }

    public void setPermissions( final ScriptValue permissions )
    {
        this.permissions = permissions == null
                ? null : ScriptValueToIdProviderAccessControlListTranslator.translate( permissions, this::isPrincipalExists );
    }

    public IdProviderMapper createIdProvider()
    {
        final String displayName = this.displayName == null ? this.name : this.displayName;
        final CreateIdProviderParams params = CreateIdProviderParams.create().
                key( IdProviderKey.from( name ) ).
                displayName( displayName ).
                description( description ).
                permissions( permissions ).
                build();
        final IdProvider idProvider = securityService.get().createIdProvider( params );
        return idProvider == null ? null : new IdProviderMapper( idProvider );
    }
}
