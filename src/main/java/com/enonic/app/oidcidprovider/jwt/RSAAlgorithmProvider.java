package com.enonic.app.oidcidprovider.jwt;

import java.security.interfaces.RSAPrivateKey;
import java.security.interfaces.RSAPublicKey;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.auth0.jwk.JwkException;
import com.auth0.jwk.JwkProvider;
import com.auth0.jwt.algorithms.Algorithm;
import com.auth0.jwt.interfaces.RSAKeyProvider;

public class RSAAlgorithmProvider
{
    private final Logger log = LoggerFactory.getLogger( RSAAlgorithmProvider.class );

    private final RSAKeyProvider rsaKeyProvider;

    public RSAAlgorithmProvider( final JwkProvider jwkProvider )
    {
        this.rsaKeyProvider = new RSAKeyProviderMapper( jwkProvider );
    }

    public Algorithm getAlgorithm( final String algorithm )
        throws Exception
    {
        switch ( algorithm )
        {
            case "RS256":
                return Algorithm.RSA256( rsaKeyProvider );
            case "RS384":
                return Algorithm.RSA384( rsaKeyProvider );
            case "RS512":
                return Algorithm.RSA512( rsaKeyProvider );
            default:
                throw new Exception( "Invalid algorithm " + algorithm );
        }
    }

    private class RSAKeyProviderMapper
        implements RSAKeyProvider
    {
        private final JwkProvider jwkProvider;

        public RSAKeyProviderMapper( final JwkProvider jwkProvider )
        {
            this.jwkProvider = jwkProvider;
        }

        @Override
        public RSAPublicKey getPublicKeyById( final String keyId )
        {
            try
            {
                return (RSAPublicKey) jwkProvider.get( keyId ).getPublicKey();
            }
            catch ( JwkException e )
            {
                log.warn( "Unable to fetch JWT provider public key: {}", e.getMessage() );
                throw new IllegalArgumentException( e.getMessage(), e );
            }
        }

        @Override
        public RSAPrivateKey getPrivateKey()
        {
            throw new UnsupportedOperationException( "Should not be called" );
        }

        @Override
        public String getPrivateKeyId()
        {
            throw new UnsupportedOperationException( "Should not be called" );
        }
    }
}

