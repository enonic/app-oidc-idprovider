package com.enonic.app.oidcidprovider.handler;

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

    private RSAAlgorithmProvider algorithmProvider;

    public IdProviderManager( final Map<String, Object> idProviderConfig )
    {
        this.idProviderConfig = Objects.requireNonNull( idProviderConfig, "idProviderConfig must be set" );

        initAlgorithmProvider();
    }

    public Map<String, Object> getIdProviderConfig()
    {
        return idProviderConfig;
    }

    public RSAAlgorithmProvider getAlgorithmProvider()
    {
        return algorithmProvider;
    }

    private void initAlgorithmProvider()
    {
        try
        {
            final JwkProvider jwkProvider = getJwkProvider();
            if ( jwkProvider != null )
            {
                this.algorithmProvider = new RSAAlgorithmProvider( getJwkProvider() );
            }
        }
        catch ( Exception e )
        {
            throw new RuntimeException( e );
        }
    }

    private JwkProvider getJwkProvider()
        throws Exception
    {
        final String jwksUri = Objects.toString( idProviderConfig.get( "jwksUri" ), null );
        if ( jwksUri == null )
        {
            return null;
        }

        return new JwkProviderBuilder( new URL( jwksUri ) ).cached( true ).timeouts( TIMEOUT_MS, TIMEOUT_MS ).build();
    }
}
