package com.enonic.app.oidcidprovider;

import java.math.BigInteger;
import java.security.SecureRandom;
import java.text.ParseException;
import java.util.Base64;

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
        return new BigInteger( 130, new SecureRandom() ).
            toString( 32 );
    }

    public static ClaimSetMapper parseClaims( final String s, final String issuer, final String clientID, final String nonce )
        throws ParseException, BadJWTException
    {
        final JWTClaimsSet jwtClaimsSet = JWTParser.parse( s ).
            getJWTClaimsSet();

        final IDTokenClaimsVerifier verifier =
            new IDTokenClaimsVerifier( new Issuer( issuer ), new ClientID( clientID ), new Nonce( nonce ), 0 );
        verifier.verify( jwtClaimsSet, null );

        return ClaimSetMapper.create().
            claimSet( jwtClaimsSet ).
            build();
    }

    public static String base64EncodeString(String s) {
        return Base64.getEncoder().encodeToString(s.getBytes());
    }
}
