import { writeOnce } from "./sheet-bridge";

(function attach(){
  try{
    // attach once
    // @ts-ignore
    if ((window as any).__sm_writeHotkey) return;
    window.addEventListener("keydown",(e: KeyboardEvent)=>{
      if (e.ctrlKey && e.key === "Enter") { writeOnce(); }
    });
    // @ts-ignore
    (window as any).__sm_writeHotkey = true;
    console.log("Hotkey ready: Ctrl+Enter = Submit & Calculate (WRITE)");
  }catch{}
})();
