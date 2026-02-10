import { getPackageName, getPackageStage } from 'typekit-i18n'

const root = document.querySelector<HTMLDivElement>('#app')

if (!root) {
  throw new Error('Missing #app container')
}

const heading = document.createElement('h1')
heading.textContent = 'typekit-i18n playground'

const details = document.createElement('p')
details.textContent = `${getPackageName()} is currently in ${getPackageStage()} stage.`

root.append(heading, details)
