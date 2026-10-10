import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

/**
 * 접속 키 발급: npm run addkey -- <username> [--local]
 * 키 원문은 화면에만 한 번 출력하고, R2 에는 SHA-256 해시를 이름으로 한 객체(본문 = 사용자 이름)만 저장한다.
 * 키를 폐기하려면 R2 대시보드에서 keys/<해시> 객체를 지운다. 같은 사용자에게 키를 여러 개 발급할 수 있다.
 * --local 은 `wrangler dev` 의 로컬 R2 에 넣는다(시험용).
 */

const NAME_PATTERN = /^[A-Za-z0-9_-]{1,32}$/
const BUCKET = 'vibe-chat'

const name = process.argv[2]
if (!name || !NAME_PATTERN.test(name)) {
  console.error('사용법: npm run addkey -- <username>   (영문·숫자·_- 1~32자)')
  process.exit(1)
}

const key = `vk_${crypto.randomBytes(32).toString('hex')}`
const hash = crypto.createHash('sha256').update(key).digest('hex')
const file = path.join(os.tmpdir(), `vibe-key-${hash}.txt`)
fs.writeFileSync(file, name)
const result = spawnSync('npx', ['wrangler', 'r2', 'object', 'put', `${BUCKET}/keys/${hash}`, '--file', file,
  process.argv.includes('--local') ? '--local' : '--remote'], { stdio: 'inherit', shell: true })
fs.rmSync(file)
if (result.status !== 0) process.exit(result.status ?? 1)
console.log(`\n'${name}' 접속 키 (다시 볼 수 없으니 지금 전달하세요):\n${key}`)
