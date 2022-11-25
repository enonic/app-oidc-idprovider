package com.enonic.app.oidcidprovider.lib.configFile;

import com.enonic.xp.security.IdProviders;

import java.util.List;
import java.util.stream.Collectors;

public final class GetIdProvidersHandler
        extends AbstractIdProviderHandler
{
    public List<IdProviderMapper> getIdProviders()
    {
        final IdProviders idProviders = securityService.get().getIdProviders();
        return idProviders.stream().
                map( idProvider -> new IdProviderMapper( idProvider ) ).
                collect( Collectors.toList() );
    }
}
