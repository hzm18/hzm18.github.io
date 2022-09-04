import { defineUserConfig } from "vuepress";
import theme from "./theme";

export default defineUserConfig({
  lang: "zh-CN",
  title: "Kellyton的博客",
  description: "Kellyton的博客",

  base: "/",

  theme,
});
