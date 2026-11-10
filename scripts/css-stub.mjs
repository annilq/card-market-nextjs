// Node 同步 loader hook：后台客户端组件会经 @payloadcms/ui 引入 react-image-crop 的 CSS，
// 纯 Node 渲染服务端组件时不需要样式表，把 .css 解析成一个空模块即可。
import { registerHooks } from 'node:module'

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.endsWith('.css')) {
      return {
        url: 'data:text/javascript,export default {}',
        format: 'module',
        shortCircuit: true,
      }
    }
    return nextResolve(specifier, context)
  },
})
