import { defineClientConfig } from "@vuepress/client";
    import { defineAsyncComponent } from "vue";
import ChartJS from "/home/kellyton/project/blog/node_modules/.pnpm/vuepress-plugin-md-enhance@2.0.0-beta.91/node_modules/vuepress-plugin-md-enhance/lib/client/components/ChartJS";
import ECharts from "/home/kellyton/project/blog/node_modules/.pnpm/vuepress-plugin-md-enhance@2.0.0-beta.91/node_modules/vuepress-plugin-md-enhance/lib/client/components/ECharts";
import CodeDemo from "/home/kellyton/project/blog/node_modules/.pnpm/vuepress-plugin-md-enhance@2.0.0-beta.91/node_modules/vuepress-plugin-md-enhance/lib/client/components/CodeDemo";
import CodeTabs from "/home/kellyton/project/blog/node_modules/.pnpm/vuepress-plugin-md-enhance@2.0.0-beta.91/node_modules/vuepress-plugin-md-enhance/lib/client/components/CodeTabs";
import FlowChart from "/home/kellyton/project/blog/node_modules/.pnpm/vuepress-plugin-md-enhance@2.0.0-beta.91/node_modules/vuepress-plugin-md-enhance/lib/client/components/FlowChart";
import Mermaid from "/home/kellyton/project/blog/node_modules/.pnpm/vuepress-plugin-md-enhance@2.0.0-beta.91/node_modules/vuepress-plugin-md-enhance/lib/client/components/Mermaid";
import Presentation from "/home/kellyton/project/blog/node_modules/.pnpm/vuepress-plugin-md-enhance@2.0.0-beta.91/node_modules/vuepress-plugin-md-enhance/lib/client/components/Presentation";
import "/home/kellyton/project/blog/node_modules/.pnpm/vuepress-plugin-md-enhance@2.0.0-beta.91/node_modules/vuepress-plugin-md-enhance/lib/client/styles/container/index.scss";
import "/home/kellyton/project/blog/node_modules/.pnpm/vuepress-plugin-md-enhance@2.0.0-beta.91/node_modules/vuepress-plugin-md-enhance/lib/client/styles/footnote.scss";
import "/home/kellyton/project/blog/node_modules/.pnpm/vuepress-plugin-md-enhance@2.0.0-beta.91/node_modules/vuepress-plugin-md-enhance/lib/client/styles/image-mark.scss";
import Tabs from "/home/kellyton/project/blog/node_modules/.pnpm/vuepress-plugin-md-enhance@2.0.0-beta.91/node_modules/vuepress-plugin-md-enhance/lib/client/components/Tabs";
const Playground = defineAsyncComponent(() => import("/home/kellyton/project/blog/node_modules/.pnpm/vuepress-plugin-md-enhance@2.0.0-beta.91/node_modules/vuepress-plugin-md-enhance/lib/client/components/Playground"));
import "/home/kellyton/project/blog/node_modules/.pnpm/vuepress-plugin-md-enhance@2.0.0-beta.91/node_modules/vuepress-plugin-md-enhance/lib/client/styles/tasklist.scss";
import "/home/kellyton/project/blog/node_modules/.pnpm/vuepress-plugin-md-enhance@2.0.0-beta.91/node_modules/vuepress-plugin-md-enhance/lib/client/styles/tex.scss";


export default defineClientConfig({
  enhance: ({ app }) => {
    app.component("ChartJS", ChartJS);
    app.component("ECharts", ECharts);
    app.component("CodeDemo", CodeDemo);
    app.component("CodeTabs", CodeTabs);
    app.component("FlowChart", FlowChart);
    app.component("Mermaid", Mermaid);
    app.component("Presentation", Presentation);
    app.component("Tabs", Tabs);
    app.component("Playground", Playground);
    
  }
});