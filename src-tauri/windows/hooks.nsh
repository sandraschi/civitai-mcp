!macro KillFleetProcesses
  DetailPrint "Stopping civitai MCP processes..."
  ExecWait 'taskkill /F /IM civitai-mcp-backend.exe /T' $0
  ExecWait 'taskkill /F /IM civitai-mcp-native.exe /T' $0
  !if "${INSTALLMODE}" == "currentUser"
    nsis_tauri_utils::KillProcessCurrentUser "civitai-mcp-backend.exe"
    Pop $0
    nsis_tauri_utils::KillProcessCurrentUser "civitai-mcp-native.exe"
    Pop $0
  !else
    nsis_tauri_utils::KillProcess "civitai-mcp-backend.exe"
    Pop $0
    nsis_tauri_utils::KillProcess "civitai-mcp-native.exe"
    Pop $0
  !endif
  Sleep 2000
!macroend

!macro NSIS_HOOK_PREINSTALL
  !insertmacro KillFleetProcesses
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  !insertmacro KillFleetProcesses
!macroend
