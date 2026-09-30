export const THEME_KEY = "tareekh:theme";
export const THEME_EVENT = "tareekh:theme";
export const SIDEBAR_WIDTH_KEY = "tareekh:sidebar-width";

/** Runs in <head> before first paint so the page never flashes the wrong theme (or the wrong sidebar width). It also re-applies whenever setTheme() fires the theme event. */
export const themeScript = `(()=>{var k='${THEME_KEY}',m=matchMedia('(prefers-color-scheme: dark)'),g=function(){try{return localStorage.getItem(k)}catch(e){return null}},a=function(){var t=g(),d=t==='dark'||(t!=='light'&&m.matches),r=document.documentElement;r.classList.toggle('dark',d);r.style.colorScheme=d?'dark':'light'};a();m.addEventListener('change',a);window.addEventListener('${THEME_EVENT}',a);try{var w=+localStorage.getItem('${SIDEBAR_WIDTH_KEY}');if(w>=200&&w<=440)document.documentElement.style.setProperty('--sidebar-width-user',w+'px')}catch(e){}})()`;
