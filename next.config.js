/** @type {import('next').NextConfig} */
const nextConfig = {
    // Enable static export for IPFS deployment when STATIC_EXPORT=true
    output: process.env.STATIC_EXPORT === 'true' ? 'export' : undefined,

    // Disable image optimization for static export (not supported)
    images: process.env.STATIC_EXPORT === 'true' ? { unoptimized: true } : undefined,

    webpack: (config) => {
        config.resolve.fallback = {
            fs: false,
            net: false,
            encoding: false,
            tls: false,
            lokijs: false,
        };

        return config;
    },
}

module.exports = nextConfig
