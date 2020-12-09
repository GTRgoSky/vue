/* @flow */

import { baseOptions } from './options'
import { createCompiler } from 'compiler/index'

// createCompiler执行的就是 src\compiler\create-compiler.js 【9】 createCompiler 方法
const { compile, compileToFunctions } = createCompiler(baseOptions)

export { compile, compileToFunctions }
