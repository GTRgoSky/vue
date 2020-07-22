/* @flow */

import { warn } from './debug'
import { observe, observerState } from '../observer/index'
import {
  hasOwn,
  isObject,
  toRawType,
  hyphenate,
  capitalize,
  isPlainObject
} from 'shared/util'

type PropOptions = {
  type: Function | Array<Function> | null,
  default: any,
  required: ?boolean,
  validator: ?Function
};

// 处理 Boolean 类型的数据，处理默认数据，prop 断言，并最终返回 prop 的值。
/**
 *
 * @param {props得key值} key
 * @param {props对象} propOptions
 * @param {父级传来的props数据} propsData
 * @param {*} vm
 */
export function validateProp (
  key: string,
  propOptions: Object,
  propsData: Object,
  vm?: Component
): any {
  // 获取自身prop得相应对象
  const prop = propOptions[key]
  // 如果父级有对应的key，则为false
  const absent = !hasOwn(propsData, key)
  let value = propsData[key]
  // handle boolean props
  // 处理 boolean 类型
  // 首先判断是否是Boolean类型
  // prop 可能是数组，如果市数组就要遍历查询是否包含满足类型得值
  if (isType(Boolean, prop.type)) {
    // 如果 父级没用对应的prop，且自身没有default属性，则value = false
    if (absent && !hasOwn(prop, 'default')) {
      value = false
    } else if (!isType(String, prop.type) && (value === '' || value === hyphenate(key))) {
      value = true
    }
  }
  // check default value
  // 父组件根本就没有传这个 prop
  if (value === undefined) {
    // 获取这个 prop 的默认值
    value = getPropDefaultValue(vm, prop, key)
    // since the default value is a fresh copy,
    // make sure to observe it.
    const prevShouldConvert = observerState.shouldConvert
    observerState.shouldConvert = true
    observe(value)
    observerState.shouldConvert = prevShouldConvert
  }
  if (process.env.NODE_ENV !== 'production') {
    // 执行 assertProp 做属性断言
    assertProp(prop, key, value, vm, absent)
  }
  return value
}

/**
 * Get the default value of a prop.
 */
function getPropDefaultValue (vm: ?Component, prop: PropOptions, key: string): any {
  // no default, return undefined
  // 如果 prop 没有定义 default 属性，那么返回 undefined
  if (!hasOwn(prop, 'default')) {
    return undefined
  }
  const def = prop.default
  // warn against non-factory defaults for Object & Array
  // 开发环境下对 prop 的默认值是否为对象或者数组类型的判断，如果是的话会报警告，
  // 因为对象和数组类型的 prop，他们的默认值必须要返回一个工厂函数
  if (process.env.NODE_ENV !== 'production' && isObject(def)) {
    warn(
      'Invalid default value for prop "' + key + '": ' +
      'Props with type Object/Array must use a factory function ' +
      'to return the default value.',
      vm
    )
  }
  // the raw prop value was also undefined from previous render,
  // return previous default value to avoid unnecessary watcher trigger
  // 如果上一次组件渲染父组件传递的 prop 的值是 undefined，
  // 则直接返回 上一次的默认值 vm._props[key]，这样可以避免触发不必要的 watcher 的更新
  if (vm && vm.$options.propsData &&
    vm.$options.propsData[key] === undefined &&
    vm._props[key] !== undefined
  ) {
    return vm._props[key]
  }
  // call factory function for non-Function types
  // a value is Function if its prototype is function even across different execution context
  // 判断 def 如果是工厂函数且 prop 的类型不是 Function 的时候，返回工厂函数的返回值，否则直接返回 def。
  return typeof def === 'function' && getType(prop.type) !== 'Function'
    ? def.call(vm)
    : def
}

/**
 * Assert whether a prop is valid.
 * 断言这个 prop 是否合法。
 */
function assertProp (
  prop: PropOptions,
  name: string,
  value: any,
  vm: ?Component,
  absent: boolean
) {
  // 首先判断如果 prop 定义了 required 属性但父组件没有传递这个 prop 数据的话会报一个警告。
  if (prop.required && absent) {
    warn(
      'Missing required prop: "' + name + '"',
      vm
    )
    return
  }

  // 接着判断如果 value 为空且 prop 没有定义 required 属性则直接返回
  if (value == null && !prop.required) {
    return
  }
  let type = prop.type
  let valid = !type || type === true
  const expectedTypes = []
  if (type) {
    if (!Array.isArray(type)) {
      type = [type]
    }
    for (let i = 0; i < type.length && !valid; i++) {
      // 再去对 prop 的类型做校验，先是拿到 prop 中定义的类型 type，并尝试把它转成一个类型数组，然后依次遍历这个数组，
      // 执行 assertType(value, type[i]) 去获取断言的结果，直到遍历完成或者是 valid 为 true 的时候跳出循环。
      const assertedType = assertType(value, type[i])
      expectedTypes.push(assertedType.expectedType || '')
      valid = assertedType.valid
    }
  }

  // 如果循环结束后 valid 仍然为 false，那么说明 prop 的值 value 与 prop 定义的类型都不匹配，
  if (!valid) {
    warn(
      `Invalid prop: type check failed for prop "${name}".` +
      ` Expected ${expectedTypes.map(capitalize).join(', ')}` +
      `, got ${toRawType(value)}.`,
      vm
    )
    return
  }

  // prop得validator属性
  // 判断当 prop 自己定义了 validator 自定义校验器，则执行 validator 校验器方法，如果校验不通过则输出警告信息
  const validator = prop.validator
  if (validator) {
    if (!validator(value)) {
      warn(
        'Invalid prop: custom validator check failed for prop "' + name + '".',
        vm
      )
    }
  }
}

const simpleCheckRE = /^(String|Number|Boolean|Function|Symbol)$/

function assertType (value: any, type: Function): {
  valid: boolean;
  expectedType: string;
} {
  let valid
  // 先通过 getType(type) 获取 prop 期望的类型 expectedType
  const expectedType = getType(type)
  // 根据几种不同的情况对比 prop 的值 value 是否和 expectedType 匹配
  if (simpleCheckRE.test(expectedType)) {
    const t = typeof value
    valid = t === expectedType.toLowerCase()
    // for primitive wrapper objects
    if (!valid && t === 'object') {
      valid = value instanceof type
    }
  } else if (expectedType === 'Object') {
    valid = isPlainObject(value)
  } else if (expectedType === 'Array') {
    valid = Array.isArray(value)
  } else {
    valid = value instanceof type
  }

  // 返回匹配的结果
  return {
    valid,
    expectedType
  }
}

/**
 * Use function string name to check built-in types,
 * because a simple equality check will fail when running
 * across different vms / iframes.
 */
function getType (fn) {
  const match = fn && fn.toString().match(/^\s*function (\w+)/)
  return match ? match[1] : ''
}

function isType (type, fn) {
  if (!Array.isArray(fn)) {
    return getType(fn) === getType(type)
  }
  for (let i = 0, len = fn.length; i < len; i++) {
    if (getType(fn[i]) === getType(type)) {
      return true
    }
  }
  /* istanbul ignore next */
  return false
}
