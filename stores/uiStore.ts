import {defineStore} from 'pinia';
import {computed, ref, watch} from "vue";
import {useRoute, useRouter} from "vue-router";
import _ from "lodash"
import {LocalStorage} from "quasar";
import {useUtils} from "src/core/services/Utils";
import {Toast, ToastType} from "src/core/models/Toast";
import {SHARING_AUTHOR_IDENT, SHARING_AVATAR_IDENT,} from "boot/constants";
import {SidePanelViews} from "src/models/SidePanelViews";
import {SidePanel} from "src/models/SidePanel";

export enum DrawerTabs {
  BOOKMARKS = "bookmarks",
  OPEN_TABS = "openTabs",
  UNASSIGNED_TABS = "unassignedTabs",
  GROUP_BY_HOST_TABS = "groupedByHostTabs",
  SAVED_TABS = "savedTabs",
  SAVED_TABS_AS_PDF = "savedTabsPdf",
  SAVED_TABS_AS_PNG = "savedTabsPng",
  RSS = "rss",
  SCHEDULED = "scheduled",
  HISTORY = "history",
  FEATURES = "features",
  TAB_DETAILS = "tabDetails",
  TABSET_DETAILS = "tabsetDetails",
  NEW_TAB_URLS = "newTabUrls",
  TAGS_VIEWER = "tagsViewer",
  TAG_VIEWER = "tagViewer",
  HELP = "help"
}

export enum UserLevel {
  UNKNOWN = "UNKNOWN",
  DEFAULT = "DEFAULT"
}

export enum ListDetailLevel {
  MINIMAL = "MINIMAL",
  SOME = "SOME",
  MAXIMAL = "MAXIMAL"
}

export class RightDrawer {
  constructor(
    public activeTab: DrawerTabs = DrawerTabs.OPEN_TABS) {
  }
}

export const useUiStore = defineStore('ui', () => {

  const router = useRouter()

  const {sendMsg} = useUtils()

  //const selectedTab = ref<Tab | undefined>(undefined)
  const tabsFilter = ref<string | undefined>(undefined)
  const selectedTag = ref<string | undefined>(undefined)
  const tabsetsExpanded = ref<boolean>(false)
  const syncing = ref<boolean>(false)
  const saving = ref<boolean>(false)
  const appLoading = ref<string | undefined>(undefined)
  const bookmarksLoading = ref<boolean>(false)
  const progress = ref<object | undefined>(undefined)
  const commandExecuting = ref(false)

  // online offline
  const networkOnline = ref(navigator.onLine)

  // RightDrawer
  let rightDrawer = ref<RightDrawer>(new RightDrawer())
  //let rightDrawerOpen = ref($q ? $q.screen.gt.md : true)
  let rightDrawerOpen = ref(false)
  let leftDrawerOpen = ref(true)

  // SidePanel
  let sidePanel = ref<SidePanel>(new SidePanel())
  const animateNewTabsetButton = ref(false)
  const animateSettingsButton = ref(false)
  const animateBookmarksButton = ref(false)

  const showLoginTable = ref(false)

  const highlightTerm = ref<string | undefined>(undefined)

  const newTabsetEmptyByDefault = ref<boolean>(LocalStorage.getItem('ui.newTabsetEmptyByDefault') as unknown as boolean || false)
  const tabBeingDragged = ref<string | undefined>(undefined)
  const dragEvent = ref<DragEvent | undefined>(undefined)
  const footerInfo = ref<string | undefined>(undefined)

  const contentCount = ref<number>(0)

  const listDetailLevel = ref<ListDetailLevel>(LocalStorage.getItem('ui.detailLevel') || ListDetailLevel.SOME)
  const showFullUrls = ref<boolean>(LocalStorage.getItem('ui.fullUrls') || false)
  const showDetailsPerTabset = ref<boolean>(LocalStorage.getItem('ui.detailsPerTabset') || false)

  // info Messages
  const hiddenMessages = ref<string[]>(LocalStorage.getItem('ui.hiddenInfoMessages') as unknown as string[] || [])
  const messageAlreadyShown = ref<string | undefined>(undefined)

  const toasts = ref<Toast[]>([])
  const toastTimeouts = ref<NodeJS.Timeout[]>([])

  // highlight url(s) feature
  const highlightUrls = ref<string[]>([])

  // new tab feature
  const newTabUrlList = ref<object[]>(LocalStorage.getItem('ui.newTabUrlList') as unknown as object[] || [])

  // listener currently triggered on '/' keypress for search keyboard shortcut
  const ignoreKeypress = ref(false)

  // entity management
  const entityType = ref<string | undefined>(undefined)
  const selectedTabsetId = ref<string | undefined>(undefined)

  // system management
  const dbReady = ref<boolean>(false)
  const dbSyncing = ref<boolean>(false)

  const showCurrentTabBox = ref<boolean>(true)

  const toolbarFilter = ref(false)
  const toolbarFilterTerm = ref('')

  // tabset description
  const tabsetDescriptionPanelHights = ref<object>(LocalStorage.getItem('ui.descriptionPanelHeights') as unknown as object || {})

  const sharingAuthor = ref<string>(LocalStorage.getItem(SHARING_AUTHOR_IDENT) as unknown as string || '')
  const sharingAvatar = ref<string>(LocalStorage.getItem(SHARING_AVATAR_IDENT) as unknown as string || '')

  // info e.g. when stopping to sync
  const showSwitchedToLocalInfo = ref<boolean>(false)

  watch(rightDrawer.value, (val: Object) => {
    LocalStorage.set("ui.rightDrawer", val)
  }, {deep: true})

  watch(newTabsetEmptyByDefault,
    (val: Object) => {
      LocalStorage.set("ui.newTabsetEmptyByDefault", val)
    })

  watch(newTabUrlList,
    (val: object[]) => {
      console.log("newTabUrlList", val)
      LocalStorage.set("ui.newTabUrlList", val)
    })

  watch(newTabUrlList.value,
    (val: object[]) => {
      console.log("val", val)
      LocalStorage.set("ui.newTabUrlList", val)
    })

  watch(tabsetDescriptionPanelHights.value,
    (val: object) => {
      LocalStorage.set("ui.descriptionPanelHeights", val)
    })

  watch(sharingAuthor,
    (val: string | undefined) => {
      console.log("val", val)
      LocalStorage.set(SHARING_AUTHOR_IDENT, val)
    })

  watch(sharingAvatar,
    (val: string | undefined) => {
      console.log("val", val)
      LocalStorage.set(SHARING_AVATAR_IDENT, val)
    })

  const route = useRoute()
  watch(route, (to) => {
    // console.log("resetting", messageAlreadyShown.value)
    setAnotherMessageAlreadyShown(undefined)
  }, {flush: 'pre', immediate: true, deep: true})

  watch(
    hiddenMessages,
    (thresholdsVal: Object) => {
      LocalStorage.set("ui.hiddenInfoMessages", thresholdsVal)
    }, {deep: true}
  )

  function draggingTab(tabId: string, evt: DragEvent, doSendMessage = false) {
    tabBeingDragged.value = tabId
    dragEvent.value = evt
    if (doSendMessage) {
      sendMsg("tab-being-dragged", {
        tabId: tabId
      })
    }
  }

  function droppingTab() {
    console.log("dropping tab", tabBeingDragged.value)
    const tabBeingDropped = tabBeingDragged.value
    tabBeingDragged.value = undefined
    dragEvent.value = undefined
    return tabBeingDropped
  }

  function setSelectedTag(tag: string) {
    selectedTag.value = tag
  }

  function addToNewTabUrlList(l: object) {
    newTabUrlList.value.push(l)
  }

  function removeNewTabUrl(url: string) {
    newTabUrlList.value = _.filter(newTabUrlList.value, (e: any) => e.url !== url)
  }

  function setTabsetDescriptionHeight(tabsetId: string, height: number) {
    console.log("setting height", tabsetId, height)

    if (!tabsetDescriptionPanelHights.value[tabsetId as keyof object]) {
      // @ts-ignore
      tabsetDescriptionPanelHights.value[tabsetId as keyof object] = {}
    }
    // @ts-ignore
    tabsetDescriptionPanelHights.value[tabsetId as keyof object]['height'] = height
  }

  function getTabsetDescriptionHeight(tabsetId: string): number | undefined {
    // @ts-ignore
    return tabsetDescriptionPanelHights.value[tabsetId as keyof object] ?
      tabsetDescriptionPanelHights.value[tabsetId as keyof object]['height']
      : undefined
  }

  function setShowTabsetDescription(tabsetId: string, show: boolean): boolean {
    // @ts-ignore
    return tabsetDescriptionPanelHights.value[tabsetId as keyof object]['show'] = show
  }

  function showTabsetDescription(tabsetId: string): boolean {
    // @ts-ignore
    const res = tabsetDescriptionPanelHights.value[tabsetId as keyof object]['show'] as boolean | undefined
    //console.log("got res", res)
    if (res === undefined) {
      return true
    }
    return res
  }


  function hideInfoMessage(ident: string) {
    hiddenMessages.value.push(ident)
  }

  function restoreHints() {
    console.log("hiddenMessages.value", hiddenMessages.value)
    hiddenMessages.value = []
    setAnotherMessageAlreadyShown(undefined)
  }

  function setAnotherMessageAlreadyShown(msg: string | undefined) {
    //console.log("setting setAnotherMessageAlreadyShown", msg)
    messageAlreadyShown.value = msg
  }

  function rightDrawerSetActiveTab(tab: DrawerTabs) {
    rightDrawer.value.activeTab = tab
    rightDrawerOpen.value = true
  }

  function sidePanelSetActiveView(view: SidePanelViews) {
    sidePanel.value.activeView = view
    router.push(view.path)
  }

  const sidePanelActiveViewIs = computed(() => {
    return (viewToCompare: SidePanelViews) => {
      return sidePanel.value.activeView?.ident === viewToCompare.ident
    }
  })


  function setHighlightTerm(term: string | undefined) {
    highlightTerm.value = term
  }

  function setListDetailLevel(val: ListDetailLevel) {
    listDetailLevel.value = val
  }

  function setShowFullUrls(val: boolean) {
    showFullUrls.value = val
  }

  const listDetailLevelGreaterEqual = computed(() => {
    return (level: ListDetailLevel, tabsetDetail: ListDetailLevel | undefined) => {
      //console.log("userLevel", tabsetDetail, listDetailLevel.value)
      let useLevel = tabsetDetail ? tabsetDetail : listDetailLevel.value
      if (!useUiStore().showDetailsPerTabset) {
        useLevel = listDetailLevel.value
      }
      //console.log("useLevel", useLevel)
      switch (useLevel) {
        case ListDetailLevel.MAXIMAL:
          return true
        case ListDetailLevel.SOME:
          return level === ListDetailLevel.SOME || level === ListDetailLevel.MINIMAL
        case ListDetailLevel.MINIMAL:
          return level === ListDetailLevel.MINIMAL
      }
    }
  })

  const showMessage = computed(() => {
    return (ident: string, probability: number = 1, forceDisplay: boolean = false) => {
      //console.log("checking message", ident, probability, hiddenMessages.value)
      if (hiddenMessages.value.indexOf(ident) >= 0) {
        return false
      }
      if (forceDisplay) {
        return true
      }
      const couldBeShown = Math.random() < probability
      //console.log("could be shown", couldBeShown, messageAlreadyShown.value)
      if (couldBeShown && (messageAlreadyShown.value === undefined || messageAlreadyShown.value === ident)) {
        setAnotherMessageAlreadyShown(ident)
        return true
      } else if (messageAlreadyShown.value) {
        return false
      }
      return couldBeShown
    }
  })

  const sidePanelIsActive = computed(() => {
    return (view: SidePanelViews) => sidePanel.value.activeView?.ident === view.ident
  })

  const getContentCount = computed((): number => contentCount.value)

  // function setSelectedTab(tab: Tab) {
  //   console.log("setting selected tab", tab)
  //   selectedTab.value = tab
  // }

  // const getSelectedTab = computed(():Tab | undefined => {
  //   return selectedTab.value as Tab | undefined
  // })

  // highlight url(s) feature
  function clearHighlights() {
    highlightUrls.value = []
  }

  function addHighlight(url: string) {
    highlightUrls.value.push(url)
  }

  const getHighlightUrls = computed(() => highlightUrls.value)

  function ignoreKeypressListener() {
    return ignoreKeypress.value;
  }

  function setIgnoreKeypress(b: boolean) {
    ignoreKeypress.value = b
  }

  function toggleLeftDrawer() {
    leftDrawerOpen.value = !leftDrawerOpen.value
  }

  function toggleToolbarFilter() {
    toolbarFilter.value = !toolbarFilter.value
    if (!toolbarFilter.value) {
      toolbarFilterTerm.value = ''
    }
  }

  function createSuccessToast(msg: string, actions: any[] = []) {
    toastTimeouts.value.forEach((timeout: NodeJS.Timeout) => clearTimeout(timeout))
    toasts.value.push(new Toast(msg, ToastType.INFO, actions))
  }

  function createWarningToast(msg: string, action: any = undefined) {
    toastTimeouts.value.forEach((timeout: NodeJS.Timeout) => clearTimeout(timeout))
    toasts.value.push(new Toast(msg, ToastType.WARNING, action))
  }

  function createErrorToast(msg: string) {
    toastTimeouts.value.forEach((timeout: NodeJS.Timeout) => clearTimeout(timeout))
    toasts.value.push(new Toast(msg, ToastType.ERROR))
  }

  function removeToast(toast: Toast) {
    const index = _.findIndex(toasts.value, (t: Toast) => t.id === toast.id)
    if (index >= 0) {
      toasts.value.splice(index, 1)
    }
  }

  function delayedToastRemoval(delay: number = 3000) {
    if (toasts.value.length > 0) {
      const toast = toasts.value[0]
      let timeout = setTimeout(() => {
        removeToast(toast)
      }, delay)
      toastTimeouts.value.push(timeout)
    }
  }

  function callUndoActionFromCurrentToast() {
    if (toasts.value.length > 0) {
      const toast = toasts.value[0]
      console.log("applying (first) undo/action method...")
      toast.actions[0].handler.apply(null)
      removeToast(toast)
    }
  }

  function getButtonSize(ident: string) {
    if (ident === 'sidePanelFooter') {
      const viewsCount = sidePanel.value.enabledViewsCount()
      const limit = Math.min(viewsCount, 7)
      return (16 - limit) + "px"
    }
    console.log("warning, using unknown ident", ident)
    return "19px"
  }

  function setProgress(v: number, label: string | undefined = undefined) {
    const val = Math.max(0, Math.min(v, 1.0))
    progress.value = {
      val: val,
      label: label ? label : Math.round(100 * val) + "%"
    }
  }

  function stopProgress() {
    progress.value = undefined
  }

  function startButtonAnimation(name: string) {
    switch (name) {
      case 'newTabset':
        animateNewTabsetButton.value = true
        setTimeout(() => animateNewTabsetButton.value = false, 2000)
        break;
      case 'bookmarks':
        animateBookmarksButton.value = true
        setTimeout(() => animateBookmarksButton.value = false, 2000)
        break;
      case 'settings':
        animateSettingsButton.value = true
        setTimeout(() => animateSettingsButton.value = false, 2000)
        break;
      default:
        console.log("unrecognized element name", name)
    }
  }

  return {
    rightDrawer,
    rightDrawerOpen,
    leftDrawerOpen,
    rightDrawerSetActiveTab,
    draggingTab,
    droppingTab,
    newTabsetEmptyByDefault,
    hideInfoMessage,
    restoreHints,
    showMessage,
    footerInfo,
    getContentCount,
    newTabUrlList,
    addToNewTabUrlList,
    removeNewTabUrl,
    clearHighlights,
    addHighlight,
    getHighlightUrls,
    ignoreKeypressListener,
    setIgnoreKeypress,
    entityType,
    highlightTerm,
    setHighlightTerm,
    selectedTag,
    setSelectedTag,
    selectedTabsetId,
    tabsFilter,
    setListDetailLevel,
    setShowFullUrls,
    listDetailLevel,
    showFullUrls,
    listDetailLevelGreaterEqual,
    dbReady,
    dbSyncing,
    sidePanel,
    sidePanelSetActiveView,
    sidePanelIsActive,
    sidePanelActiveViewIs,
    toggleLeftDrawer,
    tabsetsExpanded,
    showCurrentTabBox,
    toolbarFilter,
    toggleToolbarFilter,
    toolbarFilterTerm,
    toasts,
    createSuccessToast,
    createWarningToast,
    createErrorToast,
    delayedToastRemoval,
    callUndoActionFromCurrentToast,
    getButtonSize,
    showDetailsPerTabset,
    setTabsetDescriptionHeight,
    getTabsetDescriptionHeight,
    setShowTabsetDescription,
    showTabsetDescription,
    sharingAuthor,
    sharingAvatar,
    networkOnline,
    tabBeingDragged,
    appLoading,
    bookmarksLoading,
    progress,
    setProgress,
    stopProgress,
    animateNewTabsetButton,
    animateSettingsButton,
    animateBookmarksButton,
    startButtonAnimation,
    showLoginTable,
    showSwitchedToLocalInfo,
    syncing,
    saving,
    commandExecuting
  }
})
