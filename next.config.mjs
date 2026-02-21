/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
};

// 是否使用github action部署方式
const isGithubActions = process.env.GITHUB_ACTIONS || false;

// 如果是github action部署方式，配置静态导出
if (isGithubActions) {
  nextConfig.output = 'export';
  const repo = process.env.GITHUB_REPOSITORY.replace(/.*?\//, '');
  nextConfig.assetPrefix = `/${repo}/`;
  nextConfig.basePath = `/${repo}`;
  nextConfig.env = {
    ROUTE_PREFIX: `/${repo}`,
  };
}

export default nextConfig;
