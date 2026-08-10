import { spawn, spawnSync } from 'node:child_process'

const composeArgs = [
  'compose',
  '--env-file',
  '.env',
  '-f',
  'backend/docker-compose.yml',
]

let shuttingDown = false
let frontend

function runDocker(args, stdio = 'inherit') {
  return spawnSync('docker', [...composeArgs, ...args], {
    cwd: process.cwd(),
    shell: process.platform === 'win32',
    stdio,
  })
}

function shutdown(exitCode) {
  if (shuttingDown) return
  shuttingDown = true

  console.log('\n開発環境を停止しています...')

  if (frontend && frontend.exitCode === null) {
    if (process.platform === 'win32') {
      spawnSync('taskkill', ['/pid', String(frontend.pid), '/t', '/f'], {
        stdio: 'ignore',
      })
    } else {
      frontend.kill('SIGTERM')
    }
  }

  const result = runDocker(['down'])
  if (result.status !== 0) {
    console.error('Docker Composeの停止に失敗しました。`mise run stop` を実行してください。')
    process.exitCode = result.status ?? 1
    return
  }

  console.log('Nuxt、バックエンド、PostgreSQLを停止しました。')
  process.exitCode = exitCode
}

process.once('SIGINT', () => shutdown(130))
process.once('SIGTERM', () => shutdown(143))

const compose = runDocker(['up', '-d', '--build', '--wait'])
if (compose.status !== 0) {
  process.exit(compose.status ?? 1)
}

frontend = spawn('pnpm', ['--dir', 'frontend', 'dev'], {
  cwd: process.cwd(),
  shell: process.platform === 'win32',
  stdio: 'inherit',
})

frontend.once('error', (error) => {
  console.error(`Nuxtの起動に失敗しました: ${error.message}`)
  shutdown(1)
})

frontend.once('exit', (code, signal) => {
  if (shuttingDown) return
  shutdown(signal ? 1 : (code ?? 0))
})
