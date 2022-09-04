import { hopeTheme } from "vuepress-theme-hope";
import navbar from "./navbar";
import sidebar from "./sidebar";

export default hopeTheme({
  hostname: "https://hzm18.github.io",

  author: {
    name: "Kellyton",
    url: "https://hzm18.github.io",
  },

  iconAssets: "iconfont",

  logo: "/logo.jpg",

  // repo: "vuepress-theme-hope/vuepress-theme-hope",

  docsDir: "demo/src",

  // navbar
  // navbar: navbar,
  navbar: false,

  // sidebar
  sidebar: sidebar,


  footer: "日拱一卒",

  displayFooter: false,

  pageInfo: ["Author", "Original", "Date", "Category", "Tag", "ReadingTime"],

  blog: {
    description: "小菜鸡",
    /*  intro: "/intro.html",
     medias: {
       Baidu: "https://example.com",
       Bitbucket: "https://example.com",
       Dingding: "https://example.com",
       Discord: "https://example.com",
       Dribbble: "https://example.com",
       Email: "https://example.com",
       Evernote: "https://example.com",
       Facebook: "https://example.com",
       Flipboard: "https://example.com",
       Gitee: "https://example.com",
       GitHub: "https://example.com",
       Gitlab: "https://example.com",
       Gmail: "https://example.com",
       Instagram: "https://example.com",
       Lines: "https://example.com",
       Linkedin: "https://example.com",
       Pinterest: "https://example.com",
       Pocket: "https://example.com",
       QQ: "https://example.com",
       Qzone: "https://example.com",
       Reddit: "https://example.com",
       Rss: "https://example.com",
       Steam: "https://example.com",
       Twitter: "https://example.com",
       Wechat: "https://example.com",
       Weibo: "https://example.com",
       Whatsapp: "https://example.com",
       Youtube: "https://example.com",
       Zhihu: "https://example.com",
     }, */
  },

  encrypt: {
    config: {
      "/guide/encrypt.html": ["1234"],
    },
  },

  plugins: {
    blog: {
      autoExcerpt: true,
    },

    mdEnhance: {
      enableAll: true,
      presentation: {
        plugins: ["highlight", "math", "search", "notes", "zoom"],
      },
    },
  },
});
