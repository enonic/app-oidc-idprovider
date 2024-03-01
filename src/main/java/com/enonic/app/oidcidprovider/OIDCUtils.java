package com.enonic.app.oidcidprovider;

import java.math.BigInteger;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.text.ParseException;
import java.util.Base64;
import java.util.Map;

import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.JWSObject;
import com.nimbusds.jose.JWSSigner;
import com.nimbusds.jose.Payload;
import com.nimbusds.jose.crypto.MACSigner;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.JWTParser;
import com.nimbusds.jwt.proc.BadJWTException;
import com.nimbusds.oauth2.sdk.id.ClientID;
import com.nimbusds.oauth2.sdk.id.Issuer;
import com.nimbusds.openid.connect.sdk.Nonce;
import com.nimbusds.openid.connect.sdk.validators.IDTokenClaimsVerifier;

import com.enonic.app.oidcidprovider.mapper.ClaimSetMapper;

public class OIDCUtils
{
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    public static String generateToken()
    {
        return new BigInteger( 130, SECURE_RANDOM ).toString( 32 );
    }

    public static String generateVerifier()
    {
        final byte[] bytes = new byte[32];
        SECURE_RANDOM.nextBytes( bytes );
        return Base64.getUrlEncoder().withoutPadding().encodeToString( bytes );
    }

    public static String generateChallenge( String verifier )
    {
        return Base64.getUrlEncoder()
            .withoutPadding()
            .encodeToString( sha256().digest( verifier.getBytes( StandardCharsets.ISO_8859_1 ) ) );
    }

    public static MessageDigest sha256()
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

    public static ClaimSetMapper parseClaims( final String s, final String issuer, final String clientID, final String nonce )
        throws ParseException, BadJWTException
    {
        final JWTClaimsSet jwtClaimsSet = JWTParser.parse( s ).getJWTClaimsSet();

        final IDTokenClaimsVerifier verifier =
            new IDTokenClaimsVerifier( new Issuer( issuer ), new ClientID( clientID ), new Nonce( nonce ), 0 );
        verifier.verify( jwtClaimsSet, null );

        return ClaimSetMapper.create().claimSet( jwtClaimsSet ).build();
    }

    public static String generateJwt( final Map message, final String clientSecret )
        throws Exception
    {
        final JWSSigner signer = new MACSigner( clientSecret );
        final JWSObject jwsObject = new JWSObject( new JWSHeader( JWSAlgorithm.HS256 ), new Payload( message ) );

        jwsObject.sign( signer );

        return jwsObject.serialize();
    }
}
