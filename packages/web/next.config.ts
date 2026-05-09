import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@wixbury/db', '@wixbury/shared'],
};

export default nextConfig;
