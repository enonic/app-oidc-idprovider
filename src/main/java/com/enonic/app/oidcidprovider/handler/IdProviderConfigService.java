package com.enonic.app.oidcidprovider.handler;

import java.util.Map;

import org.osgi.service.component.annotations.Activate;
import org.osgi.service.component.annotations.Component;

import com.google.common.cache.Cache;
import com.google.common.cache.CacheBuilder;

import com.enonic.app.oidcidprovider.jwt.RSAAlgorithmProvider;

@Component(immediate = true, service = IdProviderConfigService.class, configurationPid = "com.enonic.app.oidcidprovider")
public class IdProviderConfigService
{
    private static final Cache<String, IdProviderManager> CACHE = CacheBuilder.newBuilder().build();

    @Activate
    public void activate()
    {
        CACHE.invalidateAll();
    }

    public void storeConfig( final String key, final Map<String, Object> config )
    {
        final IdProviderManager idProviderManager = new IdProviderManager( config );
        CACHE.put( key, idProviderManager );
    }

    public Map<String, Object> getConfig( final String key )
    {
        final IdProviderManager idProviderManager = CACHE.getIfPresent( key );
        return idProviderManager != null ? idProviderManager.getIdProviderConfig() : null;
    }

    public RSAAlgorithmProvider getAlgorithmProvider( final String key )
    {
        final IdProviderManager idProviderManager = CACHE.getIfPresent( key );
        return idProviderManager != null ? idProviderManager.getAlgorithmProvider() : null;
    }
}
