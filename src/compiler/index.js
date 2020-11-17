/* @flow */

import { parse } from './parser/index'
import { optimize } from './optimizer'
import { generate } from './codegen/index'
import { createCompilerCreator } from './create-compiler'

// `createCompilerCreator` allows creating compilers that use alternative
// parser/optimizer/codegen, e.g the SSR optimizing compiler.
// Here we just export a default compiler using the default parts.
/**
 * src\platforms\web\compiler\index.js调用
 * options 来自 src\platforms\web\compiler\options.js
 *
 * createCompiler 方法实际上是通过调用 createCompilerCreator 方法返回的，
 * 该方法传入的参数是一个函数，真正的编译过程都在这个 baseCompile 函数里执行
 *
 * Vue.js 也是利用函数柯里化技巧把基础的编译过程函数抽出来，
 * 通过 createCompilerCreator(baseCompile) 的方式把真正编译的过程和其它逻辑如对编译配置处理、缓存处理等剥离开
 */
export const createCompiler = createCompilerCreator(function baseCompile (
  template: string,
  options: CompilerOptions
): CompiledResult {
  // 解析模板字符串生成 AST
  const ast = parse(template.trim(), options)
  if (options.optimize !== false) {
    // 优化语法树
    optimize(ast, options)
    // 生成代码
  }
  const code = generate(ast, options)
  return {
    ast,
    render: code.render,
    staticRenderFns: code.staticRenderFns
  }
})
