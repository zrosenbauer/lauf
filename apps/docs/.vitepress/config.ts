import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'Lauf',
  description: 'Typed script runner for monorepos',
  base: '/lauf/',
  cleanUrls: true,

  head: [['link', { rel: 'icon', type: 'image/svg+xml', href: '/logo.svg' }]],

  themeConfig: {
    logo: '/logo.svg',
    siteTitle: false,

    nav: [
      { text: 'Overview', link: '/overview' },
      { text: 'Getting Started', link: '/getting-started' },
      { text: 'Configuration', link: '/configuration' },
      { text: 'Scripts', link: '/scripts' },
      { text: 'CLI', link: '/cli/' },
      { text: 'Examples', link: '/examples' },
    ],

    sidebar: [
      {
        text: 'Introduction',
        items: [
          { text: 'Overview', link: '/overview' },
          { text: 'Getting Started', link: '/getting-started' },
        ],
      },
      {
        text: 'Guide',
        items: [
          { text: 'Configuration', link: '/configuration' },
          { text: 'Writing Scripts', link: '/scripts' },
          { text: 'Workspace Support', link: '/workspace-support' },
          { text: 'Examples', link: '/examples' },
        ],
      },
      {
        text: 'CLI Reference',
        items: [
          { text: 'Overview', link: '/cli/' },
          { text: 'lauf init', link: '/cli/init' },
          { text: 'lauf list', link: '/cli/list' },
          { text: 'lauf run', link: '/cli/run' },
          { text: 'lauf info', link: '/cli/info' },
          { text: 'lauf create', link: '/cli/create' },
        ],
      },
    ],

    socialLinks: [{ icon: 'github', link: 'https://github.com/zrosenbauer/lauf' }],

    search: {
      provider: 'local',
    },

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright Zac Rosenbauer',
    },
  },
});
