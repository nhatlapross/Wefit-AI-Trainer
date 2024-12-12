/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
      config.externals.push({
        'utf-8-validate': 'commonjs utf-8-validate',
        'bufferutil': 'commonjs bufferutil',
      });
      config.experiments = {
        asyncWebAssembly: true,
        layers: true,
        topLevelAwait: true
      };
      return config;
    },
    // Ensure client-side only rendering
    async redirects() {
      return [
        {
          source: '/server-side-page',
          destination: '/',
          permanent: true,
        },
      ];
    },
};

export default nextConfig;