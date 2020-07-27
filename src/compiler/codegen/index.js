/* @flow */

import { genHandlers } from './events'
import baseDirectives from '../directives/index'
import { camelize, no, extend } from 'shared/util'
import { baseWarn, pluckModuleFunction } from '../helpers'

type TransformFunction = (el: ASTElement, code: string) => string;
type DataGenFunction = (el: ASTElement) => string;
type DirectiveFunction = (el: ASTElement, dir: ASTDirective, warn: Function) => boolean;

export class CodegenState {
  options: CompilerOptions;
  warn: Function;
  transforms: Array<TransformFunction>;
  dataGenFns: Array<DataGenFunction>;
  directives: { [key: string]: DirectiveFunction };
  maybeComponent: (el: ASTElement) => boolean;
  onceId: number;
  staticRenderFns: Array<string>;

  constructor (options: CompilerOptions) {
    this.options = options
    this.warn = options.warn || baseWarn
    this.transforms = pluckModuleFunction(options.modules, 'transformCode')
    this.dataGenFns = pluckModuleFunction(options.modules, 'genData')
    this.directives = extend(extend({}, baseDirectives), options.directives)
    const isReservedTag = options.isReservedTag || no
    this.maybeComponent = (el: ASTElement) => !isReservedTag(el.tag)
    this.onceId = 0
    this.staticRenderFns = []
  }
}

export type CodegenResult = {
  render: string,
  staticRenderFns: Array<string>
};

// 将AST编译成可执行的代码
/**
 *
 * @param {编译生成的AST template src\compiler\create-compiler.js} ast
 * @param {经过 createCompiler 处理的 平台配置 src\compiler\create-compiler.js} options
 */
export function generate (
  ast: ASTElement | void,
  options: CompilerOptions
): CodegenResult {
  // state 实例化CodegenState 将指令 directives 绑定到 实例上
  const state = new CodegenState(options)
  // 首先通过 genElement(ast, state) 生成 code
  const code = ast ? genElement(ast, state) : '_c("div")'
  // 再把 code 用 with(this){return ${code}}} 包裹起来
  return {
    render: `with(this){return ${code}}`,
    staticRenderFns: state.staticRenderFns
  }
}

export function genElement (el: ASTElement, state: CodegenState): string {
  if (el.staticRoot && !el.staticProcessed) {
    return genStatic(el, state)
  } else if (el.once && !el.onceProcessed) {
    return genOnce(el, state)
  } else if (el.for && !el.forProcessed) {
    return genFor(el, state)
  } else if (el.if && !el.ifProcessed) {
    return genIf(el, state)
  } else if (el.tag === 'template' && !el.slotTarget) {
    return genChildren(el, state) || 'void 0'
  } else if (el.tag === 'slot') {
    return genSlot(el, state)
  } else {
    // component or element
    let code
    if (el.component) {
      code = genComponent(el.component, el, state)
    } else {
      const data = el.plain ? undefined : genData(el, state)

      const children = el.inlineTemplate ? null : genChildren(el, state, true)
      code = `_c('${el.tag}'${
        data ? `,${data}` : '' // data
      }${
        children ? `,${children}` : '' // children
      })`
    }
    // module transforms
    for (let i = 0; i < state.transforms.length; i++) {
      code = state.transforms[i](el, code)
    }
    return code
  }
}

// hoist static sub-trees out
function genStatic (el: ASTElement, state: CodegenState): string {
  el.staticProcessed = true
  state.staticRenderFns.push(`with(this){return ${genElement(el, state)}}`)
  return `_m(${state.staticRenderFns.length - 1}${el.staticInFor ? ',true' : ''})`
}

// v-once
function genOnce (el: ASTElement, state: CodegenState): string {
  el.onceProcessed = true
  if (el.if && !el.ifProcessed) {
    return genIf(el, state)
  } else if (el.staticInFor) {
    let key = ''
    let parent = el.parent
    while (parent) {
      if (parent.for) {
        key = parent.key
        break
      }
      parent = parent.parent
    }
    if (!key) {
      process.env.NODE_ENV !== 'production' && state.warn(
        `v-once can only be used inside v-for that is keyed. `
      )
      return genElement(el, state)
    }
    return `_o(${genElement(el, state)},${state.onceId++},${key})`
  } else {
    return genStatic(el, state)
  }
}

export function genIf (
  el: any,
  state: CodegenState,
  altGen?: Function,
  altEmpty?: string
): string {
  el.ifProcessed = true // avoid recursion
  return genIfConditions(el.ifConditions.slice(), state, altGen, altEmpty)
}

function genIfConditions (
  conditions: ASTIfConditions,
  state: CodegenState,
  altGen?: Function,
  altEmpty?: string
): string {
  if (!conditions.length) {
    return altEmpty || '_e()'
  }

  // 依次从 conditions 获取第一个 condition
  const condition = conditions.shift()
  // 通过对 condition.exp 去生成一段三元运算符的代码
  if (condition.exp) {
    // 后是递归调用 genIfConditions
    return `(${condition.exp})?${
      genTernaryExp(condition.block)
    }:${
      genIfConditions(conditions, state, altGen, altEmpty)
    }`
  } else {
    return `${genTernaryExp(condition.block)}`
  }

  // v-if with v-once should generate code like (a)?_m(0):_m(1)
  function genTernaryExp (el) {
    return altGen
      ? altGen(el, state)
      : el.once
        ? genOnce(el, state)
        : genElement(el, state)
  }
}

export function genFor (
  el: any,
  state: CodegenState,
  altGen?: Function,
  altHelper?: string
): string {
  const exp = el.for
  const alias = el.alias
  const iterator1 = el.iterator1 ? `,${el.iterator1}` : ''
  const iterator2 = el.iterator2 ? `,${el.iterator2}` : ''

  if (process.env.NODE_ENV !== 'production' &&
    state.maybeComponent(el) &&
    el.tag !== 'slot' &&
    el.tag !== 'template' &&
    !el.key
  ) {
    state.warn(
      `<${el.tag} v-for="${alias} in ${exp}">: component lists rendered with ` +
      `v-for should have explicit keys. ` +
      `See https://vuejs.org/guide/list.html#key for more info.`,
      true /* tip */
    )
  }

  el.forProcessed = true // avoid recursion
  return `${altHelper || '_l'}((${exp}),` +
    `function(${alias}${iterator1}${iterator2}){` +
      `return ${(altGen || genElement)(el, state)}` +
    '})'
}

export function genData (el: ASTElement, state: CodegenState): string {
  let data = '{'

  // directives first.
  // directives may mutate the el's other properties before they are generated.
  const dirs = genDirectives(el, state)
  if (dirs) data += dirs + ','

  // 根据指令生成一些 data 的代码
  // key
  if (el.key) {
    data += `key:${el.key},`
  }
  // ref
  if (el.ref) {
    data += `ref:${el.ref},`
  }
  if (el.refInFor) {
    data += `refInFor:true,`
  }
  // pre
  if (el.pre) {
    data += `pre:true,`
  }
  // record original tag name for components using "is" attribute
  if (el.component) {
    data += `tag:"${el.tag}",`
  }
  // module data generation functions
  for (let i = 0; i < state.dataGenFns.length; i++) {
    data += state.dataGenFns[i](el)
  }
  // attributes
  if (el.attrs) {
    data += `attrs:{${genProps(el.attrs)}},`
  }
  // DOM props
  if (el.props) {
    data += `domProps:{${genProps(el.props)}},`
  }
  // event handlers
  if (el.events) {
    data += `${genHandlers(el.events, false, state.warn)},`
  }
  if (el.nativeEvents) {
    data += `${genHandlers(el.nativeEvents, true, state.warn)},`
  }
  // slot target
  // only for non-scoped slots
  if (el.slotTarget && !el.slotScope) {
    // 给 data 添加一个 slot 属性，并指向 slotTarget（生成内容见slot.md-代码块1-slot属性）
    data += `slot:${el.slotTarget},`
  }
  // scoped slots
  if (el.scopedSlots) {
    data += `${genScopedSlots(el.scopedSlots, state)},`
  }
  // component v-model **
  // 组件 v-model
  if (el.model) {
    data += `model:{value:${
      el.model.value
    },callback:${
      el.model.callback
    },expression:${
      el.model.expression
    }},`
  }
  // inline-template
  if (el.inlineTemplate) {
    const inlineTemplate = genInlineTemplate(el, state)
    if (inlineTemplate) {
      data += `${inlineTemplate},`
    }
  }
  data = data.replace(/,$/, '') + '}'
  // v-bind data wrap
  if (el.wrapData) {
    data = el.wrapData(data)
  }
  // v-on data wrap
  if (el.wrapListeners) {
    data = el.wrapListeners(data)
  }
  return data
}

// 遍历 el.directives 指令
function genDirectives (el: ASTElement, state: CodegenState): string | void {
  const dirs = el.directives
  if (!dirs) return
  let res = 'directives:['
  let hasRuntime = false
  let i, l, dir, needRuntime
  for (i = 0, l = dirs.length; i < l; i++) {
    dir = dirs[i]
    needRuntime = true
    // 获取每一个指令的方法 （类似 v-model；v-html等）
    const gen: DirectiveFunction = state.directives[dir.name]
    if (gen) {
      // compile-time directive that manipulates AST.
      // returns true if it also needs a runtime counterpart.
      needRuntime = !!gen(el, dir, state.warn)
    }
    if (needRuntime) {
      hasRuntime = true
      res += `{name:"${dir.name}",rawName:"${dir.rawName}"${
        dir.value ? `,value:(${dir.value}),expression:${JSON.stringify(dir.value)}` : ''
      }${
        dir.arg ? `,arg:"${dir.arg}"` : ''
      }${
        dir.modifiers ? `,modifiers:${JSON.stringify(dir.modifiers)}` : ''
      }},`
    }
  }
  if (hasRuntime) {
    return res.slice(0, -1) + ']'
  }
}

function genInlineTemplate (el: ASTElement, state: CodegenState): ?string {
  const ast = el.children[0]
  if (process.env.NODE_ENV !== 'production' && (
    el.children.length !== 1 || ast.type !== 1
  )) {
    state.warn('Inline-template components must have exactly one child element.')
  }
  if (ast.type === 1) {
    const inlineRenderFns = generate(ast, state.options)
    return `inlineTemplate:{render:function(){${
      inlineRenderFns.render
    }},staticRenderFns:[${
      inlineRenderFns.staticRenderFns.map(code => `function(){${code}}`).join(',')
    }]}`
  }
}

// 对 scopedSlots 对象遍历
function genScopedSlots (
  slots: { [key: string]: ASTElement },
  state: CodegenState
): string {
  return `scopedSlots:_u([${
    Object.keys(slots).map(key => {
      // 执行 genScopedSlot，并把结果用逗号拼接
      return genScopedSlot(key, slots[key], state)
    }).join(',')
  }])`
}

// genScopedSlot 是先生成一段函数代码，并且函数的参数就是我们的 slotScope
function genScopedSlot (
  key: string,
  el: ASTElement,
  state: CodegenState
): string {
  if (el.for && !el.forProcessed) {
    return genForScopedSlot(key, el, state)
  }
  const fn = `function(${String(el.slotScope)}){` +
    `return ${el.tag === 'template'
      ? el.if
        ? `${el.if}?${genChildren(el, state) || 'undefined'}:undefined`
        : genChildren(el, state) || 'undefined'
      : genElement(el, state)
  }}`
  return `{key:${key},fn:${fn}}`
}

function genForScopedSlot (
  key: string,
  el: any,
  state: CodegenState
): string {
  const exp = el.for
  const alias = el.alias
  const iterator1 = el.iterator1 ? `,${el.iterator1}` : ''
  const iterator2 = el.iterator2 ? `,${el.iterator2}` : ''
  el.forProcessed = true // avoid recursion
  return `_l((${exp}),` +
    `function(${alias}${iterator1}${iterator2}){` +
      `return ${genScopedSlot(key, el, state)}` +
    '})'
}

export function genChildren (
  el: ASTElement,
  state: CodegenState,
  checkSkip?: boolean,
  altGenElement?: Function,
  altGenNode?: Function
): string | void {
  const children = el.children
  if (children.length) {
    const el: any = children[0]
    // optimize single v-for
    if (children.length === 1 &&
      el.for &&
      el.tag !== 'template' &&
      el.tag !== 'slot'
    ) {
      return (altGenElement || genElement)(el, state)
    }
    const normalizationType = checkSkip
      ? getNormalizationType(children, state.maybeComponent)
      : 0
    const gen = altGenNode || genNode
    return `[${children.map(c => gen(c, state)).join(',')}]${
      normalizationType ? `,${normalizationType}` : ''
    }`
  }
}

// determine the normalization needed for the children array.
// 0: no normalization needed
// 1: simple normalization needed (possible 1-level deep nested array)
// 2: full normalization needed
function getNormalizationType (
  children: Array<ASTNode>,
  maybeComponent: (el: ASTElement) => boolean
): number {
  let res = 0
  for (let i = 0; i < children.length; i++) {
    const el: ASTNode = children[i]
    if (el.type !== 1) {
      continue
    }
    if (needsNormalization(el) ||
        (el.ifConditions && el.ifConditions.some(c => needsNormalization(c.block)))) {
      res = 2
      break
    }
    if (maybeComponent(el) ||
        (el.ifConditions && el.ifConditions.some(c => maybeComponent(c.block)))) {
      res = 1
    }
  }
  return res
}

function needsNormalization (el: ASTElement): boolean {
  return el.for !== undefined || el.tag === 'template' || el.tag === 'slot'
}

function genNode (node: ASTNode, state: CodegenState): string {
  if (node.type === 1) {
    return genElement(node, state)
  } if (node.type === 3 && node.isComment) {
    return genComment(node)
  } else {
    return genText(node)
  }
}

export function genText (text: ASTText | ASTExpression): string {
  return `_v(${text.type === 2
    ? text.expression // no need for () because already wrapped in _s()
    : transformSpecialNewlines(JSON.stringify(text.text))
  })`
}

export function genComment (comment: ASTText): string {
  return `_e(${JSON.stringify(comment.text)})`
}

//
function genSlot (el: ASTElement, state: CodegenState): string {
  // slotName 从 AST 元素节点对应的属性上取
  const slotName = el.slotName || '"default"'
  const children = genChildren(el, state)
  let res = `_t(${slotName}${children ? `,${children}` : ''}`
  const attrs = el.attrs && `{${el.attrs.map(a => `${camelize(a.name)}:${a.value}`).join(',')}}`
  const bind = el.attrsMap['v-bind']
  if ((attrs || bind) && !children) {
    res += `,null`
  }
  if (attrs) {
    res += `,${attrs}`
  }
  if (bind) {
    res += `${attrs ? '' : ',null'},${bind}`
  }
  return res + ')'
}

// componentName is el.component, take it as argument to shun flow's pessimistic refinement
function genComponent (
  componentName: string,
  el: ASTElement,
  state: CodegenState
): string {
  const children = el.inlineTemplate ? null : genChildren(el, state, true)
  return `_c(${componentName},${genData(el, state)}${
    children ? `,${children}` : ''
  })`
}

function genProps (props: Array<{ name: string, value: string }>): string {
  let res = ''
  for (let i = 0; i < props.length; i++) {
    const prop = props[i]
    res += `"${prop.name}":${transformSpecialNewlines(prop.value)},`
  }
  return res.slice(0, -1)
}

// #3895, #4268
function transformSpecialNewlines (text: string): string {
  return text
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
}
