/* @flow */
// import Vue from 'vue' 时 就是从这个文件引入
import config from 'core/config'
import { warn, cached } from 'core/util/index'
import { mark, measure } from 'core/util/perf'

import Vue from './runtime/index'
import { query } from './util/index'
import { shouldDecodeNewlines } from './util/compat'
import { compileToFunctions } from './compiler/index'

const idToTemplate = cached(id => {
  const el = query(id)
  return el && el.innerHTML
})

// 先缓存原先的$mount方法 -》src\platforms\web\runtime\index.js
const mount = Vue.prototype.$mount

// 重新定以 $mount
Vue.prototype.$mount = function (el?: string | Element, hydrating?: boolean): Component {
  el = el && query(el)

  // 如果绑定DOM是body或者是doucment对象则直接返回this
  if (el === document.body || el === document.documentElement) {
    return this
  }

  const options = this.$options
  // resolve template/el and convert to render function
  // 所有 Vue 的组件的渲染最终都需要 render 方法
  if (!options.render) {
    let template = options.template
    if (template) {
      if (typeof template === 'string') {
        if (template.charAt(0) === '#') {
          template = idToTemplate(template)
        }
      } else if (template.nodeType) {
        template = template.innerHTML
      } else {
        return this
      }
    } else if (el) {
      template = getOuterHTML(el)
    }
    if (template) {
      // “在线编译”的过程，它是调用 compileToFunctions 方法实现的
      // 把 el 或者 template 字符串转换成 render 方法
      const { render, staticRenderFns } = compileToFunctions(template, {
        shouldDecodeNewlines,
        delimiters: options.delimiters,
        comments: options.comments
      }, this)
      options.render = render
      options.staticRenderFns = staticRenderFns
    }
  }

  // 执行原先定义的$mount方法
  return mount.call(this, el, hydrating)
}

/**
 * Get outerHTML of elements, taking care
 * of SVG elements in IE as well.
 */
function getOuterHTML (el: Element): string {
  if (el.outerHTML) {
    return el.outerHTML
  } else {
    const container = document.createElement('div')
    container.appendChild(el.cloneNode(true))
    return container.innerHTML
  }
}

Vue.compile = compileToFunctions

export default Vue
