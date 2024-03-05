package com.enonic.app.oidcidprovider;

import java.math.BigInteger;
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
    private static final ObjectMapper MAPPER = new ObjectMapper();

    private Supplier<IdProviderConfigService> idProviderConfigServiceSupplier;

    public String generateToken()
    {
        return new BigInteger( 130, new SecureRandom() ).toString( 32 );
    }

    public ClaimSetMapper parseClaims( final String jwtToken, final String issuer, final String clientID, final String nonce,
                                       final String idProviderName )
        throws Exception
    {
        DecodedJWT decodedJWT = JWT.decode( jwtToken );

        RSAAlgorithmProvider rsaAlgorithmProvider = idProviderConfigServiceSupplier.get().getAlgorithmProvider( idProviderName );

        Algorithm algorithm = rsaAlgorithmProvider.getAlgorithm( decodedJWT.getAlgorithm() );

        DecodedJWT verifiedJWT = JWT.require( algorithm ).
            withIssuer( issuer ).
            withAudience( clientID ).
            withClaim( "nonce", nonce ).
            acceptLeeway( 1 ).   // 1 sec for nbf and iat
            build().
            verify( decodedJWT );

        Map<String, Object> claims = MAPPER.readValue( Base64.getDecoder().decode( verifiedJWT.getPayload() ), Map.class );

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
