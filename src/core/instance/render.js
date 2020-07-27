/* @flow */

import {
  warn,
  nextTick,
  emptyObject,
  handleError,
  defineReactive
} from '../util/index'

import { createElement } from '../vdom/create-element'
import { installRenderHelpers } from './render-helpers/index'
import { resolveSlots } from './render-helpers/resolve-slots'
import VNode, { cloneVNodes, createEmptyVNode } from '../vdom/vnode'

import { isUpdatingChildComponent } from './lifecycle'

export function initRender (vm: Component) {
  vm._vnode = null // the root of the child tree
  const options = vm.$options
  const parentVnode = vm.$vnode = options._parentVnode // the placeholder node in parent tree
  const renderContext = parentVnode && parentVnode.context
  vm.$slots = resolveSlots(options._renderChildren, renderContext)
  vm.$scopedSlots = emptyObject
  // bind the createElement fn to this instance 将createElement fn绑定到这个实例
  // so that we get proper render context inside it. 得到了合适得渲染上下文
  // args order: tag, data, children, normalizationType, alwaysNormalize
  // internal version is used by render functions compiled from templates
  // 模板编译成的 render 函数使用
  vm._c = (a, b, c, d) => createElement(vm, a, b, c, d, false)
  // normalization is always applied for the public version, used in
  // user-written render functions.
  // 用户手写编译成render使用
  vm.$createElement = (a, b, c, d) => createElement(vm, a, b, c, d, true)

  // $attrs & $listeners are exposed for easier HOC creation.
  // they need to be reactive so that HOCs using them are always updated
  const parentData = parentVnode && parentVnode.data

  defineReactive(vm, '$attrs', parentData && parentData.attrs || emptyObject, null, true)
  defineReactive(vm, '$listeners', options._parentListeners || emptyObject, null, true)
}

export function renderMixin (Vue: Class<Component>) {
  // install runtime convenience helpers
  installRenderHelpers(Vue.prototype)

  Vue.prototype.$nextTick = function (fn: Function) {
    return nextTick(fn, this)
  }

  Vue.prototype._render = function (): VNode {
    const vm: Component = this
    // 在src\core\instance\lifecycle.js文件下给render赋值了
    // 但在实际使用中我们回用jsx语法书写
    /**
     * render: function (createElement) {
        return createElement('div', {
          attrs: {
              id: 'app'
            },
        }, this.message)
      }
      那么render方法就是上述方法，vm.$createElement就是 createElement
      vm.$options 其实就是new Vue(vm.$options);
     */
    // _parentVnode 就是当前组件的父 VNode
    const { render, _parentVnode } = vm.$options

    if (vm._isMounted) {
      // if the parent didn't update, the slot nodes will be the ones from
      // last render. They need to be cloned to ensure "freshness" for this render.
      for (const key in vm.$slots) {
        const slot = vm.$slots[key]
        if (slot._rendered) {
          vm.$slots[key] = cloneVNodes(slot, true /* deep */)
        }
      }
    }

    // _parentVNode.data.scopedSlots 对应的就是我们在父组件通过执行 resolveScopedSlots 返回的对象
    vm.$scopedSlots = (_parentVnode && _parentVnode.data.scopedSlots) || emptyObject

    // set parent vnode. this allows render functions to have access
    // to the data on the placeholder node.
    // _parentVnode 就是当前组件的父 VNode
    vm.$vnode = _parentVnode
    // render self
    let vnode
    try {
      // 这里就是 把createElement 传给render方法的回调执行
      vnode = render.call(vm._renderProxy, vm.$createElement)
    } catch (e) {
      handleError(e, vm, `render`)
      // return error render result,
      // or previous vnode to prevent render error causing blank component
      vnode = vm._vnode
    }
    // return empty vnode in case the render function errored out
    if (!(vnode instanceof VNode)) {
      vnode = createEmptyVNode()
    }
    // set parent
    // 将当前组建的parent指向父级VNode
    vnode.parent = _parentVnode
    // 最后生成一个vnode （js描述得html文档）
    return vnode
  }
}
