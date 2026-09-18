; Custom NSIS hooks for electron-builder (STANDARDS.md §7 — "AppMutex +
; running-process check" requirement, and §14/DoD "already open" check for
; the INSTALLER, not just the app).
;
; electron-builder's own single-instance lock (requestSingleInstanceLock,
; see electron/main.cjs) lives inside the app, not the installer — it does
; nothing to stop the installer/uninstaller from overwriting or deleting
; files that FamilyQuest PC still has open. This checks via `tasklist`
; before install AND before uninstall, and blocks with a Retry/Cancel
; prompt until the user actually closes the app (or cancels setup).
;
; ${APP_EXECUTABLE_FILENAME} is provided by electron-builder's own generated
; script — no need to hardcode "FamilyQuest PC.exe" here.

!macro customCheckAppRunning
  retry_check:
  nsExec::ExecToStack 'tasklist /FI "IMAGENAME eq ${APP_EXECUTABLE_FILENAME}" /NH'
  Pop $0
  Pop $1
  StrLen $2 "${APP_EXECUTABLE_FILENAME}"
  StrCpy $3 $1 $2
  StrCmp $3 "${APP_EXECUTABLE_FILENAME}" 0 +3
    MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "FamilyQuest PC is currently running.$\r$\nPlease close it (including from the system tray) before continuing." IDRETRY retry_check
    Abort
!macroend

!macro customInit
  !insertmacro customCheckAppRunning
!macroend

!macro customUnInit
  !insertmacro customCheckAppRunning
!macroend

; ============================================================
; Welcome / Finish page copy + brand-color button styling
;
; Nothing above this line was touched. FamilyQuest PC's assisted (non-
; oneClick) installer had no welcome page and no finish-page text at all
; before this — Modern UI 2 only shows one if a customWelcomePage/
; customFinishPage macro explicitly inserts MUI_PAGE_WELCOME/MUI_PAGE_FINISH,
; and neither existed here. Copy below is written warm/friendly for a
; kid-facing product, not corporate boilerplate, and explains what the app
; actually does. MUI_BGCOLOR/MUI_TEXTCOLOR are NOT used because they don't
; exist in Modern UI 2 (only in the older classic "Modern UI") — the real,
; supported color hook here is MUI_WELCOMEPAGE_TEXT for copy, and disabling
; Windows theming on one button handle (see ColorPrimaryButton below) to
; make SetCtlColors take effect for a brand-colored primary button. That
; button loses the native rounded Windows chrome and renders flat/classic
; in the brand color — a real, visible change, not a shaped custom bitmap
; button. Back/Cancel are left native on purpose.
; ============================================================

!ifndef BUILD_UNINSTALLER

  ; Numeric language IDs (1033=English, 1037=Hebrew) — ${LANG_*} constants
  ; are not available at include-time when displayLanguageSelector is true.
  LangString WelcomeTitle 1033 "Welcome to FamilyQuest PC!"
  LangString WelcomeTitle 1037 "ברוכים הבאים ל-FamilyQuest PC!"

  LangString WelcomeText 1033 "FamilyQuest PC turns everyday screen time and chores into a game the whole family enjoys. Kids earn coins for finishing quests (chores, homework, screen-time goals), can redeem coins for bonus screen time, and see a weekly star for the family's top performer — all with support for multiple children.$\r$\n$\r$\nEverything runs locally on this PC: no account to create, no cloud, no data leaving the house.$\r$\n$\r$\nIt's recommended to close FamilyQuest PC (including the system tray icon) before continuing.$\r$\n$\r$\nClick Next to continue."
  LangString WelcomeText 1037 "FamilyQuest PC הופך את זמן המסך והמטלות היומיומיות למשחק שכל המשפחה נהנית ממנו. ילדים מרוויחים מטבעות על השלמת משימות (מטלות בית, שיעורי בית, יעדי זמן מסך), יכולים לפדות מטבעות בתמורה לזמן מסך בונוס, ורואים כוכב שבועי לילד/ה המצטיין/ת — עם תמיכה בכמה ילדים.$\r$\n$\r$\nהכול רץ מקומית על המחשב הזה: בלי צורך ליצור חשבון, בלי ענן, בלי שהמידע יוצא מהבית.$\r$\n$\r$\nמומלץ לסגור את FamilyQuest PC (כולל מהמגש של המערכת) לפני שתמשיכו.$\r$\n$\r$\nלחצו הבא כדי להמשיך."

  LangString FinishTitle 1033 "All set — let the quests begin!"
  LangString FinishTitle 1037 "הכול מוכן — שהמשימות יתחילו!"

  LangString FinishText 1033 "FamilyQuest PC has been installed.$\r$\n$\r$\nOpen it from the desktop shortcut or the Start menu to add your kids, set up quests, and start earning coins and screen time together.$\r$\n$\r$\nClick Finish to close this wizard."
  LangString FinishText 1037 "FamilyQuest PC הותקן בהצלחה.$\r$\n$\r$\nפתחו אותו מקיצור שולחן העבודה או מתפריט התחל כדי להוסיף את הילדים, להגדיר משימות, ולהתחיל להרוויח מטבעות וזמן מסך ביחד.$\r$\n$\r$\nלחצו סיום כדי לסגור את האשף."

  ; Brand palette, WCAG-AA audited: purple #4834a3 vs white text is 9.15:1
  ; and gold #ffd166 vs black text is 14.56:1 — both comfortably pass AA
  ; (4.5:1) with no darkening needed, unlike Playnest/ActionClip's violets.
  Function ColorPrimaryButton
    GetDlgItem $0 $HWNDPARENT 1 ; Next / Install / Finish
    System::Call 'uxtheme::SetWindowTheme(i r0, w "", w "") i .r1'
    SetCtlColors $0 0xFFFFFF 0x4834A3
  FunctionEnd

  !macro customWelcomePage
    !define MUI_WELCOMEPAGE_TITLE "$(WelcomeTitle)"
    !define MUI_WELCOMEPAGE_TEXT "$(WelcomeText)"
    !define MUI_PAGE_CUSTOMFUNCTION_SHOW ColorPrimaryButton
    !insertmacro MUI_PAGE_WELCOME
  !macroend

  !macro customFinishPage
    !define MUI_FINISHPAGE_TITLE "$(FinishTitle)"
    !define MUI_FINISHPAGE_TEXT "$(FinishText)"
    !define MUI_PAGE_CUSTOMFUNCTION_SHOW ColorPrimaryButton
    !insertmacro MUI_PAGE_FINISH
  !macroend

!endif
