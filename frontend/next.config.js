/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    // Ensure "REACT_APP_" vars are available if you are lazily migrating them mentally, 
    // but Next only exposes "NEXT_PUBLIC_" to the client.
    // We will strictly migrate to NEXT_PUBLIC_, so we don't need env mappings here unless strictly necessary.
    distDir: 'build',

    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'images.unsplash.com',
            },
            {
                protocol: 'https',
                hostname: 'source.unsplash.com',
            },
            {
                protocol: 'https',
                hostname: '**',
            },
        ],
    },
}

module.exports = nextConfig
