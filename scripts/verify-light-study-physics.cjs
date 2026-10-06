// Compile the imported TypeScript tests to a temporary ESM tree, then run them
// against this site's adapted renderer (and this site's installed Three.js).
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const ts = require('typescript')
const root = path.resolve(__dirname, '..')
const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'jh-light-study-tests-'))
try {
  fs.symlinkSync(path.join(root, 'node_modules'), path.join(stage, 'node_modules'), 'dir')
  const compile = (directory, target) => {
    fs.mkdirSync(path.join(stage, target), { recursive: true })
    return fs.readdirSync(directory).filter(name => name.endsWith('.ts')).map(name => {
      const source = fs.readFileSync(path.join(directory, name), 'utf8')
        .replaceAll('../../components/home/light-study/', '../src/')
        .replace(/(from\s+['"])(\.[^'"]+?)(?:\.ts)?(['"])/g, '$1$2.mjs$3')
        .replace(/(import\(\s*['"])(\.[^'"]+?)(?:\.ts)?(['"])/g, '$1$2.mjs$3')
      const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText
      const output = path.join(stage, target, name.replace(/\.ts$/, '.mjs'))
      fs.writeFileSync(output, compiled)
      return output
    })
  }
  compile(path.join(root, 'components/home/light-study'), 'src')
  const tests = compile(path.join(__dirname, 'light-study-tests'), 'tests')
  const result = spawnSync(process.execPath, ['--test', ...tests], { stdio: 'inherit' })
  process.exitCode = result.status ?? 1
} finally {
  fs.rmSync(stage, { recursive: true, force: true })
}
