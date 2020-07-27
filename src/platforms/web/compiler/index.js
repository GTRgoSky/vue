/* @flow */

import { baseOptions } from './options'
import { createCompiler } from 'compiler/index'

// compileToFunctions 方法就是把模板 template 编译生成 render 以及 staticRenderFns
// createCompiler执行的就是 src\compiler\create-compiler.js 【9】 createCompiler 方法
const { compile, compileToFunctions } = createCompiler(baseOptions)

export { compile, compileToFunctions }
