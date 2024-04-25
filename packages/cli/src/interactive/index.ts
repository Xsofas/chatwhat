import { intro, outro, confirm, select, spinner, isCancel, cancel, note } from '@clack/prompts'
import { existsSync } from 'fs'
import { readFile, rename, writeFile } from 'fs/promises'
import { join } from 'path'
import color from 'picocolors'

import { checkNodeVersion, checkGit } from '../check'
import { PROVIDER_LIST, PROVIDER_DATA, AVAILABLE_LANGUAGES } from '../configuration'
import { copyBaseApp } from '../create-app'
import { startInteractiveLegacy } from '../interactive-legacy'

interface CheckResult {
    pass: boolean
    message: string
}

const handleLegacyCli = async (): Promise<void> => {
    await startInteractiveLegacy()
}

const getVersion = async (): Promise<string> => {
    try {
        const PATHS_DIR: string[] = [
            join(__dirname, 'package.json'),
            join(__dirname, '..', 'package.json'),
            join(__dirname, '..', '..', 'package.json'),
        ]

        const PATH_INDEX: number = PATHS_DIR.findIndex((a: string) => existsSync(a))
        if (PATH_INDEX === -1) {
            throw new Error('No package update file found.')
        }

        const raw = await readFile(PATHS_DIR[PATH_INDEX], 'utf-8')
        const parseRaw = JSON.parse(raw)
        return Promise.resolve(parseRaw.version)
    } catch (e) {
        console.log(`Error: `, e)
        return Promise.resolve('latest')
    }
}

const bannerDone = (templateName: string = '', language: string): void => {
    const notes = [color.yellow(` cd ${templateName} `), color.yellow(` npm install `)]

    if (language === 'ts') {
        notes.push(color.yellow(` npm run dev `))
    } else {
        notes.push(color.yellow(` npm start `))
    }

    const doneNote = [
        ``,
        `📄 Documentation:`,
        `   https://builderbot.vercel.app`,
        ``,
        `🤖 Issues? Join:`,
        `   https://link.codigoencasa.com/DISCORD`,
    ]

    note([...notes, ...doneNote].join('\n'), 'Instructions:')
}

const systemRequirements = async (): Promise<void> => {
    const stepCheckGit: CheckResult = await checkGit()

    if (!stepCheckGit.pass) {
        note(stepCheckGit.message)
        cancel('Operation canceled')
        return process.exit(0)
    }

    const stepCheckNode: CheckResult = await checkNodeVersion()
    if (!stepCheckNode.pass) {
        note(stepCheckNode.message)
        cancel('Operation canceled')
        return process.exit(0)
    }
}

const setVersionTemplate = async (projectPath: string, version: string) => {
    try {
        const pkg = join(projectPath, 'package.json')
        const raw = await readFile(pkg, 'utf-8')
        const parseRaw = JSON.parse(raw)
        const dependencies = parseRaw.dependencies
        const newDependencies = Object.keys(dependencies).map((dep) => {
            if (dep.startsWith('@builderbot/')) return [dep, version]
            if (dep === 'eslint-plugin-builderbot') return [dep, version]
            return [dep, dependencies[dep]]
        })

        parseRaw.dependencies = Object.fromEntries(newDependencies)
        await writeFile(pkg, JSON.stringify(parseRaw, null, 2))
    } catch (e) {
        console.log(`Error Set Version: `, e)
    }
}

const createApp = async (templateName: string | null): Promise<string> => {
    if (!templateName) throw new Error('TEMPLATE_NAME_INVALID: ' + templateName)
    const possiblesPath: string[] = [
        join(__dirname, '..', '..', 'starters', 'apps', templateName),
        join(__dirname, '..', 'starters', 'apps', templateName),
        join(__dirname, 'starters', 'apps', templateName),
    ]
    const indexOfPath: string | undefined = possiblesPath.find((a) => existsSync(a))
    if (!indexOfPath) throw new Error('TEMPLATE_PATH_NOT_FOUND: ' + templateName)
    const pathTemplate = join(process.cwd(), templateName)
    await copyBaseApp(indexOfPath, pathTemplate)
    await rename(join(pathTemplate, '_gitignore'), join(pathTemplate, '.gitignore'))
    return pathTemplate
}

const startInteractive = async (): Promise<void> => {
    try {
        const version = await getVersion()
        console.clear()
        console.log('')

        intro(` Let's create a ${color.bgCyan(' Chatbot ' + 'v' + version)} ✨`)

        const stepContinue = await confirm({
            message: 'Do you want to continue?',
        })

        if (!stepContinue) {
            cancel('Operation canceled')
            return process.exit(0)
        }

        if (isCancel(stepContinue)) {
            cancel('Operation canceled')
            return process.exit(0)
        }

        const stepProvider = await select({
            message: 'Which WhatsApp provider do you want to use?',
            options: PROVIDER_LIST,
        })

        if (isCancel(stepProvider)) {
            cancel('Operation canceled')
            return process.exit(0)
        }

        const stepDatabase = await select({
            message: 'Which database do you want to use?',
            options: PROVIDER_DATA,
        })

        if (isCancel(stepDatabase)) {
            cancel('Operation canceled')
            return process.exit(0)
        }

        const stepLanguage = await select({
            message: 'Which language do you prefer to use?',
            options: AVAILABLE_LANGUAGES,
        })

        if (isCancel(stepLanguage)) {
            cancel('Operation canceled')
            return process.exit(0)
        }

        const s = spinner()
        s.start('Checking requirements')
        await systemRequirements()
        s.stop('Checking requirements')

        s.start(`Creating project...`)
        const NAME_DIR: string = ['base', stepLanguage, stepProvider, stepDatabase].join('-')
        const projectPath = await createApp(NAME_DIR)
        s.stop(`Creating project...`)
        bannerDone(NAME_DIR, stepLanguage as string)
        await setVersionTemplate(projectPath, version)
        outro(color.bgGreen(' Successfully completed! '))
    } catch (e: any) {
        console.log(e)
        if (e?.code === 'ERR_TTY_INIT_FAILED') return handleLegacyCli()
        cancel([`Oops! 🙄 something is not right.`, `Check the minimum requirements in the documentation`].join('\n'))
        return process.exit(0)
    }
}

export { startInteractive }
