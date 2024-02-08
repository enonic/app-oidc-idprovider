package com.enonic.app.oidcidprovider;

import java.math.BigInteger;
import java.security.SecureRandom;
import java.text.ParseException;
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
    public static String generateToken()
    {
        return new BigInteger( 130, new SecureRandom() ).toString( 32 );
    }

    public static ClaimSetMapper parseClaims( final String s, final String issuer, final String clientID, final String nonce )
        throws ParseException, BadJWTException
    {
        final JWTClaimsSet jwtClaimsSet = JWTParser.parse( s ).getJWTClaimsSet();

        final IDTokenClaimsVerifier verifier =
            new IDTokenClaimsVerifier( new Issuer( issuer ), new ClientID( clientID ), new Nonce( nonce ), 1 );
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
