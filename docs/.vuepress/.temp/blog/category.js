export const categoryMap = {"category":{"/":{"path":"/category/","map":{"后端":{"path":"/category/%E5%90%8E%E7%AB%AF/","keys":["v-5ce0c10e"]},"Java":{"path":"/category/java/","keys":["v-5ce0c10e"]}}}},"tag":{"/":{"path":"/tag/","map":{"JUC":{"path":"/tag/juc/","keys":["v-5ce0c10e"]},"AQS":{"path":"/tag/aqs/","keys":["v-5ce0c10e"]}}}}}

if (import.meta.webpackHot) {
  import.meta.webpackHot.accept()
  if (__VUE_HMR_RUNTIME__.updateBlogCategory) {
    __VUE_HMR_RUNTIME__.updateBlogCategory(categoryMap)
  }
}

if (import.meta.hot) {
  import.meta.hot.accept(({ categoryMap }) => {
    __VUE_HMR_RUNTIME__.updateBlogCategory(categoryMap)
  })
}
