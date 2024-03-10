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
import com.auth0.jwt.JWTVerifier;
import com.auth0.jwt.algorithms.Algorithm;
import com.auth0.jwt.interfaces.DecodedJWT;
import com.auth0.jwt.interfaces.Verification;
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

    public ClaimSetMapper parseClaims( final String idToken, final String issuer, final String clientID, final String nonce,
                                       final String idProviderName )
        throws Exception
    {
        final DecodedJWT decodedJWT = JWT.decode( idToken );

        final RSAAlgorithmProvider rsaAlgorithmProvider = idProviderConfigServiceSupplier.get().getAlgorithmProvider( idProviderName );

        final Verification verification;
        if ( rsaAlgorithmProvider != null )
        {
            // We only support RS256, RS384 and RS512 algorithms
            final Algorithm algorithm = rsaAlgorithmProvider.getAlgorithm( decodedJWT.getAlgorithm() );
            verification = JWT.require( algorithm );
        }
        else
        {
            // We don't have access to Public Key, so we can't verify the signature
            // But, according to OIDC Specification https://openid.net/specs/openid-connect-core-1_0.html#IDTokenValidation
            // TLS server validation MAY be used to validate the issuer in place of checking the token signature
            // auth0.jwt library requires algorithm to be set, so we use none() algorithm as a workaround - to verify claims only
            verification = JWT.require( Algorithm.none() );
        }

        final JWTVerifier verifier = verification.withIssuer( issuer )
            .withAudience( clientID )
            .withClaim( "nonce", nonce )
            .acceptLeeway( 1 ) // 1 sec for nbf and iat
            .build();

        final String decodedPayload = new String( Base64.getDecoder().decode( decodedJWT.getPayload() ), StandardCharsets.UTF_8 );

        if ( rsaAlgorithmProvider != null )
        {
            verifier.verify( decodedJWT );
        }
        else
        {
            verifier.verify( JWT.create().withPayload( decodedPayload ).sign( Algorithm.none() ) );
        }

        Map<String, Object> claims = MAPPER.readValue( decodedPayload, Map.class );

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
