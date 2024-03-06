package com.enonic.app.oidcidprovider;

import java.math.BigInteger;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.Map;
import java.util.function.Supplier;

import com.auth0.jwt.JWT;
import com.auth0.jwt.algorithms.Algorithm;
import com.auth0.jwt.interfaces.DecodedJWT;
import com.fasterxml.jackson.databind.ObjectMapper;

import com.enonic.app.oidcidprovider.handler.IdProviderConfigService;
import com.enonic.app.oidcidprovider.jwt.RSAAlgorithmProvider;
import com.enonic.app.oidcidprovider.mapper.ClaimSetMapper;
import com.enonic.xp.script.bean.BeanContext;
import com.enonic.xp.script.bean.ScriptBean;

public class OIDCUtils
    implements ScriptBean
{
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private Supplier<IdProviderConfigService> idProviderConfigServiceSupplier;

    public String generateToken()
    {
        return new BigInteger( 130, SECURE_RANDOM ).toString( 32 );
    }

    public String generateVerifier()
    {
        final byte[] bytes = new byte[32];
        SECURE_RANDOM.nextBytes( bytes );
        return Base64.getUrlEncoder().withoutPadding().encodeToString( bytes );
    }

    public String generateChallenge( String verifier )
    {
        return Base64.getUrlEncoder()
            .withoutPadding()
            .encodeToString( sha256().digest( verifier.getBytes( StandardCharsets.ISO_8859_1 ) ) );
    }

    public MessageDigest sha256()
    {
        try
        {
            return MessageDigest.getInstance( "SHA-256" );
        }
        catch ( NoSuchAlgorithmException e )
        {
            throw new AssertionError( e );
        }
    }

    public ClaimSetMapper parseClaims( final String jwtToken, final String issuer, final String clientID, final String nonce,
                                       final String idProviderName )
        throws Exception
    {
        DecodedJWT decodedJWT = JWT.decode( jwtToken );

        RSAAlgorithmProvider rsaAlgorithmProvider = idProviderConfigServiceSupplier.get().getAlgorithmProvider( idProviderName );

        if ( rsaAlgorithmProvider != null )
        {
            Algorithm algorithm = rsaAlgorithmProvider.getAlgorithm( decodedJWT.getAlgorithm() );

            JWT.require( algorithm ).
                withIssuer( issuer ).
                withAudience( clientID ).
                withClaim( "nonce", nonce ).
                acceptLeeway( 1 ).   // 1 sec for nbf and iat
                build().
                verify( decodedJWT );
        }

        Map<String, Object> claims = MAPPER.readValue( Base64.getDecoder().decode( decodedJWT.getPayload() ), Map.class );

        return ClaimSetMapper.create().claimMap( claims ).build();
    }

    public String generateJwt( final Map<String, Object> message, final String clientSecret )
    {
        return JWT.create().withPayload( message ).sign( Algorithm.HMAC256( clientSecret ) );
    }

    @Override
    public void initialize( final BeanContext beanContext )
    {
        this.idProviderConfigServiceSupplier = beanContext.getService( IdProviderConfigService.class );
    }
}
