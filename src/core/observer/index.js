/* @flow */

import Dep from './dep'
import VNode from '../vdom/vnode'
import { arrayMethods } from './array'
import {
  def, // src\core\util\lang.js
  warn,
  hasOwn,
  hasProto, // src\core\util\env.js
  isObject,
  isPlainObject,
  isValidArrayIndex,
  isServerRendering
} from '../util/index'

const arrayKeys = Object.getOwnPropertyNames(arrayMethods)

/**
 * By default, when a reactive property is set, the new value is
 * also converted to become reactive. However when passing down props,
 * we don't want to force conversion because the value may be a nested value
 * under a frozen data structure. Converting it would defeat the optimization.
 */
export const observerState = {
  shouldConvert: true
}

/**
 * Observer class that are attached to each observed
 * object. Once attached, the observer converts target
 * object's property keys into getter/setters that
 * collect dependencies and dispatches updates.
 * 给对象的属性添加 getter 和 setter，用于依赖收集和派发更新
 */
export class Observer {
  value: any;
  dep: Dep;
  vmCount: number; // number of vms that has this object as root $data

  constructor (value: any) {
    this.value = value
    this.dep = new Dep()
    this.vmCount = 0
    // 把自身实例添加到数据对象 value 的 __ob__ 属性上
    def(value, '__ob__', this)
    if (Array.isArray(value)) {
      const augment = hasProto // 是否有__proto__
        ? protoAugment
        : copyAugment
        // 如果是copyAugment 相当于 value[arrayKeys] = arrayMethods
        // protoAugment ->  就把 value 的原型指向了 arrayMethods
        // arrayMethods ——> src\core\observer\array.js
      augment(value, arrayMethods, arrayKeys)
      this.observeArray(value)
    } else {
      this.walk(value)
    }
  }

  /**
   * Walk through each property and convert them into
   * getter/setters. This method should only be called when
   * value type is Object.
   */
  walk (obj: Object) {
    const keys = Object.keys(obj)
    for (let i = 0; i < keys.length; i++) {
      defineReactive(obj, keys[i], obj[keys[i]])
    }
  }

  /**
   * Observe a list of Array items.
   */
  observeArray (items: Array<any>) {
    for (let i = 0, l = items.length; i < l; i++) {
      observe(items[i])
    }
  }
}

// helpers

/**
 * Augment an target Object or Array by intercepting
 * the prototype chain using __proto__
 * 直接把 target.__proto__ 原型直接修改为 src
 */
function protoAugment (target, src: Object, keys: any) {
  /* eslint-disable no-proto */
  target.__proto__ = src
  /* eslint-enable no-proto */
}

/**
 * Augment an target Object or Array by defining
 * hidden properties.
 * 遍历 keys，通过 def，也就是 Object.defineProperty 去定义它自身的属性值
 */
/* istanbul ignore next */
function copyAugment (target: Object, src: Object, keys: Array<string>) {
  for (let i = 0, l = keys.length; i < l; i++) {
    const key = keys[i]
    def(target, key, src[key])
  }
}

/**
*尝试为一个值创建一个观察者实例，
*如果观察成功，返回新的观察者，
*或现有的观察者，如果值已经有一个。
给非 VNode 的对象类型数据添加一个 Observer，
如果已经添加过则直接返回，否则在满足一定条件下去实例化一个 Observer 对象实例
@ 从src\core\instance\state.js 过来 -》 value: 绑定再option的data ； asRootData -》true
一般来说value是对象，然后直接走的walk，
如果是数组，有个遍历，数组每个对象都绑定__ob__.然后再用这个对象走walk
 */
export function observe (value: any, asRootData: ?boolean): Observer | void {
  if (!isObject(value) || value instanceof VNode) {
    return
  }
  let ob: Observer | void
  if (hasOwn(value, '__ob__') && value.__ob__ instanceof Observer) {
    ob = value.__ob__
  } else if (
    observerState.shouldConvert &&
    !isServerRendering() &&
    (Array.isArray(value) || isPlainObject(value)) &&
    Object.isExtensible(value) &&
    !value._isVue
  ) {
    // 创建监听器
    ob = new Observer(value)
  }
  if (asRootData && ob) {
    ob.vmCount++
  }
  return ob
}

/**
 * 在对象上定义反应性属性。
 * 对象动态添加 getter 和 setter
 */
export function defineReactive (
  obj: Object, // Vue绑定的data值
  key: string, // data的key
  val: any, // data的key对应值
  customSetter?: ?Function,
  shallow?: boolean
) {
  // 初始化 Dep 对象的实例
  const dep = new Dep()

  // 拿到 obj 的属性描述符
  const property = Object.getOwnPropertyDescriptor(obj, key)
  // 如果不可配置直接返回
  // 执行过toggleObserving(false)后会直接返回 property.configurable == false
  if (property && property.configurable === false) {
    return
  }

  // cater for pre-defined getter/setters
  // obj获取key的get/set
  const getter = property && property.get
  const setter = property && property.set

  // 给每个data的子对象都绑定了__ob__,并且知道递归到基本类型 childOb为 null；
  let childOb = !shallow && observe(val)
  // 为他的所有值绑定监听
  Object.defineProperty(obj, key, {
    enumerable: true,
    configurable: true,
    get: function reactiveGetter () {
      const value = getter ? getter.call(obj) : val
      if (Dep.target) {
        // 通过 dep.depend 做依赖收集
        // 此时这个 Dep.target 是一个watcher得实例
        dep.depend()
        // 如果是对象（则继续递归）
        if (childOb) {
          childOb.dep.depend() // 执行watcher得depend方法
          if (Array.isArray(value)) {
            dependArray(value)
          }
        }
      }
      return value
    },
    set: function reactiveSetter (newVal) {
      const value = getter ? getter.call(obj) : val
      /* eslint-disable no-self-compare */
      if (newVal === value || (newVal !== newVal && value !== value)) {
        return
      }
      /* eslint-enable no-self-compare */
      if (process.env.NODE_ENV !== 'production' && customSetter) {
        customSetter()
      }
      if (setter) {
        setter.call(obj, newVal)
      } else {
        val = newVal
      }
      // 如果 shallow 为 false 的情况对新设置的值变成一个响应式对象
      childOb = !shallow && observe(newVal)
      // dep的实例更新 通知所有的订阅者
      dep.notify()
    }
  })
}

/**
 * 设置对象的属性。添加新属性和
*  如果属性没有更改，则触发更改通知
*  已经存在。
*  target 可能是数组或者是普通对象，key 代表的是数组的下标或者是对象的键值，val 代表添加的值
 */
export function set (target: Array<any> | Object, key: any, val: any): any {
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    target.length = Math.max(target.length, key)
    target.splice(key, 1, val)
    return val
  }
  if (hasOwn(target, key)) {
    target[key] = val
    return val
  }
  // __ob__: 它是在 Observer 的构造函数执行的时候初始化的，表示 Observer 的一个实例，
  // 如果它不存在，则说明 target 不是一个响应式的对象
  const ob = (target: any).__ob__
  if (target._isVue || (ob && ob.vmCount)) {
    // 若__ob__不存在则直接返回
    return val
  }
  if (!ob) {
    target[key] = val
    return val
  }
  // 绑定的响应式data都再ob的value上 ---> 46行
  defineReactive(ob.value, key, val)
  ob.dep.notify()
  return val
}

/**
 * 删除属性并在必要时触发更改。
 */
export function del (target: Array<any> | Object, key: any) {
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    target.splice(key, 1)
    return
  }
  const ob = (target: any).__ob__
  if (target._isVue || (ob && ob.vmCount)) {
    return
  }
  if (!hasOwn(target, key)) {
    return
  }
  delete target[key]
  if (!ob) {
    return
  }
  ob.dep.notify()
}

/**
 * 当数组被触摸时，收集数组元素的依赖项，因为
 * 我们不能拦截数组元素访问像属性getter。
 */
function dependArray (value: Array<any>) {
  for (let e, i = 0, l = value.length; i < l; i++) {
    e = value[i]
    e && e.__ob__ && e.__ob__.dep.depend()
    if (Array.isArray(e)) {
      dependArray(e)
    }
  }
}

/**
 * In some cases we may want to disable observation inside a component's
 * update computation.
 */
// 用来控制在 observe 的过程中是否需要把当前值变成一个 Observer 对象。
// shouldObserve属性设置为true,表示应该监听
var shouldObserve = true
export function toggleObserving (value) {
  shouldObserve = value
}
