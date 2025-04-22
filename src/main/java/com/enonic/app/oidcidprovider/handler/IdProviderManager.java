package com.enonic.app.oidcidprovider.handler;

import java.io.UncheckedIOException;
import java.net.MalformedURLException;
import java.net.URI;
import java.net.URL;
import java.util.Map;
import java.util.Objects;

import com.auth0.jwk.JwkProvider;
import com.auth0.jwk.JwkProviderBuilder;

import com.enonic.app.oidcidprovider.jwt.RSAAlgorithmProvider;

public class IdProviderManager
{
    private static final int TIMEOUT_MS = 5000;

    private final Map<String, Object> idProviderConfig;

    private final RSAAlgorithmProvider algorithmProvider;

    public IdProviderManager( final Map<String, Object> idProviderConfig )
    {
        this.idProviderConfig = Objects.requireNonNull( idProviderConfig, "idProviderConfig must be set" );
        this.algorithmProvider = resolveAlgorithmProvider();
    }

    public Map<String, Object> getIdProviderConfig()
    {
        return idProviderConfig;
    }

    public RSAAlgorithmProvider getAlgorithmProvider()
    {
        return algorithmProvider;
    }

    private RSAAlgorithmProvider resolveAlgorithmProvider()
    {
            final JwkProvider jwkProvider = getJwkProvider();
            return jwkProvider != null ? new RSAAlgorithmProvider( jwkProvider ) : null;
    }

    private JwkProvider getJwkProvider()
    {
        final String jwksUri = Objects.toString( idProviderConfig.get( "jwksUri" ), null );
        if ( jwksUri == null )
        {
            return null;
        }
        final URL url;
        try
        {
            url = URI.create( jwksUri ).toURL();
        }
        catch ( MalformedURLException e )
        {
            throw new UncheckedIOException( e );
        }
        return new JwkProviderBuilder( url ).cached( true ).timeouts( TIMEOUT_MS, TIMEOUT_MS ).build();
    }
}
