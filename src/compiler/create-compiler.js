/* @flow */

import { extend } from 'shared/util'
import { detectErrors } from './error-detector'
import { createCompileToFunctionFn } from './to-function'

export function createCompilerCreator (baseCompile: Function): Function {
  // src\compiler\index.js 调用，接受一个baseOptions配置项-平台相关的一些配置
  return function createCompiler (baseOptions: CompilerOptions) {
    function compile (
      template: string,
      options?: CompilerOptions
    ): CompiledResult {
      // 先处理配置参数
      const finalOptions = Object.create(baseOptions)
      const errors = []
      const tips = []
      finalOptions.warn = (msg, tip) => {
        (tip ? tips : errors).push(msg)
      }

      if (options) {
        // merge custom modules
        if (options.modules) {
          finalOptions.modules =
            (baseOptions.modules || []).concat(options.modules)
        }
        // merge custom directives
        if (options.directives) {
          finalOptions.directives = extend(
            Object.create(baseOptions.directives),
            options.directives
          )
        }
        // copy other options
        for (const key in options) {
          if (key !== 'modules' && key !== 'directives') {
            finalOptions[key] = options[key]
          }
        }
      }

      // 执行编译过程
      // baseCompile-》src\compiler\index.js
      // 执行的就是 src\compiler\index.js 【21】 baseCompile方法
      const compiled = baseCompile(template, finalOptions)
      if (process.env.NODE_ENV !== 'production') {
        errors.push.apply(errors, detectErrors(compiled.ast))
      }
      compiled.errors = errors
      compiled.tips = tips
      return compiled
    }

    return {
      compile,
      compileToFunctions: createCompileToFunctionFn(compile) // 对应的就是 $mount 函数调用的 compileToFunctions 方法
    }
  }
}
