package com.enonic.app.oidcidprovider.handler;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.net.URL;
import java.net.URLConnection;
import java.util.Map;

import com.fasterxml.jackson.databind.ObjectMapper;

import com.enonic.app.oidcidprovider.mapper.MapMapper;

public class WellKnowBean
{
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    private static final int TIMEOUT_MS = 5000;

    public Object getWellKnown( final String wellKnownEndpoint )
    {
        return getWellKnownConfiguration( wellKnownEndpoint );
    }

    private Object getWellKnownConfiguration( final String wellKnownEndpoint )
    {
        try
        {
            final URLConnection c = new URL( wellKnownEndpoint ).openConnection();
            c.setConnectTimeout( TIMEOUT_MS );
            c.setReadTimeout( TIMEOUT_MS );

            try (InputStream inputStream = c.getInputStream())
            {
                return new MapMapper( OBJECT_MAPPER.readerFor( Map.class ).readValue( inputStream ) );
            }
        }
        catch ( IOException e )
        {
            throw new UncheckedIOException( e );
        }
    }
}
