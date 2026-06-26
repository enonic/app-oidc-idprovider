package com.enonic.app.oidcidprovider.handler;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

import com.enonic.xp.script.serializer.MapGenerator;
import com.enonic.xp.script.serializer.MapSerializable;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class DeviceTokenHandlerTest
{
    private static final String SECRET = "0123456789abcdef0123456789abcdef";

    private final DeviceTokenHandler handler = new DeviceTokenHandler();

    @Test
    void sign_and_verify_roundtrip()
    {
        final String token =
            handler.sign( SECRET, "myidp-hs512", "app:myidp", "user:myidp:john", "https://api.example.com", "cli", "openid", 3600 );

        final Map<String, Object> payload = serialize( handler.verify( token, SECRET, "app:myidp", List.of( "https://api.example.com" ) ) );

        assertNotNull( payload );
        assertEquals( "user:myidp:john", payload.get( "sub" ) );
        assertEquals( "app:myidp", payload.get( "iss" ) );
        assertEquals( "cli", payload.get( "client_id" ) );
    }

    @Test
    void verify_fails_with_wrong_secret()
    {
        final String token = handler.sign( SECRET, "k", "app:myidp", "john", "aud", "cli", "openid", 3600 );
        assertNull( handler.verify( token, "another-secret-another-secret-32", "app:myidp", List.of() ) );
    }

    @Test
    void verify_fails_with_wrong_issuer()
    {
        final String token = handler.sign( SECRET, "k", "app:myidp", "john", "aud", "cli", "openid", 3600 );
        assertNull( handler.verify( token, SECRET, "app:other", List.of() ) );
    }

    @Test
    void verify_fails_when_audience_not_allowed()
    {
        final String token = handler.sign( SECRET, "k", "app:myidp", "john", "aud-a", "cli", "openid", 3600 );
        assertNull( handler.verify( token, SECRET, "app:myidp", List.of( "aud-b" ) ) );
    }

    @Test
    void verify_fails_when_expired()
    {
        final String token = handler.sign( SECRET, "k", "app:myidp", "john", "aud", "cli", "openid", -10 );
        assertNull( handler.verify( token, SECRET, "app:myidp", List.of() ) );
    }

    @Test
    void peek_issuer_does_not_require_verification()
    {
        final String token = handler.sign( SECRET, "k", "app:myidp", "john", "aud", "cli", "openid", 3600 );
        assertEquals( "app:myidp", handler.peekIssuer( token ) );
        assertNull( handler.peekIssuer( "not-a-jwt" ) );
    }

    @Test
    void generated_codes_are_unique_and_well_formed()
    {
        assertTrue( handler.generateUserCode().matches( "[BCDFGHJKLMNPQRSTVWXZ]{4}-[BCDFGHJKLMNPQRSTVWXZ]{4}" ) );
        assertNotEquals( handler.generateDeviceCode(), handler.generateDeviceCode() );
    }

    private static Map<String, Object> serialize( final MapSerializable serializable )
    {
        if ( serializable == null )
        {
            return null;
        }
        final TestMapGenerator generator = new TestMapGenerator();
        serializable.serialize( generator );
        return generator.map;
    }

    /**
     * Minimal MapGenerator that captures a flat object into a Map for assertions.
     */
    private static final class TestMapGenerator
        implements MapGenerator
    {
        private final java.util.Map<String, Object> map = new java.util.HashMap<>();

        @Override
        public MapGenerator map( final String key )
        {
            return this;
        }

        @Override
        public MapGenerator map()
        {
            return this;
        }

        @Override
        public MapGenerator end()
        {
            return this;
        }

        @Override
        public MapGenerator array( final String key )
        {
            return this;
        }

        @Override
        public MapGenerator array()
        {
            return this;
        }

        @Override
        public MapGenerator value( final Object value )
        {
            return this;
        }

        @Override
        public MapGenerator value( final String key, final Object value )
        {
            this.map.put( key, value );
            return this;
        }

        @Override
        public MapGenerator rawValue( final Object value )
        {
            return this;
        }

        @Override
        public MapGenerator rawValue( final String key, final Object value )
        {
            this.map.put( key, value );
            return this;
        }
    }
}
