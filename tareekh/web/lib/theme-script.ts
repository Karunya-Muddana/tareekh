export const THEME_KEY = "tareekh:theme";
export const THEME_EVENT = "tareekh:theme";

/** Runs in <head> before first paint so the page never flashes the wrong theme. It also re-applies whenever setTheme() fires the theme event. */
export const themeScript = `(()=>{var k='${THEME_KEY}',m=matchMedia('(prefers-color-scheme: dark)'),g=function(){try{return localStorage.getItem(k)}catch(e){return null}},a=function(){var t=g(),d=t==='dark'||(t!=='light'&&m.matches),r=document.documentElement;r.classList.toggle('dark',d);r.style.colorScheme=d?'dark':'light'};a();m.addEventListener('change',a);window.addEventListener('${THEME_EVENT}',a)})()`;
