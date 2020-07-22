/* @flow */

import VNode from './vnode'
import { resolveConstructorOptions } from 'core/instance/init'
import { queueActivatedComponent } from 'core/observer/scheduler'
import { createFunctionalComponent } from './create-functional-component'

import {
  warn,
  isDef,
  isUndef,
  isTrue,
  isObject
} from '../util/index'

import {
  resolveAsyncComponent,
  createAsyncPlaceholder,
  extractPropsFromVNodeData
} from './helpers/index'

import {
  callHook,
  activeInstance,
  updateChildComponent,
  activateChildComponent,
  deactivateChildComponent
} from '../instance/lifecycle'

// hooks to be invoked on component VNodes during patch
// 在初始化一个 Component 类型的 VNode 的过程中实现了几个钩子函数
const componentVNodeHooks = {
  init (
    vnode: VNodeWithData,
    hydrating: boolean,
    parentElm: ?Node,
    refElm: ?Node
  ): ?boolean {
    if (!vnode.componentInstance || vnode.componentInstance._isDestroyed) {
      const child = vnode.componentInstance = createComponentInstanceForVnode(
        vnode,
        activeInstance,
        parentElm,
        refElm
      )
      // componentVNodeHooks 的 init 钩子函数，在完成实例化的 _init 后
      // hydrating - 是否服务端渲染 - 》child.$mount(undefined, false)
      // 它最终会调用 mountComponent（147） 方法，进而执行 vm._render() 方法： src\core\instance\lifecycle.js
      child.$mount(hydrating ? vnode.elm : undefined, hydrating)
    } else if (vnode.data.keepAlive) {
      // keep-alive
      // kept-alive components, treat as a patch
      const mountedNode: any = vnode // work around flow
      componentVNodeHooks.prepatch(mountedNode, mountedNode)
    }
  },

  // 是拿到新的 vnode 的组件配置以及组件实例
  prepatch (oldVnode: MountedComponentVNode, vnode: MountedComponentVNode) {
    // 在218行看到赋值给的对象参数 （有propsData）
    const options = vnode.componentOptions
    const child = vnode.componentInstance = oldVnode.componentInstance
    // 更新 vnode 对应 vm 实例的一系列属性
    // 包括占位符 vm.$vnode 的更新、slot 的更新，listeners 的更新，props 的更新等等。
    updateChildComponent(
      child,
      options.propsData, // updated props // 父组件的propsData
      options.listeners, // updated listeners
      vnode, // new parent vnode
      options.children // new children
    )
  },

  // src\core\vdom\patch.js 513执行
  insert (vnode: MountedComponentVNode) {
    const { context, componentInstance } = vnode
    if (!componentInstance._isMounted) {
      componentInstance._isMounted = true
      // 对于同步渲染的子组件而言，mounted 钩子函数的执行顺序也是先子后父。
      callHook(componentInstance, 'mounted')
    }
    if (vnode.data.keepAlive) {
      if (context._isMounted) {
        // vue-router#1212
        // During updates, a kept-alive component's child components may
        // change, so directly walking the tree here may call activated hooks
        // on incorrect children. Instead we push them into a queue which will
        // be processed after the whole patch process ended.
        queueActivatedComponent(componentInstance)
      } else {
        activateChildComponent(componentInstance, true /* direct */)
      }
    }
  },

  destroy (vnode: MountedComponentVNode) {
    const { componentInstance } = vnode
    if (!componentInstance._isDestroyed) {
      if (!vnode.data.keepAlive) {
        // 当组件并不是 keepAlive 的时候，会执行 componentInstance.$destroy() 方法，
        // 然后就会执行 beforeDestroy & destroyed 两个钩子函数。
        componentInstance.$destroy()
      } else {
        deactivateChildComponent(componentInstance, true /* direct */)
      }
    }
  }
}

const hooksToMerge = Object.keys(componentVNodeHooks)

export function createComponent (
  Ctor: Class<Component> | Function | Object | void, // 在异步组件中他是一个函数; 在正常组件中是一个对象
  data: ?VNodeData,
  context: Component,
  children: ?Array<VNode>,
  tag?: string
): VNode | void {
  if (isUndef(Ctor)) {
    return
  }

  // src/core/global-api/index.js -> Vue.options._base = Vue
  // 在 src/core/instance/init.js 里 Vue 原型上的 _init 函数
  /**
   * vm.$options = mergeOptions(
      resolveConstructorOptions(vm.constructor),
      options || {},
      vm
    )
   */
  // 能通过 vm.$options._base 拿到 Vue 这个构造函数了
  const baseCtor = context.$options._base

  // plain options object: turn it into a constructor
  // 在vue文件中，Ctor就是 export default出来的值。
  // baseCtor 实际上就是 Vue
  // src/core/global-api/extend.js 中。
  if (isObject(Ctor)) {
    Ctor = baseCtor.extend(Ctor)
  }

  // if at this stage it's not a constructor or an async component factory,
  // reject.
  if (typeof Ctor !== 'function') {
    return
  }

  // async component
  // 异步组件
  let asyncFactory
  if (isUndef(Ctor.cid)) {
    asyncFactory = Ctor
    Ctor = resolveAsyncComponent(asyncFactory, baseCtor, context)
    if (Ctor === undefined) {
      // return a placeholder node for async component, which is rendered
      // as a comment node but preserves all the raw information for the node.
      // the information will be used for async server-rendering and hydration.
      return createAsyncPlaceholder(
        asyncFactory,
        data,
        context,
        children,
        tag
      )
    }
  }

  data = data || {}

  // resolve constructor options in case global mixins are applied after
  // component constructor creation
  resolveConstructorOptions(Ctor)

  // transform component v-model data into props & events
  if (isDef(data.model)) {
    transformModel(Ctor.options, data)
  }

  // extract props
  // 首先从 data 中提取出 propData
  const propsData = extractPropsFromVNodeData(data, Ctor, tag)

  // functional component
  if (isTrue(Ctor.options.functional)) {
    return createFunctionalComponent(Ctor, propsData, data, context, children)
  }

  // extract listeners, since these needs to be treated as
  // child component listeners instead of DOM listeners
  const listeners = data.on
  // replace with listeners with .native modifier
  // so it gets processed during parent component patch.
  data.on = data.nativeOn

  if (isTrue(Ctor.options.abstract)) {
    // abstract components do not keep anything
    // other than props & listeners & slot

    // work around flow
    const slot = data.slot
    data = {}
    if (slot) {
      data.slot = slot
    }
  }

  // merge component management hooks onto the placeholder node
  // 合并组件管理挂钩到占位符节点 - 给VNode增加状态钩子
  mergeHooks(data)

  // return a placeholder vnode
  const name = Ctor.options.name || tag
  // 通过 new VNode 实例化一个 vnode 并返回。需要注意的是和普通元素节点的 vnode 不同，组件的 vnode 是没有 children 的，这点很关键
  const vnode = new VNode(
    `vue-component-${Ctor.cid}${name ? `-${name}` : ''}`,
    data, undefined, undefined, undefined, context,
    { Ctor, propsData, listeners, tag, children }, // 传入props：所以我们可以通过 vnode.componentOptions.propsData 拿到 prop 数据。
    asyncFactory
  )
  return vnode
}

// 函数构造的一个内部组件的参数
// 整个深度遍历过程
export function createComponentInstanceForVnode (
  vnode: any, // we know it's MountedComponentVNode but flow doesn't
  parent: any, // activeInstance in lifecycle state
  parentElm?: ?Node,
  refElm?: ?Node
): Component {
  // vnodeComponentOptions 子组件的option
  const vnodeComponentOptions = vnode.componentOptions
  const options: InternalComponentOptions = {
    _isComponent: true, // 为 true 表示它是一个组件
    parent, // 当前激活的组件实例
    propsData: vnodeComponentOptions.propsData,
    _componentTag: vnodeComponentOptions.tag,
    _parentVnode: vnode,
    _parentListeners: vnodeComponentOptions.listeners,
    _renderChildren: vnodeComponentOptions.children,
    _parentElm: parentElm || null,
    _refElm: refElm || null
  }
  // check inline-template render functions
  const inlineTemplate = vnode.data.inlineTemplate
  if (isDef(inlineTemplate)) {
    options.render = inlineTemplate.render
    options.staticRenderFns = inlineTemplate.staticRenderFns
  }
  // 对应的就是子组件的构造函数
  // 它实际上是继承于 Vue 的一个构造器 Sub
  // 相当于 new Sub(options)
  // 指向 Vue.extend 的返回值 Sub
  return new vnodeComponentOptions.Ctor(options)
}

// installComponentHooks
// 把 componentVNodeHooks 的钩子函数合并到 data.hook 中
function mergeHooks (data: VNodeData) {
  if (!data.hook) {
    data.hook = {}
  }
  for (let i = 0; i < hooksToMerge.length; i++) {
    const key = hooksToMerge[i]
    // 获取已经存在的hook
    const fromParent = data.hook[key]
    // 获取默认hook
    const ours = componentVNodeHooks[key]
    // 如果某个时机的钩子已经存在 data.hook 中，那么通过执行 mergeHook 函数做合并，在最终执行的时候，依次执行这两个钩子函数即可。
    // 如果自定义了并且和默认的一样，则都执行，并且先执行默认的
    data.hook[key] = fromParent ? mergeHook(ours, fromParent) : ours
  }
}

// 依次执行one two
function mergeHook (one: Function, two: Function): Function {
  return function (a, b, c, d) {
    one(a, b, c, d)
    two(a, b, c, d)
  }
}

// transform component v-model info (value and callback) into
// prop and event handler respectively.
function transformModel (options, data: any) {
  const prop = (options.model && options.model.prop) || 'value'
  const event = (options.model && options.model.event) || 'input'
  ;(data.props || (data.props = {}))[prop] = data.model.value
  const on = data.on || (data.on = {})
  if (isDef(on[event])) {
    on[event] = [data.model.callback].concat(on[event])
  } else {
    on[event] = data.model.callback
  }
}
