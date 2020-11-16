/* @flow */

import config from '../config'
import Watcher from '../observer/watcher'
import Dep, { pushTarget, popTarget } from '../observer/dep'
import { isUpdatingChildComponent } from './lifecycle'

import {
  set,
  del,
  observe,
  defineReactive,
  toggleObserving
} from '../observer/index'

import {
  warn,
  bind,
  noop, // 应该是一个空的function（接受3个任意类型参)
  hasOwn,
  hyphenate,
  isReserved,
  handleError,
  nativeWatch,
  validateProp,
  isPlainObject,
  isServerRendering,
  isReservedAttribute
} from '../util/index'

const sharedPropertyDefinition = {
  enumerable: true,
  configurable: true,
  get: noop,
  set: noop
}

// 将 this._data.key  => 对应到 this.key 的值
// this._prop.key => this.key
export function proxy (target: Object, sourceKey: string, key: string) {
  sharedPropertyDefinition.get = function proxyGetter () {
    return this[sourceKey][key]
  }
  sharedPropertyDefinition.set = function proxySetter (val) {
    this[sourceKey][key] = val
  }
  Object.defineProperty(target, key, sharedPropertyDefinition)
}

export function initState (vm: Component) {
  vm._watchers = []
  const opts = vm.$options
  // 绑定props =》 initProps 主要做 3 件事情：校验、响应式和代理。
  if (opts.props) initProps(vm, opts.props)
  if (opts.methods) initMethods(vm, opts.methods)
  if (opts.data) {
    initData(vm)
  } else {
    observe(vm._data = {}, true /* asRootData */)
  }
  // 计算属性
  // 生成computed-watcher
  // 并且他的Dep里面绑定了其他相关data-watcher
  // 只要依赖的响应data-watcher值改变。就会触发方法
  // 若改变的值是非响应值则不触发
  if (opts.computed) initComputed(vm, opts.computed)
  // watch
  if (opts.watch && opts.watch !== nativeWatch) {
    initWatch(vm, opts.watch)
  }
}

// propsOptions 传入的props =》 propsOptions 就是我们定义的 props 在规范后生成的 options.props 对象
// 当写入得props是数组时，propsOptions =》 {type: [传入的值]} eg:  todo: ["1", "2"] => todo: {type: [1,2]}
// 当父组件只写了一个标签，则默认为空字符串 <p todo>
/**
 * 1、正常修改props 则会在 src\core\instance\lifecycle.js （249）行触发更新
 * 2、若修改的是props的深层子元素，则在修改后，因为子组件用到了这个值，所以会把这个prop的watcher放入依赖。
 * 当我们修改props会触发依赖，通知子组件从新渲染。
 */
function initProps (vm: Component, propsOptions: Object) {
  // 从父组件传递的 prop 数据 - 标签上写的数据
  const propsData = vm.$options.propsData || {}
  const props = vm._props = {}
  // cache prop keys so that future props updates can iterate using Array
  // instead of dynamic object key enumeration.
  const keys = vm.$options._propKeys = []
  const isRoot = !vm.$parent
  // root instance props should be converted
  // toggle： 切换
  // 对于非根实例的情况，我们会执行 toggleObserving(false)，
  if (!isRoot) {
    toggleObserving(false)
  }
  // 然后对于每一个 prop 值，去执行 defineReactive(props, key, value) 去把它变成响应式。
  for (const key in propsOptions) {
    keys.push(key)
    // 1、校验
    // 校验的目的就是检查一下我们传递的数据是否满足 prop的定义规范
    const value = validateProp(key, propsOptions, propsData, vm)
    /* istanbul ignore else */
    if (process.env.NODE_ENV !== 'production') {
      // 校验 prop 的 key 是否是 HTML 的保留属性，并且在 defineReactive 的时候会添加一个自定义 setter
      const hyphenatedKey = hyphenate(key)
      if (isReservedAttribute(hyphenatedKey) ||
          config.isReservedAttr(hyphenatedKey)) {
        warn(
          `"${hyphenatedKey}" is a reserved attribute and cannot be used as component prop.`,
          vm
        )
      }
      defineReactive(props, key, value, () => {
        if (!isRoot && !isUpdatingChildComponent) {
          warn(
            `Avoid mutating a prop directly since the value will be ` +
            `overwritten whenever the parent component re-renders. ` +
            `Instead, use a data or computed property based on the prop's ` +
            `value. Prop being mutated: "${key}"`,
            vm
          )
        }
      })
    } else {
      // 把它变成响应式
      defineReactive(props, key, value)
    }
    // static props are already proxied on the component's prototype
    // during Vue.extend(). We only need to proxy props defined at
    // instantiation here.
    // 可以通过 vm._props.xxx 访问到定义 props 中对应的属性
    if (!(key in vm)) {
      proxy(vm, `_props`, key)
    }
  }
  toggleObserving(true)
}

function initData (vm: Component) {
  let data = vm.$options.data
  data = vm._data = typeof data === 'function'
    ? getData(data, vm)
    : data || {}
  if (!isPlainObject(data)) {
    data = {}
    process.env.NODE_ENV !== 'production' && warn(
      'data functions should return an object:\n' +
      'https://vuejs.org/v2/guide/components.html#data-Must-Be-a-Function',
      vm
    )
  }
  // proxy data on instance
  const keys = Object.keys(data)
  const props = vm.$options.props
  const methods = vm.$options.methods
  let i = keys.length
  while (i--) {
    const key = keys[i]
    if (process.env.NODE_ENV !== 'production') {
      if (methods && hasOwn(methods, key)) {
        warn(
          `Method "${key}" has already been defined as a data property.`,
          vm
        )
      }
    }
    // props告警和data的key重名
    if (props && hasOwn(props, key)) {
      process.env.NODE_ENV !== 'production' && warn(
        `The data property "${key}" is already declared as a prop. ` +
        `Use prop default value instead.`,
        vm
      )
    } else if (!isReserved(key)) {
      // 设置key到 vm._data的代理
      // 可以通过 vm._data.xxx 访问到定义 data 返回函数中对应的属性
      proxy(vm, `_data`, key)
    }
  }
  // observe data 重要
  // 监测数据的变化
  observe(data, true /* asRootData */)
}

export function getData (data: Function, vm: Component): any {
  // #7573 disable dep collection when invoking data getters
  pushTarget()
  try {
    return data.call(vm, vm)
  } catch (e) {
    handleError(e, vm, `data()`)
    return {}
  } finally {
    popTarget()
  }
}

const computedWatcherOptions = { lazy: true }

// 计算属性是一个 computed watcher
function initComputed (vm: Component, computed: Object) {
  // $flow-disable-line
  // 创建一个空对象
  const watchers = vm._computedWatchers = Object.create(null)
  // computed properties are just getters during SSR
  const isSSR = isServerRendering()

  // 遍历computed对象
  for (const key in computed) {
    const userDef = computed[key]
    // 判断userDef是一个对象还是一个方法，如果是一个对象，去找它的get函数
    const getter = typeof userDef === 'function' ? userDef : userDef.get
    if (process.env.NODE_ENV !== 'production' && getter == null) {
      warn(
        `Getter is missing for computed property "${key}".`,
        vm
      )
    }

    // 为每一个 getter 创建一个 watcher
    if (!isSSR) {
      // create internal（内部的） watcher for the computed property.
      watchers[key] = new Watcher(
        vm,
        getter || noop,
        noop,
        computedWatcherOptions
      )
    }

    // component-defined computed properties are already defined on the
    // component prototype. We only need to define computed properties defined
    // at instantiation here.
    // 判断computed的属性是否已经存在在vm实例上，如果是，则给出警告（在生产版本没有处理）
    // 如果不在则 - defineComputed
    if (!(key in vm)) {
      defineComputed(vm, key, userDef)
    } else if (process.env.NODE_ENV !== 'production') {
      if (key in vm.$data) {
        warn(`The computed property "${key}" is already defined in data.`, vm)
      } else if (vm.$options.props && key in vm.$options.props) {
        warn(`The computed property "${key}" is already defined as a prop.`, vm)
      }
    }
  }
}

// 利用 Object.defineProperty 给计算属性对应的 key 值添加 getter 和 setter
export function defineComputed (
  target: any,
  key: string,
  userDef: Object | Function
) {
  const shouldCache = !isServerRendering()
  if (typeof userDef === 'function') {
    // 缓存难点
    sharedPropertyDefinition.get = shouldCache
      ? createComputedGetter(key)
      : createGetterInvoker(userDef)
    sharedPropertyDefinition.set = noop
  } else {
    sharedPropertyDefinition.get = userDef.get
      ? shouldCache && userDef.cache !== false
        ? createComputedGetter(key)
        : createGetterInvoker(userDef.get)
      : noop
      // 获取对象的set函数否则是一个空对象
    sharedPropertyDefinition.set = userDef.set || noop
  }

  // sharedPropertyDefinition劫持描述，可配置可枚举
  // 绑定劫持，set和get被重新定以。
  Object.defineProperty(target, key, sharedPropertyDefinition)
}

/**
 *  computed: {
    fullName: function () {
      return this.firstName + ' ' + this.lastName
    }
  }
  */
function createComputedGetter (key) {
  return function computedGetter () {
    // _computedWatchers 在 181行创建了一个空对象
    // 再执行时key为 fullName
    const watcher = this._computedWatchers && this._computedWatchers[key]
    if (watcher) {
      // 在获取computed时，执行这里。
      // 获取时，先从缓存获取
      if (watcher.dirty) {
         // watcher 评估
        watcher.evaluate()
      }
      if (Dep.target) {
        // 第一次执行时：
        // 当我们的 render 函数执行访问到 this.fullName 的时候，
        // 就触发了计算属性的 getter，它会拿到计算属性对应的 watcher，
        // 然后执行 watcher.depend()
        // 这时候的 Dep.target 是渲染 watcher
        watcher.depend()
      }
      return watcher.value
    }
  }
}

function createGetterInvoker (fn) {
  return function computedGetter () {
    return fn.call(this, this)
  }
}

function initMethods (vm: Component, methods: Object) {
  const props = vm.$options.props
  for (const key in methods) {
    if (process.env.NODE_ENV !== 'production') {
      if (typeof methods[key] !== 'function') {
        warn(
          `Method "${key}" has type "${typeof methods[key]}" in the component definition. ` +
          `Did you reference the function correctly?`,
          vm
        )
      }
      if (props && hasOwn(props, key)) {
        warn(
          `Method "${key}" has already been defined as a prop.`,
          vm
        )
      }
      if ((key in vm) && isReserved(key)) {
        warn(
          `Method "${key}" conflicts with an existing Vue instance method. ` +
          `Avoid defining component methods that start with _ or $.`
        )
      }
    }
    vm[key] = typeof methods[key] !== 'function' ? noop : bind(methods[key], vm)
  }
}

/**
 *
 * @param {*Vue实例} vm
 * @param {*传入的watch对象} watch
 */
function initWatch (vm: Component, watch: Object) {
  for (const key in watch) {
    const handler = watch[key]
    if (Array.isArray(handler)) { // 如果是数组
      // 支持 watch 的同一个 key 对应多个 handler
      for (let i = 0; i < handler.length; i++) {
        createWatcher(vm, key, handler[i])
      }
    } else { // 如果是函数|对象
      createWatcher(vm, key, handler)
    }
  }
}

function createWatcher (
  vm: Component,
  expOrFn: string | Function,
  handler: any,
  options?: Object
) {
  if (isPlainObject(handler)) { // 绑定的watcher对应key的value值是否是对象
    options = handler
    handler = handler.handler // 如果市对象再handler上挂载的是执行方法
  }
  if (typeof handler === 'string') {
    // watch: {key: string}
    // methods: {string(){}}
    handler = vm[handler]
  }
  // 如果是函数直接执行
  return vm.$watch(expOrFn, handler, options)
}

export function stateMixin (Vue: Class<Component>) {
  // flow somehow has problems with directly declared definition object
  // when using Object.defineProperty, so we have to procedurally build up
  // the object here.
  const dataDef = {}
  dataDef.get = function () { return this._data }
  const propsDef = {}
  propsDef.get = function () { return this._props }
  if (process.env.NODE_ENV !== 'production') {
    dataDef.set = function () {
      warn(
        'Avoid replacing instance root $data. ' +
        'Use nested data properties instead.',
        this
      )
    }
    propsDef.set = function () {
      warn(`$props is readonly.`, this)
    }
  }
  Object.defineProperty(Vue.prototype, '$data', dataDef)
  Object.defineProperty(Vue.prototype, '$props', propsDef)

  Vue.prototype.$set = set
  Vue.prototype.$delete = del

  /**
   *
   * @param {watch的key} expOrFn
   * @param {回调函数} cb
   * @param {watch的配置项} options
   * watch: {
   *  a: expOrFn: {
   *    handler: cb,
   *  }: options
   * }
   */
  Vue.prototype.$watch = function (
    expOrFn: string | Function,
    cb: any,
    options?: Object
  ): Function {
    const vm: Component = this
    if (isPlainObject(cb)) {
      return createWatcher(vm, expOrFn, cb, options)
    }
    options = options || {}
    options.user = true // ***将user变为true
    // 实例化watcher
    // 一旦我们 watch 的数据发送变化，它最终会执行 watcher 的 run 方法
    const watcher = new Watcher(vm, expOrFn, cb, options)
    // 是否立即执行
    if (options.immediate) {
      try {
        cb.call(vm, watcher.value)
      } catch (error) {
        handleError(error, vm, `callback for immediate watcher "${watcher.expression}"`)
      }
    }
    // 返回了一个 unwatchFn 方法，它会调用 teardown 方法去移除这个 watcher。
    // var unwatch  = vm.$watch(key, handelr, options);
    // unwatch() 触发，销毁这个watch。若再immediate中，这个返回还没有，所以会报错
    return function unwatchFn () {
      watcher.teardown()
    }
  }
}
