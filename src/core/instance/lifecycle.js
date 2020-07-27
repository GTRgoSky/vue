/* @flow */

import config from '../config'
import Watcher from '../observer/watcher'
import { mark, measure } from '../util/perf'
import { createEmptyVNode } from '../vdom/vnode'
import { observerState } from '../observer/index'
import { updateComponentListeners } from './events'
import { resolveSlots } from './render-helpers/resolve-slots'

import {
  warn,
  noop,
  remove,
  handleError,
  emptyObject,
  validateProp
} from '../util/index'

export let activeInstance: any = null
export let isUpdatingChildComponent: boolean = false

// 在 $mount 之前会调用
export function initLifecycle (vm: Component) {
  const options = vm.$options

  // locate first non-abstract parent
  let parent = options.parent
  // 如果是抽象组件，不作为父组件容器
  if (parent && !options.abstract) {
    while (parent.$options.abstract && parent.$parent) {
      parent = parent.$parent
    }
    // 通过 parent.$children.push(vm) 来把当前的 vm 存储到父实例的 $children 中
    parent.$children.push(vm)
  }

  // 用来保留当前 vm 的父实例
  vm.$parent = parent
  vm.$root = parent ? parent.$root : vm

  vm.$children = []
  vm.$refs = {}

  vm._watcher = null
  vm._inactive = null
  vm._directInactive = false
  vm._isMounted = false
  vm._isDestroyed = false
  vm._isBeingDestroyed = false
}

export function lifecycleMixin (Vue: Class<Component>) {
  // 用于渲染 VNode
  Vue.prototype._update = function (vnode: VNode, hydrating?: boolean) {
    const vm: Component = this
    if (vm._isMounted) { // 已经执行过
      callHook(vm, 'beforeUpdate')
    }
    const prevEl = vm.$el
    const prevVnode = vm._vnode
    // 用 prevActiveInstance 保留上一次的 activeInstance
    // 实际上，prevActiveInstance 和当前的 vm 是一个父子关系，
    // 当一个 vm 实例完成它的所有子树的 patch 或者 update 过程后，activeInstance 会回到它的父实例
    const prevActiveInstance = activeInstance
    // 当前的 vm 赋值给 activeInstance
    activeInstance = vm

    // 这个 vnode 是通过 vm._render() 返回的组件渲染 VNode
    vm._vnode = vnode

    // Vue.prototype.__patch__ is injected in entry points
    // based on the rendering backend used.
    // 组件更新的过程，会执行
    if (!prevVnode) {
      // initial render
      // 在 src\platforms\web\runtime\index.js 赋值，在浏览器中 vm.__patch__ == patch
      vm.$el = vm.__patch__(
        // vm.$el 绑定的DOM 对象(id=app) <div id="app"> </div>
        // 非服务端 hydrating -》 false
        vm.$el, vnode, hydrating, false /* removeOnly */,
        vm.$options._parentElm,
        vm.$options._refElm
      )
      // no need for the ref nodes after initial patch
      // this prevents keeping a detached DOM tree in memory (#5851)
      vm.$options._parentElm = vm.$options._refElm = null
    } else {
      // updates
      vm.$el = vm.__patch__(prevVnode, vnode)
    }

    // 保持当前上下文的 Vue 实例
    activeInstance = prevActiveInstance
    // update __vue__ reference
    if (prevEl) {
      prevEl.__vue__ = null
    }
    if (vm.$el) {
      vm.$el.__vue__ = vm
    }
    // if parent is an HOC, update its $el as well
    // vm._vnode 和 vm.$vnode 的关系就是一种父子关系
    if (vm.$vnode && vm.$parent && vm.$vnode === vm.$parent._vnode) {
      vm.$parent.$el = vm.$el
    }
    // updated hook is called by the scheduler to ensure that children are
    // updated in a parent's updated hook.
  }

  Vue.prototype.$forceUpdate = function () {
    const vm: Component = this
    if (vm._watcher) {
      vm._watcher.update()
    }
  }

  // 可以看出在 beforeDestroy 时所有Dom均存在，在destroyed时，啥都没了
  Vue.prototype.$destroy = function () {
    const vm: Component = this
    if (vm._isBeingDestroyed) {
      return
    }
    callHook(vm, 'beforeDestroy')
    vm._isBeingDestroyed = true
    // remove self from parent
    // 从 parent 的 $children 中删掉自身
    const parent = vm.$parent
    if (parent && !parent._isBeingDestroyed && !vm.$options.abstract) {
      remove(parent.$children, vm)
    }
    // teardown watchers
    // 删除 watcher
    if (vm._watcher) {
      vm._watcher.teardown()
    }
    let i = vm._watchers.length
    while (i--) {
      vm._watchers[i].teardown()
    }
    // remove reference from data ob
    // frozen object may not have observer.
    if (vm._data.__ob__) {
      vm._data.__ob__.vmCount--
    }
    // call the last hook...
    vm._isDestroyed = true
    // invoke destroy hooks on current rendered tree
    // 触发它子组件的销毁钩子函数
    vm.__patch__(vm._vnode, null)
    // fire destroyed hook
    callHook(vm, 'destroyed')
    // turn off all instance listeners.
    // 卸载所有实例的监听
    vm.$off()
    // remove __vue__ reference
    if (vm.$el) {
      vm.$el.__vue__ = null
    }
    // release circular reference (#6759)
    if (vm.$vnode) {
      vm.$vnode.parent = null
    }
  }
}

// 用于完成渲染工作
export function mountComponent (
  vm: Component,
  el: ?Element,
  hydrating?: boolean
): Component {
  vm.$el = el

  // 给render赋值，用于模板编译（template转为jsx语法）
  if (!vm.$options.render) {
    vm.$options.render = createEmptyVNode
  }
  // 先执行挂载前的生命钩子 -> 在render之前(此时虚拟DOM还没生成)
  callHook(vm, 'beforeMount')

  const updateComponent = () => {
    // 调用 vm._render 方法先生成虚拟 Node，最终调用 vm._update 更新 DOM
    // 在生成 VNODE 过程中会对 vm 上的数据访问，这个时候就触发了数据对象的 getter
    vm._update(vm._render(), hydrating)
  }

  // Watcher 在这里起到两个作用，一个是初始化的时候会执行回调函数，另一个是当 vm 实例中的监测的数据发生变化的时候执行回调函数
  vm._watcher = new Watcher(vm, updateComponent, noop)
  hydrating = false

  // manually mounted instance, call mounted on self
  // mounted is called for render-created child components in its inserted hook
  // vm.$vnode 表示 Vue 实例的父虚拟 Node -> 它为 Null 则表示当前是根 Vue 的实例
  // $vnode == document.parent 当没有父级时为null
  // 这里的mounted只在 new Vue这种实例化过程中执行, 组件的mounted 在 src\core\vdom\create-component.js的 insert 执行 [先子后父]
  if (vm.$vnode == null) {
    // 设置 vm._isMounted 为 true， 表示这个实例已经挂载了
    vm._isMounted = true
    // 执行mounted钩子
    callHook(vm, 'mounted')
  }
  return vm
}

// 更新组件实例的一些属性
// vnode 对应的实例 vm 的一系列属性也会发生变化，包括占位符 vm.$vnode 的更新、slot 的更新，listeners 的更新，props 的更新等等。
export function updateChildComponent (
  vm: Component,
  propsData: ?Object, // 父组件传递的 props 数据
  listeners: ?Object,
  parentVnode: VNode,
  renderChildren: ?Array<VNode>
) {
  if (process.env.NODE_ENV !== 'production') {
    isUpdatingChildComponent = true
  }

  // determine whether component has slot children
  // we need to do this before overwriting $options._renderChildren
  // 判断是否含有slot
  const hasChildren = !!(
    renderChildren ||               // has new static slots
    vm.$options._renderChildren ||  // has old static slots
    parentVnode.data.scopedSlots || // has new scoped slots
    vm.$scopedSlots !== emptyObject // has old scoped slots
  )

  vm.$options._parentVnode = parentVnode
  vm.$vnode = parentVnode // update vm's placeholder node without re-render

  if (vm._vnode) { // update child tree's parent
    vm._vnode.parent = parentVnode
  }
  vm.$options._renderChildren = renderChildren

  // update $attrs and $listeners hash
  // these are also reactive so they may trigger child update if the child
  // used them during render
  vm.$attrs = (parentVnode.data && parentVnode.data.attrs) || emptyObject
  vm.$listeners = listeners || emptyObject

  // update props
  if (propsData && vm.$options.props) {
    observerState.shouldConvert = false
    const props = vm._props // 子组件的 props 值，
    const propKeys = vm.$options._propKeys || [] // initProps 过程中，缓存的子组件中定义的所有 prop 的 key
    for (let i = 0; i < propKeys.length; i++) {
      const key = propKeys[i]
      // 重新验证和计算新的 prop 数据
      // 更新 vm._props，也就是子组件的 props
      props[key] = validateProp(key, vm.$options.props, propsData, vm)
    }
    observerState.shouldConvert = true
    // keep a copy of raw propsData
    vm.$options.propsData = propsData
  }

  // update listeners
  if (listeners) {
    const oldListeners = vm.$options._parentListeners
    vm.$options._parentListeners = listeners
    updateComponentListeners(vm, listeners, oldListeners)
  }
  // resolve slots + force update if has children
  // 如果有slot
  if (hasChildren) {
    vm.$slots = resolveSlots(renderChildren, parentVnode.context)
    // 触发keep-alive的 $forceUpdate 方法
    // 重新执行 <keep-alive> 的 render 方法
    vm.$forceUpdate()
  }

  if (process.env.NODE_ENV !== 'production') {
    isUpdatingChildComponent = false
  }
}

function isInInactiveTree (vm) {
  while (vm && (vm = vm.$parent)) {
    if (vm._inactive) return true
  }
  return false
}

export function activateChildComponent (vm: Component, direct?: boolean) {
  if (direct) {
    vm._directInactive = false
    if (isInInactiveTree(vm)) {
      return
    }
  } else if (vm._directInactive) {
    return
  }
  if (vm._inactive || vm._inactive === null) {
    vm._inactive = false
    for (let i = 0; i < vm.$children.length; i++) {
      activateChildComponent(vm.$children[i])
    }
    callHook(vm, 'activated')
  }
}

export function deactivateChildComponent (vm: Component, direct?: boolean) {
  if (direct) {
    vm._directInactive = true
    if (isInInactiveTree(vm)) {
      return
    }
  }
  if (!vm._inactive) {
    vm._inactive = true
    for (let i = 0; i < vm.$children.length; i++) {
      deactivateChildComponent(vm.$children[i])
    }
    callHook(vm, 'deactivated')
  }
}

export function callHook (vm: Component, hook: string) {
  const handlers = vm.$options[hook]
  if (handlers) {
    for (let i = 0, j = handlers.length; i < j; i++) {
      try {
        // 执行生命周期
        handlers[i].call(vm)
      } catch (e) {
        handleError(e, vm, `${hook} hook`)
      }
    }
  }
  if (vm._hasHookEvent) {
    // 建立生命周期钩子,可以用vm.$on('hook:created', () =>{}) 来触发钩子
    vm.$emit('hook:' + hook)
  }
}
