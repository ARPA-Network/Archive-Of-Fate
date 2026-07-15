import './styles/reset.css'
import './styles/theme-default.css'
import './styles/pages.css'

import { $ui, core, installGlobals, UI } from './globals'
import { setLanguage } from './i18n'
import { progression } from './core/progression'
import { isInscribeConfigured, watchWallet } from './web3/chain'

import { LoadingPage } from './pages/Loading'
import { MainPage } from './pages/Main'
import { ConnectWalletPage } from './pages/ConnectWallet'
import { TalentPage } from './pages/Talent'
import { PropertyPage } from './pages/Property'
import { TrajectoryPage } from './pages/Trajectory'
import { SummaryPage } from './pages/Summary'
import { FateSummaryPage } from './pages/FateSummary'
import { MythAtlasPage } from './pages/MythAtlas'
import { WorldBoardPage } from './pages/WorldBoard'
import { AchievementPage } from './pages/Achievement'
import { ThanksPage } from './pages/Thanks'

const DESIGN_W = 750
const DESIGN_H = 1334

function applyScale(): void {
  const stage = document.getElementById('stage')!
  const scale = Math.min(window.innerWidth / DESIGN_W, window.innerHeight / DESIGN_H)
  stage.style.transform = `scale(${scale})`
}

function registerPages(): void {
  $ui.registerPage(UI.pages.LOADING, LoadingPage)
  $ui.registerPage(UI.pages.MAIN, MainPage)
  $ui.registerPage(UI.pages.CONNECT_WALLET, ConnectWalletPage)
  $ui.registerPage(UI.pages.TALENT, TalentPage)
  $ui.registerPage(UI.pages.PROPERTY, PropertyPage)
  $ui.registerPage(UI.pages.TRAJECTORY, TrajectoryPage)
  $ui.registerPage(UI.pages.SUMMARY, SummaryPage)
  $ui.registerPage(UI.pages.FATE_SUMMARY, FateSummaryPage)
  $ui.registerPage(UI.pages.MYTH_ATLAS, MythAtlasPage)
  $ui.registerPage(UI.pages.WORLD_BOARD, WorldBoardPage)
  $ui.registerPage(UI.pages.ACHIEVEMENT, AchievementPage)
  $ui.registerPage(UI.pages.THANKS, ThanksPage)
}

async function bootstrap(): Promise<void> {
  installGlobals()

  const stage = document.getElementById('stage')!
  stage.setAttribute('data-theme', progression.theme())

  const lang = progression.lang()
  setLanguage(lang)
  stage.setAttribute('data-lang', lang.startsWith('en') ? 'en' : 'zh')

  applyScale()
  window.addEventListener('resize', applyScale)
  window.addEventListener('orientationchange', applyScale)

  registerPages()

  if (isInscribeConfigured()) {
    watchWallet(() => {
      progression.disconnectWallet()
      location.reload()
    })
  }

  await core.initial(lang)

  await $ui.switchView(UI.pages.LOADING)
}

bootstrap().catch((e) => console.error('[bootstrap] fatal', e))
