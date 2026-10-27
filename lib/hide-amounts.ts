/**
 * Hide amounts on the website, per browser (components/settings/hide-amounts.tsx sets it). Its own
 * module, not the client component's, so the root layout (a server component) can read the script.
 * The script applies it before the first paint, so the figures never flash.
 */
export const HIDE_AMOUNTS_KEY = 'receiptwise-hide-amounts';
export const HIDE_AMOUNTS_SCRIPT = `try{if(localStorage.getItem('${HIDE_AMOUNTS_KEY}')==='1')document.documentElement.classList.add('hide-amounts')}catch(e){}`;
