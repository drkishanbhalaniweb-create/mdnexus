/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    // Ensure "REACT_APP_" vars are available if you are lazily migrating them mentally, 
    // but Next only exposes "NEXT_PUBLIC_" to the client.
    // We will strictly migrate to NEXT_PUBLIC_, so we don't need env mappings here unless strictly necessary.

    images: {
        domains: [
            'images.unsplash.com',
            'source.unsplash.com',
            // Add Supabase storage domain if needed, usually just the project URL host
            // e.g. "xyz.supabase.co"
        ],
        // Allow Supabase patterns if you use the full URL in images
        remotePatterns: [
            {
                protocol: 'https',
                hostname: '**',
            },
        ],
    },
}

module.exports = nextConfig
