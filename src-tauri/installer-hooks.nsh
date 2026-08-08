; Caspian Race Monitor — NSIS kurulum kancaları (Tauri v2 installerHooks).
; setup.exe masaüstü uygulamasını kurarken, yanına bundle.resources ile gelen
; TARAYICISIZ hafif köprüye (CaspianLiveBridge.exe) bir Başlat menüsü kısayolu ekler.
; Kısayol adı ASCII (Unicode NSIS sorunları olmasın). Dosya yoksa sessizce atlanır.

!macro NSIS_HOOK_POSTINSTALL
  IfFileExists "$INSTDIR\CaspianLiveBridge.exe" 0 +2
    CreateShortcut "$SMPROGRAMS\Caspian Hafif Kopru.lnk" "$INSTDIR\CaspianLiveBridge.exe"
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  Delete "$SMPROGRAMS\Caspian Hafif Kopru.lnk"
!macroend
