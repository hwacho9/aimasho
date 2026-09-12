export const usePathname = () => "/";
export const useSearchParams = () => new URLSearchParams(window.location.search);
export const useRouter = () => ({ push: (url: string) => { window.alert(`LOCAL PREVIEW: ${url}`); } });
