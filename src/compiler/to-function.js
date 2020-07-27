/* @flow */

import { noop, extend } from 'shared/util'
import { warn as baseWarn, tip } from 'core/util/debug'

type CompiledFunctionResult = {
  render: Function;
  staticRenderFns: Array<Function>;
};
/**
 * eg:
 *  <ul :class="bindCls" class="list" v-if="isShow">
        <li v-for="(item,index) in data" @click="clickItem(index)">{{item}}:{{index}}</li>
    </ul>
    render:
    with(this){
      return (isShow) ?
        _c('ul', {
            staticClass: "list",
            class: bindCls
          },
          _l((data), function(item, index) {
            return _c('li', {
              on: {
                "click": function($event) {
                  clickItem(index)
                }
              }
            },
            [_v(_s(item) + ":" + _s(index))])
          })
        ) : _e()
    }
 */
// 在 src/core/instance/render.js =》 vm._c = (a, b, c, d) => createElement(vm, a, b, c, d, false) => 生成render代码串
// 把这个 render 代码串转换成函数
// 把 render 代码串通过 new Function 的方式转换成可执行的函数，赋值给 vm.options.render，
// 这样当组件通过 vm._render 的时候，就会执行这个 render 函
function createFunction (code, errors) {
  try {
    return new Function(code)
  } catch (err) {
    errors.push({ err, code })
    return noop
  }
}

export function createCompileToFunctionFn (compile: Function): Function {
  const cache: {
    [key: string]: CompiledFunctionResult;
  } = Object.create(null)

  /**
   * 编译模板 template，编译配置 options 和 Vue 实例 vm
   */
  return function compileToFunctions (
    template: string,
    options?: CompilerOptions,
    vm?: Component
  ): CompiledFunctionResult {
    options = extend({}, options)
    const warn = options.warn || baseWarn
    delete options.warn

    /* istanbul ignore if */
    if (process.env.NODE_ENV !== 'production') {
      // detect possible CSP restriction
      try {
        new Function('return 1')
      } catch (e) {
        if (e.toString().match(/unsafe-eval|CSP/)) {
          warn(
            'It seems you are using the standalone build of Vue.js in an ' +
            'environment with Content Security Policy that prohibits unsafe-eval. ' +
            'The template compiler cannot work in this environment. Consider ' +
            'relaxing the policy to allow unsafe-eval or pre-compiling your ' +
            'templates into render functions.'
          )
        }
      }
    }

    // check cache
    const key = options.delimiters
      ? String(options.delimiters) + template
      : template
    if (cache[key]) {
      return cache[key]
    }

    // compile
    // 核心的编译过程
    // compile 是 createCompiler 函数中定义的 compile-》src\compiler\create-compiler.js
    const compiled = compile(template, options)

    // check compilation errors/tips
    if (process.env.NODE_ENV !== 'production') {
      if (compiled.errors && compiled.errors.length) {
        warn(
          `Error compiling template:\n\n${template}\n\n` +
          compiled.errors.map(e => `- ${e}`).join('\n') + '\n',
          vm
        )
      }
      if (compiled.tips && compiled.tips.length) {
        compiled.tips.forEach(msg => tip(msg, vm))
      }
    }

    // turn code into functions
    const res = {}
    const fnGenErrors = []
    res.render = createFunction(compiled.render, fnGenErrors)
    res.staticRenderFns = compiled.staticRenderFns.map(code => {
      return createFunction(code, fnGenErrors)
    })

    // check function generation errors.
    // this should only happen if there is a bug in the compiler itself.
    // mostly for codegen development use
    /* istanbul ignore if */
    if (process.env.NODE_ENV !== 'production') {
      if ((!compiled.errors || !compiled.errors.length) && fnGenErrors.length) {
        warn(
          `Failed to generate render function:\n\n` +
          fnGenErrors.map(({ err, code }) => `${err.toString()} in\n\n${code}\n`).join('\n'),
          vm
        )
      }
    }

    return (cache[key] = res)
  }
}
