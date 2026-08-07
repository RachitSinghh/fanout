import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // @fanout/shared is consumed as raw TS source (see its package.json exports),
  // so Next must transpile it rather than expect a prebuilt dist.
  transpilePackages: ['@fanout/shared'],
  // Keep Prisma's query engine out of the bundle (it's a native binary).
  serverExternalPackages: ['@prisma/client', 'prisma'],
};

export default nextConfig;
