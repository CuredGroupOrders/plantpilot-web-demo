export function debounce<T extends (...a:any[])=>any>(fn:T, ms=600){
  let t: any; return (...a:Parameters<T>) => { clearTimeout(t); t=setTimeout(()=>fn(...a), ms); };
}

