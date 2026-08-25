import { defineConfig } from 'vitepress';
export default defineConfig({
  title: 'Landroid MQTT Bridge',
  description: 'Reliable MQTT integration for robotic mower accounts.',
  base: '/landroid-mqtt-bridge/',
  cleanUrls: true,
  lastUpdated: true,
  head: [['link', { rel: 'icon', href: '/landroid-mqtt-bridge/favicon.svg', type: 'image/svg+xml' }]],
  themeConfig: {
    logo: '/logo.svg',
    nav: [
      { text: 'Guide', link: '/' },
      { text: 'Configuration', link: '/configuration' },
      { text: 'MQTT', link: '/mqtt' },
      { text: 'Authentication', link: '/authentication' },
      { text: 'Deployment', link: '/deployment' },
    ],
    sidebar: [
      { text: 'Overview', link: '/' },
      { text: 'Getting Started', link: '/getting-started' },
      { text: 'Configuration', link: '/configuration' },
      { text: 'MQTT Contract', link: '/mqtt' },
      { text: 'Authentication', link: '/authentication' },
      { text: 'Deployment', link: '/deployment' },
      { text: 'Troubleshooting', link: '/troubleshooting' },
    ],
    editLink: {
      pattern: 'https://github.com/tobiaswaelde/landroid-mqtt-bridge/edit/main/docs/:path',
      text: 'Edit this page on GitHub',
    },
    socialLinks: [{ icon: 'github', link: 'https://github.com/tobiaswaelde/landroid-mqtt-bridge' }],
  },
});
