/* @flow */

import config from '../config'
import { initProxy } from './proxy'
import { initState } from './state'
import { initRender } from './render'
import { initEvents } from './events'
import { mark, measure } from '../util/perf'
import { initLifecycle, callHook } from './lifecycle'
import { initProvide, initInjections } from './inject'
import { extend, mergeOptions, formatComponentName } from '../util/index'

let uid = 0

export function initMixin (Vue: Class<Component>) {
  // 所以子组件的实例化实际上就是在这个时机执行的
  Vue.prototype._init = function (options?: Object) {
    // 声明vm = Vue实例
    const vm: Component = this
    // a uid
    vm._uid = uid++

    // a flag to avoid this being observed
    vm._isVue = true
    // merge options
    // 是组件
    if (options && options._isComponent) {
      // optimize internal component instantiation 优化内部组件实例化
      // since dynamic options merging is pretty slow, and none of the
      // internal component options needs special treatment.
      // 因为动态选项合并是相当慢的，没有一个
      // 内部组件选项需要特殊处理。
      // 这里首先是合并 options 的过程有变化
      // 此时vm.$options就具有了options的部分属性
      initInternalComponent(vm, options)
      /**
       * vm.$options = {
            parent: Vue //父Vue实例,
            propsData: undefined,
            _componentTag: undefined,
            _parentVnode: VNode //父VNode实例,
            _renderChildren:undefined,
            __proto__: {
              components: { },
              directives: { },
              filters: { },
              _base: function Vue(options) {
                  //...
              },
              _Ctor: {},
              created: [
                function created() {
                  console.log('parent created')
                }, function created() {
                  console.log('child created')
                }
              ],
              mounted: [
                function mounted() {
                  console.log('child mounted')
                }
              ],
              data() {
                return {
                  msg: 'Hello Vue'
                }
              },
              template: '<div>{{msg}}</div>'
            }
          }
       */
    } else {
      // 是对象
      // mergeOptions 功能：合并对象并返回
      //  把 Vue 构造函数的 options 和用户传入的 options 做一层合并，到 vm.$options 上
      // 把 Vue 上的一些 option 扩展到了 vm.$options 上
      /**
       * vm.$options = {
          components: { },
          created: [
            function created() {
              console.log('parent created')
            }
          ],
          directives: { },
          filters: { },
          _base: function Vue(options) {
          },
          el: "#app",
          render: function (h) {
          }
        }
       */
      vm.$options = mergeOptions(
        // 相当于 new Vue({这里得配置})=》 目前先理解为返回vm.constructor.options 相当于 Vue.options
        //
        resolveConstructorOptions(vm.constructor),
        // 相当于Vue.mixin({这里得配置}})
        options || {},
        vm
      )
    }
    vm._renderProxy = vm
    // expose real self
    vm._self = vm
    initLifecycle(vm)
    initEvents(vm)
    initRender(vm)
    callHook(vm, 'beforeCreate')
    // beforeCreate无法使用下列值
    initInjections(vm) // resolve injections before data/props
    initState(vm) // 初始化 props、data、methods、watch、computed 等属性
    initProvide(vm) // resolve provide after data/props
    callHook(vm, 'created')

    // 如果有 el 属性，则调用 vm.$mount 方法挂载 vm，挂载的目标就是把模板渲染成最终的 DOM
    if (vm.$options.el) {
      vm.$mount(vm.$options.el)
    }
  }
}

// 子组件的实例化过程先会调用 initInternalComponent(vm, options) 合并 options，
// 把 parent 存储在 vm.$options 中，在 $mount 之前会调用 initLifecycle(vm) 方法
// 做了简单一层对象赋值
export function initInternalComponent (vm: Component, options: InternalComponentOptions) {
  const opts = vm.$options = Object.create(vm.constructor.options)
  // doing this because it's faster than dynamic enumeration.
  // 把之前我们通过 createComponentInstanceForVnode 函数传入的几个参数合并到内部的选项 $options 里了
  // src\core\vdom\create-component.js -> 220行的options
  // options -> 子父组件的VNode实例配置
  const parentVnode = options._parentVnode
  opts.parent = options.parent
  opts._parentVnode = parentVnode

  const vnodeComponentOptions = parentVnode.componentOptions
  opts.propsData = vnodeComponentOptions.propsData
  opts._parentListeners = vnodeComponentOptions.listeners
  opts._renderChildren = vnodeComponentOptions.children
  opts._componentTag = vnodeComponentOptions.tag

  if (options.render) {
    opts.render = options.render
    opts.staticRenderFns = options.staticRenderFns
  }
}

export function resolveConstructorOptions (Ctor: Class<Component>) {
  let options = Ctor.options
  if (Ctor.super) {
    const superOptions = resolveConstructorOptions(Ctor.super)
    const cachedSuperOptions = Ctor.superOptions
    if (superOptions !== cachedSuperOptions) {
      // super option changed,
      // need to resolve new options.
      Ctor.superOptions = superOptions
      // check if there are any late-modified/attached options (#4976)
      const modifiedOptions = resolveModifiedOptions(Ctor)
      // update base extend options
      if (modifiedOptions) {
        extend(Ctor.extendOptions, modifiedOptions)
      }
      options = Ctor.options = mergeOptions(superOptions, Ctor.extendOptions)
      if (options.name) {
        options.components[options.name] = Ctor
      }
    }
  }
  return options
}

function resolveModifiedOptions (Ctor: Class<Component>): ?Object {
  let modified
  const latest = Ctor.options
  const sealed = Ctor.sealedOptions
  for (const key in latest) {
    if (latest[key] !== sealed[key]) {
      if (!modified) modified = {}
      modified[key] = latest[key]
    }
  }
  return modified
}
